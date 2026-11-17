-- =============================================================================
-- OfertAr · TesProm — Módulo de Canje Temporal (PIN 5 min) y Métricas BI
-- Archivo: supabase/canjes_y_metricas.sql
-- Instrucciones: Copiar y ejecutar este script en el SQL Editor de Supabase.
-- =============================================================================

-- 1. Asegurar extensión pgcrypto para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Agregar columnas de stock y métricas BI en `public.promociones` de forma segura
ALTER TABLE public.promociones
  ADD COLUMN IF NOT EXISTS stock_disponible INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vistas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clics_whatsapp INT NOT NULL DEFAULT 0;

-- 3. Crear tabla `public.canjes_temporales`
CREATE TABLE IF NOT EXISTS public.canjes_temporales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_id UUID NOT NULL REFERENCES public.promociones(id) ON DELETE CASCADE,
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  codigo_pin VARCHAR(6) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'canjeado', 'expirado')),
  creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  canjeado_at TIMESTAMPTZ DEFAULT NULL
);

-- Índice parcial para búsquedas rápidas de PINs pendientes por comercio
CREATE INDEX IF NOT EXISTS idx_canjes_temporales_pendientes_pin
  ON public.canjes_temporales (comercio_id, codigo_pin)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_canjes_temporales_comercio_estado
  ON public.canjes_temporales (comercio_id, estado, creado_at DESC);

-- 4. Habilitar Row Level Security (RLS) en `public.canjes_temporales`
ALTER TABLE public.canjes_temporales ENABLE ROW LEVEL SECURITY;

-- Política: Cada comerciante autenticado solo puede consultar los canjes de sus propios comercios
DROP POLICY IF EXISTS "Comercios pueden ver sus propios canjes" ON public.canjes_temporales;
CREATE POLICY "Comercios pueden ver sus propios canjes"
  ON public.canjes_temporales
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.comercios c
      WHERE c.id = canjes_temporales.comercio_id
        AND c.user_id = auth.uid()
    )
  );

