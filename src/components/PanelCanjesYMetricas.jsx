import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Store,
  CheckCircle2,
  Clock,
  QrCode,
  ShoppingBag,
  AlertCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  XCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function PanelCanjesYMetricas({ comercioId, comercioNombre }) {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const fetchMetricasComercio = useCallback(async () => {
    if (!comercioId || !isSupabaseConfigured || !supabase) return;

    setLoading(true);
    setFetchError(null);

    try {
      const { data, error } = await supabase.rpc('obtener_metricas_comercio', {
        p_comercio_id: comercioId,
      });

      if (error) {
        throw error;
      }

      const raw = Array.isArray(data) ? data[0] : data;
      setMetricas(raw || {});
    } catch (err) {
      setFetchError(
        err.message ||
          'No se pudieron obtener las métricas desde obtener_metricas_comercio.'
      );
      setMetricas({});
    } finally {
      setLoading(false);
    }
  }, [comercioId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (!cancelled) {
        fetchMetricasComercio();
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [fetchMetricasComercio]);

  const visitasLocal = Number(
    metricas?.visitas_local ??
      metricas?.total_visitas_local ??
      metricas?.visitas ??
      0
  );
  const vistasOfertas = Number(
    metricas?.vistas_ofertas ??
      metricas?.vista_oferta ??
      metricas?.total_vistas_ofertas ??
      metricas?.vistas ??
      0
  );
  const completadasQr = Number(
    metricas?.ofertas_completadas_qr ?? metricas?.canjes_qr ?? 0
  );
  const completadasSinQr = Number(
    metricas?.ofertas_completadas_sin_qr ?? metricas?.canjes_sin_qr ?? 0
  );
  const noCompletadas = Number(
    metricas?.ofertas_no_completadas ?? metricas?.cupones_no_completados ?? 0
  );

  const totalCompletadas = completadasQr + completadasSinQr;
  const totalCuponesFlujo = totalCompletadas + noCompletadas;
  const pctCompletadas =
    totalCuponesFlujo > 0
      ? Math.round((totalCompletadas / totalCuponesFlujo) * 100)
      : 0;
  const pctQr =
    totalCompletadas > 0
      ? Math.round((completadasQr / totalCompletadas) * 100)
      : 0;
  const pctSinQr = totalCompletadas > 0 ? 100 - pctQr : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
              <BarChart3 className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h4 className="font-display text-sm sm:text-base font-bold text-stone-900">
                Panel de Métricas del Comercio — {comercioNombre}
              </h4>
              <p className="text-xs text-stone-600">
                Indicadores en tiempo real de visitas, vistas de ofertas y conversiones con/sin QR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchMetricasComercio}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-50 transition-all duration-200 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            Actualizar Métricas
          </button>
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

        {loading && !metricas ? (
          <div className="flex items-center justify-center py-8 text-stone-500 gap-2 text-sm">
            <Loader2
              className="h-5 w-5 animate-spin text-orange-600"
              strokeWidth={1.75}
            />
            Consultando métricas del comercio...
          </div>
        ) : (
          <>
            {/* 1. Tarjetas principales: Visitas al Local y Vistas de Ofertas */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                  <Store
                    className="h-4 w-4 text-orange-600"
                    strokeWidth={1.75}
                  />
                  Total Visitas al Local
                </span>
                <p className="font-display text-2xl font-extrabold text-stone-900 tabular-nums">
                  {visitasLocal}
                </p>
                <span className="block text-[11px] text-stone-500">
                  Aperturas del perfil del comercio
                </span>
              </div>

              <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                  <Eye className="h-4 w-4 text-orange-600" strokeWidth={1.75} />
                  Vistas de Ofertas
                </span>
                <p className="font-display text-2xl font-extrabold text-stone-900 tabular-nums">
                  {vistasOfertas}
                </p>
                <span className="block text-[11px] text-stone-500">
                  Aperturas de detalle de promociones
                </span>
              </div>

              <div className="rounded-xl border border-orange-200/80 bg-orange-50/50 p-4 space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-800">
                  <CheckCircle2
                    className="h-4 w-4 text-orange-600"
                    strokeWidth={1.75}
                  />
                  Ofertas Completadas
                </span>
                <p className="font-display text-2xl font-extrabold text-orange-700 tabular-nums">
                  {totalCompletadas}
                </p>
                <span className="block text-[11px] text-orange-800/80 tabular-nums">
                  {completadasQr} con QR + {completadasSinQr} sin QR
                </span>
              </div>

              <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                  <XCircle
                    className="h-4 w-4 text-stone-500"
                    strokeWidth={1.75}
                  />
                  Ofertas No Completadas
                </span>
                <p className="font-display text-2xl font-extrabold text-stone-700 tabular-nums">
                  {noCompletadas}
                </p>
                <span className="block text-[11px] text-stone-500">
                  Cupones pendientes o vencidos
                </span>
              </div>
            </div>

            {/* 2. Comparativa: Ofertas Completadas vs No Completadas y Desglose Con QR vs Sin QR */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Completadas vs No Completadas */}
              <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Ofertas Completadas vs. No Completadas
                  </h5>
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-800 tabular-nums">
                    {pctCompletadas}% efectividad
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-orange-600"
                          strokeWidth={1.75}
                        />
                        Completadas (QR + Sin QR)
                      </span>
                      <span className="font-display font-bold text-orange-700 tabular-nums">
                        {totalCompletadas}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200/80">
                      <div
                        className="h-full rounded-full bg-orange-600 transition-all duration-500"
                        style={{
                          width: `${
                            totalCuponesFlujo > 0
                              ? Math.max(totalCompletadas > 0 ? 6 : 0, pctCompletadas)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-stone-600 flex items-center gap-1.5">
                        <Clock
                          className="h-3.5 w-3.5 text-stone-500"
                          strokeWidth={1.75}
                        />
                        No Completadas (ofertas_no_completadas)
                      </span>
                      <span className="font-display font-bold text-stone-700 tabular-nums">
                        {noCompletadas}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200/80">
                      <div
                        className="h-full rounded-full bg-stone-500 transition-all duration-500"
                        style={{
                          width: `${
                            totalCuponesFlujo > 0
                              ? Math.max(
                                  noCompletadas > 0 ? 6 : 0,
                                  100 - pctCompletadas
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Desglose Comparativo: Con QR vs Sin QR */}
              <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Desglose de Conversiones: Con QR vs. Sin QR
                  </h5>
                  <span className="text-[11px] font-semibold text-stone-600 tabular-nums">
                    Total: {totalCompletadas} canjes
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-orange-200/80 bg-white p-3 space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                      <QrCode className="h-4 w-4" strokeWidth={1.75} />
                      Con Cupón QR
                    </span>
                    <div className="flex items-baseline justify-between">
                      <p className="font-display text-xl font-extrabold text-orange-600 tabular-nums">
                        {completadasQr}
                      </p>
                      <span className="text-xs font-bold text-orange-700 tabular-nums">
                        {pctQr}%
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200/80 bg-white p-3 space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                      <ShoppingBag
                        className="h-4 w-4 text-amber-600"
                        strokeWidth={1.75}
                      />
                      Presencial Sin QR
                    </span>
                    <div className="flex items-baseline justify-between">
                      <p className="font-display text-xl font-extrabold text-stone-900 tabular-nums">
                        {completadasSinQr}
                      </p>
                      <span className="text-xs font-bold text-stone-600 tabular-nums">
                        {pctSinQr}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200/80 flex">
                  <div
                    className="h-full bg-orange-600 transition-all duration-500"
                    style={{ width: `${pctQr}%` }}
                    title={`Con QR: ${completadasQr}`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${pctSinQr}%` }}
                    title={`Sin QR: ${completadasSinQr}`}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
