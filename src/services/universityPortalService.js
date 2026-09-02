/**
 * ==============================================================================
 * SERVICIO DE CONEXIÓN CON PORTAL UNIVERSITARIO
 * ==============================================================================
 * Scraping real vía Electron IPC (Playwright headless).
 * NO contiene datos simulados — toda la información proviene del scraper.
 *
 * Flujo:
 *   1. El usuario ingresa URL, usuario y contraseña en UniversityConfigView.
 *   2. syncUniversityTasksReal() llama al scraper vía Electron IPC.
 *   3. El scraper abre un navegador headless real, hace login y extrae tareas.
 *   4. Se comparan las tareas extraídas contra las existentes en la DB.
 *   5. Si hay tareas nuevas, se dispara una notificación nativa del SO.
 *   6. Opcionalmente, se invoca el analizador IA de carga académica.
 * ==============================================================================
 */

const LOCAL_STORAGE_KEY = 'mentor_university_portal_config';
const NOTICES_STORAGE_KEY = 'mentor_university_notices';
const AI_ALERTS_KEY = 'mentor_ai_latest_alert';

export function getPortalConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      // Migración de instalaciones anteriores: retirar la contraseña que pudo
      // quedar en localStorage y enviarla al vault cifrado cuando exista.
      if (config.password) {
        const { password, ...publicConfig } = config;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(publicConfig));
        window.mentorAPI?.savePortalCredentials?.({
          username: config.username || '',
          password,
        }).catch(() => {});
        return { ...publicConfig, password };
      }
      return config;
    }
    return {
          enabled: true,
          platform: 'uam_moodle',
          portalUrl: '',
          username: '',
          password: '',
          autoNotify: true,
          checkIntervalMinutes: 30,
          lastSync: null,
        };
  } catch {
    return {
      enabled: true,
      platform: 'uam_moodle',
      portalUrl: '',
      username: '',
      password: '',
      autoNotify: true,
      lastSync: null,
    };
  }
}

export function savePortalConfig(config) {
  try {
    const { password, ...publicConfig } = config;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(publicConfig));
    if (window.mentorAPI?.savePortalCredentials && (config.username || password)) {
      window.mentorAPI.savePortalCredentials({ username: config.username || '', password: password || '' })
        .catch((err) => console.warn('No se pudieron cifrar las credenciales del portal:', err));
    }
  } catch (err) {
    console.error('Error guardando configuración del portal:', err);
  }
}

/** Carga las credenciales desde el almacén cifrado nativo de Electron. */
export async function loadPortalConfig() {
  const config = getPortalConfig();
  if (!window.mentorAPI?.getPortalCredentials) return config;

  try {
    const result = await window.mentorAPI.getPortalCredentials();
    return result?.success ? { ...config, ...result.credentials } : config;
  } catch {
    return config;
  }
}

