/**
 * ==============================================================================
 * MENTOR - MOTOR DE SCRAPING UNIVERSITARIO (universityScraper.js)
 * ==============================================================================
 *
 * Servicio del proceso principal de Electron que se conecta a plataformas LMS
 * (Moodle / Canvas) usando Playwright en modo headless para extraer tareas,
 * entregas y eventos del calendario académico del estudiante.
 *
 * Soporta:
 *   - Moodle (UAM Virtual Nicaragua y cualquier instancia Moodle estándar)
 *   - Canvas LMS (vía scraping de UI o API REST con session cookie)
 *
 * Seguridad:
 *   - Las credenciales se reciben cifradas desde el renderer vía IPC.
 *   - El navegador headless se cierra siempre al finalizar (try/finally).
 *   - No se persisten cookies ni sesiones entre ejecuciones.
 * ==============================================================================
 */

let chromium;
try {
  chromium = require('playwright-core').chromium;
} catch {
  try {
    chromium = require('playwright').chromium;
  } catch {
    chromium = null;
  }
}

/**
 * Ejecuta el scraper completo contra el portal universitario.
 *
 * @param {Object} options
 * @param {string} options.platform     - 'uam_moodle' | 'moodle' | 'canvas'
 * @param {string} options.portalUrl    - URL base del portal (ej: https://uamvirtual.uam.edu.ni/grado)
 * @param {string} options.username     - Usuario del portal
 * @param {string} options.password     - Contraseña del portal (ya descifrada)
 * @param {Function} [options.onProgress] - Callback de progreso (step, message)
 * @returns {Promise<{ success: boolean, tasks: Array, error?: string }>}
 */
