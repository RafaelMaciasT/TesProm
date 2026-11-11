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

// Icono distintivo para el marcador de los comercios con promociones
const businessIcon = new L.DivIcon({
  className: 'custom-business-marker',
  html: `<div style="background-color:#10b981;width:28px;height:28px;border-radius:9999px;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:bold;font-size:13px;">★</div>`,
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
          <div className="text-xs font-semibold text-slate-800">
            Tu posición actual de búsqueda
          </div>
        </Popup>
      </Marker>
      {radiusMeters > 0 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={radiusMeters}
          pathOptions={{
            color: '#4f46e5',
            fillColor: '#6366f1',
            fillOpacity: 0.14,
            weight: 2,
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
    <div className="space-y-2">
      <div className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner">
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
            const dist =
              m.distancia_metros ?? m.distancia ?? null;

            return (
              <Marker
                key={m.id || m.promo_id || `${coords.lat}-${coords.lng}-${idx}`}
                position={[coords.lat, coords.lng]}
                icon={businessIcon}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-slate-900">{nombreComercio}</p>
                    {m.titulo && (
                      <p className="text-indigo-700 font-medium">{m.titulo}</p>
                    )}
                    {dist != null && (
                      <p className="text-emerald-700 font-semibold">
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
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{helperText}</span>
        {position && (
          <span className="font-mono text-slate-700">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
