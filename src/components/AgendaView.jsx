import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, BookOpen, AlertTriangle } from 'lucide-react';

/**
 * COMPONENTE: AgendaView.jsx — Vista de calendario y eventos.
 *
 * Muestra las clases, exámenes y bloques de estudio en formato de lista ordenada.
 * Diseño plano tipo Todoist con filtros discretos.
 *
 * Props:
 *   scheduleEvents      — Array de eventos del calendario.
 *   onStartStudySession — Inicia temporizador con un evento de estudio.
 */

export default function AgendaView({ scheduleEvents = [], onStartStudySession }) {
  const [filter, setFilter] = useState('all');

  const filtered = scheduleEvents.filter((evt) => {
    if (filter === 'all') return true;
    return evt.type === filter;
  });

  // Estilo del borde izquierdo según tipo de evento
  const typeAccent = {
    exam:           'border-l-pm-red',
    'study-session': 'border-l-pm-accent',
    class:          'border-l-pm-blue',
    deadline:       'border-l-pm-amber',
  };

  const typeLabel = {
    exam: 'Examen',
    'study-session': 'Estudio',
    class: 'Clase',
    deadline: 'Entrega',
  };

  const filters = [
    { id: 'all',           label: 'Todos' },
    { id: 'class',         label: 'Clases' },
    { id: 'study-session', label: 'Estudio' },
    { id: 'exam',          label: 'Exámenes' },
  ];

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto pb-16">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-pm-text flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-pm-muted" />
            Agenda
          </h2>
          <p className="text-sm text-pm-muted mt-0.5">{filtered.length} eventos registrados</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-1 bg-pm-surface border border-pm-border rounded-pm p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-pm-accent text-white'
                  : 'text-pm-muted hover:text-pm-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de eventos */}
      {filtered.length === 0 ? (
        <div className="bg-pm-surface border border-pm-border rounded-pm-lg p-10 text-center">
          <CalendarIcon className="w-8 h-8 text-pm-subtle mx-auto mb-3" />
          <p className="text-sm text-pm-muted">No hay eventos en esta categoría.</p>
          <p className="text-xs text-pm-subtle mt-1">
            Los exámenes se crean automáticamente al añadir asignaturas con fecha de parcial.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((evt) => (
            <div
              key={evt.id}
              className={`bg-pm-surface border border-pm-border rounded-pm p-4 border-l-2 ${typeAccent[evt.type] || 'border-l-pm-subtle'} flex items-center justify-between gap-4`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-pm-muted bg-pm-card px-2 py-0.5 rounded">
                    {evt.time}
                  </span>
                  <span className="text-xs text-pm-subtle">{evt.day}</span>
                  <span className="text-xs text-pm-subtle">·</span>
                  <span className="text-xs text-pm-muted">{typeLabel[evt.type] || evt.type}</span>
                </div>
                <p className="text-sm font-medium text-pm-text">{evt.title}</p>
                <p className="text-xs text-pm-subtle mt-0.5">
                  {evt.subject} — {evt.room}
                </p>
              </div>

              {evt.type === 'study-session' && (
                <button
                  onClick={() => onStartStudySession({ title: evt.title, subject: evt.subject, estimatedMinutes: 45 })}
                  className="px-3 py-1.5 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-xs font-medium transition-colors shrink-0"
                >
                  Iniciar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
