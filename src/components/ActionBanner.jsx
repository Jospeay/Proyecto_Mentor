import React from 'react';
import { ArrowRight, Clock, Plus } from 'lucide-react';

/**
 * COMPONENTE: ActionBanner.jsx — Tarjeta de "Acción Inmediata".
 *
 * Muestra la tarea más urgente o un estado vacío invitando a crear la primera tarea.
 * Diseño plano y sobrio: sin gradientes, sin glows, sin pulsos neón.
 *
 * Props:
 *   action              — Objeto de la tarea prioritaria (o null si no hay).
 *   onStartStudySession — Redirige al Pomodoro con esta tarea cargada.
 *   onOpenAddTaskModal  — Abre el modal de nueva tarea (estado vacío).
 */

export default function ActionBanner({ action, onStartStudySession, onOpenAddTaskModal }) {
  // Estado vacío: no hay tareas pendientes
  if (!action) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass-lg p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Sin tareas pendientes</p>
          <p className="text-xs text-text-muted mt-1">
            Registra tus entregas y exámenes para que el mentor priorice tu tiempo.
          </p>
        </div>
        <button
          onClick={onOpenAddTaskModal}
          className="px-4 py-2 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Añadir tarea
        </button>
      </div>
    );
  }

  // Estado activo: hay una tarea prioritaria
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass-lg p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div className="space-y-2 min-w-0">
          {/* Etiqueta de urgencia */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-glass">
              Acción inmediata
            </span>
            <span className="text-xs text-text-muted">{action.subject}</span>
            <span className="flex items-center gap-1 text-xs text-text-subtle">
              <Clock className="w-3 h-3" />
              {action.estimatedTimeMinutes} min
            </span>
          </div>

          {/* Título */}
          <h2 className="text-lg font-semibold text-white leading-snug">
            {action.title}
          </h2>

          {/* Razón */}
          <p className="text-xs text-text-muted leading-relaxed">
            {action.priorityReason}
          </p>
        </div>

        {/* Botón de acción */}
        <button
          onClick={() => onStartStudySession(action)}
          className="px-5 py-2.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
        >
          Iniciar sesión
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
