import React, { useState, useEffect } from 'react';
import {
  Globe,
  Lock,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings,
  Bell,
} from 'lucide-react';
import {
  getPortalConfig,
  loadPortalConfig,
  savePortalConfig,
  syncUniversityTasksReal,
  testPortalCredentials,
  convertNoticeToTask,
  getRecentScrapedTasks,
  getUnnotifiedScrapedTasks,
  markNoticeAsNotified,
  markAllNoticesAsNotified,
} from '../services/universityPortalService';

/**
 * Vista dedicada de Configuración de Universidad.
 * Permite ingresar URL del portal, usuario y contraseña, y ejecutar scraping real.
 */
export default function UniversityConfigView({ subjects = [], tasks = [], onAddTaskFromPortal }) {
  const [config, setConfig] = useState(getPortalConfig());
  const [showPassword, setShowPassword] = useState(false);
  const [notices, setNotices] = useState([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [syncError, setSyncError] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [newTasksCount, setNewTasksCount] = useState(0);

  useEffect(() => {
    loadPortalConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (window.mentorAPI?.onScraperProgress) {
      const unsubscribe = window.mentorAPI.onScraperProgress((data) => {
        setProgressMsg(data.message || 'Procesando...');
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  const handleSaveConfig = () => {
    savePortalConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!config.username || !config.password) {
      setSyncError('Ingresa tu usuario y contraseña del portal.');
      return;
    }
    setSyncError('');
    setIsTesting(true);
    setTestResult(null);
    setProgressMsg('Verificando acceso al portal...');

    try {
      const res = await testPortalCredentials(config);
      setTestResult({
        success: res.success,
        msg: res.success
          ? 'Conexión exitosa. Credenciales válidas.'
          : res.error || 'Credenciales o URL no válidas.',
      });
    } catch (err) {
      setTestResult({ success: false, msg: err.message || 'Error de conexión.' });
    } finally {
      setIsTesting(false);
      setProgressMsg('');
    }
  };

  const handleRunSync = async () => {
    if (!config.username || !config.password) {
      setSyncError('Ingresa usuario y contraseña para sincronizar.');
      return;
    }

    setSyncError('');
    setIsSyncing(true);
    setProgressMsg('Iniciando navegador headless...');
    setNewTasksCount(0);

    try {
      savePortalConfig(config);
      const res = await syncUniversityTasksReal(config, { subjects, tasks });

      if (res.success) {
        setNotices(res.tasks || []);
        setNewTasksCount(res.newTasksCount || 0);
        savePortalConfig({ ...config, lastSync: new Date().toISOString() });
        setConfig(getPortalConfig());
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
    if (onAddTaskFromPortal) onAddTaskFromPortal(taskToAdd);
    setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, isAdded: true } : n)));
    markNoticeAsNotified(notice.title, notice.subjectName, notice.dueDate);
  };

  const handleAddAllNotices = () => {
    notices.filter((n) => !n.isAdded).forEach((n) => {
      if (onAddTaskFromPortal) onAddTaskFromPortal(convertNoticeToTask(n));
    });
    setNotices((prev) => prev.map((n) => ({ ...n, isAdded: true })));
    markAllNoticesAsNotified();
  };

  const handlePlatformChange = (platform) => {
    const defaults = {
      uam_moodle: 'https://uamvirtual.uam.edu.ni/grado',
      canvas: 'https://canvas.instructure.com',
      moodle: '',
    };
    setConfig({ ...config, platform, portalUrl: defaults[platform] || config.portalUrl });
  };

  const isElectron = Boolean(window.mentorAPI?.syncUniversityPortal);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 select-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Configuración de Universidad</h2>
          <p className="text-xs text-text-subtle">
            Conecta tu portal virtual con scraping real (Playwright headless).
          </p>
        </div>
      </div>

      {!isElectron && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-glass text-xs text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>El scraping requiere la app de escritorio Electron. Abre el proyecto con <code className="font-mono">npm run electron:start</code>.</span>
        </div>
      )}

      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass-lg p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Plataforma</label>
          <select
            value={config.platform}
            onChange={(e) => handlePlatformChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700/50 rounded-glass px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="uam_moodle">UAM Virtual Nicaragua (Moodle)</option>
            <option value="moodle">Moodle General</option>
            <option value="canvas">Canvas LMS</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">URL del Portal</label>
          <input
            type="url"
            value={config.portalUrl}
            onChange={(e) => setConfig({ ...config, portalUrl: e.target.value })}
            placeholder="https://uamvirtual.uam.edu.ni/grado"
            className="w-full bg-zinc-800 border border-zinc-700/50 rounded-glass px-3 py-2 text-xs text-white placeholder:text-text-subtle focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted flex items-center gap-1">
              <User className="w-3 h-3" /> Usuario
            </label>
            <input
              type="text"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder="ej. 21012345"
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-glass px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted flex items-center gap-1">
              <Lock className="w-3 h-3" /> Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-zinc-800 border border-zinc-700/50 rounded-glass px-3 py-2 text-xs text-white pr-8 focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-white"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={config.autoNotify !== false}
            onChange={(e) => setConfig({ ...config, autoNotify: e.target.checked })}
            className="rounded border-zinc-700/50"
          />
          <Bell className="w-3.5 h-3.5" />
          Notificarme cuando se detecten tareas nuevas
        </label>

        {syncError && (
          <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-glass text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {testResult && (
          <div className={`flex items-center gap-2 p-2.5 rounded-glass text-xs border ${
            testResult.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{testResult.msg}</span>
          </div>
        )}

        {(isSyncing || isTesting) && (
          <div className="p-3 bg-zinc-800/80 border border-brand-500/30 rounded-glass">
            <p className="text-xs text-brand-400 font-medium flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> {progressMsg || 'Procesando...'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={isTesting || isSyncing}
            onClick={handleTestConnection}
            className="px-3 py-1.5 rounded-glass bg-zinc-800 hover:bg-zinc-800 border border-zinc-700/50 text-xs text-white font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Probar conexión
          </button>

          <button
            type="button"
            disabled={isSyncing || isTesting || !isElectron}
            onClick={handleRunSync}
            className="px-4 py-1.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar tareas'}
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            className="px-3 py-1.5 rounded-glass text-xs text-text-muted hover:text-white border border-zinc-700/50"
          >
            {savedSuccess ? '✓ Guardado' : 'Guardar configuración'}
          </button>
        </div>

        {config.lastSync && !isSyncing && (
          <div className="flex items-center gap-3 text-[11px] text-text-muted pt-1">
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Última sync: {new Date(config.lastSync).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            {getRecentScrapedTasks().length > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <Bell className="w-3 h-3" />
                {getUnnotifiedScrapedTasks().length} sin importar
              </span>
            )}
          </div>
        )}
      </div>

      {newTasksCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-glass text-xs text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>{newTasksCount} tarea(s) nueva(s) detectada(s). Revisa abajo para importarlas.</span>
        </div>
      )}

      {notices.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-glass-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              Tareas detectadas ({notices.length})
            </h4>
            <button
              onClick={handleAddAllNotices}
              className="text-xs text-brand-400 hover:underline font-medium"
            >
              Importar todas
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="bg-zinc-800 border border-zinc-700/50 rounded-glass p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{notice.title}</p>
                  <p className="text-text-subtle truncate">
                    {notice.subjectName} · Vence: {notice.dueDate || 'Sin fecha'}
                  </p>
                </div>
                {notice.isAdded ? (
                  <span className="text-green-400 font-medium shrink-0">Importada</span>
                ) : (
                  <button
                    onClick={() => handleAddNotice(notice)}
                    className="px-2.5 py-1 rounded bg-brand-500 text-white font-medium shrink-0"
                  >
                    Importar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
