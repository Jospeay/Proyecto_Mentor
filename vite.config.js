import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * CONFIGURACIÓN DE VITE PARA PROYECTO MENTOR
 * 
 * Explicación:
 * - base: './' asegura que las rutas relativas de los assets funcionen dentro del empaquetado de Electron.
 * - resolve.alias: Permite usar '@' para referenciar la carpeta 'src' de manera limpia.
 * 
 * [MODIFICACIONES FUTURAS]:
 * - Si agregas módulos de Node nativos (ej: sqlite3), configúralos en `build.rollupOptions.external`.
 */
export default defineConfig({
  plugins: [react()],
  base: './', // Requerido para el sistema de archivos de Electron
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
