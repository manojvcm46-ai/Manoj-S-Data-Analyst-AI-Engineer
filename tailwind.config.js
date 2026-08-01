/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      fontFamily: { inter: ['Inter', 'sans-serif'] },
      colors: {
        dark: { 950: '#0a1628' },
        neon: { blue: '#3b82f6', purple: '#8b5cf6', cyan: '#06b6d4', green: '#10b981' }
      }
    }
  },
  plugins: []
};
