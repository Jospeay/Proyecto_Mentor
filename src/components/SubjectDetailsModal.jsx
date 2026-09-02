import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Link2,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  Pencil,
  Check,
  FolderOpen,
  CalendarDays,
  PenLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FileDropZone from './FileDropZone';
import { getFileTypeInfo } from '../utils/fileTypeUtils';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function generarFechasFiltradas(diasClaseSeleccionados = []) {
  if (diasClaseSeleccionados.length === 0) return [];
  const mapaDias = {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
    4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo',
  };
  const year = new Date().getFullYear();
  const fechas = [];
  const actual = new Date(year, 7, 17);
  const fin = new Date(year, 11, 11);

  while (actual <= fin) {
    const nombreDia = mapaDias[actual.getDay()];
    if (diasClaseSeleccionados.includes(nombreDia)) {
      fechas.push(actual.toISOString().split('T')[0]);
    }
    actual.setDate(actual.getDate() + 1);
  }
  return fechas;
}

function getTodayInRange(fechas) {
  const today = new Date().toISOString().split('T')[0];
  if (fechas.includes(today)) return today;
  return fechas[0] || '';
}

function formatFechaCorta(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dia = DIAS_CORTO[d.getDay()];
  const diaNum = d.getDate();
  const mes = MESES_CORTO[d.getMonth()];
  return `${dia}, ${diaNum} ${mes}`;
}

