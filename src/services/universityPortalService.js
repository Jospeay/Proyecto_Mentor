/**
 * ==============================================================================
 * MENTOR - SERVICIO DE CONEXIÓN CON PORTAL UNIVERSITARIO (universityPortalService.js)
 * ==============================================================================
 * 
 * Gestiona la sincronización y monitoreo de tareas desde el portal universitario:
 * - UAM Virtual Nicaragua (https://uamvirtual.uam.edu.ni/grado/my/)
 * - Moodle Genérico / Canvas LMS
 * 
 * Se conecta al motor de scraping en Electron (`universityScraper.js`) y al
 * cerebro IA (`aiMentorService.js`).
 * ==============================================================================
 */

import { attachSubjectIds } from '../utils/subjectMatcher';

const LOCAL_STORAGE_KEY = 'mentor_university_portal_config';
const NOTICES_STORAGE_KEY = 'mentor_university_notices';
const AI_ALERTS_KEY = 'mentor_ai_latest_alert';

export function getPortalConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
      : {
          enabled: true,
          platform: 'uam_moodle', // 'uam_moodle' | 'canvas' | 'moodle'
          portalUrl: 'https://uamvirtual.uam.edu.ni/grado',
          username: '',
          password: '',
          autoNotify: true,
          checkIntervalMinutes: 30,
          lastSync: null,
        };
  } catch (err) {
    return {
      enabled: true,
      platform: 'uam_moodle',
      portalUrl: 'https://uamvirtual.uam.edu.ni/grado',
      username: '',
      password: '',
      autoNotify: true,
    };
  }
}

export function savePortalConfig(config) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error guardando configuración del portal:', err);
  }
}

export function getSavedNotices() {
  try {
    const saved = localStorage.getItem(NOTICES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    return [];
  }
}

export function saveNotices(notices) {
  try {
    localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(notices));
  } catch (err) {
    console.error('Error guardando avisos:', err);
  }
}

export function getLatestAiAlert() {
  try {
    const saved = localStorage.getItem(AI_ALERTS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveLatestAiAlert(alert) {
  try {
    localStorage.setItem(AI_ALERTS_KEY, JSON.stringify(alert));
  } catch {}
}

/**
 * Ejecuta la sincronización real con el portal universitario vía Electron IPC.
 */
export async function syncUniversityTasksReal(config, studentState = {}) {
  if (window.mentorAPI && window.mentorAPI.syncUniversityPortal) {
    // 1. Ejecutar scraping
    const result = await window.mentorAPI.syncUniversityPortal(config);

    if (result && result.success && result.tasks) {
      // 2. Emparejar el curso extraído de Moodle con las asignaturas del usuario
      //    para que la tarea entre directamente en su columna del Kanban.
      const tasks = attachSubjectIds(result.tasks, studentState.subjects || []);

      // 3. Si se encontraron tareas nuevas, ejecutar el Cerebro IA
      if (window.mentorAPI.analyzeWorkload) {
        try {
          const geminiApiKey = localStorage.getItem('mentor_gemini_api_key') || '';
          const analysis = await window.mentorAPI.analyzeWorkload({
            newTasks: tasks,
            existingTasks: studentState.tasks || [],
            subjects: studentState.subjects || [],
            geminiApiKey,
          });

          if (analysis) {
            saveLatestAiAlert({
              ...analysis,
              timestamp: new Date().toISOString(),
              taskCount: tasks.length,
            });
          }
        } catch (aiErr) {
          console.warn('[PORTAL SERVICE] Error analizando con IA:', aiErr);
        }
      }

      return {
        success: true,
        tasks,
      };
    }

    return {
      success: false,
      tasks: [],
      error: result?.error || 'No se pudieron extraer tareas del portal.',
    };
  }

  // Fallback para navegador web (simulación)
  const simulated = simulateNewUniversityTask(studentState.subjects || []);
  return {
    success: true,
    tasks: attachSubjectIds([simulated], studentState.subjects || []),
    isSimulated: true,
  };
}

/**
 * Prueba las credenciales con el portal vía Electron IPC.
 */
export async function testPortalCredentials(config) {
  if (window.mentorAPI && window.mentorAPI.testPortalConnection) {
    return await window.mentorAPI.testPortalConnection(config);
  }

  // Fallback navegador
  await new Promise((res) => setTimeout(res, 1000));
  return { success: true, isSimulated: true };
}

/**
 * Envía una notificación nativa al escritorio.
 */
export function sendDesktopNotification(title, body) {
  try {
    if (window.mentorAPI && typeof window.mentorAPI.sendNotification === 'function') {
      window.mentorAPI.sendNotification({ title, body });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (err) {
    console.warn('No se pudo enviar notificación nativa:', err);
  }
}

/**
 * Simulación de tarea (fallback para web sin Electron).
 */
export function simulateNewUniversityTask(subjects = []) {
  const defaultSubjects = ['Estructura de Datos', 'Arquitectura de Software', 'Cálculo II', 'Redes'];
  const subjectNames = subjects.length > 0 ? subjects.map((s) => s.name) : defaultSubjects;
  const randomSubject = subjectNames[Math.floor(Math.random() * subjectNames.length)];

  const uamTaskTemplates = [
    { title: 'Laboratorio Práctico Moodle UAM', category: 'Laboratorio', daysOffset: 4, weight: 15 },
    { title: 'Entrega de Avance de Proyecto UAM', category: 'Proyecto', daysOffset: 6, weight: 20 },
    { title: 'Foro Evaluado de Debate UAM', category: 'Foro', daysOffset: 3, weight: 10 },
    { title: 'Cuestionario en Línea UAM Virtual', category: 'Examen', daysOffset: 2, weight: 10 },
  ];

  const template = uamTaskTemplates[Math.floor(Math.random() * uamTaskTemplates.length)];
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + template.daysOffset);

  const notice = {
    id: `uam-notice-${Date.now()}`,
    title: `${template.title} — ${randomSubject}`,
    subjectName: randomSubject,
    dueDate: dueDate.toISOString().slice(0, 10),
    weightPct: template.weight,
    category: template.category,
    detectedAt: new Date().toISOString(),
    isAdded: false,
    portalUrl: 'https://uamvirtual.uam.edu.ni/grado',
  };

  sendDesktopNotification(
    'Mentor: Nueva tarea en UAM Virtual',
    `Se abrió en UAM Virtual: "${notice.title}". Vence el ${notice.dueDate}.`
  );

  return notice;
}

/**
 * Convierte un aviso detectado en una tarea del estudiante.
 */
export function convertNoticeToTask(notice, subjects = []) {
  const [matched] = notice.subjectId ? [notice] : attachSubjectIds([notice], subjects);

  return {
    id: `task-uam-${Date.now()}`,
    title: matched.title,
    subjectId: matched.subjectId || null,
    subject: matched.subjectName,
    dueDate: matched.dueDate,
    urgency: 'high',
    status: 'todo',
    completed: false,
    category: matched.category || 'Actividad',
    notes: `Importado automáticamente desde ${notice.portalUrl || 'Portal Universitario'}.`,
    createdAt: new Date().toISOString(),
  };
}
