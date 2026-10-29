/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'var(--app-bg)',
        sidebar: 'var(--sidebar-bg)',
        header: 'var(--header-bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
        },
        'theme-border': 'var(--border)',
        'theme-text': {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        'theme-brand': {
          primary: 'var(--brand-primary)',
          strong: 'var(--brand-strong)',
          accent: 'var(--brand-accent)',
        },
        royal: {
          50: '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6e0',
          300: '#5eead1',
          400: '#2dd4be',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e48',
          950: '#042f2c',
        },
        gold: {
          50: '#fbf8ea',
          100: '#f5eecc',
          200: '#ebd99b',
          300: '#debe63',
          400: '#d4a438',
          500: '#b8861e',
          600: '#9c6a15',
          700: '#7d4e14',
          800: '#673f17',
          900: '#563517',
        },
        whatsapp: {
          light: '#DCF8C6',
          dark: '#005C4B',
          DEFAULT: '#25D366',
          teal: '#128C7E',
          deep: '#075E54',
          bg: '#ECE5DD',
          bubbleIn: '#FFFFFF',
          bubbleOut: '#DCF8C6',
          canvas: '#111B21',
          panel: '#202C33',
          composer: '#2A3942',
          border: '#222D34',
          text: '#E9EDEF',
          muted: '#8696A0',
          link: '#53BDEB',
          check: '#34B7F1',
        },
        /* Legacy enterprise aliases mapped to WhatsApp Dark Palette */
        navy: {
          50: '#f2f7f9',
          100: '#e3edf2',
          200: '#c2d8e2',
          300: '#92b8c7',
          400: '#5b90a5',
          500: '#3d7389',
          600: '#2f5c70',
          700: '#202C33',
          800: '#202C33',
          900: '#111B21',
          950: '#111B21',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(37, 211, 102, 0.25)',
        'gold-glow': '0 0 25px -5px rgba(212, 164, 56, 0.3)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
