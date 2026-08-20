/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /**
       * PALETA "AURORA GLASS" — Modern Glassmorphism / Apple UI.
       *
       * Las superficies (surface, card, hover, border) son capas translúcidas
       * de blanco que flotan sobre el degradado radial oscuro del fondo; el
       * desenfoque se aplica globalmente en index.css. Los acentos usan
       * esmeralda/teal e índigo para los degradados de marca.
       */
      colors: {
        pm: {
          bg:       '#05060A',  // Base del degradado radial (casi negro azulado)
          surface:  '#FFFFFF0D',  // Vidrio nivel 1: sidebar, paneles, modales
          card:     '#FFFFFF0A',  // Vidrio nivel 2: tarjetas e items de lista
          hover:    '#FFFFFF1A',  // Estado hover de elementos interactivos
          border:   '#FFFFFF1F',  // Borde de vidrio

          // Acento principal: esmeralda vibrante
          accent:   '#34D399',
          teal:     '#14B8A6',
          indigo:   '#6366F1',
          blue:     '#60A5FA',
          red:      '#F87171',
          amber:    '#FBBF24',
          green:    '#4ADE80',

          // Escala tipográfica
          text:     '#F1F5F9',
          muted:    '#A8B0BF',
          subtle:   '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'pm': '14px',     // Radio estándar para tarjetas y botones
        'pm-lg': '24px',  // Radio para modales y contenedores grandes
      },
      backdropBlur: {
        glass: '18px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow-emerald': '0 10px 30px -10px rgba(16,185,129,0.45)',
        'glow-indigo': '0 10px 30px -10px rgba(99,102,241,0.45)',
      },
      keyframes: {
        auroraFloat: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(0,-3%,0) scale(1.06)' },
        },
      },
      animation: {
        aurora: 'auroraFloat 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
