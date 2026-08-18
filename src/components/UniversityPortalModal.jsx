import React, { useState, useEffect } from 'react';
import {
  Globe,
  Bell,
  Check,
  Plus,
  RefreshCw,
  Sparkles,
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
      setConfig(getPortalConfig());
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
      <div className="bg-pm-surface border border-pm-border rounded-pm-lg p-6 max-w-xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-pm-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-pm-accent/20 border border-pm-accent/40 flex items-center justify-center text-pm-accent shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-pm-text">
                Conexión Portal Universitario
              </h3>
              <p className="text-xs text-pm-subtle">
                Scraping en segundo plano (Playwright) para UAM Virtual Moodle y Canvas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-pm-subtle hover:text-pm-text p-1 rounded-pm hover:bg-pm-hover transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Ajustes de Configuración y Credenciales */}
        <div className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-pm-muted">Plataforma Universitaria</label>
            <select
              value={config.platform}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text focus:outline-none focus:border-pm-accent"
            >
              <option value="uam_moodle">UAM Virtual Nicaragua (uamvirtual.uam.edu.ni/grado)</option>
              <option value="moodle">Moodle General</option>
              <option value="canvas">Canvas LMS</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-pm-muted">URL Base del Portal</label>
            <input
              type="url"
              value={config.portalUrl}
              onChange={(e) => setConfig({ ...config, portalUrl: e.target.value })}
              placeholder="https://uamvirtual.uam.edu.ni/grado"
              className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text placeholder:text-pm-subtle focus:outline-none focus:border-pm-accent"
            />
          </div>

          {/* Credenciales de Acceso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-pm-muted flex items-center gap-1">
                <User className="w-3 h-3 text-pm-subtle" /> Usuario / Carnet
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="ej. 21012345"
                className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text focus:outline-none focus:border-pm-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-pm-muted flex items-center gap-1">
                <Lock className="w-3 h-3 text-pm-subtle" /> Contraseña del Portal
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text pr-8 focus:outline-none focus:border-pm-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pm-subtle hover:text-pm-text"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mensajes de Estado / Errores */}
          {syncError && (
            <div className="flex items-center gap-2 p-2.5 bg-pm-red/10 border border-pm-red/20 rounded-pm text-xs text-pm-red">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-pm text-xs border ${
                testResult.success
                  ? 'bg-pm-green/10 border-pm-green/20 text-pm-green'
                  : 'bg-pm-red/10 border-pm-red/20 text-pm-red'
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
              className="px-3 py-1.5 rounded-pm bg-pm-surface hover:bg-pm-hover border border-pm-border text-xs text-pm-text font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pm-accent" /> : <Lock className="w-3.5 h-3.5 text-pm-subtle" />}
              <span>Probar Credenciales</span>
            </button>

            <button
              type="button"
              disabled={isSyncing || isTesting}
              onClick={handleRunSync}
              className="px-4 py-1.5 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-xs font-semibold transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
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
            <div className="p-3 bg-pm-card/80 border border-pm-accent/30 rounded-pm space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-pm-accent font-semibold flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Proceso en segundo plano...
                </span>
              </div>
              <p className="text-xs text-pm-text font-medium">{progressMsg || 'Iniciando navegador headless...'}</p>
            </div>
          )}
        </div>

        {/* ALERTA GENERADA POR EL CEREBRO IA */}
        {aiAlert && !isSyncing && (
          <div
            className={`p-3.5 border rounded-pm space-y-1.5 ${
              aiAlert.riskLevel === 'critical'
                ? 'bg-pm-red/10 border-pm-red/30 text-pm-red'
                : aiAlert.riskLevel === 'high'
                ? 'bg-pm-amber/10 border-pm-amber/30 text-pm-amber'
                : 'bg-pm-card border-pm-border text-pm-text'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Análisis del Mentor IA
              </span>
              <span className="text-[10px] text-pm-subtle">
                Riesgo: <strong className="capitalize">{aiAlert.riskLevel}</strong>
              </span>
            </div>
            <p className="text-xs font-medium leading-snug">{aiAlert.message}</p>
            {aiAlert.calendarAdjustment && (
              <p className="text-[11px] text-pm-subtle italic border-t border-pm-border/30 pt-1">
                Ajuste: {aiAlert.calendarAdjustment}
              </p>
            )}
          </div>
        )}

        {/* Listado de Tareas Extraídas */}
        {notices.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-pm-border">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-pm-text">
                Tareas Detectadas ({notices.length})
              </h4>
              <button
                onClick={handleAddAllNotices}
                className="text-[11px] text-pm-accent hover:underline font-semibold flex items-center gap-1"
              >
                <span>Importar todas</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="bg-pm-card border border-pm-border rounded-pm p-3 flex items-center justify-between gap-3 text-xs shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-pm-text truncate">{notice.title}</p>
                    <p className="text-[11px] text-pm-subtle truncate">
                      Materia: {notice.subjectName} · Vence: {notice.dueDate || 'Sin fecha'}
                    </p>
                  </div>
                  {notice.isAdded ? (
                    <span className="text-[11px] text-pm-green font-medium flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Añadida
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddNotice(notice)}
                      className="px-2.5 py-1 rounded bg-pm-accent hover:bg-pm-accent/90 text-white font-medium text-[11px] transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Importar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones inferiores */}
        <div className="flex justify-between items-center pt-2 border-t border-pm-border">
          <button
            type="button"
            onClick={handleSaveConfig}
            className="text-xs text-pm-muted hover:text-pm-text flex items-center gap-1"
          >
            {savedSuccess ? (
              <span className="text-pm-green flex items-center gap-1">
                <Check className="w-3 h-3" /> Configuración guardada
              </span>
            ) : (
              'Guardar credenciales'
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-pm text-xs text-pm-muted hover:text-pm-text bg-pm-card hover:bg-pm-hover border border-pm-border transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
