/**
 * PROYECTO MENTOR — Estructura de estado inicial.
 *
 * Define la forma del estado de la aplicación cuando un usuario se registra
 * por primera vez. Todas las listas empiezan vacías: el contenido real
 * se carga desde Firestore.
 *
 * La función recalculateImmediateAction() determina cuál es la tarea más
 * urgente entre las pendientes del estudiante.
 */

// Estado vacío por defecto para usuarios nuevos
export const emptyMentorState = {
  subjects: [],
  tasks: [],
  scheduleEvents: [],
  calendarEvents: [],
  immediateAction: null,
};

/**
 * Calcula la tarea prioritaria ("Acción Inmediata") basándose en las tareas reales.
 * Ordena por urgencia (high > medium > low) y devuelve la primera pendiente.
 *
 * @param {Array} tasks — Lista de tareas del usuario.
 * @returns {Object|null} La tarea más urgente o null si no hay pendientes.
 */
export function recalculateImmediateAction(tasks = []) {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return null;

  const weight = { high: 3, medium: 2, low: 1 };
  const sorted = [...pending].sort(
    (a, b) => (weight[b.urgency] || 1) - (weight[a.urgency] || 1)
  );

  const top = sorted[0];
  return {
    id: top.id,
    title: top.title,
    subject: top.subject,
    estimatedTimeMinutes: top.estimatedMinutes || 45,
    dueDateText: top.dueDate || 'Sin fecha límite',
    priorityReason:
      top.urgency === 'high'
        ? 'Es tu entregable de mayor urgencia. Termínalo antes que cualquier otra cosa.'
        : 'Es tu siguiente tarea pendiente según la prioridad asignada.',
    completed: false,
  };
}
