# Proyecto Mentor 🎓

**Proyecto Mentor** es un asistente de estudio avanzado, proactivo y estricto diseñado específicamente para estudiantes universitarios. Esta aplicación de escritorio ayuda a los estudiantes a organizar sus materias, tareas, exámenes y su tiempo de estudio de manera óptima y automatizada.

El asistente no solo se limita a mostrar tareas, sino que cuenta con un chat inteligente mediante Inteligencia Artificial, que orienta al estudiante, le envía recordatorios, simula calificaciones y previene episodios de fatiga extrema (burnout).

## 🚀 Características Principales

* 🧠 **Mentor AI Integrado**: Un chat conversacional con IA para resolver dudas, repasar conceptos y motivar al estudiante, ofreciendo respuestas contextualizadas según su rendimiento y materias actuales.
* 📚 **Gestión de Materias y Tareas**: Organización detallada de materias y tareas, con diferentes tipos de prioridades, fechas de entrega y un panel de "Agenda".
* 🤖 **Extracción Automatizada de Datos (Web Scraping)**: Conexión con portales universitarios (usando Playwright) para consultar y descargar automáticamente las tareas o avisos desde la propia universidad.
* 📊 **Simulador de Calificaciones**: Herramienta integrada que permite calcular qué nota necesita el estudiante en futuros exámenes para alcanzar el promedio deseado, dándole métricas reales de su situación.
* 🧘 **Prevención de Burnout**: El sistema detecta cuando el volumen de tareas y estudio es excesivo, ayudando a redistribuir cargas de trabajo para cuidar la salud mental.
* ⏱️ **Modo de Estudio**: Temporizadores (estilo Pomodoro), recordatorios, notificaciones y bloqueo de distracciones para garantizar el enfoque absoluto durante las sesiones de estudio.
* ☁️ **Sincronización en la Nube**: Toda la información y configuraciones están conectadas en tiempo real a Firebase, lo que garantiza que los datos de estudio siempre estén seguros y actualizados.
* 📨 **Notificaciones por Email**: Integración con EmailJS para enviar alertas y resúmenes de rendimiento y recordatorios críticos.

## 🛠️ Stack Tecnológico

El proyecto es una **Aplicación de Escritorio multiplataforma** construida sobre un entorno tecnológico moderno:

* **Frontend UI**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
* **Contenedor Desktop**: [Electron](https://www.electronjs.org/)
* **Estilos y Animaciones**: [Tailwind CSS](https://tailwindcss.com/) y [Framer Motion](https://www.framer.com/motion/)
* **Iconos**: [Lucide React](https://lucide.dev/)
* **Base de Datos / Backend**: [Firebase](https://firebase.google.com/) (Firestore y Autenticación)
* **Web Scraping**: [Playwright Core](https://playwright.dev/)

## ⚙️ Instalación y Uso Local

Para poder ejecutar este proyecto de forma local, necesitarás tener instalado **Node.js** (versión 18+ recomendada) y **Git**.

### 1. Clonar el repositorio
```bash
git clone https://github.com/Jospeay/Proyecto_Mentor.git
cd Proyecto_Mentor
```

### 2. Instalar dependencias
Usa el gestor de paquetes `npm` para instalar las librerías necesarias:
```bash
npm install
```

### 3. Configurar Variables de Entorno
Clona el archivo `.env.example` y renómbralo a `.env`. Completa las variables con tus credenciales de Firebase, IA (OpenAI, Gemini o la que uses), e EmailJS:
```bash
cp .env.example .env
```

### 4. Ejecutar el Modo de Desarrollo
Para correr la aplicación de React en tu navegador con recarga en caliente:
```bash
npm run dev
```

Para abrir la interfaz nativa dentro de **Electron**:
```bash
npm run electron:start
```

## 🏗️ Estructura del Proyecto

```text
Proyecto_Mentor/
├── electron/                 # Lógica nativa de Electron (Main, Preload y Web Scraper)
├── src/
│   ├── components/           # Componentes visuales de React (Modales, Vistas, Chat)
│   ├── data/                 # Estado inicial y modelos
│   ├── services/             # Integración con Firebase, AI, Auth y Emails
│   ├── utils/                # Lógica de cálculo (Simuladores, Prevención Burnout)
│   ├── App.jsx               # Enrutador y Layout principal
│   └── main.jsx              # Punto de entrada de React
├── .env.example              # Archivo de ejemplo para variables de entorno
├── tailwind.config.js        # Configuración de Tailwind CSS
└── package.json              # Dependencias y scripts de Node
```

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Para más detalles, puedes revisar el archivo de licencia o la política open source.
