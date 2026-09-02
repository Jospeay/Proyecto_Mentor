import React, { useMemo, useCallback } from 'react';
import ActionBanner from './ActionBanner';
import MentorAiChat from './MentorAiChat';
import { BookOpen, Plus, Clock, CheckCircle2, Calculator, Minus, Globe, Bell, HelpCircle, Trash2, Flame, Shield, Zap, TrendingUp, Play, Bot } from 'lucide-react';
import { calculateAbsenceStatus } from '../utils/studentLogic';
import { getLatestAiAlert, getPortalConfig, getRecentScrapedTasks, getUnnotifiedScrapedTasks, markNoticeAsNotified, markAllNoticesAsNotified, convertNoticeToTask } from '../services/universityPortalService';
import { motion } from 'framer-motion';

/**
 * COMPONENTE: Dashboard.jsx — Panel de control principal de Mentor.
 * Glassmorphism premium con jerarquía visual, bordes de urgencia y animaciones.
 */

const urgencyStyles = {
  high: { border: 'border-l-4 border-red-500/60', bg: 'bg-red-500/5', icon: 'bg-red-500', text: 'text-red-400' },
  medium: { border: 'border-l-4 border-amber-500/60', bg: 'bg-amber-500/5', icon: 'bg-amber-500', text: 'text-amber-400' },
  low: { border: 'border-l-4 border-green-500/60', bg: 'bg-green-500/5', icon: 'bg-green-500', text: 'text-green-400' },
};

