import { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import {
  Store,
  Tag,
  MapPin,
  Navigation,
  MessageCircle,
  Ticket,
  Clock,
  Zap,
} from 'lucide-react';
import '../lib/leafletFix';

const DEFAULT_CENTER = [-34.6037, -58.3816]; // Obelisco / CABA

// a) Local SIN promociones activas (promos_activas_count === 0):
// Pin discreto y estático (círculo pizarra sólido con ícono de tienda, sin animación)
function createStaticStoreIcon() {
  return L.divIcon({
    className: 'bg-transparent border-0',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="flex items-center justify-center w-7 h-7 rounded-full bg-slate-600 text-white border-2 border-white shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <path d="M2 7h20"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// b) Local CON promociones activas (promos_activas_count > 0):
// Pin resaltado en color naranja/dorado vibrante con anillo pulsante (animate-ping) y badge numérico
function createActivePromoStoreIcon(promosCount = 1) {
  const safeCount = Math.max(1, Number(promosCount) || 1);
  return L.divIcon({
    className: 'bg-transparent border-0',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <span class="absolute inline-flex h-8 w-8 rounded-full bg-orange-400 opacity-75 animate-ping"></span>
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white border-2 border-white shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
          </svg>
        </div>
        <span class="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-stone-900 px-1 text-[10px] font-extrabold text-white border border-white shadow-2xs tabular-nums">
          ${safeCount}
        </span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -18],
  });
}

function MapFlyToUpdater({ position, flyZoom = 16 }) {
  const map = useMap();
  const prevCoordsRef = useRef(
    position ? `${position.lat},${position.lng}` : null
  );

  useEffect(() => {
    if (position?.lat == null || position?.lng == null) return;
    const key = `${position.lat},${position.lng}`;
    if (prevCoordsRef.current !== key) {
      prevCoordsRef.current = key;
      map.flyTo([position.lat, position.lng], flyZoom, {
        animate: true,
        duration: 1.1,
      });
    }
  }, [map, position?.lat, position?.lng, flyZoom]);

  return null;
}

// Parsea coordenadas desde lat/lng explícitos, WKT POINT(lng lat), GeoJSON o EWKB hex de PostGIS
function parseEwkbHexPoint(hexStr) {
  if (typeof hexStr !== 'string' || hexStr.length < 42) return null;
  const clean = hexStr.trim();
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null;

  try {
    const isLittleEndian = clean.slice(0, 2) === '01';
    // En EWKB Point con SRID (50 bytes = 100 chars hex), X e Y ocupan los últimos 32 caracteres hex (16 bytes)
    const coordHex = clean.slice(-32);
    if (coordHex.length !== 32) return null;

    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = parseInt(coordHex.slice(i * 2, i * 2 + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    const lng = view.getFloat64(0, isLittleEndian);
    const lat = view.getFloat64(8, isLittleEndian);

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
  return null;
}

function extractMarkerCoordinates(item) {
  if (!item) return null;

  const latCandidate =
    item.lat ??
    item.comercio_lat ??
    item.latitud ??
    item.comercios?.lat ??
    null;
  const lngCandidate =
    item.lng ??
    item.comercio_lng ??
    item.longitud ??
    item.comercios?.lng ??
    null;

  if (latCandidate != null && lngCandidate != null) {
    const lat = Number(latCandidate);
    const lng = Number(lngCandidate);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng };
    }
  }

  const rawUbicacion =
    item.ubicacion ??
    item.comercio_ubicacion ??
    item.comercios?.ubicacion ??
    null;

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
    } else {
      const ewkb = parseEwkbHexPoint(rawUbicacion);
      if (ewkb) return ewkb;
    }
  }

  if (
    rawUbicacion &&
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

function extractStoreAddress(item, coords) {
  if (item?.direccion || item?.direccion_referencia) {
    return item.direccion || item.direccion_referencia;
  }
  const rawName =
    item?.nombre || item?.comercio_nombre || item?.comercios?.nombre || '';
  const match = rawName.match(/\(([^)]+)\)$/);
  if (match) {
    return match[1];
  }
  if (coords) {
    return `Ubicación: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  }
  return 'Comercio barrial georreferenciado';
}

function getCleanStoreName(item) {
  const rawName =
    item?.nombre ||
    item?.comercio_nombre ||
    item?.nombre_comercio ||
    item?.comercios?.nombre ||
    'Comercio adherido';
  return rawName.replace(/\s*\([^)]+\)$/, '').trim() || rawName;
}

function resolveStoreOpenStatus(item) {
  if (typeof item?.abierto === 'boolean') {
    return {
      isOpen: item.abierto,
      label: item.abierto ? 'Abierto ahora' : 'Cerrado',
    };
  }
  if (item?.horario_apertura && item?.horario_cierre) {
    return {
      isOpen: true,
      label: `Abierto (${item.horario_apertura} - ${item.horario_cierre})`,
    };
  }
  const hour = new Date().getHours();
  const isOpen = hour >= 8 && hour < 22;
  return {
    isOpen,
    label: isOpen ? 'Abierto' : 'Cerrado',
  };
}

function buildStoreWhatsAppUrl(phone, storeName, promoTitle) {
  if (!phone) return null;
  const cleanPhone = String(phone).replace(/[^\d]/g, '');
  if (!cleanPhone) return null;
  const msg = promoTitle
    ? `Hola ${storeName}, vi tu promoción "${promoTitle}" en el mapa de OfertAr y quería consultarte.`
    : `Hola ${storeName}, vi tu comercio en el mapa de OfertAr y quería hacerte una consulta.`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}

function LocationMarker({ position, onChange, radiusMeters }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (onChange) {
        onChange({ lat, lng });
      }
    },
  });

  if (!position) return null;

  return (
    <>
      <Marker
        position={[position.lat, position.lng]}
        draggable={Boolean(onChange)}
        eventHandlers={{
          dragend(e) {
            if (!onChange) return;
            const { lat, lng } = e.target.getLatLng();
            onChange({ lat, lng });
          },
        }}
      >
        <Popup>
          <div className="text-xs font-semibold text-stone-800">
            Tu posición actual de búsqueda (arrastra el pin para ajustar)
          </div>
        </Popup>
      </Marker>
      {radiusMeters > 0 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={radiusMeters}
          pathOptions={{
            color: '#ea580c',
            fillColor: '#f97316',
            fillOpacity: 0.12,
            weight: 1.75,
          }}
        />
      )}
    </>
  );
}

export default function LocationPicker({
  position,
  onChange,
  radiusMeters = 0,
  markers = [],
  showLegend = false,
  onOpenCanjeModal,
  helperText = 'Haz clic en el mapa o arrastra el pin para fijar la ubicación exacta',
}) {
  const center = position ? [position.lat, position.lng] : DEFAULT_CENTER;

  return (
    <div className="space-y-2.5">
      <div className="relative h-80 w-full overflow-hidden rounded-xl border border-stone-200/80 shadow-sm">
        <MapContainer
          center={center}
          zoom={14}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFlyToUpdater position={position} flyZoom={15} />
          <LocationMarker
            position={position}
            onChange={onChange}
            radiusMeters={radiusMeters}
          />

          {markers.map((item, idx) => {
            const coords = extractMarkerCoordinates(item);
            if (!coords) return null;

            const promosActivas = Array.isArray(item.promos_activas)
              ? item.promos_activas
              : item.titulo
                ? [item]
                : [];
            const promosCount =
              item.promos_activas_count != null
                ? Number(item.promos_activas_count)
                : promosActivas.length;
            const hasActivePromos = promosCount > 0;

            const icon = hasActivePromos
              ? createActivePromoStoreIcon(promosCount)
              : createStaticStoreIcon();

            const storeName = getCleanStoreName(item);
            const storeRubro =
              item.rubro ||
              item.comercio_rubro ||
              item.comercios?.rubro ||
              'Comercio';
            const storePhone =
              item.telefono_whatsapp ||
              item.comercio_telefono ||
              item.comercios?.telefono_whatsapp ||
              '';
            const addressText = extractStoreAddress(item, coords);
            const dist = item.distancia_metros ?? item.distancia ?? null;
            const openStatus = resolveStoreOpenStatus(item);
            const waUrl = buildStoreWhatsAppUrl(
              storePhone,
              storeName,
              promosActivas[0]?.titulo
            );

            return (
              <Marker
                key={
                  item.comercio_id ||
                  item.id ||
                  `${coords.lat}-${coords.lng}-${idx}`
                }
                position={[coords.lat, coords.lng]}
                icon={icon}
              >
                <Popup minWidth={240} maxWidth={280}>
                  <div className="space-y-2.5 py-0.5 text-xs text-stone-800">
                    {/* Encabezado de la tarjeta del comercio en el Popup */}
                    <div className="space-y-1 border-b border-stone-200/80 pb-2">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/60 px-2 py-0.5 text-[10px] font-semibold text-orange-700 capitalize">
                          <Tag className="h-2.5 w-2.5" strokeWidth={1.75} />
                          {String(storeRubro).replace('_', ' ')}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            openStatus.isOpen
                              ? 'bg-orange-50 text-orange-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" strokeWidth={1.75} />
                          {openStatus.label}
                        </span>
                      </div>

                      <p className="font-display text-sm font-bold text-stone-900 flex items-center gap-1.5 pt-0.5">
                        <Store
                          className="h-3.5 w-3.5 text-orange-600 shrink-0"
                          strokeWidth={1.75}
                        />
                        <span>{storeName}</span>
                      </p>

                      <p className="flex items-center gap-1 text-[11px] text-stone-600">
                        <MapPin
                          className="h-3 w-3 text-stone-400 shrink-0"
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{addressText}</span>
                      </p>

                      {dist != null && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 tabular-nums">
                          <Navigation className="h-3 w-3" strokeWidth={1.75} />
                          A {Math.round(Number(dist))} m de tu ubicación
                        </p>
                      )}
                    </div>

                    {/* Contenido según tenga o no promociones activas */}
                    {hasActivePromos ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-800">
                            <Zap
                              className="h-3.5 w-3.5 text-orange-600"
                              strokeWidth={1.75}
                            />
                            {promosCount}{' '}
                            {promosCount === 1
                              ? 'oferta activa disponible'
                              : 'ofertas activas disponibles'}
                          </span>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                          {promosActivas.map((p, pIdx) => (
                            <div
                              key={p.id || pIdx}
                              className="rounded-lg border border-orange-200/80 bg-orange-50/50 p-2 space-y-1.5"
                            >
                              <p className="font-display text-xs font-bold text-stone-900 leading-snug">
                                {p.titulo}
                              </p>
                              {p.descripcion && (
                                <p className="text-[11px] text-stone-600 line-clamp-2">
                                  {p.descripcion}
                                </p>
                              )}
                              {onOpenCanjeModal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenCanjeModal({
                                      ...p,
                                      comercio_nombre: storeName,
                                      comercio_rubro: storeRubro,
                                      comercio_telefono: storePhone,
                                    })
                                  }
                                  className="font-display w-full inline-flex items-center justify-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-orange-700 transition-colors cursor-pointer"
                                >
                                  <Ticket
                                    className="h-3 w-3"
                                    strokeWidth={1.75}
                                  />
                                  Canjear PIN en local (5m)
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-stone-200/80 bg-stone-50 p-2.5 text-center">
                        <p className="text-[11px] font-medium text-stone-600">
                          Sin ofertas flash activas en este momento
                        </p>
                      </div>
                    )}

                    {/* Botón directo de contacto por WhatsApp */}
                    {waUrl && (
                      <div className="pt-0.5">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200/90 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
                          style={{ color: '#1C1917', textDecoration: 'none' }}
                        >
                          <MessageCircle
                            className="h-3.5 w-3.5 text-orange-600"
                            strokeWidth={1.75}
                          />
                          Contactar por WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* 4. Leyenda flotante discreta en una esquina del mapa */}
        {showLegend && (
          <div className="pointer-events-auto absolute bottom-2.5 left-2.5 z-[400] rounded-xl border border-stone-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xs space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500 border border-white" />
              </span>
              <span className="font-semibold text-stone-800">
                Local con Oferta Flash
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-600 border border-white" />
              </span>
              <span className="font-medium text-stone-600">Local adherido</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-stone-600">
        <span>{helperText}</span>
        {position && (
          <span className="font-mono tabular-nums text-stone-700">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
