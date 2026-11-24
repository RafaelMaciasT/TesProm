import { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  RotateCcw,
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle,
  Zap,
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
  const tomorrow = new Date();
  tomorrow.setHours(tomorrow.getHours() + 48);
  return formatDateTimeLocal(tomorrow);
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

export default function RepublishPromoModal({
  isOpen,
  promo,
  onClose,
  onPromoRepublished,
}) {
  const [titulo, setTitulo] = useState(() => promo?.titulo || '');
  const [descripcion, setDescripcion] = useState(() => promo?.descripcion || '');
  const [esFlash, setEsFlash] = useState(() => Boolean(promo?.es_flash));
  const [flashOption, setFlashOption] = useState('2h');
  const [standardDateTime, setStandardDateTime] = useState(
    getDefaultStandardDateTime
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || !promo) return null;

  const minStandardStr = getMinStandardDateTime();

  const calcularNuevoVenceEl = () => {
    if (esFlash) {
      return calculateFlashExpiration(flashOption);
    }

    if (!standardDateTime) return null;
    const parsed = new Date(standardDateTime);
    const minAllowed = new Date();
    minAllowed.setHours(minAllowed.getHours() + 23, minAllowed.getMinutes() - 5);

    if (Number.isNaN(parsed.getTime()) || parsed < minAllowed) {
      return null;
    }
    return parsed.toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!titulo.trim()) {
      setErrorMsg('El título de la promoción no puede estar vacío.');
      return;
    }

    const nuevoVenceEl = calcularNuevoVenceEl();
    if (!nuevoVenceEl) {
      setErrorMsg(
        'Para una Promoción Estándar, selecciona una fecha y hora futura de al menos 1 día.'
      );
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase no está configurado.');
      return;
    }

    setLoading(true);

    try {
      let updatedPromo = null;

      const { data, error } = await supabase
        .from('promociones')
        .update({
          vence_el: nuevoVenceEl,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          es_flash: esFlash,
        })
        .eq('id', promo.id)
        .select()
        .single();

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('promociones')
          .update({
            vence_el: nuevoVenceEl,
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
          })
          .eq('id', promo.id)
          .select()
          .single();

        if (fallbackError) {
          throw new Error(
            `No se pudo republicar la promoción: ${fallbackError.message}`
          );
        }
        updatedPromo = fallbackData;
      } else {
        updatedPromo = data;
      }

      try {
        confetti({
          particleCount: 70,
          spread: 65,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignorar en entornos sin canvas
      }

      if (onPromoRepublished) {
        onPromoRepublished(
          updatedPromo || {
            ...promo,
            vence_el: nuevoVenceEl,
            es_flash: esFlash,
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
          }
        );
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err.message || 'Ocurrió un error al republicar la promoción.'
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
      aria-labelledby="modal-republish-title"
    >
      <div className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-200/80">
        <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700 border border-orange-200/60">
              <RotateCcw className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2
                id="modal-republish-title"
                className="font-display text-lg font-bold text-stone-900"
              >
                Republicar Promoción
              </h2>
              <p className="text-xs text-stone-600">
                Elige el formato y su nueva vigencia para reactivarla
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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

          {/* Previsualización de datos existentes */}
          <div className="flex items-center gap-3.5 rounded-xl border border-stone-200/80 bg-stone-50 p-3">
            {promo.imagen_url ? (
              <img
                src={promo.imagen_url}
                alt={promo.titulo}
                className="h-14 w-14 rounded-lg object-cover border border-stone-200/80 shrink-0"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-50 text-orange-700 border border-orange-200/60 shrink-0">
                <Sparkles className="h-5 w-5" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                Oferta pre-cargada
              </span>
              <p className="font-display text-sm font-bold text-stone-900 truncate mt-0.5">
                {titulo || promo.titulo}
              </p>
              {descripcion && (
                <p className="text-xs text-stone-600 truncate">{descripcion}</p>
              )}
            </div>
          </div>

          {/* Selector de Tipo de Promoción (Estándar vs Flash) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Tipo de Promoción *
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEsFlash(false)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                  !esFlash
                    ? 'border-orange-600 bg-orange-50/60 text-stone-900 ring-2 ring-orange-500/20'
                    : 'border-stone-200/80 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="republishPromoType"
                  checked={!esFlash}
                  onChange={() => setEsFlash(false)}
                  className="mt-1 accent-orange-600"
                />
                <div>
                  <span className="font-display flex items-center gap-1.5 text-xs sm:text-sm font-bold text-stone-900">
                    <Calendar
                      className="h-4 w-4 text-orange-600"
                      strokeWidth={1.75}
                    />
                    Promoción Estándar
                  </span>
                  <span className="text-[11px] text-stone-600">
                    Fecha libre (mín. 1 día)
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEsFlash(true)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                  esFlash
                    ? 'border-amber-600 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20'
                    : 'border-stone-200/80 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="republishPromoType"
                  checked={esFlash}
                  onChange={() => setEsFlash(true)}
                  className="mt-1 accent-amber-600"
                />
                <div>
                  <span className="font-display flex items-center gap-1.5 text-xs sm:text-sm font-bold text-stone-900">
                    <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
                    Oferta Relámpago (Flash)
                  </span>
                  <span className="text-[11px] text-stone-600">
                    Vigencia rápida en horas
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Selector de vigencia según el tipo elegido */}
          {esFlash ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
                Duración de la Oferta Flash *
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FLASH_OPTIONS.map((op) => {
                  const selected = flashOption === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setFlashOption(op.id)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all duration-200 cursor-pointer ${
                        selected
                          ? 'border-amber-600 bg-amber-100/80 text-amber-950 ring-2 ring-amber-500/20'
                          : 'border-amber-200/70 bg-white text-stone-700 hover:bg-amber-50'
                      }`}
                    >
                      <span className="font-display text-xs font-bold tabular-nums">
                        {op.label}
                      </span>
                      <span className="text-[10px] text-stone-600 tabular-nums">
                        {op.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-3.5 space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Calendar
                  className="h-4 w-4 text-orange-600"
                  strokeWidth={1.75}
                />
                Fecha y hora de vencimiento (mínimo 1 día) *
              </label>
              <input
                type="datetime-local"
                required={!esFlash}
                min={minStandardStr}
                value={standardDateTime}
                onChange={(e) => setStandardDateTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-sm text-stone-900 tabular-nums focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Título de la Promoción *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-sm text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-xl border border-stone-200/90 bg-white px-3 py-2 text-sm text-stone-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200/90 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all duration-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`font-display inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60 transition-all duration-200 cursor-pointer ${
                esFlash
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  Republicando...
                </>
              ) : (
                <>
                  {esFlash ? (
                    <Zap className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  {esFlash ? 'Activar Promo Flash' : 'Confirmar y Activar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
