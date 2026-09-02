# Proyecto Mentor 🎓

**Asistente de estudio proactivo y estricto** para estudiantes universitarios. Una aplicación de escritorio (Electron + React) que organiza materias, tareas, exámenes y tiempo de estudio, integra un asistente de IA y se conecta automáticamente al portal de la universidad para traer tus tareas y avisos.

Mentor no se limita a mostrar pendientes: te orienta con un chat inteligente, te envía recordatorios, simula tus notas, previene el burnout y te ayuda a repasar con simulacros de examen generados desde tus propios apuntes.

---

## 🚀 Funcionalidades

### 🧠 Mentor IA
- Chat conversacional con IA que entiende tu contexto (materias, rendimiento, fechas).
- Respuestas basadas en **tus documentos**: sube un PDF, Word o PowerPoint y pregúntale sobre su contenido.
- Generación de **simulacros de examen** personalizados desde el material de cada materia.
- Recomendaciones de estudio y próximos pasos tras cada simulacro.

### 📋 Organización académica
- **Materias y tareas** con prioridades, fechas de entrega y panel tipo Kanban.
- **Agenda** (calendario) mensual con tus eventos de clase, tareas y exámenes.
- **Simulador de calificaciones**: calcula qué nota necesitas en futuros exámenes para alcanzar el promedio deseado.
- **Diario / notas de clase** por materia.

### 📚 Bóveda de materiales
- Almacena y visualiza **PDF, Word (`.docx`) y PowerPoint (`.pptx`)** por materia, guardados en tu disco local.
- Visor integrado: PDF paginado (pdf.js), Word renderizado a HTML (mammoth) y PowerPoint convertido a PDF (LibreOffice).
- Chat de preguntas y respuestas sobre el texto extraído de cada documento.

### 🤖 Sincronización con el portal universitario
- **Web scraping** con Playwright para conectarte al portal de tu universidad (UAM Virtual / Moodle) y descargar automáticamente tareas y avisos.
- Cuatro estrategias en cascada para adaptarse a los cambios de HTML de Moodle.
- Tus credenciales del portal se guardan **cifradas** con el almacenamiento seguro del sistema operativo (DPAPI / Keychain / libsecret), nunca en texto plano ni en localStorage.

### 🧘 Bienestar y enfoque
- **Prevención de burnout**: detecta cargas de trabajo excesivas y sugiere redistribuir.
- **Temporizador Pomodoro** con bloques de enfoque.
- **Hardcore Mode**: bloquea sitios distractores a nivel de sistema (archivo `hosts`) durante tus sesiones de estudio.
- **Notificaciones nativas** del sistema operativo y alertas por email (EmailJS).

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend (UI) | React 18 + Vite 5 |
| Aplicación de escritorio | Electron |
| Estilos y animaciones | Tailwind CSS + Framer Motion |
| Iconos | Lucide React |
| Backend / DB opcional | Firebase (Auth + Firestore) — funciona en modo local sin configurar |
| Web scraping | Playwright (core) |
| IA (chat, QA, exámenes) | API de Groq (compatible con OpenAI) + cliente Gemini |
| Visor de PDF | pdf.js / react-pdf |
| Conversión de Word | mammoth |
| Conversión de PowerPoint | LibreOffice (headless) |
| Notificaciones por email | EmailJS |

---

## ⚙️ Requisitos previos

