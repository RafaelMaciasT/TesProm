-- =============================================================================
-- OfertAr · TesProm — Consulta Geoespacial de Todos los Comercios Cercanos (LEFT JOIN)
-- Archivo: supabase/comercios_cercanos_mapa.sql
-- Instrucciones: Copiar y ejecutar este script en el SQL Editor de Supabase.
-- =============================================================================

-- 1. Asegurar extensión PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Función RPC para el Mapa: `obtener_comercios_cercanos`
-- Realiza un LEFT JOIN desde `public.comercios` hacia `public.promociones`
-- (filtrando solo promociones vigentes y con stock > 0), devolviendo TODOS los
-- comercios dentro del radio seleccionado tengan 0 o más promociones activas.
CREATE OR REPLACE FUNCTION public.obtener_comercios_cercanos(
  lat_origen DOUBLE PRECISION,
  lng_origen DOUBLE PRECISION,
  radio_metros DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (
  comercio_id UUID,
  nombre TEXT,
  rubro TEXT,
  telefono_whatsapp TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distancia_metros DOUBLE PRECISION,
  promos_activas_count INT,
  promos_activas JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS comercio_id,
    c.nombre::TEXT AS nombre,
    c.rubro::TEXT AS rubro,
    c.telefono_whatsapp::TEXT AS telefono_whatsapp,
    ST_Y(c.ubicacion::geometry) AS lat,
    ST_X(c.ubicacion::geometry) AS lng,
    ST_Distance(
      c.ubicacion::geography,
      ST_SetSRID(ST_MakePoint(lng_origen, lat_origen), 4326)::geography
    ) AS distancia_metros,
    COUNT(p.id)::INT AS promos_activas_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'comercio_id', c.id,
          'titulo', p.titulo,
          'descripcion', p.descripcion,
          'imagen_url', p.imagen_url,
          'vence_el', p.vence_el,
          'es_flash', COALESCE(p.es_flash, false),
          'stock_disponible', p.stock_disponible,
          'comercio_nombre', c.nombre,
          'comercio_rubro', c.rubro,
          'comercio_telefono', c.telefono_whatsapp
        )
        ORDER BY p.vence_el ASC
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::jsonb
    ) AS promos_activas
  FROM public.comercios c
  LEFT JOIN public.promociones p
    ON p.comercio_id = c.id
   AND p.vence_el > NOW()
   AND (p.stock_disponible IS NULL OR p.stock_disponible > 0)
  WHERE c.ubicacion IS NOT NULL
    AND ST_DWithin(
      c.ubicacion::geography,
      ST_SetSRID(ST_MakePoint(lng_origen, lat_origen), 4326)::geography,
      radio_metros
    )
  GROUP BY c.id, c.nombre, c.rubro, c.telefono_whatsapp, c.ubicacion
  ORDER BY COUNT(p.id) DESC, distancia_metros ASC;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_comercios_cercanos(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;

-- 3. (Opcional) Actualización de `obtener_promos_cercanas` para el Feed de Ofertas
-- Garantiza que el feed principal (`PromoList.jsx`) solo liste promociones vigentes
-- con stock disponible (> 0 o ilimitado) e incluya coordenadas del comercio.
CREATE OR REPLACE FUNCTION public.obtener_promos_cercanas(
  lat_origen DOUBLE PRECISION,
  lng_origen DOUBLE PRECISION,
  radio_metros DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (
  id UUID,
  comercio_id UUID,
  titulo TEXT,
  descripcion TEXT,
  imagen_url TEXT,
  vence_el TIMESTAMPTZ,
  es_flash BOOLEAN,
  stock_disponible INT,
  comercio_nombre TEXT,
  comercio_rubro TEXT,
  comercio_telefono TEXT,
  comercio_lat DOUBLE PRECISION,
  comercio_lng DOUBLE PRECISION,
  distancia_metros DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.comercio_id,
    p.titulo::TEXT,
    p.descripcion::TEXT,
    p.imagen_url::TEXT,
    p.vence_el,
    COALESCE(p.es_flash, false) AS es_flash,
    p.stock_disponible,
    c.nombre::TEXT AS comercio_nombre,
    c.rubro::TEXT AS comercio_rubro,
    c.telefono_whatsapp::TEXT AS comercio_telefono,
    ST_Y(c.ubicacion::geometry) AS comercio_lat,
    ST_X(c.ubicacion::geometry) AS comercio_lng,
    ST_Distance(
      c.ubicacion::geography,
      ST_SetSRID(ST_MakePoint(lng_origen, lat_origen), 4326)::geography
    ) AS distancia_metros
  FROM public.promociones p
  INNER JOIN public.comercios c
    ON c.id = p.comercio_id
  WHERE p.vence_el > NOW()
    AND (p.stock_disponible IS NULL OR p.stock_disponible > 0)
    AND c.ubicacion IS NOT NULL
    AND ST_DWithin(
      c.ubicacion::geography,
      ST_SetSRID(ST_MakePoint(lng_origen, lat_origen), 4326)::geography,
      radio_metros
    )
  ORDER BY distancia_metros ASC, p.vence_el ASC;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_promos_cercanas(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated;
