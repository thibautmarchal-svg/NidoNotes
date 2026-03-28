/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Charte Nido — palette ocre/crème/brun
        primary: {
          50:  '#FEF9EE',
          100: '#FAEEDA', // crème
          200: '#FAC775', // sable
          300: '#F8B44A',
          400: '#F5A030',
          500: '#EF9F27', // ocre — couleur principale
          600: '#D48A1A',
          700: '#B8730F',
          800: '#633806', // bois — header sombre
          900: '#412402', // terre — texte sombre
        },
        terre:  '#412402',
        bois:   '#633806',
        ocre:   '#EF9F27',
        sable:  '#FAC775',
        creme:  '#FAEEDA',
        // Statuts
        success: '#4CAF78',
        danger:  '#E05050',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        nido: '0 4px 20px rgba(65,36,2,.12)',
        'nido-lg': '0 8px 40px rgba(65,36,2,.16)',
      },
    },
  },
  plugins: [],
};
