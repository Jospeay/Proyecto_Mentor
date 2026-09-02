import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, BookOpen, Check, Plus, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * COMPONENTE: AddEventModal.jsx — Creación y Edición de Eventos de Calendario.
 *
 * Props:
 *   isOpen         - boolean
 *   onClose        - function
 *   onAddEvent     - function(eventData)
 *   editingEvent   - object | null (si está presente, el modal funciona en modo EDICIÓN)
 *   onEditEvent    - function(eventId, updatedData)
 *   subjects       - array de asignaturas para asociar eventos
 */
export default function AddEventModal({
  isOpen,
  onClose,
  onAddEvent,
  editingEvent = null,
  onEditEvent,
  subjects = [],
}) {
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    type: 'event',
    subjectId: '',
    description: '',
  });
  const [error, setError] = useState('');

  // Tipos de eventos disponibles
  const eventTypes = [
    { id: 'exam', label: 'Examen', color: 'text-red-400 bg-red-500/10' },
    { id: 'class', label: 'Clase', color: 'text-blue-400 bg-blue-500/10' },
    { id: 'study', label: 'Sesión de estudio', color: 'text-brand-400 bg-brand-500/10' },
    { id: 'deadline', label: 'Entrega', color: 'text-amber-400 bg-amber-500/10' },
    { id: 'event', label: 'Evento general', color: 'text-text-muted bg-gray-500/10' },
    { id: 'holiday', label: 'Festivo/Día libre', color: 'text-green-400 bg-green-500/10' },
    { id: 'personal', label: 'Personal', color: 'text-purple-400 bg-purple-400/10' },
  ];

  // Efecto para pre-llenar datos si estamos en modo edición
  useEffect(() => {
    if (editingEvent) {
      setForm({
        title: editingEvent.title || '',
        date: editingEvent.date || '',
        time: editingEvent.time || '',
        type: editingEvent.type || 'event',
        subjectId: editingEvent.subjectId || '',
        description: editingEvent.description || '',
      });
      setError('');
    } else {
      // Reset form para creación
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        title: '',
        date: today,
        time: '',
        type: 'event',
        subjectId: '',
        description: '',
      });
      setError('');
    }
  }, [editingEvent, isOpen]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleTypeChange = (type) => setForm({ ...form, type });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.date) {
      setError('El título y la fecha son obligatorios.');
      return;
    }

    const eventData = {
      title: form.title,
      date: form.date,
      time: form.time,
      type: form.type,
      subjectId: form.subjectId,
      subject: subjects.find((s) => s.id === form.subjectId)?.name || '',
      description: form.description,
    };

    if (editingEvent && onEditEvent) {
      onEditEvent(editingEvent.id, eventData);
    } else if (onAddEvent) {
      onAddEvent(eventData);
    }

    setError('');
    onClose();
  };

  const typeLabel = (type) => {
    const t = eventTypes.find((et) => et.id === type);
    return t ? t.label : type;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-md bg-zinc-900/95 border border-zinc-700/50 rounded-glass-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-zinc-700/50 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-glass bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                  {editingEvent ? (
                    <Pencil className="w-4 h-4 text-brand-400" />
                  ) : (
                    <Calendar className="w-4 h-4 text-brand-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {editingEvent
                      ? 'Modifica los detalles del evento'
                      : 'Agrega una fecha importante a tu calendario'}
                  </p>
                </div>
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

            {/* FORMULARIO */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Título *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="ej. Entrega proyecto final"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white placeholder-text-subtle focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Fecha *</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Hora (opcional)</label>
                  <input
                    type="time"
                    name="time"
                    value={form.time ? form.time.split('-')[0].trim() : ''}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Tipo de evento</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {eventTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTypeChange(t.id)}
                      className={`py-2 rounded-glass border text-xs font-medium transition-colors text-center ${
                        form.type === t.id
                          ? `${t.color} border-2`
                          : 'border-zinc-700 text-text-subtle hover:text-text-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Asignatura (opcional)</label>
                {subjects.length > 0 ? (
                  <select
                    name="subjectId"
                    value={form.subjectId}
                    onChange={handleChange}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                  >
                    <option value="">Sin asignatura asociada</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-text-subtle bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2">
                    No hay asignaturas registradas. Ve a "Mis Clases" para añadir.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Descripción (opcional)</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Notas adicionales, lugar, recordatorios..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white placeholder-text-subtle focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
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
                  {editingEvent ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Guardar Cambios
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Guardar Evento
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