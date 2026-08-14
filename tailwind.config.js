/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          blue: '#1F3A93',
          dark: '#162854',
          light: '#2E5090',
        },
        secondary: {
          gray: '#4A4A4A',
          light: '#f8f9fa',
        },
        accent: {
          orange: '#D97E3A',
          gold: '#D4A574',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI'],
      },
      boxShadow: {
        'lg-orange': '0 20px 40px rgba(217, 126, 58, 0.2)',
        'xl-orange': '0 30px 60px rgba(217, 126, 58, 0.3)',
      },
    },
  },
  plugins: [],
}
