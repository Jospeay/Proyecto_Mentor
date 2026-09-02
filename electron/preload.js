/**
 * ==============================================================================
 * MENTOR - PUENTE DE PRECARGA SEGURO (Preload Script)
 * ==============================================================================
 * 
 * Expone métodos nativos y canales IPC a React a través de `window.mentorAPI`.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mentorAPI', {
  // Lector de Sílabos PDF
  parseSyllabusPDF: (fileName) => ipcRenderer.invoke('ai:parse-syllabus-pdf', fileName),

  // Hardcore Mode (bloqueo hosts)
  toggleHardcoreMode: (data) => ipcRenderer.invoke('system:toggle-hardcore-mode', data),

  // Notificaciones nativas
  sendNotification: (data) => ipcRenderer.send('app:send-notification', data),

  // Motor de Scraping Universitario
  syncUniversityPortal: (config) => ipcRenderer.invoke('scraper:sync-portal', config),
  testPortalConnection: (config) => ipcRenderer.invoke('scraper:test-connection', config),
  savePortalCredentials: (credentials) => ipcRenderer.invoke('vault:save-portal-credentials', credentials),
  getPortalCredentials: () => ipcRenderer.invoke('vault:get-portal-credentials'),
  onScraperProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('scraper:on-progress', handler);
    return () => ipcRenderer.removeListener('scraper:on-progress', handler);
  },

  // Cerebro IA del Mentor
  analyzeWorkload: (payload) => ipcRenderer.invoke('ai:analyze-workload', payload),

  // AI Chat & Document QA (via main process — API key hidden from renderer)
  aiChat: (params) => ipcRenderer.invoke('ai:chat', params),
  aiDocQA: (params) => ipcRenderer.invoke('ai:doc-qa', params),

  // Sistema de Archivos y Adjuntos Locales
  saveAttachment: (data) => ipcRenderer.invoke('files:save-attachment', data),
  openFile: (filePath) => ipcRenderer.invoke('files:open-file', filePath),

  // IA para PDFs (Bóveda de Apuntes)
  pdfExtractText: (filePath) => ipcRenderer.invoke('pdf:extract-text', filePath),
  pdfGenerateSummary: (params) => ipcRenderer.invoke('pdf:generate-summary', params),
  pdfAnswerQuestion: (params) => ipcRenderer.invoke('pdf:answer-question', params),

  // IA para Generación de Exámenes
  examGenerate: (params) => ipcRenderer.invoke('exam:generate', params),

  // La Bóveda - Almacenamiento persistente de PDFs en disco
  vaultSavePdf: (data) => ipcRenderer.invoke('vault:save-pdf', data),
  vaultGetPdfs: (subjectId) => ipcRenderer.invoke('vault:get-pdfs', { subjectId }),
  vaultGetPdfData: (filePath) => ipcRenderer.invoke('vault:get-pdf-data', { filePath }),
  vaultDeletePdf: (filePath) => ipcRenderer.invoke('vault:delete-pdf', { filePath }),

  // Conversores de archivos
  docxToHtml: (filePath) => ipcRenderer.invoke('docx:to-html', { filePath }),
  pptxToPdf: (filePath) => ipcRenderer.invoke('pptx:to-pdf', { filePath }),
});
