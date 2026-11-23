import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin,
  Store,
  Plus,
  LogIn,
  LogOut,
  User,
  Compass,
  Calendar,
  Mail,
  Trash2,
  Tag,
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  LocateFixed,
  RotateCcw,
  History,
  Archive,
  X,
  Heart,
  MessageCircle,
  ShoppingBag,
  Zap,
  Ticket,
  BarChart3,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import BusinessPromoForm from './components/BusinessPromoForm';
import PromoList from './components/PromoList';
import AuthModal from './components/AuthModal';
import RegisterBusinessModal from './components/RegisterBusinessModal';
import RepublishPromoModal from './components/RepublishPromoModal';
import ModalCanjeTemporal from './components/ModalCanjeTemporal';
import PanelCanjesYMetricas from './components/PanelCanjesYMetricas';
import LocationPicker from './components/LocationPicker';

const OBELISCO_CABA = { lat: -34.6037, lng: -58.3816 };

const SEARCH_RADII = [
  { label: '500m', meters: 500 },
  { label: '1 km', meters: 1000 },
  { label: '3 km', meters: 3000 },
  { label: '5 km', meters: 5000 },
];

function formatUbicacionDisplay(comercio) {
  if (comercio?.direccion_referencia) {
    return comercio.direccion_referencia;
  }
  const match = comercio?.nombre?.match(/\(([^)]+)\)$/);
  if (match) {
    return match[1];
  }
  if (
    typeof comercio?.ubicacion === 'string' &&
    comercio.ubicacion.startsWith('POINT')
  ) {
    const coords = comercio.ubicacion
      .replace('POINT(', '')
      .replace(')', '')
      .trim()
      .split(/\s+/);
    if (coords.length === 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return `Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    }
  }
  return 'Ubicación georreferenciada en el mapa';
}

function isPromoActive(promo) {
  if (!promo?.vence_el) return true;
  return new Date(promo.vence_el) > new Date();
}

function formatRemainingTime(venceEl) {
  if (!venceEl) return null;
  const diffMs = new Date(venceEl) - new Date();
  if (diffMs <= 0) return 'Oferta finalizada';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildWhatsAppUrl(telefono, tituloPromo, nombreComercio) {
  if (!telefono) return null;
  const cleanPhone = String(telefono).replace(/[^\d]/g, '');
  if (!cleanPhone) return null;
  const text = encodeURIComponent(
    `Hola ${nombreComercio || ''}, guardé tu promoción "${tituloPromo}" en OfertAr y me gustaría consultarte.`
  );
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

function parseUbicacionCoords(rawUbicacion) {
  if (!rawUbicacion) return null;

  if (typeof rawUbicacion === 'string') {
    if (rawUbicacion.includes('POINT')) {
      const match = rawUbicacion.match(
        /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i
      );
      if (match) {
        const lng = Number(match[1]);
        const lat = Number(match[2]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          return { lat, lng };
        }
      }
    } else if (
      rawUbicacion.length >= 42 &&
      /^[0-9a-fA-F]+$/.test(rawUbicacion.trim())
    ) {
      try {
        const clean = rawUbicacion.trim();
        const isLE = clean.slice(0, 2) === '01';
        const coordHex = clean.slice(-32);
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i += 1) {
          bytes[i] = parseInt(coordHex.slice(i * 2, i * 2 + 2), 16);
        }
        const view = new DataView(bytes.buffer);
        const lng = view.getFloat64(0, isLE);
        const lat = view.getFloat64(8, isLE);
        if (
          !Number.isNaN(lat) &&
          !Number.isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          return { lat, lng };
        }
      } catch {
        return null;
      }
    }
  }

  if (
    typeof rawUbicacion === 'object' &&
    Array.isArray(rawUbicacion.coordinates) &&
    rawUbicacion.coordinates.length >= 2
  ) {
    const lng = Number(rawUbicacion.coordinates[0]);
    const lat = Number(rawUbicacion.coordinates[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('explorar'); // 'explorar' | 'perfil' | 'comercios'
  const [session, setSession] = useState(null);
  const [profileNameDb, setProfileNameDb] = useState('');
  const [comercios, setComercios] = useState([]);
  const [loadingComercios, setLoadingComercios] = useState(false);
  const [loadingComercioPromosId, setLoadingComercioPromosId] = useState(null);

  // Estado de Favoritos / Ofertas Guardadas del usuario
  const [favoritos, setFavoritos] = useState([]);
  const [loadingFavoritos, setLoadingFavoritos] = useState(false);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegisterBusinessOpen, setIsRegisterBusinessOpen] = useState(false);

  // Modal de publicación de promoción
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoModalComercioId, setPromoModalComercioId] = useState('');

  // Modal de republicación de promoción vencida
  const [promoToRepublish, setPromoToRepublish] = useState(null);

  // Modal de confirmación de eliminación definitiva
  const [promoToDelete, setPromoToDelete] = useState(null);

  // Modal de Canje Temporal (PIN de 5 minutos para el vecino)
  const [promoForCanje, setPromoForCanje] = useState(null);

  // Control de qué sucursales tienen desplegadas sus promociones y qué sub-pestaña ('activas' | 'vencidas' | 'metricas')
  const [expandedComercios, setExpandedComercios] = useState({});
  const [comercioPromoTab, setComercioPromoTab] = useState({});
  const [archivingPromoId, setArchivingPromoId] = useState(null);
  const [deletingPromoId, setDeletingPromoId] = useState(null);
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  // Estado de geolocalización y exploración para el vecino
  const [neighborPosition, setNeighborPosition] = useState(OBELISCO_CABA);
  const [geoStatus, setGeoStatus] = useState(() =>
    'geolocation' in navigator ? 'detectando' : 'fallback'
  );
  const [searchRadiusMeters, setSearchRadiusMeters] = useState(1000);
  const [nearbyPromos, setNearbyPromos] = useState([]);
  const [nearbyComercios, setNearbyComercios] = useState([]);

  const showTemporaryFeedback = (type, message) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 4500);
  };

  const requestUserGeolocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setNeighborPosition(OBELISCO_CABA);
      setGeoStatus('fallback');
      return;
    }

    setGeoStatus('detectando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNeighborPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoStatus('activa');
      },
      () => {
        setNeighborPosition(OBELISCO_CABA);
        setGeoStatus('fallback');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNeighborPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoStatus('activa');
      },
      () => {
        setNeighborPosition(OBELISCO_CABA);
        setGeoStatus('fallback');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Consulta todos los comercios cercanos en el radio (con o sin promociones activas)
  const fetchNearbyComerciosForMap = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // 1. Intentar RPC PostGIS `obtener_comercios_cercanos` (LEFT JOIN comercios -> promociones)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'obtener_comercios_cercanos',
        {
          lat_origen: neighborPosition.lat,
          lng_origen: neighborPosition.lng,
          radio_metros: searchRadiusMeters,
        }
      );

      if (!rpcError && Array.isArray(rpcData)) {
        setNearbyComercios(rpcData);
        return;
      }

      // 2. Fallback automático: consultar tabla `comercios` con sus `promociones` y filtrar por radio
      const { data: allComercios, error: tableError } = await supabase
        .from('comercios')
        .select('*, promociones(*)');

      if (tableError || !Array.isArray(allComercios)) {
        setNearbyComercios([]);
        return;
      }

      const now = new Date();
      const mapped = allComercios
        .map((com) => {
          const coords =
            com.lat != null && com.lng != null
              ? { lat: Number(com.lat), lng: Number(com.lng) }
              : parseUbicacionCoords(com.ubicacion);

          if (!coords) return null;

          const distancia = calculateDistanceMeters(
            neighborPosition.lat,
            neighborPosition.lng,
            coords.lat,
            coords.lng
          );

          if (distancia > searchRadiusMeters) return null;

          const promosVigentes = (com.promociones || []).filter((p) => {
            const notExpired = !p.vence_el || new Date(p.vence_el) > now;
            const hasStock =
              p.stock_disponible == null || Number(p.stock_disponible) > 0;
            return notExpired && hasStock;
          });

          return {
            comercio_id: com.id,
            nombre: com.nombre,
            rubro: com.rubro,
            telefono_whatsapp: com.telefono_whatsapp,
            ubicacion: com.ubicacion,
            lat: coords.lat,
            lng: coords.lng,
            distancia_metros: distancia,
            promos_activas_count: promosVigentes.length,
            promos_activas: promosVigentes,
          };
        })
        .filter(Boolean);

      setNearbyComercios(mapped);
    } catch {
      setNearbyComercios([]);
    }
  }, [neighborPosition.lat, neighborPosition.lng, searchRadiusMeters]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (!cancelled) {
        fetchNearbyComerciosForMap();
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [fetchNearbyComerciosForMap, refreshKey]);

  // Unificar comercios cercanos con promociones devueltas por obtener_promos_cercanas
  const mapMarkers = useMemo(() => {
    const byComercio = new Map();

    for (const com of nearbyComercios) {
      const key = String(com.comercio_id || com.id || com.nombre);
      byComercio.set(key, {
        ...com,
        promos_activas: Array.isArray(com.promos_activas)
          ? [...com.promos_activas]
          : [],
      });
    }

    for (const promo of nearbyPromos) {
      const key = String(
        promo.comercio_id ||
          promo.comercios?.id ||
          promo.comercio_nombre ||
          promo.id
      );
      const existing = byComercio.get(key);
      if (existing) {
        const alreadyIncluded = existing.promos_activas.some(
          (p) => String(p.id) === String(promo.id)
        );
        if (!alreadyIncluded && promo.titulo) {
          existing.promos_activas.push(promo);
        }
        existing.promos_activas_count = Math.max(
          Number(existing.promos_activas_count) || 0,
          existing.promos_activas.length
        );
        if (existing.lat == null && promo.comercio_lat != null) {
          existing.lat = promo.comercio_lat;
          existing.lng = promo.comercio_lng;
        }
      } else {
        byComercio.set(key, {
          comercio_id: promo.comercio_id,
          nombre:
            promo.comercio_nombre ||
            promo.nombre_comercio ||
            promo.comercios?.nombre ||
            'Comercio',
          rubro:
            promo.comercio_rubro ||
            promo.rubro ||
            promo.comercios?.rubro ||
            'Comercio',
          telefono_whatsapp:
            promo.comercio_telefono ||
            promo.telefono_whatsapp ||
            promo.comercios?.telefono_whatsapp ||
            '',
          lat: promo.comercio_lat ?? promo.lat ?? null,
          lng: promo.comercio_lng ?? promo.lng ?? null,
          ubicacion: promo.comercio_ubicacion ?? promo.ubicacion ?? null,
          distancia_metros: promo.distancia_metros ?? promo.distancia ?? null,
          promos_activas_count: 1,
          promos_activas: [promo],
        });
      }
    }

    return Array.from(byComercio.values());
  }, [nearbyComercios, nearbyPromos]);

  // Consulta las ofertas guardadas por el usuario en `favoritos_usuario`
  const fetchUserFavoritos = useCallback(async (userId) => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setFavoritos([]);
      return;
    }

    setLoadingFavoritos(true);
    try {
      const { data, error } = await supabase
        .from('favoritos_usuario')
        .select('promocion_id, promociones(*, comercios(*))')
        .eq('user_id', userId);

      if (!error && Array.isArray(data)) {
        setFavoritos(data);
      } else {
        setFavoritos([]);
      }
    } catch {
      setFavoritos([]);
    } finally {
      setLoadingFavoritos(false);
    }
  }, []);

  // Toggle de favorito en `favoritos_usuario`
  const handleToggleFavorite = async (promoId, promoTitulo = 'la oferta') => {
    if (!session?.user?.id) {
      setIsAuthModalOpen(true);
      showTemporaryFeedback(
        'info',
        'Inicia sesión o crea tu cuenta gratis para guardar tus promociones favoritas.'
      );
      return;
    }

    if (!supabase || promoId == null) return;

    const alreadySaved = favoritos.some(
      (fav) => String(fav.promocion_id) === String(promoId)
    );

    setTogglingFavoriteId(promoId);
    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from('favoritos_usuario')
          .delete()
          .eq('user_id', session.user.id)
          .eq('promocion_id', promoId);

        if (error) throw error;

        setFavoritos((prev) =>
          prev.filter((fav) => String(fav.promocion_id) !== String(promoId))
        );
        showTemporaryFeedback(
          'success',
          `Se quitó "${promoTitulo}" de tus ofertas guardadas.`
        );
      } else {
        const { error } = await supabase.from('favoritos_usuario').insert([
          {
            user_id: session.user.id,
            promocion_id: promoId,
          },
        ]);

        if (error) throw error;

        await fetchUserFavoritos(session.user.id);
        showTemporaryFeedback(
          'success',
          `Guardaste "${promoTitulo}" en Mis Ofertas Guardadas.`
        );
      }
    } catch (err) {
      showTemporaryFeedback(
        'error',
        err.message || 'No se pudo actualizar tus favoritos.'
      );
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  // Consulta todas las promociones de un comercio específico (activas e historial)
  const fetchPromosForComercio = useCallback(async (currentComercioId) => {
    if (!currentComercioId || !isSupabaseConfigured || !supabase) return;

    setLoadingComercioPromosId(currentComercioId);
    try {
      let { data, error } = await supabase
        .from('promociones')
        .select('*')
        .eq('comercio_id', currentComercioId)
        .order('created_at', { ascending: false });

      if (error) {
        const fallback = await supabase
          .from('promociones')
          .select('*')
          .eq('comercio_id', currentComercioId)
          .order('creada_el', { ascending: false });
        data = fallback.data;
      }

      if (Array.isArray(data)) {
        setComercios((prev) =>
          prev.map((com) =>
            com.id === currentComercioId ? { ...com, promociones: data } : com
          )
        );
      }
    } finally {
      setLoadingComercioPromosId(null);
    }
  }, []);

  const fetchUserComercios = useCallback(async (userId) => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setComercios([]);
      return;
    }

    setLoadingComercios(true);
    try {
      const { data, error } = await supabase
        .from('comercios')
        .select('*, promociones(*)')
        .eq('user_id', userId)
        .order('creado_el', { ascending: false });

      if (!error && Array.isArray(data)) {
        setComercios(data);
        if (data.length > 0) {
          setExpandedComercios((prev) =>
            Object.keys(prev).length === 0 ? { [data[0].id]: true } : prev
          );
        }
      } else {
        setComercios([]);
      }
    } catch {
      setComercios([]);
    } finally {
      setLoadingComercios(false);
    }
  }, []);

  const fetchUserProfileName = useCallback(async (user) => {
    if (!user?.id || !isSupabaseConfigured || !supabase) {
      setProfileNameDb('');
      return;
    }

    const metaName =
      user.user_metadata?.full_name ||
      user.user_metadata?.username ||
      user.user_metadata?.nombre ||
      '';
    if (metaName) {
      setProfileNameDb(metaName);
      return;
    }

    try {
      const { data } = await supabase
        .from('perfiles')
        .select('nombre, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.nombre || data?.full_name) {
        setProfileNameDb(data.nombre || data.full_name);
      }
    } catch {
      // Ignorar si no existe tabla perfiles adicional
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user?.id) {
        fetchUserComercios(currentSession.user.id);
        fetchUserFavoritos(currentSession.user.id);
        fetchUserProfileName(currentSession.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        fetchUserComercios(newSession.user.id);
        fetchUserFavoritos(newSession.user.id);
        fetchUserProfileName(newSession.user);
      } else {
        setComercios([]);
        setFavoritos([]);
        setProfileNameDb('');
        setIsPromoModalOpen(false);
        setActiveTab((prev) => (prev === 'comercios' ? 'explorar' : prev));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserComercios, fetchUserFavoritos, fetchUserProfileName]);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (session?.user?.id) {
      if (tab === 'perfil') {
        fetchUserFavoritos(session.user.id);
        fetchUserComercios(session.user.id);
      } else if (tab === 'comercios') {
        fetchUserComercios(session.user.id);
      }
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setComercios([]);
    setFavoritos([]);
    setIsPromoModalOpen(false);
    setActiveTab('explorar');
  };

  const handleBusinessRegistered = (nuevoComercio) => {
    setComercios((prev) => [nuevoComercio, ...prev]);
    setExpandedComercios((prev) => ({ ...prev, [nuevoComercio.id]: true }));
    setComercioPromoTab((prev) => ({ ...prev, [nuevoComercio.id]: 'activas' }));
    setActiveTab('comercios');
    showTemporaryFeedback(
      'success',
      `El local "${nuevoComercio.nombre}" fue vinculado a tu cuenta.`
    );
  };

  const handleOpenNewPromo = (comercioId = '') => {
    setPromoModalComercioId(comercioId || comercios[0]?.id || '');
    setIsPromoModalOpen(true);
  };

  const handlePromoCreated = (nuevaPromo) => {
    setRefreshKey((prev) => prev + 1);
    if (nuevaPromo?.comercio_id) {
      fetchPromosForComercio(nuevaPromo.comercio_id);
      setExpandedComercios((prev) => ({
        ...prev,
        [nuevaPromo.comercio_id]: true,
      }));
      setComercioPromoTab((prev) => ({
        ...prev,
        [nuevaPromo.comercio_id]: 'activas',
      }));
    } else if (session?.user?.id) {
      fetchUserComercios(session.user.id);
    }
    showTemporaryFeedback('success', 'Promoción publicada y activa en el barrio.');
    setTimeout(() => {
      setIsPromoModalOpen(false);
    }, 700);
  };

  const handlePromoRepublished = (updatedPromo) => {
    const comercioId = updatedPromo?.comercio_id;

    setComercios((prev) =>
      prev.map((com) => {
        if (com.id !== comercioId) return com;
        return {
          ...com,
          promociones: (com.promociones || []).map((p) =>
            p.id === updatedPromo.id ? { ...p, ...updatedPromo } : p
          ),
        };
      })
    );

    if (comercioId) {
      setComercioPromoTab((prev) => ({ ...prev, [comercioId]: 'activas' }));
      fetchPromosForComercio(comercioId);
    }

    setRefreshKey((prev) => prev + 1);
    showTemporaryFeedback(
      'success',
      `La promoción "${updatedPromo.titulo}" volvió a activarse y ya figura en Promociones Activas.`
    );
  };

  // "Dar de baja" (Archivar / Pausar): actualiza vence_el a la fecha/hora actual sin borrar el registro
  const handleArchivePromo = async (promo) => {
    if (!supabase || !promo?.id) return;

    const promoId = promo.id;
    setArchivingPromoId(promoId);

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('promociones')
        .update({ vence_el: nowIso })
        .eq('id', promoId);

      if (error) {
        throw error;
      }

      setComercios((prev) =>
        prev.map((com) => ({
          ...com,
          promociones: (com.promociones || []).map((p) =>
            p.id === promoId ? { ...p, vence_el: nowIso } : p
          ),
        }))
      );

      if (promo.comercio_id) {
        fetchPromosForComercio(promo.comercio_id);
      }

      setRefreshKey((prev) => prev + 1);
      showTemporaryFeedback(
        'success',
        'Promoción dada de baja y archivada en el historial'
      );
    } catch (err) {
      showTemporaryFeedback(
        'error',
        err.message || 'No se pudo dar de baja la promoción.'
      );
    } finally {
      setArchivingPromoId(null);
    }
  };

  // "Eliminar definitivamente": borra el registro de la tabla 'promociones'
  const confirmDeletePromo = async () => {
    if (!supabase || !promoToDelete?.id) return;

    const { id: promoId, titulo: promoTitulo } = promoToDelete;
    setDeletingPromoId(promoId);

    try {
      const { error } = await supabase
        .from('promociones')
        .delete()
        .eq('id', promoId);

      if (error) {
        throw error;
      }

      setComercios((prev) =>
        prev.map((com) => ({
          ...com,
          promociones: (com.promociones || []).filter((p) => p.id !== promoId),
        }))
      );
      setRefreshKey((prev) => prev + 1);
      setPromoToDelete(null);
      showTemporaryFeedback(
        'success',
        `La promoción "${promoTitulo}" fue eliminada definitivamente.`
      );
    } catch (err) {
      showTemporaryFeedback(
        'error',
        err.message || 'No se pudo eliminar la promoción.'
      );
    } finally {
      setDeletingPromoId(null);
    }
  };

  const toggleComercioPromos = (comercioId) => {
    const willExpand = !expandedComercios[comercioId];
    setExpandedComercios((prev) => ({
      ...prev,
      [comercioId]: willExpand,
    }));

    if (willExpand) {
      fetchPromosForComercio(comercioId);
    }
  };

  const selectSubTabForComercio = (comercioId, subTab) => {
    setComercioPromoTab((prev) => ({
      ...prev,
      [comercioId]: subTab,
    }));
  };

  const favoriteIds = useMemo(
    () => favoritos.map((f) => f.promocion_id),
    [favoritos]
  );

  const userDisplayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.username ||
    session?.user?.user_metadata?.nombre ||
    profileNameDb ||
    '';

  const totalPromosActivasUsuario = comercios.reduce((acc, com) => {
    const activas = (com.promociones || []).filter(isPromoActive).length;
    return acc + activas;
  }, 0);

  return (
    <div className="min-h-full bg-[#FAFAF9] text-stone-900 flex flex-col">
      {/* Cabecera translúcida y Barra de Pestañas */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#FAFAF9]/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            {/* Logo tipográfico nítido */}
            <div
              onClick={() => handleSelectTab('explorar')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition-all duration-200">
                <MapPin className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="font-display text-lg font-extrabold tracking-tight text-stone-900 sm:text-xl leading-none">
                  Ofert<span className="text-emerald-600">Ar</span>
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 align-middle" />
                </h1>
                <p className="text-[11px] font-medium text-stone-500 mt-0.5">
                  Promociones barriales en tiempo real
                </p>
              </div>
            </div>

            {/* Acciones rápidas derechas */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {!session ? (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="font-display inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                >
                  <LogIn className="h-4 w-4" strokeWidth={1.75} />
                  Ingresar
                </button>
              ) : (
                <>
                  {comercios.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setIsRegisterBusinessOpen(true)}
                      className="font-display inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} />
                      Activar Negocio
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSelectTab('perfil')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-700 border border-stone-200/80 shadow-2xs hover:border-stone-300 transition-all duration-200 cursor-pointer"
                  >
                    <User
                      className="h-4 w-4 text-emerald-600"
                      strokeWidth={1.75}
                    />
                    <span className="max-w-[160px] sm:max-w-none truncate">
                      {userDisplayName || session.user.email}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Barra de navegación por Pestañas (Tabs) */}
          <nav
            className="flex items-center gap-1 border-t border-stone-200/70 pt-1 overflow-x-auto"
            aria-label="Secciones principales"
          >
            <button
              type="button"
              onClick={() => handleSelectTab('explorar')}
              className={`font-display inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === 'explorar'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'
              }`}
            >
              <Compass className="h-4 w-4" strokeWidth={1.75} />
              Explorar
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('perfil')}
              className={`font-display inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === 'perfil'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'
              }`}
            >
              <User className="h-4 w-4" strokeWidth={1.75} />
              Mi Perfil
              {session && favoritos.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/60 px-2 py-0.5 text-xs font-bold text-rose-700 tabular-nums">
                  <Heart
                    className="h-3 w-3 fill-rose-500 text-rose-500"
                    strokeWidth={1.75}
                  />
                  {favoritos.length}
                </span>
              )}
            </button>

            {session && (
              <button
                type="button"
                onClick={() => handleSelectTab('comercios')}
                className={`font-display inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  activeTab === 'comercios'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'
                }`}
              >
                <Store className="h-4 w-4" strokeWidth={1.75} />
                Mis Comercios
                <span className="ml-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-xs font-bold text-emerald-700 tabular-nums">
                  {comercios.length}
                </span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Notificación flotante / Banner de confirmación */}
      {feedbackBanner && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              feedbackBanner.type === 'error'
                ? 'border-red-200/80 bg-red-50 text-red-800'
                : feedbackBanner.type === 'info'
                  ? 'border-amber-200/80 bg-amber-50 text-amber-900'
                  : 'border-emerald-200/80 bg-emerald-50 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackBanner.type === 'error' ? (
                <AlertCircle
                  className="h-5 w-5 text-red-600 shrink-0"
                  strokeWidth={1.75}
                />
              ) : (
                <CheckCircle2
                  className="h-5 w-5 text-emerald-600 shrink-0"
                  strokeWidth={1.75}
                />
              )}
              <span className="font-semibold">{feedbackBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs font-semibold underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Contenido Principal según Pestaña Activa */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* PESTAÑA 1: EXPLORAR */}
        {activeTab === 'explorar' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-stone-200/80 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-stone-900 flex items-center gap-2">
                      <Compass
                        className="h-5 w-5 text-emerald-600"
                        strokeWidth={1.75}
                      />
                      Mapa y Radio de Búsqueda
                    </h2>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {geoStatus === 'activa'
                        ? 'Ubicación actual detectada por GPS.'
                        : geoStatus === 'detectando'
                          ? 'Obteniendo tu ubicación actual...'
                          : 'Usando ubicación predeterminada (Obelisco / CABA).'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={requestUserGeolocation}
                    title="Centrar en mi ubicación actual"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/80 bg-[#FAFAF9] px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-100 transition-all duration-200 cursor-pointer shrink-0"
                  >
                    <LocateFixed
                      className="h-4 w-4 text-emerald-600"
                      strokeWidth={1.75}
                    />
                    Mi ubicación
                  </button>
                </div>

                {/* Selector de Radio: 500m, 1 km, 3 km, 5 km */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                    <Radio
                      className="h-4 w-4 text-emerald-600"
                      strokeWidth={1.75}
                    />
                    Radio de búsqueda:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {SEARCH_RADII.map((r) => {
                      const active = searchRadiusMeters === r.meters;
                      return (
                        <button
                          key={r.meters}
                          type="button"
                          onClick={() => setSearchRadiusMeters(r.meters)}
                          className={`rounded-xl border py-1.5 text-xs font-semibold tabular-nums transition-all duration-200 cursor-pointer ${
                            active
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600/15'
                              : 'border-stone-200/80 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <LocationPicker
                  position={neighborPosition}
                  onChange={(coords) => {
                    setNeighborPosition(coords);
                    setGeoStatus('manual');
                  }}
                  radiusMeters={searchRadiusMeters}
                  markers={mapMarkers}
                  showLegend={true}
                  onOpenCanjeModal={(promo) => setPromoForCanje(promo)}
                  helperText="Haz clic en el mapa o arrastra tu pin para cambiar el origen"
                />
              </div>
            </div>

            <div className="lg:col-span-7">
              <PromoList
                userLat={neighborPosition.lat}
                userLng={neighborPosition.lng}
                selectedRadio={searchRadiusMeters}
                refreshKey={refreshKey}
                onPromosLoaded={setNearbyPromos}
                favoriteIds={favoriteIds}
                togglingFavoriteId={togglingFavoriteId}
                onToggleFavorite={handleToggleFavorite}
                onOpenCanjeModal={(promo) => setPromoForCanje(promo)}
              />
            </div>
          </div>
        )}

        {/* PESTAÑA 2: MI PERFIL */}
        {activeTab === 'perfil' && (
          <div className="mx-auto max-w-4xl space-y-6">
            {!session ? (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-8 text-center shadow-sm space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <User className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-stone-900">
                    Inicia sesión en tu cuenta
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Accede con tu correo para guardar tus ofertas favoritas, administrar tu perfil o activar tu comercio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="font-display inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                >
                  <LogIn className="h-4 w-4" strokeWidth={1.75} />
                  Ingresar / Crear Cuenta
                </button>
              </div>
            ) : (
              <>
                {/* Encabezado de Mi Perfil y Acciones de Cuenta */}
                <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/80 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                        <User className="h-8 w-8" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Vecino / Cuenta activa
                        </span>
                        <h2 className="font-display text-xl font-bold text-stone-900 mt-1">
                          {userDisplayName || 'Mi Perfil'}
                        </h2>
                        <p className="text-xs text-stone-600">
                          {session.user.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200/90 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-all duration-200 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.75} />
                      Cerrar Sesión
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1">
                      <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                        <User
                          className="h-4 w-4 text-emerald-600"
                          strokeWidth={1.75}
                        />
                        Nombre de perfil
                      </span>
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {userDisplayName ||
                          session.user.email?.split('@')[0] ||
                          'Usuario'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1">
                      <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                        <Mail
                          className="h-4 w-4 text-emerald-600"
                          strokeWidth={1.75}
                        />
                        Correo electrónico registrado
                      </span>
                      <p className="text-sm font-semibold text-stone-900 break-all">
                        {session.user.email}
                      </p>
                    </div>

                    <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 space-y-1">
                      <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                        <Calendar
                          className="h-4 w-4 text-emerald-600"
                          strokeWidth={1.75}
                        />
                        Fecha de registro
                      </span>
                      <p className="text-sm font-semibold text-stone-900 tabular-nums">
                        {session.user.created_at
                          ? new Date(session.user.created_at).toLocaleDateString(
                              'es-AR',
                              {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              }
                            )
                          : 'Reciente'}
                      </p>
                    </div>
                  </div>

                  {/* Banner para activar negocio si aún no tiene local, o resumen comercial */}
                  {comercios.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 max-w-lg">
                        <p className="font-display text-sm font-bold text-stone-900 flex items-center gap-1.5">
                          <Store
                            className="h-4 w-4 text-emerald-600"
                            strokeWidth={1.75}
                          />
                          ¿Tienes un comercio o emprendimiento en el barrio?
                        </p>
                        <p className="text-xs text-stone-600">
                          Activa tu perfil comercial gratis, ubica tu local en el mapa y publica promociones estándar o relámpago para tus vecinos.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsRegisterBusinessOpen(true)}
                        className="font-display inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        Activar mi Negocio / Registrar Comercio
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-stone-200/80 bg-[#FAFAF9] p-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="font-display text-sm font-bold text-stone-900">
                          Resumen comercial de tu cuenta
                        </p>
                        <p className="text-xs text-stone-600 tabular-nums">
                          Tienes{' '}
                          <strong className="text-emerald-700">
                            {comercios.length}{' '}
                            {comercios.length === 1
                              ? 'local registrado'
                              : 'locales registrados'}
                          </strong>{' '}
                          y{' '}
                          <strong className="text-emerald-700">
                            {totalPromosActivasUsuario}{' '}
                            {totalPromosActivasUsuario === 1
                              ? 'promoción activa'
                              : 'promociones activas'}
                          </strong>
                          .
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRegisterBusinessOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer"
                        >
                          <Plus className="h-4 w-4" strokeWidth={1.75} />
                          Registrar otro comercio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectTab('comercios')}
                          className="font-display inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                        >
                          <Store className="h-4 w-4" strokeWidth={1.75} />
                          Ir a Mis Comercios
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sección interna: Mis Ofertas Guardadas */}
                <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-stone-900 flex items-center gap-2">
                        <Heart
                          className="h-5 w-5 fill-rose-500 text-rose-500"
                          strokeWidth={1.75}
                        />
                        Mis Ofertas Guardadas
                      </h3>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Accede rápido a las promociones que marcaste como favoritas en tu barrio.
                      </p>
                    </div>

                    <span className="rounded-full bg-rose-50 border border-rose-200/60 px-3 py-1 text-xs font-bold text-rose-700 tabular-nums">
                      {favoritos.length}{' '}
                      {favoritos.length === 1 ? 'guardada' : 'guardadas'}
                    </span>
                  </div>

                  {loadingFavoritos ? (
                    <div className="flex items-center justify-center py-10 text-stone-600 gap-2">
                      <Loader2
                        className="h-5 w-5 animate-spin text-emerald-600"
                        strokeWidth={1.75}
                      />
                      <span className="text-sm">
                        Cargando tus ofertas guardadas...
                      </span>
                    </div>
                  ) : favoritos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAFAF9] p-10 text-center space-y-3">
                      <Heart
                        className="mx-auto h-9 w-9 text-stone-400"
                        strokeWidth={1.75}
                      />
                      <div>
                        <p className="font-display text-sm font-bold text-stone-900">
                          Todavía no tienes ofertas guardadas
                        </p>
                        <p className="text-xs text-stone-600 mt-1">
                          Toca el ícono de corazón en cualquier tarjeta de la pestaña Explorar para guardarla aquí.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectTab('explorar')}
                        className="font-display inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                      >
                        <Compass className="h-4 w-4" strokeWidth={1.75} />
                        Explorar promociones cercanas
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {favoritos.map((fav) => {
                        const promo = Array.isArray(fav.promociones)
                          ? fav.promociones[0]
                          : fav.promociones;

                        if (!promo) return null;

                        const comercio = Array.isArray(promo.comercios)
                          ? promo.comercios[0]
                          : promo.comercios;

                        const vigente = isPromoActive(promo);
                        const remaining = formatRemainingTime(promo.vence_el);
                        const waUrl = buildWhatsAppUrl(
                          comercio?.telefono_whatsapp,
                          promo.titulo,
                          comercio?.nombre
                        );

                        return (
                          <article
                            key={fav.promocion_id}
                            className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 ${
                              vigente
                                ? 'border-stone-200/80 bg-white shadow-sm hover:border-stone-300'
                                : 'border-stone-200/80 bg-stone-100/70 opacity-85'
                            }`}
                          >
                            <div>
                              <div className="relative">
                                {promo.imagen_url ? (
                                  <img
                                    src={promo.imagen_url}
                                    alt={promo.titulo}
                                    className={`h-36 w-full object-cover border-b border-stone-100 ${
                                      !vigente ? 'grayscale' : ''
                                    }`}
                                  />
                                ) : (
                                  <div className="flex h-32 w-full items-center justify-center bg-stone-100/80 border-b border-stone-200/60 text-stone-400">
                                    <ShoppingBag
                                      className="h-8 w-8 opacity-70"
                                      strokeWidth={1.75}
                                    />
                                  </div>
                                )}

                                {promo.es_flash && vigente && (
                                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                                    <Zap
                                      className="h-3 w-3"
                                      strokeWidth={1.75}
                                    />
                                    FLASH
                                  </span>
                                )}

                                <button
                                  type="button"
                                  disabled={
                                    String(togglingFavoriteId) ===
                                    String(fav.promocion_id)
                                  }
                                  onClick={() =>
                                    handleToggleFavorite(
                                      fav.promocion_id,
                                      promo.titulo
                                    )
                                  }
                                  title="Quitar de guardados"
                                  className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50/95 text-rose-500 shadow-xs hover:bg-rose-100 transition-all duration-200 cursor-pointer"
                                >
                                  <Heart
                                    className="h-4 w-4 fill-rose-500 text-rose-500"
                                    strokeWidth={1.75}
                                  />
                                </button>
                              </div>

                              <div className="p-4 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 font-medium text-emerald-700 capitalize">
                                    <Tag
                                      className="h-3 w-3"
                                      strokeWidth={1.75}
                                    />
                                    {comercio?.rubro?.replace('_', ' ') ||
                                      'Comercio'}
                                  </span>

                                  {vigente ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 font-semibold text-amber-800 tabular-nums">
                                      <Clock
                                        className="h-3 w-3"
                                        strokeWidth={1.75}
                                      />
                                      {remaining}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-stone-200 px-2.5 py-0.5 font-bold text-stone-600">
                                      Oferta finalizada
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-display text-sm font-bold text-stone-900 line-clamp-2">
                                  {promo.titulo}
                                </h4>

                                {promo.descripcion && (
                                  <p className="text-xs text-stone-600 line-clamp-2">
                                    {promo.descripcion}
                                  </p>
                                )}

                                <p className="flex items-center gap-1.5 text-xs text-stone-600">
                                  <Store
                                    className="h-3.5 w-3.5 text-stone-400 shrink-0"
                                    strokeWidth={1.75}
                                  />
                                  <span className="font-semibold text-stone-800 truncate">
                                    {comercio?.nombre || 'Comercio del barrio'}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="border-t border-stone-100 p-3.5 flex flex-wrap items-center gap-2">
                              {vigente && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPromoForCanje({
                                      ...promo,
                                      comercios: comercio,
                                    })
                                  }
                                  className="font-display flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                                >
                                  <Ticket
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                  Canjear en local
                                </button>
                              )}

                              {vigente && waUrl ? (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200"
                                >
                                  <MessageCircle
                                    className="h-3.5 w-3.5 text-emerald-600"
                                    strokeWidth={1.75}
                                  />
                                  WhatsApp
                                </a>
                              ) : (
                                !vigente && (
                                  <span className="flex-1 text-center text-xs font-medium text-stone-400 py-1.5">
                                    Esta promoción ya finalizó
                                  </span>
                                )
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleFavorite(
                                    fav.promocion_id,
                                    promo.titulo
                                  )
                                }
                                className="rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:border-stone-300 hover:text-rose-600 transition-all duration-200 cursor-pointer"
                              >
                                Quitar
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* PESTAÑA 3: MIS COMERCIOS (Solo autenticado) */}
        {activeTab === 'comercios' && session && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Store
                    className="h-5 w-5 text-emerald-600"
                    strokeWidth={1.75}
                  />
                  Mis Comercios y Sucursales
                </h2>
                <p className="text-sm text-stone-600 mt-0.5">
                  Administra tus locales, valida PINs en mostrador y consulta las métricas de conversión.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterBusinessOpen(true)}
                  className="font-display inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Agregar otro local
                </button>
              </div>
            </div>

            {loadingComercios ? (
              <div className="flex items-center justify-center rounded-2xl border border-stone-200/80 bg-white p-12 text-stone-600 gap-2">
                <Loader2
                  className="h-5 w-5 animate-spin text-emerald-600"
                  strokeWidth={1.75}
                />
                <span className="text-sm font-medium">
                  Cargando tus comercios y promociones...
                </span>
              </div>
            ) : comercios.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center space-y-4 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Store className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="font-display text-lg font-bold text-stone-900">
                    Aún no tienes locales vinculados
                  </h3>
                  <p className="mt-1 text-sm text-stone-600">
                    Registra tu primer comercio o sucursal en el mapa para comenzar a publicar promociones para tus vecinos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegisterBusinessOpen(true)}
                  className="font-display inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Registrar mi primer local
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {comercios.map((loc) => {
                  const todasLasPromos = loc.promociones || [];
                  const promosActivas = todasLasPromos.filter(
                    (promo) => new Date(promo.vence_el) > new Date()
                  );
                  const promosVencidas = todasLasPromos.filter(
                    (promo) => new Date(promo.vence_el) <= new Date()
                  );
                  const isExpanded = Boolean(expandedComercios[loc.id]);
                  const currentSubTab = comercioPromoTab[loc.id] || 'activas';

                  return (
                    <div
                      key={loc.id}
                      className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm hover:border-stone-300 transition-all duration-200"
                    >
                      <div className="p-6 flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 tabular-nums">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 capitalize">
                              <Tag className="h-3 w-3" strokeWidth={1.75} />
                              {loc.rubro?.replace('_', ' ') || 'Comercio'}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
                              {promosActivas.length}{' '}
                              {promosActivas.length === 1
                                ? 'activa'
                                : 'activas'}
                            </span>

                            {promosVencidas.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                                <History
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                />
                                {promosVencidas.length} en historial
                              </span>
                            )}
                          </div>

                          <h3 className="font-display text-lg font-bold text-stone-900">
                            {loc.nombre}
                          </h3>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <MapPin
                                className="h-3.5 w-3.5 text-stone-400"
                                strokeWidth={1.75}
                              />
                              {formatUbicacionDisplay(loc)}
                            </span>

                            {loc.telefono_whatsapp && (
                              <span className="inline-flex items-center gap-1">
                                <Phone
                                  className="h-3.5 w-3.5 text-stone-400"
                                  strokeWidth={1.75}
                                />
                                +{loc.telefono_whatsapp}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedComercios((prev) => ({
                                ...prev,
                                [loc.id]: true,
                              }));
                              selectSubTabForComercio(loc.id, 'metricas');
                              fetchPromosForComercio(loc.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/80 transition-all duration-200 cursor-pointer"
                          >
                            <BarChart3
                              className="h-4 w-4 text-emerald-700"
                              strokeWidth={1.75}
                            />
                            Validar PIN / Métricas BI
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleComercioPromos(loc.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer tabular-nums"
                          >
                            {isExpanded ? (
                              <ChevronUp
                                className="h-4 w-4"
                                strokeWidth={1.75}
                              />
                            ) : (
                              <ChevronDown
                                className="h-4 w-4"
                                strokeWidth={1.75}
                              />
                            )}
                            Promociones ({todasLasPromos.length})
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenNewPromo(loc.id)}
                            className="font-display inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            Nueva Promo
                          </button>
                        </div>
                      </div>

                      {/* Vista de detalle con pestañas internas */}
                      {isExpanded && (
                        <div className="border-t border-stone-200/80 bg-[#FAFAF9] px-6 py-4 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5">
                            <div className="flex flex-wrap items-center gap-2 tabular-nums">
                              <button
                                type="button"
                                onClick={() =>
                                  selectSubTabForComercio(loc.id, 'activas')
                                }
                                className={`font-display inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                  currentSubTab === 'activas'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-white text-stone-600 border border-stone-200/80 hover:border-stone-300 hover:text-stone-900'
                                }`}
                              >
                                <Sparkles
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                                Promociones Activas ({promosActivas.length})
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  selectSubTabForComercio(loc.id, 'vencidas')
                                }
                                className={`font-display inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                  currentSubTab === 'vencidas'
                                    ? 'bg-stone-800 text-white shadow-xs'
                                    : 'bg-white text-stone-600 border border-stone-200/80 hover:border-stone-300 hover:text-stone-900'
                                }`}
                              >
                                <History
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                                Historial / Vencidas ({promosVencidas.length})
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  selectSubTabForComercio(loc.id, 'metricas')
                                }
                                className={`font-display inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                  currentSubTab === 'metricas'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-white text-stone-600 border border-stone-200/80 hover:border-stone-300 hover:text-stone-900'
                                }`}
                              >
                                <BarChart3
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                                Canjes PIN y Métricas BI
                              </button>
                            </div>

                            {loadingComercioPromosId === loc.id && (
                              <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                                <Loader2
                                  className="h-3.5 w-3.5 animate-spin text-emerald-600"
                                  strokeWidth={1.75}
                                />
                                Sincronizando...
                              </span>
                            )}
                          </div>

                          {/* SUB-PESTAÑA 1: PROMOCIONES ACTIVAS */}
                          {currentSubTab === 'activas' && (
                            <>
                              {promosActivas.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs text-stone-600">
                                  Esta sucursal no tiene promociones activas en este momento.{' '}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNewPromo(loc.id)}
                                    className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                                  >
                                    Publicar una nueva oferta
                                  </button>
                                  {promosVencidas.length > 0 && (
                                    <>
                                      {' '}
                                      o{' '}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          selectSubTabForComercio(
                                            loc.id,
                                            'vencidas'
                                          )
                                        }
                                        className="font-semibold text-stone-800 underline cursor-pointer"
                                      >
                                        republicar desde el historial ({promosVencidas.length})
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {promosActivas.map((promo) => (
                                    <div
                                      key={promo.id}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-xs"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        {promo.imagen_url ? (
                                          <img
                                            src={promo.imagen_url}
                                            alt={promo.titulo}
                                            className="h-12 w-12 rounded-lg object-cover border border-stone-200/80 shrink-0"
                                          />
                                        ) : (
                                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                            <Sparkles
                                              className="h-5 w-5"
                                              strokeWidth={1.75}
                                            />
                                          </div>
                                        )}

                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                              Activa
                                            </span>
                                            {promo.es_flash && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                <Zap
                                                  className="h-3 w-3"
                                                  strokeWidth={1.75}
                                                />
                                                Flash
                                              </span>
                                            )}
                                          </div>
                                          <p className="font-display text-sm font-bold text-stone-900 truncate mt-0.5">
                                            {promo.titulo}
                                          </p>
                                          {promo.descripcion && (
                                            <p className="text-xs text-stone-600 truncate">
                                              {promo.descripcion}
                                            </p>
                                          )}
                                          <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1 mt-0.5 tabular-nums">
                                            <Clock
                                              className="h-3 w-3"
                                              strokeWidth={1.75}
                                            />
                                            Vence:{' '}
                                            {new Date(
                                              promo.vence_el
                                            ).toLocaleString('es-AR', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={archivingPromoId === promo.id}
                                        onClick={() => handleArchivePromo(promo)}
                                        title="Pausar y archivar en el historial"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 disabled:opacity-50 transition-all duration-200 shrink-0 cursor-pointer"
                                      >
                                        {archivingPromoId === promo.id ? (
                                          <Loader2
                                            className="h-3.5 w-3.5 animate-spin"
                                            strokeWidth={1.75}
                                          />
                                        ) : (
                                          <Archive
                                            className="h-3.5 w-3.5"
                                            strokeWidth={1.75}
                                          />
                                        )}
                                        Dar de baja
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* SUB-PESTAÑA 2: HISTORIAL / VENCIDAS */}
                          {currentSubTab === 'vencidas' && (
                            <>
                              {promosVencidas.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs text-stone-600">
                                  No hay promociones vencidas en el historial de esta sucursal.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {promosVencidas.map((promo) => (
                                    <div
                                      key={promo.id}
                                      className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200/80 bg-white/80 p-3.5 opacity-85 hover:opacity-100 transition-all duration-200"
                                    >
                                      <div className="flex items-start gap-3 min-w-0">
                                        {promo.imagen_url ? (
                                          <img
                                            src={promo.imagen_url}
                                            alt={promo.titulo}
                                            className="h-12 w-12 rounded-lg object-cover grayscale border border-stone-200/80 shrink-0"
                                          />
                                        ) : (
                                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100 text-stone-500 border border-stone-200/60 shrink-0">
                                            <History
                                              className="h-5 w-5"
                                              strokeWidth={1.75}
                                            />
                                          </div>
                                        )}

                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2 tabular-nums">
                                            <span className="inline-flex items-center rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                                              Finalizada
                                            </span>
                                            <span className="text-[11px] text-stone-500">
                                              Venció:{' '}
                                              {new Date(
                                                promo.vence_el
                                              ).toLocaleDateString('es-AR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit',
                                              })}
                                            </span>
                                          </div>

                                          <p className="font-display text-sm font-bold text-stone-800 truncate mt-1">
                                            {promo.titulo}
                                          </p>
                                          {promo.descripcion && (
                                            <p className="text-xs text-stone-500 line-clamp-1">
                                              {promo.descripcion}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-end gap-2 border-t border-stone-200/70 pt-2.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPromoToRepublish(promo)
                                          }
                                          className="font-display inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-all duration-200 cursor-pointer"
                                        >
                                          <RotateCcw
                                            className="h-3.5 w-3.5"
                                            strokeWidth={1.75}
                                          />
                                          Republicar Promo
                                        </button>

                                        <button
                                          type="button"
                                          disabled={deletingPromoId === promo.id}
                                          onClick={() => setPromoToDelete(promo)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-all duration-200 cursor-pointer"
                                        >
                                          <Trash2
                                            className="h-3.5 w-3.5"
                                            strokeWidth={1.75}
                                          />
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* SUB-PESTAÑA 3: PANEL DE CANJES Y MÉTRICAS BI */}
                          {currentSubTab === 'metricas' && (
                            <PanelCanjesYMetricas
                              comercioId={loc.id}
                              comercioNombre={loc.nombre}
                              promociones={todasLasPromos}
                              onPromoUpdated={(id) => {
                                fetchPromosForComercio(id);
                                setRefreshKey((prev) => prev + 1);
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Canje Temporal (PIN de 5 minutos para el vecino) */}
      <ModalCanjeTemporal
        key={
          promoForCanje?.id ||
          promoForCanje?.promo_id ||
          promoForCanje?.promocion_id ||
          'canje-modal'
        }
        isOpen={Boolean(promoForCanje)}
        promo={promoForCanje}
        onClose={() => setPromoForCanje(null)}
      />

      {/* Modal accesible para publicar nueva promoción */}
      {isPromoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="my-8 w-full max-w-xl">
            <BusinessPromoForm
              key={promoModalComercioId || 'default'}
              comercios={comercios}
              initialComercioId={promoModalComercioId}
              onPromoCreated={handlePromoCreated}
              onClose={() => setIsPromoModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Modal para Republicar Promoción Vencida */}
      <RepublishPromoModal
        key={promoToRepublish?.id || 'republish-modal'}
        isOpen={Boolean(promoToRepublish)}
        promo={promoToRepublish}
        onClose={() => setPromoToRepublish(null)}
        onPromoRepublished={handlePromoRepublished}
      />

      {/* Modal de confirmación peligrosa para Eliminar Definitivamente */}
      {promoToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200/60 shrink-0">
                  <Trash2 className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-stone-900">
                    Eliminar definitivamente
                  </h3>
                  <p className="text-xs text-stone-600">
                    Esta acción borrará por completo el registro del historial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromoToDelete(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            <p className="text-sm text-stone-600">
              ¿Estás seguro de que deseas eliminar definitivamente la promoción{' '}
              <strong className="text-stone-900">
                &ldquo;{promoToDelete.titulo}&rdquo;
              </strong>
              ?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200/80">
              <button
                type="button"
                onClick={() => setPromoToDelete(null)}
                className="rounded-xl border border-stone-200/90 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingPromoId === promoToDelete.id}
                onClick={confirmDeletePromo}
                className="font-display inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {deletingPromoId === promoToDelete.id ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    Sí, eliminar definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Modal para Registrar / Agregar otro local */}
      <RegisterBusinessModal
        isOpen={isRegisterBusinessOpen}
        onClose={() => setIsRegisterBusinessOpen(false)}
        session={session}
        onBusinessRegistered={handleBusinessRegistered}
      />

      <footer className="border-t border-stone-200/80 bg-white py-5 text-center text-xs text-stone-500">
        <div className="mx-auto max-w-7xl px-4">
          OfertAr &copy; {new Date().getFullYear()} — Plataforma de promociones barriales.
        </div>
      </footer>
    </div>
  );
}
