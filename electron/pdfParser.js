/**
 * ==============================================================================
 * MENTOR - PARSER REAL DE SÍLABOS PDF (pdfParser.js)
 * ==============================================================================
 *
 * Extrae texto real de archivos PDF de sílabos universitarios usando pdf-parse.
 * Analiza el texto extraído con expresiones regulares para detectar:
 *   - Nombre de la asignatura
 *   - Código / Sigla
 *   - Nombre del profesor
 *   - Fecha de próximo examen / parcial
 *   - Límite de inasistencias
 *   - Días y horarios de clase
 *   - Ponderaciones / rubros de evaluación
 *
 * REGLA: Los selectores de extracción regex están definidos como constantes
 * para que el usuario pueda ajustarlos si su sílabo tiene un formato diferente.
 * ==============================================================================
 */

let pdfParse;
try {
  pdfParse = require('pdf-parse').default || require('pdf-parse');
} catch {
  pdfParse = null;
}

// ===========================================================================
// SELECTORES DE EXTRACCIÓN — INSPECCIONA TU FORMATO DE SÍLABO Y AJUSTA
// Cada constante es un patrón regex para capturar datos del PDF.
// Si tu universidad usa otro formato, modifica estos patrones.
// ===========================================================================

// Ejemplo: "Código: INF-302" o "Sigla: INF-302" o "Course Code: INF-302"
const CODE_PATTERN = /(?:código|sigla|code|cod\.?)[\s:]+([A-Z]{2,5}[\s.-]?\d{2,4})/i;