export default function Dashboard({
  mentorState,
  onStartStudySession,
  setCurrentView,
  onOpenAddSubjectModal,
  onOpenAddTaskModal,
  onCompleteTask,
  onDeleteTask,
  user,
  onUpdateSubjectAbsences,
  onOpenUniversityPortalModal,
  onOpenHelpGuideModal,
  onOpenSubjectDetail,
  onAddTaskFromPortal,
}) {
  const { immediateAction, tasks = [], subjects = [] } = mentorState || {};
  const pending = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completed = useMemo(() => tasks.filter((t) => t.completed), [tasks]);
  const latestAiAlert = useMemo(() => getLatestAiAlert(), []);
  const portalConfig = useMemo(() => getPortalConfig(), []);
  const isPortalConfigured = Boolean(portalConfig.username && portalConfig.password);
  const lastSyncLabel = portalConfig.lastSync
    ? new Date(portalConfig.lastSync).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  const scrapedTasks = useMemo(() => getRecentScrapedTasks(), [portalConfig.lastSync]);
  const unimportedScraped = useMemo(() => getUnnotifiedScrapedTasks(), [scrapedTasks]);

  // Ordenar tareas por urgencia y fecha
  const sortedPending = useMemo(() => {
    const urgencyWeight = { high: 3, medium: 2, low: 1 };
    return [...pending].sort((a, b) => {
      const weightDiff = (urgencyWeight[b.urgency] || 1) - (urgencyWeight[a.urgency] || 1);
      if (weightDiff !== 0) return weightDiff;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      return 0;
    });
  }, [pending]);

  const handleAbsenceChange = useCallback((subject, delta) => {
    const current = subject.currentAbsences || 0;
    const newCount = Math.max(0, current + delta);
    if (onUpdateSubjectAbsences) {
      onUpdateSubjectAbsences(subject.id, newCount);
    }
  }, [onUpdateSubjectAbsences]);

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto pb-16 select-none">

      {/* ==================== ENCABEZADO ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative">
          <div className="absolute -top-2 -left-2 w-10 h-10 bg-brand-600/10 rounded-xl opacity-15" />
          <h2 className="text-2xl font-extrabold text-white tracking-tight relative">
            Hola, <span className="text-brand-400">{user?.displayName || 'Estudiante'}</span>
          </h2>
          <p className="text-xs text-text-subtle mt-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
            {subjects.length} materias · <span className="font-medium text-text-primary">{pending.length}</span> pendientes · {completed.length} completadas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenHelpGuideModal}
            className="btn-ghost px-3 py-1.5 rounded-xl gap-1.5"
            title="Ver Guía del Estudiante y Centro de Ayuda"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Guía
          </button>
          <button
            onClick={onOpenUniversityPortalModal}
            className="btn-secondary px-3 py-1.5 rounded-xl gap-1.5"
            title="Conectar con Portal Universitario"
          >
            <Globe className="w-3.5 h-3.5" /> Portal
          </button>
          <button
            onClick={onOpenAddSubjectModal}
            className="btn-secondary px-3 py-1.5 rounded-xl gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Materia
          </button>
          <button
            onClick={onOpenAddTaskModal}
            className="btn-primary px-4 py-1.5 rounded-xl gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Tarea
          </button>
        </div>
      </div>

      {/* ==================== ALERTA PROACTIVA IA ==================== */}
      {latestAiAlert && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden border rounded-2xl p-5 flex items-start justify-between gap-4 transition-all glass-card border-brand-500/30 bg-brand-500/5"
        >
          <div className="absolute bottom-0 left-0 h-1 bg-brand-600" style={{ width: `${{low: 25, medium: 50, high: 75, critical: 75}[latestAiAlert.riskLevel]}%` }} />

          <div className="flex items-start space-x-4 relative z-10">
            <div className="p-3 rounded-xl shrink-0 flex items-center justify-center bg-brand-500/20 text-brand-400">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Mentor IA</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {latestAiAlert.taskCount || 0} nuevas
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{latestAiAlert.message}</p>
              {latestAiAlert.calendarAdjustment && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                  <Zap className="w-4 h-4 text-brand-400 shrink-0" />
                  <span className="text-xs text-brand-300 font-medium">Ajuste:</span>
                  <span className="text-xs text-slate-300">{latestAiAlert.calendarAdjustment}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onOpenUniversityPortalModal}
            className="text-xs text-brand-400 hover:text-brand-300 shrink-0 font-semibold pt-1 hover:underline flex items-center gap-1"
          >
            Ver Portal <Zap className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* ==================== ESTADO CONEXIÓN PORTAL ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden glass-card p-4 flex items-center justify-between gap-4 shadow-glass hover:border-brand-500/30 transition-all"
      >
        <div className="flex items-center space-x-4 relative z-10">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isPortalConfigured
              ? 'bg-zinc-800 border border-zinc-700 text-emerald-400'
              : 'bg-slate-800 border border-slate-700 text-slate-500'
          }`}>
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              Portal Universitario
              {isPortalConfigured && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            </p>
            <p className="text-[11px] text-text-muted">
              {isPortalConfigured
                ? lastSyncLabel
                  ? `Última sync: ${lastSyncLabel}`
                  : 'Credenciales listas. Sincroniza para importar.'
                : 'Configura URL, usuario y contraseña para sync real.'}
            </p>
          </div>
        </div>
        <button
          onClick={onOpenUniversityPortalModal}
          className="btn-secondary px-4 py-2 rounded-xl shrink-0 relative z-10"
        >
          {isPortalConfigured ? 'Sincronizar Ahora' : 'Configurar'}
        </button>
      </motion.div>

      {unimportedScraped.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Tareas del Portal ({unimportedScraped.length})
            </h4>
            <button
              onClick={() => {
                unimportedScraped.forEach((t) => onAddTaskFromPortal?.(convertNoticeToTask(t)));
                markAllNoticesAsNotified();
              }}
              className="text-xs text-brand-400 hover:underline font-medium"
            >
              Importar todas
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {unimportedScraped.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 p-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{task.title}</p>
                  <p className="text-text-muted truncate">
                    {task.subjectName} · {task.dueDate || 'Sin fecha'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onAddTaskFromPortal?.(convertNoticeToTask(task));
                    markNoticeAsNotified(task.title, task.subjectName, task.dueDate);
                  }}
                  className="px-2.5 py-1 rounded bg-brand-500 text-white font-medium shrink-0"
                >
                  Importar
                </button>
              </div>
            ))}
          </div>
          {unimportedScraped.length > 5 && (
            <button
              onClick={() => setCurrentView('university')}
              className="text-xs text-brand-400 hover:underline w-full text-center"
            >
              Ver las {unimportedScraped.length - 5} tareas restantes
            </button>
          )}
        </motion.div>
      )}

      {/* ==================== ACCIÓN INMEDIATA ==================== */}
      <ActionBanner
        action={immediateAction}
        onStartStudySession={onStartStudySession}
        onOpenAddTaskModal={onOpenAddTaskModal}
      />

      {/* ==================== TUTOR MENTOR CHAT ==================== */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            Tutor Académico Mentor
          </h3>
          <button
            onClick={onOpenHelpGuideModal}
            className="text-xs text-brand-400 hover:underline flex items-center gap-1"
          >
            <HelpCircle className="w-3 h-3" /> ¿Cómo me ayuda?
          </button>
        </div>
        <MentorAiChat mentorState={mentorState} />
      </motion.section>

      {/* ==================== ESTADO VACÍO ==================== */}
      {subjects.length === 0 && pending.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden glass-card p-12 text-center space-y-6"
        >
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <BookOpen className="w-12 h-12 text-text-muted mx-auto relative" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Sin asignaturas aún</h3>
            <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
              Comienza agregando tus materias o sube un sílabo PDF para que el Mentor extraiga automáticamente las reglas del profesor.
            </p>
          </div>
          <button
            onClick={onOpenAddSubjectModal}
            className="btn-primary px-6 py-3 rounded-xl gap-2"
          >
            <Plus className="w-4 h-4" /> Añadir mi primera materia
          </button>
        </motion.div>
      ) : (
        <>
          {/* ==================== MÉTRICAS MEJORADAS ==================== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <MetricCard 
              icon={BookOpen} 
              label="Asignaturas" 
              value={subjects.length} 
              trend="+0" 
              color="emerald"
            />
            <MetricCard 
              icon={Clock} 
              label="Pendientes" 
              value={pending.length} 
              trend={pending.length > 10 ? '↑ Alto' : 'Normal'} 
              color="amber"
            />
            <MetricCard 
              icon={CheckCircle2} 
              label="Completadas" 
              value={completed.length} 
              trend="Esta semana" 
              color="green"
            />
            <MetricCard 
              icon={Flame} 
              label="Racha" 
              value={getClosestExamLabel(subjects)} 
              trend="Próximo examen" 
              color="amber"
              small
            />
          </motion.div>

          {/* ==================== TAREAS PENDIENTES - CON BORDES DE URGENCIA ==================== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                Tareas pendientes <span className="text-xs badge-warning">{pending.length}</span>
              </h3>
              <button
                onClick={onOpenAddTaskModal}
                className="text-xs text-brand-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Añadir
              </button>
            </div>

            {sortedPending.length === 0 ? (
              <div className="relative glass-card p-8 text-center">
                <CheckCircle2 className="w-14 h-14 text-brand-500/30 mx-auto mb-3" />
                <p className="text-sm text-text-muted">¡Todo al día! No tienes tareas pendientes.</p>
                <button
                  onClick={onOpenAddTaskModal}
                  className="mt-4 btn-secondary inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Crear tarea de práctica
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPending.map((task, index) => {
                  const styles = urgencyStyles[task.urgency] || urgencyStyles.medium;
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 ${styles.border} ${styles.bg} border border-zinc-700/50 backdrop-blur-sm`}
                    >
                      <div className={`w-1 h-full rounded-l-xl ${styles.icon}`} />
                      <div className={`w-2 h-2 rounded-full shrink-0 ${styles.icon} shadow-${styles.icon.replace('bg-', '')}/30`} />
                      
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-text-muted">
                          {task.subjectCode && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">{task.subjectCode}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {task.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {task.dueDate || 'Sin fecha'}
                          </span>
                          {task.createdAt && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Creada: {new Date(task.createdAt).toLocaleDateString('es-ES')}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium uppercase ${styles.bg} ${styles.text}`}>
                            {task.urgency === 'high' ? 'Urgente' : task.urgency === 'medium' ? 'Media' : 'Baja'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 sm:opacity-100">
                        <button
                          onClick={() => onStartStudySession(task)}
                          className="p-2 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 transition-colors shadow-sm"
                          title="Enfocarse (Pomodoro)"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onCompleteTask(task.id)}
                          title="Marcar como completada"
                          className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        {onDeleteTask && (
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            title="Eliminar tarea"
                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>

          {/* ==================== ASIGNATURAS CON ASISTENCIA - TARJETAS ELEVADAS ==================== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                </div>
                Mis Asignaturas
              </h3>
              <button
                onClick={() => setCurrentView('subjects')}
                className="text-xs text-brand-400 hover:underline flex items-center gap-1"
              >
                Ver todas <Zap className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {subjects.map((sub, index) => {
                const SUBJECT_COLORS = [
                  { name: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-400', dot: 'bg-emerald-500' },
                  { name: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-400', dot: 'bg-blue-500' },
                  { name: 'violet', bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-400', dot: 'bg-violet-500' },
                  { name: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-400', dot: 'bg-amber-500' },
                  { name: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/40', text: 'text-rose-400', dot: 'bg-rose-500' },
                  { name: 'cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', text: 'text-cyan-400', dot: 'bg-cyan-500' },
                  { name: 'sky', bg: 'bg-sky-500/10', border: 'border-sky-500/40', text: 'text-sky-400', dot: 'bg-sky-500' },
                  { name: 'fuchsia', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/40', text: 'text-fuchsia-400', dot: 'bg-fuchsia-500' },
                ];
                let hash = 0;
                for (let i = 0; i < (sub.code || sub.name || '').length; i++) hash = ((hash << 5) - hash + (sub.code || sub.name || '').charCodeAt(i)) | 0;
                const ci = typeof sub.colorIndex === 'number' ? sub.colorIndex : ((hash % SUBJECT_COLORS.length) + SUBJECT_COLORS.length) % SUBJECT_COLORS.length;
                const colors = SUBJECT_COLORS[ci];

                return (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className={`group relative overflow-hidden rounded-xl p-4 space-y-3 transition-all duration-300 hover:shadow-xl ${colors.bg} ${colors.border} border bg-zinc-800/30 backdrop-blur-sm cursor-pointer`}
                    onClick={() => onOpenSubjectDetail?.(sub)}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 ${colors.dot}`} />
                    
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {sub.code}
                        </span>
                        <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-brand-400 transition-colors mt-1">{sub.name}</h4>
                        <p className="text-xs text-text-muted mt-0.5">Prof: {sub.professor}</p>
                      </div>
                      <div className="shrink-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text} border ${colors.border}`}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        </>
      )}
    </div>
  );
}

