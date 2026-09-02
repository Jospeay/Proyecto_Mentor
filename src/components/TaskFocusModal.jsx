import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

export default function TaskFocusModal({ task, onClose, onFocusMinutes }) {
  const [phase, setPhase] = useState('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;
        if (phase === 'work') {
          onFocusMinutes?.(25);
          setPhase('break');
          return BREAK_SECONDS;
        }
        setPhase('work');
        return WORK_SECONDS;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, phase, onFocusMinutes]);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(phase === 'work' ? WORK_SECONDS : BREAK_SECONDS);
  };
  const format = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (!task) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Temporizador Pomodoro">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-gray-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Enfoque vinculado a tarea</p>
            <h2 className="mt-1 text-lg font-semibold">{task.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{task.subject || 'Sin asignatura'} · {task.dueDate || 'Sin fecha límite'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-7 flex flex-col items-center">
          <div className="flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-emerald-500/60 bg-zinc-950">
            <Timer className="mb-2 h-5 w-5 text-emerald-400" />
            <span className="font-mono text-5xl font-semibold tracking-tight">{format(secondsLeft)}</span>
            <span className="mt-2 text-xs font-medium uppercase tracking-widest text-zinc-400">{phase === 'work' ? '25 min · Enfoque' : '5 min · Descanso'}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setRunning((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? 'Pausar' : 'Iniciar'}
          </button>
          <button onClick={reset} className="rounded-lg border border-zinc-700 p-2.5 text-zinc-300 hover:bg-zinc-800" title="Reiniciar temporizador">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
