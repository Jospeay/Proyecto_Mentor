import React, { useState, useEffect } from 'react';
import { X, Plus, Pencil, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * COMPONENTE: AddTaskModal.jsx — Formulario para añadir y editar tarea / entregable.
 *
 * Props:
 *   isOpen       — Visibilidad del modal.
 *   onClose      — Cierra el modal.
 *   subjects     — Lista de asignaturas para el selector.
 *   onAddTask    — Guarda nueva tarea (App.jsx la persiste).
 *   editingTask  — Objeto tarea a editar o null.
 *   onEditTask   — Función(taskId, updatedData) para guardar cambios.
 */
export default function AddTaskModal({
  isOpen,
  onClose,
  subjects = [],
  onAddTask,
  editingTask = null,
  onEditTask,
}) {
  const [form, setForm] = useState({
    title: '',
    subjectId: '',
    dueDate: '',
    estimatedMinutes: 60,
    urgency: 'high',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingTask) {
      setForm({
        title: editingTask.title || '',
        subjectId: editingTask.subjectId || (subjects.find(s => s.name === editingTask.subject)?.id || ''),
        dueDate: editingTask.dueDate !== 'Sin fecha límite' ? editingTask.dueDate || '' : '',
        estimatedMinutes: editingTask.estimatedMinutes || 60,
        urgency: editingTask.urgency || 'high',
      });
    } else {
      setForm({
        title: '',
        subjectId: subjects[0] ? subjects[0].id : '',
        dueDate: '',
        estimatedMinutes: 60,
        urgency: 'high',
      });
    }
    setError('');
  }, [editingTask, isOpen]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title) {
      setError('El título de la tarea es obligatorio.');
      return;
    }

    const selectedSub = subjects.find((s) => s.id === form.subjectId);

    const taskPayload = {
      title: form.title,
      subjectId: form.subjectId || (subjects[0] ? subjects[0].id : ''),
      subject: selectedSub ? selectedSub.name : (subjects[0] ? subjects[0].name : 'General'),
      dueDate: form.dueDate || 'Sin fecha límite',
      estimatedMinutes: parseInt(form.estimatedMinutes) || 60,
      urgency: form.urgency,
      createdAt: new Date().toISOString(),
    };

    if (editingTask && onEditTask) {
      onEditTask(editingTask.id, {
        ...taskPayload,
        status: editingTask.status || 'todo',
        completed: editingTask.completed || false,
      });
    } else if (onAddTask) {
      onAddTask({
        ...taskPayload,
        status: 'todo',
        completed: false,
      });
    }

    setError('');
    onClose();
  };

  const urgencies = [
    { id: 'high', label: 'Alta', color: 'border-red-500 text-red-400' },
    { id: 'medium', label: 'Media', color: 'border-amber-500 text-amber-400' },
    { id: 'low', label: 'Baja', color: 'border-green-500 text-green-400' },
    { id: 'low', label: 'Baja', color: 'border-green-500 text-green-400' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md bg-zinc-900/95 border border-zinc-700/50 rounded-glass-lg p-6 space-y-5 shadow-2xl"
          >
            {/* Cabecera */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-glass bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              {editingTask ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <h3 className="text-base font-semibold text-white">
              {editingTask ? 'Editar tarea' : 'Nueva tarea'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-glass text-text-subtle hover:text-white hover:bg-glass-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-glass px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Título *</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="ej. Resolver Guía 4 de Integrales"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white placeholder-text-subtle focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Asignatura */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Asignatura</label>
            {subjects.length > 0 ? (
              <select
                name="subjectId"
                value={form.subjectId}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="">Seleccionar...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-text-subtle bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2">
                Primero debes registrar una asignatura en "Mis Clases".
              </div>
            )}
          </div>

          {/* Fecha límite y duración */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Fecha límite</label>
              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Duración estimada</label>
              <select
                name="estimatedMinutes"
                value={form.estimatedMinutes}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1.5 horas</option>
                <option value={120}>2 horas</option>
              </select>
            </div>
          </div>

          {/* Urgencia */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Prioridad</label>
            <div className="grid grid-cols-3 gap-2">
              {urgencies.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setForm({ ...form, urgency: u.id })}
                  className={`py-1.5 rounded-glass border text-xs font-medium transition-colors ${
                    form.urgency === u.id
                      ? `${u.color} bg-zinc-800`
                      : 'border-zinc-700 text-text-subtle hover:text-text-muted'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-glass text-sm text-text-muted hover:text-white hover:bg-glass-bg-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {editingTask ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Guardar Cambios
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Guardar Tarea
                </>
              )}
            </button>
          </div>
        </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
