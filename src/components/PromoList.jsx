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
  Ticket,
  Package,
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
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDistanceBadge(distanciaMetros) {
  if (distanciaMetros == null || Number.isNaN(Number(distanciaMetros))) {
    return null;
  }
  const metros = Math.round(Number(distanciaMetros));
  return `A ${metros} m`;
}

function formatCurrency(val) {
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return null;
  return `$${num.toLocaleString('es-AR')}`;
}

function extractPromoPricing(promo) {
  if (!promo) return null;

  const finalExplicit =
    promo.precio_final ?? promo.precio_oferta ?? promo.precio ?? null;
  const prevExplicit =
    promo.precio_anterior ?? promo.precio_original ?? null;

  if (finalExplicit != null) {
    return {
      finalPrice: formatCurrency(finalExplicit),
      oldPrice: prevExplicit != null ? formatCurrency(prevExplicit) : null,
    };
  }

  // Detectar precios mencionados en título o descripción (ej. "$4500 (antes $6000)")
  const text = `${promo.titulo || ''} ${promo.descripcion || ''}`;
  const matches = [...text.matchAll(/\$\s?(\d{1,3}(?:[.,]\d{3})*|\d+)/g)];
  if (matches.length >= 2) {
    const raw1 = Number(matches[0][1].replace(/[.,]/g, ''));
    const raw2 = Number(matches[1][1].replace(/[.,]/g, ''));
    if (!Number.isNaN(raw1) && !Number.isNaN(raw2) && raw1 !== raw2) {
      const menor = Math.min(raw1, raw2);
      const mayor = Math.max(raw1, raw2);
      return {
        finalPrice: formatCurrency(menor),
        oldPrice: formatCurrency(mayor),
      };
    }
  } else if (matches.length === 1) {
    const raw1 = Number(matches[0][1].replace(/[.,]/g, ''));
    if (!Number.isNaN(raw1) && raw1 > 0) {
      return {
        finalPrice: formatCurrency(raw1),
        oldPrice: null,
      };
    }
  }

  return null;
}