async function scrapeUniversityPortal({ platform, portalUrl, username, password, onProgress }) {
  const progress = onProgress || (() => {});

  if (!chromium) {
    return {
      success: false,
      tasks: [],
      error: 'Playwright no está instalado. Ejecuta: npm install playwright',
    };
  }

  if (!username || !password) {
    return { success: false, tasks: [], error: 'Credenciales no proporcionadas.' };
  }

  let browser = null;

  try {
    progress('launching', 'Iniciando navegador headless...');

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    let tasks = [];

    if (platform === 'canvas') {
      tasks = await scrapeCanvas(page, portalUrl, username, password, progress);
    } else {
      // Moodle (uam_moodle y moodle genérico)
      tasks = await scrapeMoodle(page, portalUrl, username, password, progress);
    }

    progress('done', `Extracción completada. ${tasks.length} tarea(s) encontrada(s).`);

    return { success: true, tasks };
  } catch (err) {
    console.error('[SCRAPER] Error:', err.message);

    // Errores conocidos con mensajes amigables
    if (err.message.includes('net::ERR_NAME_NOT_RESOLVED') || err.message.includes('net::ERR_CONNECTION')) {
      return { success: false, tasks: [], error: 'No se puede acceder al portal. Verifica tu conexión a internet y la URL.' };
    }
    if (err.message.includes('LOGIN_FAILED')) {
      return { success: false, tasks: [], error: 'Credenciales incorrectas. Verifica tu usuario y contraseña del portal.' };
    }
    if (err.message.includes('Timeout')) {
      return { success: false, tasks: [], error: 'El portal tardó demasiado en responder. Intenta de nuevo más tarde.' };
    }

    return { success: false, tasks: [], error: err.message };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Prueba la conexión y credenciales sin extraer datos.
 */
async function testConnection({ platform, portalUrl, username, password, onProgress }) {
  const progress = onProgress || (() => {});

  if (!chromium) {
    return { success: false, error: 'Playwright no está instalado.' };
  }

  let browser = null;

  try {
    progress('launching', 'Probando conexión...');

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    if (platform === 'canvas') {
      await loginCanvas(page, portalUrl, username, password, progress);
    } else {
      await loginMoodle(page, portalUrl, username, password, progress);
    }

    progress('done', '¡Conexión exitosa! Credenciales válidas.');
    return { success: true };
  } catch (err) {
    if (err.message.includes('LOGIN_FAILED')) {
      return { success: false, error: 'Credenciales incorrectas.' };
    }
    return { success: false, error: err.message };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// =============================================================================
// MOODLE SCRAPING
// =============================================================================

async function loginMoodle(page, portalUrl, username, password, progress) {
  // Normalizar URL base
  const baseUrl = portalUrl.replace(/\/+$/, '');
  const loginUrl = `${baseUrl}/login/index.php`;

  progress('navigating', 'Navegando al login de Moodle...');
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  // Detectar formulario de login
  const usernameSelector = '#username, input[name="username"], input[id="username"]';
  const passwordSelector = '#password, input[name="password"], input[id="password"]';

  await page.waitForSelector(usernameSelector, { timeout: 15000 });

  progress('logging_in', 'Ingresando credenciales...');
  await page.fill(usernameSelector, username);
  await page.fill(passwordSelector, password);

  // Enviar formulario
  const loginBtnSelector = '#loginbtn, button[type="submit"], input[type="submit"]';
  await page.click(loginBtnSelector);

  // Esperar navegación post-login
  await page.waitForLoadState('domcontentloaded');

  // Verificar login exitoso: buscar errores de login
  const loginError = await page.$('.loginerrors, .alert-danger, #loginerrormessage, .login-form .error');
  if (loginError) {
    const errorText = await loginError.textContent();
    throw new Error(`LOGIN_FAILED: ${errorText.trim()}`);
  }

  // Verificar que estamos en el dashboard (no redirigidos al login de nuevo)
  const currentUrl = page.url();
  if (currentUrl.includes('/login/')) {
    throw new Error('LOGIN_FAILED: Redirigido al login. Verifica credenciales.');
  }

  progress('authenticated', '¡Autenticado correctamente en Moodle!');
}

async function scrapeMoodle(page, portalUrl, username, password, progress) {
  await loginMoodle(page, portalUrl, username, password, progress);

  const baseUrl = portalUrl.replace(/\/+$/, '');

  // ─── Estrategia 1: Timeline / Próximos eventos del Dashboard ───
  progress('extracting', 'Buscando tareas en el Timeline de Moodle...');

  let tasks = [];

  // Intentar extraer del bloque de timeline del dashboard
  try {
    await page.goto(`${baseUrl}/my/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Esperar carga AJAX del timeline

    // Moodle 3.x / 4.x timeline block
    const timelineEvents = await page.$$eval(
      '[data-region="event-list-content"] [data-region="event-list-item"], .event .card, .timeline-event-list-item',
      (elements) => {
        return elements.map((el) => {
          const titleEl = el.querySelector('.event-name a, .event-name, h3, .name a, [data-region="event-name"]');
          const dateEl = el.querySelector('.date, .col-11 small, [data-region="event-date"], time');

          // El nombre del curso en el timeline aparece como enlace al curso o texto atenuado
          const courseEl = el.querySelector(
            'a[href*="/course/view.php"], [data-region="event-course"], .course-name, .text-muted, small'
          );

          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            dueDate: dateEl ? dateEl.textContent.trim() : '',
            subject: courseEl ? courseEl.textContent.trim() : '',
            url: titleEl?.href || '',
          };
        }).filter((t) => t.title);
      }
    ).catch(() => []);

    if (timelineEvents.length > 0) {
      tasks.push(...timelineEvents);
    }
  } catch (e) {
    console.warn('[SCRAPER] Timeline extraction failed, trying calendar...', e.message);
  }

  // ─── Estrategia 2: Calendario de Moodle (upcoming events) ───
  progress('extracting', 'Buscando en el Calendario de Moodle...');
  try {
      await page.goto(`${baseUrl}/calendar/view.php?view=upcoming`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const calendarEvents = await page.$$eval(
        '.event, .eventlist .event, [data-event-id], .calendar-event-panel',
        (elements) => {
          return elements.map((el) => {
            const titleEl = el.querySelector('.name a, .referer a, h3 a, .event-name');
            const dateEl = el.querySelector('.date, time, .col-11');
            const courseEl = el.querySelector(
              'a[href*="/course/view.php"], .course a, .course, [data-region="event-course"], .text-muted'
            );

            return {
              title: titleEl ? titleEl.textContent.trim() : el.textContent.trim().slice(0, 80),
              dueDate: dateEl ? dateEl.textContent.trim() : '',
              subject: courseEl ? courseEl.textContent.trim() : '',
              url: titleEl?.href || '',
            };
          }).filter((t) => t.title);
        }
      ).catch(() => []);

      tasks.push(...calendarEvents);
    } catch (e) {
      console.warn('[SCRAPER] Calendar extraction failed:', e.message);
    }

  // ─── Estrategia 3: Todas las actividades de tipo "assign" ───
  progress('extracting', 'Buscando actividades de entrega (assign)...');
  try {
      // Obtener lista de cursos del usuario
      const courseLinks = await page.$$eval(
        '.course-listitem a[href*="/course/view.php"], a.coursename, .courses .coursebox a, [data-region="course-content"] a[href*="/course/view.php"], a[href*="/course/view.php"]',
        (links) => {
          const seen = new Set();
          return links
            .map((a) => a.href.split('&')[0])
            .filter((href) => {
              if (!href || seen.has(href)) return false;
              seen.add(href);
              return true;
            });
        }
      ).catch(() => []);

      for (const courseUrl of courseLinks.slice(0, 12)) { // Máximo 12 cursos
        try {
          await page.goto(courseUrl, { waitUntil: 'domcontentloaded' });
          const courseName = await extractMoodleCourseName(page);

          const assignLinks = await page.$$eval(
            'a[href*="/mod/assign/view.php"], a[href*="/mod/quiz/view.php"], a[href*="/mod/forum/view.php"]',
            (links) => links.map((a) => ({
              title: a.textContent.trim(),
              url: a.href,
            })).filter((l) => l.title)
          ).catch(() => []);

          for (const assign of assignLinks) {
            tasks.push({
              title: assign.title,
              dueDate: '',
              subject: courseName,
              url: assign.url,
            });
          }

          // Reetiquetar tareas del timeline/calendario que quedaron sin curso
          // pero cuya URL pertenece a este curso (mismo id de curso en Moodle).
          const courseId = new URL(courseUrl).searchParams.get('id');
          if (courseId && courseName) {
            for (const t of tasks) {
              if (!t.subject && t.url && t.url.includes(`course=${courseId}`)) {
                t.subject = courseName;
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (e) {
      console.warn('[SCRAPER] Assignment extraction failed:', e.message);
    }

  // Normalizar y deduplicar tareas
  return normalizeTasks(tasks, 'moodle', portalUrl);
}

/**
 * Extrae el nombre del curso de una página de Moodle probando, en orden:
 *   1. El breadcrumb de navegación superior (enlace a /course/view.php).
 *   2. El encabezado de la página (h1 / .page-header-headings).
 *   3. El bloque de navegación lateral o el título del documento.
 *
 * Devuelve algo como "CEP0004 - B1 COMMUNICATIVE ENGLISH" para que el
 * emparejador con las asignaturas del usuario tenga tanto código como nombre.
 */
async function extractMoodleCourseName(page) {
  const candidates = await page.evaluate(() => {
    const texts = [];
    const push = (value) => {
      const text = (value || '').replace(/\s+/g, ' ').trim();
      if (text && text.length > 2) texts.push(text);
    };

    // 1. Breadcrumb superior (Moodle 3.x: .breadcrumb, Moodle 4.x: nav[aria-label] ol)
    document
      .querySelectorAll(
        '.breadcrumb a[href*="/course/view.php"], nav[aria-label] a[href*="/course/view.php"], #page-navbar a[href*="/course/view.php"], .breadcrumb-item a[title]'
      )
      .forEach((el) => push(el.getAttribute('title') || el.textContent));

    // 2. Encabezado / título del curso
    document
      .querySelectorAll('.page-header-headings h1, #page-header h1, header h1, h1')
      .forEach((el) => push(el.textContent));

    // 3. Bloque de navegación / cabecera del curso
    document
      .querySelectorAll('.block_navigation .type_course a, .coursename, .course-title, [data-region="course-name"]')
      .forEach((el) => push(el.textContent));

    // 4. Título del documento como último recurso ("Curso: B1 COMMUNICATIVE ENGLISH")
    push(document.title.replace(/^\s*(curso|course)\s*:\s*/i, ''));

    return texts;
  }).catch(() => []);

  const blacklist = /^(inicio|home|dashboard|mis cursos|my courses|area personal|área personal|cursos|courses|p[aá]gina principal)$/i;
  const best = candidates.find((text) => !blacklist.test(text));
  return best || '';
}

// =============================================================================
// CANVAS SCRAPING
// =============================================================================

async function loginCanvas(page, portalUrl, username, password, progress) {
  const baseUrl = portalUrl.replace(/\/+$/, '');
  const loginUrl = `${baseUrl}/login/canvas`;

  progress('navigating', 'Navegando al login de Canvas...');
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  const usernameSelector = '#pseudonym_session_unique_id, input[name="pseudonym_session[unique_id]"]';
  const passwordSelector = '#pseudonym_session_password, input[name="pseudonym_session[password]"]';

  await page.waitForSelector(usernameSelector, { timeout: 15000 });

  progress('logging_in', 'Ingresando credenciales...');
  await page.fill(usernameSelector, username);
  await page.fill(passwordSelector, password);

  await page.click('.Button--login, button[type="submit"], input[type="submit"]');
  await page.waitForLoadState('domcontentloaded');

  // Verificar errores
  const flashError = await page.$('#flash_message_holder .ic-flash-error, .ic-flash-error, .error_message');
  if (flashError) {
    const errorText = await flashError.textContent();
    throw new Error(`LOGIN_FAILED: ${errorText.trim()}`);
  }

  if (page.url().includes('/login')) {
    throw new Error('LOGIN_FAILED: Redirigido al login. Verifica credenciales.');
  }

  progress('authenticated', '¡Autenticado correctamente en Canvas!');
}

async function scrapeCanvas(page, portalUrl, username, password, progress) {
  await loginCanvas(page, portalUrl, username, password, progress);

  const baseUrl = portalUrl.replace(/\/+$/, '');
  let tasks = [];

  // ─── Estrategia 1: API REST con session cookie (más confiable) ───
  progress('extracting', 'Extrayendo tareas vía Canvas API...');
  try {
    const todoResponse = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/v1/users/self/todo?per_page=50`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error('API not available');
      return res.json();
    }, baseUrl);

    if (Array.isArray(todoResponse)) {
      tasks = todoResponse.map((item) => ({
        title: item.assignment?.name || item.plannable?.title || 'Sin título',
        dueDate: item.assignment?.due_at || item.plannable?.due_at || '',
        subject: item.context_name || '',
        url: item.html_url || '',
      }));
    }
  } catch {
    console.warn('[SCRAPER] Canvas API failed, trying UI scraping...');
  }

  // ─── Estrategia 2: Scraping de UI del planner ───
  if (tasks.length === 0) {
    progress('extracting', 'Extrayendo desde la interfaz de Canvas...');
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      const plannerItems = await page.$$eval(
        '.planner-item, [data-testid="planner-item"], .todo-list-item',
        (elements) => elements.map((el) => {
          const titleEl = el.querySelector('.PlannerItem-styles__title, a[href*="/assignments/"]');
          const dateEl = el.querySelector('.PlannerItem-styles__due, time');
          const courseEl = el.querySelector('.PlannerItem-styles__course, .course');
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            dueDate: dateEl ? (dateEl.getAttribute('datetime') || dateEl.textContent.trim()) : '',
            subject: courseEl ? courseEl.textContent.trim() : '',
          };
        }).filter((t) => t.title)
      ).catch(() => []);

      tasks = plannerItems;
    } catch (e) {
      console.warn('[SCRAPER] Canvas UI scraping failed:', e.message);
    }
  }

  return normalizeTasks(tasks, 'canvas', portalUrl);
}

// =============================================================================
// UTILIDADES
// =============================================================================

/**
 * Normaliza, deduplicar y formatea las tareas extraídas.
 */
function normalizeTasks(rawTasks, platform, portalUrl) {
  const seen = new Set();

  return rawTasks
    .filter((t) => {
      if (!t.title || t.title.length < 3) return false;
      
      // Filtrar eventos de calendario que son solo horarios de clase (ej: "Mañana, 11:00 » 12:50")
      if (/\d{1,2}:\d{2}\s*»\s*\d{1,2}:\d{2}/.test(t.title)) return false;

      const key = `${t.title}|${t.subject}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({
      id: `scraper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: t.title.slice(0, 120),
      subjectRaw: (t.subject || '').replace(/\s+/g, ' ').trim(),
      subjectCode: extractCourseCode(t.subject || t.title || ''),
      subjectName: cleanSubjectName(t.subject) || 'Sin materia identificada',
      dueDate: parseDateString(t.dueDate),
      category: categorizeTask(t.title),
      detectedAt: new Date().toISOString(),
      isAdded: false,
      portalUrl: t.url || portalUrl,
      source: platform,
    }));
}

