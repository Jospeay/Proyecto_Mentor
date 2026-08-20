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
      <div className="w-full max-w-md bg-pm-surface border border-pm-red/40 rounded-pm-lg p-6 space-y-5 shadow-2xl animate-fadeIn">
        
        {/* Encabezado */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-pm bg-pm-red/15 border border-pm-red/30 flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5 text-pm-red" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-pm-red uppercase tracking-wider">
              Regla Anti-Burnout Activada
            </span>
            <h3 className="text-base font-semibold text-pm-text">Límite de Estudio Alcanzado</h3>
          </div>
        </div>

        {/* Mensaje del Mentor */}
        <div className="bg-pm-card border border-pm-border rounded-pm p-4 space-y-2 text-xs text-pm-muted leading-relaxed">
          <p className="text-pm-text font-medium">
            Has acumulado <strong className="text-pm-accent">{hoursStudied} horas</strong> de concentración el día de hoy.
          </p>
          <p>
            El cerebro humano reduce drásticamente la retención a largo plazo tras 4 horas de carga cognitiva intensa. Continuar sin pausa generará agotamiento prematuro para tus exámenes.
          </p>
        </div>

        {/* Recomendación Estricta */}
        <div className="p-3 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl text-xs space-y-1">
          <span className="text-pm-accent font-semibold block">💬 Exigencia del Mentor:</span>
          <p className="text-pm-subtle">
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
            className="flex-1 py-2.5 rounded-full btn-primary text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Coffee className="w-4 h-4" />
            <span>Tomar Descanso de 30 min</span>
          </button>
          
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-pm border border-pm-border text-xs text-pm-muted hover:text-pm-text hover:bg-pm-hover transition-colors"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
