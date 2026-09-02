import { FileText, Paperclip } from 'lucide-react';

const FILE_TYPES = {
  pdf:  { label: 'PDF',          iconComponent: Paperclip, colorClass: 'text-red-400',    bgClass: 'bg-red-500/20' },
  docx: { label: 'Word',         iconComponent: FileText,  colorClass: 'text-blue-400',   bgClass: 'bg-blue-500/20' },
  doc:  { label: 'Word',         iconComponent: FileText,  colorClass: 'text-blue-400',   bgClass: 'bg-blue-500/20' },
  pptx: { label: 'PowerPoint',   iconComponent: FileText,  colorClass: 'text-orange-400', bgClass: 'bg-orange-500/20' },
  ppt:  { label: 'PowerPoint',   iconComponent: FileText,  colorClass: 'text-orange-400', bgClass: 'bg-orange-500/20' },
  txt:  { label: 'Texto',        iconComponent: FileText,  colorClass: 'text-zinc-400',   bgClass: 'bg-zinc-500/20' },
};

const DEFAULT_TYPE = { label: 'Archivo', iconComponent: Paperclip, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/20' };

export function getFileTypeInfo(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  return FILE_TYPES[ext] || DEFAULT_TYPE;
}
