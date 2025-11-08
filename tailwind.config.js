/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta SPAC
        'spac-orange': '#ff6b35',
        'spac-orange-dark': '#e85d2e',
        'spac-gold': '#ffb84d',
        'spac-dark': '#1a1a2e',
        'spac-dark-secondary': '#2c2c3e',
        'spac-white': '#ffffff',
        'spac-light': '#fff4f0',
        'spac-gray': '#6b6b7e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