// Ejemplo: "Profesor: Dr. Juan Pérez" o "Docente: Lic. María García"
const PROFESSOR_PATTERN = /(?:profesor|docente|teacher|catedr[aá]tico|imparte)[\s:]+((?:Dr\.?|Lic\.?|Ing\.?|MSc\.?|PhD\.?)?\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/i;

// Ejemplo: "Examen Parcial: 2026-09-15" o "Fecha de examen: 15 de septiembre"
const EXAM_DATE_PATTERN = /(?:examen|parcial|evaluación|prueba|midterm|final exam|exam date)[\s:]*(\d{1,2}[\s/-]\d{1,2}[\s/-]\d{2,4}|\d{4}[\s/-]\d{1,2}[\s/-]\d{1,2}|\d{1,2}\s+de\s+\w+\s+(?:de\s+)?\d{4})/i;

// Ejemplo: "Máximo 4 faltas" o "Faltas permitidas: 5"
const ABSENCES_PATTERN = /(?:máxim[oa]?\s+(?:de\s+)?faltas|faltas?\s+permitidas|max\s+absences?|inasistencias?\s+permitidas?)[\s:]*(\d{1,2})/i;

// Ejemplo: "Lunes y Miércoles 10:00-12:00" o "Martes y Jueves de 8:00 a 10:30"
const CLASS_DAYS_PATTERN = /((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|y|and|,)\s*(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)[\s:]*(?:de\s+)?(\d{1,2}:\d{2})\s*[-–a]+\s*(\d{1,2}:\d{2})/i;

// Ejemplo: "Parcial 1: 25%" o "Examen Final: 30%"
const RUBRIC_PATTERN = /((?:parcial|examen|tarea|proyecto|laboratorio|foro|quiz|trabajo|participaci[oó]n|asistencia|final|midterm|assignment|project|homework|lab|forum)[\s\w]{0,30}?)\s*[:]\s*(\d{1,2})\s*%/gi;

// Ejemplo: "Nombre de la materia: Estructura de Datos" o "Asignatura: Redes"
const SUBJECT_NAME_PATTERN = /(?:asignatura|materia|curso|nombre\s+de\s+(?:la\s+)?(?:clase|materia|asignatura|curso)|subject|course\s+name)[\s:]+(.+?)(?:\n|$)/i;

/**
 * Extrae texto de un archivo PDF y analiza su contenido para obtener datos del sílabo.
 *
 * @param {Buffer} pdfBuffer - Contenido del archivo PDF como Buffer.
 * @returns {Promise<Object>} Datos extraídos del sílabo o estructura por defecto.
 */
async function extractSyllabusData(pdfBuffer) {
  if (!pdfParse) {
    throw new Error('PDF_PARSE_UNAVAILABLE: La librería pdf-parse no está instalada. Ejecuta: npm install pdf-parse');
  }

  const data = await pdfParse(pdfBuffer);
  const text = data.text || '';

  if (!text.trim()) {
    throw new Error('El PDF no contiene texto legible. Puede ser un PDF escaneado (imagen).');
  }

  // Extraer cada campo usando los patrones regex definidos arriba
  const code = extractField(text, CODE_PATTERN);
  const professor = extractField(text, PROFESSOR_PATTERN);
  const nextExam = extractDate(text, EXAM_DATE_PATTERN);
  const maxAbsences = extractNumber(text, ABSENCES_PATTERN) || 5;
  const classDays = extractClassSchedule(text);
  const name = extractField(text, SUBJECT_NAME_PATTERN) || '';
  const rubrics = extractRubrics(text);

  return {
    success: true,
    data: {
      name: name || guessSubjectName(text),
      code: code || '',
      professor: professor || '',
      nextExam: nextExam || '',
      maxAbsences,
      classDays: classDays || '',
      rubrics: rubrics.length > 0 ? rubrics : [
        { id: 'r1', name: 'Primer Parcial', weightPct: 30, currentScore: null, isFinal: false },
        { id: 'r2', name: 'Segundo Parcial', weightPct: 30, currentScore: null, isFinal: false },
        { id: 'r3', name: 'Tareas y Trabajos', weightPct: 20, currentScore: null, isFinal: false },
        { id: 'r4', name: 'Examen Final', weightPct: 20, currentScore: null, isFinal: true },
      ],
    },
    rawTextLength: text.length,
  };
}

function extractField(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? match[1].trim() : null;
}

function extractNumber(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? parseInt(match[1], 10) : null;
}

function extractDate(text, pattern) {
  const match = text.match(pattern);
  if (!match || !match[1]) return null;

  const dateStr = match[1].trim();

  // Intentar parsear formato ISO directo
  const isoMatch = dateStr.match(/(\d{4})[\s/-](\d{1,2})[\s/-](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // Formato DD/MM/YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\s/-](\d{1,2})[\s/-](\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }

  // Formato "15 de septiembre de 2026"
  const spanishMatch = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+)?(\d{4})/i);
  if (spanishMatch) {
    const months = {
      enero: '01', febrero: '02', marzo: '03', abril: '04',
      mayo: '05', junio: '06', julio: '07', agosto: '08',
      septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    };
    const month = months[spanishMatch[2].toLowerCase()];
    if (month) {
      return `${spanishMatch[3]}-${month}-${spanishMatch[1].padStart(2, '0')}`;
    }
  }

  return dateStr;
}

function extractClassSchedule(text) {
  const match = text.match(CLASS_DAYS_PATTERN);
  if (!match) return null;
  const days = match[1] ? match[1].trim() : '';
  const start = match[2] || '';
  const end = match[3] || '';
  return `${days} (${start} - ${end})`;
}

function extractRubrics(text) {
  const rubrics = [];
  const seen = new Set();
  let match;

  // Resetear el lastIndex para patrón global
  RUBRIC_PATTERN.lastIndex = 0;

  while ((match = RUBRIC_PATTERN.exec(text)) !== null) {
    const name = match[1].trim();
    const weight = parseInt(match[2], 10);

    if (weight > 0 && weight <= 100 && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      const isFinal = /final|examen\s+final|midterm/i.test(name);
      rubrics.push({
        id: `r${rubrics.length + 1}`,
        name,
        weightPct: weight,
        currentScore: null,
        isFinal,
      });
    }
  }

  return rubrics;
}

function guessSubjectName(text) {
  // Buscar entre las primeras 500 caracteres una palabra que parezca nombre de materia
  const snippet = text.slice(0, 500);
  const lines = snippet.split('\n').filter((l) => l.trim().length > 3);

  // La línea más larga entre las primeras 5 suele ser el nombre de la materia
  if (lines.length > 0) {
    const sorted = [...lines].sort((a, b) => b.length - a.length);
    return sorted[0].trim().slice(0, 80);
  }

  return '';
}

module.exports = { extractSyllabusData };
