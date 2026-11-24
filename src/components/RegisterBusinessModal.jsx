import { useState } from 'react';
import {
  X,
  Store,
  Phone,
  Tag,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import LocationPicker from './LocationPicker';
import AddressAutocomplete from './AddressAutocomplete';

const RUBROS = [
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'indumentaria', label: 'Indumentaria' },
  { value: 'almacen', label: 'Almacén y Supermercado' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'salud_belleza', label: 'Salud y Belleza' },
  { value: 'hogar', label: 'Hogar y Ferretería' },
  { value: 'otros', label: 'Otros' },
];

const INITIAL_LOCATION = { lat: -34.6037, lng: -58.3816 };

export default function RegisterBusinessModal({
  isOpen,
  onClose,
  session,
  onBusinessRegistered,
}) {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState('');
  const [rubro, setRubro] = useState(RUBROS[0].value);
  const [pinMostrador, setPinMostrador] = useState('');
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [createdBusiness, setCreatedBusiness] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setNombre('');
    setDireccion('');
    setTelefonoWhatsapp('');
    setRubro(RUBROS[0].value);
    setPinMostrador('');
    setLocation(INITIAL_LOCATION);
    setErrorMsg(null);
    setCreatedBusiness(null);
    setCopiedCode(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectAddressSuggestion = ({ lat, lng, address }) => {
    setDireccion(address);
    setLocation({ lat, lng });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!session?.user?.id) {
      setErrorMsg('Debes iniciar sesión para vincular un comercio.');
      return;
    }

    if (!nombre.trim()) {
      setErrorMsg('Por favor ingresa el nombre del comercio.');
      return;
    }

    const cleanPin = pinMostrador.replace(/\D/g, '').slice(0, 4);
    if (cleanPin.length !== 4) {
      setErrorMsg(
        'El PIN de mostrador inicial debe tener exactamente 4 dígitos numéricos.'
      );
      return;
    }

    if (!location?.lat || !location?.lng) {
      setErrorMsg(
        'Por favor selecciona la ubicación del comercio en el mapa.'
      );
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase no está configurado.');
      return;
    }

    setLoading(true);

    try {
      const telefonoLimpio = telefonoWhatsapp.replace(/[^\d+]/g, '');
      const { lat, lng } = location;
      const ubicacionWKT = `POINT(${lng} ${lat})`;
      const nombreFinal = direccion.trim()
        ? `${nombre.trim()} (${direccion.trim()})`
        : nombre.trim();

      // Asegurar que el perfil tenga rol 'jefe'
      await supabase
        .from('perfiles')
        .upsert({ id: session.user.id, rol: 'jefe' }, { onConflict: 'id' });

      let insertResult = await supabase
        .from('comercios')
        .insert([
          {
            user_id: session.user.id,
            nombre: nombreFinal,
            telefono_whatsapp: telefonoLimpio || null,
            rubro,
            ubicacion: ubicacionWKT,
            pin_mostrador: cleanPin,
          },
        ])
        .select('*, promociones(*)')
        .single();

      if (insertResult.error) {
        // Fallback por si telefono_whatsapp es requerido como string vacío
        insertResult = await supabase
          .from('comercios')
          .insert([
            {
              user_id: session.user.id,
              nombre: nombreFinal,
              telefono_whatsapp: telefonoLimpio || '',
              rubro,
              ubicacion: ubicacionWKT,
              pin_mostrador: cleanPin,
            },
          ])
          .select('*, promociones(*)')
          .single();
      }

      if (insertResult.error) {
        throw new Error(
          `No se pudo registrar el local: ${insertResult.error.message}`
        );
      }

      const data = insertResult.data;
      const nuevoComercio = {
        ...data,
        direccion_referencia: direccion.trim() || null,
        promociones: data.promociones || [],
      };

      setCreatedBusiness(nuevoComercio);

      if (onBusinessRegistered) {
        onBusinessRegistered(nuevoComercio);
      }
    } catch (err) {
      setErrorMsg(
        err.message || 'Ocurrió un error al registrar tu comercio.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodigoLocal = async () => {
    const code = createdBusiness?.codigo_local || createdBusiness?.id;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(String(code));
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
      aria-labelledby="modal-register-business-title"
    >
      <div className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-200/80">
        <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
              <Store className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2
                id="modal-register-business-title"
                className="font-display text-lg font-bold text-stone-900"
              >
                {createdBusiness
                  ? '¡Comercio Creado con Éxito!'
                  : 'Crear Local / Sucursal'}
              </h2>
              <p className="text-xs text-stone-600">
                {createdBusiness
                  ? 'Guarda los datos de acceso operativo para el mostrador'
                  : 'Configura los datos, ubicación y PIN operativo de 4 dígitos'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-all duration-200 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {createdBusiness ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-200/70 p-4 text-xs sm:text-sm text-orange-950">
              <CheckCircle2
                className="h-5 w-5 text-orange-600 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <div>
                <p className="font-bold">
                  El local &ldquo;{createdBusiness.nombre}&rdquo; ya está activo.
                </p>
                <p className="mt-0.5 text-xs text-orange-900">
                  Comparte el código del local y el PIN con tus empleados para que puedan validar cupones QR desde{' '}
                  <code className="font-mono font-bold">/mostrador</code>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-orange-200/80 bg-[#FAFAF9] p-4 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Código del Local (codigo_local)
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-extrabold text-orange-600 tabular-nums">
                    {createdBusiness.codigo_local || createdBusiness.id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCodigoLocal}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/40 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check
                          className="h-3.5 w-3.5 text-orange-600"
                          strokeWidth={1.75}
                        />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  PIN Operativo Mostrador
                </span>
                <p className="font-mono text-lg font-extrabold text-stone-900 tracking-widest tabular-nums">
                  {createdBusiness.pin_mostrador || pinMostrador}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-200/80">
              <button
                type="button"
                onClick={handleClose}
                className="font-display inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 transition-all duration-200 cursor-pointer"
              >
                Ir a Mi Panel de Comercio
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200/80 p-3.5 text-xs text-red-700">
                <AlertCircle
                  className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Nombre del Local *
                </label>
                <div className="relative">
                  <Store
                    className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Panadería San José"
                    className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2 text-sm text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Rubro *
                </label>
                <div className="relative">
                  <Tag
                    className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <select
                    value={rubro}
                    onChange={(e) => setRubro(e.target.value)}
                    className="w-full rounded-xl border border-stone-200/90 pl-9 pr-3 py-2 text-sm bg-white text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
                  >
                    {RUBROS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Dirección / Sucursal *
                </label>
                <AddressAutocomplete
                  value={direccion}
                  onChange={setDireccion}
                  onSelectLocation={handleSelectAddressSuggestion}
                  placeholder="Ej. Av. Corrientes 1234, CABA"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  PIN Mostrador (4 dígitos) *
                </label>
                <div className="relative">
                  <KeyRound
                    className="h-4 w-4 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2"
                    strokeWidth={1.75}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    required
                    value={pinMostrador}
                    onChange={(e) =>
                      setPinMostrador(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="Ej. 1234"
                    className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2 font-mono text-sm font-bold tracking-widest text-stone-900 tabular-nums focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                WhatsApp de Contacto (opcional)
              </label>
              <div className="relative">
                <Phone
                  className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <input
                  type="tel"
                  value={telefonoWhatsapp}
                  onChange={(e) => setTelefonoWhatsapp(e.target.value)}
                  placeholder="Ej. 5491123456789"
                  className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2 text-sm text-stone-900 tabular-nums focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-stone-500" strokeWidth={1.75} />
                Ubicación de la Sucursal en el Mapa *
              </label>
              <LocationPicker position={location} onChange={setLocation} />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200/80">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-stone-200/90 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="font-display flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-60 transition-all duration-200 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    Creando local...
                  </>
                ) : (
                  'Crear Local y Generar Código'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