- **Node.js 18+** y **npm**
- **Git**
- **LibreOffice** *(opcional, recomendado)* — necesario solo para visualizar archivos `.pptx` en la Bóveda. Sin él, los PowerPoint se abren con tu aplicación de presentaciones del sistema.
- **API key de Groq** *(opcional)* para el chat IA, QA de documentos y generación de exámenes. Obtén una gratis, sin tarjeta, en [console.groq.com/keys](https://console.groq.com/keys).

---

## 🧩 Instalación

### 1. Clonar el repositorio
```bash
git clone <URL_DE_TU_REPOSITORIO>.git
cd Proyecto_mentor
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia `.env.example` como `.env` y completa los valores:
```bash
cp .env.example .env
```
Variables disponibles (todas opcionales excepto seguir la app en modo local):
- `GROQ_API_KEY` — clave de Groq para la IA (si no la pones, el chat cae a un modo sin IA o genera exámenes localmente).
- `VITE_FIREBASE_*` — credenciales de Firebase (si no las configuras, la app funciona 100 % en **modo local** con `localStorage`, sin sincronización en la nube).
- `VITE_EMAILJS_*` — configuración de EmailJS para las notificaciones por correo.

### 4. Ejecutar

**Modo desarrollo** — React en el navegador con recarga en caliente:
```bash
npm run dev
```

**App de escritorio completa** (Electron, recomienda la experiencia nativa):
```bash
npm run electron:start
```

> Necesitas primero generar el build: `npm run build` (o ejecuta `npm run electron:start` después de `npm run dev` en otra terminal).

---

## 🏗️ Estructura del proyecto

```text
Proyecto_mentor/
├── electron/                    # Lógica nativa de Electron (proceso principal)
│   ├── main.js                  # Ventana + handlers IPC (vault, IA, scraping, conversión)
│   ├── preload.js               # Puente seguro window.mentorAPI (contextBridge)
│   ├── universityScraper.js     # Scraper del portal (Moodle/UAM/CANVAS) — 4 estrategias
│   ├── aiClient.js              # Cliente Groq (OpenAI-compatible) con fallback de modelos
│   ├── geminiClient.js          # Cliente Gemini con fallback y caché de modelos
│   ├── aiMentorService.js       # Análisis de carga de trabajo + notificaciones
│   ├── pdfAiService.js          # QA y resumen de PDFs con IA
│   ├── examAiService.js         # Generación de exámenes con IA
│   └── pdfParser.js             # Extracción de datos de sílabos PDF
├── src/
│   ├── components/              # Vistas y modales de React (Dashboard, Bóveda, Simulador…)
│   ├── data/                    # Estado inicial y modelos
│   ├── services/                # Firebase, auth, IA, portal y email
│   ├── utils/                   # Lógica de cálculo (simuladores, burnout, tipos de archivo)
│   ├── App.jsx                  # Enrutador y layout principal
│   └── main.jsx                 # Punto de entrada de React
├── .env.example                 # Plantilla de variables de entorno
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 🌐 Notas sobre el scraping

El scraper (`electron/universityScraper.js`) está diseñado para el portal **UAM Virtual** basado en **Moodle**, con soporte adicional para Canvas LMS. Puntos importantes:

- **Ajuste de selectores**: los selectores CSS de Moodle pueden variar entre instalaciones. Si las tareas no se detectan, revisa y ajusta los selectores en el archivo del scraper.
- **Cuatro estrategias en cascada**: si la primera estrategia de extracción falla, el scraper intenta con la siguiente, lo que lo hace más robusto ante cambios de HTML.
- **Sesión única**: el scraper usa una sesión de navegador. Si tienes el mismo portal abierto en otro navegador, la sesión puede competir o expirar durante la sincronización.
- **Credenciales cifradas**: se guardan cifradas mediante `safeStorage` del SO y viajan solo en memoria durante la conexión (nunca se registran en logs).

---

## ⚠️ Limitaciones conocidas

- **El scraper es frágil** a los cambios de HTML de las plataformas (Moodle/Canvas). Si el portal se actualiza, es posible que haya que actualizar selectores o URLs.
- **Los modelos de IA pueden depreciarse o cambiar de nombre**. El cliente de IA usa una cadena de modelos de respaldo (`MODEL_FALLBACK_CHAIN`); si todos fallan, el chat muestra un aviso.
- **La sesión del portal es única**: abrir el portal en otro navegador puede invalidar la sesión del scraper.
- **LibreOffice es necesario** para visualizar PowerPoint dentro de la app (opcional).
- **Modo local**: sin `VITE_FIREBASE_*`, la app no sincroniza datos en la nube (queda todo en `localStorage` y disco local).
- Los datos de la app (bóveda, credenciales, adjuntos) se guardan en `~/.proyecto_mentor_data/`, fuera del repositorio.

---

## 📄 Licencia

MIT. Consulta el archivo de licencia para más detalles.
