import React, { useState } from 'react';
import {
  BookOpen,
  User,
  Plus,
  Trash2,
  Calculator,
  Minus,
  Play,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { calculateAbsenceStatus } from '../utils/studentLogic';
import GradeSimulatorModal from './GradeSimulatorModal';
import SubjectDetailsModal from './SubjectDetailsModal';

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
  onDeleteSubject,
  onEditTask,
  onUpdateSubjectAbsences,
  onUpdateRubrics,
  onAddResource,
  onDeleteResource,
  onEditResource,
  onStartStudySession,
  onCompleteTask,
  onUpdateTaskStatus,
}) {
  const [selectedSubjectForCalc, setSelectedSubjectForCalc] = useState(null);
  const [selectedSubjectForDetails, setSelectedSubjectForDetails] = useState(null);

  const handleAbsenceChange = (e, subject, delta) => {
    e.stopPropagation();
    const current = subject.currentAbsences || 0;
    const newCount = Math.max(0, current + delta);
    if (onUpdateSubjectAbsences) {
      onUpdateSubjectAbsences(subject.id, newCount);
    }
  };

  // HANDLERS DRAG & DROP NATIVO
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetStatus, targetSubjectId, targetSubjectName) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onUpdateTaskStatus) {
      onUpdateTaskStatus(taskId, targetStatus, targetSubjectId, targetSubjectName);
      toast.success(`Tarea movida a ${targetStatus === 'todo' ? 'Por Hacer' : targetStatus === 'in_progress' ? 'En Progreso' : 'Entregado'}`);
    }
  };

  const cycleTaskStatus = (task, e) => {
    e.stopPropagation();
    const statusCycle = { todo: 'in_progress', in_progress: 'completed', completed: 'todo' };
    const nextStatus = statusCycle[task.status || 'todo'];
    if (onUpdateTaskStatus) {
      onUpdateTaskStatus(task.id, nextStatus, task.subjectId, task.subject);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden select-none">
      {/* Encabezado fijo superior */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-pm-text flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-pm-muted" />
            Mis Clases (Tablero Kanban)
          </h2>
          <p className="text-xs text-pm-muted mt-0.5">
            Organiza tus materias, edita datos, arrastra tareas entre estados y gestiona materiales de apoyo.
          </p>
        </div>
        <button
          onClick={onOpenAddSubjectModal}
          className="px-3.5 py-2 rounded-full btn-primary text-xs font-semibold transition-all shadow flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva Materia
        </button>
      </div>

      {/* Área del tablero scrollable horizontalmente */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {subjects.length === 0 ? (
          <div className="max-w-md mx-auto my-12 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-10 text-center space-y-4 shadow-glass">
            <BookOpen className="w-12 h-12 text-pm-subtle mx-auto animate-pulse" />
            <h3 className="text-base font-semibold text-pm-text">No hay asignaturas registradas</h3>
            <p className="text-xs text-pm-muted max-w-sm mx-auto">
              Añade tus asignaturas del ciclo escolar para verlas ordenadas en el tablero Trello con sus entregables y notas.
            </p>
            <button
              onClick={onOpenAddSubjectModal}
              className="px-5 py-2.5 rounded-full btn-primary text-xs font-medium transition-colors inline-flex items-center gap-2"
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
              const subjectTasks = tasks.filter(
                (t) =>
                  t.subjectId === sub.id ||
                  t.subject?.toLowerCase() === sub.name?.toLowerCase()
              );

              const todoTasks = subjectTasks.filter(
                (t) => t.status === 'todo' || (!t.status && !t.completed)
              );
              const inProgressTasks = subjectTasks.filter((t) => t.status === 'in_progress');
              const completedTasks = subjectTasks.filter(
                (t) => t.status === 'completed' || (!t.status && t.completed)
              );

              const absenceInfo = calculateAbsenceStatus(
                sub.currentAbsences || 0,
                sub.maxAbsences || 5
              );
              const resourcesCount = (sub.resources || []).length;

              return (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 }
                  }}
                  key={sub.id}
                  className="w-80 shrink-0 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col max-h-full shadow-glass transition-all duration-300"
                >
                  {/* CABECERA DE MATERIA */}
                  <div
                    onClick={() => setSelectedSubjectForDetails(sub)}
                    className={`p-4 border-b border-white/10 space-y-2 shrink-0 cursor-pointer hover:bg-white/10 transition-all duration-300 rounded-t-2xl border-t-4 ${
                      absenceInfo.riskLevel === 'danger'
                        ? 'border-t-pm-red'
                        : absenceInfo.riskLevel === 'warning'
                        ? 'border-t-pm-amber'
                        : 'border-t-pm-accent/40'
                    }`}
                    title="Clic para abrir Hub de Recursos y Detalles"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <span className="text-[9px] text-pm-accent font-semibold tracking-wider uppercase bg-pm-accent/10 px-1.5 py-0.5 rounded border border-pm-accent/20 inline-block mb-1">
                          {sub.code}
                        </span>
                        <h3 className="text-sm font-bold text-pm-text truncate group-hover:text-pm-accent" title={sub.name}>
                          {sub.name}
                        </h3>
                        <p className="text-[11px] text-pm-muted truncate flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-pm-subtle" /> {sub.professor}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Botón Editar Asignatura */}
                        {onEditSubject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSubject(sub);
                            }}
                            className="p-1 rounded text-pm-subtle hover:text-pm-accent hover:bg-pm-hover transition-colors"
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
                            className="p-1 rounded text-pm-subtle hover:text-pm-red hover:bg-pm-hover transition-colors"
                            title="Eliminar materia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Asistencias */}
                    <div className="flex items-center justify-between bg-white/[0.06] border border-white/10 rounded-xl px-2 py-1 text-[11px]">
                      <span className={`font-semibold text-[10.5px] ${absenceInfo.badgeStyle}`}>
                        Faltas: {absenceInfo.currentAbsences}/{absenceInfo.maxAllowedAbsences}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleAbsenceChange(e, sub, -1)}
                          className="p-0.5 rounded bg-pm-surface hover:bg-pm-hover border border-pm-border text-pm-muted hover:text-pm-text transition-all"
                          title="Restar falta"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => handleAbsenceChange(e, sub, 1)}
                          className="p-0.5 rounded bg-pm-surface hover:bg-pm-hover border border-pm-border text-pm-muted hover:text-pm-text transition-all"
                          title="Registrar falta"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Info de Recursos y Simulador */}
                    <div className="flex items-center justify-between text-[10.5px] pt-1 text-pm-muted border-t border-pm-border/20">
                      <span className="hover:underline text-pm-accent flex items-center gap-1 font-semibold">
                        Materiales ({resourcesCount})
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubjectForCalc(sub);
                        }}
                        className="text-[10px] text-pm-muted hover:text-pm-text flex items-center gap-1 font-semibold"
                        title="Simulador de calificaciones"
                      >
                        <Calculator className="w-3 h-3 text-pm-accent" />
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
                        <h4 className="text-[10px] text-pm-red uppercase font-bold tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-pm-red inline-block" />
                          Por Hacer ({todoTasks.length})
                        </h4>
                      </div>

                      <div className="min-h-[55px] bg-white/[0.06] border border-dashed border-pm-border/40 rounded-pm p-1.5 space-y-1.5 transition-colors hover:border-pm-red/30">
                        {todoTasks.length === 0 ? (
                          <div className="text-[10px] text-pm-subtle py-2.5 text-center">
                            Suelta tareas aquí
                          </div>
                        ) : (
                          todoTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onDragStart={handleDragStart}
                              onEditTask={onEditTask}
                              onCycleStatus={cycleTaskStatus}
                              onStartStudy={onStartStudySession}
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
                        <h4 className="text-[10px] text-pm-amber uppercase font-bold tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-pm-amber inline-block" />
                          En Progreso ({inProgressTasks.length})
                        </h4>
                      </div>

                      <div className="min-h-[55px] bg-white/[0.06] border border-dashed border-pm-border/40 rounded-pm p-1.5 space-y-1.5 transition-colors hover:border-pm-amber/30">
                        {inProgressTasks.length === 0 ? (
                          <div className="text-[10px] text-pm-subtle py-2.5 text-center">
                            Suelta tareas aquí
                          </div>
                        ) : (
                          inProgressTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onDragStart={handleDragStart}
                              onEditTask={onEditTask}
                              onCycleStatus={cycleTaskStatus}
                              onStartStudy={onStartStudySession}
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
                        <h4 className="text-[10px] text-pm-green uppercase font-bold tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-pm-green inline-block" />
                          Entregado ({completedTasks.length})
                        </h4>
                      </div>

                      <div className="min-h-[55px] bg-white/[0.06] border border-dashed border-pm-border/40 rounded-pm p-1.5 space-y-1.5 transition-colors hover:border-pm-green/30">
                        {completedTasks.length === 0 ? (
                          <div className="text-[10px] text-pm-subtle py-2.5 text-center">
                            Suelta tareas aquí
                          </div>
                        ) : (
                          completedTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              className="bg-white/[0.06] border border-pm-border/60 rounded p-2.5 space-y-1.5 cursor-grab active:cursor-grabbing transition-all opacity-75 hover:opacity-100 hover:border-pm-green/40 shadow-sm group"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-[11.5px] font-medium text-pm-muted line-through truncate">
                                  {task.title}
                                </p>
                                {onEditTask && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditTask(task);
                                    }}
                                    className="p-0.5 rounded text-pm-subtle hover:text-pm-text opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Editar tarea"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-pm-border/20 text-[9px] text-pm-subtle">
                                <span>Entregado</span>
                                <button
                                  onClick={(e) => cycleTaskStatus(task, e)}
                                  className="px-1 py-0.25 rounded bg-pm-surface hover:bg-pm-hover border border-pm-border text-[8.5px] text-pm-subtle hover:text-pm-text"
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
      />
    </div>
  );
}

function TaskCard({ task, onDragStart, onEditTask, onCycleStatus, onStartStudy }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-3 space-y-2 hover:bg-white/10 hover:border-emerald-400/40 hover:-translate-y-1 hover:shadow-glow-emerald cursor-grab active:cursor-grabbing transition-all duration-300 shadow-glass group"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11.5px] font-medium text-pm-text leading-snug break-words">
          {task.title}
        </p>
        {onEditTask && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditTask(task);
            }}
            className="p-0.5 rounded text-pm-subtle hover:text-pm-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Editar tarea"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-pm-border/30 text-[9.5px] text-pm-muted">
        <span>Vence: {task.dueDate || 'Sin fecha'}</span>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={(e) => onCycleStatus(task, e)}
            className="px-1.5 py-0.5 rounded bg-pm-surface hover:bg-pm-hover border border-pm-border text-[9px] text-pm-muted hover:text-pm-text"
            title="Mover al siguiente estado"
          >
            ➔
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartStudy && onStartStudy(task);
            }}
            className="p-0.5 rounded bg-pm-surface hover:bg-pm-accent/20 hover:text-pm-accent border border-pm-border"
            title="Estudiar (Pomodoro)"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
