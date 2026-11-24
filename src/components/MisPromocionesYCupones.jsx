import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  QrCode,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  Ticket,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import QrCodeSvg from './QrCodeSvg';

const FILTROS_ESTADO = [
  { id: 'todas', label: 'Todas' },
  { id: 'disponibles', label: 'Disponibles' },
  { id: 'completadas', label: 'Completadas' },
  { id: 'vencidas', label: 'Vencidas' },
];

function computeCouponCategory(cupon) {
  if (!cupon) return 'vencidas';
  const rawEstado = String(cupon.estado || 'pendiente').toLowerCase();

  if (rawEstado === 'completado' || rawEstado === 'canjeado') {
    return 'completadas';
  }

  const expiresAt = cupon.expires_at || cupon.expira_at || null;
  const isExpiredByDate = expiresAt ? new Date(expiresAt) <= new Date() : false;

  if (
    rawEstado === 'vencido' ||
    rawEstado === 'expirado' ||
    isExpiredByDate
  ) {
    return 'vencidas';
  }

  return 'disponibles';
}

function formatDateTimeEs(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MisPromocionesYCupones({
  userId,
  refreshTrigger = 0,
  onExplorePromos,
}) {
  const [cupones, setCupones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [expandedCouponId, setExpandedCouponId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchUserCoupons = useCallback(async () => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setCupones([]);
      return;
    }

    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('cupones_qr')
        .select('*, promociones(*, comercios(*)), comercios(*)')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback si la relación directa a comercios está únicamente a través de promociones
        const retry = await supabase
          .from('cupones_qr')
          .select('*, promociones(*, comercios(*))')
          .eq('usuario_id', userId)
          .order('created_at', { ascending: false });
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        // Segundo fallback por si la columna de fecha es creado_at o creada_el
        const retry2 = await supabase
          .from('cupones_qr')
          .select('*, promociones(*, comercios(*))')
          .eq('usuario_id', userId);
        data = retry2.data;
      }

      if (Array.isArray(data)) {
        const sorted = [...data].sort((a, b) => {
          const da = new Date(a.created_at || a.creado_at || 0).getTime();
          const db = new Date(b.created_at || b.creado_at || 0).getTime();
          return db - da;
        });
        setCupones(sorted);
      } else {
        setCupones([]);
      }
    } catch {
      setCupones([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserCoupons();
  }, [fetchUserCoupons, refreshTrigger]);

  const counts = useMemo(() => {
    const acc = {
      todas: cupones.length,
      disponibles: 0,
      completadas: 0,
      vencidas: 0,
    };
    for (const c of cupones) {
      const cat = computeCouponCategory(c);
      acc[cat] = (acc[cat] || 0) + 1;
    }
    return acc;
  }, [cupones]);

  const cuponesFiltrados = useMemo(() => {
    if (filtro === 'todas') return cupones;
    return cupones.filter((c) => computeCouponCategory(c) === filtro);
  }, [cupones, filtro]);

  const handleCopyCode = async (id, code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(String(code));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignorar si clipboard no está disponible
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-stone-900 flex items-center gap-2">
            <QrCode
              className="h-5 w-5 text-orange-600"
              strokeWidth={1.75}
            />
            Mis Promociones y Cupones
          </h3>
          <p className="text-xs text-stone-600 mt-0.5">
            Historial completo de ofertas reclamadas, cupones disponibles para usar en mostrador, canjeados y vencidos.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUserCoupons}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-50 transition-all duration-200 cursor-pointer"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={1.75}
          />
          Actualizar
        </button>
      </div>

      {/* Filtros rápidos: Todas, Disponibles, Completadas y Vencidas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTROS_ESTADO.map((item) => {
          const active = filtro === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-200/90 text-stone-700'
                }`}
              >
                {counts[item.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-stone-600 gap-2">
          <Loader2
            className="h-5 w-5 animate-spin text-orange-600"
            strokeWidth={1.75}
          />
          <span className="text-sm">Cargando tus promociones y cupones...</span>
        </div>
      ) : cuponesFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAFAF9] p-10 text-center space-y-3">
          <Ticket
            className="mx-auto h-9 w-9 text-stone-400"
            strokeWidth={1.75}
          />
          <div>
            <p className="font-display text-sm font-bold text-stone-900">
              {cupones.length === 0
                ? 'Todavía no reclamaste ningún cupón QR'
                : 'No hay cupones en esta categoría'}
            </p>
            <p className="text-xs text-stone-600 mt-1">
              {cupones.length === 0
                ? 'Pulsa "Obtener Cupón QR" en cualquier oferta activa para guardarlo y presentarlo en el comercio.'
                : 'Prueba cambiando el filtro rápido de estado arriba.'}
            </p>
          </div>
          {cupones.length === 0 && onExplorePromos && (
            <button
              type="button"
              onClick={onExplorePromos}
              className="font-display inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 transition-all duration-200 cursor-pointer"
            >
              Explorar ofertas cercanas
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cuponesFiltrados.map((cupon, idx) => {
            const cuponId = cupon.id || cupon.codigo_corto || idx;
            const promo = Array.isArray(cupon.promociones)
              ? cupon.promociones[0]
              : cupon.promociones;
            const comercioFromPromo = Array.isArray(promo?.comercios)
              ? promo.comercios[0]
              : promo?.comercios;
            const comercioDirect = Array.isArray(cupon.comercios)
              ? cupon.comercios[0]
              : cupon.comercios;
            const comercio = comercioFromPromo || comercioDirect;

            const tituloPromo =
              promo?.titulo ||
              cupon.promocion_titulo ||
              'Promoción reclamada';
            const nombreComercio =
              comercio?.nombre ||
              cupon.comercio_nombre ||
              'Comercio adherido';
            const rubroComercio =
              comercio?.rubro || cupon.comercio_rubro || null;

            const categoria = computeCouponCategory(cupon);
            const isDisponible = categoria === 'disponibles';
            const isCompletada = categoria === 'completadas';

            const codigoCorto =
              cupon.codigo_corto || cupon.codigo || 'TP-0000';
            const tokenQr = cupon.token_qr || cupon.token || codigoCorto;
            const expiresAtFormatted = formatDateTimeEs(
              cupon.expires_at || cupon.expira_at
            );
            const canjeadoAtFormatted = formatDateTimeEs(
              cupon.canjeado_at || cupon.used_at || cupon.updated_at
            );

            const isExpanded = expandedCouponId === cuponId;

            return (
              <article
                key={cuponId}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isDisponible
                    ? 'border-orange-200/90 bg-white shadow-sm hover:border-orange-300'
                    : isCompletada
                      ? 'border-stone-200/80 bg-[#FAFAF9]'
                      : 'border-red-200/50 bg-stone-100/60 opacity-85'
                }`}
              >
                <div className="p-4 space-y-3">
                  {/* Encabezado de estado y comercio */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {isDisponible ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
                        Disponible
                      </span>
                    ) : isCompletada ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
                        Completada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                        <XCircle className="h-3 w-3" strokeWidth={1.75} />
                        Vencida
                      </span>
                    )}

                    <span className="font-mono text-xs font-extrabold text-stone-700 bg-stone-100 border border-stone-200/80 rounded-lg px-2 py-0.5 tabular-nums">
                      {codigoCorto}
                    </span>
                  </div>

                  {/* Título de la promoción y nombre del comercio */}
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-stone-900 line-clamp-2">
                      {tituloPromo}
                    </h4>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                      <Store
                        className="h-3.5 w-3.5 text-orange-600 shrink-0"
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{nombreComercio}</span>
                      {rubroComercio && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-2 py-0.2 text-[10px] font-medium text-orange-700 capitalize">
                          <Tag className="h-2.5 w-2.5" strokeWidth={1.75} />
                          {String(rubroComercio).replace('_', ' ')}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Fechas según estado */}
                  <div className="text-[11px] text-stone-600 tabular-nums space-y-0.5 pt-1 border-t border-stone-100">
                    {isCompletada && canjeadoAtFormatted && (
                      <p className="flex items-center gap-1 font-medium text-sky-800">
                        <Clock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                        Canjeado el: <strong>{canjeadoAtFormatted}</strong>
                      </p>
                    )}

                    {!isCompletada && expiresAtFormatted && (
                      <p
                        className={`flex items-center gap-1 font-medium ${
                          isDisponible ? 'text-orange-800' : 'text-red-700'
                        }`}
                      >
                        <Clock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                        {isDisponible ? 'Válido hasta:' : 'Expiró el:'}{' '}
                        <strong>{expiresAtFormatted}</strong>
                      </p>
                    )}
                  </div>

                  {/* Desplegable con Código QR y código corto si está Disponible */}
                  {isDisponible && isExpanded && (
                    <div className="mt-3 rounded-xl border border-orange-200/90 bg-orange-50/40 p-4 text-center space-y-3">
                      <div className="inline-block rounded-xl border border-orange-200 bg-white p-3 shadow-2xs">
                        <QrCodeSvg value={tokenQr} size={164} />
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          Código Corto para Mostrador
                        </span>
                        <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3.5 py-1.5 shadow-2xs">
                          <span className="font-mono text-lg font-extrabold tracking-wider text-orange-600 tabular-nums">
                            {codigoCorto}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(cuponId, codigoCorto)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-[#FAFAF9] px-2 py-1 text-[11px] font-semibold text-stone-700 hover:border-orange-300 cursor-pointer"
                          >
                            {copiedId === cuponId ? (
                              <>
                                <Check
                                  className="h-3 w-3 text-orange-600"
                                  strokeWidth={1.75}
                                />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" strokeWidth={1.75} />
                                Copiar
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-orange-950">
                        Presenta este QR o el código{' '}
                        <strong className="font-mono">{codigoCorto}</strong> en la caja del comercio.
                      </p>
                    </div>
                  )}
                </div>

                {/* Pie de tarjeta para cupones Disponibles */}
                {isDisponible && (
                  <div className="border-t border-stone-100 p-3.5 pt-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCouponId(isExpanded ? null : cuponId)
                      }
                      className="font-display w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 transition-all duration-200 cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {isExpanded
                        ? 'Ocultar Código QR'
                        : `Ver QR y Código (${codigoCorto})`}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                      ) : (
                        <ChevronDown
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                      )}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
