import React, { useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  User,
  Plus,
  Trash2,
  Calculator,
  Minus,
  Timer,
  Pencil,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { calculateAbsenceStatus } from '../utils/studentLogic';
import GradeSimulatorModal from './GradeSimulatorModal';
import SubjectDetailsModal from './SubjectDetailsModal';
import TaskFocusModal from './TaskFocusModal';

// Paleta de 8 colores para asignaturas (sobre fondo zinc-900)
const SUBJECT_COLORS = [
  { border: 'border-t-emerald-500', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', ring: 'ring-emerald-500/30', dot: 'bg-emerald-500' },
  { border: 'border-t-blue-500',   badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',     ring: 'ring-blue-500/30', dot: 'bg-blue-500' },
  { border: 'border-t-violet-500', badge: 'text-violet-400 bg-violet-500/10 border-violet-500/20', ring: 'ring-violet-500/30', dot: 'bg-violet-500' },
  { border: 'border-t-amber-500',  badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   ring: 'ring-amber-500/30', dot: 'bg-amber-500' },
  { border: 'border-t-rose-500',   badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20',     ring: 'ring-rose-500/30', dot: 'bg-rose-500' },
  { border: 'border-t-cyan-500',   badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',     ring: 'ring-cyan-500/30', dot: 'bg-cyan-500' },
  { border: 'border-t-sky-500',    badge: 'text-sky-400 bg-sky-500/10 border-sky-500/20',       ring: 'ring-sky-500/30', dot: 'bg-sky-500' },
  { border: 'border-t-fuchsia-500', badge: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20', ring: 'ring-fuchsia-500/30', dot: 'bg-fuchsia-500' },
];

function getSubjectColor(code, colorIndex) {
  // Si el usuario eligió un color manualmente, usarlo
  if (typeof colorIndex === 'number' && colorIndex >= 0 && colorIndex < SUBJECT_COLORS.length) {
    return SUBJECT_COLORS[colorIndex];
  }
  if (!code) return SUBJECT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

/**
 * COMPONENTE: SubjectList.jsx — Vista de asignaturas del semestre en estilo Tablero Trello (Kanban).
 * 
 * Soporta:
 * - Edición de asignaturas y tareas (botones sutiles de lápiz).
 * - Drag and Drop nativo de HTML5 para mover tareas entre columnas de estado.
 * - Hub de Recursos con edición inline y Drag & Drop de archivos.
 */
export default function SubjectList({
  subjects = [],
  tasks = [],
  onOpenAddSubjectModal,
  onEditSubject,
  onUpdateSubject,
  onDeleteSubject,
  onEditTask,
  onUpdateSubjectAbsences,
  onUpdateRubrics,
  onAddResource,
  onDeleteResource,
  onEditResource,
  onCompleteTask,
  onDeleteTask,
  onUpdateTaskStatus,
}) {
  const [selectedSubjectForCalc, setSelectedSubjectForCalc] = useState(null);
  const [selectedSubjectForDetails, setSelectedSubjectForDetails] = useState(null);
  const [focusTask, setFocusTask] = useState(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(null);

  // Cerrar paleta de color al hacer clic fuera
  React.useEffect(() => {
    if (colorPickerOpen === null) return;
    const handler = () => setColorPickerOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [colorPickerOpen]);

  const handleAbsenceChange = (e, subject, delta) => {
    e.stopPropagation();
    const current = subject.currentAbsences || 0;
    const newCount = Math.max(0, current + delta);
    if (onUpdateSubjectAbsences) {
      onUpdateSubjectAbsences(subject.id, newCount);
    }
  };

  // HANDLERS DRAG & DROP NATIVO
  const handleDragStart = useCallback((e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e, targetStatus, targetSubjectId, targetSubjectName) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onUpdateTaskStatus) {
      onUpdateTaskStatus(taskId, targetStatus, targetSubjectId, targetSubjectName);
      toast.success(`Tarea movida a ${targetStatus === 'todo' ? 'Por Hacer' : targetStatus === 'in_progress' ? 'En Progreso' : 'Entregado'}`);
    }
  }, [onUpdateTaskStatus]);

  const cycleTaskStatus = useCallback((task, e) => {
    e.stopPropagation();
    const statusCycle = { todo: 'in_progress', in_progress: 'completed', completed: 'todo' };
    const nextStatus = statusCycle[task.status || 'todo'];
    if (onUpdateTaskStatus) {
      onUpdateTaskStatus(task.id, nextStatus, task.subjectId, task.subject);
    }
  }, [onUpdateTaskStatus]);

  const subjectTasksMap = useMemo(() => {
    const map = new Map();
    subjects.forEach((sub) => {
      const subjectTasks = tasks.filter(
        (t) => t.subjectId === sub.id || t.subject?.toLowerCase() === sub.name?.toLowerCase()
      );
      map.set(sub.id, {
        todo: subjectTasks.filter((t) => t.status === 'todo' || (!t.status && !t.completed)),
        in_progress: subjectTasks.filter((t) => t.status === 'in_progress'),
        completed: subjectTasks.filter((t) => t.status === 'completed' || (!t.status && t.completed)),
      });
    });
    return map;
  }, [subjects, tasks]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden select-none">
      {/* Encabezado fijo superior */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 bg-bg-primary shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-text-muted" />
            Mis Clases (Tablero Kanban)
          </h2>
          <p className="text-xs text-text-subtle mt-1">
            Organiza tus materias, edita datos, arrastra tareas entre estados y gestiona materiales de apoyo.
          </p>
        </div>
        <button
          onClick={onOpenAddSubjectModal}
          className="px-3.5 py-2 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-semibold transition-all shadow flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva Materia
        </button>
      </div>

      {/* Área del tablero scrollable horizontalmente */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto p-6 bg-bg-primary">
        {subjects.length === 0 ? (
          <div className="max-w-md mx-auto my-12 bg-zinc-900/60 border border-zinc-700/50 rounded-glass-lg p-10 text-center space-y-4 shadow-xl">
            <BookOpen className="w-12 h-12 text-text-subtle mx-auto animate-pulse" />
            <h3 className="text-base font-semibold text-text-primary">No hay asignaturas registradas</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Añade tus asignaturas del ciclo escolar para verlas ordenadas en el tablero Trello con sus entregables y notas.
            </p>
            <button
              onClick={onOpenAddSubjectModal}
              className="px-5 py-2.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Añadir mi primera asignatura
            </button>
          </div>
        ) : (
          <motion.div 
            className="flex gap-5 h-full items-start pb-4"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
          >
            {subjects.map((sub) => {
              const grouped = subjectTasksMap.get(sub.id) || { todo: [], in_progress: [], completed: [] };
              const todoTasks = grouped.todo;
              const inProgressTasks = grouped.in_progress;
              const completedTasks = grouped.completed;

              const absenceInfo = calculateAbsenceStatus(
                sub.currentAbsences || 0,
                sub.maxAbsences || 5
              );
              const resourcesCount = (sub.resources || []).filter(r => r.category === 'attachments').length;
              const subjectColor = getSubjectColor(sub.code, sub.colorIndex);

              return (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 }
                  }}
                  key={sub.id}
                  className={`shrink-0 bg-zinc-900/60 border border-zinc-700/50 rounded-glass-lg flex flex-col max-h-full shadow-lg transition-all ${
                    subjects.length === 1 ? 'w-full max-w-xl mx-auto' : 'w-80'
                  }`}
                >
                  {/* CABECERA DE MATERIA */}
                  <div
                    onClick={() => setSelectedSubjectForDetails(sub)}
                    className={`p-4 border-b border-zinc-700/50 space-y-2 shrink-0 cursor-pointer hover:bg-zinc-800 transition-all rounded-t-glass-lg border-t-4 ${
                      absenceInfo.riskLevel === 'danger'
                        ? 'border-t-red-500'
                        : absenceInfo.riskLevel === 'warning'
                        ? 'border-t-amber-500'
                        : subjectColor.border
                    }`}
                    title="Clic para abrir Hub de Recursos y Detalles"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <span className={`text-[9px] font-mono font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border inline-block mb-1 ${subjectColor.badge}`}>
                          {sub.code}
                        </span>
                        <h3 className="text-sm font-bold text-text-primary truncate group-hover:text-brand-400" title={sub.name}>
                          {sub.name}
                        </h3>
                        <p className="text-[11px] text-text-muted truncate flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-text-subtle" /> {sub.professor}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 relative">
                        {/* Selector de color */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setColorPickerOpen(colorPickerOpen === sub.id ? null : sub.id);
                            }}
                            className="p-1 rounded text-text-subtle hover:text-text-primary transition-colors"
                            title="Cambiar color de materia"
                          >
                            <span className={`w-3.5 h-3.5 rounded-full inline-block border border-zinc-600 ${subjectColor.dot}`} />
                          </button>
                          {colorPickerOpen === sub.id && (
                            <div className="absolute right-0 top-8 z-50 bg-zinc-800 border border-zinc-700 rounded-lg p-2 shadow-xl flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {SUBJECT_COLORS.map((c, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (onUpdateSubject) {
                                      onUpdateSubject(sub.id, { colorIndex: idx });
                                    }
                                    setColorPickerOpen(null);
                                  }}
                                  className={`w-5 h-5 rounded-full ${c.dot} border-2 transition-all ${
                                    (sub.colorIndex === idx) ? 'border-white scale-125' : 'border-transparent hover:border-zinc-400 hover:scale-110'
                                  }`}
                                  title={`Color ${idx + 1}`}
                                />
                              ))}
                              {typeof sub.colorIndex === 'number' && (
                                <button
                                  onClick={() => {
                                    if (onUpdateSubject) {
                                      onUpdateSubject(sub.id, { colorIndex: null });
                                    }
                                    setColorPickerOpen(null);
                                  }}
                                  className="w-5 h-5 rounded-full bg-zinc-600 border-2 border-zinc-500 flex items-center justify-center text-[8px] text-white hover:bg-zinc-500 transition-all"
                                  title="Volver a color automático"
                                >
                                  A
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botón Editar Asignatura */}
                        {onEditSubject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSubject(sub);
                            }}
                            className="p-1 rounded text-text-subtle hover:text-brand-400 hover:bg-zinc-800 transition-colors"
                            title="Editar asignatura"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Botón Eliminar Asignatura */}
                        {onDeleteSubject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`¿Estás seguro de eliminar ${sub.name}?`)) {
                                onDeleteSubject(sub.id);
                              }
                            }}
                            className="p-1 rounded text-text-subtle hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Eliminar materia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Asistencias */}
                    <div className="flex items-center justify-between bg-zinc-800/30 border border-zinc-700/30 rounded px-2 py-1 text-[11px]">
                      <span className={`font-semibold text-[10.5px] ${absenceInfo.badgeStyle}`}>
                        Faltas: {absenceInfo.currentAbsences}/{absenceInfo.maxAllowedAbsences}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleAbsenceChange(e, sub, -1)}
                          className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-text-muted hover:text-text-primary transition-all"
                          title="Restar falta"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => handleAbsenceChange(e, sub, 1)}
                          className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-text-muted hover:text-text-primary transition-all"
                          title="Registrar falta"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Info de Recursos y Simulador */}
                    <div className="flex items-center justify-between text-[10.5px] pt-1 text-text-muted border-t border-zinc-700/30">
                      <span className="hover:underline text-brand-400 flex items-center gap-1 font-semibold">
                        Materiales ({resourcesCount})
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubjectForCalc(sub);
                        }}
                        className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1 font-semibold"
                        title="Simulador de calificaciones"
                      >
                        <Calculator className="w-3 h-3 text-brand-400" />
                        <span>Simular Nota</span>
                      </button>
                    </div>
                  </div>

                  {/* CONTENIDO INTERNO - 3 ZONAS KANBAN */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                    {/* 1. POR HACER */}
                    <div
                      className="space-y-1.5"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'todo', sub.id, sub.name)}
                    >
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] text-red-400 uppercase font-bold tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                          Por Hacer ({todoTasks.length})
                        </h4>
                      </div>

                      <div className="min-h-[55px] bg-zinc-800/20 border border-dashed border-zinc-700/40 rounded-glass p-1.5 space-y-1.5 transition-colors hover:border-red-500/30">
                        {todoTasks.length === 0 ? (
                          <div className="text-[10px] text-text-subtle py-2.5 text-center">
                            Suelta tareas aquí
                          </div>
                        ) : (
                          todoTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onDragStart={handleDragStart}
                              onEditTask={onEditTask}
                              onDeleteTask={onDeleteTask}
                              onCycleStatus={cycleTaskStatus}
                              onStartStudy={setFocusTask}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* 2. EN PROGRESO */}
                    <div
                      className="space-y-1.5"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'in_progress', sub.id, sub.name)}
                    >
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] text-amber-400 uppercase font-bold tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                          En Progreso ({inProgressTasks.length})
                        </h4>
                      </div>

                      <div className="min-h-[55px] bg-zinc-800/20 border border-dashed border-zinc-700/40 rounded-glass p-1.5 space-y-1.5 transition-colors hover:border-amber-500/30">
                        {inProgressTasks.length === 0 ? (
                          <div className="text-[10px] text-text-subtle py-2.5 text-center">
                            Suelta tareas aquí
                          </div>
                        ) : (
                          inProgressTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onDragStart={handleDragStart}
                              onEditTask={onEditTask}
                              onDeleteTask={onDeleteTask}
                              onCycleStatus={cycleTaskStatus}
                              onStartStudy={setFocusTask}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* 3. ENTREGADO */}
                    <div
                      className="space-y-1.5"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'completed', sub.id, sub.name)}
                    >
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] text-green-400 uppercase font-bold tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Entregado ({completedTasks.length})
                        </h4>
                      </div>

                      <div className="min-h-[55px] bg-zinc-800/20 border border-dashed border-zinc-700/40 rounded-glass p-1.5 space-y-1.5 transition-colors hover:border-green-500/30">
                        {completedTasks.length === 0 ? (
                          <div className="text-[10px] text-text-subtle py-2.5 text-center">
                            Suelta tareas aquí
                          </div>
                        ) : (
                          completedTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              className="bg-zinc-800/40 border border-zinc-700/40 rounded p-2.5 space-y-1.5 cursor-grab active:cursor-grabbing transition-all opacity-75 hover:opacity-100 hover:border-green-500/40 shadow-sm group"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-[11.5px] font-medium text-text-muted line-through truncate">
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {onEditTask && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditTask(task);
                                      }}
                                      className="p-0.5 rounded text-text-subtle hover:text-text-primary"
                                      title="Editar tarea"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {onDeleteTask && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`¿Eliminar "${task.title}" permanentemente?`)) {
                                          onDeleteTask(task.id);
                                        }
                                      }}
                                      className="p-0.5 rounded text-text-subtle hover:text-red-400 hover:bg-red-500/10"
                                      title="Eliminar tarea"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-zinc-700/30 text-[9px] text-text-subtle">
                                <div className="flex flex-col gap-0.5">
                                  {task.subjectCode && <span className="text-slate-400 font-mono text-[9px]">{task.subjectCode}</span>}
                                  {task.subject && <span className="text-brand-400 font-medium">📚 {task.subject}</span>}
                                  {task.dueDate && <span>Vence: {task.dueDate}</span>}
                                  {task.createdAt && <span>Creada: {new Date(task.createdAt).toLocaleDateString('es-ES')}</span>}
                                </div>
                                <button
                                  onClick={(e) => cycleTaskStatus(task, e)}
                                  className="px-1 py-0.25 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[8.5px] text-text-subtle hover:text-text-primary"
                                  title="Reabrir tarea"
                                >
                                  ➔ Reabrir
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* MODAL SIMULADOR DE NOTAS */}
      <GradeSimulatorModal
        isOpen={Boolean(selectedSubjectForCalc)}
        onClose={() => setSelectedSubjectForCalc(null)}
        subject={selectedSubjectForCalc}
        onUpdateRubrics={onUpdateRubrics}
      />

      {/* MODAL DETALLES Y HUB DE RECURSOS */}
      <SubjectDetailsModal
        isOpen={Boolean(selectedSubjectForDetails)}
        onClose={() => setSelectedSubjectForDetails(null)}
        subject={selectedSubjectForDetails}
        onAddResource={onAddResource}
        onDeleteResource={onDeleteResource}
        onEditResource={onEditResource}
        onUpdateSubject={onUpdateSubject}
      />
      <TaskFocusModal task={focusTask} onClose={() => setFocusTask(null)} />
    </div>
  );
}

