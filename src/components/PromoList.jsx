import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Clock,
  MessageCircle,
  Store,
  Tag,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  Search,
  Navigation,
  Heart,
  Zap,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const FILTROS_RUBRO = [
  { value: 'todos', label: 'Todos' },
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'indumentaria', label: 'Indumentaria' },
  { value: 'almacen', label: 'Almacén' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'salud_belleza', label: 'Salud y Belleza' },
  { value: 'hogar', label: 'Hogar' },
  { value: 'otros', label: 'Otros' },
];

function formatRemainingTime(venceEl) {
  if (!venceEl) return null;
  const now = new Date();
  const end = new Date(venceEl);
  const diffMs = end - now;

  if (diffMs <= 0) {
    return 'Expirada';
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h restantes`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m restantes`;
  }
  return `${minutes}m restantes`;
}

function formatDistanceBadge(distanciaMetros) {
  if (distanciaMetros == null || Number.isNaN(Number(distanciaMetros))) {
    return null;
  }
  const metros = Math.round(Number(distanciaMetros));
  return `A ${metros} m`;
}

function buildWhatsAppUrl(comercioTelefono, tituloPromo, comercioNombre) {
  if (!comercioTelefono) return null;
  const cleanPhone = String(comercioTelefono).replace(/[^\d]/g, '');
  if (!cleanPhone) return null;
  const text = encodeURIComponent(
    `¡Hola ${comercioNombre || ''}! Vi tu promoción "${tituloPromo}" en OfertAr y me gustaría consultarte.`
  );
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

export default function PromoList({
  userLat = -34.6037,
  userLng = -58.3816,
  selectedRadio = 1000,
  refreshKey = 0,
  onPromosLoaded,
  favoriteIds = [],
  togglingFavoriteId = null,
  onToggleFavorite,
}) {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [rubroSeleccionado, setRubroSeleccionado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const fetchNearbyPromotions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'obtener_promos_cercanas',
        {
          lat_origen: userLat,
          lng_origen: userLng,
          radio_metros: selectedRadio,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      const lista = Array.isArray(data) ? data : [];
      setPromociones(lista);
      if (onPromosLoaded) {
        onPromosLoaded(lista);
      }
    } catch (err) {
      setError(
        err.message || 'No se pudieron obtener las promociones cercanas.'
      );
      setPromociones([]);
      if (onPromosLoaded) {
        onPromosLoaded([]);
      }
    } finally {
      setLoading(false);
    }
  }, [userLat, userLng, selectedRadio, onPromosLoaded]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (!cancelled) {
        fetchNearbyPromotions();
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [fetchNearbyPromotions, refreshKey]);

  // Actualizar contador de tiempo restante cada minuto
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const promocionesFiltradas = useMemo(() => {
    return promociones.filter((promo) => {
      const rubro =
        promo.comercio_rubro ||
        promo.rubro ||
        promo.comercios?.rubro ||
        '';
      const nombreComercio =
        promo.comercio_nombre ||
        promo.nombre_comercio ||
        promo.comercios?.nombre ||
        '';

      if (rubroSeleccionado !== 'todos' && rubro !== rubroSeleccionado) {
        return false;
      }

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const matchTitulo = promo.titulo?.toLowerCase().includes(q);
        const matchDesc = promo.descripcion?.toLowerCase().includes(q);
        const matchComercio = nombreComercio.toLowerCase().includes(q);
        return matchTitulo || matchDesc || matchComercio;
      }

      return true;
    });
  }, [promociones, rubroSeleccionado, busqueda]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-indigo-600" />
            Promociones Cercanas en tu Barrio
          </h2>
          <p className="text-sm text-slate-500">
            Ofertas activas dentro de un radio de{' '}
            <strong className="text-slate-700">
              {selectedRadio >= 1000
                ? `${selectedRadio / 1000} km`
                : `${selectedRadio} m`}
            </strong>{' '}
            desde tu ubicación.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchNearbyPromotions}
          disabled={loading || !isSupabaseConfigured}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Buscador y filtro rápido por rubro */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por oferta o nombre del comercio..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-xs sm:text-sm focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {FILTROS_RUBRO.map((f) => {
            const active = rubroSeleccionado === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setRubroSeleccionado(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Conexión con Supabase pendiente</p>
            <p className="mt-0.5 text-amber-700">
              Configura <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en el archivo{' '}
              <code className="font-mono">.env</code> para visualizar y publicar ofertas en vivo.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="h-64 animate-pulse rounded-2xl bg-white border border-slate-200 p-4 space-y-3"
            >
              <div className="h-32 w-full rounded-xl bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : promocionesFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-800">
            {promociones.length === 0
              ? 'No hay promociones activas en este radio'
              : 'No se encontraron promociones con ese filtro'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {promociones.length === 0
              ? 'Prueba ampliando el radio de búsqueda (ej. 3 km o 5 km) o seleccionando otro punto en el mapa.'
              : 'Prueba cambiando el rubro seleccionado o el texto de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {promocionesFiltradas.map((promo, index) => {
            const promoId = promo.id ?? promo.promo_id ?? promo.promocion_id;
            const isFavorite = favoriteIds.some(
              (favId) => String(favId) === String(promoId)
            );
            const isToggling =
              togglingFavoriteId != null &&
              String(togglingFavoriteId) === String(promoId);

            const comercioNombre =
              promo.comercio_nombre ||
              promo.nombre_comercio ||
              promo.comercios?.nombre ||
              'Comercio adherido';
            const comercioRubro =
              promo.comercio_rubro ||
              promo.rubro ||
              promo.comercios?.rubro ||
              'Comercio';
            const comercioTelefono =
              promo.comercio_telefono ||
              promo.telefono_whatsapp ||
              promo.comercios?.telefono_whatsapp ||
              '';
            const distanciaBadge = formatDistanceBadge(
              promo.distancia_metros ?? promo.distancia
            );
            const remaining = formatRemainingTime(promo.vence_el);
            const waUrl = buildWhatsAppUrl(
              comercioTelefono,
              promo.titulo,
              comercioNombre
            );

            return (
              <article
                key={promoId || index}
                className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:shadow-md"
              >
                <div>
                  <div className="relative">
                    {promo.imagen_url ? (
                      <img
                        src={promo.imagen_url}
                        alt={promo.titulo}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 text-indigo-400">
                        <ShoppingBag className="h-10 w-10 opacity-60" />
                      </div>
                    )}

                    {/* Badge Oferta Flash si aplica */}
                    {promo.es_flash && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
                        <Zap className="h-3 w-3 fill-white" />
                        FLASH
                      </span>
                    )}

                    {/* Botón de Corazón (Favoritos / Guardados) en esquina superior derecha */}
                    {onToggleFavorite && promoId != null && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => onToggleFavorite(promoId, promo.titulo)}
                        title={
                          isFavorite
                            ? 'Quitar de tus ofertas guardadas'
                            : 'Guardar oferta en tus favoritos'
                        }
                        aria-label={
                          isFavorite
                            ? 'Quitar de favoritos'
                            : 'Guardar en favoritos'
                        }
                        className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xs shadow-sm transition-all duration-200 active:scale-125 cursor-pointer ${
                          isFavorite
                            ? 'border-rose-200 bg-rose-50/95 text-rose-500 scale-105'
                            : 'border-white/60 bg-white/90 text-slate-500 hover:text-rose-500 hover:bg-white'
                        }`}
                      >
                        <Heart
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isFavorite ? 'fill-rose-500 text-rose-500 scale-110' : ''
                          } ${isToggling ? 'animate-ping' : ''}`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 capitalize">
                        <Tag className="h-3 w-3" />
                        {String(comercioRubro).replace('_', ' ')}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {distanciaBadge && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-bold text-emerald-700">
                            <Navigation className="h-3 w-3" />
                            {distanciaBadge}
                          </span>
                        )}

                        {remaining && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                            <Clock className="h-3 w-3" />
                            {remaining}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                      {promo.titulo}
                    </h3>

                    {promo.descripcion && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {promo.descripcion}
                      </p>
                    )}

                    <p className="flex items-center gap-1.5 text-xs text-slate-600 pt-0.5">
                      <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">
                        {comercioNombre}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 p-4 pt-3">
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Pedir por WhatsApp
                    </a>
                  ) : (
                    <span className="block text-center text-xs text-slate-400 py-2">
                      Sin WhatsApp disponible
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
