import React, { useState, useEffect } from 'react';
import {
  Globe,
  Bell,
  Check,
  Plus,
  RefreshCw,
  Bot,
  Info,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  getPortalConfig,
  loadPortalConfig,
  savePortalConfig,
  syncUniversityTasksReal,
  testPortalCredentials,
  convertNoticeToTask,
  getLatestAiAlert,
} from '../services/universityPortalService';

/**
 * COMPONENTE: UniversityPortalModal.jsx
 * Conexión y Scraping real con plataformas universitarias (UAM Virtual Moodle & Canvas).
 */
export default function UniversityPortalModal({
  isOpen,
  onClose,
  subjects = [],
  tasks = [],
  onAddTaskFromPortal,
}) {
  const [config, setConfig] = useState(getPortalConfig());
  const [showPassword, setShowPassword] = useState(false);
  const [notices, setNotices] = useState([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Estados de scraping en vivo
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [syncError, setSyncError] = useState('');
  const [testResult, setTestResult] = useState(null); // { success: boolean, msg: string }
  const [aiAlert, setAiAlert] = useState(getLatestAiAlert());

  useEffect(() => {
    if (isOpen) {
      loadPortalConfig().then(setConfig);
      setAiAlert(getLatestAiAlert());
      setSyncError('');
      setTestResult(null);
    }
  }, [isOpen]);

  // Listener para progreso del scraper
  useEffect(() => {
    if (window.mentorAPI && window.mentorAPI.onScraperProgress) {
      const unsubscribe = window.mentorAPI.onScraperProgress((data) => {
        setProgressMsg(data.message || 'Procesando...');
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    savePortalConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!config.username || !config.password) {
      setSyncError('Ingresa tu usuario y contraseña del portal para probar la conexión.');
      return;
    }
    setSyncError('');
    setIsTesting(true);
    setTestResult(null);
    setProgressMsg('Verificando acceso al portal...');

    try {
      const res = await testPortalCredentials(config);
      if (res.success) {
        setTestResult({
          success: true,
          msg: '¡Conexión exitosa! Las credenciales son válidas.',
        });
      } else {
        setTestResult({
          success: false,
          msg: res.error || 'Credenciales o URL no válidas.',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        msg: err.message || 'Error de conexión.',
      });
    } finally {
      setIsTesting(false);
      setProgressMsg('');
    }
  };

  const handleRunSync = async () => {
    if (!config.username || !config.password) {
      setSyncError('Ingresa usuario y contraseña para sincronizar tareas con el portal.');
      return;
    }

    setSyncError('');
    setIsSyncing(true);
    setProgressMsg('Iniciando motor de scraping...');

    try {
      savePortalConfig(config);
      const res = await syncUniversityTasksReal(config, { subjects, tasks });

      if (res.success && res.tasks) {
        setNotices(res.tasks);
        setAiAlert(getLatestAiAlert());
        if (res.newTasksCount > 0) {
          savePortalConfig({ ...config, lastSync: new Date().toISOString() });
        }
      } else {
        setSyncError(res.error || 'No se pudieron extraer tareas.');
      }
    } catch (err) {
      setSyncError(err.message || 'Error durante la sincronización.');
    } finally {
      setIsSyncing(false);
      setProgressMsg('');
    }
  };

  const handleAddNotice = (notice) => {
    const taskToAdd = convertNoticeToTask(notice);
    if (onAddTaskFromPortal) {
      onAddTaskFromPortal(taskToAdd);
    }
    setNotices((prev) =>
      prev.map((n) => (n.id === notice.id ? { ...n, isAdded: true } : n))
    );
  };

  const handleAddAllNotices = () => {
    const unadded = notices.filter((n) => !n.isAdded);
    unadded.forEach((n) => {
      const task = convertNoticeToTask(n);
      if (onAddTaskFromPortal) onAddTaskFromPortal(task);
    });
    setNotices((prev) => prev.map((n) => ({ ...n, isAdded: true })));
  };

  const handlePlatformChange = (platform) => {
    if (platform === 'uam_moodle') {
      setConfig({
        ...config,
        platform: 'uam_moodle',
        portalUrl: 'https://uamvirtual.uam.edu.ni/grado',
      });
    } else if (platform === 'canvas') {
      setConfig({
        ...config,
        platform: 'canvas',
        portalUrl: 'https://canvas.instructure.com',
      });
    } else {
      setConfig({ ...config, platform });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-glass-2xl p-6 max-w-xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-700/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Conexión Portal Universitario
              </h3>
              <p className="text-xs text-text-subtle">
                Scraping en segundo plano (Playwright) para UAM Virtual Moodle y Canvas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-subtle hover:text-text-primary p-1 rounded-glass hover:bg-zinc-800 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Ajustes de Configuración y Credenciales */}
        <div className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">Plataforma Universitaria</label>
            <select
              value={config.platform}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="uam_moodle">UAM Virtual Nicaragua (uamvirtual.uam.edu.ni/grado)</option>
              <option value="moodle">Moodle General</option>
              <option value="canvas">Canvas LMS</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">URL Base del Portal</label>
            <input
              type="url"
              value={config.portalUrl}
              onChange={(e) => setConfig({ ...config, portalUrl: e.target.value })}
              placeholder="https://uamvirtual.uam.edu.ni/grado"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs text-white placeholder:text-text-subtle focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Credenciales de Acceso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1">
                <User className="w-3 h-3 text-text-subtle" /> Usuario / Carnet
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="ej. 21012345"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted flex items-center gap-1">
                <Lock className="w-3 h-3 text-text-subtle" /> Contraseña del Portal
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs text-white pr-8 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mensajes de Estado / Errores */}
          {syncError && (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-glass text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-glass text-xs border ${
                testResult.success
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          {/* Botones de Prueba y Sincronización */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              disabled={isTesting || isSyncing}
              onClick={handleTestConnection}
              className="px-3 py-1.5 rounded-glass bg-zinc-900/95 hover:bg-zinc-800 border border-zinc-700 text-xs text-white font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" /> : <Lock className="w-3.5 h-3.5 text-text-subtle" />}
              <span>Probar Credenciales</span>
            </button>

            <button
              type="button"
              disabled={isSyncing || isTesting}
              onClick={handleRunSync}
              className="px-4 py-1.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-semibold transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isSyncing ? 'Extrayendo...' : 'Sincronizar Tareas (Scraping)'}</span>
            </button>
          </div>

          {/* Barra de Progreso en Vivo */}
          {(isSyncing || isTesting) && (
            <div             className="p-3 bg-zinc-800/80 border border-brand-500/30 rounded-glass space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-brand-400 font-semibold flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Proceso en segundo plano...
                </span>
              </div>
              <p className="text-xs text-text-primary font-medium">{progressMsg || 'Iniciando navegador headless...'}</p>
            </div>
          )}
        </div>

        {/* ALERTA GENERADA POR EL CEREBRO IA */}
        {aiAlert && !isSyncing && (
          <div
            className={`p-3.5 border rounded-glass space-y-1.5 ${
              aiAlert.riskLevel === 'critical'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : aiAlert.riskLevel === 'high'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-zinc-800 border-zinc-700 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> Análisis del Mentor IA
              </span>
              <span className="text-[10px] text-text-subtle">
                Riesgo: <strong className="capitalize">{aiAlert.riskLevel}</strong>
              </span>
            </div>
            <p className="text-xs font-medium leading-snug">{aiAlert.message}</p>
            {aiAlert.calendarAdjustment && (
              <p className="text-[11px] text-text-subtle italic border-t border-zinc-700/30 pt-1">
                Ajuste: {aiAlert.calendarAdjustment}
              </p>
            )}
          </div>
        )}

        {/* Listado de Tareas Extraídas */}
        {notices.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-700/50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-primary">
                Tareas Detectadas ({notices.length})
              </h4>
              <p className="text-[10px] text-text-subtle">Solo informativo — agrega tareas desde "Nueva tarea"</p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="bg-zinc-800 border border-zinc-700 rounded-glass p-3 flex items-center gap-3 text-xs shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-primary truncate">{notice.title}</p>
                    <p className="text-[11px] text-text-subtle truncate">
                      Materia: {notice.subjectName} · Vence: {notice.dueDate || 'Sin fecha'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones inferiores */}
        <div className="flex justify-between items-center pt-2 border-t border-zinc-700/50">
          <button
            type="button"
            onClick={handleSaveConfig}
            className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
          >
            {savedSuccess ? (
              <span className="text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Configuración guardada
              </span>
            ) : (
              'Guardar credenciales'
            )}
          </button>

          <button
            onClick={onClose}
              className="px-4 py-2 rounded-glass text-xs text-text-muted hover:text-text-primary bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
