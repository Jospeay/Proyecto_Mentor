/**
 * ==============================================================================
 * MENTOR - MOTOR DE SCRAPING UNIVERSITARIO (universityScraper.js)
 * ==============================================================================
 *
 * Servicio del proceso principal de Electron que se conecta a plataformas LMS
 * (Moodle / Canvas) usando Playwright en modo headless para extraer tareas,
 * entregas y eventos del calendario académico del estudiante.
 *
 * MEJORAS v2.0:
 *   - Extrae CÓDIGO DE MATERIA (ej. CEP0004) desde breadcrumbs, URLs, contenedores padre
 *   - Asocia tareas a asignaturas correctamente usando códigos normalizados
 *   - Soporta múltiples estrategias de detección de códigos de curso
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
let path;
let fs;
let os;
try {
  chromium = require('playwright-core').chromium;
} catch {
  try {
    chromium = require('playwright').chromium;
  } catch {
    chromium = null;
  }
}
try { path = require('path'); } catch { path = null; }
try { fs = require('fs'); } catch { fs = null; }
try { os = require('os'); } catch { os = null; }

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
async function scrapeUniversityPortal({ platform, portalUrl, username, password, onProgress, userSubjects }) {
  const progress = onProgress || (() => {});

  if (!isSafePortalUrl(portalUrl)) {
    return { success: false, tasks: [], error: 'La URL del portal debe usar HTTPS.', errorType: 'invalid_url' };
  }

  if (!chromium) {
    return {
      success: false,
      tasks: [],
      error: 'Playwright no esta instalado. Ejecuta: npm install playwright',
      errorType: 'playwright_missing',
    };
  }

  if (!username || !password) {
    return { success: false, tasks: [], error: 'Credenciales no proporcionadas.', errorType: 'no_credentials' };
  }

  let browser = null;

  try {
    console.log('[SCRAPER] Iniciando scraper para plataforma:', platform);
    console.log('[SCRAPER] URL del portal:', portalUrl);
    console.log('[SCRAPER] Usuario:', username);
    progress('launching', 'Iniciando navegador headless...');

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('[SCRAPER] Navegador lanzado correctamente');

    const storageStatePath = getStorageStatePath(username);
    const contextOptions = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    };

    if (fs && path && storageStatePath) {
      try {
        if (fs.existsSync(storageStatePath)) {
          contextOptions.storageState = storageStatePath;
        }
      } catch { /* ignore */ }
    }

    const context = await browser.newContext(contextOptions);
    console.log('[SCRAPER] Contexto del navegador creado');

    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);

    // El scraper solo necesita HTML y JavaScript; abortar recursos visuales
    // reduce consumo de red y memoria en portales Moodle pesados.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    console.log('[SCRAPER] Route blocking configurado, delegando a scraper de', platform);

    let tasks = [];

    if (platform === 'canvas') {
      console.log('[SCRAPER] Ejecutando scraper de Canvas...');
      tasks = await scrapeCanvas(page, portalUrl, username, password, progress);
    } else {
      // Moodle (uam_moodle y moodle genérico)
      console.log('[SCRAPER] Ejecutando scraper de Moodle...');
      tasks = await scrapeMoodle(page, portalUrl, username, password, progress, userSubjects || []);
    }

    console.log('[SCRAPER] Scraping completado. Total tareas encontradas:', tasks.length);
    progress('done', `Extracción completada. ${tasks.length} tarea(s) encontrada(s).`);

    return { success: true, tasks };
  } catch (err) {
    console.error('[SCRAPER] Error:', err.message);

    if (err.message.includes('net::ERR_NAME_NOT_RESOLVED') || err.message.includes('net::ERR_CONNECTION')) {
      return { success: false, tasks: [], error: 'No se puede acceder al portal. Verifica tu conexion a internet y la URL.', errorType: 'connection_failed' };
    }
    if (err.message.includes('LOGIN_FAILED')) {
      return { success: false, tasks: [], error: 'Credenciales incorrectas. Verifica tu usuario y contrasena del portal.', errorType: 'login_failed' };
    }
    if (err.message.includes('Timeout') || err.message.includes('timeout')) {
      return { success: false, tasks: [], error: 'El portal tardo demasiado en responder. Intenta de nuevo mas tarde.', errorType: 'timeout' };
    }
    if (err.message.includes('SESSION_CONFLICT')) {
      return { success: false, tasks: [], error: 'Tu sesión se interrumpió, probablemente por tener el portal abierto en otro navegador al mismo tiempo. Cierra esa pestaña e intenta sincronizar de nuevo.', errorType: 'session_conflict' };
    }

    return { success: false, tasks: [], error: err.message, errorType: 'unknown' };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
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

  if (!isSafePortalUrl(portalUrl)) {
    return { success: false, error: 'La URL del portal debe usar HTTPS.' };
  }

  let browser = null;

  try {
    progress('launching', 'Probando conexión...');

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);

    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

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
      browser = null;
    }
  }
}

// =============================================================================
// MOODLE SCRAPING - MEJORADO CON EXTRACCIÓN DE CÓDIGOS DE MATERIA
// =============================================================================

async function loginMoodle(page, portalUrl, username, password, progress) {
  const baseUrl = portalUrl.replace(/\/+$/, '');
  const loginUrl = `${baseUrl}/login/index.php`;

  console.log('[SCRAPER] Navegando al login de Moodle:', loginUrl);
  progress('navigating', 'Navegando al login de Moodle...');
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('[SCRAPER] Pagina de login cargada, URL actual:', page.url());

  // ── 0. Handle session conflict screen ─────────────────────────────────────
  // Moodle shows "Actualmente ha iniciado sesión como X, necesita salir antes
  // de volver a entrar con un usuario diferente." with a "Cerrar sesión" button
  // when storageState carries a stale/foreign session cookie.
  try {
    const logoutBtn = await page.waitForSelector(
      'button.btn-primary:has-text("Cerrar sesión"), form[action*="logout"] button[type="submit"]',
      { timeout: 3000 }
    );
    if (logoutBtn) {
      console.log('[SCRAPER] Pantalla de conflicto de sesion detectada, haciendo logout...');
      await logoutBtn.click();
      await page.waitForLoadState('domcontentloaded');
      console.log('[SCRAPER] Logout completado, URL:', page.url());
      // After logout, Moodle redirects to login page — wait for it
      await page.waitForSelector('#username, input[name="username"]', { timeout: 10000 });
      console.log('[SCRAPER] Login form aparece despues de logout');
    }
  } catch {
    // No session conflict — normal flow, continue
    console.log('[SCRAPER] Sin conflicto de sesion, continuando con login normal');
  }

  // ── 1. Dismiss cookie/accessibility banners if present (3s timeout, non-fatal) ──
  try {
    const cookieBtn = await page.waitForSelector(
      '#onetrust-accept-btn-handler, button[id*="cookie"], button[id*="accept"], .cookie-consent button, .cc-btn.cc-dismiss, #cookies-consent-accept, [data-cookieconsent="accept"]',
      { timeout: 3000 }
    );
    if (cookieBtn) {
      console.log('[SCRAPER] Banner de cookies encontrado, haciendo click...');
      await cookieBtn.click();
      await page.waitForTimeout(500);
      console.log('[SCRAPER] Banner de cookies cerrado');
    }
  } catch {
    console.log('[SCRAPER] No se encontro banner de cookies (OK)');
  }

  // Dismiss UserWay accessibility widget overlay if it blocks the form
  try {
    await page.evaluate(() => {
      // UserWay injects #userway biome / #uwy overlay elements
      document.querySelectorAll('#userway-biome, .userway-selector, [id*="userway"]').forEach((el) => {
        if (el.style) { el.style.display = 'none'; el.style.pointerEvents = 'none'; }
      });
      // Remove any fixed overlays that might cover the form
      document.querySelectorAll('[style*="position: fixed"][style*="z-index"]').forEach((el) => {
        if (el.id !== 'login' && !el.closest('#login')) {
          el.style.pointerEvents = 'none';
        }
      });
    });
    console.log('[SCRAPER] UserWay/overlays deshabilitados');
  } catch { /* non-fatal */ }

  // ── 2. Find login form inputs ────────────────────────────────────────────
  // Prefer waiting for the <form id="login"> first — it's the most reliable anchor
  // in Moodle. Then find inputs inside it.
  const usernameSelectorResolved = '#username, input[name="username"], input[id="username"]';
  const passwordSelectorResolved = '#password, input[name="password"], input[id="password"]';
  const loginBtnSelectorResolved = '#loginbtn, button[type="submit"], input[type="submit"], button.btn-primary';

  try {
    // Wait for form#login first (most reliable Moodle selector)
    try {
      await page.waitForSelector('form#login, form.loginform', { timeout: 5000 });
      console.log('[SCRAPER] Formulario de login encontrado');
    } catch {
      console.log('[SCRAPER] form#login no encontrado, intentando selector de username directamente...');
    }
    await page.waitForSelector(usernameSelectorResolved, { timeout: 10000 });
    console.log('[SCRAPER] Input de usuario encontrado, llenando credenciales...');
  } catch (selErr) {
    // ── Debug: capture screenshot + HTML to diagnose the real form structure ──
    console.error('[SCRAPER] waitForSelector fallo para campo de usuario:', selErr.message);
    console.log('[SCRAPER] Capturando evidencia de debug...');
    const debugDir = path ? path.join(os.homedir(), '.proyecto_mentor_data', 'debug') : null;
    if (debugDir && fs) {
      try {
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const screenshotPath = path.join(debugDir, 'debug_login_fail.png');
        const htmlPath = path.join(debugDir, 'debug_login_fail.html');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('[SCRAPER] Screenshot guardado en:', screenshotPath);
        const html = await page.content();
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log('[SCRAPER] HTML guardado en:', htmlPath, '(' + html.length + ' chars)');
        // Log a snippet around any <form> or <input> tags for quick diagnosis
        const formMatch = html.match(/<form[\s\S]{0,3000}?<\/form>/i);
        if (formMatch) {
          console.log('[SCRAPER] <form> encontrado en HTML:', formMatch[0].slice(0, 1500));
        } else {
          console.log('[SCRAPER] No se encontro <form> en la pagina. Primeros 2000 chars:');
          console.log(html.slice(0, 2000));
        }
      } catch (dbgErr) {
        console.error('[SCRAPER] Error guardando debug artifacts:', dbgErr.message);
      }
    }
    throw selErr;
  }

  progress('logging_in', 'Ingresando credenciales...');
  await page.fill(usernameSelectorResolved, username);
  await page.fill(passwordSelectorResolved, password);
  console.log('[SCRAPER] Credenciales llenadas, haciendo click en login...');
  await page.click(loginBtnSelectorResolved);

  // Esperar navegación post-login
  await page.waitForLoadState('domcontentloaded');
  console.log('[SCRAPER] Login click enviado, URL post-login:', page.url());

  // Verificar login exitoso: buscar errores de login
  const loginError = await page.$('.loginerrors, .alert-danger, #loginerrormessage, .login-form .error');
  if (loginError) {
    const errorText = await loginError.textContent();
    throw new Error(`LOGIN_FAILED: ${errorText.trim()}`);
  }

  // Verificar que estamos en el dashboard (no redirigidos al login de nuevo)
  const currentUrl = page.url();
  console.log('[SCRAPER] URL despues de login:', currentUrl);
  if (currentUrl.includes('/login/')) {
    throw new Error('LOGIN_FAILED: Redirigido al login. Verifica credenciales.');
  }

  console.log('[SCRAPER] Login exitoso en Moodle');
  progress('authenticated', '¡Autenticado correctamente en Moodle!');
}