const TaskCard = React.memo(function TaskCard({ task, onDragStart, onEditTask, onDeleteTask, onCycleStatus, onStartStudy }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="bg-zinc-800 border border-zinc-700 rounded p-2.5 space-y-2 hover:border-brand-500/50 hover:-translate-y-1 hover:shadow-lg cursor-grab active:cursor-grabbing transition-all duration-300 shadow-sm group"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11.5px] font-medium text-white leading-snug break-words">
          {task.title}
        </p>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEditTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="p-0.5 rounded text-text-subtle hover:text-brand-400"
              title="Editar tarea"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDeleteTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar "${task.title}" permanentemente?`)) {
                  onDeleteTask(task.id);
                }
              }}
              className="p-0.5 rounded text-text-subtle hover:text-red-400 hover:bg-red-500/10"
              title="Eliminar tarea"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-700/40 text-[9.5px] text-text-muted">
        <div className="flex flex-col gap-0.5">
          {task.subjectCode && <span className="text-slate-400 font-mono text-[9px]">{task.subjectCode}</span>}
          {task.subject && <span className="text-brand-400 font-medium">📚 {task.subject}</span>}
          <span>Vence: {task.dueDate || 'Sin fecha'}</span>
          {task.createdAt && <span>Creada: {new Date(task.createdAt).toLocaleDateString('es-ES')}</span>}
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={(e) => onCycleStatus(task, e)}
            className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[9px] text-text-muted hover:text-text-primary"
            title="Mover al siguiente estado"
          >
            ➔
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartStudy && onStartStudy(task);
            }}
            className="p-0.5 rounded bg-zinc-800 hover:bg-brand-500/20 hover:text-brand-400 border-zinc-700"
            title="Estudiar (Pomodoro)"
          >
            <Timer className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
});
