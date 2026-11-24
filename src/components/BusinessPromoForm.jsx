import { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Store,
  Clock,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Zap,
  Calendar,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const FLASH_OPTIONS = [
  { id: '1h', label: '1 hora', description: '+1h desde ahora' },
  { id: '2h', label: '2 horas', description: '+2h desde ahora' },
  { id: '3h', label: '3 horas', description: '+3h desde ahora' },
  { id: 'eod', label: 'Fin del día', description: 'Hasta las 23:59 hs' },
];

function formatDateTimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getMinStandardDateTime() {
  const minDate = new Date();
  minDate.setHours(minDate.getHours() + 24);
  return formatDateTimeLocal(minDate);
}

function getDefaultStandardDateTime() {
  const defaultDate = new Date();
  defaultDate.setHours(defaultDate.getHours() + 48);
  return formatDateTimeLocal(defaultDate);
}

function calculateFlashExpiration(optionId) {
  const now = new Date();
  if (optionId === '1h') {
    now.setHours(now.getHours() + 1);
    return now.toISOString();
  }
  if (optionId === '2h') {
    now.setHours(now.getHours() + 2);
    return now.toISOString();
  }
  if (optionId === '3h') {
    now.setHours(now.getHours() + 3);
    return now.toISOString();
  }
  if (optionId === 'eod') {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay.getTime() - now.getTime() < 15 * 60 * 1000) {
      now.setHours(now.getHours() + 1);
      return now.toISOString();
    }
    return endOfDay.toISOString();
  }
  now.setHours(now.getHours() + 2);
  return now.toISOString();
}