/**
 * Extrae códigos de materia de múltiples fuentes en Moodle
 * @param {Page} page - Página de Playwright
 * @param {string} baseUrl - URL base del portal
 * @returns {Promise<Map<string, string>>} Mapa URL -> {subjectName, subjectCode}
 */
async function extractSubjectCodesMoodle(page, baseUrl) {
  const subjectMap = new Map();
  const debugDir = path ? path.join(os.homedir(), '.proyecto_mentor_data', 'debug') : null;

  // Helper: captura debug screenshot + HTML cuando 0 cursos encontrados
  function saveDebug(tag) {
    if (!debugDir || !fs || !path) return;
    try {
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      page.screenshot({ path: path.join(debugDir, `debug_courses_${tag}.png`), fullPage: true }).catch(() => {});
      page.content().then((html) => {
        fs.writeFileSync(path.join(debugDir, `debug_courses_${tag}.html`), html, 'utf8');
        console.log(`[SCRAPER] Debug HTML guardado: debug_courses_${tag}.html (${(html.length / 1024).toFixed(0)} KB)`);
      }).catch(() => {});
    } catch { /* ignore */ }
  }

  // ── Estrategia A: /my/courses.php — la página dedicada de "Mis cursos" ──
  try {
    console.log('[SCRAPER] Navegando a /my/courses.php para mapear materias...');
    await page.goto(`${baseUrl}/my/courses.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[SCRAPER] URL /my/courses.php:', page.url());

    // Si nos redirigió al login, la sesión expiró
    if (page.url().includes('/login/')) {
      console.warn('[SCRAPER] Redirigido al login desde /my/courses.php — sesión expirada');
    } else {
      // Esperar estrictamente a que existan links de curso visibles en el DOM real.
      // No hay fallback a caché: si esto falla, lanzamos error real.
      try {
        await page.waitForSelector('a[href*="course/view.php?id="]', { state: 'visible', timeout: 15000 });
        console.log('[SCRAPER] Links de curso encontrados en DOM, extrayendo...');
      } catch {
        // Si no encontramos esos links, intentar el selector del theme UAM space
        try {
          await page.waitForSelector('a.aalink.coursename, a.coursename', { state: 'visible', timeout: 5000 });
          console.log('[SCRAPER] Selector theme UAM space encontrado');
        } catch {
          console.warn('[SCRAPER] Ningún selector de curso encontrado tras 20s — lanzando error');
          saveDebug('fail_my_courses');
          const diagnostic = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            return {
              title: document.title, url: location.href,
              totalLinks: allLinks.length,
              sampleLinks: allLinks.slice(0, 15).map(a => ({ href: a.href.slice(0, 120), text: a.textContent.trim().slice(0, 60) })),
            };
          });
          console.log('[SCRAPER] Diagnóstico:', JSON.stringify(diagnostic, null, 2));
          throw new Error('No se encontraron links de curso en /my/courses.php');
        }
      }

      // Extraer cursos directamente del DOM — sin caché, sin fallback
      let courseData = await page.$$eval('a[href*="course/view.php?id="]', (els) => {
        const seen = new Set();
        return els.map((el) => {
          const href = el.href || el.getAttribute('href') || '';
          const idMatch = href.match(/[?&]id=(\d+)/);
          const courseId = idMatch ? idMatch[1] : '';
          let name = el.textContent.trim().replace(/\s+/g, ' ');
          name = name.replace(/^Nombre del curso\s*/i, '');
          const codeMatch = name.match(/^([A-Z]{1,5}[-\s]?\d{2,5})\b/);
          const code = codeMatch ? codeMatch[1].replace(/\s+/g, '') : '';
          return { courseId, name, code, href };
        }).filter((c) => c.courseId && c.name.length > 3 && !seen.has(c.courseId) && (seen.add(c.courseId), true));
      });

      // Fallback selector: theme UAM space usa a.aalink.coursename
      if (courseData.length === 0) {
        courseData = await page.$$eval('a.aalink.coursename, a.coursename', (els) => {
          const seen = new Set();
          return els.map((el) => {
            const href = el.href || el.getAttribute('href') || '';
            const idMatch = href.match(/[?&]id=(\d+)/);
            const courseId = idMatch ? idMatch[1] : '';
            let name = el.textContent.trim().replace(/\s+/g, ' ');
            name = name.replace(/^Nombre del curso\s*/i, '');
            const codeMatch = name.match(/^([A-Z]{1,5}[-\s]?\d{2,5})\b/);
            const code = codeMatch ? codeMatch[1].replace(/\s+/g, '') : '';
            return { courseId, name, code, href };
          }).filter((c) => c.courseId && c.name.length > 3 && !seen.has(c.courseId) && (seen.add(c.courseId), true));
        });
      }

      console.log('[SCRAPER] Cursos encontrados en /my/courses.php:', courseData.length);
      courseData.forEach((c, i) => console.log(`  [${i}] id=${c.courseId} code="${c.code}" name="${c.name.slice(0, 80)}`));

      if (courseData.length === 0) {
        saveDebug('fail_my_courses');
        const diagnostic = await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          const courseLinks = allLinks.filter(a => a.href.includes('course'));
          return {
            title: document.title, url: location.href,
            totalLinks: allLinks.length, courseRelatedLinks: courseLinks.length,
            sampleLinks: allLinks.slice(0, 20).map(a => ({ href: a.href.slice(0, 120), text: a.textContent.trim().slice(0, 60) })),
          };
        });
        console.log('[SCRAPER] Diagnóstico /my/courses.php:', JSON.stringify(diagnostic, null, 2));
      }

      for (const c of courseData) {
        if (c.name) {
          subjectMap.set(c.courseId, { subjectName: c.name, subjectCode: c.code || c.courseId });
          subjectMap.set(c.name.toLowerCase(), { subjectName: c.name, subjectCode: c.code || c.courseId });
          if (c.href) subjectMap.set(c.href.toLowerCase(), { subjectName: c.name, subjectCode: c.code || c.courseId });
        }
      }
    }
  } catch (e) {
    console.warn('[SCRAPER] extraccion de /my/courses.php fallo:', e.message);
  }

  // ── Estrategia B: /my/ (dashboard) como fallback ──
  if (subjectMap.size === 0) {
    try {
      console.log('[SCRAPER] Fallback: intentando /my/ (dashboard)...');
      await page.goto(`${baseUrl}/my/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      try {
        await page.waitForSelector('a[href*="course/view.php?id="], a.aalink.coursename, a.coursename', { state: 'visible', timeout: 10000 });
        console.log('[SCRAPER] Selector course link encontrado en /my/, extrayendo...');
      } catch {
        console.warn('[SCRAPER] No se encontraron links a course en /my/ tras 10s');
      }

      let courseData = await page.$$eval('a[href*="course/view.php?id="]', (els) => {
        const seen = new Set();
        return els.map((el) => {
          const href = el.href || el.getAttribute('href') || '';
          const idMatch = href.match(/[?&]id=(\d+)/);
          const courseId = idMatch ? idMatch[1] : '';
          let name = el.textContent.trim().replace(/\s+/g, ' ');
          name = name.replace(/^Nombre del curso\s*/i, '');
          return { courseId, name, href };
        }).filter((c) => c.courseId && c.name.length > 3 && !seen.has(c.courseId) && (seen.add(c.courseId), true));
      });

      if (courseData.length === 0) {
        courseData = await page.$$eval('a.aalink.coursename, a.coursename', (els) => {
          const seen = new Set();
          return els.map((el) => {
            const href = el.href || el.getAttribute('href') || '';
            const idMatch = href.match(/[?&]id=(\d+)/);
            const courseId = idMatch ? idMatch[1] : '';
            let name = el.textContent.trim().replace(/\s+/g, ' ');
            name = name.replace(/^Nombre del curso\s*/i, '');
            return { courseId, name, href };
          }).filter((c) => c.courseId && c.name.length > 3 && !seen.has(c.courseId) && (seen.add(c.courseId), true));
        });
      }

      console.log('[SCRAPER] Cursos encontrados en /my/:', courseData.length);
      if (courseData.length === 0) {
        saveDebug('fail_my');
        const diagnostic = await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          return {
            title: document.title, url: location.href,
            totalLinks: allLinks.length,
            sampleLinks: allLinks.slice(0, 30).map(a => ({ href: a.href.slice(0, 120), text: a.textContent.trim().slice(0, 60) })),
          };
        });
        console.log('[SCRAPER] Diagnóstico /my/:', JSON.stringify(diagnostic, null, 2));
      }

      for (const c of courseData) {
        if (c.name) {
          subjectMap.set(c.courseId, { subjectName: c.name, subjectCode: c.courseId });
          subjectMap.set(c.name.toLowerCase(), { subjectName: c.name, subjectCode: c.courseId });
        }
      }
    } catch (e) {
      console.warn('[SCRAPER] Fallback /my/ fallo:', e.message);
    }
  }

  return subjectMap;
}

/**
 * Extrae código de materia de una página de curso individual
 */
async function extractSubjectCodeFromCoursePage(page, baseUrl) {
  try {
    // Buscar en breadcrumbs
    const breadcrumb = await page.$eval(
      '.breadcrumb, .nav-path, .page-header-breadcrumb, nav[aria-label="breadcrumb"]',
      (el) => el.textContent.trim()
    ).catch(() => '');

    if (breadcrumb) {
      const codeMatch = breadcrumb.match(/\b([A-Z]{2,5}[-\s]?\d{3,5})\b/);
      if (codeMatch) return codeMatch[1].replace(/\s+/g, '');
    }

    // Buscar en el título de la página
    const pageTitle = await page.$eval('h1, .page-header-headings h1, .course-header h1', (el) => el.textContent.trim()).catch(() => '');
    if (pageTitle) {
      const codeMatch = pageTitle.match(/\b([A-Z]{2,5}[-\s]?\d{3,5})\b/);
      if (codeMatch) return codeMatch[1].replace(/\s+/g, '');
    }

    // Buscar en URL actual
    const currentUrl = page.url();
    const urlMatch = currentUrl.match(/[?&](id|course)=(\d+)/);
    if (urlMatch) return urlMatch[2];

  } catch (e) {
    // Silencioso
  }
  return '';
}

async function scrapeMoodle(page, portalUrl, username, password, progress, userSubjects = []) {
  console.log('[SCRAPER] Iniciando scrapeMoodle...');
  await loginMoodle(page, portalUrl, username, password, progress);

  // Persistir cookies/sesion para proxima ejecucion
  await saveStorageState(page.context(), username);
  console.log('[SCRAPER] Storage state guardado');

  const baseUrl = portalUrl.replace(/\/+$/, '');

  // Primero, construir mapa de códigos de materia
  console.log('[SCRAPER] Mapeando codigos de materias...');
  progress('extracting', 'Mapeando códigos de materias...');
  const subjectCodeMap = await extractSubjectCodesMoodle(page, baseUrl);
  console.log('[SCRAPER] Mapa de materias construido:', subjectCodeMap.size, 'entradas');

  // También agregar las materias del usuario al mapa para matching Plan B
  if (Array.isArray(userSubjects)) {
    for (const sub of userSubjects) {
      if (sub.name) {
        subjectCodeMap.set(sub.name.toLowerCase(), {
          subjectName: sub.name,
          subjectCode: sub.code || ''
        });
      }
      if (sub.code) {
        subjectCodeMap.set(sub.code.toLowerCase(), {
          subjectName: sub.name,
          subjectCode: sub.code
        });
      }
    }
  }

  // ─── Estrategia 1: Timeline / Próximos eventos del Dashboard ───
  console.log('[SCRAPER] === Estrategia 1: Timeline ===');
  progress('extracting', 'Buscando tareas en el Timeline de Moodle...');

  let tasks = [];

  try {
    console.log('[SCRAPER] Navegando a /my/ para timeline...');
    await page.goto(`${baseUrl}/my/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[SCRAPER] Pagina /my/ cargada, URL:', page.url());

    // Detectar sesión perdida y re-login automático
    if (page.url().includes('/login/')) {
      console.warn('[SCRAPER] Estrategia 1: sesión expirada, intentando re-login...');
      if (await reloginMoodle(page, portalUrl, username, password, progress)) {
        await page.goto(`${baseUrl}/my/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('[SCRAPER] /my/ recargado después de re-login, URL:', page.url());
        if (page.url().includes('/login/')) {
          throw new Error('SESSION_CONFLICT: Tu sesión se interrumpió, probablemente por tener el portal abierto en otro navegador al mismo tiempo. Cierra esa pestaña e intenta sincronizar de nuevo.');
        }
      } else {
        throw new Error('SESSION_CONFLICT: Tu sesión se interrumpió, probablemente por tener el portal abierto en otro navegador al mismo tiempo. Cierra esa pestaña e intenta sincronizar de nuevo.');
      }
    }

    try {
      await page.waitForSelector(
        '[data-region="event-list-content"], .block-timeline, .timeline-event-list-item, .event-list-item, .course-listitem',
        { timeout: 8000 }
      );
      console.log('[SCRAPER] Selector de timeline encontrado');
    } catch (selErr) {
      console.warn('[SCRAPER] Selector de timeline no encontrado (timeout 8s), intentando extraer de todas formas...');
    }

    // =====================================================================
    // SELECTORES MEJORADOS DEL TIMELINE DE MOODLE
    // Busca en múltiples patrones conocidos de Moodle:
    //   - Bloque "Eventos próximos" / "Timeline"
    //   - .list-group-item con .event-name
    //   - data-region="event-list-item"
    //   - .card con .event-name
    // =====================================================================
    const timelineEvents = await page.evaluate(() => {
      const results = [];
      const isSubmitted = (element) => /enviado\s+para\s+calificar|submitted(?:\s+for\s+grading)?/i.test(element.textContent || '');

      // ─── Buscador 1: Timeline estándar Moodle (data-region) ───
      // Solo captura enlaces de tipo /mod/assign/ (entregables reales)
      document.querySelectorAll(
        '[data-region="event-list-content"] [data-region="event-list-item"], ' +
        '.block-timeline .event-list-item, ' +
        '.timeline-event-list-item'
      ).forEach((el) => {
        try {
        if (isSubmitted(el)) return;
        const titleEl = el.querySelector('.event-name a, .event-name, [data-region="event-name"] a, h3 a, a[href*="/mod/assign/"]');

        // Rechazar si el enlace apunta a algo que no es assignment
        if (titleEl && titleEl.href) {
          const href = titleEl.href;
          if (/\/mod\/(resource|forum|page|folder|url|quiz|choice|data|feedback|glossary|lesson|scorm|survey|wiki|workshop)\//.test(href)) return;
        }

        // Rechazar tareas ya enviadas para calificar
        const elText = el.textContent || '';
        if (/(Enviado para calificar|Submitted for grading|Submitted|Entregado)/i.test(elText)) return;

        const timeEl = el.querySelector('time, .event-date, [data-region="event-date"], .date');
        const courseEl = el.querySelector('.course-fullname, .coursename, .course-name');
        const smallEl = el.querySelector('small.text-muted, small, .text-truncate');

        let subject = '';
        let subjectCode = '';

        // Buscar materia: course-fullname > small.text-muted > aria-label
        if (courseEl) {
          subject = courseEl.textContent.trim();
        } else if (smallEl) {
          subject = smallEl.textContent.trim();
        }

        // Buscar código desde aria-label del link o elemento
        const ariaLink = el.querySelector('[aria-label*=" "]');
        if (ariaLink) {
          const ariaLabel = ariaLink.getAttribute('aria-label') || '';
          const codeMatch = ariaLabel.match(/^([A-Z]{2,5}[-\s]?\d{3,5})\b/);
          if (codeMatch) subjectCode = codeMatch[1].replace(/\s+/g, '');
        }

        // Buscar código en atributos data-* del contenedor padre
        const parentCourse = el.closest('[data-course-id], [data-course-code]');
        if (parentCourse) {
          subjectCode = parentCourse.dataset.courseCode || parentCourse.dataset.courseId || subjectCode;
        }

        // Extraer fecha desde <time> datetime o texto
        let dueDate = null;
        if (timeEl) {
          const dtAttr = timeEl.getAttribute('datetime');
          const dtText = timeEl.textContent.trim();
          dueDate = dtAttr || dtText || null;
        }

        if (titleEl) {
          results.push({
            title: titleEl.textContent.trim(),
            dueDate,
            subject: subject,
            subjectCode: subjectCode,
            url: titleEl.href || '',
          });
        }
        } catch { /* skip individual item */ }
      });

      // ─── Buscador 2: .list-group-item (bloques Moodle) — SOLO assign ───
      if (results.length === 0) {
        document.querySelectorAll('.block .list-group-item, .list-group-item').forEach((el) => {
          try {
          if (isSubmitted(el)) return;
          const linkEl = el.querySelector('a[href*="/mod/assign/"]');
          if (!linkEl) return;

          // Rechazar tareas ya enviadas para calificar
          const elText = el.textContent || '';
          if (/(Enviado para calificar|Submitted for grading|Submitted|Entregado)/i.test(elText)) return;

          const smallEl = el.querySelector('small, .text-muted, .text-truncate');
          const timeEl = el.querySelector('time, .date, .small');

          let subject = '';
          // Buscar nombre de curso en <small> o en aria-label
          const allSmalls = el.querySelectorAll('small');
          for (const s of allSmalls) {
            const text = s.textContent.trim();
            if (text && text.length > 3 && !text.match(/^\d/) && !text.match(/^(hace|Hace|Hoy|Ayer)/)) {
              subject = text;
              break;
            }
          }

          // Buscar código en aria-label
          let subjectCode = '';
          const allLinks = el.querySelectorAll('a');
          for (const a of allLinks) {
            const label = a.getAttribute('aria-label') || '';
            const codeMatch = label.match(/^([A-Z]{2,5}[-\s]?\d{3,5})\b/);
            if (codeMatch) {
              subjectCode = codeMatch[1].replace(/\s+/g, '');
              break;
            }
          }

          let dueDate = null;
          if (timeEl) {
            const dtAttr = timeEl.getAttribute('datetime');
            const dtText = timeEl.textContent.trim();
            dueDate = dtAttr || dtText || null;
          }

          results.push({
            title: linkEl.textContent.trim(),
            dueDate,
            subject: subject,
            subjectCode: subjectCode,
            url: linkEl.href || '',
          });
          } catch { /* skip individual item */ }
        });
      }

      // ─── Buscador 3: Tarjetas de evento genéricas (.card) — SOLO assign ───
      if (results.length === 0) {
        document.querySelectorAll('.card.event, .card[data-region*="event"], .event-card').forEach((el) => {
          try {
          if (isSubmitted(el)) return;
          const titleEl = el.querySelector('h3 a[href*="/mod/assign/"], h4 a[href*="/mod/assign/"], .event-name a[href*="/mod/assign/"]');
          const dateEl = el.querySelector('.date, time, small');
          const courseEl = el.querySelector('.course-name, .coursename, .text-truncate');

          if (titleEl) {
            // Rechazar tareas ya enviadas para calificar
            const elText = el.textContent || '';
            if (/(Enviado para calificar|Submitted for grading|Submitted|Entregado)/i.test(elText)) return;

            results.push({
              title: titleEl.textContent.trim(),
              dueDate: dateEl ? (dateEl.getAttribute('datetime') || dateEl.textContent.trim() || null) : null,
              subject: courseEl ? courseEl.textContent.trim() : '',
              subjectCode: '',
              url: titleEl.href || '',
            });
          }
          } catch { /* skip individual item */ }
        });
      }

      return results;
    }).catch(() => []);

    if (timelineEvents.length > 0) {
      console.log('[SCRAPER] Timeline: encontradas', timelineEvents.length, 'tareas');
      tasks.push(...timelineEvents);
    } else {
      console.log('[SCRAPER] Timeline: 0 tareas encontradas');
    }
  } catch (e) {
    if (e.message.includes('SESSION_CONFLICT')) throw e;
    console.error('[SCRAPER] Timeline extraction fallo:', e.message);
  }

  // ─── Estrategia 2: Calendario de Moodle (upcoming events) ───
  console.log('[SCRAPER] === Estrategia 2: Calendario ===');
  progress('extracting', 'Buscando en el Calendario de Moodle...');
  try {
      console.log('[SCRAPER] Navegando a calendario upcoming...');
      await page.goto(`${baseUrl}/calendar/view.php?view=upcoming`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('[SCRAPER] Pagina de calendario cargada, URL:', page.url());

      // Detectar sesión perdida y re-login automático
      if (page.url().includes('/login/')) {
        console.warn('[SCRAPER] Estrategia 2: sesión expirada, intentando re-login...');
        if (await reloginMoodle(page, portalUrl, username, password, progress)) {
          await page.goto(`${baseUrl}/calendar/view.php?view=upcoming`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          console.log('[SCRAPER] Calendario recargado después de re-login, URL:', page.url());
          if (page.url().includes('/login/')) {
            throw new Error('SESSION_CONFLICT: Tu sesión se interrumpió, probablemente por tener el portal abierto en otro navegador al mismo tiempo. Cierra esa pestaña e intenta sincronizar de nuevo.');
          }
        } else {
          throw new Error('SESSION_CONFLICT: Tu sesión se interrumpió, probablemente por tener el portal abierto en otro navegador al mismo tiempo. Cierra esa pestaña e intenta sincronizar de nuevo.');
        }
      }

        const calendarEvents = await page.evaluate(() => {
          const results = [];
          const isSubmitted = (element) => /enviado\s+para\s+calificar|submitted(?:\s+for\s+grading)?/i.test(element.textContent || '');

          // Buscar eventos del calendario — SOLO /mod/assign/
          document.querySelectorAll(
            '.event, [data-event-id], .calendar-event-panel, ' +
            '.eventlist .event, .day-content .event, ' +
            'li[data-event-id], .popover-body .event'
          ).forEach((el) => {
            try {
            if (isSubmitted(el)) return;
            const titleEl = el.querySelector('.name a[href*="/mod/assign/"], .referer a[href*="/mod/assign/"], h3 a[href*="/mod/assign/"], .event-name a[href*="/mod/assign/"]');
            if (!titleEl) return;

            // Rechazar tareas ya enviadas para calificar
            const elText = el.textContent || '';
            if (/(Enviado para calificar|Submitted for grading|Submitted|Entregado)/i.test(elText)) return;

            const dateEl = el.querySelector('.date, time, .col-11, .event-date');
            const courseEl = el.querySelector('.course, .coursename, .text-muted, .text-truncate');

          // Buscar en atributo aria-label para nombre del curso
          let subject = '';
          let subjectCode = '';

          if (courseEl) {
            subject = courseEl.textContent.trim();
          }

          // Buscar en aria-label del elemento o sus hijos
          const ariaEl = el.querySelector('[aria-label]');
          if (ariaEl) {
            const ariaLabel = ariaEl.getAttribute('aria-label');
            // El aria-label suele contener: "B1 COMMUNICATIVE ENGLISH - Título tarea"
            const codeMatch = ariaLabel.match(/^([A-Z]{2,5}[-\s]?\d{3,5})\b/);
            if (codeMatch) subjectCode = codeMatch[1].replace(/\s+/g, '');
            if (!subject && ariaLabel) {
              // Extraer materia del aria-label antes del guion
              const dashParts = ariaLabel.split(/\s*[-–]\s*/);
              if (dashParts.length > 1) subject = dashParts[0].trim();
            }
          }

          // data attributes
          subjectCode = el.dataset.courseCode || el.dataset.courseId || subjectCode;

          // Buscar innerText completo como última opción para extraer materia
          if (!subject) {
            const fullText = el.textContent;
            // Patrón: "CEP0004 - Nombre Materia" o "B1 COMMUNICATIVE ENGLISH"
            const codeInText = fullText.match(/\b([A-Z]{2,5}[-\s]?\d{3,5})\s*[-–]\s*(.+?)(?:\n|$)/);
            if (codeInText) {
              subjectCode = codeInText[1].replace(/\s+/g, '');
              subject = codeInText[2].trim().slice(0, 80);
            }
          }

          let dueDate = null;
          if (dateEl) {
            const dtAttr = dateEl.getAttribute('datetime');
            const dtText = dateEl.textContent.trim();
            dueDate = dtAttr || dtText || null;
          }

          results.push({
            title: titleEl.textContent.trim(),
            dueDate,
            subject: subject,
            subjectCode: subjectCode,
            url: titleEl.href || '',
          });
            } catch { /* skip individual item */ }
        });

        return results;
      }).catch(() => []);

      if (calendarEvents.length > 0) {
        console.log('[SCRAPER] Calendario: encontradas', calendarEvents.length, 'tareas');
      } else {
        console.log('[SCRAPER] Calendario: 0 tareas encontradas');
      }
      tasks.push(...calendarEvents);
    } catch (e) {
      if (e.message.includes('SESSION_CONFLICT')) throw e;
      console.error('[SCRAPER] Calendar extraction fallo:', e.message);
    }

  // La exploración curso a curso es mucho más costosa. Solo se usa como
  // respaldo cuando Timeline y Calendario no devolvieron entregas.
  if (tasks.length === 0) {
    console.log('[SCRAPER] === Estrategia 3: Curso por curso (fallback) ===');
    progress('extracting', 'Buscando actividades de entrega (assign) con códigos...');
    try {
    // =====================================================================
    // SELECTORES DE CURSOS Y ACTIVIDADES DE MOODLE — INSPECCIONA CON F12
    // Estos selectores buscan enlaces a cursos y actividades (tareas, quizzes, foros).
    // Si tu portal usa selectores diferentes, ajusta aquí.
    // =====================================================================
    const courseLinks = await page.$$eval(
      '.course-listitem a[href*="/course/view.php"], a.coursename, .courses .coursebox a',
      (links) => links.map((a) => a.href).filter(Boolean)
    ).catch(() => []);

    for (const courseUrl of courseLinks.slice(0, 10)) { // Máximo 10 cursos
      try {
        await page.goto(courseUrl, { waitUntil: 'domcontentloaded' });
        
        // Extraer nombre y código de la materia de la página del curso
        const courseName = await page.$eval('h1, .page-header-headings h1', (el) => el.textContent.trim()).catch(() => 'Curso');
        const subjectCode = await extractSubjectCodeFromCoursePage(page, baseUrl);

        const assignLinks = await page.$$eval(
          'a[href*="/mod/assign/view.php"]',
          (links) => links.map((a) => {
            const parent = a.closest('li, tr, .activity, .assign, div');
            // Rechazar tareas ya enviadas para calificar
            if (parent) {
              const elText = parent.textContent || '';
              if (/(Enviado para calificar|Submitted for grading|Submitted|Entregado)/i.test(elText)) return null;
            }
            let dueDate = null;
            if (parent) {
              const dateEl = parent.querySelector('time, .date, .duedate, .text-muted small');
              if (dateEl) {
                dueDate = dateEl.getAttribute('datetime') || dateEl.textContent.trim();
              }
              // Also check for text containing date patterns
              if (!dueDate) {
                const parentText = parent.textContent;
                const dateMatch = parentText.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i);
                if (dateMatch) dueDate = dateMatch[1];
              }
            }
            return {
              title: a.textContent.trim(),
              url: a.href,
              dueDate,
            };
          })).filter((l) => l?.title)
          .catch(() => []);

        for (const assign of assignLinks) {
          tasks.push({
            title: assign.title,
            dueDate: assign.dueDate || '',
            subject: courseName,
            subjectCode: subjectCode,
            url: assign.url,
          });
        }
      } catch {
        continue;
      }
    }
    } catch (e) {
      console.warn('[SCRAPER] Assignment extraction failed:', e.message);
    }
  }

  // ─── Estrategia 4: Curso por curso con lectura directa de assign ───
  // Esta es la estrategia más confiable: entra a cada curso conocido,
  // busca links a /mod/assign/view.php, entra a cada uno y lee el estado
  // de la entrega directamente del HTML de la página de la tarea.
  console.log('[SCRAPER] === Estrategia 4: Assign directo por curso ===');
  progress('extracting', 'Revisando tareas directamente en cada curso...');

  // Recopilar IDs de curso del mapa de materias
  const courseIds = new Set();
  for (const [key, val] of subjectCodeMap.entries()) {
    if (/^\d+$/.test(key)) courseIds.add(key);
  }

  for (const courseId of courseIds) {
    const courseUrl = `${baseUrl}/course/view.php?id=${courseId}`;
    try {
      console.log(`[SCRAPER] Curso id=${courseId}, entrando...`);
      await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const currentUrl = page.url();
      console.log(`[SCRAPER] Curso ${courseId} URL actual: ${currentUrl}`);

      // Si redirigió al login, intentar re-login una vez
      if (currentUrl.includes('/login/')) {
        console.warn(`[SCRAPER] Curso ${courseId}: sesión expirada, intentando re-login...`);
        if (await reloginMoodle(page, portalUrl, username, password, progress)) {
          await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const retryUrl = page.url();
          console.log(`[SCRAPER] Curso ${courseId}: re-login OK, URL reintentada: ${retryUrl}`);
          if (retryUrl.includes('/login/')) {
            console.error(`[SCRAPER] Curso ${courseId}: re-login no resolvió, sesión fatal`);
            throw new Error('SESSION_CONFLICT');
          }
          // Continuar con este curso después del re-login exitoso
        } else {
          console.error(`[SCRAPER] Curso ${courseId}: re-login falló, abortando`);
          throw new Error('SESSION_CONFLICT');
        }
      }

      // Esperar al contenedor principal del curso con selectores amplios
      await page.waitForSelector(
        '#region-main, .course-content, .topics, .weeks, #page-content',
        { timeout: 8000, state: 'visible' }
      ).catch(() => {
        console.warn(`[SCRAPER] Curso ${courseId}: contenedor principal no apareció en 8s`);
      });

      // ── Desplegar secciones colapsadas (tema UAM space / acordeones Moodle) ──
      await page.evaluate(() => {
        document.querySelectorAll(
          '[aria-expanded="false"], .collapsed, .toggle-section, .section-toggle, summary'
        ).forEach((el) => {
          try { if (typeof el.click === 'function') el.click(); } catch { /* ignore */ }
        });
      }).catch(() => {});
      // Breve pausa para que el DOM se re-renderice tras expandir secciones.
      // Espera robusta: el índice lateral del curso (courseindex) también
      // contiene los ítems de actividad aunque el contenido central cargue
      // tarde (Moodle lo re-renderiza vía AJAX tras navegar al curso).
      await page.waitForSelector(
        '.activityinstance, .modtype_assign, .modtype_quiz, ' +
        'a[href*="/mod/assign/view.php"], #courseindex .courseindex-item, .courseindex-item',
        { timeout: 8000, state: 'attached' }
      ).catch(() => {
        console.warn(`[SCRAPER] Curso ${courseId}: actividades/courseindex no aparecieron en 8s`);
      });

      // Obtener nombre del curso
      const courseName = await page.$eval(
        'h1, .page-header-headings h1, #page-header h1',
        (el) => el.textContent.trim()
      ).catch(() => '');

      // ── Extracción precisa: links de actividad dentro de contenedores Moodle ──
      // Moodle renderiza cada actividad dentro de un contenedor .activityinstance
      // o .modtype_<modname>. El link al interior tiene el nombre real de la actividad.
      const extractAssigns = () => page.evaluate(() => {
        const seen = new Set();
        const results = [];

        // Estrategia 1: buscar dentro de contenedores de actividad (más preciso)
        document.querySelectorAll(
          '.activityinstance a, .modtype_assign a, .modtype_quiz a, .modtype_forum a, ' +
          '[data-modtype] a, .activity-title a, .activity-name a, .courseindex-item a'
        ).forEach((a) => {
          const href = (a.href || '').toLowerCase();
          if (!href.includes('/mod/assign/') && !href.includes('/mod/quiz/') && !href.includes('/mod/forum/')) return;
          const idMatch = (a.href || '').match(/[?&]id=(\d+)/);
          if (!idMatch) return;
          const assignId = idMatch[1];
          if (seen.has(assignId)) return;
          seen.add(assignId);
          // El nombre real está en el link o en el span hermano
          const container = a.closest('.activityinstance, .modtype_assign, .modtype_quiz, .modtype_forum, [data-modtype], .courseindex-item');
          let title = '';
          if (container) {
            const nameEl = container.querySelector('.activity-name, .activity-title, span_instname');
            title = nameEl ? nameEl.textContent.trim() : '';
          }
          if (!title) title = a.textContent.trim().replace(/\s+/g, ' ');
          if (!title || title.length < 2) return;
          results.push({ assignId, title: title.slice(0, 200), href: a.href });
        });

        // Estrategia 2: fallback — buscar links directos a view.php con ?id= que tengan texto
        if (results.length === 0) {
          document.querySelectorAll('a[href*="/mod/assign/view.php"], a[href*="/mod/quiz/view.php"], a[href*="/mod/forum/view.php"]').forEach((a) => {
            const idMatch = (a.href || '').match(/[?&]id=(\d+)/);
            if (!idMatch) return;
            const assignId = idMatch[1];
            if (seen.has(assignId)) return;
            seen.add(assignId);
            const title = a.textContent.trim().replace(/\s+/g, ' ');
            if (!title || title.length < 3) return;
            results.push({ assignId, title: title.slice(0, 200), href: a.href });
          });
        }

        return results;
      });

      // ── Cambiar/recargar página si salió en 0 (bug de timing de carga AJAX) ──
      let assignLinks = await extractAssigns();

      if (assignLinks.length === 0) {
        console.warn(`[SCRAPER] Curso ${courseId}: 0 assigns en primer intento, recargando para descartar race de carga...`);
        await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000, cache: 'reload' }).catch(() => {});
        await page.waitForSelector(
          '#region-main, .course-content, #courseindex .courseindex-item, .courseindex-item',
          { timeout: 10000, state: 'attached' }
        ).catch(() => {});
        await page.evaluate(() => {
          document.querySelectorAll(
            '[aria-expanded="false"], .collapsed, .toggle-section, .section-toggle, summary'
          ).forEach((el) => {
            try { if (typeof el.click === 'function') el.click(); } catch { /* ignore */ }
          });
        }).catch(() => {});
        assignLinks = await extractAssigns();
      }

      if (assignLinks.length === 0) {
        console.log(`[SCRAPER] Curso ${courseId} ("${courseName.slice(0, 40)}"): 0 assigns encontrados (tras retry)`);
        const sampleLinks = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(a => ({
            href: (a.href || '').slice(0, 120),
            text: (a.innerText || '').trim().slice(0, 60),
          }))
        );
        console.log(`[SCRAPER] Curso ${courseId} links en DOM:`, JSON.stringify(sampleLinks));

        // ── Debug específico para CEP0004 (id=7134): capturar qué hay realmente ──
        if (courseId === '7134') {
          try {
            const debugDir = path ? path.join(os.homedir(), '.proyecto_mentor_data', 'debug') : null;
            if (debugDir && fs) {
              if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
              await page.screenshot({ path: path.join(debugDir, 'debug_cep0004_7134.png'), fullPage: true });
              console.log('[SCRAPER DEBUG] CEP0004 (7134): screenshot en debug_cep0004_7134.png');
              const html = await page.content();
              fs.writeFileSync(path.join(debugDir, 'debug_cep0004_7134.html'), html, 'utf8');
              console.log(`[SCRAPER DEBUG] CEP0004 (7134): HTML guardado (${(html.length / 1024).toFixed(0)} KB)`);
            }
            // Inventario de TODOS los links mod/X/view.php presentes (para saber el tipo real)
            const modInventory = await page.evaluate(() => {
              const types = {};
              const samples = [];
              document.querySelectorAll('a[href*="/mod/"]').forEach((a) => {
                const m = (a.href || '').match(/\/mod\/([a-z]+)\/view\.php/i);
                if (m) {
                  types[m[1]] = (types[m[1]] || 0) + 1;
                  if (samples.length < 8) samples.push({ type: m[1], href: (a.href || '').slice(0, 100), text: (a.innerText || '').trim().slice(0, 50) });
                }
              });
              return { types, samples };
            });
            console.log(`[SCRAPER DEBUG] CEP0004 (7134) tipos de módulos presentes:`, JSON.stringify(modInventory));
          } catch (debugErr) {
            console.warn(`[SCRAPER DEBUG] Error capturando CEP0004: ${debugErr.message}`);
          }
        } else {
          // Para cualquier otro curso en 0: inventario ligero de tipos de módulo
          try {
            const modInventory = await page.evaluate(() => {
              const types = {};
              document.querySelectorAll('a[href*="/mod/"]').forEach((a) => {
                const m = (a.href || '').match(/\/mod\/([a-z]+)\/view\.php/i);
                if (m) types[m[1]] = (types[m[1]] || 0) + 1;
              });
              return types;
            });
            console.log(`[SCRAPER] Curso ${courseId} tipos de módulo en DOM:`, JSON.stringify(modInventory));
          } catch { /* ignore */ }
        }
        continue;
      }
      console.log(`[SCRAPER] Curso ${courseId} ("${courseName.slice(0, 40)}"): ${assignLinks.length} assigns encontrados`);

      // Debug: si se activa el flag de entorno SCRAPER_DEBUG_ASSIGNS, loguear
      // el href + HTML del contenedor de cada assign para diagnosticar cambios
      // en el HTML de Moodle sin necesidad de modificar este archivo.
      if (process.env.SCRAPER_DEBUG_ASSIGNS === '1') {
        for (const a of assignLinks) {
          const containerHtml = await page.evaluate((href) => {
            const link = document.querySelector(`a[href="${href}"]`);
            if (!link) return '(link not found)';
            const container = link.closest('.activityinstance, .modtype_assign, .activity, li, .activitydiv, [data-modtype]');
            return container ? container.outerHTML.slice(0, 500) : link.outerHTML.slice(0, 500);
          }, a.href).catch(() => '(eval failed)');
          console.log(`[SCRAPER DEBUG] Curso ${courseId} assign: href="${a.href}" title="${a.title}" container=${containerHtml}`);
        }
      }

      // Entrar a cada assign y leer estado de entrega
      for (const assign of assignLinks) {
        try {
          await page.goto(assign.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
          if (page.url().includes('/login/')) {
            console.warn(`  [Assign] "${assign.title.slice(0, 30)}": redirigido a login, abortando`);
            break;
          }

          const bodyText = await page.textContent('body');

          // ── Detectar estado de entrega ──
          let submissionStatus = 'unknown';
          let requiereGrupo = false;

          if (/Todavía no se han realizado envíos/i.test(bodyText) ||
              /No se ha enviado nada en esta tarea/i.test(bodyText) ||
              /No attempt/i.test(bodyText) ||
              /You have not submitted/i.test(bodyText) ||
              /no puede realizar entregas/i.test(bodyText) ||
              /Estado de la entrega.*Sin envíos/i.test(bodyText) ||
              /Sin envíos realizados/i.test(bodyText)) {
            submissionStatus = 'pendiente';
          } else if (/Enviado para calificar|Submitted for grading|Enviado|Submitted/i.test(bodyText)) {
            submissionStatus = 'enviado';
          } else if (/Calificado|Graded/i.test(bodyText)) {
            submissionStatus = 'calificado';
          }

          if (/requiere entrega por grupos/i.test(bodyText) ||
              /This assignment requires groups/i.test(bodyText)) {
            requiereGrupo = true;
          }

          // ── Extraer fechas de apertura y cierre ──
          let fechaApertura = '';
          let fechaCierre = '';

          // Intentar extraer del bloque DOM rui-activity-dates primero (más confiable)
          try {
            const activityDatesText = await page.$eval(
              '.rui-activity-dates, [data-region="activity-dates"]',
              (el) => el.textContent.trim().replace(/\s+/g, ' ')
            ).catch(() => '');
            if (activityDatesText) {
              const apMatch = activityDatesText.match(/Apertura[:\s]*(.+)/i);
              if (apMatch) fechaApertura = apMatch[1].split(/Cierre/i)[0].trim().slice(0, 60);
              const ciMatch = activityDatesText.match(/Cierre[:\s]*(.+)/i);
              if (ciMatch) fechaCierre = ciMatch[1].trim().slice(0, 60);
            }
          } catch { /* ignore */ }

          // Fallback: regex sobre body text
          if (!fechaCierre) {
            const cierreMatch = bodyText.match(/Cierre[:\s]*([\wáéíóú]+,\s*\d{1,2}\s+de\s+\w+\s+de\s+\d{4}[^\.]{0,30})/i)
              || bodyText.match(/Cierre[:\s]*(\d{1,2}\s+\w+\s+de\s+\w+\s+de\s+\d{4}[^\.]{0,30})/i)
              || bodyText.match(/Cierre[:\s]*(\d{1,2}\s+\w+\s+\d{4}[^\.]{0,30})/i);
            if (cierreMatch) fechaCierre = cierreMatch[1].trim().slice(0, 60);
          }
          if (!fechaApertura) {
            const aperturaMatch = bodyText.match(/Apertura[:\s]*([\wáéíóú]+,\s*\d{1,2}\s+de\s+\w+\s+de\s+\d{4}[^\.]{0,30})/i)
              || bodyText.match(/Apertura[:\s]*(\d{1,2}\s+\w+\s+de\s+\w+\s+de\s+\d{4}[^\.]{0,30})/i)
              || bodyText.match(/Apertura[:\s]*(\d{1,2}\s+\w+\s+\d{4}[^\.]{0,30})/i);
            if (aperturaMatch) fechaApertura = aperturaMatch[1].trim().slice(0, 60);
          }

          // ── Extraer código de materia del breadcrumb o URL ──
          let subjectCode = subjectCodeMap.get(courseId)?.subjectCode || courseId;
          try {
            const breadcrumb = await page.$eval(
              '.breadcrumb a, nav[aria-label="breadcrumb"] a',
              (el) => el.textContent.trim()
            ).catch(() => '');
            const codeMatch = breadcrumb.match(/\b([A-Z]{1,5}[-\s]?\d{2,5})\b/);
            if (codeMatch) subjectCode = codeMatch[1].replace(/\s+/g, '');
          } catch { /* ignore */ }

          console.log(`  [Assign] "${assign.title.slice(0, 50)}" → status=${submissionStatus} grupo=${requiereGrupo} cierre="${fechaCierre}"`);

          // Solo agregar tareas pendientes (no enviadas ni calificadas)
          if (submissionStatus === 'pendiente') {
            tasks.push({
              title: assign.title,
              dueDate: fechaCierre || '',
              subject: courseName || subjectCodeMap.get(courseId)?.subjectName || '',
              subjectCode,
              url: assign.href,
              requiereGrupo,
            });
          }
        } catch (assignErr) {
          console.warn(`  [Assign] Error en "${assign.title.slice(0, 30)}":`, assignErr.message?.slice(0, 80));
        }
      }
    } catch (courseErr) {
      console.warn(`[SCRAPER] Curso ${courseId} fallo:`, courseErr.message?.slice(0, 80));
    }
  }

  // Normalizar y deduplicar tareas CON CÓDIGOS DE MATERIA
  const normalized = normalizeTasks(tasks, 'moodle', portalUrl, subjectCodeMap);
  console.log('[SCRAPER] scrapeMoodle completado. Tareas raw:', tasks.length, '| Normalizadas:', normalized.length);
  return normalized;
}

// =============================================================================
// CANVAS SCRAPING - MEJORADO CON CÓDIGOS DE MATERIA
// =============================================================================

async function loginCanvas(page, portalUrl, username, password, progress) {
  const baseUrl = portalUrl.replace(/\/+$/, '');
  const loginUrl = `${baseUrl}/login/canvas`;

  progress('navigating', 'Navegando al login de Canvas...');
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  // =====================================================================
  // SELECTOR: INPUT DE USUARIO CANVAS — CAMBIA POR EL ID REAL DE TU CANVAS
  // Abre DevTools (F12) en la página de login de Canvas e inspecciona el input.
  // =====================================================================
  const usernameSelector = '#pseudonym_session_unique_id';

  // =====================================================================
  // SELECTOR: INPUT DE CONTRASEÑA CANVAS — CAMBIA POR EL ID REAL DE TU CANVAS
  // =====================================================================
  const passwordSelector = '#pseudonym_session_password';

  // =====================================================================
  // SELECTOR: BOTÓN DE LOGIN CANVAS — CAMBIA POR LA CLASE REAL DEL BOTÓN
  // =====================================================================
  const loginBtnSelector = '.Button--login';

  const usernameSelectorResolved = `${usernameSelector}, input[name="pseudonym_session[unique_id]"]`;
  const passwordSelectorResolved = `${passwordSelector}, input[name="pseudonym_session[password]"]`;
  const loginBtnSelectorResolved = `${loginBtnSelector}, button[type="submit"], input[type="submit"]`;

  await page.waitForSelector(usernameSelectorResolved, { timeout: 10000 });

  progress('logging_in', 'Ingresando credenciales...');
  await page.fill(usernameSelectorResolved, username);
  await page.fill(passwordSelectorResolved, password);
  await page.click(loginBtnSelectorResolved);
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

/**
 * Extrae códigos de curso de Canvas (course_code suele estar en context_name o en API)
 */
async function extractSubjectCodesCanvas(page, baseUrl) {
  const subjectMap = new Map();

  try {
    // Intentar obtener de la API de cursos
    const courses = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/v1/courses?per_page=100`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error('API not available');
      return res.json();
    }, baseUrl);

    if (Array.isArray(courses)) {
      courses.forEach((course) => {
        if (course.name) {
          const code = course.course_code || course.id?.toString() || '';
          subjectMap.set(course.name.toLowerCase(), {
            subjectName: course.name,
            subjectCode: code
          });
          if (course.id) {
            subjectMap.set(course.id.toString(), {
              subjectName: course.name,
              subjectCode: code
            });
          }
        }
      });
    }
  } catch (e) {
    console.warn('[SCRAPER] Canvas course API failed:', e.message);
  }

  return subjectMap;
}

async function scrapeCanvas(page, portalUrl, username, password, progress) {
  console.log('[SCRAPER] Iniciando scrapeCanvas...');
  await loginCanvas(page, portalUrl, username, password, progress);

  // Persistir cookies/sesion para proxima ejecucion
  await saveStorageState(page.context(), username);
  console.log('[SCRAPER] Storage state guardado (Canvas)');

  const baseUrl = portalUrl.replace(/\/+$/, '');
  let tasks = [];

  // Construir mapa de códigos de Canvas
  progress('extracting', 'Mapeando códigos de materias en Canvas...');
  const subjectCodeMap = await extractSubjectCodesCanvas(page, baseUrl);

  // ─── Estrategia 1: API REST con session cookie (más confiable) ───
  // =====================================================================
  // LA URL DE LA API DE CANVAS ES FIJA: /api/v1/users/self/todo
  // No necesitas cambiar esta URL. Se usa la cookie de sesión del login
  // para autenticar la petición automáticamente.
  // =====================================================================
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
        subjectCode: item.course_code || item.context_code || '',
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
      await page.waitForTimeout(1000);

      // =====================================================================
      // SELECTORES DEL PLANNER DE CANVAS — INSPECCIONA CON F12
      // Si la extracción por UI falla, abre DevTools en Canvas y ajusta
      // estos selectores al HTML real del planner/dashboard.
      // =====================================================================
      const plannerItems = await page.$$eval(
        '.planner-item, [data-testid="planner-item"], .todo-list-item',
        (elements) => elements.map((el) => {
          const titleEl = el.querySelector('.PlannerItem-styles__title, a[href*="/assignments/"]');
          const dateEl = el.querySelector('.PlannerItem-styles__due, time');
          const courseEl = el.querySelector('.PlannerItem-styles__course, .course');
          // Buscar código en data attributes
          let subjectCode = el.dataset.courseCode || el.dataset.courseId || '';
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            dueDate: dateEl ? (dateEl.getAttribute('datetime') || dateEl.textContent.trim()) : '',
            subject: courseEl ? courseEl.textContent.trim() : '',
            subjectCode: subjectCode,
          };
        }).filter((t) => t.title)
      ).catch(() => []);

      tasks = plannerItems;
    } catch (e) {
      console.warn('[SCRAPER] Canvas UI scraping failed:', e.message);
    }
  }

  return normalizeTasks(tasks, 'canvas', portalUrl, subjectCodeMap);
}

