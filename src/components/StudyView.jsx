import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Shield, ShieldAlert, Sparkles, Coffee } from 'lucide-react';
import { calculateBurnoutRisk } from '../utils/studentLogic';

/**
 * COMPONENTE: StudyView.jsx — Temporizador Pomodoro con Hardcore Mode y Anti-Burnout.
 * 
 * Incluye:
 * 1. Hardcore Mode Toggle: Edita el archivo `hosts` en Electron para bloquear distracciones.
 * 2. Contador de tiempo diario acumulado: Activa la regla Anti-Burnout al superar 4 horas.
 */

const MODES = [
  { id: 'focus25',     label: 'Enfoque 25m',        minutes: 25, type: 'work' },
  { id: 'focus50',     label: 'Trabajo profundo 50m', minutes: 50, type: 'work' },
  { id: 'breakShort',  label: 'Descanso 5m',         minutes: 5,  type: 'break' },
  { id: 'breakLong',   label: 'Descanso 15m',        minutes: 15, type: 'break' },
];

export default function StudyView({ activeTask, onCompleteSession, dailyStudyMinutes = 0, onUpdateDailyStudyTime, onTriggerAntiBurnout }) {
  const [mode, setMode] = useState(MODES[0]);
  const [timeLeft, setTimeLeft] = useState(MODES[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [hardcoreMode, setHardcoreMode] = useState(false);
  const [hardcoreStatusMessage, setHardcoreStatusMessage] = useState('');

  // Cuenta regresiva
  useEffect(() => {
    if (!running || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => t - 1);
      
      // Sumar al acumulador diario si es tiempo de trabajo
      if (mode.type === 'work') {
        onUpdateDailyStudyTime && onUpdateDailyStudyTime(1 / 60); // suma 1 segundo en minutos
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, timeLeft, mode]);

  // Al llegar a 0
  useEffect(() => {
    if (timeLeft === 0 && running) {
      setRunning(false);
      if (mode.type === 'work') {
        if (onCompleteSession) onCompleteSession(activeTask);

        // Verificar riesgo de Burnout (4 horas = 240 minutos)
        const burnout = calculateBurnoutRisk(dailyStudyMinutes);
        if (burnout.isBurnoutRisk && onTriggerAntiBurnout) {
          onTriggerAntiBurnout(burnout.hoursStudied);
        }
      }

      if (window.mentorAPI) {
        window.mentorAPI.sendNotification({
          title: mode.type === 'work' ? 'Sesión completada' : 'Descanso terminado',
          body: mode.type === 'work' ? 'Buen trabajo. Toma un descanso.' : 'Es hora de volver a concentrarse.',
        });
      }
    }
  }, [timeLeft, running]);

  // Manejo del Hardcore Mode (Bloqueador Web Hosts)
  const handleToggleHardcoreMode = async () => {
    const nextState = !hardcoreMode;
    setHardcoreMode(nextState);

    if (window.mentorAPI && window.mentorAPI.toggleHardcoreMode) {
      try {
        const res = await window.mentorAPI.toggleHardcoreMode({ enable: nextState });
        if (res && res.message) {
          setHardcoreStatusMessage(res.message);
          setTimeout(() => setHardcoreStatusMessage(''), 4000);
        }
      } catch (e) {
        console.warn('Error al cambiar Hardcore Mode en hosts:', e);
      }
    } else {
      setHardcoreStatusMessage(nextState ? 'Hardcore Mode activado (Simulación en navegador)' : 'Hardcore Mode desactivado');
      setTimeout(() => setHardcoreStatusMessage(''), 3000);
    }
  };

  const selectMode = (m) => {
    setMode(m);
    setTimeLeft(m.minutes * 60);
    setRunning(false);
  };

  const reset = () => {
    setTimeLeft(mode.minutes * 60);
    setRunning(false);
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const total = mode.minutes * 60;
  const pct = ((total - timeLeft) / total) * 100;
  const hoursAccumulated = (dailyStudyMinutes / 60).toFixed(1);

  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-xl mx-auto h-full min-h-[520px] space-y-7 select-none">

      {/* Tarea activa y tiempo diario */}
      <div className="text-center space-y-1">
        <span className="text-[11px] font-semibold text-pm-accent uppercase tracking-wider bg-pm-accent/10 px-2.5 py-0.5 rounded-pm">
          Entorno de Concentración
        </span>
        <h2 className="text-base font-semibold text-pm-text mt-1">
          {activeTask ? activeTask.title : 'Sesión de enfoque libre'}
        </h2>
        <p className="text-xs text-pm-muted">
          Materia: {activeTask ? activeTask.subject : 'General'} • Acumulado hoy: <strong className="text-pm-text">{hoursAccumulated} h / 4.0 h máx</strong>
        </p>
      </div>

      {/* TOGGLE ELEGANTE HARDCORE MODE */}
      <div className="w-full bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Shield className={`w-4 h-4 ${hardcoreMode ? 'text-pm-red' : 'text-pm-subtle'}`} />
          <div>
            <span className="text-xs font-semibold text-pm-text block">Hardcore Mode (Bloqueador Web)</span>
            <span className="text-[11px] text-pm-subtle block">Bloquea YouTube, Netflix e Instagram en el sistema</span>
          </div>
        </div>

        <button
          onClick={handleToggleHardcoreMode}
          className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
            hardcoreMode ? 'bg-pm-red' : 'bg-pm-card border border-pm-border'
          }`}
        >
          <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
            hardcoreMode ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {hardcoreStatusMessage && (
        <p className="text-xs text-pm-accent bg-pm-accent/10 border border-pm-accent/20 px-3 py-1.5 rounded-pm text-center animate-fadeIn">
          {hardcoreStatusMessage}
        </p>
      )}

      {/* Selector de modos */}
      <div className="flex gap-1 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => selectMode(m)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              mode.id === m.id
                ? 'bg-pm-accent text-white'
                : 'text-pm-muted hover:text-pm-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Reloj con anillo SVG */}
      <div className="relative w-56 h-56 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle
            cx="50" cy="50" r="44"
            fill="transparent"
            stroke={hardcoreMode ? '#D4544E' : mode.type === 'work' ? '#3D9A6E' : '#4CAF7D'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={276}
            strokeDashoffset={276 - (276 * pct) / 100}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-semibold text-pm-text tracking-tight font-mono">
            {fmt(timeLeft)}
          </span>
          <span className="text-xs text-pm-subtle mt-1">
            {running ? (hardcoreMode ? 'Modo Estricto Activo' : 'En curso') : 'Pausado'}
          </span>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setRunning(!running)}
          className={`px-8 py-3 rounded-pm text-sm font-medium flex items-center gap-2 transition-colors ${
            running
              ? 'bg-pm-card border border-pm-border text-pm-text hover:bg-pm-hover'
              : 'bg-pm-accent text-white hover:bg-pm-accent/90'
          }`}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {running ? 'Pausar' : 'Comenzar'}
        </button>
        <button
          onClick={reset}
          className="p-3 rounded-pm border border-pm-border text-pm-muted hover:text-pm-text hover:bg-pm-hover transition-colors"
          title="Reiniciar"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