export default function BusinessPromoForm({
  comercios = [],
  initialComercioId = '',
  onPromoCreated,
  onClose,
}) {
  const [selectedComercioId, setSelectedComercioId] = useState(
    () => initialComercioId || comercios[0]?.id || ''
  );
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [stockDisponible, setStockDisponible] = useState('');

  // Selector de tipo de promoción: false = Promoción Estándar, true = Oferta Relámpago (Flash)
  const [esFlash, setEsFlash] = useState(false);
  const [flashOption, setFlashOption] = useState('2h');
  const [standardDateTime, setStandardDateTime] = useState(
    getDefaultStandardDateTime
  );

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const minStandardStr = getMinStandardDateTime();

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    setErrorMsg(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const resolveExpirationIso = () => {
    if (esFlash) {
      return calculateFlashExpiration(flashOption);
    }

    if (!standardDateTime) return null;
    const chosen = new Date(standardDateTime);
    const minAllowed = new Date();
    minAllowed.setHours(minAllowed.getHours() + 23, minAllowed.getMinutes() - 5);

    if (Number.isNaN(chosen.getTime()) || chosen < minAllowed) {
      return null;
    }
    return chosen.toISOString();
  };

  const uploadImageIfPresent = async (file) => {
    if (!file || !supabase) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `promociones/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('promo-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      throw new Error(`Error al subir imagen: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from('promo-images').getPublicUrl(filePath);
    return data?.publicUrl || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedComercioId) {
      setErrorMsg('Por favor selecciona para qué local es esta promoción.');
      return;
    }

    if (!titulo.trim()) {
      setErrorMsg('Por favor ingresa el título de la oferta.');
      return;
    }

    const venceEl = resolveExpirationIso();
    if (!venceEl) {
      setErrorMsg(
        'Para una Promoción Estándar, la fecha y hora de vencimiento debe ser de al menos 1 día a partir de ahora.'
      );
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg(
        'Supabase no está configurado. Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let imagenUrl = null;
      if (imageFile) {
        imagenUrl = await uploadImageIfPresent(imageFile);
      }

      let promoData = null;
      const parsedStock =
        stockDisponible !== '' && Number(stockDisponible) > 0
          ? parseInt(stockDisponible, 10)
          : null;

      // Insertar con es_flash y stock_disponible; si alguna columna no existe aún, fallback seguro
      const { data, error: promoError } = await supabase
        .from('promociones')
        .insert([
          {
            comercio_id: selectedComercioId,
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            imagen_url: imagenUrl,
            vence_el: venceEl,
            es_flash: esFlash,
            stock_disponible: parsedStock,
          },
        ])
        .select()
        .single();

      if (promoError) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('promociones')
          .insert([
            {
              comercio_id: selectedComercioId,
              titulo: titulo.trim(),
              descripcion: descripcion.trim() || null,
              imagen_url: imagenUrl,
              vence_el: venceEl,
            },
          ])
          .select()
          .single();

        if (fallbackError) {
          throw new Error(
            `No se pudo publicar la promoción: ${fallbackError.message}`
          );
        }
        promoData = fallbackData;
      } else {
        promoData = data;
      }

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignorar errores de confetti en entornos sin canvas
      }

      const comercioSeleccionado = comercios.find(
        (c) => String(c.id) === String(selectedComercioId)
      );

      setSuccessMsg('Promoción publicada con éxito.');
      setTitulo('');
      setDescripcion('');
      setStockDisponible('');
      setImageFile(null);
      setImagePreview(null);

      if (onPromoCreated) {
        onPromoCreated({
          ...promoData,
          es_flash: esFlash,
          comercios: comercioSeleccionado || null,
        });
      }
    } catch (err) {
      setErrorMsg(
        err.message || 'Ocurrió un error inesperado al guardar la promoción.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-6 shadow-sm border border-stone-200/80 space-y-5"
    >
      <div className="flex items-start justify-between border-b border-stone-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-stone-900">
              Nueva Promoción Barrial
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Elige el formato, la sucursal y publica tu oferta para el barrio.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-all duration-200 cursor-pointer"
            aria-label="Cerrar formulario"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200/80 p-4 text-sm text-red-700">
          <AlertCircle
            className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-200/60 p-4 text-sm text-orange-800">
          <CheckCircle2
            className="h-5 w-5 text-orange-600 shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Selector de Tipo de Promoción desde el inicio */}
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-2">
          Tipo de Promoción *
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEsFlash(false)}
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              !esFlash
                ? 'border-orange-600 bg-orange-50/60 text-stone-900 ring-2 ring-orange-500/20'
                : 'border-stone-200/80 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50/60'
            }`}
          >
            <input
              type="radio"
              name="promoType"
              checked={!esFlash}
              onChange={() => setEsFlash(false)}
              className="mt-1 accent-orange-600"
            />
            <div>
              <span className="font-display flex items-center gap-1.5 text-sm font-bold text-stone-900">
                <Calendar
                  className="h-4 w-4 text-orange-600"
                  strokeWidth={1.75}
                />
                Promoción Estándar
              </span>
              <span className="text-xs text-stone-600">
                Vigencia programada (mínimo 1 día)
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setEsFlash(true)}
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer ${
              esFlash
                ? 'border-amber-600 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20'
                : 'border-stone-200/80 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50/60'
            }`}
          >
            <input
              type="radio"
              name="promoType"
              checked={esFlash}
              onChange={() => setEsFlash(true)}
              className="mt-1 accent-amber-600"
            />
            <div>
              <span className="font-display flex items-center gap-1.5 text-sm font-bold text-stone-900">
                <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
                Oferta Relámpago (Flash)
              </span>
              <span className="text-xs text-stone-600">
                Duración inmediata por pocas horas
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Selector obligatorio de comercio */}
      <div>
        <label
          htmlFor="select-comercio-promo"
          className="block text-xs font-semibold text-stone-700 mb-1.5"
        >
          ¿Para qué local es esta promoción? *
        </label>
        <div className="relative">
          <Store
            className="h-4 w-4 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2"
            strokeWidth={1.75}
          />
          <select
            id="select-comercio-promo"
            required
            value={selectedComercioId}
            onChange={(e) => setSelectedComercioId(e.target.value)}
            className="w-full rounded-xl border border-stone-200/90 pl-9 pr-3 py-2.5 text-sm bg-white font-medium text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
          >
            <option value="" disabled>
              Selecciona uno de tus locales registrados...
            </option>
            {comercios.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.nombre} — ({loc.rubro?.replace('_', ' ') || 'Comercio'})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">
            Título de la Oferta *
          </label>
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. 2x1 en Medialunas recién horneadas"
            className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">
            Stock / Cupos (opc.)
          </label>
          <input
            type="number"
            min="1"
            value={stockDisponible}
            onChange={(e) => setStockDisponible(e.target.value)}
            placeholder="Ilimitado"
            className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2.5 text-sm text-stone-900 tabular-nums focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-stone-500" strokeWidth={1.75} />
          Descripción de la Oferta (opcional)
        </label>
        <textarea
          rows={2}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej. Válido llevando en efectivo o transferencia hasta agotar stock."
          className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-sm text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
        />
      </div>

      {/* 3. Configuración de vigencia según el tipo elegido */}
      {esFlash ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-2.5">
          <label className="block text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
            Vigencia de la Oferta Relámpago (Flash) *
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {FLASH_OPTIONS.map((item) => {
              const isSelected = flashOption === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFlashOption(item.id)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-amber-600 bg-amber-100/80 text-amber-950 ring-2 ring-amber-500/20'
                      : 'border-amber-200/70 bg-white text-stone-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="font-display text-xs sm:text-sm font-bold tabular-nums">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-stone-600 tabular-nums">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 space-y-2">
          <label className="block text-xs font-semibold text-stone-800 flex items-center gap-1.5">
            <Calendar
              className="h-4 w-4 text-orange-600"
              strokeWidth={1.75}
            />
            Fecha y hora de finalización (mínimo 1 día) *
          </label>
          <input
            type="datetime-local"
            required={!esFlash}
            min={minStandardStr}
            value={standardDateTime}
            onChange={(e) => setStandardDateTime(e.target.value)}
            className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-sm text-stone-900 tabular-nums focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
          />
          <p className="text-xs text-stone-600 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-stone-400" strokeWidth={1.75} />
            La promoción estará activa hasta la fecha y hora seleccionadas.
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-stone-500" strokeWidth={1.75} />
          Imagen de la Promoción
        </label>
        <div className="flex items-center gap-4">
          <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-4 text-xs sm:text-sm text-stone-600 hover:border-orange-600 hover:bg-orange-50/30 transition-all duration-200">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <span>
              {imageFile
                ? imageFile.name
                : 'Seleccionar imagen desde tu dispositivo'}
            </span>
          </label>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Vista previa"
              className="h-16 w-16 rounded-xl object-cover border border-stone-200/80 shrink-0"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200/80">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200/90 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || comercios.length === 0}
          className={`font-display flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60 transition-all duration-200 cursor-pointer ${
            esFlash
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Publicando promoción...
            </>
          ) : esFlash ? (
            <>
              <Zap className="h-4 w-4" strokeWidth={1.75} />
              Lanzar Oferta Relámpago
            </>
          ) : (
            'Publicar Promoción Estándar'
          )}
        </button>
      </div>
    </form>
  );
}
