import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';

/**
 * COMPONENTE: FileDropZone.jsx
 * Zona interactiva y estilizada de Drag & Drop de archivos (PDF, DOCX, imágenes, etc.)
 * Estilo Notion/Linear con micro-animaciones en bordes y soporte de selección por clic.
 */
export default function FileDropZone({
  onFilesDropped,
  accept = '.pdf,.docx,.doc,.txt,.png,.jpg',
  maxSizeMB = 25,
  multiple = false,
  label = 'Arrastra tus archivos aquí o haz clic para explorar',
  sublabel = 'Formatos soportados: PDF, DOCX, TXT e imágenes (hasta 25MB)',
  className = '',
  compact = false,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [recentSuccess, setRecentSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const processFiles = (fileList) => {
    setError('');
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const validFiles = [];

    for (const file of filesArray) {
      // Validar tamaño
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(`El archivo "${file.name}" supera el límite de ${maxSizeMB}MB.`);
        return;
      }
      validFiles.push(file);
      if (!multiple) break; // Si solo permite uno, tomamos el primero
    }

    if (validFiles.length > 0) {
      setRecentSuccess(true);
      setTimeout(() => setRecentSuccess(false), 2000);
      if (onFilesDropped) {
        onFilesDropped(multiple ? validFiles : validFiles[0]);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer && e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        className={`relative border-2 border-dashed rounded-pm-lg transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center select-none ${
          compact ? 'p-3 py-4' : 'p-6'
        } ${
          isDragOver
            ? 'border-pm-accent bg-pm-accent/10 scale-[1.01] shadow-lg shadow-pm-accent/5'
            : 'border-pm-border hover:border-pm-accent/50 bg-white/[0.06] hover:bg-white/10'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {recentSuccess ? (
          <div className="flex items-center space-x-2 text-pm-green py-1 animate-fadeIn">
            <Check className="w-5 h-5" />
            <span className="text-xs font-semibold">¡Archivo cargado con éxito!</span>
          </div>
        ) : (
          <div className="space-y-1.5 flex flex-col items-center">
            <div
              className={`rounded-full flex items-center justify-center transition-all ${
                compact ? 'w-8 h-8' : 'w-10 h-10'
              } ${
                isDragOver
                  ? 'bg-pm-accent text-white scale-110'
                  : 'bg-pm-surface border border-pm-border text-pm-accent'
              }`}
            >
              <UploadCloud className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </div>

            <div>
              <p className={`font-semibold text-pm-text ${compact ? 'text-[11.5px]' : 'text-xs'}`}>
                {label}
              </p>
              {sublabel && (
                <p className={`text-pm-subtle mt-0.5 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                  {sublabel}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-pm-red bg-pm-red/10 border border-pm-red/20 rounded-pm px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
