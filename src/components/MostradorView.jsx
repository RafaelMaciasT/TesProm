import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Store,
  KeyRound,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Clock,
  Tag,
  Sparkles,
  Zap,
  Camera,
  CameraOff,
  UserCheck,
  ArrowLeft,
  ShoppingBag,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SESSION_STORAGE_KEY = 'tesprom_mostrador_session';

export default function MostradorView({ onBackToHome }) {
  const [mostradorSession, setMostradorSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Formulario de acceso operativo
  const [codigoComercioInput, setCodigoComercioInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Estado operativo del mostrador
  const [promosVigentes, setPromosVigentes] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [codigoCuponInput, setCodigoCuponInput] = useState('');
  const [redeemingQr, setRedeemingQr] = useState(false);
  const [registeringSinQr, setRegisteringSinQr] = useState(false);
  const [selectedPromoSinQr, setSelectedPromoSinQr] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Escáner de cámara opcional con BarcodeDetector / fallback
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

  const fetchActivePromos = useCallback(async (comercioId) => {
    if (!comercioId || !isSupabaseConfigured || !supabase) return;
    setLoadingPromos(true);
    try {
      const { data, error } = await supabase
        .from('promociones')
        .select('*')
        .eq('comercio_id', comercioId);

      if (!error && Array.isArray(data)) {
        const now = new Date();
        const vigentes = data.filter(
          (p) => !p.vence_el || new Date(p.vence_el) > now
        );
        setPromosVigentes(vigentes);
      } else {
        setPromosVigentes([]);
      }
    } catch {
      setPromosVigentes([]);
    } finally {
      setLoadingPromos(false);
    }
  }, []);

  useEffect(() => {
    if (mostradorSession?.comercio_id) {
      fetchActivePromos(mostradorSession.comercio_id);
    }
  }, [mostradorSession?.comercio_id, fetchActivePromos]);

  const handleLoginMostrador = async (e) => {
    e.preventDefault();
    setLoginError(null);

    const rawCode = codigoComercioInput.trim();
    const cleanPin = pinInput.trim();

    if (!rawCode || !cleanPin) {
      setLoginError('Ingresa el Código o ID del Comercio y el PIN operativo.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoginError('Supabase no está configurado.');
      return;
    }

    setLoggingIn(true);

    try {
      // Resolver comercio si el usuario ingresó codigo_local o id
      let targetComercioId = rawCode;
      let comercioInfo = null;

      const { data: byCodigo } = await supabase
        .from('comercios')
        .select('id, nombre, rubro, codigo_local')
        .eq('codigo_local', rawCode)
        .maybeSingle();

      if (byCodigo?.id) {
        targetComercioId = byCodigo.id;
        comercioInfo = byCodigo;
      } else {
        const { data: byId } = await supabase
          .from('comercios')
          .select('id, nombre, rubro, codigo_local')
          .eq('id', rawCode)
          .maybeSingle();
        if (byId?.id) {
          targetComercioId = byId.id;
          comercioInfo = byId;
        }
      }

      // Llamar a la RPC validar_pin_comercio(p_comercio_id, p_pin)
      let { data: rpcData, error: rpcError } = await supabase.rpc(
        'validar_pin_comercio',
        {
          p_comercio_id: targetComercioId,
          p_pin: cleanPin,
        }
      );

      // Si el RPC recibe directamente el codigo_local como p_comercio_id
      if (rpcError && targetComercioId !== rawCode) {
        const retry = await supabase.rpc('validar_pin_comercio', {
          p_comercio_id: rawCode,
          p_pin: cleanPin,
        });
        rpcData = retry.data;
        rpcError = retry.error;
      }

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const resultObj = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const isValid =
        resultObj === true ||
        resultObj?.ok === true ||
        resultObj?.valido === true ||
        (resultObj &&
          typeof resultObj === 'object' &&
          resultObj.ok !== false &&
          resultObj.valido !== false &&
          Boolean(resultObj.id || resultObj.comercio_id || resultObj.nombre));

      if (!isValid) {
        throw new Error(
          resultObj?.mensaje ||
            resultObj?.error ||
            'Código de comercio o PIN operativo incorrecto.'
        );
      }

      const resolvedId =
        resultObj?.comercio_id ||
        resultObj?.id ||
        comercioInfo?.id ||
        targetComercioId;

      if (!comercioInfo && resolvedId) {
        const { data: fetchedCom } = await supabase
          .from('comercios')
          .select('id, nombre, rubro, codigo_local')
          .eq('id', resolvedId)
          .maybeSingle();
        if (fetchedCom) comercioInfo = fetchedCom;
      }

      const newSession = {
        comercio_id: resolvedId,
        codigo_local:
          resultObj?.codigo_local || comercioInfo?.codigo_local || rawCode,
        nombre:
          resultObj?.nombre ||
          resultObj?.comercio_nombre ||
          comercioInfo?.nombre ||
          `Comercio ${rawCode}`,
        rubro: resultObj?.rubro || comercioInfo?.rubro || 'Comercio',
        logged_at: new Date().toISOString(),
      };

      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      setMostradorSession(newSession);
      setPinInput('');
    } catch (err) {
      setLoginError(
        err.message || 'No se pudo validar el acceso de mostrador.'
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogoutMostrador = () => {
    stopCamera();
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setMostradorSession(null);
    setPromosVigentes([]);
    setFeedback(null);
  };

  const executeCanjeCupon = useCallback(
    async (rawCodigo) => {
      const cleanCodigo = String(rawCodigo || '').trim();
      if (!cleanCodigo || !mostradorSession?.comercio_id) return;

      setRedeemingQr(true);
      setFeedback(null);

      try {
        const { data, error } = await supabase.rpc('canjear_cupon_mostrador', {
          p_comercio_id: mostradorSession.comercio_id,
          p_codigo: cleanCodigo,
        });

        if (error) throw new Error(error.message);

        const res = Array.isArray(data) ? data[0] : data;
        if (!res || res.ok === false || res.valido === false) {
          setFeedback({
            type: 'error',
            title: 'Cupón no válido o ya utilizado',
            message:
              res?.mensaje ||
              res?.error ||
              `No se pudo canjear el código "${cleanCodigo}".`,
          });
          return;
        }

        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
        } catch {
          // Ignorar
        }

        setFeedback({
          type: 'success',
          title: '¡Cupón QR Canjeado con Éxito!',
          message:
            res?.mensaje ||
            `Código "${cleanCodigo}" validado correctamente${
              res?.promocion_titulo ? ` para "${res.promocion_titulo}"` : ''
            }.`,
        });
        setCodigoCuponInput('');
        fetchActivePromos(mostradorSession.comercio_id);
      } catch (err) {
        setFeedback({
          type: 'error',
          title: 'Error al canjear cupón',
          message: err.message || 'No se pudo procesar el cupón.',
        });
      } finally {
        setRedeemingQr(false);
      }
    },
    [mostradorSession?.comercio_id, fetchActivePromos]
  );

  const handleCanjearSubmit = (e) => {
    e.preventDefault();
    if (!codigoCuponInput.trim()) return;
    executeCanjeCupon(codigoCuponInput);
  };

  const handleRegistrarCanjeSinQr = async () => {
    if (!mostradorSession?.comercio_id || !supabase) return;

    setRegisteringSinQr(true);
    setFeedback(null);

    try {
      const payload = {
        comercio_id: mostradorSession.comercio_id,
        tipo: 'canje_sin_qr',
      };
      if (selectedPromoSinQr) {
        payload.promocion_id = selectedPromoSinQr;
      }

      let { error } = await supabase.from('eventos_comercio').insert([payload]);

      if (error && selectedPromoSinQr) {
        // Fallback si eventos_comercio solo tiene comercio_id y tipo
        const retry = await supabase.from('eventos_comercio').insert([
          {
            comercio_id: mostradorSession.comercio_id,
            tipo: 'canje_sin_qr',
          },
        ]);
        error = retry.error;
      }

      if (error) throw new Error(error.message);

      setFeedback({
        type: 'success',
        title: 'Canje Presencial sin QR Registrado',
        message:
          'Se registró el evento canje_sin_qr para las métricas del comercio.',
      });
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
        'Tu navegador no permite acceso directo a cámara. Ingresa o pega el código abajo.'
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
          'Cámara activa. Si tu navegador no detecta QR automáticamente, escribe el código corto TP-XXXX debajo del QR.'
        );
      }
    } catch {
      setScannerError(
        'No se pudo acceder a la cámara. Puedes pegar el token o escribir el código corto TP-XXXX directamente.'
      );
    }
  };

  return (
    <div className="min-h-full bg-[#FAFAF9] text-stone-900 flex flex-col">
      {/* Cabecera de Mostrador */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#FAFAF9]/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-xs">
              <Store className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-stone-900 leading-none">
                Ofert<span className="text-orange-600">Ar</span> ·{' '}
                <span className="text-stone-700">Terminal Mostrador</span>
              </h1>
              <p className="text-[11px] font-medium text-stone-500 mt-0.5">
                Validación operativa de cupones QR para empleados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/40 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                Volver al Mapa
              </button>
            )}

            {mostradorSession && (
              <button
                type="button"
                onClick={handleLogoutMostrador}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                Salir de Mostrador
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {!mostradorSession ? (
          <div className="mx-auto max-w-md rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-stone-200/80 pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
                <KeyRound className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Acceso Mostrador / Empleado
                </h2>
                <p className="text-xs text-stone-600">
                  Ingresa con el Código del Comercio y el PIN operativo
                </p>
              </div>
            </div>

            {loginError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200/80 p-3.5 text-xs text-red-700">
                <XCircle
                  className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginMostrador} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Código o ID del Comercio *
                </label>
                <div className="relative">
                  <Store
                    className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <input
                    type="text"
                    required
                    value={codigoComercioInput}
                    onChange={(e) => setCodigoComercioInput(e.target.value)}
                    placeholder="Ej. LOC-1042 o ID del local"
                    className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 text-sm font-medium text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  PIN Operativo (4 dígitos) *
                </label>
                <div className="relative">
                  <KeyRound
                    className="h-4 w-4 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 font-mono text-base font-bold tracking-widest text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="font-display w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-60 transition-all cursor-pointer"
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    Verificando PIN...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" strokeWidth={1.75} />
                    Ingresar al Mostrador
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Banner del local activo */}
            <div className="rounded-2xl border border-orange-200/80 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-xs">
                  <Store className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                      Sesión Operativa Activa
                    </span>
                    <span className="font-mono text-xs font-bold text-stone-500">
                      Código: {mostradorSession.codigo_local}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-stone-900 mt-0.5">
                    {mostradorSession.nombre}
                  </h2>
                </div>
              </div>
            </div>

            {feedback && (
              <div
                className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm shadow-xs ${
                  feedback.type === 'error'
                    ? 'border-red-200/80 bg-red-50 text-red-800'
                    : 'border-orange-200/80 bg-orange-50 text-orange-950'
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
                      className="h-5 w-5 text-orange-600 shrink-0 mt-0.5"
                      strokeWidth={1.75}
                    />
                  )}
                  <div>
                    <p className="font-display font-bold">{feedback.title}</p>
                    <p className="text-xs mt-0.5 opacity-90">
                      {feedback.message}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="text-xs font-semibold underline cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* 1. Escáner / Validador de Cupón QR o Código Corto TP-XXXX */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
                      <QrCode className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-stone-900">
                        Canjear Cupón QR o Código Corto
                      </h3>
                      <p className="text-xs text-stone-600">
                        Escanea el QR del cliente o escribe el código tipo{' '}
                        <code className="font-mono font-bold text-orange-700">
                          TP-XXXX
                        </code>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={scannerOpen ? stopCamera : startCameraScanner}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100/80 transition-colors cursor-pointer"
                  >
                    {scannerOpen ? (
                      <>
                        <CameraOff className="h-4 w-4" strokeWidth={1.75} />
                        Cerrar Cámara
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" strokeWidth={1.75} />
                        Escanear QR
                      </>
                    )}
                  </button>
                </div>

                {scannerOpen && (
                  <div className="overflow-hidden rounded-xl border border-orange-300 bg-stone-950 p-2 text-center space-y-2">
                    <video
                      ref={videoRef}
                      className="mx-auto h-52 w-full max-w-sm rounded-lg object-cover"
                      playsInline
                      muted
                    />
                    <p className="text-[11px] text-stone-300">
                      Apunta la cámara al código QR del cliente
                    </p>
                  </div>
                )}

                {scannerError && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/70 rounded-xl p-3">
                    {scannerError}
                  </p>
                )}

                <form
                  onSubmit={handleCanjearSubmit}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  <input
                    type="text"
                    value={codigoCuponInput}
                    onChange={(e) =>
                      setCodigoCuponInput(e.target.value.toUpperCase())
                    }
                    placeholder="Ej: TP-4829 o pega el token_qr"
                    className="flex-1 rounded-xl border border-stone-300 bg-[#FAFAF9] px-4 py-3 font-mono text-base font-bold tracking-wider text-stone-900 uppercase focus:border-orange-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="submit"
                    disabled={redeemingQr || !codigoCuponInput.trim()}
                    className="font-display inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition-all cursor-pointer"
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
                        Canjear Cupón
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* 2. Botón rápido: Canje presencial sin QR */}
              <div className="lg:col-span-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
                    Registro Rápido en Caja
                  </span>
                  <h3 className="font-display text-base font-bold text-stone-900">
                    Canje Presencial sin QR
                  </h3>
                  <p className="text-xs text-stone-600">
                    Si el cliente menciona la promoción en el local pero no generó un cupón QR, regístralo con un clic.
                  </p>

                  {promosVigentes.length > 0 && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Oferta aplicada (opcional):
                      </label>
                      <select
                        value={selectedPromoSinQr}
                        onChange={(e) => setSelectedPromoSinQr(e.target.value)}
                        className="w-full rounded-xl border border-stone-200/90 bg-[#FAFAF9] px-3 py-2 text-xs text-stone-800 focus:border-orange-600 focus:outline-none"
                      >
                        <option value="">General del comercio</option>
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
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        strokeWidth={1.75}
                      />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
                      Registrar Canje Presencial sin QR
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 3. Lista de Promociones Vigentes (Solo lectura) */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200/80 pb-3.5">
                <div>
                  <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                    <Sparkles
                      className="h-4 w-4 text-orange-600"
                      strokeWidth={1.75}
                    />
                    Promociones Vigentes del Comercio (Solo Lectura)
                  </h3>
                  <p className="text-xs text-stone-600">
                    Ofertas activas actualmente para referencia en mostrador
                  </p>
                </div>
                <span className="rounded-full bg-orange-50 border border-orange-200/60 px-3 py-1 text-xs font-bold text-orange-700 tabular-nums">
                  {promosVigentes.length}{' '}
                  {promosVigentes.length === 1 ? 'vigente' : 'vigentes'}
                </span>
              </div>

              {loadingPromos ? (
                <div className="flex items-center justify-center py-8 text-stone-500 gap-2 text-sm">
                  <Loader2
                    className="h-5 w-5 animate-spin text-orange-600"
                    strokeWidth={1.75}
                  />
                  Cargando promociones vigentes...
                </div>
              ) : promosVigentes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-[#FAFAF9] p-8 text-center text-xs text-stone-600">
                  No hay promociones vigentes activas en este momento para este local.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {promosVigentes.map((promo) => (
                    <div
                      key={promo.id}
                      className="flex items-start gap-3 rounded-xl border border-orange-200/70 bg-[#FAFAF9] p-3.5"
                    >
                      {promo.imagen_url ? (
                        <img
                          src={promo.imagen_url}
                          alt={promo.titulo}
                          className="h-14 w-14 rounded-lg object-cover border border-stone-200 shrink-0"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-200/60 shrink-0">
                          <Tag className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                            Vigente
                          </span>
                          {promo.es_flash && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              <Zap className="h-2.5 w-2.5" strokeWidth={1.75} />
                              FLASH
                            </span>
                          )}
                        </div>
                        <p className="font-display text-sm font-bold text-stone-900">
                          {promo.titulo}
                        </p>
                        {promo.descripcion && (
                          <p className="text-xs text-stone-600 line-clamp-2">
                            {promo.descripcion}
                          </p>
                        )}
                        {promo.vence_el && (
                          <p className="flex items-center gap-1 text-[11px] font-medium text-stone-500 tabular-nums">
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                            Vence:{' '}
                            {new Date(promo.vence_el).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
