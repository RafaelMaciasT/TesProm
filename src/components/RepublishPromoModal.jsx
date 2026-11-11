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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-republish-title"
    >
      <div className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="modal-republish-title"
                className="text-lg font-bold text-slate-900"
              >
                Republicar Promoción
              </h2>
              <p className="text-xs text-slate-500">
                Elige el tipo de promoción y su nueva vigencia para reactivarla
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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

          {/* Previsualización de datos existentes */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {promo.imagen_url ? (
              <img
                src={promo.imagen_url}
                alt={promo.titulo}
                className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                Oferta pre-cargada
              </span>
              <p className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {titulo || promo.titulo}
              </p>
              {descripcion && (
                <p className="text-xs text-slate-500 truncate">{descripcion}</p>
              )}
            </div>
          </div>

          {/* Selector de Tipo de Promoción (Estándar vs Flash) */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Tipo de Promoción *
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEsFlash(false)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition cursor-pointer ${
                  !esFlash
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="republishPromoType"
                  checked={!esFlash}
                  onChange={() => setEsFlash(false)}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <span className="block text-xs sm:text-sm font-bold">
                    Promoción Estándar
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Fecha libre (mín. 1 día)
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEsFlash(true)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition cursor-pointer ${
                  esFlash
                    ? 'border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500/25'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                  <span className="block text-xs sm:text-sm font-bold">
                    ⚡ Oferta Relámpago (Flash)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Vigencia rápida en horas
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Selector de vigencia según el tipo elegido */}
          {esFlash ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
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
                      className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition cursor-pointer ${
                        selected
                          ? 'border-amber-600 bg-amber-100/90 text-amber-950 ring-2 ring-amber-500/25'
                          : 'border-amber-200/80 bg-white text-slate-700 hover:bg-amber-50'
                      }`}
                    >
                      <span className="text-xs font-bold">{op.label}</span>
                      <span className="text-[10px] text-slate-500">
                        {op.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                Fecha y hora de vencimiento (mínimo 1 día) *
              </label>
              <input
                type="datetime-local"
                required={!esFlash}
                min={minStandardStr}
                value={standardDateTime}
                onChange={(e) => setStandardDateTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Título de la Promoción *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-xs disabled:opacity-60 transition cursor-pointer ${
                esFlash
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Republicando...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  {esFlash ? '⚡ Activar Promo Flash' : 'Confirmar y Activar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
