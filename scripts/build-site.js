// Arma la carpeta dist/ con lo único que se publica en Netlify (sin tests, scripts ni reglas).
// Uso: node scripts/build-site.js
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const ARCHIVOS = ['index.html', 'app.js', 'styles.css', '_headers'];

for (const archivo of ARCHIVOS) {
  if (!fs.existsSync(path.join(RAIZ, archivo))) {
    console.error(`Falta ${archivo}. Si es styles.css, corré: npm run build:css`);
    process.exit(1);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
ARCHIVOS.forEach(archivo => fs.copyFileSync(path.join(RAIZ, archivo), path.join(DIST, archivo)));
console.log(`dist/ listo: ${ARCHIVOS.join(', ')}`);
