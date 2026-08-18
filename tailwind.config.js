/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /**
       * PALETA "OBSIDIAN SAGE" — Identidad visual propia de Mentor.
       * Esmeralda oscuro sobre carbón cálido. Sin parecido a edtools/Linear.
       */
      colors: {
        pm: {
          bg:       '#0F0F12',  // Fondo principal (carbón ligeramente cálido)
          surface:  '#18181F',  // Sidebar, paneles, tarjetas de primer nivel
          card:     '#1F1F28',  // Tarjetas secundarias, items de lista
          hover:    '#282833',  // Estado hover de elementos interactivos
          border:   'rgba(255,255,255,0.07)', // Bordes extremadamente sutiles

          // Acento principal: esmeralda sobrio
          accent:   '#3D9A6E',  // Esmeralda oscuro (botones primarios, enlaces activos)
          blue:     '#4B8BBE',  // Azul acero (información, enlaces secundarios)
          red:      '#D4544E',  // Rojo terracota cálido (errores, urgencia alta)
          amber:    '#D4A843',  // Ámbar dorado (advertencia, urgencia media)
          green:    '#4CAF7D',  // Verde claro (éxito, completado)

          // Escala tipográfica
          text:     '#E8E8EC',  // Texto principal (blanco cálido)
          muted:    '#8A8A90',  // Texto secundario / labels
          subtle:   '#5C5C64',  // Texto terciario / placeholders
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'pm': '8px',    // Radio estándar para tarjetas y botones
        'pm-lg': '12px', // Radio para modales y contenedores grandes
      },
    },
  },
  plugins: [],
};
