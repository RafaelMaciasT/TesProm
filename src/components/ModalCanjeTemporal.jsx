import { useState, useEffect, useCallback } from 'react';
import {
  X,
  QrCode,
  Clock,
  Store,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import QrCodeSvg from './QrCodeSvg';

function resolveCouponStatus(cupon) {
  if (!cupon) return 'pendiente';
  const raw = String(cupon.estado || 'pendiente').toLowerCase();
  if (raw === 'completado' || raw === 'canjeado') return 'completado';
  if (raw === 'vencido' || raw === 'expirado') return 'vencido';
  const exp = cupon.expires_at || cupon.expira_at;
  if (exp && new Date(exp) <= new Date()) {
    return 'vencido';
  }
  return 'pendiente';
}

export default function ModalCanjeTemporal({
  isOpen,
  promo,
  session,
  onRequireAuth,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [cuponData, setCuponData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const promoId = promo?.id ?? promo?.promo_id ?? promo?.promocion_id ?? null;
  const userId = session?.user?.id ?? null;
  const comercioNombre =
    promo?.comercio_nombre ||
    promo?.nombre_comercio ||
    promo?.comercios?.nombre ||
    'Comercio adherido';

  const reclamarCuponQr = useCallback(async () => {
    if (!promoId) {
      setErrorMsg('No se encontró el identificador de la promoción.');
      setLoading(false);
      return;
    }

    if (!userId) {
      setLoading(false);
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase no está configurado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setCuponData(null);

    try {
      const { data, error } = await supabase.rpc('generar_cupon_qr', {
        p_promocion_id: promoId,
        p_usuario_id: userId,
      });

      if (error) {
        throw new Error(
          error.message || 'No se pudo generar el cupón QR para esta oferta.'
        );
      }

      const record = Array.isArray(data) ? data[0] : data;
      if (!record || record.ok === false) {
        throw new Error(
          record?.mensaje ||
            record?.error ||
            'No fue posible emitir el cupón QR.'
        );
      }

      const normalized = record.cupon ? record.cupon : record;
      setCuponData(normalized);
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error al generar tu cupón QR.');
    } finally {
      setLoading(false);
    }
  }, [promoId, userId, onRequireAuth]);

  useEffect(() => {
    if (!isOpen || !promoId) return;

    let cancelled = false;
    const init = async () => {
      await Promise.resolve();
      if (!cancelled) {
        reclamarCuponQr();
      }
    };
    init();

    return () => {
      cancelled = true;
    };
  }, [isOpen, promoId, reclamarCuponQr]);

  if (!isOpen || !promo) return null;

  const tokenQr =
    cuponData?.token_qr ||
    cuponData?.token ||
    cuponData?.codigo_corto ||
    cuponData?.pin ||
    '';
  const codigoCorto =
    cuponData?.codigo_corto ||
    cuponData?.codigo ||
    cuponData?.pin ||
    'TP-0000';
  const expiresAt = cuponData?.expires_at || cuponData?.expira_at || null;
  const estadoActual = resolveCouponStatus(cuponData);

  const handleCopyShortCode = async () => {
    if (!codigoCorto) return;
    try {
      await navigator.clipboard.writeText(codigoCorto);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignorar si clipboard no está disponible
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cupon-qr-title"
    >
      <div className="relative my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-200/80">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-stone-200/80 bg-[#FAFAF9] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
              <QrCode className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2
                id="modal-cupon-qr-title"
                className="font-display text-base font-bold text-stone-900 leading-tight"
              >
                Tu Cupón QR de Descuento
              </h2>
              <p className="text-xs text-stone-600">
                Presenta este QR o el código corto en el mostrador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-all duration-200 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Resumen de la promoción y comercio */}
          <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-3.5 space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
              <Store className="h-4 w-4" strokeWidth={1.75} />
              {comercioNombre}
            </p>
            <h3 className="font-display text-sm font-bold text-stone-900 line-clamp-2">
              {promo.titulo}
            </h3>
            {promo.descripcion && (
              <p className="text-xs text-stone-600 line-clamp-2">
                {promo.descripcion}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-stone-600">
              <Loader2
                className="h-7 w-7 animate-spin text-orange-600"
                strokeWidth={1.75}
              />
              <p className="text-sm font-medium">
                Generando tu cupón QR personal...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200/80 p-4 text-xs sm:text-sm text-red-700">
                <AlertCircle
                  className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={reclamarCuponQr}
                className="font-display w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-orange-700 transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Tarjeta del QR y Código Corto */}
              <div className="rounded-2xl border border-orange-200/80 bg-orange-50/35 p-5 text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Estado del cupón:
                  </span>
                  {estadoActual === 'completado' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 border border-orange-300 px-2.5 py-0.5 text-xs font-bold text-orange-800 capitalize">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      completado
                    </span>
                  ) : estadoActual === 'vencido' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-bold text-red-700 capitalize">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                      vencido
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold text-white capitalize shadow-2xs">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                      pendiente
                    </span>
                  )}
                </div>

                {/* Código QR */}
                <div className="inline-block rounded-2xl border border-orange-200/90 bg-white p-3.5 shadow-xs">
                  <QrCodeSvg value={tokenQr || codigoCorto} size={188} />
                </div>

                {/* Código Corto (TP-XXXX) debajo del QR */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-stone-500">
                    Código Corto de Mostrador
                  </span>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200/90 bg-white px-4 py-2 shadow-2xs">
                    <span className="font-mono text-xl font-extrabold tracking-wider text-orange-600 tabular-nums">
                      {codigoCorto}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyShortCode}
                      className="rounded-lg border border-stone-200 bg-[#FAFAF9] px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/50 transition-colors cursor-pointer"
                    >
                      {copiedCode ? (
                        <span className="inline-flex items-center gap-1 text-orange-700">
                          <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Copiado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Copiar
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Fecha / Hora de expiración (expires_at) */}
                {expiresAt && (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-stone-700 tabular-nums pt-1">
                    <Clock
                      className="h-4 w-4 text-orange-600 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span>
                      Expira el:{' '}
                      <strong className="text-stone-900">
                        {new Date(expiresAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Instrucciones */}
              <div className="rounded-xl border border-orange-200/60 bg-orange-50/60 p-3.5 flex items-start gap-2.5 text-xs text-orange-950">
                <ShieldCheck
                  className="h-4 w-4 text-orange-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <span>
                  Muestra este código QR o dicta el código corto{' '}
                  <strong className="font-mono">{codigoCorto}</strong> al empleado en el mostrador para validar tu descuento.
                </span>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-stone-200/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200/90 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