export default function SubjectDetailsModal({
  isOpen,
  onClose,
  subject,
  onAddResource,
  onDeleteResource,
  onEditResource,
  onUpdateSubject,
}) {
  const [activeTab, setActiveTab] = useState('links');
  const [formName, setFormName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [error, setError] = useState('');
  const [resources, setResources] = useState([]);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');

  const dias_clase = subject?.dias_clase || [];
  const fechasSemestre = useMemo(() => generarFechasFiltradas(dias_clase), [dias_clase]);
  const [selectedDate, setSelectedDate] = useState('');
  const [dayNotes, setDayNotes] = useState({});
  const dateListRef = useRef(null);
  const saveTimerRef = useRef(null);
  const dayNotesRef = useRef(dayNotes);
  dayNotesRef.current = dayNotes;

  useEffect(() => {
    if (!isOpen || !subject?.id) { setResources([]); return; }
    const subjectResources = (subject?.resources || []).filter(r => r.category !== 'attachments');
    const api = window.mentorAPI;
    if (!api?.vaultGetPdfs) { setResources(subjectResources); return; }
    api.vaultGetPdfs(subject.id).then((result) => {
      if (result.success) {
        const diskResources = result.files.map((f) => ({
          id: `vault_${f.fileName}`,
          name: f.name,
          category: 'attachments',
          filePath: f.filePath,
          fileName: f.fileName,
          sizeBytes: f.sizeBytes,
        }));
        setResources([...subjectResources, ...diskResources]);
      } else {
        setResources(subjectResources);
      }
    }).catch(() => setResources(subjectResources));
  }, [isOpen, subject?.id, subject?.resources]);

  useEffect(() => {
    if (!isOpen) return;
    setDayNotes(subject?.dayNotes || {});
    setSelectedDate(getTodayInRange(fechasSemestre));
  }, [isOpen, fechasSemestre]);

  useEffect(() => {
    if (!isOpen || !subject?.dayNotes) return;
    setDayNotes((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(subject.dayNotes)) return prev;
      return subject.dayNotes;
    });
  }, [isOpen, subject?.dayNotes]);

  useEffect(() => {
    if (!selectedDate || !dateListRef.current) return;
    const el = dateListRef.current.querySelector(`[data-date="${selectedDate}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedDate]);

  const filteredResources = resources.filter((r) => r.category === activeTab);

  const notesCount = useMemo(
    () => Object.values(dayNotes).filter((v) => v && v.trim().length > 0).length,
    [dayNotes]
  );

  const handleDayNoteChange = useCallback((dateStr, value) => {
    setDayNotes((prev) => {
      const next = { ...prev, [dateStr]: value };
      dayNotesRef.current = next;
      return next;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!onUpdateSubject || !subject?.id) return;
      onUpdateSubject(subject.id, { dayNotes: { ...dayNotesRef.current } });
    }, 800);
  }, [onUpdateSubject, subject?.id]);

  const flushDayNote = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!onUpdateSubject || !subject?.id) return;
    onUpdateSubject(subject.id, { dayNotes: { ...dayNotesRef.current } });
  }, [onUpdateSubject, subject?.id]);

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');

    if (!formName.trim()) {
      setError('El titulo o nombre es obligatorio.');
      return;
    }
    if (!formValue.trim()) {
      setError('El contenido o enlace es obligatorio.');
      return;
    }

    const isUrlTab = activeTab === 'links' || activeTab === 'attachments';
    const isUrl =
      formValue.trim().startsWith('http://') ||
      formValue.trim().startsWith('https://') ||
      /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(formValue.trim());

    if (isUrlTab && !isUrl) {
      setError('Por favor, introduce un enlace web valido (ej. drive.google.com).');
      return;
    }

    const formattedUrl =
      isUrl && !formValue.trim().startsWith('http')
        ? `https://${formValue.trim()}`
        : formValue.trim();

    const resourceData = {
      name: formName.trim(),
      category: activeTab,
      url: isUrlTab ? formattedUrl : '',
      note: '',
    };

    if (onAddResource) {
      onAddResource(subject.id, resourceData);
    }

    setFormName('');
    setFormValue('');
  };

  const handleFileDrop = async (file) => {
    if (!file) return;

    const fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const api = window.mentorAPI;

    // Guardar en La Bóveda (vault/{subjectId}/) para que vaultGetPdfs lo encuentre
    if (api?.vaultSavePdf) {
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result.split(',')[1];
          const result = await api.vaultSavePdf({
            subjectId: subject.id,
            fileName: file.name,
            base64Data,
          });
          if (result && result.success) {
            console.log(`[VAULT] Archivo guardado en bóveda: ${result.filePath}`);
            if (onAddResource) {
              onAddResource(subject.id, {
                name: file.name,
                category: 'attachments',
                url: result.filePath || '',
                note: `Archivo adjunto (${fileSizeStr})`,
                filePath: result.filePath || '',
                isLocalFile: true,
              });
            }
          } else {
            console.warn('[VAULT] Error guardando en bóveda:', result?.error);
          }
        };
        reader.readAsDataURL(file);
        return;
      } catch (err) {
        console.warn('[VAULT] Error guardando archivo:', err);
      }
    }

    // Fallback: guardar como recurso en memoria (sin archivo físico)
    if (onAddResource) {
      onAddResource(subject.id, {
        name: file.name,
        category: 'attachments',
        url: '',
        note: `Archivo cargado (${fileSizeStr})`,
        isLocalFile: false,
      });
    }
  };

  const startEditing = (res) => {
    setEditingResourceId(res.id);
    setEditName(res.name || '');
    setEditValue(res.url || res.note || '');
  };

  const handleSaveEdit = (res) => {
    if (!editName.trim()) return;

    const isUrlTab = res.category === 'links' || res.category === 'attachments';
    const updatedData = {
      ...res,
      name: editName.trim(),
      url: isUrlTab ? editValue.trim() : res.url || '',
      note: '',
    };

    if (onEditResource) {
      onEditResource(subject.id, res.id, updatedData);
    }

    setEditingResourceId(null);
  };

  const handleOpenLocalFile = (filePath) => {
    if (window.mentorAPI && window.mentorAPI.openFile && filePath) {
      window.mentorAPI.openFile(filePath);
    }
  };

  const tabs = [
    { id: 'links', label: 'Enlaces de Clase', icon: Link2, placeholder: 'Enlace (ej: drive.google.com/...)' },
    { id: 'notes', label: 'Notas del Profesor', icon: CalendarDays, count: notesCount },
    { id: 'attachments', label: 'Documentos y Lecturas', icon: Paperclip, placeholder: 'Enlace al documento (ej: uam.edu/lectura.pdf)' },
  ];

  const currentTabInfo = tabs.find((t) => t.id === activeTab);

  const getFileIcon = (fileName) => {
    const info = getFileTypeInfo(fileName);
    return React.createElement(info.iconComponent, { className: `w-4 h-4 ${info.colorClass}` });
  };

  return (
    <AnimatePresence>
      {isOpen && subject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`bg-zinc-900/95 backdrop-blur-lg border border-zinc-700/50 rounded-glass-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${
              activeTab === 'notes' ? 'w-full max-w-5xl' : 'w-full max-w-2xl'
            }`}
          >
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-zinc-700/50 flex items-center justify-between bg-zinc-800 shrink-0">
              <div>
                <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider block">
                  Recursos de Apoyo
                </span>
                <h3 className="text-base font-bold text-white">{subject.name}</h3>
                <p className="text-xs text-text-muted">
                  Prof: {subject.professor} · {resources.length} recursos guardados
                </p>
              </div>
              <button
                onClick={() => { flushDayNote(); onClose(); }}
                className="p-1 rounded-glass text-text-subtle hover:text-text-primary hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas */}
            <div className="flex border-b border-zinc-700/50 bg-zinc-800/40 shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const count = tab.id === 'notes' ? tab.count : resources.filter((r) => r.category === tab.id).length;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (activeTab === 'notes') flushDayNote();
                      setActiveTab(tab.id);
                      setError('');
                      setFormName('');
                      setFormValue('');
                      setEditingResourceId(null);
                    }}
                    className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                      isActive
                        ? 'border-brand-500 text-brand-400 bg-zinc-900/50'
                        : 'border-transparent text-text-muted hover:text-text-primary hover:bg-zinc-800/20'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.25 text-[10px] rounded-full ${
                        isActive ? 'bg-brand-500/20 text-brand-400' : 'bg-zinc-800 text-text-subtle'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Cuerpo Scrollable */}
            {activeTab === 'notes' ? (
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Columna izquierda: Lista de fechas */}
                <div
                  ref={dateListRef}
                  className="w-48 shrink-0 overflow-y-auto border-r border-zinc-700/50 bg-zinc-800/30 py-2"
                >
                  <div className="px-3 py-2 border-b border-zinc-700/30 mb-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Bitacora del Semestre
                    </p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">
                      {notesCount} / {fechasSemestre.length} dias con notas
                    </p>
                  </div>
                  {fechasSemestre.map((dateStr) => {
                    const isSelected = selectedDate === dateStr;
                    const hasNote = dayNotes[dateStr] && dayNotes[dateStr].trim().length > 0;
                    return (
                      <button
                        key={dateStr}
                        data-date={dateStr}
                        onClick={() => {
                          flushDayNote();
                          setSelectedDate(dateStr);
                        }}
                        className={`w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 transition-all duration-100 border-l-2 ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500 text-brand-300 font-semibold'
                            : 'border-transparent text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-300'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          hasNote ? 'bg-emerald-400' : isSelected ? 'bg-brand-400' : 'bg-zinc-600'
                        }`} />
                        <span className="truncate">{formatFechaCorta(dateStr)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Columna derecha: Editor */}
                <div className="flex-1 flex flex-col min-w-0 p-5 space-y-3">
                  {selectedDate ? (
                    <>
                      <div className="flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-brand-400" />
                        <h4 className="text-sm font-bold text-white">
                          {formatFechaCorta(selectedDate)}
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono">{selectedDate}</span>
                      </div>
                      <textarea
                        rows={16}
                        value={dayNotes[selectedDate] || ''}
                        onChange={(e) => handleDayNoteChange(selectedDate, e.target.value)}
                        placeholder="Escribe las notas de la clase de hoy aqui..."
                        className="flex-1 w-full bg-zinc-800 border border-zinc-700 rounded-glass px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors resize-none min-h-[200px]"
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-zinc-600">
                          Guardado automatico al escribir
                        </p>
                        <button
                          type="button"
                          onClick={flushDayNote}
                          className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-500/90 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Guardar
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
                      Selecciona una fecha para ver o editar notas.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Si estamos en documentos, mostrar zona Drag & Drop */}
                {activeTab === 'attachments' && (
                  <FileDropZone
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.png,.jpg"
                    maxSizeMB={25}
                    label="Arrastra lecturas, guias o documentos aqui"
                    sublabel="PDF, Word, PowerPoint, texto e imagenes (hasta 25MB)"
                    onFilesDropped={handleFileDrop}
                  />
                )}

                {/* Formulario manual de agregar nuevo recurso */}
                <form
                  onSubmit={handleAdd}
                  className="bg-zinc-800/50 border border-zinc-700 rounded-glass-lg p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-brand-400" />
                    Agregar {activeTab === 'links' ? 'Enlace' : 'Documento por URL'}
                  </h4>

                  {error && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-glass px-3 py-1.5">
                      {error}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-text-muted font-medium mb-1">Nombre / Titulo</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="ej. Enlace de Zoom de clases"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs text-white placeholder-text-subtle focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-muted font-medium mb-1">URL / Enlace</label>
                      <input
                        type="text"
                        value={formValue}
                        onChange={(e) => setFormValue(e.target.value)}
                        placeholder={currentTabInfo?.placeholder || 'URL / Enlace'}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-xs text-white placeholder-text-subtle focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-500/90 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Recurso
                    </button>
                  </div>
                </form>

                {/* Listado de recursos guardados */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Recursos Guardados
                  </h4>

                  {filteredResources.length === 0 ? (
                    <div className="text-center py-8 bg-zinc-800/20 border border-dashed border-zinc-700 rounded-glass-lg text-text-subtle text-xs">
                      No hay recursos en esta categoria. Agrega uno arriba o arrastra un archivo.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {filteredResources.map((res) => {
                        const isUrl = Boolean(res.url);
                        const isEditing = editingResourceId === res.id;

                        if (isEditing) {
                          return (
                            <div
                              key={res.id}
                              className="bg-zinc-800 border-2 border-brand-500 rounded-glass p-3 space-y-2 shadow-md animate-fadeIn"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Nombre..."
                                  className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                                />
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  placeholder="URL..."
                                  className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingResourceId(null)}
                                  className="px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(res)}
                                  className="px-3 py-1 bg-brand-500 text-white rounded text-[11px] font-medium flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Guardar
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={res.id}
                            className="bg-zinc-800 border border-zinc-700 rounded-glass px-4 py-3 flex items-center justify-between gap-3 hover:border-brand-500/40 transition-all shadow-sm group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-1.5 bg-zinc-800 rounded border border-zinc-700 shrink-0">
                                {activeTab === 'links' ? (
                                  <Link2 className="w-4 h-4 text-brand-400" />
                                ) : (
                                  getFileIcon(res.fileName || res.name)
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                  {res.name}
                                  {res.syllabus && (
                                    <span className="px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-400 text-[10px] font-semibold shrink-0">
                                      Sílabo
                                    </span>
                                  )}
                                </p>
                                {res.filePath ? (
                                  <button
                                    onClick={() => handleOpenLocalFile(res.filePath)}
                                    className="text-[11px] text-brand-400 hover:underline flex items-center gap-1 mt-0.5"
                                  >
                                    <FolderOpen className="w-3 h-3" /> Abrir archivo local
                                  </button>
                                ) : isUrl ? (
                                  <a
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-brand-400 hover:underline truncate block max-w-md mt-0.5"
                                  >
                                    {res.url}
                                  </a>
                                ) : (
                                  <p className="text-[11px] text-text-muted break-words whitespace-pre-wrap mt-0.5">
                                    {res.note}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => startEditing(res)}
                                className="p-1.5 rounded hover:bg-zinc-800 text-text-subtle hover:text-text-primary transition-colors"
                                title="Editar recurso"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {!res.syllabus && (
                                <button
                                  onClick={() => onDeleteResource && onDeleteResource(subject.id, res.id)}
                                  className="p-1.5 rounded hover:bg-zinc-800 text-text-subtle hover:text-red-400 transition-colors"
                                  title="Eliminar recurso"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
