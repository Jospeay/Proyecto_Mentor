/**
 * ==============================================================================
 * MENTOR - EMPAREJADOR DE MATERIAS (subjectMatcher.js)
 * ==============================================================================
 *
 * Resuelve el problema de "Sin materia identificada": toma el texto de curso que
 * el scraper extrae de Moodle (breadcrumb, título de curso o bloque de navegación)
 * y lo compara con las asignaturas que el estudiante ya tiene registradas para
 * devolver el `subjectId` correcto, de forma que la tarea aterrice directamente
 * en la columna Kanban de su materia.
 *
 * Estrategia de comparación, en orden de confianza:
 *   1. Código de curso exacto (ej. "CEP0004").
 *   2. Igualdad exacta del nombre normalizado.
 *   3. Contención de cadenas (`includes`) en cualquiera de los dos sentidos.
 *   4. Similitud difusa por bigramas (coeficiente de Sørensen–Dice) + solape de
 *      palabras significativas, con umbral configurable.
 * ==============================================================================
 */

export const DEFAULT_MATCH_THRESHOLD = 0.55;

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'con', 'a',
  'curso', 'clase', 'grupo', 'seccion', 'sección', 'the', 'of', 'and', 'to',
]);

/** Extrae códigos tipo "CEP0004", "MAT-101", "IS2043" de un texto de Moodle. */
export function extractCourseCode(text = '') {
  const match = String(text).toUpperCase().match(/\b([A-Z]{2,6}[-_ ]?\d{3,5})\b/);
  return match ? match[1].replace(/[-_ ]/g, '') : '';
}

/** Normaliza texto: minúsculas, sin acentos, sin puntuación ni espacios extra. */
export function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia el texto de curso que viene de Moodle.
 * Ej: "CEP0004 - B1 COMMUNICATIVE ENGLISH (Grupo 2) / 2026-1" → "b1 communicative english"
 */
export function cleanCourseName(text = '') {
  let cleaned = String(text)
    .replace(/\s*[/|»›>]\s*/g, ' ')          // separadores de breadcrumb
    .replace(/\(([^)]*)\)/g, ' ')             // paréntesis: grupos, secciones
    .replace(/\b\d{4}\s*[-–]\s*\d\b/g, ' ')   // periodos "2026-1"
    .replace(/\b(grupo|group|seccion|sección|sec)\s*\w{1,4}\b/gi, ' ');

  const code = extractCourseCode(cleaned);
  if (code) {
    cleaned = cleaned.replace(/\b[A-Za-z]{2,6}[-_ ]?\d{3,5}\b/, ' ');
  }
  return normalizeText(cleaned);
}

function significantWords(text) {
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function bigrams(text) {
  const clean = text.replace(/\s/g, '');
  const result = new Set();
  for (let i = 0; i < clean.length - 1; i += 1) {
    result.add(clean.slice(i, i + 2));
  }
  return result;
}

/** Coeficiente de Sørensen–Dice entre dos cadenas ya normalizadas (0 a 1). */
export function stringSimilarity(a = '', b = '') {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((gram) => {
    if (setB.has(gram)) intersection += 1;
  });

  return (2 * intersection) / (setA.size + setB.size);
}

/** Proporción de palabras significativas compartidas entre dos textos. */
function wordOverlap(a, b) {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setB = new Set(wordsB);
  const shared = wordsA.filter((w) => setB.has(w)).length;
  return shared / Math.min(wordsA.length, wordsB.length);
}

/**
 * Puntúa qué tanto se parece el texto de curso de Moodle a una asignatura local.
 * Devuelve un número entre 0 y 1.
 */
export function scoreSubjectMatch(courseText, subject) {
  if (!courseText || !subject) return 0;

  const courseCode = extractCourseCode(courseText);
  const subjectCode = extractCourseCode(`${subject.code || ''} ${subject.name || ''}`);
  if (courseCode && subjectCode && courseCode === subjectCode) return 1;

  const course = cleanCourseName(courseText);
  const name = cleanCourseName(subject.name || '');
  if (!course || !name) return 0;

  if (course === name) return 1;
  if (course.includes(name) || name.includes(course)) return 0.92;

  return Math.max(stringSimilarity(course, name), wordOverlap(course, name) * 0.95);
}

/**
 * Busca la mejor asignatura local para el texto de curso extraído de Moodle.
 *
 * @param {string} courseText  Texto crudo del breadcrumb / título / navegación.
 * @param {Array}  subjects    Asignaturas del usuario (Firebase o almacenamiento local).
 * @param {number} threshold   Puntuación mínima aceptada.
 * @returns {{subject: object, subjectId: string, score: number}|null}
 */
export function matchSubject(courseText, subjects = [], threshold = DEFAULT_MATCH_THRESHOLD) {
  if (!courseText || !Array.isArray(subjects) || subjects.length === 0) return null;

  let best = null;
  for (const subject of subjects) {
    const score = scoreSubjectMatch(courseText, subject);
    if (!best || score > best.score) {
      best = { subject, subjectId: subject.id, score };
    }
  }

  return best && best.score >= threshold ? best : null;
}

/**
 * Enriquece los avisos/tareas devueltos por el scraper con el `subjectId` correcto.
 * Si no hay coincidencia se conserva el nombre crudo del curso para que el usuario
 * pueda asignarlo manualmente.
 */
export function attachSubjectIds(notices = [], subjects = [], threshold = DEFAULT_MATCH_THRESHOLD) {
  return notices.map((notice) => {
    const candidates = [
      notice.subjectRaw,
      notice.subjectName,
      notice.subjectCode,
      notice.title,
    ].filter(Boolean);

    let best = null;
    for (const candidate of candidates) {
      const match = matchSubject(candidate, subjects, threshold);
      if (match && (!best || match.score > best.score)) best = match;
      if (best && best.score === 1) break;
    }

    if (!best) return { ...notice, subjectId: null, matchScore: 0 };

    return {
      ...notice,
      subjectId: best.subjectId,
      subjectName: best.subject.name || notice.subjectName,
      matchScore: Number(best.score.toFixed(2)),
    };
  });
}
