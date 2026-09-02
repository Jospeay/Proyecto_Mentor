import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  BookOpen,
  MoreVertical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

/**
 * COMPONENTE: AgendaView.jsx — Calendario mensual real con eventos.
 *
 * Props:
 *   scheduleEvents       — Eventos automáticos (exámenes de asignaturas)
 *   calendarEvents       — Eventos creados manualmente por el usuario
 *   tasks                — Tareas con dueDate para mostrar en el calendario
 *   onStartStudySession  — Inicia temporizador con un evento de estudio
 *   onAddEvent           - Abre modal para crear evento
 *   onEditEvent          - Abre modal para editar evento
 *   onDeleteEvent        - Elimina evento
 *   onAddCalendarEvent   - Handler para crear evento
 *   onEditCalendarEvent  - Handler para editar evento
 */
export default function AgendaView({
  scheduleEvents = [],
  calendarEvents = [],
  tasks = [],
  onStartStudySession,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onAddCalendarEvent,
  onEditCalendarEvent,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventsForSelectedDate, setEventsForSelectedDate] = useState([]);
  const [showEventDetail, setShowEventDetail] = useState(null);

  // Navegación de mes
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }, []);

  // Combinar todos los eventos para el mes actual
  // Prioridad: calendarEvents (Firestore/editados) sobrescriben scheduleEvents (autogenerados)
  const allEvents = useMemo(() => {
    const eventsMap = new Map();

    // Eventos automáticos (exámenes) — base
    scheduleEvents.forEach((evt) => {
      if (evt.day) {
        const date = new Date(evt.day + 'T00:00:00');
        if (
          date.getFullYear() === currentMonth.getFullYear() &&
          date.getMonth() === currentMonth.getMonth()
        ) {
          eventsMap.set(evt.id, {
            id: evt.id,
            title: evt.title,
            date: evt.day,
            time: evt.time,
            type: evt.type || 'exam',
            subject: evt.subject,
            source: 'auto',
            color: 'bg-red-500',
            borderColor: 'border-red-500',
          });
        }
      }
    });

    // Eventos del usuario (manuales + editados de autogenerados) — sobrescriben por ID
    calendarEvents.forEach((evt) => {
      if (evt.date) {
        const date = new Date(evt.date + 'T00:00:00');
        if (
          date.getFullYear() === currentMonth.getFullYear() &&
          date.getMonth() === currentMonth.getMonth()
        ) {
          const existing = eventsMap.get(evt.id);
          const typeConfig = getTypeConfig(evt.type);
          eventsMap.set(evt.id, {
            id: evt.id,
            title: evt.title,
            date: evt.date,
            time: evt.time,
            type: evt.type,
            subject: evt.subject,
            description: evt.description,
            source: existing ? 'auto_edited' : 'manual',
            color: typeConfig.color,
            borderColor: typeConfig.borderColor,
          });
        }
      }
    });

    // Tareas con fecha de vencimiento
    tasks.forEach((task) => {
      if (task.dueDate && task.dueDate !== 'Sin fecha límite' && task.dueDate !== 'Sin fecha') {
        const date = new Date(task.dueDate + 'T00:00:00');
        if (
          date.getFullYear() === currentMonth.getFullYear() &&
          date.getMonth() === currentMonth.getMonth()
        ) {
          const taskId = `task_${task.id}`;
          if (!eventsMap.has(taskId)) {
            eventsMap.set(taskId, {
              id: taskId,
              title: task.title,
              date: task.dueDate,
              time: '',
              type: 'deadline',
              subject: task.subject,
              subjectId: task.subjectId,
              source: 'task',
              taskData: task,
              color: 'bg-amber-500',
              borderColor: 'border-amber-500',
            });
          }
        }
      }
    });

    return Array.from(eventsMap.values());
  }, [scheduleEvents, calendarEvents, tasks, currentMonth]);

  // Generar días del mes
  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Días del mes anterior (relleno)
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, month - 1, day);
      days.push({ day, date, isCurrentMonth: false });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({ day: d, date, isCurrentMonth: true });
    }

    // Días del mes siguiente (relleno para completar 6 filas x 7 = 42)
    const remaining = 42 - days.length;
    for (let n = 1; n <= remaining; n++) {
      const date = new Date(year, month + 1, n);
      days.push({ day: n, date, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  // Obtener eventos para un día específico
  const getEventsForDay = (date) => {
    const dateStr = date.toISOString().slice(0, 10);
    return allEvents.filter((evt) => evt.date === dateStr);
  };

  // Manejar clic en un día
  const handleDayClick = (dayData) => {
    if (!dayData.isCurrentMonth) return;
    setSelectedDate(dayData.date);
    setEventsForSelectedDate(getEventsForDay(dayData.date));
  };

  // Verificar si hoy
  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Verificar si día seleccionado
  const isSelected = (date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Manejar clic en evento
  const handleEventClick = useCallback((e, event) => {
    e.stopPropagation();
    if (event.source === 'manual' && onEditEvent) {
      onEditEvent(event);
    } else if (event.source === 'auto' && onEditEvent) {
      onEditEvent({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time || '',
        type: event.type || 'exam',
        subject: event.subject || '',
        description: '',
      });
    } else if (event.source === 'task' && event.taskData) {
      onStartStudySession(event.taskData);
    }
  }, [onEditEvent, onStartStudySession]);

  // Eliminar evento manual
  const handleDeleteManualEvent = useCallback(async (e, eventId) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este evento?')) {
      if (onDeleteEvent) {
        await onDeleteEvent(eventId);
      }
      toast.success('Evento eliminado');
    }
  }, [onDeleteEvent]);

  const monthName = currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto pb-16">
      {/* Encabezado con navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-lg font-semibold text-white capitalize min-w-[200px] text-center">
            {monthName}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-glass bg-zinc-800 hover:bg-zinc-800 border border-zinc-700/50 text-xs text-white transition-colors flex items-center gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Hoy
          </button>
          <button
            onClick={onAddEvent}
            className="px-3 py-1.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo evento
          </button>
        </div>
      </div>

      {/* Leyenda de tipos */}
      <div className="flex flex-wrap gap-2 bg-zinc-800/50 border border-zinc-700/50 rounded-glass p-3">
        {[
          { id: 'exam', label: 'Exámenes', color: 'bg-red-500' },
          { id: 'class', label: 'Clases', color: 'bg-blue-500' },
          { id: 'study', label: 'Estudio', color: 'bg-brand-500' },
          { id: 'deadline', label: 'Entregas', color: 'bg-amber-500' },
          { id: 'event', label: 'Eventos', color: 'bg-gray-500' },
          { id: 'holiday', label: 'Festivos', color: 'bg-green-500' },
          { id: 'personal', label: 'Personal', color: 'bg-purple-400' },
        ].map((t) => (
          <span key={t.id} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className={`w-2.5 h-2.5 rounded ${t.color}`} />
            {t.label}
          </span>
        ))}
      </div>

      {/* Calendario grid */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass overflow-hidden">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-zinc-700/50 bg-bg-primary/50">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-text-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7">
          {monthDays.map((dayData, index) => {
            const events = dayData.isCurrentMonth ? getEventsForDay(dayData.date) : [];
            const today = isToday(dayData.date);
            const selected = isSelected(dayData.date);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.01 }}
                onClick={() => handleDayClick(dayData)}
                className={`relative min-h-[100px] p-1 border-r border-b border-zinc-700/50 transition-colors ${
                  !dayData.isCurrentMonth ? 'bg-bg-primary/30 text-text-subtle' : 'bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer'
                } ${today ? 'ring-2 ring-brand-500' : ''} ${selected ? 'ring-2 ring-brand-500/50' : ''}`}
                style={{ borderRight: index % 7 === 6 ? 'none' : '1px solid' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${today ? 'text-brand-400' : 'text-white'}`}>
                    {dayData.day}
                  </span>
                  {events.length > 0 && (
                    <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded">
                      {events.length}
                    </span>
                  )}
                </div>

                {/* Eventos del día */}
                <div className="space-y-1 max-h-[70px] overflow-y-auto pr-1">
                  {events.slice(0, 3).map((evt) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => handleEventClick(e, evt)}
                      className={`text-[10px] px-1.5 py-1 rounded truncate cursor-pointer ${evt.color} text-white hover:opacity-90 flex items-center gap-1`}
                    >
                      {evt.time && <span className="text-[9px] opacity-80">{evt.time}</span>}
                      <span className="truncate">{evt.title}</span>
                      {evt.subject && <span className="text-[9px] opacity-70">📚 {evt.subject}</span>}
                    </motion.div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] text-center text-text-muted bg-bg-primary/50 px-1 py-0.5 rounded">
                      +{events.length - 3} más
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Panel lateral: Eventos del día seleccionado */}
      {selectedDate && eventsForSelectedDate.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Eventos del {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1 rounded text-text-subtle hover:text-white"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eventsForSelectedDate.map((evt) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => handleEventClick(e, evt)}
                className={`bg-zinc-800 border rounded-glass p-3 space-y-2 ${evt.borderColor} cursor-pointer hover:bg-zinc-700/50 transition-colors`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${evt.color} text-white`}>
                        {getTypeLabel(evt.type)}
                      </span>
                      {evt.time && (
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {evt.time}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{evt.title}</p>
                    {evt.subject && (
                      <p className="text-xs text-brand-400 flex items-center gap-1 mt-0.5">
                        <BookOpen className="w-3 h-3" /> {evt.subject}
                      </p>
                    )}
                    {evt.description && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">{evt.description}</p>
                    )}
                  </div>
                  {evt.source === 'manual' && (
                    <button
                      onClick={(e) => handleDeleteManualEvent(e, evt.id)}
                      className="p-1.5 rounded text-text-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {evt.source === 'task' && evt.taskData && (
                  <button
                    onClick={() => onStartStudySession(evt.taskData)}
                    className="w-full px-3 py-1.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" /> Iniciar Pomodoro
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Estado vacío cuando no hay eventos seleccionados */}
      {selectedDate && eventsForSelectedDate.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass p-8 text-center"
        >
          <CalendarIcon className="w-10 h-10 text-text-subtle mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            No hay eventos para el{' '}
            {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <button
            onClick={onAddEvent}
            className="mt-3 px-4 py-2 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Crear evento
          </button>
        </motion.div>
      )}
    </div>
  );
}

function getTypeConfig(type) {
  const configs = {
    exam: { color: 'bg-red-500', borderColor: 'border-red-500' },
    class: { color: 'bg-blue-500', borderColor: 'border-blue-500' },
    study: { color: 'bg-brand-500', borderColor: 'border-brand-500' },
    deadline: { color: 'bg-amber-500', borderColor: 'border-amber-500' },
    event: { color: 'bg-gray-500', borderColor: 'border-gray-500' },
    holiday: { color: 'bg-green-500', borderColor: 'border-green-500' },
    personal: { color: 'bg-purple-400', borderColor: 'border-purple-400' },
  };
  return configs[type] || configs.event;
}

function getTypeLabel(type) {
  const labels = {
    exam: 'Examen',
    class: 'Clase',
    study: 'Estudio',
    deadline: 'Entrega',
    event: 'Evento',
    holiday: 'Festivo',
    personal: 'Personal',
  };
  return labels[type] || type;
}