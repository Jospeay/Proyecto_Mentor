/**
 * PROYECTO MENTOR — Configuración de Firebase.
 * 
 * Lee las claves de Firebase desde .env (VITE_FIREBASE_*).
 * Incluye valores por defecto para evitar pantallas en blanco si no se ha configurado el .env aún.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyProyectoMentor1234567",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "proyecto-mentor.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "proyecto-mentor-demo",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "proyecto-mentor.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:demo1234567",
};

// Evitamos reinicializar la app si ya fue creada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
