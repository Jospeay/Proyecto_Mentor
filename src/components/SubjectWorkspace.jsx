import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@radix-ui/react-tabs';
import { BookOpen, FileText, FilePen, GraduationCap, Plus, Search, ChevronRight, Settings, Calculator, Target, X, Trash2 } from 'lucide-react';
import SubjectList from './SubjectList';
import NotesVault from './NotesVault';
import ExamSimulator from './ExamSimulator';
import { motion } from 'framer-motion';

/**
 * COMPONENTE: SubjectWorkspace.jsx — Espacio de trabajo dedicado a una Asignatura.
 * 
 * Pestañas:
 * 1. Tareas (Kanban) - Tablero de tareas estilo Trello
 * 2. Bóveda - Apuntes, PDFs, Chat con IA
 * 3. Exámenes - Simulador de exámenes con IA
 */
export default function SubjectWorkspace({
  subject,
  tasks = [],
  onOpenAddTaskModal,
  onEditTask,
  onDeleteTask,
  onCompleteTask,
  onUpdateTaskStatus,
  onStartStudySession,
  onAddResource,
  onEditResource,
  onDeleteResource,
  onUpdateSubjectAbsences,
  onUpdateRubrics,
}) {
  const [activeTab, setActiveTab] = useState('kanban');
  const [showSettings, setShowSettings] = useState(false);

  const incompleteCount = useMemo(() => tasks.filter(t => !t.completed).length, [tasks]);
  const [resourceCount, setResourceCount] = useState(0);
  const [vaultRefreshKey, setVaultRefreshKey] = useState(0);

  const refreshVaultCount = useCallback(() => {
    setVaultRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!subject?.id) { setResourceCount(0); return; }
    const api = window.mentorAPI;
    if (!api?.vaultGetPdfs) { setResourceCount(0); return; }
    api.vaultGetPdfs(subject.id).then((result) => {
      setResourceCount(result.success ? result.files.length : 0);
    }).catch(() => setResourceCount(0));
  }, [subject?.id, vaultRefreshKey]);

  const tabs = useMemo(() => [
    { id: 'kanban', label: 'Tareas', icon: BookOpen, badge: incompleteCount },
    { id: 'vault', label: 'Bóveda', icon: FileText, badge: resourceCount },
    { id: 'exams', label: 'Exámenes', icon: GraduationCap, badge: 0 },
  ], [incompleteCount, resourceCount]);

  const handleAbsenceChange = useCallback((e, delta) => {
    e.stopPropagation();
    const current = subject.currentAbsences || 0;
    const newCount = Math.max(0, current + delta);
    if (onUpdateSubjectAbsences) {
      onUpdateSubjectAbsences(subject.id, newCount);
    }
  }, [subject, onUpdateSubjectAbsences]);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header de la asignatura */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative sticky top-0 z-10 glass-panel p-4 mb-4 border-b border-zinc-700/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className="px-3 py-1 rounded-glass-lg bg-brand-500/20 text-brand-400 text-[10px] font-bold uppercase tracking-wider border border-brand-500/30">
                {subject.code}
              </span>
              {subject.subjectCode && (
                <span className="px-3 py-1 rounded-glass-lg bg-slate-800 text-slate-400 text-[10px] font-mono border border-white/10">
                  {subject.subjectCode}
                </span>
              )}
              {subject.nextExam && subject.nextExam !== 'Sin fecha definida' && (
                <span className="px-3 py-1 rounded-glass-lg bg-amber-500/20 text-amber-400 text-[10px] font-medium border border-amber-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Próximo: {new Date(subject.nextExam).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
            <h1 className="text-heading-lg font-bold text-white truncate">{subject.name}</h1>
            <p className="text-text-muted text-body-sm mt-1">Prof: {subject.professor}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl glass-card hover:bg-zinc-800 text-text-muted hover:text-text-primary transition-colors"
              title="Configuración de asignatura"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className="p-2 rounded-xl glass-card hover:bg-zinc-800 text-text-muted hover:text-brand-400 transition-colors"
              title="Nueva tarea"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 gap-1 bg-zinc-800/30 backdrop-blur-glass rounded-glass-xl p-1 border border-zinc-700/50">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="tab-trigger flex items-center justify-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="badge-brand">{tab.badge}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </motion.div>

      {/* Contenido de pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        {/* TAB 1: KANBAN */}
        <TabsContent value="kanban" className="flex-1 animate-in">
          <SubjectList
            subjects={[subject]}
            tasks={tasks}
            onOpenAddSubjectModal={() => {}}
            onEditSubject={() => {}}
            onDeleteSubject={() => {}}
            onEditTask={onEditTask}
            onUpdateSubjectAbsences={onUpdateSubjectAbsences}
            onUpdateRubrics={onUpdateRubrics}
            onAddResource={onAddResource}
            onEditResource={onEditResource}
            onDeleteResource={onDeleteResource}
            onStartStudySession={onStartStudySession}
            onCompleteTask={onCompleteTask}
            onDeleteTask={onDeleteTask}
            onUpdateTaskStatus={onUpdateTaskStatus}
          />
        </TabsContent>

        {/* TAB 2: BÓVEDA DE APUNTES */}
        <TabsContent value="vault" className="flex-1 animate-in">
          <NotesVault
            subject={subject}
            onAddResource={onAddResource}
            onEditResource={onEditResource}
            onDeleteResource={onDeleteResource}
            onVaultChange={refreshVaultCount}
          />
        </TabsContent>

        {/* TAB 3: EXÁMENES */}
        <TabsContent value="exams" className="flex-1 animate-in">
          <ExamSimulator
            subject={subject}
            onUpdateRubrics={onUpdateRubrics}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de configuración de asignatura */}
      {showSettings && (
        <SubjectSettingsModal
          subject={subject}
          onClose={() => setShowSettings(false)}
          onUpdateRubrics={onUpdateRubrics}
          onUpdateAbsences={onUpdateSubjectAbsences}
        />
      )}
    </div>
  );
}

