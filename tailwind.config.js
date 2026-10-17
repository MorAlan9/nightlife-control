// Tailwind se compila a styles.css (npm run build:css); en producción ya no se usa el CDN.
module.exports = {
  content: ['./index.html', './app.js'],
  theme: { extend: {} },
  plugins: []
};
