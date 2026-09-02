/**
 * PROYECTO MENTOR — Servicio de Autenticación (Firebase Auth).
 *
 * Funciones reales de producción para registrar usuarios, iniciar sesión,
 * cerrar sesión y escuchar cambios en el estado de autenticación.
 *
 * Todas las funciones operan directamente contra Firebase Authentication;
 * no hay placeholders ni simulaciones.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase-config';

/**
 * Registra un nuevo usuario con email y contraseña.
 * Tras el registro, actualiza el displayName del perfil de Firebase.
 *
 * @param {string} email    — Correo electrónico del estudiante.
 * @param {string} password — Contraseña elegida (mínimo 6 caracteres, requisito Firebase).
 * @param {string} name     — Nombre completo del estudiante.
 * @returns {Promise<import('firebase/auth').User>} El objeto User de Firebase.
 */
export async function registrarUsuario(email, password, name) {
  // Firebase crea el usuario en su sistema de autenticación
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  // Asigna el nombre al perfil para poder leerlo con user.displayName
  await updateProfile(userCredential.user, { displayName: name });

  return userCredential.user;
}

/**
 * Inicia sesión con email y contraseña existentes.
 *
 * @param {string} email    — Correo electrónico registrado.
 * @param {string} password — Contraseña del usuario.
 * @returns {Promise<import('firebase/auth').User>} El objeto User de Firebase.
 */
export async function iniciarSesion(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Cierra la sesión actual del usuario.
 */
export async function cerrarSesion() {
  await signOut(auth);
}

/**
 * Suscribe un callback que se ejecuta cada vez que el estado de autenticación cambia
 * (login, logout, recarga de la página).
 *
 * @param {function} callback — Recibe el objeto User o null.
 * @returns {function} Función para des-suscribirse (invocar para limpiar el listener).
 */
export function onCambioDeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
