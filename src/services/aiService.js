/**
 * ==============================================================================
 * MENTOR - SERVICIO DE INTELIGENCIA ARTIFICIAL (aiService.js)
 * ==============================================================================
 * 
 * Gestiona el Chat de IA del Mentor Académico. Soporta la API de Google Gemini
 * (gemini-1.5-flash) y un motor local inteligente contextualizado con el estado
 * real del estudiante.
 * ==============================================================================
 */

const GEMINI_KEY_STORAGE = 'mentor_gemini_api_key';

export function getGeminiApiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function saveGeminiApiKey(key) {
  if (key) {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
}

/**
 * Genera la respuesta del Mentor IA basada en el mensaje del usuario y el estado académico.
 */
export async function queryMentorAI(userMessage, studentState = {}, chatHistory = []) {
  const apiKey = getGeminiApiKey();

  // Si el usuario configuró una API Key de Gemini, intenta llamar a la API real de Google
  if (apiKey) {
    try {
      return await callGeminiApi(apiKey, userMessage, studentState, chatHistory);
    } catch (err) {
      console.warn('Error llamando API de Gemini, utilizando Motor Mentor Local:', err);
    }
  }

  // Fallback: Motor Inteligente Local de Mentor
  return generateLocalMentorResponse(userMessage, studentState);
}

/**
 * Llamada real a la API de Google Gemini (gemini-1.5-flash)
 */
async function callGeminiApi(apiKey, userMessage, studentState, chatHistory) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const { tasks = [], subjects = [] } = studentState;
  const pendingTasks = tasks.filter((t) => !t.completed);

  const systemContext = `
Eres 'Mentor', un asistente académico inteligente, empático y directo. Tu tono es amigable, conversacional y natural. Si el usuario te saluda o hace charla casual (ej. '¿cómo estás?'), respóndele de forma humana y cálida, y luego guíalo suavemente de vuelta a sus tareas o estudios. Tienes acceso a sus asignaturas e inasistencias, úsalas para darle consejos proactivos, pero NUNCA suenes como un robot leyendo una base de datos.

CONTEXTO ACTUAL DEL ESTUDIANTE:
- Asignaturas activas (${subjects.length}): ${subjects.map((s) => `${s.name} (Faltas: ${s.currentAbsences || 0}/${s.maxAbsences || 5})`).join(', ') || 'Ninguna aún'}
- Tareas pendientes (${pendingTasks.length}): ${pendingTasks.map((t) => `${t.title} [${t.subject}] (Vence: ${t.dueDate || 'Sin fecha'})`).join(', ') || 'Ninguna'}
  `.trim();

  const contents = chatHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemContext }] },
      contents: contents,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Error en respuesta de Gemini API');
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Respuesta vacía recibida de Gemini');
  }

  return textResponse;
}

/**
 * Motor Local Inteligente de Mentor (sin necesidad de API Key)
 */
function generateLocalMentorResponse(userMessage, studentState) {
  const msg = userMessage.toLowerCase();
  const { tasks = [], subjects = [] } = studentState;
  const pending = tasks.filter((t) => !t.completed);

  if (msg.includes('estudiar hoy') || msg.includes('hacer hoy') || msg.includes('prioridad')) {
    if (pending.length === 0) {
      return `Gran trabajo! No tienes tareas urgentes registradas en este momento. Te sugiero repasar la materia donde tengas el examen más cercano o avanzar en la lectura del sílabo.`;
    }
    const urgentTask = pending[0];
    return `Prioridad hoy: **${urgentTask.title}** de la asignatura *${urgentTask.subject}* (Vence: ${urgentTask.dueDate || 'Pronto'}).\n\nEstrategia recomendada: Activa un ciclo Pomodoro de 25 minutos en el panel de estudio para avanzar sin distracciones.`;
  }

  if (msg.includes('falta') || msg.includes('inasistencia') || msg.includes('asistencia')) {
    const riskySubjects = subjects.filter((s) => (s.currentAbsences || 0) >= (s.maxAbsences || 5) - 1);
    if (riskySubjects.length > 0) {
      return `Alerta de Asistencia: Tienes peligro de inasistencia en:\n` +
        riskySubjects.map((s) => `• **${s.name}**: ${s.currentAbsences || 0}/${s.maxAbsences || 5} faltas acumuladas.`).join('\n') +
        `\n\n¡Es estrictamente obligatorio que asistas a las próximas clases para no reprobar por inasistencias!`;
    }
    return `Las asistencias están bajo control en todas las asignaturas. Mantén ese ritmo y no gastes tus faltas permitidas a menos que sea una emergencia.`;
  }

  if (msg.includes('examen') || msg.includes('parcial') || msg.includes('nota') || msg.includes('salvavidas')) {
    return `Simulador de Calificaciones: Puedes abrir la calculadora de salvavidas en el menú de asignaturas. Recuerda ingresar los pesos exactos del sílabo para que te calcule la nota exacta que necesitas en el examen final.`;
  }

  if (msg.includes('cansado') || msg.includes('sueño') || msg.includes('estrés') || msg.includes('burnout')) {
    return `Pausa de emergencia: Si sientes fatiga mental, tu capacidad de retención cae drásticamente. Cierra los apuntes 20 minutos, da una caminata o toma agua. El descanso inteligente es parte del rendimiento.`;
  }

  // Respuesta general contextualizada
  return `Entendido. Tienes **${pending.length} tarea(s) pendiente(s)** y **${subjects.length} asignatura(s)** registradas.\n\n` +
    `Como tu Mentor, te recomiendo enfocar tu energía en bloques concentrados de 25-50 minutos. ¿Quieres que te ayude a planificar tu siguiente tarea o a calcular tus notas requeridas?`;
}
