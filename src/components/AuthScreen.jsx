import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, GraduationCap, AlertCircle, Shield, Sparkles, CalendarCheck, Brain } from 'lucide-react';
import { registrarUsuario, iniciarSesion } from '../services/auth';

/**
 * COMPONENTE: AuthScreen.jsx — Pantalla de acceso en formato Split-Screen.
 *
 * Lado izquierdo: panel de marca con degradado índigo/esmeralda y logo grande.
 * Lado derecho: formulario dentro de una tarjeta de cristal (glassmorphism).
 *
 * Soporta autenticación real con Firebase Auth y fallback automático a Modo Local
 * en caso de que aún no se hayan cargado las claves reales de Firebase en el archivo .env.
 */

const SEMESTRES = Array.from({ length: 10 }, (_, i) => `Semestre ${i + 1}`);

export default function AuthScreen({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLocalFallback, setShowLocalFallback] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    career: '',
    semester: 'Semestre 4',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Entrada rápida en Modo Local (Offline / Demo sin claves Firebase)
  const handleLocalModeLogin = () => {
    const localUser = {
      uid: `local_${Date.now()}`,
      displayName: form.name || (form.email ? form.email.split('@')[0] : 'Estudiante'),
      email: form.email || 'estudiante@universidad.edu',
      isLocal: true,
    };
    localStorage.setItem('mentor_local_user', JSON.stringify(localUser));
    onLoginSuccess(localUser);
  };

  // Inicio de sesión con Firebase Auth
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setShowLocalFallback(false);

    if (!form.email || !form.password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const user = await iniciarSesion(form.email, form.password);
      onLoginSuccess(user);
    } catch (err) {
      if (err.code === 'auth/api-key-not-valid' || err.message?.includes('api-key-not-valid')) {
        setError('Las claves de Firebase en .env aún no han sido configuradas.');
        setShowLocalFallback(true);
      } else if (err.code === 'auth/user-not-found') setError('No existe una cuenta con ese correo.');
      else if (err.code === 'auth/wrong-password') setError('Contraseña incorrecta.');
      else if (err.code === 'auth/invalid-credential') setError('Credenciales inválidas. Verifica tu correo y contraseña.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Registro con Firebase Auth
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setShowLocalFallback(false);

    if (!form.name || !form.email || !form.password) {
      setError('Nombre, correo y contraseña son obligatorios.');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const user = await registrarUsuario(form.email, form.password, form.name);
      onLoginSuccess(user);
    } catch (err) {
      if (err.code === 'auth/api-key-not-valid' || err.message?.includes('api-key-not-valid')) {
        setError('Claves de Firebase no configuradas en .env. ¡Puedes ingresar en Modo Local para probar toda la app!');
        setShowLocalFallback(true);
      } else if (err.code === 'auth/email-already-in-use') setError('Ya existe una cuenta con ese correo.');
      else if (err.code === 'auth/weak-password') setError('La contraseña es demasiado débil.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black">

      {/* ─────────── LADO IZQUIERDO: MARCA ─────────── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 bg-gradient-to-br from-indigo-800 via-indigo-950 to-emerald-950">
        {/* Halos de color en movimiento */}
        <div className="absolute -top-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-indigo-500/30 blur-3xl animate-aurora" />
        <div className="absolute -bottom-40 -right-16 w-[32rem] h-[32rem] rounded-full bg-emerald-500/25 blur-3xl animate-aurora" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">Proyecto Mentor</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h1 className="text-5xl font-bold leading-[1.1] bg-gradient-to-br from-white via-white to-emerald-200 bg-clip-text text-transparent">
            Tu semestre,
            <br />
            bajo control.
          </h1>
          <p className="text-base text-white/70 leading-relaxed">
            Tareas, exámenes, asistencia y un mentor con IA que te avisa antes de que sea tarde.
          </p>

          <div className="space-y-3 pt-2">
            <Highlight icon={Brain} text="Mentor IA que analiza tu carga académica" />
            <Highlight icon={CalendarCheck} text="Sincronización automática con Moodle / UAM Virtual" />
            <Highlight icon={Sparkles} text="Simulador de notas y prevención de burnout" />
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          Software de productividad académica · v1.0
        </p>
      </div>

      {/* ─────────── LADO DERECHO: FORMULARIO DE CRISTAL ─────────── */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">

          {/* Marca compacta para pantallas pequeñas */}
          <div className="lg:hidden flex items-center justify-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-indigo-500 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-base font-semibold text-white">Proyecto Mentor</span>
          </div>

          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-7 space-y-6 shadow-glass">

            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-white tracking-tight">
                {isRegister ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
              </h2>
              <p className="text-sm text-pm-muted">
                {isRegister
                  ? 'Registra tus datos para empezar a organizar tu ciclo.'
                  : 'Ingresa para retomar tu plan de estudio.'}
              </p>
            </div>

            {/* Pestañas Login / Registro */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
              <button
                onClick={() => { setIsRegister(false); setError(''); setShowLocalFallback(false); }}
                className={`py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  !isRegister
                    ? 'btn-primary'
                    : 'text-pm-muted hover:text-white'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => { setIsRegister(true); setError(''); setShowLocalFallback(false); }}
                className={`py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isRegister
                    ? 'btn-primary'
                    : 'text-pm-muted hover:text-white'
                }`}
              >
                Crear cuenta
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="space-y-3">
                <div className="p-3 bg-rose-500/10 border border-rose-400/25 rounded-2xl text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>

                {/* Botón de Fallback en Modo Local */}
                {showLocalFallback && (
                  <button
                    type="button"
                    onClick={handleLocalModeLogin}
                    className="w-full py-2.5 rounded-2xl btn-ghost text-xs font-medium flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4 text-emerald-300" />
                    <span>Probar App en Modo Local / Demo</span>
                  </button>
                )}
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-3">

              {isRegister && (
                <Field icon={User} name="name" type="text" placeholder="Nombre completo"
                  value={form.name} onChange={handleChange} />
              )}

              <Field icon={Mail} name="email" type="email" placeholder="correo@universidad.edu"
                value={form.email} onChange={handleChange} />

              <Field icon={Lock} name="password" type="password" placeholder="Contraseña"
                value={form.password} onChange={handleChange} />

              {isRegister && (
                <>
                  <Field icon={GraduationCap} name="career" type="text" placeholder="Carrera (ej. Ing. Sistemas)"
                    value={form.career} onChange={handleChange} />

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-pm-muted">Semestre</label>
                    <select
                      name="semester"
                      value={form.semester}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm text-pm-text focus:outline-none focus:border-emerald-400/50 focus:bg-white/10 transition-all duration-300"
                    >
                      {SEMESTRES.map((s) => (
                        <option key={s} value={s} className="bg-slate-900">{s}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl btn-primary text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.99] mt-2"
              >
                {loading ? 'Cargando...' : isRegister ? 'Crear cuenta' : 'Entrar'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Acceso rápido a Modo Demo */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleLocalModeLogin}
                className="text-xs text-pm-muted hover:text-emerald-300 transition-colors"
              >
                ¿Sin Firebase aún? <span className="underline underline-offset-2">Entrar en Modo Local</span>
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-pm-subtle">
            Al continuar aceptas usar Mentor de forma responsable con tus datos académicos.
          </p>
        </div>
      </div>
    </div>
  );
}

function Highlight({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/80">
      <span className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-emerald-300" />
      </span>
      {text}
    </div>
  );
}

function Field({ icon: Icon, name, type, placeholder, value, onChange }) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 text-pm-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-3.5 py-2.5 text-sm text-pm-text placeholder-pm-subtle focus:outline-none focus:border-emerald-400/50 focus:bg-white/10 transition-all duration-300"
      />
    </div>
  );
}
