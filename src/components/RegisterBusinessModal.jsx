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
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setNombre('');
    setDireccion('');
    setTelefonoWhatsapp('');
    setRubro(RUBROS[0].value);
    setLocation(INITIAL_LOCATION);
    setErrorMsg(null);
    setSuccessMsg(null);
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
    setSuccessMsg(null);

    if (!session?.user?.id) {
      setErrorMsg('Debes iniciar sesión para vincular un comercio.');
      return;
    }

    if (!nombre.trim() || !telefonoWhatsapp.trim()) {
      setErrorMsg(
        'Por favor completa el nombre del comercio y el WhatsApp de contacto.'
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

      const { data, error } = await supabase
        .from('comercios')
        .insert([
          {
            user_id: session.user.id,
            nombre: nombreFinal,
            telefono_whatsapp: telefonoLimpio,
            rubro,
            ubicacion: ubicacionWKT,
          },
        ])
        .select('*, promociones(*)')
        .single();

      if (error) {
        throw new Error(`No se pudo registrar el local: ${error.message}`);
      }

      setSuccessMsg('Local registrado con éxito.');

      if (onBusinessRegistered) {
        onBusinessRegistered({
          ...data,
          direccion_referencia: direccion.trim() || null,
          promociones: data.promociones || [],
        });
      }

      setTimeout(() => {
        handleClose();
      }, 600);
    } catch (err) {
      setErrorMsg(
        err.message || 'Ocurrió un error al registrar tu comercio.'
      );
    } finally {
      setLoading(false);
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <Store className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2
                id="modal-register-business-title"
                className="font-display text-lg font-bold text-stone-900"
              >
                Vincula tu Comercio / Sucursal
              </h2>
              <p className="text-xs text-stone-600">
                Busca la dirección de tu local o ajusta el marcador en el mapa
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

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60 p-3.5 text-xs text-emerald-800">
              <CheckCircle2
                className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <span>{successMsg}</span>
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
                  className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Dirección / Sucursal (Autocompletado)
              </label>
              <AddressAutocomplete
                value={direccion}
                onChange={setDireccion}
                onSelectLocation={handleSelectAddressSuggestion}
                placeholder="Ej. Av. Corrientes 1234, CABA"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                WhatsApp de Contacto *
              </label>
              <div className="relative">
                <Phone
                  className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <input
                  type="tel"
                  required
                  value={telefonoWhatsapp}
                  onChange={(e) => setTelefonoWhatsapp(e.target.value)}
                  placeholder="Ej. 5491123456789"
                  className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2 text-sm text-stone-900 tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
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
                  className="w-full rounded-xl border border-stone-200/90 pl-9 pr-3 py-2 text-sm bg-white text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
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
              className="font-display flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  Guardando...
                </>
              ) : (
                'Registrar Local'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
