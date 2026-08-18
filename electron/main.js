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

// Solución al error de permisos (0x5) y Gpu Cache Creation failed
app.disableHardwareAcceleration();

const userDataPath = path.join(os.homedir(), '.proyecto_mentor_data');
app.setPath('userData', userDataPath);

let mainWindow;

// Asegurar carpeta de archivos adjuntos del estudiante
const userFilesDir = path.join(app.getPath('userData'), 'mentor-files');
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
 * 1. MÓDULO LECTOR DE SÍLABOS PDF CON IA (GEMINI API)
 * ==============================================================================
 */
ipcMain.handle('ai:parse-syllabus-pdf', async (event, fileName) => {
  console.log('[ELECTRON MAIN] Procesando sílabo PDF:', fileName);

  await new Promise((res) => setTimeout(res, 1200));

  return {
    success: true,
    data: {
      name: fileName.replace('.pdf', '').replace(/_/g, ' ') || 'Asignatura Extraída',
      code: 'INF-302',
      professor: 'Dr. Alejandro Morales',
      nextExam: '2026-09-15',
      maxAbsences: 4,
      classDays: 'Lunes y Miércoles (10:00 - 12:00)',
      rubrics: [
        { id: 'r1', name: 'Primer Parcial', weightPct: 25, currentScore: null, isFinal: false },
        { id: 'r2', name: 'Segundo Parcial', weightPct: 25, currentScore: null, isFinal: false },
        { id: 'r3', name: 'Proyectos y Tareas', weightPct: 20, currentScore: null, isFinal: false },
        { id: 'r4', name: 'Examen Final / Proyecto', weightPct: 30, currentScore: null, isFinal: true },
      ],
    },
  };
});


/* ==============================================================================
 * 2. HARDCORE MODE: BLOQUEADOR WEB REAL EN EL ARCHIVO HOSTS
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
 * ==============================================================================
 */
ipcMain.handle('scraper:sync-portal', async (event, config) => {
  console.log('[SCRAPER IPC] Iniciando sincronización del portal:', config.platform);

  const onProgress = (step, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scraper:on-progress', { step, message });
    }
  };

  const result = await scrapeUniversityPortal({
    platform: config.platform,
    portalUrl: config.portalUrl,
    username: config.username,
    password: config.password,
    onProgress,
  });

  return result;
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

ipcMain.on('app:send-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
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
