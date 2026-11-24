import { useState, useEffect, useCallback } from 'react';
import {
  Store,
  KeyRound,
  XCircle,
  Loader2,
  LogOut,
  Clock,
  Tag,
  Sparkles,
  Zap,
  UserCheck,
  ArrowLeft,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import CouponValidatorBox from './CouponValidatorBox';

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

  // Listado en solo lectura de las promociones vigentes del comercio
  const [promosVigentes, setPromosVigentes] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(false);

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
      setLoginError(
        'Ingresa el Código o ID del Comercio y el PIN de Mostrador.'
      );
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoginError('Supabase no está configurado.');
      return;
    }

    setLoggingIn(true);

    try {
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
        resultObj?.exito === true ||
        resultObj?.ok === true ||
        resultObj?.valido === true ||
        (resultObj &&
          typeof resultObj === 'object' &&
          resultObj.exito !== false &&
          resultObj.ok !== false &&
          resultObj.valido !== false &&
          Boolean(resultObj.id || resultObj.comercio_id || resultObj.nombre));

      if (!isValid) {
        throw new Error(
          resultObj?.mensaje ||
            resultObj?.error ||
            'Código de comercio o PIN de mostrador incorrecto.'
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
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setMostradorSession(null);
    setPromosVigentes([]);
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
                <span className="text-stone-700">Acceso Mostrador</span>
              </h1>
              <p className="text-[11px] font-medium text-stone-500 mt-0.5">
                Terminal operativa de validación de cupones QR
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
                Volver al Inicio
              </button>
            )}

            {mostradorSession && (
              <button
                type="button"
                onClick={handleLogoutMostrador}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                Cerrar turno
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
                  Ingresa con el Código o ID del Comercio y el PIN de Mostrador
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
                  Código o ID del Comercio (codigo_local o id) *
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
                    placeholder="Ej. LOC-1042 o UUID del comercio"
                    className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 text-sm font-medium text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  PIN de Mostrador (pin_mostrador) *
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
                    Validando PIN...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" strokeWidth={1.75} />
                    Iniciar Turno en Mostrador
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Banner del local activo + Botón Cerrar turno */}
            <div className="rounded-2xl border border-orange-200/80 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-xs">
                  <Store className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                      Turno Activo en Mostrador
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

              <button
                type="button"
                onClick={handleLogoutMostrador}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-[#FAFAF9] px-4 py-2 text-xs font-bold text-stone-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                Cerrar turno
              </button>
            </div>

            {/* Componente reutilizable de Validación de Cupones QR + Código Corto + Canje sin QR */}
            <CouponValidatorBox
              comercioId={mostradorSession.comercio_id}
              comercioNombre={mostradorSession.nombre}
              promosVigentes={promosVigentes}
              onCouponValidated={() =>
                fetchActivePromos(mostradorSession.comercio_id)
              }
            />

            {/* Listado en solo lectura de las promociones vigentes del comercio */}
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
                    Ofertas activas actualmente para consulta rápida en caja
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
