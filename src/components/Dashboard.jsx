import React from 'react';
import ActionBanner from './ActionBanner';
import MentorAiChat from './MentorAiChat';
import { BookOpen, Plus, Clock, CheckCircle2, Calculator, Minus, Globe, Sparkles, Bell, HelpCircle, AlertTriangle } from 'lucide-react';
import { calculateAbsenceStatus } from '../utils/studentLogic';
import { getLatestAiAlert } from '../services/universityPortalService';

/**
 * COMPONENTE: Dashboard.jsx — Panel de control principal de Mentor.
 */

export default function Dashboard({
  mentorState,
  onStartStudySession,
  setCurrentView,
  onOpenAddSubjectModal,
  onOpenAddTaskModal,
  onCompleteTask,
  user,
  onUpdateSubjectAbsences,
  onOpenUniversityPortalModal,
  onOpenHelpGuideModal,
}) {
  const { immediateAction, tasks = [], subjects = [] } = mentorState;
  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const latestAiAlert = getLatestAiAlert();

  const handleAbsenceChange = (subject, delta) => {
    const current = subject.currentAbsences || 0;
    const newCount = Math.max(0, current + delta);
    if (onUpdateSubjectAbsences) {
      onUpdateSubjectAbsences(subject.id, newCount);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto pb-16 select-none">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-pm-text">
            Hola, {user?.displayName || 'Estudiante'}
          </h2>
          <p className="text-sm text-pm-muted mt-0.5">
            {subjects.length} asignaturas · {pending.length} tareas pendientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHelpGuideModal}
            className="px-3 py-1.5 rounded-pm bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-xs text-amber-400 font-medium transition-all flex items-center gap-1.5"
            title="Ver Guía del Estudiante y Centro de Ayuda"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Guía de Uso
          </button>
          <button
            onClick={onOpenUniversityPortalModal}
            className="px-3 py-1.5 rounded-pm bg-pm-card hover:bg-pm-hover border border-pm-border text-xs text-pm-accent hover:text-white transition-colors flex items-center gap-1.5 font-medium"
            title="Conectar o Simular UAM Virtual (Moodle)"
          >
            <Globe className="w-3.5 h-3.5" /> UAM Virtual
          </button>
          <button
            onClick={onOpenAddSubjectModal}
            className="px-3 py-1.5 rounded-pm border border-pm-border text-xs text-pm-muted hover:text-pm-text hover:bg-pm-hover transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Asignatura
          </button>
          <button
            onClick={onOpenAddTaskModal}
            className="px-3 py-1.5 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Tarea
          </button>
        </div>
      </div>

      {/* Alerta Proactiva del Mentor IA si existe */}
      {latestAiAlert && (
        <div
          className={`border rounded-pm-lg p-4 flex items-start justify-between gap-4 shadow-md transition-all ${
            latestAiAlert.riskLevel === 'critical'
              ? 'bg-pm-red/10 border-pm-red/30 text-pm-text'
              : latestAiAlert.riskLevel === 'high'
              ? 'bg-pm-amber/10 border-pm-amber/30 text-pm-text'
              : 'bg-pm-surface border-pm-accent/30 text-pm-text'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div
              className={`p-2 rounded-full shrink-0 ${
                latestAiAlert.riskLevel === 'critical'
                  ? 'bg-pm-red/20 text-pm-red'
                  : latestAiAlert.riskLevel === 'high'
                  ? 'bg-pm-amber/20 text-pm-amber'
                  : 'bg-pm-accent/20 text-pm-accent'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-pm-text">
                  Mentor IA: Análisis de Carga Académica
                </p>
                <span
                  className={`text-[9px] px-1.5 py-0.25 rounded uppercase font-bold tracking-wider ${
                    latestAiAlert.riskLevel === 'critical'
                      ? 'bg-pm-red/20 text-pm-red'
                      : latestAiAlert.riskLevel === 'high'
                      ? 'bg-pm-amber/20 text-pm-amber'
                      : 'bg-pm-accent/20 text-pm-accent'
                  }`}
                >
                  Riesgo {latestAiAlert.riskLevel}
                </span>
              </div>
              <p className="text-xs text-pm-muted mt-1 leading-relaxed">
                {latestAiAlert.message}
              </p>
              {latestAiAlert.calendarAdjustment && (
                <p className="text-[11px] text-pm-accent font-medium mt-1">
                  💡 Ajuste sugerido: {latestAiAlert.calendarAdjustment}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onOpenUniversityPortalModal}
            className="text-xs text-pm-accent hover:underline shrink-0 font-medium pt-1"
          >
            Ver Portal
          </button>
        </div>
      )}

      {/* Banner del Portal UAM Virtual */}
      <div className="bg-pm-surface border border-pm-accent/30 rounded-pm-lg p-3.5 flex items-center justify-between gap-3 bg-gradient-to-r from-pm-card via-pm-surface to-pm-card shadow-sm hover:border-pm-accent/50 transition-all">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-pm-accent/20 border border-pm-accent/40 flex items-center justify-center text-pm-accent shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-pm-text flex items-center gap-1.5">
              Conexión UAM Virtual Nicaragua <span className="w-2 h-2 rounded-full bg-pm-green inline-block animate-pulse" />
            </p>
            <p className="text-[11px] text-pm-subtle">
              Monitoreando uamvirtual.uam.edu.ni para notificar en vivo al abrirse laboratorios o exámenes.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenUniversityPortalModal}
          className="px-3 py-1.5 rounded bg-pm-hover border border-pm-border text-xs text-pm-text hover:bg-pm-border transition-colors shrink-0"
        >
          Probar / Ajustar UAM
        </button>
      </div>

      {/* Acción Inmediata */}
      <ActionBanner
        action={immediateAction}
        onStartStudySession={onStartStudySession}
        onOpenAddTaskModal={onOpenAddTaskModal}
      />

      {/* Chat de Mentor Integrado en Inicio */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-pm-text flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> Tutor Académico Mentor
          </h3>
          <button
            onClick={onOpenHelpGuideModal}
            className="text-xs text-pm-accent hover:underline flex items-center gap-1"
          >
            <HelpCircle className="w-3 h-3" /> ¿Cómo me ayuda Mentor?
          </button>
        </div>
        <MentorAiChat mentorState={mentorState} />
      </section>

      {/* Estado vacío principal */}
      {subjects.length === 0 && pending.length === 0 ? (
        <div className="bg-pm-surface border border-pm-border rounded-pm-lg p-10 text-center space-y-4">
          <BookOpen className="w-10 h-10 text-pm-subtle mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-pm-text">
              Aún no tienes asignaturas registradas
            </h3>
            <p className="text-sm text-pm-muted mt-1 max-w-md mx-auto">
              Comencemos a organizar tu semestre. Añade tus clases o sube el sílabo en PDF para extraer las reglas del profesor.
            </p>
          </div>
          <button
            onClick={onOpenAddSubjectModal}
            className="px-5 py-2.5 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Añadir mi primera asignatura
          </button>
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Asignaturas" value={subjects.length} />
            <MetricCard label="Pendientes" value={pending.length} />
            <MetricCard label="Completadas" value={completed.length} />
            <MetricCard
              label="Próximo examen"
              value={getClosestExamLabel(subjects)}
              small
            />
          </div>

          {/* Tareas pendientes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-pm-text">Tareas pendientes</h3>
              <button
                onClick={onOpenAddTaskModal}
                className="text-xs text-pm-accent hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Añadir
              </button>
            </div>

            {pending.length === 0 ? (
              <p className="text-sm text-pm-muted bg-pm-surface border border-pm-border rounded-pm p-4 text-center">
                No tienes tareas pendientes. Crea una nueva para empezar.
              </p>
            ) : (
              <div className="space-y-1">
                {pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={() => onCompleteTask(task.id)}
                    onStudy={() => onStartStudySession(task)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Asignaturas con Gestor de Asistencia Minimalista */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-pm-text">Asignaturas y Asistencia</h3>
              <button
                onClick={() => setCurrentView('subjects')}
                className="text-xs text-pm-accent hover:underline"
              >
                Ver todas
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subjects.slice(0, 4).map((sub) => {
                const absenceInfo = calculateAbsenceStatus(sub.currentAbsences || 0, sub.maxAbsences || 5);
                return (
                  <div
                    key={sub.id}
                    className={`bg-pm-surface border rounded-pm p-4 space-y-2 transition-colors ${
                      absenceInfo.riskLevel === 'danger' ? 'border-pm-red/50' :
                      absenceInfo.riskLevel === 'warning' ? 'border-pm-amber/50' :
                      'border-pm-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-pm-text">{sub.name}</p>
                      <span className="text-[10px] text-pm-subtle bg-pm-card px-2 py-0.5 rounded border border-pm-border">
                        {sub.code}
                      </span>
                    </div>

                    <p className="text-xs text-pm-muted">Prof: {sub.professor}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-pm-border/40 text-xs">
                      <span className={`text-[11px] font-medium ${absenceInfo.riskLevel === 'danger' ? 'text-pm-red' : absenceInfo.riskLevel === 'warning' ? 'text-pm-amber' : 'text-pm-muted'}`}>
                        {absenceInfo.currentAbsences}/{absenceInfo.maxAllowedAbsences} faltas
                      </span>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleAbsenceChange(sub, -1)}
                          className="p-1 rounded bg-pm-card hover:bg-pm-hover border border-pm-border text-pm-muted hover:text-pm-text transition-colors"
                          title="Restar falta"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleAbsenceChange(sub, 1)}
                          className="p-1 rounded bg-pm-card hover:bg-pm-hover border border-pm-border text-pm-muted hover:text-pm-text transition-colors"
                          title="Registrar falta"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, small }) {
  return (
    <div className="bg-pm-surface border border-pm-border rounded-pm p-4">
      <p className="text-xs text-pm-muted">{label}</p>
      <p className={`font-semibold text-pm-text mt-1 ${small ? 'text-sm truncate' : 'text-xl'}`}>
        {value}
      </p>
    </div>
  );
}

function TaskRow({ task, onComplete, onStudy }) {
  const urgencyColor = {
    high: 'bg-pm-red',
    medium: 'bg-pm-amber',
    low: 'bg-pm-green',
  };

  return (
    <div className="flex items-center gap-3 bg-pm-surface border border-pm-border rounded-pm px-4 py-3 group hover:bg-pm-hover transition-colors">
      <span className={`w-2 h-2 rounded-full shrink-0 ${urgencyColor[task.urgency] || 'bg-pm-subtle'}`} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-pm-text truncate">{task.title}</p>
        <p className="text-xs text-pm-subtle">{task.subject} · {task.dueDate || 'Sin fecha'}</p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onStudy}
          className="px-2.5 py-1 rounded-pm text-xs text-pm-accent hover:bg-pm-accent/10 transition-colors"
        >
          Estudiar
        </button>
        <button
          onClick={onComplete}
          title="Marcar como completada"
          className="p-1.5 rounded-pm text-pm-subtle hover:text-pm-green hover:bg-pm-hover transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function getClosestExamLabel(subjects) {
  const withExams = subjects
    .filter((s) => s.nextExam && s.nextExam !== 'Sin fecha definida')
    .map((s) => ({ ...s, examDate: new Date(s.nextExam) }))
    .filter((s) => !isNaN(s.examDate))
    .sort((a, b) => a.examDate - b.examDate);

  if (withExams.length === 0) return 'N/A';

  const days = Math.ceil((withExams[0].examDate - new Date()) / (1000 * 60 * 60 * 24));
  return days > 0 ? `${days} días` : 'Hoy';
}