// =============================================================================
// UTILIDADES MEJORADAS - CON SOPORTE PARA CÓDIGOS DE MATERIA
// =============================================================================

/**
 * Normaliza, deduplicar y formatea las tareas extraídas con códigos de materia.
 * Incluye algoritmo de matching difuso para asociar tareas a asignaturas locales.
 */
function normalizeTasks(rawTasks, platform, portalUrl, subjectCodeMap = new Map()) {
  const seen = new Set();

  return rawTasks
    .filter((t) => {
      if (!t.title || t.title.length < 3) return false;
      
      // Filtrar eventos de calendario que son solo horarios de clase (ej: "Mañana, 11:00 » 12:50")
      if (/\d{1,2}:\d{2}\s*»\s*\d{1,2}:\d{2}/.test(t.title)) return false;

      // Filtrar tareas cuyo título es una fecha (ej: "jueves, 20 agosto 2026")
      if (/^(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)[\s,]+\d{1,2}\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/i.test(t.title)) return false;
      if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s,]+\d{1,2}/i.test(t.title)) return false;
      // Filtrar títulos que sean solo una fecha ISO o numérica
      if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(t.title)) return false;
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(t.title)) return false;

      // Si no se pudo parsear la fecha, igual aceptar la tarea (mejor mostrar sin fecha que descartarla)
      const parsedDate = t.dueDate ? parseDateString(t.dueDate) : '';

      // Una actividad puede aparecer a la vez en Timeline, calendario y curso.
      // Usar URL completa (sin fragment #) como clave para dedup — NO stripear ?id=XXXX
      // porque las URLs de assign Moodle todas comparten la base /mod/assign/view.php
      const canonicalUrl = String(t.url || '').replace(/[#].*$/, '').toLowerCase();
      const key = canonicalUrl || `${t.title}|${t.subject}|${parsedDate}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => {
      try {
      // Intentar resolver código de materia desde el mapa
      let subjectCode = t.subjectCode || '';
      let subjectName = t.subject || 'Sin materia identificada';

      if (!subjectCode && t.subject) {
        const mapEntry = subjectCodeMap.get(t.subject.toLowerCase());
        if (mapEntry) {
          subjectCode = mapEntry.subjectCode || '';
          subjectName = mapEntry.subjectName || subjectName;
        }
      }

      // Si no hay código pero el nombre parece tenerlo (ej: "CEP0004 - Cálculo")
      if (!subjectCode && subjectName) {
        const codeMatch = subjectName.match(/^([A-Z]{2,5}[-\s]?\d{3,5})\s*[-–]\s*/);
        if (codeMatch) {
          subjectCode = codeMatch[1].replace(/\s+/g, '');
          subjectName = subjectName.replace(/^[A-Z]{2,5}[-\s]?\d{3,5}\s*[-–]\s*/, '');
        }
      }

      // Algoritmo de matching difuso: buscar en el mapa por similitud
      if (!subjectCode && subjectName === 'Sin materia identificada') {
        // Plan B: Buscar en el título de la tarea códigos de materia conocidos
        const titleLower = t.title.toLowerCase();
        for (const [mapKey, mapValue] of subjectCodeMap.entries()) {
          // Match directo por código en el título (ej: "CEP0004" en "Tarea CEP0004")
          if (mapValue.subjectCode && titleLower.includes(mapValue.subjectCode.toLowerCase())) {
            subjectCode = mapValue.subjectCode;
            subjectName = mapValue.subjectName;
            break;
          }
        }

        // Plan B2: Matching difuso por nombre de materia
        if (!subjectCode) {
          let bestScore = 0;
          let bestMatch = null;
          for (const [mapKey, mapValue] of subjectCodeMap.entries()) {
            if (!mapValue.subjectName || mapValue.subjectName.length < 3) continue;
            const score = similarity(titleLower, mapKey);
            if (score > bestScore && score > 0.4) {
              bestScore = score;
              bestMatch = mapValue;
            }
          }
          if (bestMatch) {
            subjectCode = bestMatch.subjectCode || '';
            subjectName = bestMatch.subjectName;
          }
        }
      }

      return {
        id: `scraper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: t.title.slice(0, 120),
        subjectName: subjectName,
        subjectCode: subjectCode,
        dueDate: parseDateString(t.dueDate),
        category: categorizeTask(t.title),
        detectedAt: new Date().toISOString(),
        isAdded: false,
        notificado: false,
        requiereGrupo: t.requiereGrupo || false,
        portalUrl: t.url || portalUrl,
        source: platform,
      };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Calcula similitud entre dos strings (coeficiente de Dice)
 * @param {string} a 
 * @param {string} b 
 * @returns {number} 0-1
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const pairsA = new Set();
  for (let i = 0; i < a.length - 1; i++) {
    pairsA.add(a.slice(i, i + 2));
  }
  
  const pairsB = new Set();
  for (let i = 0; i < b.length - 1; i++) {
    pairsB.add(b.slice(i, i + 2));
  }
  
  let intersection = 0;
  for (const pair of pairsA) {
    if (pairsB.has(pair)) intersection++;
  }
  
  return (2 * intersection) / (pairsA.size + pairsB.size);
}