-- 5. Función RPC: `generar_pin_canje(p_promocion_id UUID)`
-- Valida vigencia y stock con bloqueo FOR UPDATE, genera PIN único de 6 caracteres
-- con vigencia de 5 minutos e incrementa las vistas de intención de la promoción.
CREATE OR REPLACE FUNCTION public.generar_pin_canje(p_promocion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_pin VARCHAR(6);
  v_chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_canje_id UUID;
  v_expira_at TIMESTAMPTZ;
  v_intentos INT := 0;
  i INT;
BEGIN
  -- Marcar como expirados los canjes pendientes que ya superaron su ventana de 5 min
  UPDATE public.canjes_temporales
     SET estado = 'expirado'
   WHERE promocion_id = p_promocion_id
     AND estado = 'pendiente'
     AND expira_at <= NOW();

  -- Bloquear la fila de la promoción para validar vigencia y stock de manera consistente
  SELECT id, comercio_id, titulo, vence_el, stock_disponible
    INTO v_promo
    FROM public.promociones
   WHERE id = p_promocion_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'PROMO_NO_EXISTE',
      'mensaje', 'La promoción seleccionada no existe o fue eliminada.'
    );
  END IF;

  IF v_promo.vence_el IS NOT NULL AND v_promo.vence_el <= NOW() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'PROMO_VENCIDA',
      'mensaje', 'Esta promoción ya ha finalizado.'
    );
  END IF;

  IF v_promo.stock_disponible IS NOT NULL AND v_promo.stock_disponible <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_STOCK',
      'mensaje', 'Se agotó el stock disponible para esta promoción.'
    );
  END IF;

  -- Generar código alfanumérico de 6 caracteres sin colisión entre pendientes del comercio
  LOOP
    v_intentos := v_intentos + 1;
    v_pin := '';
    FOR i IN 1..6 LOOP
      v_pin := v_pin || substr(v_chars, floor(random() * length(v_chars) + 1)::INT, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1
        FROM public.canjes_temporales
       WHERE comercio_id = v_promo.comercio_id
         AND codigo_pin = v_pin
         AND estado = 'pendiente'
         AND expira_at > NOW()
    ) OR v_intentos > 15;
  END LOOP;

  v_expira_at := NOW() + INTERVAL '5 minutes';

  INSERT INTO public.canjes_temporales (
    promocion_id,
    comercio_id,
    codigo_pin,
    estado,
    creado_at,
    expira_at
  )
  VALUES (
    v_promo.id,
    v_promo.comercio_id,
    v_pin,
    'pendiente',
    NOW(),
    v_expira_at
  )
  RETURNING id INTO v_canje_id;

  -- Incrementar contador de vistas/interacciones de la promoción
  UPDATE public.promociones
     SET vistas = COALESCE(vistas, 0) + 1
   WHERE id = v_promo.id;

  RETURN jsonb_build_object(
    'ok', true,
    'canje_id', v_canje_id,
    'pin', v_pin,
    'expira_at', v_expira_at,
    'promocion_id', v_promo.id,
    'promocion_titulo', v_promo.titulo,
    'stock_disponible', v_promo.stock_disponible
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generar_pin_canje(UUID) TO anon, authenticated;

-- 6. Función RPC: `validar_pin_comercio(p_comercio_id UUID, p_pin VARCHAR)`
-- Valida el PIN en el mostrador del comercio, verifica la ventana de 5 minutos,
-- marca el token como 'canjeado' y descuenta atómicamente `stock_disponible`.
CREATE OR REPLACE FUNCTION public.validar_pin_comercio(
  p_comercio_id UUID,
  p_pin VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin_limpio VARCHAR(6);
  v_canje RECORD;
  v_promo RECORD;
  v_nuevo_stock INT;
BEGIN
  v_pin_limpio := UPPER(TRIM(COALESCE(p_pin, '')));

  IF length(v_pin_limpio) <> 6 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'FORMATO_INVALIDO',
      'mensaje', 'El código PIN debe tener exactamente 6 caracteres.'
    );
  END IF;

  -- Verificar que el usuario autenticado sea propietario del comercio (si hay sesión activa)
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.comercios c
       WHERE c.id = p_comercio_id
         AND c.user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'codigo', 'NO_AUTORIZADO',
        'mensaje', 'No tienes permisos para validar canjes en este comercio.'
      );
    END IF;
  END IF;

  -- Buscar el canje más reciente asociado a ese comercio y PIN bloqueando la fila
  SELECT *
    INTO v_canje
    FROM public.canjes_temporales
   WHERE comercio_id = p_comercio_id
     AND UPPER(codigo_pin) = v_pin_limpio
   ORDER BY creado_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'PIN_INVALIDO',
      'mensaje', 'Código PIN inexistente para esta sucursal.'
    );
  END IF;

  IF v_canje.estado = 'canjeado' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'YA_CANJEADO',
      'mensaje', 'Este código PIN ya fue utilizado anteriormente.'
    );
  END IF;

  -- Verificar si superó los 5 minutos de validez
  IF v_canje.estado = 'expirado' OR v_canje.expira_at <= NOW() THEN
    UPDATE public.canjes_temporales
       SET estado = 'expirado'
     WHERE id = v_canje.id;

    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'PIN_EXPIRADO',
      'mensaje', 'El código PIN superó el límite de 5 minutos y ha expirado.'
    );
  END IF;

  -- Bloquear la promoción para validar y descontar stock atómicamente
  SELECT id, titulo, vence_el, stock_disponible
    INTO v_promo
    FROM public.promociones
   WHERE id = v_canje.promocion_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'PROMO_NO_EXISTE',
      'mensaje', 'La promoción asociada ya no existe.'
    );
  END IF;

  IF v_promo.stock_disponible IS NOT NULL AND v_promo.stock_disponible <= 0 THEN
    UPDATE public.canjes_temporales
       SET estado = 'expirado'
     WHERE id = v_canje.id;

    RETURN jsonb_build_object(
      'ok', false,
      'codigo', 'SIN_STOCK',
      'mensaje', 'La promoción ya no cuenta con stock disponible.'
    );
  END IF;

  -- Descontar stock si no es NULL (NULL = stock ilimitado)
  IF v_promo.stock_disponible IS NOT NULL THEN
    v_nuevo_stock := v_promo.stock_disponible - 1;
    UPDATE public.promociones
       SET stock_disponible = v_nuevo_stock
     WHERE id = v_promo.id;
  ELSE
    v_nuevo_stock := NULL;
  END IF;

  -- Marcar el PIN como canjeado
  UPDATE public.canjes_temporales
     SET estado = 'canjeado',
         canjeado_at = NOW()
   WHERE id = v_canje.id;

  RETURN jsonb_build_object(
    'ok', true,
    'codigo', 'CANJE_EXITOSO',
    'mensaje', '¡PIN validado con éxito! El canje fue registrado.',
    'canje_id', v_canje.id,
    'codigo_pin', v_canje.codigo_pin,
    'promocion_id', v_promo.id,
    'promocion_titulo', v_promo.titulo,
    'stock_restante', v_nuevo_stock,
    'canjeado_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_pin_comercio(UUID, VARCHAR) TO authenticated;

-- 7. Funciones RPC auxiliares para telemetría de embudo (vistas y clics a WhatsApp)
CREATE OR REPLACE FUNCTION public.incrementar_metrica_promo(
  p_promocion_id UUID,
  p_tipo VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tipo = 'vista' THEN
    UPDATE public.promociones
       SET vistas = COALESCE(vistas, 0) + 1
     WHERE id = p_promocion_id;
  ELSIF p_tipo = 'whatsapp' THEN
    UPDATE public.promociones
       SET clics_whatsapp = COALESCE(clics_whatsapp, 0) + 1
     WHERE id = p_promocion_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_metrica_promo(UUID, VARCHAR) TO anon, authenticated;
