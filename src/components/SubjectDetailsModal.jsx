import React, { useState } from 'react';
import {
  X,
  Link2,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  Sparkles,
  Pencil,
  Check,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FileDropZone from './FileDropZone';

/**
 * COMPONENTE: SubjectDetailsModal.jsx
 * Hub de Recursos y Materiales de Apoyo por Asignatura.
 * 
 * Soporta:
 * - Clasificación por pestañas (Enlaces, Notas, Documentos)
 * - Edición inline de recursos
 * - Drag & Drop interactivo para subir y guardar documentos
 */
export default function SubjectDetailsModal({
  isOpen,
  onClose,
  subject,
  onAddResource,
  onDeleteResource,
  onEditResource,
}) {
  const [activeTab, setActiveTab] = useState('links'); // 'links' | 'notes' | 'attachments'
  const [formName, setFormName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [error, setError] = useState('');

  // Estado para edición inline de un recurso
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');

  const [editValue, setEditValue] = useState('');

  const resources = subject.resources || [];
  const filteredResources = resources.filter((r) => r.category === activeTab);

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');

    if (!formName.trim()) {
      setError('El título o nombre es obligatorio.');
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
      setError('Por favor, introduce un enlace web válido (ej. drive.google.com).');
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
      note: activeTab === 'notes' ? formValue.trim() : '',
    };

    if (onAddResource) {
      onAddResource(subject.id, resourceData);
    }

    setFormName('');
    setFormValue('');
  };

  // Manejo de archivos soltados en la pestaña de documentos
  const handleFileDrop = async (file) => {
    if (!file) return;

    let savedPath = '';
    let fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    // Si estamos en Electron, persistir el archivo en disco
    if (window.mentorAPI && window.mentorAPI.saveAttachment) {
      try {
        // Leer a base64
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result.split(',')[1];
          const result = await window.mentorAPI.saveAttachment({
            fileName: file.name,
            base64Data,
          });
          if (result && result.success) {
            savedPath = result.savedPath;
          }

          const resourceData = {
            name: file.name,
            category: 'attachments',
            url: savedPath || URL.createObjectURL(file),
            note: `Archivo adjunto (${fileSizeStr})`,
            filePath: savedPath,
            isLocalFile: true,
          };

          if (onAddResource) {
            onAddResource(subject.id, resourceData);
          }
        };
        reader.readAsDataURL(file);
        return;
      } catch (err) {
        console.warn('Error guardando archivo con Electron:', err);
      }
    }

    // Fallback web
    const resourceData = {
      name: file.name,
      category: 'attachments',
      url: URL.createObjectURL(file),
      note: `Archivo cargado (${fileSizeStr})`,
      isLocalFile: false,
    };

    if (onAddResource) {
      onAddResource(subject.id, resourceData);
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
      note: res.category === 'notes' ? editValue.trim() : res.note || '',
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
    { id: 'notes', label: 'Notas del Profesor', icon: FileText, placeholder: 'Contenido de la nota (ej: "No evalúa asistencia")' },
    { id: 'attachments', label: 'Documentos y Lecturas', icon: Paperclip, placeholder: 'Enlace al documento (ej: uam.edu/lectura.pdf)' },
  ];

  const currentTabInfo = tabs.find((t) => t.id === activeTab);

  return (
    <AnimatePresence>
      {isOpen && subject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl bg-pm-surface/95 backdrop-blur-lg border border-pm-border rounded-pm-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Cabecera del modal */}
        <div className="px-6 py-4 border-b border-pm-border flex items-center justify-between bg-pm-card shrink-0">
          <div>
            <span className="text-[10px] text-pm-accent font-semibold uppercase tracking-wider block">
              Recursos de Apoyo
            </span>
            <h3 className="text-base font-bold text-pm-text">{subject.name}</h3>
            <p className="text-xs text-pm-muted">
              Prof: {subject.professor} · {resources.length} recursos guardados
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-pm text-pm-subtle hover:text-pm-text hover:bg-pm-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-pm-border bg-pm-card/40 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count = resources.filter((r) => r.category === tab.id).length;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setError('');
                  setFormName('');
                  setFormValue('');
                  setEditingResourceId(null);
                }}
                className={`flex-1 py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                  isActive
                    ? 'border-pm-accent text-pm-accent bg-pm-surface/50'
                    : 'border-transparent text-pm-muted hover:text-pm-text hover:bg-pm-hover/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.25 text-[10px] rounded-full ${
                    isActive ? 'bg-pm-accent/20 text-pm-accent' : 'bg-pm-card text-pm-subtle'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cuerpo Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Si estamos en documentos, mostrar zona Drag & Drop */}
          {activeTab === 'attachments' && (
            <FileDropZone
              accept=".pdf,.docx,.doc,.txt,.png,.jpg"
              maxSizeMB={25}
              label="Arrastra lecturas, guías o documentos aquí"
              sublabel="Se guardarán en el Hub de Materiales de la materia"
              onFilesDropped={handleFileDrop}
            />
          )}

          {/* Formulario manual de agregar nuevo recurso */}
          <form
            onSubmit={handleAdd}
            className="bg-pm-card/50 border border-pm-border rounded-pm-lg p-4 space-y-3"
          >
            <h4 className="text-xs font-bold text-pm-text flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              Agregar {activeTab === 'links' ? 'Enlace' : activeTab === 'notes' ? 'Nota' : 'Documento por URL'}
            </h4>

            {error && (
              <p className="text-xs text-pm-red bg-pm-red/10 border border-pm-red/20 rounded-pm px-3 py-1.5">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-pm-muted font-medium mb-1">Nombre / Título</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ej. Enlace de Zoom de clases"
                  className="w-full bg-pm-surface border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text placeholder-pm-subtle focus:outline-none focus:border-pm-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] text-pm-muted font-medium mb-1">
                  {activeTab === 'notes' ? 'Contenido de la nota' : 'URL / Enlace'}
                </label>
                <input
                  type="text"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={currentTabInfo.placeholder}
                  className="w-full bg-pm-surface border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text placeholder-pm-subtle focus:outline-none focus:border-pm-accent"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-pm-accent hover:bg-pm-accent/90 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Recurso
              </button>
            </div>
          </form>

          {/* Listado de recursos guardados */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-pm-muted uppercase tracking-wider">
              Recursos Guardados
            </h4>

            {filteredResources.length === 0 ? (
              <div className="text-center py-8 bg-pm-card/20 border border-dashed border-pm-border rounded-pm-lg text-pm-subtle text-xs">
                No hay recursos en esta categoría. Agrega uno arriba o arrastra un archivo.
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
                        className="bg-pm-card border-2 border-pm-accent rounded-pm p-3 space-y-2 shadow-md animate-fadeIn"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Nombre..."
                            className="bg-pm-surface border border-pm-border rounded px-2.5 py-1.5 text-xs text-pm-text focus:outline-none focus:border-pm-accent"
                          />
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="URL o Nota..."
                            className="bg-pm-surface border border-pm-border rounded px-2.5 py-1.5 text-xs text-pm-text focus:outline-none focus:border-pm-accent"
                          />
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingResourceId(null)}
                            className="px-2.5 py-1 text-[11px] text-pm-muted hover:text-pm-text"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(res)}
                            className="px-3 py-1 bg-pm-accent text-white rounded text-[11px] font-medium flex items-center gap-1"
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
                      className="bg-pm-card border border-pm-border rounded-pm px-4 py-3 flex items-center justify-between gap-3 hover:border-pm-accent/40 transition-all shadow-sm group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-1.5 bg-pm-surface rounded border border-pm-border text-pm-accent shrink-0">
                          {activeTab === 'links' ? (
                            <Link2 className="w-4 h-4" />
                          ) : activeTab === 'notes' ? (
                            <FileText className="w-4 h-4 text-pm-blue" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-pm-amber" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-pm-text truncate">{res.name}</p>
                          {res.filePath ? (
                            <button
                              onClick={() => handleOpenLocalFile(res.filePath)}
                              className="text-[11px] text-pm-accent hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <FolderOpen className="w-3 h-3" /> Abrir archivo local
                            </button>
                          ) : isUrl ? (
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-pm-accent hover:underline truncate block max-w-md mt-0.5"
                            >
                              {res.url}
                            </a>
                          ) : (
                            <p className="text-[11px] text-pm-muted break-words whitespace-pre-wrap mt-0.5">
                              {res.note}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => startEditing(res)}
                          className="p-1.5 rounded hover:bg-pm-hover text-pm-subtle hover:text-pm-text transition-colors"
                          title="Editar recurso"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteResource && onDeleteResource(subject.id, res.id)}
                          className="p-1.5 rounded hover:bg-pm-hover text-pm-subtle hover:text-pm-red transition-colors"
                          title="Eliminar recurso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
