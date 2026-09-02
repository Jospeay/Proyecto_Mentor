/**
 * ==============================================================================
 * MENTOR - CEREBRO IA DEL MENTOR PROACTIVO (aiMentorService.js)
 * ==============================================================================
 *
 * Servicio del proceso principal de Electron que analiza la carga de trabajo
 * del estudiante cada vez que el scraper detecta tareas nuevas.
 *
 * Flujo:
 * 1. Recibe tareas nuevas del scraper + estado actual del estudiante.
 * 2. Construye un prompt contextualizado.
 * 3. Llama a la API de Gemini (o genera análisis local inteligente como fallback).
 * 4. Parsea la respuesta en formato estructurado.
 * 5. Dispara notificación nativa de Electron.
 *
 * Soporta: Google Gemini API (gemini-3.6-flash / gemini-2.5-flash)
 * ==============================================================================
 */

const { Notification } = require('electron');
const { callAI, MODEL_FALLBACK_CHAIN } = require('./aiClient');

/**
 * Analiza la carga de trabajo con IA tras detectar nuevas tareas.
 *
 * @param {Object} options
 * @param {Array}  options.newTasks       - Tareas recién detectadas por el scraper
 * @param {Array}  options.existingTasks  - Tareas actuales del estudiante
 * @param {Array}  options.subjects       - Asignaturas activas
 * @param {string} [options.geminiApiKey] - API Key de Gemini (opcional)
 * @returns {Promise<Object>} Análisis estructurado del mentor
 */
async function analyzeWorkload({ newTasks = [], existingTasks = [], subjects = [], geminiApiKey }) {
  const pendingTasks = existingTasks.filter((t) => !t.completed);

  // Si hay API Key, usar Groq
  if (geminiApiKey) {
    try {
      return await analyzeWithAI({ newTasks, pendingTasks, subjects, geminiApiKey });
    } catch (err) {
      console.warn('[AI MENTOR] Groq falló, usando análisis local:', err.message);
    }
  }

  // Fallback: análisis local inteligente
  return analyzeLocally({ newTasks, pendingTasks, subjects });
}

/**
 * Análisis real con la API de Groq (Llama).
 */
async function analyzeWithAI({ newTasks, pendingTasks, subjects, geminiApiKey }) {
  const prompt = buildAnalysisPrompt(newTasks, pendingTasks, subjects);
  const result = await callAI({
    prompt,
    apiKey: geminiApiKey,
    models: MODEL_FALLBACK_CHAIN,
    generationConfig: { maxOutputTokens: 1024 },
  });

  try {
    const analysis = JSON.parse(result.response);
    return {
      success: true,
      source: result.source,
      riskLevel: analysis.riskLevel || 'low',
      message: analysis.message || 'Sin análisis disponible.',
      suggestedPriority: analysis.suggestedPriority || [],
      calendarAdjustment: analysis.calendarAdjustment || '',
      detailedAnalysis: analysis.detailedAnalysis || '',
    };
  } catch {
    return {
      success: true,
      source: result.source,
      riskLevel: determineRiskFromText(result.response),
      message: result.response.slice(0, 500),
      suggestedPriority: [],
      calendarAdjustment: '',
      detailedAnalysis: result.response,
    };
  }
}

/**
 * Construye el prompt contextualizado para Gemini.
 */
function buildAnalysisPrompt(newTasks, pendingTasks, subjects) {
  const newTasksStr = newTasks.map((t, i) =>
    `${i + 1}. "${t.title}" — Materia: ${t.subjectName || t.subject || '?'}, Vence: ${t.dueDate || 'Sin fecha'}`
  ).join('\n') || 'Ninguna tarea nueva detectada.';

  const pendingStr = pendingTasks.map((t, i) =>
    `${i + 1}. "${t.title}" — Materia: ${t.subject || '?'}, Vence: ${t.dueDate || 'Sin fecha'}, Estado: ${t.status || 'todo'}`
  ).join('\n') || 'No hay tareas pendientes.';

  const subjectsStr = subjects.map((s) =>
    `- ${s.name} (Faltas: ${s.currentAbsences || 0}/${s.maxAbsences || 5})`
  ).join('\n') || 'Sin asignaturas registradas.';

  return `
Eres MENTOR, un asistente académico proactivo, exigente y empático para un estudiante universitario.
Analiza la siguiente situación y responde OBLIGATORIAMENTE en JSON.

TAREAS RECIÉN DETECTADAS EN EL PORTAL UNIVERSITARIO:
${newTasksStr}

TAREAS PENDIENTES EXISTENTES DEL ESTUDIANTE:
${pendingStr}

ASIGNATURAS ACTIVAS:
${subjectsStr}

FECHA ACTUAL: ${new Date().toISOString().slice(0, 10)}

INSTRUCCIONES:
1. Determina si las nuevas tareas ponen en riesgo alguna entrega existente.
2. Evalúa la carga total de trabajo.
3. Sugiere un orden de prioridad para todas las tareas pendientes.
4. Si hay riesgo, recomienda un ajuste de calendario.

RESPONDE EN ESTE FORMATO JSON EXACTO:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "message": "Mensaje breve y directo del Mentor al estudiante (máximo 2 oraciones, en español).",
  "suggestedPriority": ["título tarea 1 (más urgente)", "título tarea 2", ...],
  "calendarAdjustment": "Recomendación de ajuste de horario en una oración, o cadena vacía si no aplica.",
  "detailedAnalysis": "Análisis detallado en 3-5 oraciones sobre la situación del estudiante."
}
`.trim();
}

