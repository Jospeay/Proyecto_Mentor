import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText, Plus, Trash2, Send,
  Eye, Download, Loader2, Bot, FileQuestion,
  ChevronLeft, ChevronRight, X, Paperclip,
  RefreshCw, Edit, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import { getFileTypeInfo } from '../utils/fileTypeUtils';
import { queryMentorAI, askDocumentQA } from '../services/aiService';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const METADATA_KEY = 'mentor_vault_metadata';

function loadMetadata(subjectId) {
  try {
    const all = JSON.parse(localStorage.getItem(METADATA_KEY) || '{}');
    return all[subjectId] || {};
  } catch { return {}; }
}

function saveMetadata(subjectId, meta) {
  try {
    const all = JSON.parse(localStorage.getItem(METADATA_KEY) || '{}');
    all[subjectId] = meta;
    localStorage.setItem(METADATA_KEY, JSON.stringify(all));
  } catch {}
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NotesVault({ subject, onAddResource, onEditResource, onDeleteResource, onVaultChange }) {
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [splitView, setSplitView] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMode, setChatMode] = useState('study');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfError, setPdfError] = useState(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);

  const pdfDataUrl = useMemo(() => {
    if (!pdfBase64) return null;
    return `data:application/pdf;base64,${pdfBase64}`;
  }, [pdfBase64]);
  const messagesEndRef = useRef(null);
  const subjectIdRef = useRef(subject?.id);

  const loadResourcesFromDisk = useCallback(async () => {
    if (!subject?.id) { setResources([]); return; }
    try {
      const api = window.mentorAPI;
      if (!api?.vaultGetPdfs) { setResources([]); return; }
      const result = await api.vaultGetPdfs(subject.id);
      if (!result.success) { setResources([]); return; }

      const meta = loadMetadata(subject.id);
      const diskResources = result.files.map((f) => ({
        id: meta[f.fileName]?.id || `vault_${f.fileName}`,
        name: meta[f.fileName]?.name || f.name,
        category: 'attachments',
        filePath: f.filePath,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
        createdAt: meta[f.fileName]?.createdAt || new Date().toISOString(),
        isLocalFile: true,
      }));

      setResources(diskResources);

      const updatedMeta = {};
      diskResources.forEach((r) => { updatedMeta[r.fileName] = { id: r.id, name: r.name, createdAt: r.createdAt }; });
      saveMetadata(subject.id, updatedMeta);
    } catch (err) {
      console.error('[Vault] Error loading PDFs:', err);
      setResources([]);
    }
  }, [subject?.id]);

  useEffect(() => {
    subjectIdRef.current = subject?.id;
    loadResourcesFromDisk();
  }, [subject?.id, loadResourcesFromDisk]);

  useEffect(() => {
    return () => {
      setPdfBase64(null);
      setChatMessages([]);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (selectedResource) {
      setChatMessages([{
        id: 'welcome',
        sender: 'ai',
        text: `He analizado **${selectedResource.name}**. Que te gustaria saber?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setCurrentPage(1);
      setTotalPages(0);
      setPdfError(null);
      setPdfBase64(null);
      loadPdfData(selectedResource);
    } else {
      setChatMessages([]);
      setPdfBase64(null);
    }
  }, [selectedResource?.id]);

  const loadPdfData = async (resource) => {
    if (!resource?.filePath) return;
    setLoadingPdf(true);
    setPdfError(null);
    setPdfText('');
    try {
      const api = window.mentorAPI;
      if (!api?.vaultGetPdfData) {
        setPdfError('IPC no disponible');
        setLoadingPdf(false);
        return;
      }
      const result = await api.vaultGetPdfData(resource.filePath);
      if (result.success) {
        setPdfBase64(result.base64Data);
        if (api?.pdfExtractText) {
          try {
            const textResult = await api.pdfExtractText(resource.filePath);
            if (textResult.success) setPdfText(textResult.text || '');
          } catch {}
        }
      } else {
        setPdfError(result.error || 'Error leyendo PDF');
      }
    } catch (err) {
      setPdfError(err.message);
    }
    setLoadingPdf(false);
  };

  const handleFileUpload = async (files) => {
    if (!files.length || !subject?.id) return;
    setUploading(true);
    const api = window.mentorAPI;

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        const newResource = {
          id: `res_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: file.name, category: 'attachments', filePath: '', fileName: '',
          isLocalFile: true, createdAt: new Date().toISOString()
        };
        setResources(prev => [...prev, newResource]);
        if (onAddResource) onAddResource(subject.id, newResource);
        continue;
      }

      try {
        const base64Data = await fileToBase64(file);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

        if (api?.vaultSavePdf) {
          const result = await api.vaultSavePdf({ subjectId: subject.id, fileName: safeName, base64Data });
          if (result.success) {
            const resourceId = `vault_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            const newResource = {
              id: resourceId,
              name: file.name.replace(/\.pdf$/i, ''),
              category: 'attachments',
              filePath: result.filePath,
              fileName: safeName,
              sizeBytes: result.sizeBytes,
              isLocalFile: true,
              createdAt: new Date().toISOString(),
            };
            setResources(prev => [...prev, newResource]);
            const meta = loadMetadata(subject.id);
            meta[safeName] = { id: resourceId, name: newResource.name, createdAt: newResource.createdAt };
            saveMetadata(subject.id, meta);
          }
        }
      } catch (err) {
        console.error('[Vault] Error subiendo PDF:', err);
      }
    }
    setUploading(false);
    setShowUpload(false);
    onVaultChange?.();
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(Array.from(e.dataTransfer.files));
  };

  const handleResourceClick = (resource) => {
    if (resource.category === 'attachments' && resource.filePath) {
      const ext = (resource.fileName || '').split('.').pop().toLowerCase();
      if (ext === 'pdf') {
        setSelectedResource(resource);
        setSplitView(true);
      } else {
        window.mentorAPI?.openFile?.(resource.filePath);
      }
    }
  };

  const handleDeleteResource = async (resource) => {
    if (!resource?.filePath || !subject?.id) return;
    try {
      const api = window.mentorAPI;
      if (api?.vaultDeletePdf) {
        await api.vaultDeletePdf(resource.filePath);
      }
      setResources(prev => prev.filter((r) => r.id !== resource.id));
      const meta = loadMetadata(subject.id);
      delete meta[resource.fileName];
      saveMetadata(subject.id, meta);
      if (selectedResource?.id === resource.id) {
        setSelectedResource(null);
        setSplitView(false);
      }
      onVaultChange?.();
    } catch (err) {
      console.error('[Vault] Error eliminando PDF:', err);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !selectedResource || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    const userMsg = {
      id: `msg-${Date.now()}`, sender: 'user', text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    try {
      console.debug('[DocQA] Enviando:', { promptLength: userMessage.length, pdfTextLength: pdfText.length, mode: chatMode });
      const aiResponse = await askDocumentQA(
        userMessage,
        pdfText,
        selectedResource.name,
        chatMode,
        chatMessages
      );
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now()}`, sender: 'ai', text: aiResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err) {
      console.error('[DocQA] Error en Chat PDF:', err);
      setChatMessages(prev => [...prev, {
        id: `err-${Date.now()}`, sender: 'ai', text: `Error procesando mensaje: ${err.message || 'Error desconocido'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const renderResourceCard = useCallback((resource, index) => {
    const isAttachment = resource.category === 'attachments' && resource.filePath;
    const isLink = resource.category === 'links';
    const isNote = resource.category === 'notes';
    const fileTypeInfo = isAttachment ? getFileTypeInfo(resource.fileName || resource.name) : null;
    return (
      <motion.div key={resource.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        transition={{delay:index*0.05}}
        className="group relative glass-card p-4 hover:shadow-glass-lg transition-all duration-300"
        onClick={() => handleResourceClick(resource)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isAttachment ? `${fileTypeInfo.bgClass} ${fileTypeInfo.colorClass}` : isLink ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {isAttachment && React.createElement(fileTypeInfo.iconComponent, { className: 'w-5 h-5' })}
              {isLink && <Paperclip className="w-5 h-5"/>}
              {isNote && <Edit className="w-5 h-5"/>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{resource.name}</p>
              <p className="text-xs text-text-muted flex items-center gap-1">
                {isAttachment && <span>{fileTypeInfo.label}</span>}
                {isLink && <Paperclip className="w-3 h-3"/>}
                {isNote && <Edit className="w-3 h-3"/>}
                {isAttachment ? fileTypeInfo.label : isLink ? 'Enlace' : 'Nota'}
                {isAttachment && resource.sizeBytes && <span className="text-brand-400"> - {(resource.sizeBytes / 1024).toFixed(0)} KB</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAttachment && (
              <button onClick={(e) => { e.stopPropagation(); setSelectedResource(resource); setSplitView(true); }}
                className="p-2 rounded-lg glass-card hover:bg-surface-200 text-text-muted hover:text-white transition-colors"
                title="Ver PDF y chatear"><FileQuestion className="w-4 h-4"/></button>
            )}
            <button onClick={(e) => {
              e.stopPropagation();
              onEditResource?.(subject.id, resource.id, { name: prompt('Nuevo nombre:', resource.name) });
            }} className="p-2 rounded-lg glass-card hover:bg-surface-200 text-text-muted hover:text-white transition-colors" title="Editar">
              <Edit className="w-4 h-4"/>
            </button>
            <button onClick={(e) => {
              e.stopPropagation();
              if (confirm('Eliminar?')) handleDeleteResource(resource);
            }} className="p-2 rounded-lg glass-card hover:bg-red-500/20 hover:text-red-400 text-text-muted transition-colors" title="Eliminar">
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
        </div>
        {splitView && selectedResource?.id === resource.id && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
            className="mt-3 pt-3 border-t border-glass-border">
            <div className="text-xs text-text-muted flex items-center gap-2">
              <Bot className="w-3 h-3"/>
              <span>Modo chat activado</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }, [handleResourceClick, onEditResource, subject?.id, splitView, selectedResource?.id]);

  const closeSplitView = () => { setSplitView(false); setSelectedResource(null); setPdfBase64(null); setPdfText(''); };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 p-4 glass-card rounded-xl glass-strong">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-700 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">Boveda de Apuntes</h3>
            <p className="text-xs text-text-muted">{resources.length} recursos - {resources.filter(r => r.category === 'attachments').length} PDFs</p>
          </div>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary px-4 py-2 rounded-xl gap-2">
          <Plus className="w-4 h-4"/> Subir PDF
        </button>
      </div>

      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}
            className="mb-4 glass-card p-4 rounded-xl border-2 border-dashed border-brand-500/30">
            <div className="text-center py-4">
              <FileText className="w-12 h-12 text-brand-400/50 mx-auto mb-2"/>
              <p className="text-text-secondary mb-2">Arrastra PDFs aqui o haz clic</p>
              <p className="text-xs text-text-muted">Max. 50MB - Se guardara en disco de forma persistente</p>
              <div className="flex justify-center gap-2 mt-4">
                <input type="file" accept=".pdf" multiple
                  onChange={e => handleFileUpload(Array.from(e.target.files))}
                  className="hidden" id="pdf-upload"/>
                <button onClick={() => document.getElementById('pdf-upload')?.click()} className="btn-primary">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                  {uploading ? ' Subiendo...' : ' Seleccionar'}
                </button>
                <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-glass-bg">
        {resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted glass-card rounded-xl p-8">
            <FileText className="w-16 h-16 mb-4 text-text-muted/30"/>
            <p className="text-lg font-medium text-text-secondary mb-2">Aun no hay apuntes en esta boveda</p>
            <p className="text-sm text-text-muted mb-4">Haz clic en 'Subir PDF' para comenzar.</p>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <Plus className="w-4 h-4"/> Subir primer PDF
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1 custom-scrollbar bg-glass-bg/50">
            {resources.map((r, i) => renderResourceCard(r, i))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {splitView && selectedResource && (
          <motion.div initial={{opacity:0,x:300}} animate={{opacity:1,x:0}} exit={{opacity:0,x:300}}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col text-gray-100">
            <div className="flex-1 flex h-full max-w-5xl mx-auto m-4 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex flex-col h-full flex-1">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900">
                  <div className="flex items-center gap-3">
                    <button onClick={closeSplitView} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-100">
                      <ChevronLeft className="w-5 h-5"/>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{selectedResource.name}</p>
                      <p className="text-xs text-text-muted">PDF - Chat IA</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={closeSplitView} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-100">
                      <X className="w-5 h-5"/>
                    </button>
                  </div>
                </div>
                <div className="flex-1 flex overflow-hidden">
                  <div className="w-1/2 border-r border-gray-700 bg-gray-900 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
                      <h4 className="font-medium text-text-primary">Visualizador</h4>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg glass-card hover:bg-surface-200 disabled:opacity-30">
                          <ChevronLeft className="w-4 h-4"/>
                        </button>
                        <span className="text-sm text-text-muted font-mono">{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="p-1.5 rounded-lg glass-card hover:bg-surface-200 disabled:opacity-30">
                          <ChevronRight className="w-4 h-4"/>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-800">
                      {loadingPdf ? (
                        <div className="text-center text-text-muted p-8">
                          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-400"/>
                          <p className="text-sm">Cargando PDF...</p>
                        </div>
                      ) : pdfError ? (
                        <div className="text-center text-red-400 p-8">
                          <FileQuestion className="w-12 h-12 mx-auto mb-2 text-red-400/50"/>
                          <p>Error cargando PDF</p>
                          <p className="text-xs text-text-muted">{pdfError}</p>
                          <button onClick={() => loadPdfData(selectedResource)} className="mt-2 btn-secondary text-xs">Reintentar</button>
                        </div>
                      ) : pdfBase64 ? (
                        <Document
                          file={pdfDataUrl}
                          onLoadSuccess={(pdf) => setTotalPages(pdf.numPages)}
                          onLoadError={(err) => setPdfError(err.message)}
                          loading={
                            <div className="text-center text-text-muted p-8">
                              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-400"/>
                              <p className="text-sm">Renderizando...</p>
                            </div>
                          }
                        >
                          <Page
                            pageNumber={currentPage}
                            width={520}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="shadow-lg rounded-lg overflow-hidden"
                          />
                        </Document>
                      ) : (
                        <div className="text-center text-text-muted p-8">
                          <FileText className="w-12 h-12 mx-auto mb-2 text-text-muted/30"/>
                          <p className="text-sm">Selecciona un PDF para ver</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-1/2 bg-gray-900 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-brand-400"/>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary text-sm">Mentor IA</p>
                          <p className="text-xs text-text-muted">Contexto: {selectedResource.name}</p>
                        </div>
                      </div>
                      <div className="ml-auto flex items-center gap-1 rounded-lg bg-gray-900 p-1">
                        <button onClick={() => setChatMode('study')} className={`rounded px-2 py-1 text-xs font-medium ${chatMode === 'study' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}>Modo Estudio</button>
                        <button onClick={() => setChatMode('exam')} className={`rounded px-2 py-1 text-xs font-medium ${chatMode === 'exam' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}>Modo Examen</button>
                      </div>
                      <button onClick={() => {
                        setChatMessages([{
                          id: 'welcome', sender: 'ai',
                          text: `He analizado **${selectedResource.name}**. Que te gustaria saber?`,
                          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
                        }]);
                      }} className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-700 text-gray-400 hover:text-white" title="Reiniciar">
                        <RefreshCw className="w-4 h-4"/>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-gray-900 p-4 space-y-4 custom-scrollbar">
                      {chatMessages.map(msg => (
                        <motion.div key={msg.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
                          className={`flex ${msg.sender === 'user' ? 'flex-row-reverse' : ''} gap-3`}>
                          <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-brand-400'}`}>
                            {msg.sender === 'user' ? <User className="w-4 h-4"/> : <Bot className="w-4 h-4"/>}
                          </div>
                          <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-brand-500/30 text-white rounded-tr-none' : 'bg-slate-800/50 border border-glass-border text-text-primary rounded-tl-none whitespace-pre-wrap'}`}>
                            <ReactMarkdown components={{
                              strong: ({children}) => <strong className="font-semibold text-text-primary">{children}</strong>,
                              em: ({children}) => <em className="italic text-text-secondary">{children}</em>,
                              code: ({children}) => <code className="bg-slate-800 px-1.5 py-0.5 rounded text-brand-400 text-xs font-mono">{children}</code>,
                              pre: ({children}) => <pre className="bg-slate-900/50 border border-glass-border rounded-xl p-3 my-2 overflow-x-auto"><code>{children}</code></pre>,
                              ul: ({children}) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                              li: ({children}) => <li className="leading-relaxed">{children}</li>,
                              p: ({children}) => <p className="my-1.5 leading-relaxed">{children}</p>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-brand-500/50 pl-3 my-2 italic text-text-muted">{children}</blockquote>
                            }}>{msg.text}</ReactMarkdown>
                            <div className={`text-[10px] mt-1.5 text-right ${msg.sender === 'user' ? 'text-white/60' : 'text-text-muted'}`}>{msg.timestamp}</div>
                          </div>
                        </motion.div>
                      ))}
                      {chatLoading && (
                        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-slate-800 text-brand-400">
                            <Bot className="w-4 h-4"/>
                          </div>
                          <div className="bg-slate-800/50 border border-glass-border text-text-primary rounded-2xl rounded-tl-none px-4 py-3 shadow-md flex items-center space-x-1.5 w-fit">
                            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{animationDelay:'0ms'}}/>
                            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{animationDelay:'150ms'}}/>
                            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{animationDelay:'300ms'}}/>
                          </div>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef}/>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); handleChatSend(); }}
                      className="p-4 border-t border-gray-700 bg-gray-800 flex items-center gap-2">
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                        placeholder={chatMode === 'exam' ? 'Responde el examen o pide otro test...' : 'Pregunta sobre el PDF...'} className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none" disabled={chatLoading}/>
                      <button type="submit" disabled={!chatInput.trim() || chatLoading} className="btn-primary p-2">
                        <Send className="w-4 h-4"/>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
