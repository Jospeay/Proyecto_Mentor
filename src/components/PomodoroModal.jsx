import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, Timer, Coffee } from 'lucide-react';
import { calculateBurnoutRisk } from '../utils/studentLogic';

const MODES = [
  { id: 'focus25', label: '25 min', minutes: 25, type: 'work' },
  { id: 'focus50', label: '50 min', minutes: 50, type: 'work' },
  { id: 'breakShort', label: '5 min', minutes: 5, type: 'break' },
  { id: 'breakLong', label: '15 min', minutes: 15, type: 'break' },
];

export default function PomodoroModal({ task, isOpen, onClose, dailyStudyMinutes = 0, onUpdateDailyStudyTime, onTriggerAntiBurnout }) {
  const [mode, setMode] = useState(MODES[0]);
  const [timeLeft, setTimeLeft] = useState(MODES[0].minutes * 60);
  const [running, setRunning] = useState(false);

  const onUpdateRef = useRef(onUpdateDailyStudyTime);
  onUpdateRef.current = onUpdateDailyStudyTime;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const completedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          completedRef.current = true;
          setRunning(false);
          return 0;
        }
        if (modeRef.current.type === 'work') {
          onUpdateRef.current && onUpdateRef.current(1 / 60);
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!completedRef.current || timeLeft !== 0) return;
    completedRef.current = false;
    if (mode.type === 'work') {
      const burnout = calculateBurnoutRisk(dailyStudyMinutes);
      if (burnout.isBurnoutRisk && onTriggerAntiBurnout) {
        onTriggerAntiBurnout(burnout.hoursStudied);
      }
    }
    if (window.mentorAPI) {
      window.mentorAPI.sendNotification({
        title: mode.type === 'work' ? 'Sesion completada' : 'Descanso terminado',
        body: mode.type === 'work' ? 'Buen trabajo. Toma un descanso.' : 'Es hora de volver a concentrarse.',
      });
    }
  }, [timeLeft, running]);

  useEffect(() => {
    if (!isOpen) {
      setRunning(false);
      setMode(MODES[0]);
      setTimeLeft(MODES[0].minutes * 60);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const total = mode.minutes * 60;
  const pct = ((total - timeLeft) / total) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1">
          <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider bg-brand-500/10 px-2.5 py-0.5 rounded-full">
            <Timer className="w-3 h-3 inline mr-1" />
            Pomodoro
          </span>
          <h2 className="text-sm font-semibold text-white mt-1">
            {task ? task.title : 'Sesion libre'}
          </h2>
          <p className="text-xs text-zinc-400">
            {task ? task.subject : 'General'} · Acumulado hoy: {(dailyStudyMinutes / 60).toFixed(1)}h
          </p>
        </div>

        <div className="flex gap-1 bg-zinc-800 border border-zinc-700/50 rounded-lg p-1 justify-center">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => selectMode(m)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode.id === m.id
                  ? 'bg-brand-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle
              cx="50" cy="50" r="44"
              fill="transparent"
              stroke={mode.type === 'work' ? '#3D9A6E' : '#4CAF7D'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={276}
              strokeDashoffset={276 - (276 * pct) / 100}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold text-white tracking-tight font-mono">
              {fmt(timeLeft)}
            </span>
            <span className="text-xs text-zinc-400 mt-1">
              {running ? 'En curso' : 'Pausado'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setRunning(!running)}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              running
                ? 'bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700'
                : 'bg-brand-600 text-white hover:bg-brand-600/90'
            }`}
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? 'Pausar' : 'Comenzar'}
          </button>
          <button
            onClick={reset}
            className="p-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Reiniciar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
