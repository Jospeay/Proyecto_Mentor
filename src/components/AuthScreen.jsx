import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, GraduationCap, AlertCircle, Shield } from 'lucide-react';
import { registrarUsuario, iniciarSesion } from '../services/auth';

/**
 * COMPONENTE: AuthScreen.jsx — Pantalla de inicio de sesión y registro.
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
    <div className="min-h-screen bg-pm-bg flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm space-y-6">

        {/* Encabezado */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-pm-text tracking-tight">Proyecto Mentor</h1>
          <p className="text-sm text-pm-muted">Organiza tu semestre con claridad.</p>
        </div>

        {/* Tarjeta de formulario */}
        <div className="bg-pm-surface border border-pm-border rounded-pm-lg p-6 space-y-5 shadow-lg">

          {/* Pestañas Login / Registro */}
          <div className="flex border-b border-pm-border">
            <button
              onClick={() => { setIsRegister(false); setError(''); setShowLocalFallback(false); }}
              className={`flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                !isRegister
                  ? 'border-pm-accent text-pm-text'
                  : 'border-transparent text-pm-subtle hover:text-pm-muted'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); setShowLocalFallback(false); }}
              className={`flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                isRegister
                  ? 'border-pm-accent text-pm-text'
                  : 'border-transparent text-pm-subtle hover:text-pm-muted'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="space-y-3">
              <div className="p-3 bg-pm-red/10 border border-pm-red/20 rounded-pm text-xs text-pm-red flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>

              {/* Botón de Fallback en Modo Local */}
              {showLocalFallback && (
                <button
                  type="button"
                  onClick={handleLocalModeLogin}
                  className="w-full py-2.5 rounded-pm bg-pm-card hover:bg-pm-hover text-pm-text border border-pm-border text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4 text-pm-accent" />
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

                <div>
                  <label className="block text-xs font-medium text-pm-muted mb-1">Semestre</label>
                  <select
                    name="semester"
                    value={form.semester}
                    onChange={handleChange}
                    className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-pm-accent transition-colors"
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
              className="w-full py-2.5 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? 'Cargando...' : isRegister ? 'Crear cuenta' : 'Entrar'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Acceso rápido a Modo Demo */}
          <div className="pt-2 border-t border-pm-border/40 text-center">
            <button
              type="button"
              onClick={handleLocalModeLogin}
              className="text-xs text-pm-muted hover:text-pm-accent transition-colors underline"
            >
              ¿Sin Firebase aún? Entrar en Modo Local
            </button>
          </div>

        </div>

        <p className="text-center text-xs text-pm-subtle">
          Software de productividad académica.
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, name, type, placeholder, value, onChange }) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 text-pm-subtle absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-pm-card border border-pm-border rounded-pm pl-9 pr-3 py-2 text-sm text-pm-text placeholder-pm-subtle focus:outline-none focus:border-pm-accent transition-colors"
      />
    </div>
  );
}