/**
 * Intenta parsear fechas en diversos formatos de Moodle/Canvas.
 */
function parseDateString(dateStr) {
  if (!dateStr) return '';

  // Limpiar el string
  const cleaned = dateStr.replace(/\s+/g, ' ').trim();

  // ISO format
  if (cleaned.includes('T') || cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { /* ignore */ }
  }

  // Moodle Spanish: "Martes, 15 de septiembre de 2026, 23:59"
  const spanishMatch = cleaned.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
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

  // English: "September 15, 2026" or "15 September 2026"
  const englishMatch1 = cleaned.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  const englishMatch2 = cleaned.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  const englishMatch = englishMatch1 || englishMatch2;
  if (englishMatch) {
    const months = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };
    let monthName, day, year;
    if (englishMatch1) {
      monthName = englishMatch1[1]; day = englishMatch1[2]; year = englishMatch1[3];
    } else {
      day = englishMatch2[1]; monthName = englishMatch2[2]; year = englishMatch2[3];
    }
    const month = months[monthName.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Moodle format: "15 sept 2026" or "15/09/2026" or "2026-09-15"
  const shortDateMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (shortDateMatch) {
    const [, day, month, year] = shortDateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Relative dates: "Hace 2 horas", "En 3 días"
  const relativeMatch = cleaned.match(/(?:en|hace)\s+(\d+)\s+(hora|horas|día|días|dia|dias|minuto|minutos)/i);
  if (relativeMatch) {
    const num = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const now = new Date();
    if (unit.startsWith('hora')) now.setHours(now.getHours() + num);
    else if (unit.startsWith('día') || unit.startsWith('dia')) now.setDate(now.getDate() + num);
    else if (unit.startsWith('minuto')) now.setMinutes(now.getMinutes() + num);
    return now.toISOString().slice(0, 10);
  }

  // Nunca devolver texto arbitrario: una fecha inválida rompe Agenda y permite
  // que el scraper guarde eventos sin vencimiento real.
  return '';
}

function isSafePortalUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Intenta re-login automático cuando la sesión ha expirado durante el scraping.
 * Navega a la página de login, llena credenciales y verifica que funcionó.
 * @returns {Promise<boolean>} true si el re-login fue exitoso
 */
async function reloginMoodle(page, portalUrl, username, password, progress) {
  const baseUrl = portalUrl.replace(/\/+$/, '');
  const loginUrl = `${baseUrl}/login/index.php`;
  console.log('[SCRAPER] Intentando re-login automático...');
  progress('reauthenticating', 'Sesión interrumpida. Re-conectando...');

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch {
    console.error('[SCRAPER] re-login: fallo al navegar al login');
    return false;
  }

  // Si ya estamos autenticados (Moodle redirige a /my/), la sesión sigue viva
  if (!page.url().includes('/login/')) {
    console.log('[SCRAPER] re-login: sesión sigue activa, URL:', page.url());
    return true;
  }

  // Manejar pantalla de conflicto de sesión (sesión duplicada)
  try {
    const logoutBtn = await page.waitForSelector(
      'button.btn-primary:has-text("Cerrar sesión"), form[action*="logout"] button[type="submit"]',
      { timeout: 2000 }
    );
    if (logoutBtn) {
      console.log('[SCRAPER] re-login: conflicto de sesión, haciendo logout...');
      await logoutBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForSelector('#username, input[name="username"]', { timeout: 10000 });
    }
  } catch { /* no conflict */ }

  // Deshabilitar overlays que puedan bloquear el formulario
  try {
    await page.evaluate(() => {
      document.querySelectorAll('#userway-biome, .userway-selector, [id*="userway"]').forEach((el) => {
        if (el.style) { el.style.display = 'none'; el.style.pointerEvents = 'none'; }
      });
      document.querySelectorAll('[style*="position: fixed"][style*="z-index"]').forEach((el) => {
        if (el.id !== 'login' && !el.closest('#login')) {
          el.style.pointerEvents = 'none';
        }
      });
    });
  } catch { /* non-fatal */ }

  // Llenar credenciales
  const usernameSel = '#username, input[name="username"], input[id="username"]';
  const passwordSel = '#password, input[name="password"], input[id="password"]';
  const loginBtnSel = '#loginbtn, button[type="submit"], input[type="submit"], button.btn-primary';

  try {
    await page.waitForSelector(usernameSel, { timeout: 8000 });
    await page.fill(usernameSel, username);
    await page.fill(passwordSel, password);
    await page.click(loginBtnSel);
    await page.waitForLoadState('domcontentloaded');
  } catch {
    console.error('[SCRAPER] re-login: no se pudo llenar formulario de login');
    return false;
  }

  // Verificar que no haya errores
  const loginError = await page.$('.loginerrors, .alert-danger, #loginerrormessage, .login-form .error');
  if (loginError) {
    const errorText = await loginError.textContent().catch(() => 'Error desconocido');
    console.error('[SCRAPER] re-login: credenciales fallaron:', errorText.trim());
    return false;
  }

  // Verificar que no sigamos en /login/
  if (page.url().includes('/login/')) {
    console.error('[SCRAPER] re-login: aún en /login/ después del intento');
    return false;
  }

  console.log('[SCRAPER] re-login exitoso, URL:', page.url());
  return true;
}

function getStorageStatePath(username) {
  if (!path || !fs) return null;
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const dir = path.join(homeDir, '.proyecto_mentor_data', 'scraper');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `session_${(username || 'default').replace(/[^a-zA-Z0-9]/g, '_')}.json`);
  } catch {
    return null;
  }
}

async function saveStorageState(context, username) {
  if (!fs || !path) return;
  try {
    const storageStatePath = getStorageStatePath(username);
    if (storageStatePath) {
      await context.storageState({ path: storageStatePath });
    }
  } catch { /* ignore */ }
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
