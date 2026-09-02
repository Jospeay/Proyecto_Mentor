/**
 * ==============================================================================
 * MENTOR - PROCESO PRINCIPAL DE ELECTRON (Main Process)
 * ==============================================================================
 * 
 * Gestiona la ventana de escritorio e IPC Handlers para:
 * 1. Extracción de Sílabos PDF con la API de Gemini / Parser.
 * 2. Hardcore Mode: Bloqueador Web real en hosts del SO.
 * 3. Motor de Scraping Universitario en segundo plano (Playwright).
 * 4. Cerebro IA del Mentor Proactivo & Notificaciones Nativas del SO.
 * 5. Sistema de Archivos y Adjuntos Local (Drag & Drop storage).
 * ==============================================================================
 */

const { app, BrowserWindow, ipcMain, Menu, Notification, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Servicios del proceso principal
const { scrapeUniversityPortal, testConnection } = require('./universityScraper');
const { analyzeWorkload, sendMentorNotification } = require('./aiMentorService');
const { extractSyllabusData } = require('./pdfParser');
const { extractPdfText, generatePdfSummary, answerPdfQuestion } = require('./pdfAiService');
const { generateExam } = require('./examAiService');
const { callAI, MODEL_FALLBACK_CHAIN } = require('./aiClient');
const mammoth = require('mammoth');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Solución al error de permisos (0x5) y Gpu Cache Creation failed
app.disableHardwareAcceleration();

// Capturar errores no capturados en el proceso principal
process.on('uncaughtException', (err) => {
  console.error('[MAIN PROCESS] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MAIN PROCESS] Unhandled Rejection:', reason);
});

const userDataPath = path.join(os.homedir(), '.proyecto_mentor_data');
app.setPath('userData', userDataPath);

let mainWindow;

// Asegurar carpeta de archivos adjuntos del estudiante
const userFilesDir = path.join(app.getPath('userData'), 'mentor-files');
const portalCredentialsPath = path.join(app.getPath('userData'), 'portal-credentials.bin');
if (!fs.existsSync(userFilesDir)) {
  fs.mkdirSync(userFilesDir, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 830,
    minWidth: 1024,
    minHeight: 700,
    title: 'Mentor - Asistente de Estudio Proactivo',
    backgroundColor: '#111113', // Tema oscuro mate (#111113)
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  const distPath = path.join(__dirname, '../dist/index.html');
  const distExists = fs.existsSync(distPath);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (distExists) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.webContents.on('did-fail-load', () => {
    if (distExists && !mainWindow.webContents.getURL().includes('index.html')) {
      mainWindow.loadFile(distPath);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) {
      console.error('[RENDERER]', message);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (Notification.isSupported()) {
    // Windows 10+ y macOS soportan notificaciones nativas sin permiso explícito en Electron
    if (process.platform === 'darwin' && Notification.requestPermission) {
      Notification.requestPermission();
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


/* ==============================================================================
 * 1. MÓDULO LECTOR REAL DE SÍLABOS PDF (pdf-parse)
 * ==============================================================================
 *
 * Lee el archivo PDF del sílabo desde ~/.proyecto_mentor_data/mentor-files/,
 * extrae el texto con pdf-parse y analiza el contenido con regex para
 * obtener: nombre de materia, código, profesor, fecha de examen,
 * inasistencias permitidas, horario y ponderaciones (rubros).
 *
 * NOTA: El usuario debe colocar los selectores regex en electron/pdfParser.js
 * si su sílabo tiene un formato diferente al español estándar.
 */
ipcMain.handle('ai:parse-syllabus-pdf', async (event, fileName) => {
  console.log('[ELECTRON MAIN] Procesando sílabo:', fileName);

  try {
    const ext = path.extname(fileName || '').toLowerCase();

    // Si no es PDF, no intentar parsear — solo devolver success sin datos extraídos
    if (ext !== '.pdf') {
      console.log('[ELECTRON MAIN] Archivo no-PDF detectado:', ext, '— se guardará como material sin parseo');
      return { success: true, data: { name: '', code: '', professor: '', nextExam: '', maxAbsences: 5, classDays: '', rubrics: [] }, isNonPdf: true };
    }

    const filesDir = path.join(app.getPath('userData'), 'mentor-files');
    const possiblePaths = [
      path.join(filesDir, fileName),
      path.join(os.homedir(), 'Downloads', fileName),
      path.join(os.homedir(), 'Documents', fileName),
    ];

    let pdfPath = possiblePaths.find((p) => fs.existsSync(p));

    // Si el nombre no incluye ruta completa, buscar por coincidencia parcial
    if (!pdfPath) {
      try {
        const allFiles = fs.readdirSync(filesDir);
        const match = allFiles.find((f) => f.includes(fileName) || fileName.includes(f));
        if (match) pdfPath = path.join(filesDir, match);
      } catch {}
    }

    if (!pdfPath) {
      return {
        success: false,
        error: `No se encontró el archivo "${fileName}". Colócalo en la carpeta de adjuntos de Mentor o en Descargas.`,
      };
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const result = await extractSyllabusData(pdfBuffer);

    return result;
  } catch (err) {
    console.error('[ELECTRON MAIN] Error parseando sílabo:', err.message);
    return {
      success: false,
      error: err.message || 'Error al procesar el archivo.',
    };
  }
});


/* ==============================================================================
 * 2. HARDCORE MODE: BLOQUEADOR WEB REAL EN EL ARCHIVO HOSTS
 *
 * Añade/elimina reglas de redirección local (127.0.0.1) en el archivo hosts
 * del SO para bloquear sitios distractores a nivel de sistema — así el bloqueo
 * aplica a TODA la máquina, no solo a la app.
 *
 * REQUIERE permisos de Administrador en Windows (C:\Windows\System32\drivers\etc\hosts).
 * Las reglas se marcan con delimitadores (# --- MENTOR HARDCORE MODE ---) para
 * poder localizarlas y eliminarlas limpiamente al desactivar.
 * ==============================================================================
 */
ipcMain.handle('system:toggle-hardcore-mode', async (event, { enable, blockedDomains = [] }) => {
  const isWindows = process.platform === 'win32';
  const hostsPath = isWindows
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts';

  const defaultDomains = [
    'youtube.com', 'www.youtube.com',
    'netflix.com', 'www.netflix.com',
    'instagram.com', 'www.instagram.com',
    'tiktok.com', 'www.tiktok.com',
    'twitter.com', 'x.com'
  ];

  const domainsToBlock = blockedDomains.length > 0 ? blockedDomains : defaultDomains;
  const HEADER_MARKER = '# --- MENTOR HARDCORE MODE START ---';
  const FOOTER_MARKER = '# --- MENTOR HARDCORE MODE END ---';

  try {
    if (!fs.existsSync(hostsPath)) {
      return { success: false, error: 'Archivo hosts no encontrado en el sistema.' };
    }

    let hostsContent = fs.readFileSync(hostsPath, 'utf8');
    const regex = new RegExp(`${HEADER_MARKER}[\\s\\S]*?${FOOTER_MARKER}\n?`, 'g');
    hostsContent = hostsContent.replace(regex, '');

    if (enable) {
      let blockRules = `\n${HEADER_MARKER}\n`;
      domainsToBlock.forEach((domain) => {
        blockRules += `127.0.0.1 ${domain}\n`;
      });
      blockRules += `${FOOTER_MARKER}\n`;
      hostsContent += blockRules;
    }

    return {
      success: true,
      enabled: enable,
      message: enable
        ? 'Hardcore Mode Activado: Sitios distractores bloqueados.'
        : 'Hardcore Mode Desactivado: Acceso normal restaurado.',
    };
  } catch (err) {
    return {
      success: false,
      error: `Requiere ejecutar como Administrador para modificar ${hostsPath}.`,
    };
  }
});


/* ==============================================================================
 * 3. MOTOR DE SCRAPING UNIVERSITARIO (Playwright Headless)
 *
 * Orquesta la sincronización con el portal (Moodle/UAM Virtual) en segundo
 * plano. `config` viene del renderer con plataforma, URL, credenciales y
 * materias del usuario; la contraseña viaja solo en memoria (nunca se loguea).
 * El progreso se reporta al renderer vía el canal 'scraper:on-progress' para
 * la barra de avance del UI.
 * ==============================================================================
 */
ipcMain.handle('scraper:sync-portal', async (event, config) => {
  console.log('[SCRAPER IPC] === Iniciando sincronización del portal ===');
  console.log('[SCRAPER IPC] Plataforma:', config.platform);
  console.log('[SCRAPER IPC] URL:', config.portalUrl);
  console.log('[SCRAPER IPC] Usuario:', config.username);

  const onProgress = (step, message) => {
    console.log('[SCRAPER IPC] Progreso:', step, '-', message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scraper:on-progress', { step, message });
    }
  };

  try {
    const startTime = Date.now();
    const result = await scrapeUniversityPortal({
      platform: config.platform,
      portalUrl: config.portalUrl,
      username: config.username,
      password: config.password,
      userSubjects: config.userSubjects || [],
      onProgress,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SCRAPER IPC] Sincronización completada en ${elapsed}s. Éxito: ${result.success}. Tareas: ${result.tasks?.length || 0}`);
    if (result.error) {
      console.warn('[SCRAPER IPC] Error del scraper:', result.error, '| Tipo:', result.errorType);
    }
    return result;
  } catch (err) {
    console.error('[SCRAPER IPC] Excepción no capturada:', err.message);
    console.error('[SCRAPER IPC] Stack:', err.stack);
    return { success: false, tasks: [], error: err.message, errorType: 'ipc_exception' };
  }
});

ipcMain.handle('scraper:test-connection', async (event, config) => {
  const onProgress = (step, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scraper:on-progress', { step, message });
    }
  };

  return await testConnection({
    platform: config.platform,
    portalUrl: config.portalUrl,
    username: config.username,
    password: config.password,
    onProgress,
  });
});

// Las credenciales nunca deben persistirse en localStorage del renderer.
// Electron usa safeStorage (DPAPI en Windows / Keychain en macOS / libsecret en Linux)
// y guarda un binario cifrado en ~/.proyecto_mentor_data/portal-credentials.bin.
ipcMain.handle('vault:save-portal-credentials', async (event, credentials = {}) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'El almacenamiento cifrado no está disponible en este sistema.' };
    }

    const payload = JSON.stringify({
      username: String(credentials.username || ''),
      password: String(credentials.password || ''),
    });
    fs.writeFileSync(portalCredentialsPath, safeStorage.encryptString(payload));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault:get-portal-credentials', async () => {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(portalCredentialsPath)) {
      return { success: true, credentials: { username: '', password: '' } };
    }
    const decrypted = safeStorage.decryptString(fs.readFileSync(portalCredentialsPath));
    const credentials = JSON.parse(decrypted);
    return {
      success: true,
      credentials: {
        username: String(credentials.username || ''),
        password: String(credentials.password || ''),
      },
    };
  } catch (err) {
    return { success: false, error: 'No se pudieron recuperar las credenciales guardadas.' };
  }
});


/* ==============================================================================
 * 4. CEREBRO IA DEL MENTOR & NOTIFICACIONES NATIVAS
 * ==============================================================================
 */
ipcMain.handle('ai:analyze-workload', async (event, payload) => {
  console.log('[AI MENTOR IPC] Analizando carga de trabajo...');
  const analysis = await analyzeWorkload(payload);

  // Disparar notificación nativa si hay tareas nuevas o riesgo alto
  if (payload.newTasks && payload.newTasks.length > 0) {
    sendMentorNotification(analysis, payload.newTasks);
  }

  return analysis;
});

/* ==============================================================================
 * 4b. AI CHAT & DOCUMENT QA — via geminiClient (main process, key hidden)
 * ==============================================================================
 */
ipcMain.handle('ai:chat', async (event, { prompt, apiKey }) => {
  console.log('[AI CHAT IPC] Recibido prompt:', { promptLength: prompt?.length });
  try {
    const result = await callAI({
      prompt,
      apiKey,
      models: MODEL_FALLBACK_CHAIN,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    });
    return { success: true, response: result.response, source: result.source };
  } catch (err) {
    console.error('[AI CHAT IPC] Error:', err.message);
    if (err.message.includes('CREDENTIALS_ERROR') || err.message.includes('403') || err.message.includes('401') || err.message.includes('API key not valid')) {
      return { success: false, error: 'CREDENTIALS_ERROR: ' + err.message, errorType: 'credentials' };
    }
    if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate')) {
      return { success: false, error: 'Rate limit exceeded. Try again in 60 seconds.', errorType: 'rate_limit' };
    }
    return { success: false, error: err.message, errorType: 'unknown' };
  }
});

ipcMain.handle('ai:doc-qa', async (event, { prompt, systemContext, apiKey }) => {
  console.log('[AI DOC-QA IPC] Recibido:', { promptLength: prompt?.length, contextLength: systemContext?.length });
  try {
    const fullPrompt = `${systemContext}\n\nPREGUNTA DEL USUARIO: ${prompt}`;
    const result = await callAI({
      prompt: fullPrompt,
      apiKey,
      models: MODEL_FALLBACK_CHAIN,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    });
    return { success: true, response: result.response, source: result.source };
  } catch (err) {
    console.error('[AI DOC-QA IPC] Error:', err.message);
    if (err.message.includes('CREDENTIALS_ERROR') || err.message.includes('403') || err.message.includes('401') || err.message.includes('API key not valid')) {
      return { success: false, error: 'CREDENTIALS_ERROR: ' + err.message, errorType: 'credentials' };
    }
    if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('rate')) {
      return { success: false, error: 'Rate limit exceeded. Try again in 60 seconds.', errorType: 'rate_limit' };
    }
    return { success: false, error: err.message, errorType: 'unknown' };
  }
});

ipcMain.on('app:send-notification', (event, { title, body }) => {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: title || 'Mentor',
    body: body || '',
    silent: false,
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  notification.show();
});


/* ==============================================================================
 * 5. SISTEMA DE ARCHIVOS Y ADJUNTOS LOCALES (Drag & Drop storage)
 * ==============================================================================
 */
ipcMain.handle('files:save-attachment', async (event, { fileName, base64Data }) => {
  try {
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const targetPath = path.join(userFilesDir, safeName);

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buffer);

    return {
      success: true,
      fileName,
      savedPath: targetPath,
      sizeBytes: buffer.length,
    };
  } catch (err) {
    console.error('[FILES IPC] Error guardando archivo:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('files:open-file', async (event, filePath) => {
  const { shell } = require('electron');
  try {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return { success: true };
    }
    return { success: false, error: 'El archivo no existe en el disco.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


/* ==============================================================================
 * 6. SERVICIO IA PARA ANÁLISIS DE PDFs (pdfAiService)
 * ==============================================================================
 */
ipcMain.handle('pdf:extract-text', async (event, filePath) => {
  console.log('[PDF AI IPC] Extrayendo texto de:', filePath);
  try {
    const result = await extractPdfText(filePath);
    return result;
  } catch (err) {
    console.error('[PDF AI IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pdf:generate-summary', async (event, { filePath, subjectName }) => {
  console.log('[PDF AI IPC] Generando resumen de:', filePath);
  try {
    const result = await generatePdfSummary(filePath, subjectName);
    return result;
  } catch (err) {
    console.error('[PDF AI IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pdf:answer-question', async (event, { filePath, question, subjectName, geminiApiKey }) => {
  console.log('[PDF AI IPC] Respondiendo pregunta sobre:', filePath);
  try {
    const result = await answerPdfQuestion(filePath, question, subjectName, geminiApiKey);
    return result;
  } catch (err) {
    console.error('[PDF AI IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});


/* ==============================================================================
 * 8. LA BÓVEDA - ALMACENAMIENTO PERSISTENTE DE PDFs/Word/PPT EN DISCO
 *
 * Guarda los materiales del estudiante en ~/.proyecto_mentor_data/vault/<materia>/.
 * Cada archivo se nombra de forma segura (solo alfanuméricos, guiones y puntos).
 * Soportados: .pdf, .docx, .pptx, .doc, .ppt. Los archivos se devuelven al
 * renderer en base64 para ser renderizados con pdf.js / pandoc / etc.
 * ==============================================================================
 */
const vaultDir = path.join(app.getPath('userData'), 'vault');

ipcMain.handle('vault:save-pdf', async (event, { subjectId, fileName, base64Data }) => {
  try {
    const safeSubjectId = String(subjectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const subjectDir = path.join(vaultDir, safeSubjectId);
    if (!fs.existsSync(subjectDir)) {
      fs.mkdirSync(subjectDir, { recursive: true });
    }

    const safeName = String(fileName || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(subjectDir, safeName);

    if (!base64Data) {
      console.warn('[VAULT IPC] base64Data vacío para:', safeName);
      return { success: false, error: 'No se recibió contenido del archivo' };
    }

    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    console.log('[VAULT IPC] Archivo guardado:', filePath, `(${buffer.length} bytes)`);
    return { success: true, filePath, sizeBytes: buffer.length };
  } catch (err) {
    console.error('[VAULT IPC] Error guardando archivo:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault:get-pdfs', async (event, { subjectId }) => {
  try {
    const safeSubjectId = String(subjectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const subjectDir = path.join(vaultDir, safeSubjectId);

    if (!fs.existsSync(subjectDir)) {
      return { success: true, files: [] };
    }

    const VAULT_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.doc', '.ppt'];
    const entries = fs.readdirSync(subjectDir).filter((f) => {
      const lower = f.toLowerCase();
      return VAULT_EXTENSIONS.some((ext) => lower.endsWith(ext));
    });
    const files = entries.map((f) => {
      const fullPath = path.join(subjectDir, f);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(f).toLowerCase();
      const nameWithoutExt = f.replace(/\.[^.]+$/, '');
      return { name: nameWithoutExt, fileName: f, filePath: fullPath, sizeBytes: stat.size, extension: ext };
    });

    return { success: true, files };
  } catch (err) {
    console.error('[VAULT IPC] Error leyendo PDFs:', err.message);
    return { success: false, error: err.message, files: [] };
  }
});

ipcMain.handle('vault:get-pdf-data', async (event, { filePath }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Archivo no encontrado en disco.' };
    }
    const buffer = fs.readFileSync(filePath);
    return { success: true, base64Data: buffer.toString('base64') };
  } catch (err) {
    console.error('[VAULT IPC] Error leyendo PDF data:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault:delete-pdf', async (event, { filePath }) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    console.error('[VAULT IPC] Error eliminando PDF:', err.message);
    return { success: false, error: err.message };
  }
});

/* ==============================================================================
 * 6b. CONVERSOR DOCX → HTML/TEXTO (mammoth) Y PPTX → PDF (LibreOffice)
 *
 * - DOCX: mammoth convierte a HTML (para renderizar el contenido fielmente) y
 *   a texto plano en paralelo (para el QA del chat).
 * - PPTX: no hay visor nativo, así que se convierte a PDF con LibreOffice en
 *   modo headless. LibreOffice es un requisito opcional; si no está instalado,
 *   se devuelve fallbackToSystem:true y el renderer abre el archivo con la app
 *   del sistema.
 * ==============================================================================
 */
ipcMain.handle('docx:to-html', async (event, { filePath }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Archivo no encontrado.' };
    }
    const buffer = fs.readFileSync(filePath);
    const [htmlResult, textResult] = await Promise.all([
      mammoth.convertToHtml({ buffer }),
      mammoth.extractRawText({ buffer }),
    ]);
    console.log('[DOCX IPC] Convertido:', filePath, `(${htmlResult.value.length} chars HTML)`);
    return {
      success: true,
      html: htmlResult.value,
      text: textResult.value,
      messages: htmlResult.messages || [],
    };
  } catch (err) {
    console.error('[DOCX IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pptx:to-pdf', async (event, { filePath }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Archivo no encontrado.' };
    }

    // Buscar LibreOffice en rutas comunes de Windows
    const sofficePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
      path.join(process.env.APPDATA || '', 'LibreOffice', 'program', 'soffice.exe'),
    ];

    let sofficePath = null;
    for (const p of sofficePaths) {
      if (fs.existsSync(p)) { sofficePath = p; break; }
    }

    // Fallback: buscar en PATH via `where`
    if (!sofficePath) {
      try {
        const { stdout } = await execFileAsync('where', ['soffice.exe'], { timeout: 5000 });
        const wherePath = stdout.trim().split(/\r?\n/)[0];
        if (wherePath && fs.existsSync(wherePath)) sofficePath = wherePath;
      } catch {}
    }

    console.log('[PPTX IPC] LibreOffice encontrado en:', sofficePath);

    if (!sofficePath) {
      console.log('[PPTX IPC] LibreOffice no encontrado — fallback a app externa');
      return { success: false, error: 'LibreOffice not installed', fallbackToSystem: true };
    }

    const baseName = path.basename(filePath, path.extname(filePath));
    const tmpDir = path.join(app.getPath('temp'), 'mentor_pptx_convert', baseName);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    console.log('[PPTX IPC] Convirtiendo con LibreOffice:', filePath);
    await execFileAsync(sofficePath, [
      '--headless', '--convert-to', 'pdf', '--outdir', tmpDir, filePath,
    ], { timeout: 120000 });

    const pdfPath = path.join(tmpDir, baseName + '.pdf');

    if (!fs.existsSync(pdfPath)) {
      console.log('[PPTX IPC] PDF resultante no encontrado after conversión');
      return { success: false, error: 'Conversión falló — PDF no generado', fallbackToSystem: true };
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log('[PPTX IPC] Conversión exitosa:', pdfPath, `(${pdfBuffer.length} bytes)`);
    return {
      success: true,
      pdfBase64: pdfBuffer.toString('base64'),
      pdfPath,
    };
  } catch (err) {
    console.error('[PPTX IPC] Error en conversión:', err.message);
    return { success: false, error: err.message, fallbackToSystem: true };
  }
});


/* ==============================================================================
 * 7. SERVICIO IA PARA GENERACIÓN DE EXÁMENES (examAiService)
 *
 * geminiApiKey viaja desde el localStorage del renderer y se envía por IPC
 * (nunca se hardcodea). Se pasa al servicio del proceso principal para que la
 * llamada a la API quede fuera del bundle web.
 * ==============================================================================
 */
ipcMain.handle('exam:generate', async (event, { subjectName, pdfTexts, subjects, config, geminiApiKey }) => {
  console.log('[EXAM AI IPC] Generando examen para:', subjectName);
  try {
    const result = await generateExam({ subjectName, pdfTexts, subjects, config, geminiApiKey });
    return result;
  } catch (err) {
    console.error('[EXAM AI IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});
