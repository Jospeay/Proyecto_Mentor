/**
 * ==============================================================================
 * MENTOR - SERVICIO DE INTELIGENCIA ARTIFICIAL (aiService.js)
 * ==============================================================================
 * 
 * Gestiona el Chat de IA del Mentor Académico. Soporta la API de Groq
 * (Llama 3.3 70B / Llama 3.1 8B) y un motor local inteligente contextualizado
 * con el estado real del estudiante.
 * ==============================================================================
 */

const API_KEY_STORAGE = 'mentor_groq_api_key';

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function saveApiKey(key) {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
}

// Backward compat aliases
export const getGeminiApiKey = getApiKey;
export const saveGeminiApiKey = saveApiKey;

/**
 * Genera la respuesta del Mentor IA basada en el mensaje del usuario y el estado académico.
 */
export async function queryMentorAI(userMessage, studentState = {}, chatHistory = [], options = {}) {
  const apiKey = getApiKey();

  // Si el usuario configuró una API Key, intenta llamar a Groq
  if (apiKey) {
    try {
      return await callCloudApi(apiKey, userMessage, studentState, chatHistory, options);
    } catch (err) {
      if (err.message && err.message.includes('CREDENTIALS_ERROR')) {
        return '⚠️ **Error de credenciales**: Tu API Key de Groq no es válida o fue deshabilitada.\n\nPor favor actualiza tu Clave API en la configuración del chat (ícono 🔑 en la cabecera) o desactiva la API Key para usar el asistente local.';
      }
      if (err.message && err.message.includes('RATE_LIMIT')) {
        throw err;
      }
      console.warn('Error llamando API de Groq, utilizando Motor Mentor Local:', err);
    }
  }

  // Fallback: Motor Inteligente Local de Mentor
  return generateLocalMentorResponse(userMessage, studentState, options);
}

/**
 * Chat de IA exclusivo para documentos (La Bóveda).
 * Recibe el texto extraído del PDF y responde basándose estrictamente en ese contenido.
 */
export async function askDocumentQA(userMessage, pdfText = '', documentName = '', mode = 'study', chatHistory = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return generateLocalDocumentResponse(userMessage, documentName, mode);
  }

  const truncatedPdf = pdfText.slice(0, 30000);

  const modeInstructions = mode === 'exam'
    ? 'Genera un test riguroso estrictamente basado en el contenido del documento. Incluye seleccion multiple, preguntas de analisis y respuestas justificadas. Espera la respuesta del usuario para calificar.'
    : 'Eres un tutor experto analizando un documento especifico. Explica el tema del documento de forma exhaustiva, profunda y detallada, usando analogias. Responde SOLO basandote en el contenido del documento proporcionado.';

  const systemContext = `Eres un tutor experto de La Boveda. Tu tarea es responder preguntas sobre el documento "${documentName}".
MODO ACTIVO (${mode === 'exam' ? 'EXAMEN' : 'ESTUDIO'}):
${modeInstructions}
CONTEXTO DEL DOCUMENTO (texto extraido del PDF):
---
${truncatedPdf}
---
INSTRUCCIONES CRITICAS:
- Responde EXCLUSIVAMENTE basandote en el texto del documento arriba.
- Si la pregunta no tiene relacion con el documento, indica que solo puedes responder sobre el material proporcionado.
- NUNCA inventes informacion que no este en el documento.`;

  if (window.mentorAPI?.aiDocQA) {
    try {
      const result = await window.mentorAPI.aiDocQA({ prompt: userMessage, systemContext, apiKey });
      if (result?.success) return result.response;
      if (result?.errorType === 'credentials') {
        return '⚠️ **Error de credenciales**: Tu API Key de Groq no es válida o fue deshabilitada.\n\nPor favor actualiza tu Clave API en la configuración del chat.';
      }
      if (result?.errorType === 'rate_limit') {
        return '⚠️ **Limite de velocidad**: Has excedido el numero de solicitudes. Intenta de nuevo en 60 segundos.';
      }
      throw new Error(result?.error || 'AI DocQA IPC failed');
    } catch (err) {
      console.warn('[aiService] IPC aiDocQA failed:', err.message);
    }
  }

  return generateLocalDocumentResponse(userMessage, documentName, mode);
}

