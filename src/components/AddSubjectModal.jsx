import React, { useState, useEffect } from 'react';
import { X, BookOpen, Plus, Check, Loader2, Pencil, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FileDropZone from './FileDropZone';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function DaySelector({ selectedDays, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-muted flex items-center gap-1.5">
        <CalendarDays className="w-3 h-3" /> Días de Clase
      </label>
      <div className="flex flex-wrap gap-1.5">
        {DIAS_SEMANA.map((dia) => {
          const active = selectedDays.includes(dia);
          return (
            <button
              key={dia}
              type="button"
              onClick={() => {
                if (active) {
                  onChange(selectedDays.filter((d) => d !== dia));
                } else {
                  onChange([...selectedDays, dia]);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium border transition-all duration-150 ${
                active
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {dia.substring(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * COMPONENTE: AddSubjectModal.jsx — Creación y Edición de Asignatura con Lector de Sílabos PDF.
 * 
 * Props:
 *   isOpen         - boolean
 *   onClose        - function
 *   onAddSubject   - function(subjectData)
 *   editingSubject - object | null (si está presente, el modal funciona en modo EDICIÓN)
 *   onEditSubject  - function(subjectId, updatedData)
 */
export default function AddSubjectModal({
  isOpen,
  onClose,
  onAddSubject,
  editingSubject = null,
  onEditSubject,
}) {
  const [isParsingPDF, setIsParsingPDF] = useState(false);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    professor: '',
    nextExam: '',
    maxAbsences: 5,
    classDays: '',
    classTimeStart: '',
    classTimeEnd: '',
    dias_clase: [],
    targetGrade: 85,
    rubrics: [
      { id: 'r1', name: 'Primer Parcial', weightPct: 30, currentScore: null, isFinal: false },
      { id: 'r2', name: 'Segundo Parcial', weightPct: 30, currentScore: null, isFinal: false },
      { id: 'r3', name: 'Tareas y Trabajos', weightPct: 20, currentScore: null, isFinal: false },
      { id: 'r4', name: 'Examen Final', weightPct: 20, currentScore: null, isFinal: true },
    ],
  });
  const [error, setError] = useState('');

  // Efecto para pre-llenar datos si estamos en modo edición
  useEffect(() => {
    if (editingSubject) {
      setForm({
        name: editingSubject.name || '',
        code: editingSubject.code || '',
        professor: editingSubject.professor || '',
        nextExam: editingSubject.nextExam !== 'Sin fecha definida' ? editingSubject.nextExam || '' : '',
        maxAbsences: editingSubject.maxAbsences || 5,
        classDays: editingSubject.classDays !== 'Sin horario registrado' ? editingSubject.classDays || '' : '',
        classTimeStart: /^(\d{2}:\d{2})/.test(editingSubject.classDays?.split(' - ')[0]) ? editingSubject.classDays.split(' - ')[0] : '',
        classTimeEnd: /^(\d{2}:\d{2})/.test(editingSubject.classDays?.split(' - ')[1]) ? editingSubject.classDays.split(' - ')[1] : '',
        dias_clase: editingSubject.dias_clase || [],
        targetGrade: editingSubject.targetGrade || 85,
        rubrics: editingSubject.rubrics || [
          { id: 'r1', name: 'Primer Parcial', weightPct: 30, currentScore: null, isFinal: false },
          { id: 'r2', name: 'Segundo Parcial', weightPct: 30, currentScore: null, isFinal: false },
          { id: 'r3', name: 'Tareas y Trabajos', weightPct: 20, currentScore: null, isFinal: false },
          { id: 'r4', name: 'Examen Final', weightPct: 20, currentScore: null, isFinal: true },
        ],
      });
      setPdfUploaded(false);
    } else {
      setForm({
        name: '',
        code: '',
        professor: '',
        nextExam: '',
        maxAbsences: 5,
        classDays: '',
        classTimeStart: '',
        classTimeEnd: '',
        dias_clase: [],
        targetGrade: 85,
        rubrics: [
          { id: 'r1', name: 'Primer Parcial', weightPct: 30, currentScore: null, isFinal: false },
          { id: 'r2', name: 'Segundo Parcial', weightPct: 30, currentScore: null, isFinal: false },
          { id: 'r3', name: 'Tareas y Trabajos', weightPct: 20, currentScore: null, isFinal: false },
          { id: 'r4', name: 'Examen Final', weightPct: 20, currentScore: null, isFinal: true },
        ],
      });
      setPdfUploaded(false);
    }
    setError('');
  }, [editingSubject, isOpen]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Manejo de archivo PDF del sílabo mediante Drag & Drop
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsParsingPDF(true);

    try {
      // Guardar el archivo como base64 para guardarlo en la Bóveda después
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      setSyllabusFile({ fileName: file.name, base64Data });

      const ext = (file.name || '').split('.').pop().toLowerCase();
      if (ext === 'pdf' && window.mentorAPI && window.mentorAPI.parseSyllabusPDF) {
        const result = await window.mentorAPI.parseSyllabusPDF(file.name);
        if (result && result.success && !result.isNonPdf) {
          setForm((prev) => ({
            ...prev,
            name: result.data.name || prev.name,
            code: result.data.code || prev.code,
            professor: result.data.professor || prev.professor,
            nextExam: result.data.nextExam || prev.nextExam,
            maxAbsences: result.data.maxAbsences || prev.maxAbsences,
            classDays: result.data.classDays || prev.classDays,
            rubrics: result.data.rubrics?.length ? result.data.rubrics : prev.rubrics,
          }));
          setPdfUploaded(true);
        } else if (result && result.isNonPdf) {
          setPdfUploaded(true);
        } else {
          setError(result?.error || 'No se pudo extraer información del PDF. Verifica que el archivo no esté vacío o escaneado (imagen).');
        }
      } else if (ext !== 'pdf') {
        // Archivos .docx/.pptx/etc — se guardan directo sin parseo
        setPdfUploaded(true);
      } else {
        setError('La lectura de sílabos PDF requiere la app de escritorio Electron. Ejecuta: npm run electron:start');
      }
    } catch (e) {
      console.error('Error parseando sílabo:', e);
      setError('Error al procesar el archivo: ' + (e.message || 'Error desconocido'));
    } finally {
      setIsParsingPDF(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.professor) {
      setError('El nombre de la clase y el profesor son obligatorios.');
      return;
    }

    const subjectData = {
      name: form.name,
      code: form.code || form.name.substring(0, 3).toUpperCase() + '-101',
      professor: form.professor,
      nextExam: form.nextExam || 'Sin fecha definida',
      daysToExam: form.nextExam
        ? Math.max(1, Math.ceil((new Date(form.nextExam) - new Date()) / (1000 * 60 * 60 * 24)))
        : 30,
      maxAbsences: Number(form.maxAbsences) || 5,
      classDays: form.classDays || 'Sin horario registrado',
      dias_clase: form.dias_clase,
      targetGrade: Number(form.targetGrade) || 85,
      rubrics: form.rubrics,
    };

    if (editingSubject && onEditSubject) {
      onEditSubject(editingSubject.id, subjectData);
    } else if (onAddSubject) {
      onAddSubject({
        ...subjectData,
        currentAbsences: 0,
        resources: [],
        pendingSyllabus: syllabusFile || null,
      });
    }

    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-lg bg-zinc-900/95 border border-zinc-700/50 rounded-glass-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-zinc-700/50 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-glass bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
              {editingSubject ? (
                <Pencil className="w-4 h-4 text-brand-400" />
              ) : (
                <BookOpen className="w-4 h-4 text-brand-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {editingSubject ? 'Editar Asignatura' : 'Onboarding de Clase'}
              </h3>
              <p className="text-xs text-text-muted">
                {editingSubject
                  ? 'Modifica los parámetros académicos y ponderaciones de la materia'
                  : 'Registra tu materia o sube el sílabo en PDF'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-glass text-text-subtle hover:text-text-primary hover:bg-glass-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ZONA DE ARRASTRE DE SÍLABO PDF (Solo en creación o actualización voluntaria) */}
        {!editingSubject && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-muted">
              Importación Inteligente de Sílabo (PDF)
            </label>

            {isParsingPDF ? (
              <div className="border border-zinc-700/50 rounded-glass p-4 text-center bg-zinc-800 flex items-center justify-center gap-2 text-brand-400 text-xs font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extrayendo reglas, ponderaciones y fechas del PDF...</span>
              </div>
            ) : (
              <FileDropZone
                accept=".pdf"
                maxSizeMB={20}
                compact={true}
                label="Arrastra el Sílabo de la clase (PDF) para auto-completar"
                sublabel="El Mentor extraerá ponderaciones y datos del docente automáticamente"
                onFilesDropped={handleFileUpload}
              />
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-glass px-3 py-2">
            {error}
          </p>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <InputField
            label="Nombre de la clase *"
            name="name"
            placeholder="ej. Estructura de Datos"
            value={form.name}
            onChange={handleChange}
          />

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Código / Sigla"
              name="code"
              placeholder="ej. INF-302"
              value={form.code}
              onChange={handleChange}
            />
            <InputField
              label="Profesor(a) *"
              name="professor"
              placeholder="ej. Dr. Morales"
              value={form.professor}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Fecha de Próximo Parcial"
              name="nextExam"
              type="date"
              value={form.nextExam}
              onChange={handleChange}
            />

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Límite de Faltas Permitidas
              </label>
              <input
                type="number"
                min="1"
                max="20"
                name="maxAbsences"
                value={form.maxAbsences}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          <DaySelector
            selectedDays={form.dias_clase}
            onChange={(days) => setForm({ ...form, dias_clase: days })}
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted">Horario de Clase</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={form.classTimeStart || ''}
                onChange={(e) => {
                  const start = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    classTimeStart: start,
                    classDays: start && prev.classTimeEnd ? `${start} - ${prev.classTimeEnd}` : start || '',
                  }));
                }}
                className="flex-1 px-3 py-2 rounded-glass bg-zinc-900 border border-zinc-700/50 text-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50 [color-scheme:dark]"
              />
              <span className="text-text-muted text-xs">a</span>
              <input
                type="time"
                value={form.classTimeEnd || ''}
                onChange={(e) => {
                  const end = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    classTimeEnd: end,
                    classDays: prev.classTimeStart && end ? `${prev.classTimeStart} - ${end}` : '',
                  }));
                }}
                className="flex-1 px-3 py-2 rounded-glass bg-zinc-900 border border-zinc-700/50 text-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* RESUMEN DE PONDERACIÓN */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-glass p-3 space-y-1 text-xs">
            <span className="text-text-muted font-medium block">Ponderación del ciclo escolar:</span>
            <div className="grid grid-cols-2 gap-1 text-text-subtle">
              {form.rubrics.map((r) => (
                <span key={r.id}>
                  • {r.name}: <strong>{r.weightPct}%</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-glass text-sm text-text-muted hover:text-text-primary hover:bg-glass-bg-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {editingSubject ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Guardar Cambios
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Guardar Asignatura
                </>
              )}
            </button>
          </div>
        </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function InputField({ label, name, type = 'text', placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-glass px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
      />
    </div>
  );
}
