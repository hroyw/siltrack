/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chain: {
          futures: '#10b981',
          spot: '#3b82f6',
          stock: '#a855f7',
        },
      },
    },
  },
  plugins: [],
};