function buildWhatsAppUrl(comercioTelefono, tituloPromo, comercioNombre) {
  if (!comercioTelefono) return null;
  const cleanPhone = String(comercioTelefono).replace(/[^\d]/g, '');
  if (!cleanPhone) return null;
  const text = encodeURIComponent(
    `Hola ${comercioNombre || ''}, vi tu promoción "${tituloPromo}" en OfertAr y me gustaría consultarte.`
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
  onOpenCanjeModal,
}) {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [rubroSeleccionado, setRubroSeleccionado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const handleWhatsAppClick = (promoId) => {
    if (!promoId || !isSupabaseConfigured || !supabase) return;
    supabase
      .rpc('incrementar_metrica_promo', {
        p_promocion_id: promoId,
        p_tipo: 'whatsapp',
      })
      .then(() => {})
      .catch(() => {});
  };

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
          <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
            <ShoppingBag
              className="h-5 w-5 text-emerald-600"
              strokeWidth={1.75}
            />
            Promociones Cercanas en tu Barrio
          </h2>
          <p className="text-sm text-stone-600">
            Ofertas activas dentro de un radio de{' '}
            <strong className="text-stone-900 tabular-nums">
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
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50 transition-all duration-200 cursor-pointer"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={1.75}
          />
          Actualizar
        </button>
      </div>

      {/* Buscador y filtro rápido por rubro */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search
            className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por oferta o nombre del comercio..."
            className="w-full rounded-xl border border-stone-200/90 bg-[#FAFAF9] pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
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
                className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle
            className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <div>
            <p className="font-semibold">Conexión con Supabase pendiente</p>
            <p className="mt-0.5 text-amber-800/90">
              Configura <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> en el archivo{' '}
              <code className="font-mono">.env</code> para visualizar y publicar ofertas en vivo.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200/80 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle
            className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="h-64 animate-pulse rounded-2xl bg-white border border-stone-200/80 p-4 space-y-3"
            >
              <div className="h-32 w-full rounded-xl bg-stone-200/70" />
              <div className="h-4 w-2/3 rounded bg-stone-200/70" />
              <div className="h-3 w-1/2 rounded bg-stone-200/70" />
            </div>
          ))}
        </div>
      ) : promocionesFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-sm">
          <ShoppingBag
            className="mx-auto h-10 w-10 text-stone-400"
            strokeWidth={1.75}
          />
          <h3 className="font-display mt-3 text-base font-bold text-stone-900">
            {promociones.length === 0
              ? 'No hay promociones activas en este radio'
              : 'No se encontraron promociones con ese filtro'}
          </h3>
          <p className="mt-1 text-sm text-stone-600">
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
            const pricing = extractPromoPricing(promo);
            const waUrl = buildWhatsAppUrl(
              comercioTelefono,
              promo.titulo,
              comercioNombre
            );
            const sinStock =
              promo.stock_disponible != null &&
              Number(promo.stock_disponible) <= 0;

            return (
              <article
                key={promoId || index}
                className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm hover:border-stone-300 transition-all duration-200"
              >
                <div>
                  <div className="relative">
                    {promo.imagen_url ? (
                      <img
                        src={promo.imagen_url}
                        alt={promo.titulo}
                        className="h-44 w-full object-cover border-b border-stone-100"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-stone-100/80 border-b border-stone-200/60 text-stone-400">
                        <ShoppingBag
                          className="h-9 w-9 opacity-70"
                          strokeWidth={1.75}
                        />
                      </div>
                    )}

                    {/* Badge Oferta Flash (sin emojis, icono vectorial) */}
                    {promo.es_flash && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-xs">
                        <Zap className="h-3.5 w-3.5" strokeWidth={1.75} />
                        FLASH
                      </span>
                    )}

                    {/* Botón de Corazón (Favoritos / Guardados) */}
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
                        className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xs shadow-sm transition-all duration-200 active:scale-110 cursor-pointer ${
                          isFavorite
                            ? 'border-rose-200 bg-rose-50/95 text-rose-600'
                            : 'border-stone-200/80 bg-white/90 text-stone-500 hover:text-rose-600 hover:bg-white'
                        }`}
                      >
                        <Heart
                          strokeWidth={1.75}
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isFavorite
                              ? 'fill-rose-500 text-rose-500 scale-110'
                              : ''
                          } ${isToggling ? 'animate-ping' : ''}`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 font-medium text-emerald-700 capitalize">
                        <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {String(comercioRubro).replace('_', ' ')}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                        {distanciaBadge && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 font-semibold text-amber-800 tabular-nums">
                            <Navigation
                              className="h-3 w-3"
                              strokeWidth={1.75}
                            />
                            {distanciaBadge}
                          </span>
                        )}

                        {remaining && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-600 tabular-nums">
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                            {remaining}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-stone-900 line-clamp-2">
                        {promo.titulo}
                      </h3>

                      {pricing?.finalPrice && (
                        <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                          {pricing.oldPrice && (
                            <span className="text-xs text-stone-400 line-through">
                              {pricing.oldPrice}
                            </span>
                          )}
                          <span className="font-display text-base font-extrabold text-emerald-700">
                            {pricing.finalPrice}
                          </span>
                        </div>
                      )}
                    </div>

                    {promo.descripcion && (
                      <p className="text-xs text-stone-600 line-clamp-2">
                        {promo.descripcion}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="flex items-center gap-1.5 text-xs text-stone-600 min-w-0">
                        <Store
                          className="h-4 w-4 text-stone-400 shrink-0"
                          strokeWidth={1.75}
                        />
                        <span className="font-semibold text-stone-800 truncate">
                          {comercioNombre}
                        </span>
                      </p>

                      {promo.stock_disponible != null && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 tabular-nums ${
                            sinStock
                              ? 'bg-red-50 text-red-700 border border-red-200/60'
                              : 'bg-stone-100 text-stone-700 border border-stone-200/60'
                          }`}
                        >
                          <Package className="h-3 w-3" strokeWidth={1.75} />
                          {sinStock
                            ? 'Agotado'
                            : `Stock: ${promo.stock_disponible}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones diferenciados: Canjear en local (primario sólido) y WhatsApp (secundario limpio con borde) */}
                <div className="border-t border-stone-100 p-4 pt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {onOpenCanjeModal && promoId != null && (
                    <button
                      type="button"
                      disabled={sinStock}
                      onClick={() => onOpenCanjeModal(promo)}
                      className="font-display flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all duration-200 cursor-pointer"
                    >
                      <Ticket className="h-4 w-4" strokeWidth={1.75} />
                      {sinStock ? 'Sin stock' : 'Canjear en local'}
                    </button>
                  )}

                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleWhatsAppClick(promoId)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200"
                    >
                      <MessageCircle
                        className="h-4 w-4 text-emerald-600"
                        strokeWidth={1.75}
                      />
                      WhatsApp
                    </a>
                  ) : (
                    <span className="flex items-center justify-center text-center text-xs text-stone-400 py-2">
                      Sin WhatsApp
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