/* ==================== MODAL DE CONFIGURACIÓN ==================== */

function SubjectSettingsModal({ subject, onClose, onUpdateRubrics, onUpdateAbsences }) {
  const [rubrics, setRubrics] = useState(subject.rubrics || []);
  const [targetGrade, setTargetGrade] = useState(subject.targetGrade || 85);
  const [currentAbsences, setCurrentAbsences] = useState(subject.currentAbsences || 0);
  const [maxAbsences, setMaxAbsences] = useState(subject.maxAbsences || 5);

  const handleSave = () => {
    onUpdateRubrics(subject.id, { rubrics, targetGrade });
    onUpdateAbsences(subject.id, currentAbsences);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-800/95 backdrop-blur-xl border border-zinc-700 rounded-glass-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-glass-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400" />
            Configurar: {subject.name}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl glass-card hover:bg-zinc-800 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Ponderaciones */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-brand-400" />
              Ponderaciones
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {rubrics.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 p-3 glass-card rounded-xl">
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => setRubrics(rubs => rubs.map((rub, idx) => idx === i ? { ...rub, name: e.target.value } : rub))}
                    className="flex-1 input-glass-sm"
                    placeholder="Nombre del rubro"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={r.weightPct}
                    onChange={(e) => setRubrics(rubs => rubs.map((rub, idx) => idx === i ? { ...rub, weightPct: parseInt(e.target.value) || 0 } : rub))}
                    className="w-20 input-glass-sm text-center"
                    placeholder="%"
                  />
                  <label className="flex items-center gap-2 text-body-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={r.isFinal}
                      onChange={(e) => setRubrics(rubs => rubs.map((rub, idx) => idx === i ? { ...rub, isFinal: e.target.checked } : rub))}
                      className="w-4 h-4 rounded border-zinc-700/50 bg-zinc-800 text-brand-500 focus:ring-brand-500"
                    />
                    <span>Final</span>
                  </label>
                  <button
                    onClick={() => setRubrics(rubs => rubs.filter((_, idx) => idx !== i))}
                    className="p-2 rounded-lg glass-card hover:bg-red-500/20 hover:text-red-400 text-text-muted transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setRubrics([...rubrics, { id: `r${Date.now()}`, name: 'Nuevo Rubro', weightPct: 10, currentScore: null, isFinal: false }])}
                className="w-full btn-secondary justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Añadir rubro
              </button>
            </div>

            {/* Nota objetivo */}
            <div className="pt-4 border-t border-zinc-700/50">
              <label className="label-glass">Nota objetivo (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-24 input-glass-sm text-center text-xl font-bold"
                />
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${targetGrade}%` }}
                    className="h-full bg-brand-600 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inasistencias */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              Control de Inasistencias
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-glass">Faltas actuales</label>
                <input
                  type="number"
                  min="0"
                  max={maxAbsences}
                  value={currentAbsences}
                  onChange={(e) => setCurrentAbsences(Math.min(maxAbsences, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full input-glass-sm text-center text-xl font-bold"
                />
              </div>
              <div>
                <label className="label-glass">Máximo permitido</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxAbsences}
                  onChange={(e) => setMaxAbsences(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full input-glass-sm text-center text-xl font-bold"
                />
              </div>
            </div>
            <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (currentAbsences / maxAbsences) * 100)}%` }}
                className={`h-full rounded-full ${currentAbsences >= maxAbsences ? 'bg-red-500' : currentAbsences >= maxAbsences - 1 ? 'bg-amber-500' : 'bg-emerald-600'}`}
              />
            </div>
            <p className="text-xs text-text-muted mt-1 text-center">
              {currentAbsences >= maxAbsences ? '⚠️ Riesgo de perder la materia' : currentAbsences >= maxAbsences - 1 ? '⚠️ Última falta permitida' : '✓ Asistencia bajo control'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-zinc-700/50">
          <button onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Guardar cambios</button>
        </div>
      </motion.div>
    </div>
  );
}