/* ==================== COMPONENTES AUXILIARES ==================== */

const MetricCard = React.memo(function MetricCard({ icon: Icon, label, value, trend, color, small }) {
  const colorStyles = {
    emerald: { bg: 'bg-brand-500/20', text: 'text-brand-400', icon: 'bg-brand-500', border: 'border-brand-500/30' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: 'bg-amber-500', border: 'border-amber-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', icon: 'bg-green-500', border: 'border-green-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: 'bg-blue-500', border: 'border-blue-500/30' },
  };
  const c = colorStyles[color] || colorStyles.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative group overflow-hidden rounded-xl p-4 transition-all duration-300 hover:shadow-xl ${c.bg} ${c.border} border bg-zinc-800/30 backdrop-blur-sm`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon} shadow-lg shadow-black/20`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="text-right">
          <p className={`font-bold ${small ? 'text-lg' : 'text-2xl'} ${c.text}`}>{value}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-[80px]">{trend}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-xs font-medium text-slate-400">{label}</p>
      </div>
    </motion.div>
  );
});

function getClosestExamLabel(subjects) {
  const withExams = subjects
    .filter((s) => s.nextExam && s.nextExam !== 'Sin fecha definida')
    .map((s) => ({ ...s, examDate: new Date(s.nextExam) }))
    .filter((s) => !isNaN(s.examDate))
    .sort((a, b) => a.examDate - b.examDate);

  if (withExams.length === 0) return 'N/A';

  const days = Math.ceil((withExams[0].examDate - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Atrasado';
  if (days === 0) return '¡Hoy!';
  return `${days}d`;
}