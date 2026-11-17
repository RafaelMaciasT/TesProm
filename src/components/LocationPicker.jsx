import { useEffect } from 'react';
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
import '../lib/leafletFix';

const DEFAULT_CENTER = [-34.6037, -58.3816]; // Obelisco / CABA

// Marcador vectorial limpio (sin emojis) con estética esmeralda para comercios
const businessIcon = new L.DivIcon({
  className: 'custom-business-marker',
  html: `<div style="background-color:#059669;width:28px;height:28px;border-radius:9999px;border:2.5px solid #ffffff;box-shadow:0 2px 5px rgba(28,25,23,0.22);display:flex;align-items:center;justify-content:center;color:#ffffff;">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

function MapCenterUpdater({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position?.lat && position?.lng) {
      map.setView([position.lat, position.lng], map.getZoom(), {
        animate: true,
      });
    }
  }, [map, position?.lat, position?.lng]);

  return null;
}

function extractPromoCoordinates(item) {
  if (!item) return null;

  const latCandidate =
    item.comercio_lat ??
    item.lat ??
    item.latitud ??
    item.comercios?.lat ??
    null;
  const lngCandidate =
    item.comercio_lng ??
    item.lng ??
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
    item.comercio_ubicacion ??
    item.ubicacion ??
    item.comercios?.ubicacion ??
    null;

  if (typeof rawUbicacion === 'string' && rawUbicacion.includes('POINT')) {
    const match = rawUbicacion.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      const lng = Number(match[1]);
      const lat = Number(match[2]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { lat, lng };
      }
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
      <Marker position={[position.lat, position.lng]}>
        <Popup>
          <div className="text-xs font-semibold text-stone-800">
            Tu posición actual de búsqueda
          </div>
        </Popup>
      </Marker>
      {radiusMeters > 0 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={radiusMeters}
          pathOptions={{
            color: '#059669',
            fillColor: '#10b981',
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
  helperText = 'Haz clic en el mapa para fijar la ubicación del comercio',
}) {
  const center = position ? [position.lat, position.lng] : DEFAULT_CENTER;

  return (
    <div className="space-y-2.5">
      <div className="h-72 w-full overflow-hidden rounded-xl border border-stone-200/80 shadow-sm">
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
          <MapCenterUpdater position={position} />
          <LocationMarker
            position={position}
            onChange={onChange}
            radiusMeters={radiusMeters}
          />

          {markers.map((m, idx) => {
            const coords = extractPromoCoordinates(m);
            if (!coords) return null;
            const nombreComercio =
              m.comercio_nombre ||
              m.nombre_comercio ||
              m.comercios?.nombre ||
              'Comercio';
            const dist = m.distancia_metros ?? m.distancia ?? null;

            return (
              <Marker
                key={m.id || m.promo_id || `${coords.lat}-${coords.lng}-${idx}`}
                position={[coords.lat, coords.lng]}
                icon={businessIcon}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-display font-bold text-stone-900">
                      {nombreComercio}
                    </p>
                    {m.titulo && (
                      <p className="text-stone-700 font-medium">{m.titulo}</p>
                    )}
                    {dist != null && (
                      <p className="text-amber-700 font-semibold tabular-nums">
                        A {Math.round(Number(dist))} m
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
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
