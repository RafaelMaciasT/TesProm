import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, Search } from 'lucide-react';

function formatNominatimSuggestion(item) {
  const addr = item?.address || {};

  const road =
    addr.road ||
    addr.pedestrian ||
    addr.footway ||
    addr.path ||
    addr.neighbourhood ||
    item?.name ||
    '';
  const houseNumber = addr.house_number || '';
  const streetPart = [road, houseNumber].filter(Boolean).join(' ').trim();

  const locality =
    addr.suburb ||
    addr.quarter ||
    addr.city_district ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.city ||
    '';

  const cityOrState =
    addr.city && addr.city !== locality
      ? addr.city
      : addr.state_district || addr.state || '';

  const primaryLine =
    streetPart || item?.display_name?.split(',')[0]?.trim() || 'Dirección';
  const secondaryParts = [locality, cityOrState].filter(Boolean);
  const secondaryLine =
    secondaryParts.length > 0
      ? secondaryParts.join(', ')
      : item?.display_name
          ?.split(',')
          .slice(1, 3)
          .map((s) => s.trim())
          .join(', ') || 'Argentina';

  const fullFormatted = [primaryLine, secondaryLine].filter(Boolean).join(', ');

  return {
    primaryLine,
    secondaryLine,
    fullFormatted,
  };
}

export default function AddressAutocomplete({
  value = '',
  onChange,
  onSelectLocation,
  placeholder = 'Ej. Av. Corrientes 1234, CABA',
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);
  const skipNextFetchRef = useRef(false);

  // Cerrar el menú desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Búsqueda con debounce de 400ms en Nominatim (OpenStreetMap) filtrada para Argentina
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length < 4) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ar&limit=5&q=${encodeURIComponent(
          trimmed
        )}`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'es',
          },
        });

        if (!response.ok) {
          throw new Error('Error consultando Nominatim');
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
          setIsOpen(data.length > 0);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const handleSelect = (item) => {
    const { fullFormatted } = formatNominatimSuggestion(item);
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    skipNextFetchRef.current = true;
    setIsOpen(false);
    setSuggestions([]);

    if (onChange) {
      onChange(fullFormatted);
    }

    if (onSelectLocation && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      onSelectLocation({
        lat,
        lng,
        address: fullFormatted,
      });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const nextVal = e.target.value;
            if (nextVal.trim().length < 4) {
              setSuggestions([]);
              setIsOpen(false);
              setLoading(false);
            }
            if (onChange) onChange(nextVal);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-9 py-2 text-sm text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
        />
        {loading ? (
          <Loader2
            className="h-4 w-4 text-orange-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2"
            strokeWidth={1.75}
          />
        ) : (
          value.trim().length > 0 && (
            <Search
              className="h-3.5 w-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
          )
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-stone-200/90 bg-white py-1 shadow-md divide-y divide-stone-100"
        >
          {suggestions.map((item) => {
            const { primaryLine, secondaryLine } =
              formatNominatimSuggestion(item);
            return (
              <li key={item.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-orange-50/70 transition-colors duration-150 cursor-pointer"
                >
                  <MapPin
                    className="h-4 w-4 text-orange-600 shrink-0 mt-0.5"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs font-bold text-stone-900 truncate">
                      {primaryLine}
                    </p>
                    <p className="text-[11px] text-stone-600 truncate">
                      {secondaryLine}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
