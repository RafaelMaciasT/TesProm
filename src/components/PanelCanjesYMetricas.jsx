import { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  MessageCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  TicketCheck,
  XCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

function computeEffectiveStatus(canje) {
  if (!canje) return 'expirado';
  if (canje.estado === 'canjeado') return 'canjeado';
  if (canje.estado === 'expirado') return 'expirado';
  if (canje.expira_at && new Date(canje.expira_at) <= new Date()) {
    return 'expirado';
  }
  return 'pendiente';
}

export default function PanelCanjesYMetricas({
  comercioId,
  comercioNombre,
  promociones = [],
  onPromoUpdated,
}) {
  const [pinInput, setPinInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const [canjes, setCanjes] = useState([]);
  const [loadingCanjes, setLoadingCanjes] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const fetchCanjesComercio = useCallback(async () => {
    if (!comercioId || !isSupabaseConfigured || !supabase) return;

    setLoadingCanjes(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('canjes_temporales')
        .select('*')
        .eq('comercio_id', comercioId)
        .order('creado_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      setCanjes(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(
        err.message ||
          'No se pudieron consultar los canjes. Verifica haber ejecutado supabase/canjes_y_metricas.sql.'
      );
      setCanjes([]);
    } finally {
      setLoadingCanjes(false);
    }
  }, [comercioId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (!cancelled) {
        fetchCanjesComercio();
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [fetchCanjesComercio]);

  const handleValidatePin = async (e) => {
    e.preventDefault();
    const cleanPin = pinInput
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);

    if (cleanPin.length !== 6) {
      setValidationResult({
        ok: false,
        mensaje: 'Ingresa los 6 caracteres del código PIN del cliente.',
      });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setValidationResult({
        ok: false,
        mensaje: 'Supabase no está configurado.',
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.rpc('validar_pin_comercio', {
        p_comercio_id: comercioId,
        p_pin: cleanPin,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.ok === false) {
        setValidationResult({
          ok: false,
          codigo: data?.codigo || 'ERROR',
          mensaje:
            data?.mensaje ||
            'Código PIN inválido o expirado para este comercio.',
        });
        await fetchCanjesComercio();
        return;
      }

      try {
        confetti({
          particleCount: 75,
          spread: 65,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignorar en entornos sin canvas
      }

      setValidationResult({
        ok: true,
        codigo: data.codigo,
        mensaje: data.mensaje || 'Canje validado exitosamente.',
        promocion_titulo: data.promocion_titulo,
        stock_restante: data.stock_restante,
        codigo_pin: cleanPin,
      });
      setPinInput('');

      await fetchCanjesComercio();
      if (onPromoUpdated) {
        onPromoUpdated(comercioId);
      }
    } catch (err) {
      setValidationResult({
        ok: false,
        mensaje:
          err.message || 'Ocurrió un error al validar el PIN en el servidor.',
      });
    } finally {
      setValidating(false);
    }
  };

  // Cálculo de KPIs e Inteligencia Comercial (BI)
  const metrics = useMemo(() => {
    const totalVistasRaw = promociones.reduce(
      (acc, p) => acc + (Number(p.vistas) || 0),
      0
    );
    const totalClicsWhatsapp = promociones.reduce(
      (acc, p) => acc + (Number(p.clics_whatsapp) || 0),
      0
    );

    let canjesValidados = 0;
    let tokensExpirados = 0;
    let tokensPendientes = 0;

    for (const c of canjes) {
      const st = computeEffectiveStatus(c);
      if (st === 'canjeado') canjesValidados += 1;
      else if (st === 'expirado') tokensExpirados += 1;
      else tokensPendientes += 1;
    }

    const totalPinsEmitidos = canjes.length;
    const totalVistas = Math.max(
      totalVistasRaw,
      totalClicsWhatsapp + totalPinsEmitidos
    );
    const intencionTotal = totalClicsWhatsapp + totalPinsEmitidos;

    const baseConversion =
      totalPinsEmitidos > 0 ? totalPinsEmitidos : totalVistas;
    const tasaConversion =
      baseConversion > 0
        ? Number(((canjesValidados / baseConversion) * 100).toFixed(1))
        : 0;

    const maxBase = Math.max(
      1,
      totalVistas,
      intencionTotal,
      totalPinsEmitidos,
      canjesValidados
    );

    return {
      totalVistas,
      totalClicsWhatsapp,
      totalPinsEmitidos,
      canjesValidados,
      tokensExpirados,
      tokensPendientes,
      intencionTotal,
      tasaConversion,
      funnel: [
        {
          id: 'vistas',
          label: '1. Exposición en Mapa y Feed (Vistas)',
          value: totalVistas,
          percent: totalVistas > 0 ? 100 : 0,
          barColor: 'bg-stone-700',
        },
        {
          id: 'intencion',
          label: '2. Intención de Compra (WhatsApp + Solicitudes PIN)',
          value: intencionTotal,
          percent: Math.min(100, Math.round((intencionTotal / maxBase) * 100)),
          barColor: 'bg-amber-500',
        },
        {
          id: 'pins',
          label: '3. Tokens PIN Emitidos para Mostrador (5 min)',
          value: totalPinsEmitidos,
          percent: Math.min(
            100,
            Math.round((totalPinsEmitidos / maxBase) * 100)
          ),
          barColor: 'bg-orange-500',
        },
        {
          id: 'canjes',
          label: '4. Conversiones Efectivas (Canjes Validados en Local)',
          value: canjesValidados,
          percent: Math.min(100, Math.round((canjesValidados / maxBase) * 100)),
          barColor: 'bg-orange-600',
        },
      ],
    };
  }, [promociones, canjes]);

  const promoTitleById = useMemo(() => {
    const map = {};
    for (const p of promociones) {
      if (p.id) map[p.id] = p.titulo;
    }
    return map;
  }, [promociones]);

  return (
    <div className="space-y-5">
      {/* 1. VALIDADOR DE PIN EN MOSTRADOR */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
              <KeyRound className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h4 className="font-display text-sm sm:text-base font-bold text-stone-900">
                Validador de PIN en Mostrador
              </h4>
              <p className="text-xs text-stone-600">
                Ingresa el código de 6 caracteres que presenta el cliente en{' '}
                <strong className="text-stone-900">{comercioNombre}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchCanjesComercio}
            disabled={loadingCanjes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50 transition-all duration-200 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingCanjes ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            Sincronizar BI
          </button>
        </div>

        <form
          onSubmit={handleValidatePin}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              maxLength={6}
              value={pinInput}
              onChange={(e) =>
                setPinInput(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                )
              }
              placeholder="EJ: K7M9P2"
              aria-label="Código PIN de 6 caracteres"
              className="w-full rounded-xl border border-stone-300 bg-[#FAFAF9] px-4 py-2.5 text-center font-mono text-lg font-bold tracking-[0.35em] text-stone-900 uppercase tabular-nums focus:border-orange-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={validating || pinInput.trim().length !== 6}
            className="font-display inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition-all duration-200 cursor-pointer"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Validando PIN...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                Validar y Canjear
              </>
            )}
          </button>
        </form>

        {/* Resultado inmediato de la validación */}
        {validationResult && (
          <div
            className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-xs sm:text-sm ${
              validationResult.ok
                ? 'border-orange-200/80 bg-orange-50 text-orange-950'
                : 'border-red-200/80 bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {validationResult.ok ? (
                <CheckCircle2
                  className="h-5 w-5 text-orange-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
              ) : (
                <XCircle
                  className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
              )}
              <div className="space-y-1">
                <p className="font-bold">{validationResult.mensaje}</p>
                {validationResult.ok && validationResult.promocion_titulo && (
                  <p className="text-xs text-orange-900">
                    Oferta aplicada:{' '}
                    <strong>{validationResult.promocion_titulo}</strong> (PIN:{' '}
                    <code className="font-mono font-bold tabular-nums">
                      {validationResult.codigo_pin}
                    </code>
                    )
                    {validationResult.stock_restante != null && (
                      <>
                        {' '}
                        · Stock restante:{' '}
                        <strong className="tabular-nums">
                          {validationResult.stock_restante}
                        </strong>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setValidationResult(null)}
              className="text-xs font-semibold underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* 2. DASHBOARD DE INTELIGENCIA COMERCIAL (MÉTRICAS BI) */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700 border border-stone-200/80">
              <BarChart3 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h4 className="font-display text-sm sm:text-base font-bold text-stone-900">
                Panel de Inteligencia Comercial (Métricas BI)
              </h4>
              <p className="text-xs text-stone-600">
                Indicadores clave de rendimiento (KPIs) y trazabilidad de conversión en mostrador.
              </p>
            </div>
          </div>

          {metrics.tokensPendientes > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/70 px-3 py-1 text-xs font-bold text-amber-800 tabular-nums">
              <Clock
                className="h-3.5 w-3.5 animate-pulse text-amber-600"
                strokeWidth={1.75}
              />
              {metrics.tokensPendientes}{' '}
              {metrics.tokensPendientes === 1
                ? 'PIN activo en curso'
                : 'PINs activos en curso'}
            </span>
          )}
        </div>

        {fetchError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle
              className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Tarjetas KPI con tabular-nums */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
              <Eye className="h-4 w-4 text-stone-500" strokeWidth={1.75} />
              Vistas en Mapa
            </span>
            <p className="font-display text-xl font-extrabold text-stone-900 tabular-nums">
              {metrics.totalVistas}
            </p>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
              <MessageCircle
                className="h-4 w-4 text-orange-600"
                strokeWidth={1.75}
              />
              Pedidos WhatsApp
            </span>
            <p className="font-display text-xl font-extrabold text-stone-900 tabular-nums">
              {metrics.totalClicsWhatsapp}
            </p>
          </div>

          <div className="rounded-xl border border-orange-200/60 bg-orange-50/50 p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-800">
              <TicketCheck
                className="h-4 w-4 text-orange-600"
                strokeWidth={1.75}
              />
              Canjes Validados
            </span>
            <p className="font-display text-xl font-extrabold text-orange-800 tabular-nums">
              {metrics.canjesValidados}
            </p>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
              <Clock className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
              Tokens Expirados
            </span>
            <p className="font-display text-xl font-extrabold text-stone-700 tabular-nums">
              {metrics.tokensExpirados}
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-orange-200/60 bg-orange-50/40 p-3.5 space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-800">
              <TrendingUp
                className="h-4 w-4 text-orange-600"
                strokeWidth={1.75}
              />
              Tasa Conversión
            </span>
            <p className="font-display text-xl font-extrabold text-orange-900 tabular-nums">
              {metrics.tasaConversion}%
            </p>
          </div>
        </div>

        {/* Embudo Visual de Conversión */}
        <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Embudo de Conversión de Promociones
            </h5>
            <span className="text-[11px] font-medium text-stone-600 tabular-nums">
              Efectividad de PINs: {metrics.canjesValidados} de{' '}
              {metrics.totalPinsEmitidos} emitidos
            </span>
          </div>

          <div className="space-y-3">
            {metrics.funnel.map((step) => (
              <div key={step.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">
                    {step.label}
                  </span>
                  <span className="font-display font-bold text-stone-900 tabular-nums">
                    {step.value}{' '}
                    <span className="text-[11px] font-normal text-stone-500">
                      ({step.percent}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/80">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${step.barColor}`}
                    style={{
                      width: `${Math.max(step.value > 0 ? 6 : 0, step.percent)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Registro de últimos tokens PIN de la sucursal */}
        {canjes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Últimos PINs Generados en esta Sucursal
            </h5>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-stone-200/80 divide-y divide-stone-100 bg-white">
              {canjes.slice(0, 8).map((c) => {
                const st = computeEffectiveStatus(c);
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="rounded-lg bg-[#FAFAF9] px-2 py-1 font-mono font-bold text-stone-800 border border-stone-200/80 tabular-nums">
                        {c.codigo_pin}
                      </span>
                      <span className="font-medium text-stone-700 truncate">
                        {promoTitleById[c.promocion_id] || 'Promoción del local'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-stone-500 tabular-nums">
                        {new Date(c.creado_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {st === 'canjeado' ? (
                        <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 border border-orange-200/60">
                          Canjeado
                        </span>
                      ) : st === 'pendiente' ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/60 tabular-nums">
                          Pendiente (5m)
                        </span>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
                          Expirado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
