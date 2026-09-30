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
          light: '#dcf8c6',
          dark: '#056162',
          DEFAULT: '#25D366',
          teal: '#128C7E',
          deep: '#075E54',
          bg: '#EFEAE2',
          bubbleIn: '#FFFFFF',
          bubbleOut: '#E7FFDB',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(20, 184, 166, 0.25)',
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
