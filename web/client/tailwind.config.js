/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [
    function({ addVariant }) {
      addVariant('landscape', '@media (max-height: 500px)');
      addVariant('md-landscape', '@media (min-width: 768px) and (max-height: 500px)');
      addVariant('mobile-landscape', '@media (max-width: 767px) and (max-height: 500px)');
    },
  ],
};
