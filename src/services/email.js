/**
 * PROYECTO MENTOR — Servicio de Correo Electrónico (EmailJS).
 *
 * Envía correos reales desde el frontend usando el SDK de EmailJS.
 * No requiere servidor backend propio.
 *
 * Configuración:
 * 1. Crea una cuenta en https://www.emailjs.com/
 * 2. Configura un servicio de correo (ej: Gmail) y obtén tu Service ID.
 * 3. Crea una plantilla de correo con las variables {{to_email}}, {{task_title}},
 *    {{task_subject}}, {{task_due_date}} y obtén tu Template ID.
 * 4. Copia tu Public Key desde el panel de EmailJS.
 * 5. Agrega los tres valores al archivo .env del proyecto.
 */

import emailjs from '@emailjs/browser';

// Credenciales leídas desde las variables de entorno de Vite
const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Envía un correo de recordatorio al estudiante sobre una tarea pendiente.
 *
 * @param {string} emailUsuario — Correo del estudiante destinatario.
 * @param {Object} tarea        — Objeto de la tarea con title, subject, dueDate.
 * @returns {Promise<Object>}   — Respuesta de EmailJS ({ status, text }).
 */
export async function enviarRecordatorio(emailUsuario, tarea) {
  // Parámetros que deben coincidir con las variables de la plantilla en EmailJS
  const templateParams = {
    to_email:      emailUsuario,
    task_title:    tarea.title    || 'Actividad pendiente',
    task_subject:  tarea.subject  || 'General',
    task_due_date: tarea.dueDate  || 'Próximamente',
  };

  // Si las variables de entorno no están configuradas, registra un aviso
  // en consola pero no detiene la ejecución de la app.
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn(
      '[EMAIL] Variables de entorno de EmailJS no configuradas.',
      'Agrega VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID y VITE_EMAILJS_PUBLIC_KEY al archivo .env'
    );
    return { status: 0, text: 'EmailJS no configurado' };
  }

  // Llamada real al SDK de EmailJS
  const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
  console.log('[EMAIL] Correo enviado con éxito:', response.status, response.text);
  return response;
}

/**
 * Envía un resumen semanal al estudiante.
 *
 * @param {string} emailUsuario      — Correo del estudiante.
 * @param {string} mensajeProactivo  — Contenido del resumen generado por el mentor.
 * @returns {Promise<Object>}
 */
export async function enviarResumenSemanal(emailUsuario, mensajeProactivo) {
  const templateParams = {
    to_email:    emailUsuario,
    task_title:  'Resumen Semanal de Proyecto Mentor',
    task_subject: mensajeProactivo,
    task_due_date: new Date().toLocaleDateString('es-MX'),
  };

  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn('[EMAIL] EmailJS no configurado.');
    return { status: 0, text: 'EmailJS no configurado' };
  }

  const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
  return response;
}
