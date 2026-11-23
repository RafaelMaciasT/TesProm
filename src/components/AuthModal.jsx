import { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);

  if (!isOpen) return null;

  const resetMessages = () => {
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const toggleMode = (newMode) => {
    setMode(newMode);
    resetMessages();
  };

  const syncUserProfileTable = async (user, trimmedName, trimmedEmail) => {
    if (!user?.id || !supabase) return;
    try {
      const { error } = await supabase.from('perfiles').upsert(
        {
          id: user.id,
          user_id: user.id,
          nombre: trimmedName,
          full_name: trimmedName,
          email: trimmedEmail,
        },
        { onConflict: 'id' }
      );
      if (error) {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            full_name: trimmedName,
            username: trimmedName,
          },
          { onConflict: 'id' }
        );
      }
    } catch {
      // Ignorar de forma segura si la tabla adicional de perfiles no existe
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim() || !password) {
      setErrorMsg('Por favor ingresa tu correo electrónico y contraseña.');
      return;
    }

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setErrorMsg('El nombre de perfil debe tener al menos 2 caracteres.');
        return;
      }

      if (password.length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg('Las contraseñas no coinciden');
        return;
      }
    } else if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg(
        'Supabase no está configurado. Revisa las variables de entorno en .env.'
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (onAuthSuccess) onAuthSuccess(data.session);
        onClose();
      } else {
        const trimmedName = fullName.trim();
        const trimmedEmail = email.trim();

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              username: trimmedName,
              nombre: trimmedName,
            },
          },
        });

        if (error) throw error;

        if (data?.user) {
          await syncUserProfileTable(data.user, trimmedName, trimmedEmail);
        }

        if (data?.session) {
          if (onAuthSuccess) onAuthSuccess(data.session);
          onClose();
        } else {
          setInfoMsg(
            'Cuenta creada con éxito. Si tienes activada la confirmación por correo, revisa tu bandeja de entrada para iniciar sesión.'
          );
          setPassword('');
          setConfirmPassword('');
          setMode('login');
        }
      }
    } catch (err) {
      setErrorMsg(
        err.message || 'Ocurrió un error al procesar la autenticación.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-200/80">
        <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <UserCheck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                {mode === 'login' ? 'Ingresar a OfertAr' : 'Crear Cuenta en OfertAr'}
              </h2>
              <p className="text-xs text-stone-600">
                Cuenta única para vecinos y comercios del barrio
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

        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => toggleMode('login')}
              className={`rounded-lg py-2 transition-all duration-200 cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => toggleMode('register')}
              className={`rounded-lg py-2 transition-all duration-200 cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Registrarse
            </button>
          </div>
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

          {infoMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60 p-3.5 text-xs text-emerald-800">
              <CheckCircle2
                className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <span>{infoMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nombre de perfil *
              </label>
              <div className="relative">
                <User
                  className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Martín Gómez"
                  className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Correo Electrónico *
            </label>
            <div className="relative">
              <Mail
                className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                strokeWidth={1.75}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Contraseña *
            </label>
            <div className="relative">
              <Lock
                className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                strokeWidth={1.75}
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Confirmar contraseña *
              </label>
              <div className="relative">
                <Lock
                  className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all duration-200"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="font-display w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Procesando...
              </>
            ) : mode === 'login' ? (
              'Ingresar'
            ) : (
              'Crear Cuenta'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
