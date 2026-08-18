import React, { useState, useEffect } from 'react';
import { X, BookOpen, Sparkles, Plus, Check, Loader2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FileDropZone from './FileDropZone';

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
  const [form, setForm] = useState({
    name: '',
    code: '',
    professor: '',
    nextExam: '',
    maxAbsences: 5,
    classDays: '',
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
      // Reset form para creación
      setForm({
        name: '',
        code: '',
        professor: '',
        nextExam: '',
        maxAbsences: 5,
        classDays: '',
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
      if (window.mentorAPI && window.mentorAPI.parseSyllabusPDF) {
        const result = await window.mentorAPI.parseSyllabusPDF(file.name);
        if (result && result.success) {
          setForm((prev) => ({
            ...prev,
            name: result.data.name,
            code: result.data.code,
            professor: result.data.professor,
            nextExam: result.data.nextExam,
            maxAbsences: result.data.maxAbsences,
            classDays: result.data.classDays,
            rubrics: result.data.rubrics,
          }));
          setPdfUploaded(true);
        }
      } else {
        // Fallback simulado
        setTimeout(() => {
          setForm((prev) => ({
            ...prev,
            name: file.name.replace('.pdf', '').replace(/_/g, ' '),
            code: 'INF-302',
            professor: 'Dr. Alejandro Morales',
            nextExam: '2026-09-20',
            maxAbsences: 4,
            classDays: 'Lunes y Miércoles (10:00 - 12:00)',
            rubrics: [
              { id: 'r1', name: 'Parcial 1', weightPct: 30, currentScore: null, isFinal: false },
              { id: 'r2', name: 'Parcial 2', weightPct: 30, currentScore: null, isFinal: false },
              { id: 'r3', name: 'Tareas y Quizzes', weightPct: 20, currentScore: null, isFinal: false },
              { id: 'r4', name: 'Examen Final', weightPct: 20, currentScore: null, isFinal: true },
            ],
          }));
          setPdfUploaded(true);
          setIsParsingPDF(false);
        }, 1200);
        return;
      }
    } catch (e) {
      console.error(e);
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
            className="w-full max-w-lg bg-pm-surface/95 border border-pm-border rounded-pm-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-pm-border pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-pm bg-pm-accent/15 border border-pm-accent/30 flex items-center justify-center">
              {editingSubject ? (
                <Pencil className="w-4 h-4 text-pm-accent" />
              ) : (
                <BookOpen className="w-4 h-4 text-pm-accent" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-pm-text">
                {editingSubject ? 'Editar Asignatura' : 'Onboarding de Clase'}
              </h3>
              <p className="text-xs text-pm-muted">
                {editingSubject
                  ? 'Modifica los parámetros académicos y ponderaciones de la materia'
                  : 'Registra tu materia o sube el sílabo en PDF'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-pm text-pm-subtle hover:text-pm-text hover:bg-pm-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ZONA DE ARRASTRE DE SÍLABO PDF (Solo en creación o actualización voluntaria) */}
        {!editingSubject && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-pm-muted">
              Importación Inteligente de Sílabo (PDF)
            </label>

            {isParsingPDF ? (
              <div className="border border-pm-border rounded-pm p-4 text-center bg-pm-card flex items-center justify-center gap-2 text-pm-accent text-xs font-medium">
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
          <p className="text-xs text-pm-red bg-pm-red/10 border border-pm-red/20 rounded-pm px-3 py-2">
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
              <label className="block text-xs font-medium text-pm-muted mb-1">
                Límite de Faltas Permitidas
              </label>
              <input
                type="number"
                min="1"
                max="20"
                name="maxAbsences"
                value={form.maxAbsences}
                onChange={handleChange}
                className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-pm-accent transition-colors"
              />
            </div>
          </div>

          <InputField
            label="Días y Horarios de Clase"
            name="classDays"
            placeholder="ej. Lunes y Miércoles (10:00 - 12:00)"
            value={form.classDays}
            onChange={handleChange}
          />

          {/* RESUMEN DE PONDERACIÓN */}
          <div className="bg-pm-card border border-pm-border rounded-pm p-3 space-y-1 text-xs">
            <span className="text-pm-muted font-medium block">Ponderación del ciclo escolar:</span>
            <div className="grid grid-cols-2 gap-1 text-pm-subtle">
              {form.rubrics.map((r) => (
                <span key={r.id}>
                  • {r.name}: <strong>{r.weightPct}%</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2 border-t border-pm-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-pm text-sm text-pm-muted hover:text-pm-text hover:bg-pm-hover transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
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
      <label className="block text-xs font-medium text-pm-muted mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-sm text-pm-text placeholder-pm-subtle focus:outline-none focus:border-pm-accent transition-colors"
      />
    </div>
  );
}
