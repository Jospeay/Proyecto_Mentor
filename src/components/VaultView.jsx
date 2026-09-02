import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Folder, FileText, LockKeyhole, Upload, Plus, Trash2, Send,
  Bot, ChevronLeft, ChevronRight, X, RefreshCw, Eye,
  BookOpen, FileCheck, Loader2, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { queryMentorAI, askDocumentQA } from '../services/aiService';
import { getFileTypeInfo } from '../utils/fileTypeUtils';

/**
 * VaultView — Bóveda de materiales por materia.
 *
 * Permite al estudiante subir, ver y eliminar recursos (PDF, Word, PowerPoint)
 * guardados en disco (carpeta vault del proceso principal de Electron), y hacer
 * preguntas sobre el texto extraído de cada documento mediante el chat IA.
 *
 * Flujo de renderizado según el tipo de archivo:
 *  - PDF  -> base64 → react-pdf (visor paginado).
 *  - DOCX -> mammoth convierte a HTML en el main process → renderizado inline.
 *  - PPTX -> se convierte a PDF con LibreOffice en el main process; si falta
 *            LibreOffice, se abre con la app del sistema (fallbackToSystem).
 *
 * La metadata extra (nombre amigable, fecha) vive en localStorage
 * ('mentor_vault_metadata'), mientras que el binario vive en disco.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const METADATA_KEY = 'mentor_vault_metadata';

// Lee la metadata (nombre amigable + fecha) de los recursos de una materia
// desde localStorage. Nunca guarda contenido binario aquí — solo etiquetas.
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

// Convierte un File del navegador a base64 (sin el prefijo data:).
// Es el formato en que el main process espera recibir el contenido del archivo.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VaultView({ subjects = [] }) {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [resources, setResources] = useState({});
  const [selectedResource, setSelectedResource] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfError, setPdfError] = useState(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [docxHtml, setDocxHtml] = useState('');
  const [docxText, setDocxText] = useState('');
  const [fileType, setFileType] = useState('pdf');
  const [pageDimensions, setPageDimensions] = useState(null);

  const isPptx = fileType === 'pptx' || fileType === 'ppt' || fileType === 'pptx_converted';

  const isLandscape = useMemo(() => {
    if (!pageDimensions) return false;
    return pageDimensions.width > pageDimensions.height;
  }, [pageDimensions]);

  useEffect(() => {
    const el = viewerContainerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 32;
      if (w > 0) setViewerWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedResource?.id]);

  const pdfDataUrl = useMemo(() => {
    if (!pdfBase64) return null;
    return `data:application/pdf;base64,${pdfBase64}`;
  }, [pdfBase64]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMode, setChatMode] = useState('study');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const viewerContainerRef = useRef(null);
  const [viewerWidth, setViewerWidth] = useState(520);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Carga la lista de archivos de una materia desde el disco (vía IPC vault:get-pdfs),
  // los envuelve en objetos de recurso y sincroniza su metadata en localStorage.
  const loadResourcesFromDisk = useCallback(async (subjectId) => {
    try {
      const api = window.mentorAPI;
      if (!api?.vaultGetPdfs) return;
      const result = await api.vaultGetPdfs(subjectId);
      if (!result.success) return;

      const meta = loadMetadata(subjectId);
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

      setResources(prev => ({ ...prev, [subjectId]: diskResources }));

      const updatedMeta = {};
      diskResources.forEach((r) => { updatedMeta[r.fileName] = { id: r.id, name: r.name, createdAt: r.createdAt }; });
      saveMetadata(subjectId, updatedMeta);
    } catch (err) {
      console.error('[VaultView] Error loading PDFs:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedSubject?.id) {
      subjects.forEach((s) => { loadResourcesFromDisk(s.id); });
      return;
    }
    loadResourcesFromDisk(selectedSubject.id);
    setSelectedResource(null);
    setPdfBase64(null);
    setChatMessages([]);
  }, [selectedSubject?.id, subjects, loadResourcesFromDisk]);

  useEffect(() => {
    if (selectedResource) {
      const ext = (selectedResource.fileName || '').split('.').pop().toLowerCase();
      setFileType(ext);
      setChatMessages([{
        id: 'welcome', sender: 'ai',
        text: `He analizado **${selectedResource.name}**. Que te gustaria saber?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setCurrentPage(1);
      setTotalPages(0);
      setPdfError(null);
      setPdfBase64(null);
      setDocxHtml('');
      setDocxText('');
      loadFileData(selectedResource, ext);
    } else {
      setPdfBase64(null);
      setDocxHtml('');
      setDocxText('');
    }
  }, [selectedResource?.id]);

  // Dado un recurso y su extensión, obtiene el contenido desde el proceso principal:
  //  - docx/doc → convierte a HTML (mammoth) para renderizado y a texto para el chat.
  //  - pptx/ppt → convierte a PDF con LibreOffice; lee el texto del PDF resultante.
  //  - pdf      → lee el base64 para el visor react-pdf y extrae el texto para el chat.
  const loadFileData = async (resource, ext) => {
    if (!resource?.filePath) return;
    setLoadingPdf(true);
    setPdfError(null);
    setPdfText('');
    try {
      const api = window.mentorAPI;

      if (ext === 'docx' || ext === 'doc') {
        if (!api?.docxToHtml) { setPdfError('IPC docx no disponible'); setLoadingPdf(false); return; }
        const result = await api.docxToHtml(resource.filePath);
        if (result.success) {
          setDocxHtml(result.html || '');
          setDocxText(result.text || '');
        } else {
          setPdfError(result.error || 'Error convirtiendo DOCX');
        }
      } else if (ext === 'pptx' || ext === 'ppt') {
        if (!api?.pptxToPdf) { setPdfError('IPC pptx no disponible'); setLoadingPdf(false); return; }
        const result = await api.pptxToPdf(resource.filePath);
        if (result.success && result.pdfBase64) {
          setPdfBase64(result.pdfBase64);
          setFileType('pptx_converted');
          if (api?.pdfExtractText && result.pdfPath) {
            try {
              const textResult = await api.pdfExtractText(result.pdfPath);
              if (textResult.success) setPdfText(textResult.text || '');
            } catch {}
          }
        } else if (result.fallbackToSystem) {
          api.openFile?.(resource.filePath);
          setPdfError('LibreOffice no instalado — abriendo con tu aplicación de PowerPoint');
        } else {
          setPdfError(result.error || 'Error convirtiendo PPTX');
        }
      } else {
        // PDF path (original behavior)
        if (!api?.vaultGetPdfData) { setPdfError('IPC no disponible'); setLoadingPdf(false); return; }
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
      }
    } catch (err) {
      setPdfError(err.message);
    }
    setLoadingPdf(false);
  };

  // Sube una lista de archivos (de un input o drag & drop) a la bóveda de la
  // materia. Filtra por extensiones soportadas, guarda en disco vía IPC y
  // registra el recurso + su metadata en el estado y localStorage.
  const handleFileUpload = useCallback(async (subjectId, files) => {
    if (!files.length) return;
    setUploading(true);
    const api = window.mentorAPI;

    for (const file of files) {
      const ext = (file.name || '').split('.').pop().toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx' && ext !== 'doc' && ext !== 'pptx' && ext !== 'ppt') continue;
      try {
        const base64Data = await fileToBase64(file);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

        if (api?.vaultSavePdf) {
          const result = await api.vaultSavePdf({ subjectId, fileName: safeName, base64Data });
          if (result.success) {
            const resourceId = `vault_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            const newResource = {
              id: resourceId,
              name: file.name.replace(/\.[^.]+$/i, ''),
              category: 'attachments',
              filePath: result.filePath,
              fileName: safeName,
              sizeBytes: result.sizeBytes,
              isLocalFile: true,
              createdAt: new Date().toISOString(),
            };
            setResources(prev => ({
              ...prev,
              [subjectId]: [...(prev[subjectId] || []), newResource]
            }));
            const meta = loadMetadata(subjectId);
            meta[safeName] = { id: resourceId, name: newResource.name, createdAt: newResource.createdAt };
            saveMetadata(subjectId, meta);
          }
        }
      } catch (err) {
        console.error('[VaultView] Error subiendo PDF:', err);
      }
    }
    setUploading(false);
  }, []);

  // Elimina un recurso del disco (vía IPC vault:delete-pdf) y lo quita del
  // estado + metadata local, cerrando el visor si es el recurso seleccionado.
  const handleDeleteResource = useCallback(async (resource) => {
    if (!resource?.filePath || !selectedSubject?.id) return;
    try {
      const api = window.mentorAPI;
      if (api?.vaultDeletePdf) await api.vaultDeletePdf(resource.filePath);
      setResources(prev => ({
        ...prev,
        [selectedSubject.id]: (prev[selectedSubject.id] || []).filter((r) => r.id !== resource.id)
      }));
      const meta = loadMetadata(selectedSubject.id);
      delete meta[resource.fileName];
      saveMetadata(selectedSubject.id, meta);
      if (selectedResource?.id === resource.id) {
        setSelectedResource(null);
        setPdfBase64(null);
      }
    } catch (err) {
      console.error('[VaultView] Error eliminando PDF:', err);
    }
  }, [selectedSubject?.id, selectedResource?.id]);

  // Envía la pregunta del usuario al chat IA sobre el documento abierto.
  // Usa el texto extraído (docxText para Word, pdfText para PDF/PPTX) como
  // contexto; mantiene el historial de chat para conversaciones con memoria.
  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || !selectedResource || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    setChatMessages(prev => [...prev, {
      id: `msg-${Date.now()}`, sender: 'user', text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    try {
      const documentText = (fileType === 'docx' || fileType === 'doc') ? docxText : pdfText;
      console.debug('[DocQA] Enviando:', { promptLength: userMessage.length, pdfTextLength: documentText.length, mode: chatMode });
      const aiResponse = await askDocumentQA(
        userMessage,
        documentText,
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
  }, [chatInput, selectedResource, chatLoading, chatMode, selectedSubject, chatMessages, pdfText, docxText, fileType]);

  const closeViewer = useCallback(() => {
    setSelectedResource(null);
    setChatMessages([]);
    setPdfBase64(null);
    setPdfText('');
    setPdfError(null);
    setCurrentPage(1);
    setTotalPages(0);
    setDocxHtml('');
    setDocxText('');
    setFileType('pdf');
    setPageDimensions(null);
  }, []);

  const subjectResources = selectedSubject ? (resources[selectedSubject.id] || []) : [];

  if (!selectedSubject) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-gray-100">
        <div className="mb-6 flex items-start justify-between border-b border-zinc-700 pb-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <LockKeyhole className="h-5 w-5 text-emerald-400" /> La Boveda
            </h2>
            <p className="mt-1 text-xs text-text-subtle">Selecciona una asignatura para estudiar con IA.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(subjects.length ? subjects : []).map((subject) => (
            <section
              key={subject.id}
              onClick={() => setSelectedSubject(subject)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 cursor-pointer hover:border-brand-500/50 hover:bg-zinc-800 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Folder className="h-9 w-9 text-amber-400" />
                <div>
                  <p className="font-semibold text-zinc-200">{subject.name}</p>
                  <p className="text-xs text-zinc-500">{subject.code || 'Sin codigo'}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800 text-sm text-zinc-500">
                <p className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> {(resources[subject.id] || []).length} archivos
                </p>
              </div>
            </section>
          ))}
          {subjects.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-500">
              <Folder className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p>No hay asignaturas. Agrega materias primero.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedSubject(null); closeViewer(); }}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="font-semibold text-zinc-100">{selectedSubject.name}</h3>
            <p className="text-xs text-zinc-400">{subjectResources.length} PDFs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-600/90 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {uploading ? 'Subiendo...' : 'Subir PDF'}
            <input
              type="file" accept=".pdf" multiple
              onChange={(e) => handleFileUpload(selectedSubject.id, Array.from(e.target.files))}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <AnimatePresence>
        {selectedResource ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex overflow-hidden min-h-0">
            <div className={`${isPptx ? 'flex-[3]' : 'w-1/2'} border-r border-zinc-700 bg-zinc-900 flex flex-col overflow-hidden`}>
              <div className="p-3 border-b border-zinc-700 bg-zinc-800 flex items-center justify-between">
                <h4 className="font-medium text-zinc-200 text-sm truncate">{selectedResource.name}</h4>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setPageDimensions(null); }} disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-200">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-zinc-400 font-mono">{currentPage} / {totalPages || '?'}</span>
                  <button onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setPageDimensions(null); }} disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-200">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={closeViewer} className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div ref={viewerContainerRef} className="flex-1 overflow-auto p-4 flex items-start justify-center bg-zinc-800">
                {loadingPdf ? (
                  <div className="text-center text-zinc-400 p-8">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-400"/>
                    <p className="text-sm">{fileType === 'pptx' || fileType === 'ppt' ? 'Convirtiendo PPTX a PDF...' : 'Cargando archivo...'}</p>
                  </div>
                ) : pdfError ? (
                  <div className="text-center text-red-400 p-8">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-red-400/50" />
                    <p>{pdfError.includes('LibreOffice') ? pdfError : 'Error cargando archivo'}</p>
                    <p className="text-xs text-zinc-500">{pdfError}</p>
                    {!pdfError.includes('LibreOffice') && (
                      <button onClick={() => loadFileData(selectedResource, fileType)} className="mt-2 px-3 py-1 rounded bg-zinc-700 text-xs text-zinc-200">Reintentar</button>
                    )}
                  </div>
                ) : (fileType === 'docx' || fileType === 'doc') && docxHtml ? (
                  <div className="w-full max-w-2xl prose prose-invert prose-sm prose-zinc
                    prose-headings:text-zinc-200 prose-p:text-zinc-300 prose-li:text-zinc-300
                    prose-strong:text-zinc-200 prose-a:text-brand-400
                    prose-table:border-collapse prose-th:border prose-th:border-zinc-600 prose-th:p-2 prose-th:text-zinc-300
                    prose-td:border prose-td:border-zinc-600 prose-td:p-2 prose-td:text-zinc-400
                    prose-img:max-w-full"
                    dangerouslySetInnerHTML={{ __html: docxHtml }}
                  />
                ) : pdfBase64 ? (
                  <Document
                    file={pdfDataUrl}
                    onLoadSuccess={(pdf) => setTotalPages(pdf.numPages)}
                    onLoadError={(err) => setPdfError(err.message)}
                    loading={
                      <div className="text-center text-zinc-400 p-8">
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-400"/>
                        <p className="text-sm">Renderizando...</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={currentPage}
                      width={isLandscape ? viewerWidth : Math.min(520, viewerWidth)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow-lg rounded-lg overflow-hidden"
                      onLoadSuccess={({ width, height }) => setPageDimensions({ width, height })}
                    />
                  </Document>
                ) : (
                  <div className="text-center text-zinc-500 p-8">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-zinc-600/50" />
                    <p>Selecciona un archivo para ver</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`${isPptx ? 'flex-[1]' : 'w-1/2'} bg-zinc-900 flex flex-col overflow-hidden min-w-[280px]`}>
              <div className="p-3 border-b border-zinc-700 bg-zinc-800 flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-200 text-sm">Mentor IA</p>
                  <p className="text-xs text-zinc-400 truncate">{selectedResource.name}</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1">
                  <button
                    onClick={() => setChatMode('study')}
                    className={`rounded px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
                      chatMode === 'study' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" /> Estudio
                  </button>
                  <button
                    onClick={() => setChatMode('exam')}
                    className={`rounded px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
                      chatMode === 'exam' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <FileCheck className="w-3 h-3" /> Examen
                  </button>
                </div>
                <button
                  onClick={() => setChatMessages([{
                    id: 'welcome', sender: 'ai',
                    text: `He analizado **${selectedResource.name}**. Que te gustaria saber?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }])}
                  className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-400 hover:text-white"
                  title="Reiniciar chat"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-900 p-4 space-y-4">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'flex-row-reverse' : ''} gap-3`}>
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-brand-500/20 text-brand-400' : 'bg-zinc-800 text-brand-400 border border-zinc-700'}`}>
                      {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-brand-600/30 text-white rounded-tr-none' : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-none whitespace-pre-wrap'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
                          code: ({ children }) => <code className="bg-zinc-700/50 text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                          pre: ({ children }) => <pre className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-3 my-2 overflow-x-auto"><code>{children}</code></pre>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                      <div className={`text-[10px] mt-1.5 text-right ${msg.sender === 'user' ? 'text-white/60' : 'text-zinc-500'}`}>{msg.timestamp}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-zinc-800 text-brand-400 border border-zinc-700">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-2xl rounded-tl-none px-4 py-3 flex items-center space-x-1.5 w-fit">
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); handleChatSend(); }}
                className="p-3 border-t border-zinc-700 bg-zinc-800 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={chatMode === 'exam' ? 'Responde el examen o pide otro test...' : 'Pregunta sobre el PDF...'}
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none"
                  disabled={chatLoading}
                />
                <button type="submit" disabled={!chatInput.trim() || chatLoading}
                  className="p-2 rounded-lg bg-brand-600 hover:bg-brand-600/90 text-white disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-zinc-900 p-4">
            {uploading && (
              <div className="mb-4 p-3 rounded-lg bg-brand-600/10 border border-brand-500/30 text-sm text-brand-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Subiendo PDFs...
              </div>
            )}
            {subjectResources.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
                <FileText className="w-16 h-16 mb-4 text-zinc-600/50" />
                <p className="text-lg font-medium text-zinc-400 mb-2">Sin PDFs aun</p>
                <p className="text-sm text-zinc-500 mb-4">Sube PDFs para estudiar con IA</p>
                <label className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-600/90 text-white text-sm font-medium flex items-center gap-2 cursor-pointer">
                  <Plus className="w-4 h-4" /> Subir primer PDF
                  <input
                    type="file" accept=".pdf" multiple
                    onChange={(e) => handleFileUpload(selectedSubject.id, Array.from(e.target.files))}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectResources.map((resource) => (
                  <div key={resource.id} className="group relative rounded-xl border border-zinc-700 bg-zinc-800 p-4 cursor-pointer hover:border-brand-500/50 hover:bg-zinc-700 transition-all duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setSelectedResource(resource)}>
                        <div className={`w-10 h-10 rounded-xl ${getFileTypeInfo(resource.fileName).bgClass} ${getFileTypeInfo(resource.fileName).colorClass} flex items-center justify-center shrink-0`}>
                          {React.createElement(getFileTypeInfo(resource.fileName).iconComponent, { className: 'w-5 h-5' })}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">{resource.name}</p>
                          <p className="text-xs text-zinc-500">{getFileTypeInfo(resource.fileName).label}{resource.sizeBytes ? ` - ${(resource.sizeBytes / 1024).toFixed(0)} KB` : ''}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm('Eliminar?')) handleDeleteResource(resource); }}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 hover:bg-zinc-700"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
