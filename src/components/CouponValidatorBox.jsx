import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  CameraOff,
  ShoppingBag,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function CouponValidatorBox({
  comercioId,
  comercioNombre,
  promosVigentes = [],
  onCouponValidated,
}) {
  const [codigoCuponInput, setCodigoCuponInput] = useState('');
  const [redeemingQr, setRedeemingQr] = useState(false);
  const [registeringSinQr, setRegisteringSinQr] = useState(false);
  const [selectedPromoSinQr, setSelectedPromoSinQr] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScannerOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const executeCanjeCupon = useCallback(
    async (rawCodigo) => {
      const cleanCodigo = String(rawCodigo || '').trim();
      if (!cleanCodigo || !comercioId) return;

      if (!isSupabaseConfigured || !supabase) {
        setFeedback({
          type: 'error',
          title: 'Supabase no configurado',
          message: 'Verifica las variables de entorno.',
        });
        return;
      }

      setRedeemingQr(true);
      setFeedback(null);

      try {
        const { data, error } = await supabase.rpc('canjear_cupon_mostrador', {
          p_comercio_id: comercioId,
          p_codigo: cleanCodigo,
        });

        if (error) throw new Error(error.message);

        const res = Array.isArray(data) ? data[0] : data;
        const isSuccess =
          res &&
          res.exito !== false &&
          res.ok !== false &&
          res.valido !== false &&
          (res.exito === true ||
            res.ok === true ||
            res.valido === true ||
            Boolean(res.promocion_titulo || res.titulo));

        if (!isSuccess) {
          setFeedback({
            type: 'error',
            title: 'Cupón Rechazado o Inválido',
            message:
              res?.mensaje ||
              res?.error ||
              `El cupón "${cleanCodigo}" está vencido, ya fue utilizado o pertenece a otro comercio.`,
          });
          return;
        }

        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
        } catch {
          // Ignorar en entornos sin canvas
        }

        const promoTitulo =
          res?.promocion_titulo ||
          res?.titulo ||
          res?.promo_titulo ||
          'Promoción del local';

        setFeedback({
          type: 'success',
          title: '¡Cupón Validado y Canjeado con Éxito!',
          promoTitulo,
          codigo: cleanCodigo,
          message:
            res?.mensaje ||
            `Se aplicó la promoción "${promoTitulo}" correctamente.`,
        });
        setCodigoCuponInput('');

        if (onCouponValidated) {
          onCouponValidated(comercioId);
        }
      } catch (err) {
        setFeedback({
          type: 'error',
          title: 'No se pudo validar el cupón',
          message:
            err.message ||
            'El cupón está vencido, ya fue usado o pertenece a otro comercio.',
        });
      } finally {
        setRedeemingQr(false);
      }
    },
    [comercioId, onCouponValidated]
  );

  const handleCanjearSubmit = (e) => {
    e.preventDefault();
    if (!codigoCuponInput.trim()) return;
    executeCanjeCupon(codigoCuponInput);
  };

  const handleRegistrarCanjeSinQr = async () => {
    if (!comercioId || !supabase) return;

    setRegisteringSinQr(true);
    setFeedback(null);

    try {
      const payload = {
        comercio_id: comercioId,
        tipo: 'canje_sin_qr',
      };
      if (selectedPromoSinQr) {
        payload.promocion_id = selectedPromoSinQr;
      }

      let { error } = await supabase.from('eventos_comercio').insert([payload]);

      if (error && selectedPromoSinQr) {
        const retry = await supabase.from('eventos_comercio').insert([
          {
            comercio_id: comercioId,
            tipo: 'canje_sin_qr',
          },
        ]);
        error = retry.error;
      }

      if (error) throw new Error(error.message);

      const selectedPromoObj = promosVigentes.find(
        (p) => String(p.id) === String(selectedPromoSinQr)
      );

      setFeedback({
        type: 'success',
        title: 'Canje Presencial sin QR Registrado',
        promoTitulo: selectedPromoObj?.titulo || null,
        message:
          'Se registró el canje presencial sin QR en eventos_comercio para las métricas del local.',
      });

      if (onCouponValidated) {
        onCouponValidated(comercioId);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'No se pudo registrar el canje sin QR',
        message: err.message || 'Error al insertar en eventos_comercio.',
      });
    } finally {
      setRegisteringSinQr(false);
    }
  };

  const startCameraScanner = async () => {
    setScannerError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError(
        'Tu navegador no permite acceso directo a la cámara. Escribe o pega el código corto (TP-XXXX) abajo.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScannerOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);

      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const scanLoop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              const detected = barcodes[0].rawValue;
              stopCamera();
              setCodigoCuponInput(detected);
              executeCanjeCupon(detected);
              return;
            }
          } catch {
            // Continuar escaneando
          }
          if (streamRef.current) {
            requestAnimationFrame(scanLoop);
          }
        };
        requestAnimationFrame(scanLoop);
      } else {
        setScannerError(
          'Cámara activa. Si tu dispositivo no detecta el QR automáticamente, ingresa el código corto TP-XXXX debajo.'
        );
      }
    } catch {
      setScannerError(
        'No se pudo abrir la cámara. Puedes escribir o pegar el código corto (TP-XXXX) o token_qr en el campo manual.'
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Alerta visual clara: Verde si exito = true con título de promoción, Roja si vencido/usado/otro comercio */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm shadow-xs ${
            feedback.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-emerald-300 bg-emerald-50 text-emerald-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'error' ? (
              <XCircle
                className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
            ) : (
              <CheckCircle2
                className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
            )}
            <div className="space-y-1">
              <p className="font-display font-bold">{feedback.title}</p>
              {feedback.promoTitulo && (
                <p className="text-xs sm:text-sm font-semibold">
                  Promoción canjeada:{' '}
                  <strong className="underline decoration-emerald-500/60">
                    {feedback.promoTitulo}
                  </strong>
                  {feedback.codigo && (
                    <span className="ml-1.5 rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs font-bold">
                      {feedback.codigo}
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs opacity-90">{feedback.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Escáner de cámara QR + Input de validación manual debajo */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
                <QrCode className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-stone-900">
                  Validar Cupón en Caja {comercioNombre ? `— ${comercioNombre}` : ''}
                </h3>
                <p className="text-xs text-stone-600">
                  Usa la cámara para leer el QR o ingresa el código corto{' '}
                  <code className="font-mono font-bold text-orange-700">
                    TP-XXXX
                  </code>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={scannerOpen ? stopCamera : startCameraScanner}
              className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/80 px-3.5 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 transition-colors cursor-pointer"
            >
              {scannerOpen ? (
                <>
                  <CameraOff className="h-4 w-4" strokeWidth={1.75} />
                  Apagar Cámara QR
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" strokeWidth={1.75} />
                  Activar Cámara QR
                </>
              )}
            </button>
          </div>

          {/* Visor de Cámara QR */}
          {scannerOpen ? (
            <div className="overflow-hidden rounded-xl border-2 border-orange-500 bg-stone-950 p-3 text-center space-y-2">
              <video
                ref={videoRef}
                className="mx-auto h-56 w-full max-w-sm rounded-lg object-cover"
                playsInline
                muted
              />
              <p className="text-xs font-medium text-orange-200">
                Enfoca el código QR del cliente para validarlo automáticamente
              </p>
            </div>
          ) : (
            <div
              onClick={startCameraScanner}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 bg-orange-50/30 p-5 text-center hover:bg-orange-50/60 transition-colors cursor-pointer"
            >
              <Camera className="h-7 w-7 text-orange-600" strokeWidth={1.75} />
              <div className="space-y-0.5">
                <p className="font-display text-xs sm:text-sm font-bold text-stone-900">
                  Escáner de Cámara QR
                </p>
                <p className="text-[11px] text-stone-600">
                  Toca aquí para abrir la cámara del dispositivo y escanear el{' '}
                  <code className="font-mono">token_qr</code>
                </p>
              </div>
            </div>
          )}

          {scannerError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/70 rounded-xl p-3">
              {scannerError}
            </p>
          )}

          {/* Input de validación manual justo debajo de la cámara */}
          <form onSubmit={handleCanjearSubmit} className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-stone-700">
              Validación manual (código corto TP-XXXX o token QR):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={codigoCuponInput}
                onChange={(e) => setCodigoCuponInput(e.target.value)}
                placeholder="Ej: TP-4829 o pega el token_qr"
                className="flex-1 rounded-xl border border-stone-300 bg-[#FAFAF9] px-4 py-2.5 font-mono text-base font-bold tracking-wider text-stone-900 focus:border-orange-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <button
                type="submit"
                disabled={redeemingQr || !codigoCuponInput.trim()}
                className="font-display inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {redeemingQr ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    Validando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                    Validar Cupón
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Botón secundario: Registrar canje presencial sin QR */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
              Atención Presencial Directa
            </span>
            <h3 className="font-display text-base font-bold text-stone-900">
              Canje Presencial sin QR
            </h3>
            <p className="text-xs text-stone-600">
              Si el cliente solicita la oferta en mostrador sin haber generado un código QR, regístralo aquí para contabilizarlo en tus métricas.
            </p>

            {promosVigentes.length > 0 && (
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Promoción aplicada (opcional):
                </label>
                <select
                  value={selectedPromoSinQr}
                  onChange={(e) => setSelectedPromoSinQr(e.target.value)}
                  className="w-full rounded-xl border border-stone-200/90 bg-[#FAFAF9] px-3 py-2 text-xs text-stone-800 focus:border-orange-600 focus:outline-none"
                >
                  <option value="">Promoción general del local</option>
                  {promosVigentes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.titulo}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={registeringSinQr}
            onClick={handleRegistrarCanjeSinQr}
            className="font-display w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-orange-600 bg-orange-50/60 px-4 py-3 text-xs sm:text-sm font-bold text-orange-700 hover:bg-orange-600 hover:text-white disabled:opacity-50 transition-all cursor-pointer"
          >
            {registeringSinQr ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Registrando...
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
                Registrar canje presencial sin QR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
