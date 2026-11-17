import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Ticket,
  Clock,
  Store,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const TOTAL_SECONDS = 5 * 60; // 5 minutos = 300 segundos

function formatMMSS(totalSeconds) {
  const safeSecs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function ModalCanjeTemporal({ isOpen, promo, onClose }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pinData, setPinData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [copied, setCopied] = useState(false);

  const promoId = promo?.id ?? promo?.promo_id ?? promo?.promocion_id ?? null;
  const comercioNombre =
    promo?.comercio_nombre ||
    promo?.nombre_comercio ||
    promo?.comercios?.nombre ||
    'Comercio adherido';

  const generarPin = useCallback(async () => {
    if (!promoId) {
      setErrorMsg('No se encontró el identificador de la promoción.');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase no está configurado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setPinData(null);

    try {
      const { data, error } = await supabase.rpc('generar_pin_canje', {
        p_promocion_id: promoId,
      });

      if (error) {
        throw new Error(
          error.message ||
            'No se pudo generar el PIN. Asegúrate de haber ejecutado supabase/canjes_y_metricas.sql.'
        );
      }

      if (!data || data.ok === false) {
        throw new Error(
          data?.mensaje ||
            'No fue posible generar el código de canje para esta oferta.'
        );
      }

      setPinData(data);

      if (data.expira_at) {
        const diffSecs = Math.round(
          (new Date(data.expira_at).getTime() - Date.now()) / 1000
        );
        setSecondsLeft(
          diffSecs > 0 && diffSecs <= TOTAL_SECONDS ? diffSecs : TOTAL_SECONDS
        );
      } else {
        setSecondsLeft(TOTAL_SECONDS);
      }
    } catch (err) {
      setErrorMsg(
        err.message || 'Ocurrió un error al generar el PIN temporal.'
      );
    } finally {
      setLoading(false);
    }
  }, [promoId]);

  useEffect(() => {
    if (!isOpen || !promoId) return;

    let cancelled = false;
    const init = async () => {
      await Promise.resolve();
      if (!cancelled) {
        generarPin();
      }
    };
    init();

    return () => {
      cancelled = true;
    };
  }, [isOpen, promoId, generarPin]);

  // Temporizador regresivo en vivo segundo a segundo (05:00 -> 00:00)
  useEffect(() => {
    if (!isOpen || !pinData?.pin || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, pinData?.pin, secondsLeft]);

  if (!isOpen || !promo) return null;

  const isExpired = Boolean(pinData?.pin && secondsLeft <= 0);
  const progressPercent = Math.max(
    0,
    Math.min(100, (secondsLeft / TOTAL_SECONDS) * 100)
  );
  const pinCharacters = String(pinData?.pin || '------')
    .toUpperCase()
    .split('');

  const handleCopyPin = async () => {
    if (!pinData?.pin || isExpired) return;
    try {
      await navigator.clipboard.writeText(pinData.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar si clipboard no está disponible
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-canje-temporal-title"
    >
      <div className="relative my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-200/80">
        {/* Cabecera limpia editorial */}
        <div className="flex items-center justify-between border-b border-stone-200/80 bg-[#FAFAF9] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <Ticket className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2
                id="modal-canje-temporal-title"
                className="font-display text-base font-bold text-stone-900 leading-tight"
              >
                Canje Temporal en Mostrador
              </h2>
              <p className="text-xs text-stone-600">
                Token efímero de validación presencial (5 min)
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
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Store className="h-4 w-4" strokeWidth={1.75} />
              {comercioNombre}
            </p>
            <h3 className="font-display text-sm font-bold text-stone-900 line-clamp-2">
              {promo.titulo}
            </h3>
            {pinData?.stock_disponible != null && (
              <p className="text-[11px] font-medium text-stone-600 tabular-nums">
                Cupos disponibles:{' '}
                <strong className="text-emerald-700">
                  {pinData.stock_disponible}
                </strong>
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-stone-600">
              <Loader2
                className="h-7 w-7 animate-spin text-emerald-600"
                strokeWidth={1.75}
              />
              <p className="text-sm font-medium">
                Generando tu PIN único de canje...
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
                onClick={generarPin}
                className="font-display w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Visualización del PIN de 6 caracteres */}
              <div className="relative">
                <div
                  className={`rounded-2xl border p-5 text-center transition-all duration-200 ${
                    isExpired
                      ? 'border-stone-200 bg-stone-100/80 opacity-60 select-none'
                      : 'border-emerald-200/80 bg-emerald-50/35'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
                    Código PIN de Verificación
                  </span>

                  <div className="mt-3 flex items-center justify-center gap-2">
                    {pinCharacters.map((char, index) => (
                      <span
                        key={index}
                        className={`flex h-12 w-10 sm:h-14 sm:w-11 items-center justify-center rounded-xl border text-xl sm:text-2xl font-bold font-mono tabular-nums shadow-xs ${
                          isExpired
                            ? 'border-stone-300 bg-stone-200/70 text-stone-400 line-through'
                            : 'border-stone-200/90 bg-white text-stone-900'
                        }`}
                      >
                        {char}
                      </span>
                    ))}
                  </div>

                  {!isExpired && (
                    <div className="mt-3.5 flex justify-center">
                      <button
                        type="button"
                        onClick={handleCopyPin}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 border border-stone-200/90 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check
                              className="h-3.5 w-3.5 text-emerald-600"
                              strokeWidth={1.75}
                            />
                            Código copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Copiar código
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Bloqueo cuando el PIN expira */}
                {isExpired && (
                  <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5 text-center space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800">
                      <Lock className="h-4 w-4" strokeWidth={1.75} />
                      CÓDIGO PIN EXPIRADO (00:00)
                    </div>
                    <p className="text-xs text-amber-800/90">
                      Por seguridad, la validez de 5 minutos ha caducado. Genera un nuevo PIN frente al mostrador.
                    </p>
                    <button
                      type="button"
                      onClick={generarPin}
                      className="font-display inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Generar nuevo PIN (5 min)
                    </button>
                  </div>
                )}
              </div>

              {/* Temporizador regresivo en vivo MM:SS con tabular-nums y barra de progreso */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-600 flex items-center gap-1.5">
                    <Clock
                      strokeWidth={1.75}
                      className={`h-4 w-4 ${
                        isExpired
                          ? 'text-red-500'
                          : secondsLeft <= 60
                            ? 'text-amber-600 animate-pulse'
                            : 'text-emerald-600'
                      }`}
                    />
                    Tiempo restante de validez:
                  </span>
                  <span
                    className={`font-display text-base font-extrabold tabular-nums ${
                      isExpired
                        ? 'text-red-600'
                        : secondsLeft <= 60
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {formatMMSS(secondsLeft)}
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/80">
                  <div
                    className={`h-full transition-all duration-1000 rounded-full ${
                      isExpired
                        ? 'bg-red-500'
                        : secondsLeft <= 60
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Instrucciones para el vecino */}
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900">
                <ShieldCheck
                  className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <span>
                  Muestra este código de 6 caracteres al comerciante en el local. Al validarlo en su panel, se aplicará tu promoción automáticamente.
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