function generateLocalDocumentResponse(userMessage, documentName, mode) {
  const msg = userMessage.toLowerCase();
  if (mode === 'exam') {
    return `**Modo Examen — ${documentName}**\n\n1. Selección múltiple: Según el documento, ¿cuál es la idea central?\n2. Análisis: Explica cómo aplicarías el concepto principal en un caso nuevo.\n\nResponde primero; después calificaré tus respuestas.`;
  }
  return `Estoy listo para responder preguntas sobre **${documentName}**. Hazme una pregunta sobre el contenido del documento y te responderé basándome en su texto.`;
}

/**
 * Llamada real a la API de Groq via IPC (main process, key hidden from renderer)
 */
async function callCloudApi(apiKey, userMessage, studentState, chatHistory, options = {}) {
  const { tasks = [], subjects = [] } = studentState;
  const pendingTasks = tasks.filter((t) => !t.completed);

  const learningModePrompt = options.mode === 'exam'
    ? 'Genera un test riguroso basado estrictamente en el material adjunto. Incluye seleccion multiple y preguntas de analisis. Espera la respuesta del usuario para calificar.'
    : 'Analiza el material adjunto y compotate como un tutor experto. Explica el tema de forma exhaustiva, profunda y detallada, usando analogias. No resumas demasiado; el objetivo es el entendimiento total del alumno.';

  const systemContext = `
Eres 'Mentor', un asistente academico inteligente, empatico y directo. Tu tono es amigable, conversacional y natural. Si el usuario te saluda o hace charla casual (ej. '¿como estas?'), respondele de forma humana y calida, y luego guialo suavemente de vuelta a sus tareas o estudios. Tienes acceso a sus asignaturas e inasistencias, usalas para darle consejos proactivos, pero NUNCA suenes como un robot leyendo una base de datos.

MODO ACTIVO (${options.mode === 'exam' ? 'EXAMEN' : 'ESTUDIO'}):
${learningModePrompt}
MATERIAL ADJUNTO: ${options.materialName || 'No se proporciono un documento especifico.'}

CONTEXTO ACTUAL DEL ESTUDIANTE:
- Asignaturas activas (${subjects.length}): ${subjects.map((s) => `${s.name} (Faltas: ${s.currentAbsences || 0}/${s.maxAbsences || 5})`).join(', ') || 'Ninguna aun'}
- Tareas pendientes (${pendingTasks.length}): ${pendingTasks.map((t) => `${t.title} [${t.subject}] (Vence: ${t.dueDate || 'Sin fecha'})`).join(', ') || 'Ninguna'}
  `.trim();

  if (window.mentorAPI?.aiChat) {
    try {
      const result = await window.mentorAPI.aiChat({ prompt: systemContext + '\n\nMENSAJE DEL USUARIO: ' + userMessage, apiKey });
      if (result?.success) return result.response;
      if (result?.errorType === 'credentials') {
        throw new Error('CREDENTIALS_ERROR: ' + result.error);
      }
      if (result?.errorType === 'rate_limit') {
        throw new Error('RATE_LIMIT: ' + result.error);
      }
      throw new Error(result?.error || 'AI IPC failed');
    } catch (err) {
      if (err.message?.includes('CREDENTIALS_ERROR')) throw err;
      if (err.message?.includes('RATE_LIMIT')) throw err;
      console.warn('[aiService] IPC aiChat failed, trying local:', err.message);
    }
  }

  throw new Error('No AI backend available');
}

/**
 * Motor Local Inteligente de Mentor (sin necesidad de API Key)
 */
function generateLocalMentorResponse(userMessage, studentState, options = {}) {
  const msg = userMessage.toLowerCase();
  const { tasks = [], subjects = [] } = studentState;
  const pending = tasks.filter((t) => !t.completed);

  if (options.mode === 'exam') {
    return `**Modo Examen — ${options.materialName || 'material seleccionado'}**\n\n1. Selección múltiple: ¿Cuál es la idea central del material?\n2. Análisis: Explica cómo aplicarías el concepto principal en un caso nuevo.\n\nResponde primero; después calificaré tus respuestas.`;
  }

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