/**
 * Análisis local inteligente sin API externa.
 * Evalúa la carga basándose en fechas, cantidad y prioridad.
 */
function analyzeLocally({ newTasks, pendingTasks, subjects }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calcular urgencia de cada tarea
  const allPending = [...pendingTasks, ...newTasks.map((t) => ({
    title: t.title,
    subject: t.subjectName || t.subject || '',
    dueDate: t.dueDate,
    status: 'todo',
  }))];

  const tasksWithUrgency = allPending.map((t) => {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const daysLeft = due ? Math.ceil((due - today) / (1000 * 60 * 60 * 24)) : 30;
    return { ...t, daysLeft: Math.max(0, daysLeft) };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  // Determinar nivel de riesgo
  const totalPending = allPending.length;
  const urgentCount = tasksWithUrgency.filter((t) => t.daysLeft <= 3).length;
  const thisWeekCount = tasksWithUrgency.filter((t) => t.daysLeft <= 7).length;

  let riskLevel = 'low';
  let message = '';
  let calendarAdjustment = '';

  if (urgentCount >= 3 || (totalPending >= 6 && thisWeekCount >= 4)) {
    riskLevel = 'critical';
    message = `¡Alerta crítica! Tienes ${urgentCount} tareas que vencen en los próximos 3 días y ${totalPending} pendientes en total. Necesitas reorganizar tu calendario de inmediato.`;
    calendarAdjustment = 'Cancela actividades no académicas esta semana. Dedica bloques de 2 horas por tarea urgente.';
  } else if (urgentCount >= 2 || thisWeekCount >= 3) {
    riskLevel = 'high';
    message = `Se detectaron ${newTasks.length} tarea(s) nueva(s). Con ${urgentCount} entrega(s) en los próximos 3 días, tu carga es alta. Prioriza las entregas más cercanas.`;
    calendarAdjustment = 'Adelanta las tareas de esta semana. Usa bloques Pomodoro de 50 min para mayor concentración.';
  } else if (thisWeekCount >= 2 || totalPending >= 4) {
    riskLevel = 'medium';
    message = `Nueva(s) tarea(s) detectada(s). Tienes ${thisWeekCount} entrega(s) esta semana. Mantén tu ritmo y no dejes acumularse trabajo.`;
    calendarAdjustment = '';
  } else {
    riskLevel = 'low';
    message = newTasks.length > 0
      ? `Se detectó ${newTasks.length} tarea(s) nueva(s). Tu carga actual es manejable. Buen momento para adelantar trabajo.`
      : 'Tu carga de trabajo está bajo control. Aprovecha para repasar o adelantar lecturas.';
  }

  // Prioridad sugerida
  const suggestedPriority = tasksWithUrgency.slice(0, 5).map((t) =>
    `${t.title}${t.daysLeft <= 3 ? ' ⚠️ URGENTE' : t.daysLeft <= 7 ? ' ⏰' : ''}`
  );

  // Verificar riesgo de inasistencias
  const riskySubjects = subjects.filter((s) =>
    (s.currentAbsences || 0) >= (s.maxAbsences || 5) - 1
  );

  let detailedAnalysis = `Tienes ${totalPending} tarea(s) pendiente(s) en total.`;
  if (urgentCount > 0) {
    detailedAnalysis += ` ${urgentCount} vence(n) en los próximos 3 días.`;
  }
  if (riskySubjects.length > 0) {
    detailedAnalysis += ` Además, tienes riesgo de inasistencia en: ${riskySubjects.map((s) => s.name).join(', ')}.`;
    if (riskLevel === 'low') riskLevel = 'medium';
  }
  detailedAnalysis += ` ${newTasks.length > 0 ? `Las ${newTasks.length} tarea(s) nueva(s) han sido integradas al análisis.` : ''}`;

  return {
    success: true,
    source: 'local',
    riskLevel,
    message,
    suggestedPriority,
    calendarAdjustment,
    detailedAnalysis,
  };
}

/**
 * Determina nivel de riesgo a partir del texto libre de Gemini.
 */
function determineRiskFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('crítico') || lower.includes('critical') || lower.includes('emergencia')) return 'critical';
  if (lower.includes('alto') || lower.includes('high') || lower.includes('urgente')) return 'high';
  if (lower.includes('medio') || lower.includes('medium') || lower.includes('moderado')) return 'medium';
  return 'low';
}

/**
 * Dispara una notificación nativa del SO con el análisis del Mentor.
 *
 * @param {Object} analysis - Resultado del análisis
 * @param {Array}  newTasks - Tareas nuevas detectadas
 */
function sendMentorNotification(analysis, newTasks = []) {
  if (!Notification.isSupported()) {
    console.warn('[AI MENTOR] Notificaciones nativas no soportadas en este sistema.');
    return;
  }

  const icons = { critical: '🚨', high: '⚠️', medium: '📋', low: '✅' };
  const icon = icons[analysis.riskLevel] || '📋';

  let title = `${icon} Mentor: `;
  if (newTasks.length > 0) {
    title += `${newTasks.length} tarea(s) nueva(s) detectada(s)`;
  } else {
    title += 'Análisis de carga de trabajo';
  }

  const notification = new Notification({
    title,
    body: analysis.message.slice(0, 200),
    silent: false,
    urgency: analysis.riskLevel === 'critical' ? 'critical' : 'normal',
  });

  notification.show();

  notification.on('click', () => {
    // El click en la notificación enfoca la ventana de la app
    const { BrowserWindow } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

module.exports = { analyzeWorkload, sendMentorNotification };
