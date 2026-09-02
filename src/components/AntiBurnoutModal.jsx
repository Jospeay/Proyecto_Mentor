import React from 'react';
import { ShieldAlert, Coffee, Clock, ArrowRight, Check } from 'lucide-react';

/**
 * COMPONENTE: AntiBurnoutModal.jsx — Alerta de Agotamiento del Mentor.
 * 
 * Se despliega automáticamente cuando el usuario suma más de 4 horas (240 min)
 * de estudio acumuladas en un solo día.
 * 
 * Props:
 *   isOpen       — Visibilidad.
 *   onClose      — Cierra el modal.
 *   hoursStudied — Horas acumuladas hoy.
 *   onTakeBreak  — Inicia descanso programado.
 */

export default function AntiBurnoutModal({ isOpen, onClose, hoursStudied = 4.2, onTakeBreak }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none">
      <div className="w-full max-w-md bg-zinc-900/95 border border-red-500/40 rounded-glass-2xl p-6 space-y-5 shadow-2xl animate-fadeIn">
        
        {/* Encabezado */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-glass bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
              Regla Anti-Burnout Activada
            </span>
            <h3 className="text-base font-semibold text-white">Límite de Estudio Alcanzado</h3>
          </div>
        </div>

        {/* Mensaje del Mentor */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-glass p-4 space-y-2 text-xs text-text-muted leading-relaxed">
          <p className="text-white font-medium">
            Has acumulado <strong className="text-brand-400">{hoursStudied} horas</strong> de concentración el día de hoy.
          </p>
          <p>
            El cerebro humano reduce drásticamente la retención a largo plazo tras 4 horas de carga cognitiva intensa. Continuar sin pausa generará agotamiento prematuro para tus exámenes.
          </p>
        </div>

        {/* Recomendación Estricta */}
        <div className="p-3 bg-zinc-900/95 border border-zinc-700 rounded-glass text-xs space-y-1">
          <span className="text-brand-400 font-semibold block">💬 Exigencia del Mentor:</span>
          <p className="text-text-subtle">
            "Toma una pausa de al menos 30 minutos sin pantallas antes de continuar. Tus tareas pendientes han sido protegidas."
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={() => {
              if (onTakeBreak) onTakeBreak();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Coffee className="w-4 h-4" />
            <span>Tomar Descanso de 30 min</span>
          </button>
          
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-glass border border-zinc-700 text-xs text-text-muted hover:text-text-primary hover:bg-zinc-800 transition-colors"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
