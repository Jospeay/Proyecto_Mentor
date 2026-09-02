import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, GraduationCap, AlertCircle, Shield, BookOpen, Bot, Zap, Moon, Target } from 'lucide-react';
import { registrarUsuario, iniciarSesion } from '../services/auth';

const SEMESTRES = Array.from({ length: 10 }, (_, i) => `Semestre ${i + 1}`);

const features = [
  { icon: Bot, title: 'IA Proactiva', desc: 'Mentor analiza tu carga y sugiere prioridades' },
  { icon: Target, title: 'Foco Total', desc: 'Pomodoro por tarea para estudiar sin distracciones' },
  { icon: Zap, title: 'Sync Real', desc: 'Extrae tareas de tu portal universitario automáticamente' },
  { icon: Moon, title: 'Anti-Burnout', desc: 'Alertas inteligentes cuándo necesitas descanso' },
];

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

  const switchTab = (register) => {
    setIsRegister(register);
    setError('');
    setShowLocalFallback(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex select-none relative overflow-hidden">
      {/* Fondo animado abstracto - Lado izquierdo */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative">
        {/* Gradiente de fondo animado */}
        <div className="absolute inset-0 bg-zinc-950" />
        
        {/* Orbes decorativos */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />

        {/* Patrón de grid sutil */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V0h4V0h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V0h4V0H6z' fill='%233D9A6E' fillOpacity='0.4'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Contenido del lado izquierdo */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-12">
          {/* Logo principal */}
          <div className="mb-12">
            <div className="w-28 h-28 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-brand-600 rounded-3xl shadow-xl" />
              <div className="relative w-full h-full bg-brand-600 rounded-3xl flex items-center justify-center shadow-xl">
                <BookOpen className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4 text-center leading-tight">
            Proyecto <span className="text-brand-400">Mentor</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-10 max-w-lg text-center leading-relaxed">
            Tu asistente académico inteligente que organiza, prioriza y te guía hacia el éxito universitario.
          </p>

          {/* Características */}
          <div className="grid grid-cols-2 gap-4 max-w-xl w-full">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 text-center group hover:border-emerald-500/30 transition-all duration-300"
              >
                <div className="w-12 h-12 mx-auto mb-3 bg-brand-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                <p className="text-zinc-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Badge versión */}
          <div className="mt-16 flex items-center justify-center gap-3 text-zinc-500 text-sm">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>v2.0 — Pomodoro por tarea • IA Proactiva • Scraper Real</span>
          </div>
        </div>
      </div>

      {/* Lado derecho - Formulario Glassmorphism */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Tarjeta Glassmorphism */}
          <div className="relative">
            
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/50">
              {/* Encabezado */}
              <div className="text-center mb-8">
                <div className="w-14 h-14 mx-auto mb-4 bg-brand-600 rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{isRegister ? 'Crear tu cuenta' : 'Bienvenido de nuevo'}</h2>
                <p className="text-zinc-500 text-sm">
                  {isRegister ? 'Únete a miles de estudiantes organizados' : 'Ingresa para continuar tu progreso'}
                </p>
              </div>

              {/* Pestañas Login / Registro */}
              <div className="flex mb-6 bg-white/5 rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => switchTab(false)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    !isRegister
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => switchTab(true)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isRegister
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Crear cuenta
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 space-y-3 animate-slide-up">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>

                  {/* Botón de Fallback en Modo Local */}
                  {showLocalFallback && (
                    <button
                      type="button"
                      onClick={handleLocalModeLogin}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Shield className="w-4 h-4 text-brand-400" />
                      <span>Probar App en Modo Local / Demo</span>
                    </button>
                  )}
                </div>
              )}

              {/* Formulario */}
              <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
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

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Semestre</label>
                      <select
                        name="semester"
                        value={form.semester}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all appearance-none bg-no-repeat bg-right pr-10"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%233D9A6E' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 0.75rem center',
                          backgroundSize: '1.25rem 1.25rem',
                        }}
                      >
                        {SEMESTRES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Cargando...
                    </>
                  ) : (
                    <>
                      {isRegister ? 'Crear cuenta' : 'Entrar'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Acceso rápido a Modo Demo */}
              <div className="mt-6 pt-4 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={handleLocalModeLogin}
                  className="text-xs text-slate-400 hover:text-zinc-300 transition-colors underline-offset-2"
                >
                  ¿Sin Firebase aún? Entrar en Modo Local
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Software de productividad académica • Hecho con dedicación para estudiantes
        </p>
      </div>

      {/* Estilos globales para animaciones */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 6s ease-in-out infinite; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// Campo de formulario con estilo glassmorphism
function Field({ icon: Icon, name, type, placeholder, value, onChange }) {
  return (
    <div className="relative group">
      <Icon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-brand-400" />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="relative w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all duration-200"
      />
    </div>
  );
}
