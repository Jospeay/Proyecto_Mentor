/**
 * PROYECTO MENTOR — Configuración de Firebase.
 * 
 * Lee las claves de Firebase desde .env (VITE_FIREBASE_*).
 * Si no se han configurado las variables de entorno, la app funciona
 * únicamente en Modo Local (localStorage) sin conexión a Firestore.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Solo inicializar Firebase si las credenciales reales están presentes
let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db, isFirebaseConfigured };
