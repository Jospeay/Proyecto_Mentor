import React, { useState } from 'react';
import { X, Calculator, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { calculateNeededGrade } from '../utils/studentLogic';

/**
 * COMPONENTE: GradeSimulatorModal.jsx — Simulador de Calificaciones.
 * 
 * Permite al estudiante ver su ponderación de notas actual y simular
 * exactamente qué calificación necesita sacar en la evaluación final.
 * Diseño limpio estilo Notion.
 * 
 * Props:
 *   isOpen       — Visibilidad.
 *   onClose      — Cierra el modal.
 *   subject      — Asignatura a simular.
 *   onUpdateRubrics — Callback para guardar los rubros en la asignatura.
 */

export default function GradeSimulatorModal({ isOpen, onClose, subject, onUpdateRubrics }) {
  if (!isOpen || !subject) return null;

  // Estado inicial de rubros (por defecto si no tiene aún)
  const [rubrics, setRubrics] = useState(() => {
    if (subject.rubrics && subject.rubrics.length > 0) {
      return subject.rubrics;
    }
    return [
      { id: 'r1', name: 'Primer Parcial', weightPct: 30, currentScore: 85, isFinal: false },
      { id: 'r2', name: 'Segundo Parcial', weightPct: 30, currentScore: 78, isFinal: false },
      { id: 'r3', name: 'Tareas y Trabajos', weightPct: 20, currentScore: 90, isFinal: false },
      { id: 'r4', name: 'Examen Final', weightPct: 20, currentScore: null, isFinal: true },
    ];
  });

  const [targetGrade, setTargetGrade] = useState(subject.targetGrade || 85);

  // Cálculo en tiempo real usando studentLogic.js
  const calcResult = calculateNeededGrade(rubrics, targetGrade);

  // Handlers para la tabla
  const handleScoreChange = (id, newScore) => {
    const val = newScore === '' ? null : Math.min(100, Math.max(0, Number(newScore)));
    setRubrics(rubrics.map((r) => (r.id === id ? { ...r, currentScore: val } : r)));
  };

  const handleWeightChange = (id, newWeight) => {
    const val = Math.min(100, Math.max(0, Number(newWeight)));
    setRubrics(rubrics.map((r) => (r.id === id ? { ...r, weightPct: val } : r)));
  };

  const handleAddRubric = () => {
    const newRubric = {
      id: `r_${Date.now()}`,
      name: 'Nuevo Rubro',
      weightPct: 10,
      currentScore: null,
      isFinal: false,
    };
    setRubrics([...rubrics, newRubric]);
  };

  const handleDeleteRubric = (id) => {
    setRubrics(rubrics.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    if (onUpdateRubrics) {
      onUpdateRubrics(subject.id, { rubrics, targetGrade });
    }
    onClose();
  };

  const totalWeight = rubrics.reduce((acc, r) => acc + Number(r.weightPct || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-zinc-900/95 border border-zinc-700/50 rounded-glass-lg p-6 space-y-6 shadow-2xl animate-fadeIn">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-zinc-700/50 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-glass bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Simulador de Calificaciones</h3>
              <p className="text-xs text-text-muted">{subject.name} ({subject.code})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-glass text-text-subtle hover:text-white hover:bg-glass-bg-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel de Meta Deseada */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-glass p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Nota Meta Deseada (0 - 100)</label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="60"
                max="100"
                value={targetGrade}
                onChange={(e) => setTargetGrade(Number(e.target.value))}
                className="w-20 bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-1.5 text-sm font-semibold text-white text-center focus:outline-none focus:border-brand-500"
              />
              <span className="text-xs text-text-subtle">
                Nota acumulada actual: <strong className="text-white">{calcResult.accumulatedScore} / 100</strong>
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-text-subtle block">Suma de Ponderación</span>
            <span className={`text-sm font-bold ${totalWeight === 100 ? 'text-green-400' : 'text-amber-400'}`}>
              {totalWeight}% {totalWeight !== 100 && '(Debe sumar 100%)'}
            </span>
          </div>
        </div>

        {/* BANNER DINÁMICO DE RESULTADO */}
        <div className={`p-4 rounded-glass border text-xs leading-relaxed flex items-start gap-3 ${
          calcResult.status === 'passed' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          calcResult.status === 'impossible' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          'bg-brand-500/10 border-brand-500/30 text-white'
        }`}>
          <Calculator className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-semibold mb-0.5">Dictamen del Simulador:</strong>
            {calcResult.message}
          </div>
        </div>

        {/* TABLA ESTILO NOTION DE RUBROS Y NOTAS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-text-muted px-2">
            <span>Evaluación / Rubro</span>
            <div className="flex items-center space-x-6 pr-8">
              <span>Peso (%)</span>
              <span>Nota (0-100)</span>
            </div>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {rubrics.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs">
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => setRubrics(rubrics.map(item => item.id === r.id ? { ...item, name: e.target.value } : item))}
                  className="bg-transparent font-medium text-white focus:outline-none focus:underline w-48"
                  placeholder="Nombre de evaluación"
                />

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={r.weightPct}
                      onChange={(e) => handleWeightChange(r.id, e.target.value)}
                      className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center text-white focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-text-subtle">%</span>
                  </div>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={r.isFinal}
                    placeholder={r.isFinal ? 'Final' : 'S/N'}
                    value={r.currentScore === null ? '' : r.currentScore}
                    onChange={(e) => handleScoreChange(r.id, e.target.value)}
                    className={`w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center font-semibold ${
                      r.isFinal ? 'text-brand-400 placeholder-brand-400/60' : 'text-white'
                    } focus:outline-none focus:border-brand-500`}
                  />

                  <button
                    onClick={() => handleDeleteRubric(r.id)}
                    className="p-1 text-text-subtle hover:text-red-400 transition-colors"
                    title="Eliminar Rubro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddRubric}
            className="text-xs text-brand-400 hover:underline flex items-center gap-1 px-2 pt-1 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Evaluación
          </button>
        </div>

        {/* Pie y Guardar */}
        <div className="flex justify-end space-x-2 border-t border-zinc-700/50 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-glass text-xs text-text-muted hover:text-white hover:bg-glass-bg-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-medium transition-colors"
          >
            Guardar Configuración
          </button>
        </div>

      </div>
    </div>
  );
}
