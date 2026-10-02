/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#0A271D',
          900: '#0F3A2B', // Hoved mørkegrøn
          800: '#164E37', // Dyb skovgrøn
          700: '#206548',
          600: '#2D7A54', // Accentgrøn
          500: '#3D9A6B',
          400: '#5CB988',
          300: '#8CD3AE',
          200: '#BFE7D2',
          100: '#E4F5ED',
          50: '#F4FAF7',
        },
        surface: {
          bg: '#F8FAF9',
          card: '#FFFFFF',
          border: '#E2E8E5',
          muted: '#6B7280',
          text: '#111827',
        }
      },
    },
  },
  plugins: [],
};