export function getSavedNotices() {
  try {
    const saved = localStorage.getItem(NOTICES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveNotices(notices) {
  try {
    // Merge with existing notices to preserve `notificado` state from prior scrapes
    const existing = getSavedNotices();
    const existingMap = new Map();
    for (const n of existing) {
      const key = `${(n.title || '').toLowerCase().trim()}|${(n.subjectName || n.subject || '').toLowerCase().trim()}|${(n.dueDate || '')}`;
      existingMap.set(key, n);
    }
    const merged = notices.map((n) => {
      const key = `${(n.title || '').toLowerCase().trim()}|${(n.subjectName || n.subject || '').toLowerCase().trim()}|${(n.dueDate || '')}`;
      const prev = existingMap.get(key);
      return {
        ...n,
        notificado: prev ? (prev.notificado || false) : false,
      };
    });
    localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(merged));
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

export function getRecentScrapedTasks() {
  try {
    const saved = localStorage.getItem(NOTICES_STORAGE_KEY);
    if (!saved) return [];
    const notices = JSON.parse(saved);
    if (!Array.isArray(notices)) return [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return notices.filter((n) => {
      if (!n.detectedAt) return true;
      return new Date(n.detectedAt).getTime() > sevenDaysAgo;
    });
  } catch {
    return [];
  }
}

/**
 * Returns scraped tasks that have NOT been notified/dismissed by the user yet.
 * This is the list that shows up in the Dashboard notification card.
 */
export function getUnnotifiedScrapedTasks() {
  try {
    const saved = localStorage.getItem(NOTICES_STORAGE_KEY);
    if (!saved) return [];
    const notices = JSON.parse(saved);
    if (!Array.isArray(notices)) return [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return notices.filter((n) => {
      if (n.notificado) return false;
      if (!n.detectedAt) return true;
      return new Date(n.detectedAt).getTime() > sevenDaysAgo;
    });
  } catch {
    return [];
  }
}

/**
 * Marks a scraped notice as notified (user saw or dismissed it).
 * Matches by title + subjectName + dueDate composite key.
 */
export function markNoticeAsNotified(title, subjectName, dueDate) {
  try {
    const saved = localStorage.getItem(NOTICES_STORAGE_KEY);
    if (!saved) return;
    const notices = JSON.parse(saved);
    if (!Array.isArray(notices)) return;
    const key = `${(title || '').toLowerCase().trim()}|${(subjectName || '').toLowerCase().trim()}|${(dueDate || '')}`;
    const updated = notices.map((n) => {
      const nKey = `${(n.title || '').toLowerCase().trim()}|${(n.subjectName || n.subject || '').toLowerCase().trim()}|${(n.dueDate || '')}`;
      if (nKey === key) {
        return { ...n, notificado: true };
      }
      return n;
    });
    localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error marcando aviso como notificado:', err);
  }
}

/**
 * Marks ALL unnotified scraped tasks as notified (bulk dismiss).
 */
export function markAllNoticesAsNotified() {
  try {
    const saved = localStorage.getItem(NOTICES_STORAGE_KEY);
    if (!saved) return;
    const notices = JSON.parse(saved);
    if (!Array.isArray(notices)) return;
    const updated = notices.map((n) => ({ ...n, notificado: true }));
    localStorage.setItem(NOTICES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error marcando todos los avisos como notificados:', err);
  }
}

export function saveLatestAiAlert(alert) {
  try {
    localStorage.setItem(AI_ALERTS_KEY, JSON.stringify(alert));
  } catch {}
}

/**
 * Compara tareas extraídas contra las existentes para identificar las nuevas.
 * Compara por título + materia en minúsculas para evitar duplicados por formato.
 */
export function findNewTasks(scrapedTasks = [], existingTasks = []) {
  const existingKeys = new Set(
    existingTasks.map((t) =>
      `${(t.title || '').toLowerCase().trim()}|${(t.subject || '').toLowerCase().trim()}`
    )
  );

  return scrapedTasks.filter((t) => {
    const key = `${(t.title || '').toLowerCase().trim()}|${(t.subjectName || t.subject || '').toLowerCase().trim()}`;
    return !existingKeys.has(key);
  });
}

/**
 * Ejecuta sincronización real con el portal universitario vía Electron IPC.
 *
 * El flujo completo es:
 *   1. Llama al scraper Playwright real en el proceso principal de Electron.
 *   2. Recibe las tareas extraídas del portal (Moodle/Canvas).
 *   3. Compara contra las tareas existentes del estudiante.
 *   4. Si hay nuevas, dispara notificación nativa del SO y análisis IA.
 *
 * @param {Object} config        - Configuración del portal (URL, credenciales, plataforma)
 * @param {Object} studentState  - Estado actual del estudiante (asignaturas, tareas)
 * @returns {Promise<Object>}    - Resultado con tareas extraídas y nuevas
 */
export async function syncUniversityTasksReal(config, studentState = {}) {
  if (!window.mentorAPI?.syncUniversityPortal) {
    return {
      success: false,
      tasks: [],
      error: 'El scraping requiere la app de escritorio Electron. Ejecuta: npm run electron:start',
    };
  }

  // Pass user subjects to scraper for Plan B subject matching
  const scraperConfig = {
    ...config,
    userSubjects: (studentState.subjects || []).map(s => ({ name: s.name, code: s.code })),
  };

  const result = await window.mentorAPI.syncUniversityPortal(scraperConfig);

  if (!result?.success) {
    return {
      success: false,
      tasks: [],
      error: result?.error || 'No se pudieron extraer tareas del portal.',
    };
  }

  const allTasks = result.tasks || [];
  const newTasks = findNewTasks(allTasks, studentState.tasks || []);
  const newTasksCount = newTasks.length;

  // NOTIFICACIÓN NATIVA DEL SO — Cuando el scraper encuentra tareas nuevas
  // Se usa el módulo Notification de Electron vía IPC para generar una
  // notificación real en Windows/macOS/Linux.
  if (newTasksCount > 0 && config.autoNotify !== false) {
    sendDesktopNotification(
      'Mentor: Sincronización completada',
      `Se han sincronizado ${newTasksCount} nueva${newTasksCount === 1 ? '' : 's'} tarea${newTasksCount === 1 ? '' : 's'} de tu plataforma`
    );
  }

  // ANÁLISIS IA — Opcional: analiza la carga de trabajo con Gemini o motor local
  if (newTasksCount > 0 && window.mentorAPI.analyzeWorkload) {
    try {
      const geminiApiKey = localStorage.getItem('mentor_gemini_api_key') || '';
      const analysis = await window.mentorAPI.analyzeWorkload({
        newTasks,
        existingTasks: studentState.tasks || [],
        subjects: studentState.subjects || [],
        geminiApiKey,
      });

      if (analysis) {
        saveLatestAiAlert({
          ...analysis,
          timestamp: new Date().toISOString(),
          taskCount: newTasksCount,
        });
      }
    } catch (aiErr) {
      console.warn('[PORTAL SERVICE] Error analizando con IA:', aiErr);
    }
  }

  savePortalConfig({ ...config, lastSync: new Date().toISOString() });
  saveNotices(allTasks);

  return {
    success: true,
    tasks: allTasks,
    newTasks,
    newTasksCount,
  };
}

/**
 * Prueba credenciales reales contra el portal vía Electron IPC.
 * Lanza un navegador headless, intenta hacer login y verifica si fue exitoso.
 */
export async function testPortalCredentials(config) {
  if (!window.mentorAPI?.testPortalConnection) {
    return {
      success: false,
      error: 'La prueba de conexión requiere la app de escritorio Electron.',
    };
  }

  return await window.mentorAPI.testPortalConnection(config);
}

/**
 * Envía notificación nativa del SO vía Electron IPC.
 *
 * Prioriza el módulo Notification de Electron (vía IPC al main process).
 * Si Electron no está disponible (modo web), usa la Web Notification API
 * como fallback del navegador.
 *
 * @param {string} title - Título de la notificación
 * @param {string} body  - Cuerpo del mensaje
 */
export function sendDesktopNotification(title, body) {
  if (window.mentorAPI?.sendNotification) {
    window.mentorAPI.sendNotification({ title, body });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

/**
 * Convierte un aviso detectado por el scraper en una tarea del estudiante.
 * Se asigna urgencia alta por defecto ya que viene del portal universitario.
 */
export function convertNoticeToTask(notice) {
  return {
    title: notice.title,
    subject: notice.subjectName,
    subjectCode: notice.subjectCode || '',
    dueDate: notice.dueDate,
    urgency: 'high',
    status: 'todo',
    completed: false,
    notes: `Importado desde ${notice.portalUrl || 'Portal Universitario'}.`,
    createdAt: new Date().toISOString(),
  };
}
