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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!session?.user?.id) {
      setErrorMsg('Debes iniciar sesión para vincular un comercio.');
      return;
    }

    if (!nombre.trim() || !telefonoWhatsapp.trim()) {
      setErrorMsg('Por favor completa el nombre del comercio y el WhatsApp de contacto.');
      return;
    }

    if (!location?.lat || !location?.lng) {
      setErrorMsg('Por favor selecciona la ubicación del comercio en el mapa.');
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

      setSuccessMsg('¡Local registrado con éxito!');

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
      setErrorMsg(err.message || 'Ocurrió un error al registrar tu comercio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-register-business-title"
    >
      <div className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="modal-register-business-title"
                className="text-lg font-bold text-slate-900"
              >
                Vincula tu Comercio / Sucursal
              </h2>
              <p className="text-xs text-slate-500">
                Registra un local con su ubicación en el mapa para publicar ofertas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre del Local *
              </label>
              <div className="relative">
                <Store className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Panadería San José"
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dirección / Sucursal
              </label>
              <div className="relative">
                <MapPin className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej. Av. Corrientes 1234"
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                WhatsApp de Contacto *
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={telefonoWhatsapp}
                  onChange={(e) => setTelefonoWhatsapp(e.target.value)}
                  placeholder="Ej. 5491123456789"
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Rubro *
              </label>
              <div className="relative">
                <Tag className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={rubro}
                  onChange={(e) => setRubro(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
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
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-500" />
              Ubicación de la Sucursal en el Mapa *
            </label>
            <LocationPicker position={location} onChange={setLocation} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
