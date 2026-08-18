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
  onScraperProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('scraper:on-progress', handler);
    return () => ipcRenderer.removeListener('scraper:on-progress', handler);
  },

  // Cerebro IA del Mentor
  analyzeWorkload: (payload) => ipcRenderer.invoke('ai:analyze-workload', payload),

  // Sistema de Archivos y Adjuntos Locales
  saveAttachment: (data) => ipcRenderer.invoke('files:save-attachment', data),
  openFile: (filePath) => ipcRenderer.invoke('files:open-file', filePath),
});