/** Extrae códigos de curso tipo "CEP0004" o "MAT-101". */
function extractCourseCode(text) {
  const match = String(text || '').toUpperCase().match(/\b([A-Z]{2,6}[-_ ]?\d{3,5})\b/);
  return match ? match[1].replace(/[-_ ]/g, '') : '';
}

/** Limpia el texto del curso extraído de Moodle (grupos, periodos, separadores). */
function cleanSubjectName(text) {
  return String(text || '')
    .replace(/\s*[»›>|/]\s*/g, ' ')
    .replace(/\((?:[^)]*)\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intenta parsear fechas en diversos formatos de Moodle/Canvas.
 */
function parseDateString(dateStr) {
  if (!dateStr) return '';

  // ISO format
  if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { /* ignore */ }
  }

  // Moodle Spanish: "Martes, 15 de septiembre de 2026, 23:59"
  const spanishMatch = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (spanishMatch) {
    const months = {
      enero: '01', febrero: '02', marzo: '03', abril: '04',
      mayo: '05', junio: '06', julio: '07', agosto: '08',
      septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    };
    const month = months[spanishMatch[2].toLowerCase()];
    if (month) {
      return `${spanishMatch[3]}-${month}-${spanishMatch[1].padStart(2, '0')}`;
    }
  }

  // English: "September 15, 2026"
  const englishMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (englishMatch) {
    const months = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };
    const month = months[englishMatch[1].toLowerCase()];
    if (month) {
      return `${englishMatch[3]}-${month}-${englishMatch[2].padStart(2, '0')}`;
    }
  }

  return dateStr.slice(0, 10);
}

/**
 * Categoriza una tarea por su título.
 */
function categorizeTask(title) {
  const lower = title.toLowerCase();
  if (lower.includes('quiz') || lower.includes('cuestionario') || lower.includes('examen')) return 'Examen';
  if (lower.includes('foro') || lower.includes('forum') || lower.includes('debate')) return 'Foro';
  if (lower.includes('laboratorio') || lower.includes('lab') || lower.includes('práctic')) return 'Laboratorio';
  if (lower.includes('proyecto') || lower.includes('project') || lower.includes('avance')) return 'Proyecto';
  if (lower.includes('tarea') || lower.includes('assignment') || lower.includes('entrega')) return 'Tarea';
  return 'Actividad';
}

module.exports = { scrapeUniversityPortal, testConnection };
