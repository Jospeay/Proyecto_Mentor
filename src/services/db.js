/**
 * PROYECTO MENTOR — Servicio de Base de Datos (Firestore).
 *
 * CRUD completo para asignaturas y tareas del estudiante.
 * Cada usuario tiene su propia subcolección:
 *   users/{uid}/subjects/{docId}
 *   users/{uid}/tasks/{docId}
 *
 * Todas las funciones son reales y operan directamente contra Firestore;
 * no hay placeholders.
 */

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase-config';

// ─────────────────────────────────────────────────────────────────────────────
// ASIGNATURAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega una asignatura nueva en Firestore bajo la colección del usuario.
 *
 * @param {string} uid        — UID del usuario autenticado.
 * @param {Object} asignatura — Datos de la asignatura (name, code, professor, nextExam, classDays).
 * @returns {Promise<string>} El ID del documento creado.
 */
export async function agregarAsignatura(uid, asignatura) {
  const ref = collection(db, 'users', uid, 'subjects');
  const docRef = await addDoc(ref, {
    ...asignatura,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Obtiene todas las asignaturas del usuario desde Firestore.
 *
 * @param {string} uid — UID del usuario autenticado.
 * @returns {Promise<Array>} Lista de asignaturas con sus IDs de documento.
 */
export async function obtenerAsignaturas(uid) {
  const ref = collection(db, 'users', uid, 'subjects');
  const q = query(ref, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

/**
 * Elimina una asignatura de Firestore.
 *
 * @param {string} uid       — UID del usuario.
 * @param {string} subjectId — ID del documento de la asignatura.
 */
export async function eliminarAsignatura(uid, subjectId) {
  const ref = doc(db, 'users', uid, 'subjects', subjectId);
  await deleteDoc(ref);
}

/**
 * Actualiza campos de una asignatura en Firestore.
 *
 * @param {string} uid       — UID del usuario.
 * @param {string} subjectId — ID del documento de la asignatura.
 * @param {Object} data      — Objeto con los campos a actualizar.
 */
export async function actualizarAsignatura(uid, subjectId, data) {
  const ref = doc(db, 'users', uid, 'subjects', subjectId);
  await updateDoc(ref, data);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// TAREAS / ENTREGABLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega una tarea nueva en Firestore bajo la colección del usuario.
 *
 * @param {string} uid  — UID del usuario.
 * @param {Object} tarea — Datos de la tarea (title, subject, dueDate, estimatedMinutes, urgency).
 * @returns {Promise<string>} El ID del documento creado.
 */
export async function agregarTarea(uid, tarea) {
  const ref = collection(db, 'users', uid, 'tasks');
  const docRef = await addDoc(ref, {
    ...tarea,
    completed: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Obtiene todas las tareas del usuario desde Firestore.
 *
 * @param {string} uid — UID del usuario.
 * @returns {Promise<Array>} Lista de tareas con sus IDs.
 */
export async function obtenerTareas(uid) {
  const ref = collection(db, 'users', uid, 'tasks');
  const q = query(ref, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

/**
 * Actualiza campos de una tarea existente (ej: marcar como completada).
 *
 * @param {string} uid    — UID del usuario.
 * @param {string} taskId — ID del documento de la tarea.
 * @param {Object} data   — Campos a actualizar (ej: { completed: true }).
 */
export async function actualizarTarea(uid, taskId, data) {
  const ref = doc(db, 'users', uid, 'tasks', taskId);
  await updateDoc(ref, data);
}

/**
 * Elimina una tarea de Firestore.
 *
 * @param {string} uid    — UID del usuario.
 * @param {string} taskId — ID del documento de la tarea.
 */
export async function eliminarTarea(uid, taskId) {
  const ref = doc(db, 'users', uid, 'tasks', taskId);
  await deleteDoc(ref);
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS DE CALENDARIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega un evento de calendario nuevo en Firestore.
 *
 * @param {string} uid   — UID del usuario.
 * @param {Object} evento — Datos del evento (title, date, type, description, subjectId).
 * @returns {Promise<string>} El ID del documento creado.
 */
export async function agregarEventoCalendario(uid, evento) {
  const ref = collection(db, 'users', uid, 'calendarEvents');
  const docRef = await addDoc(ref, {
    ...evento,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Obtiene todos los eventos de calendario del usuario desde Firestore.
 *
 * @param {string} uid — UID del usuario.
 * @returns {Promise<Array>} Lista de eventos con sus IDs.
 */
export async function obtenerEventosCalendario(uid) {
  const ref = collection(db, 'users', uid, 'calendarEvents');
  const q = query(ref, orderBy('date', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

/**
 * Actualiza un evento de calendario existente.
 *
 * @param {string} uid      — UID del usuario.
 * @param {string} eventId  — ID del documento del evento.
 * @param {Object} data     — Campos a actualizar.
 */
export async function actualizarEventoCalendario(uid, eventId, data) {
  const ref = doc(db, 'users', uid, 'calendarEvents', eventId);
  await setDoc(ref, data, { merge: true });
}

/**
 * Elimina un evento de calendario de Firestore.
 *
 * @param {string} uid      — UID del usuario.
 * @param {string} eventId  — ID del documento del evento.
 */
export async function eliminarEventoCalendario(uid, eventId) {
  const ref = doc(db, 'users', uid, 'calendarEvents', eventId);
  await deleteDoc(ref);
}
