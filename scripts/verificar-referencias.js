// Verifica que todo lo que el HTML llama (onclick, onsubmit...) exista en app.js, y que app.js use solo ids que existen.
// Uso: node scripts/verificar-referencias.js   (también corre dentro de npm test)
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

const usadas = [...new Set([...html.matchAll(/\son(?:click|submit|input|change)="([a-zA-Z_]\w*)\(/g)].map(m => m[1]))];
const sinDefinir = usadas.filter(f => !new RegExp(`function ${f}\\b`).test(js));

const ids = [...new Set([...js.matchAll(/\bel\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]))];
const idsSinHtml = ids.filter(id => !html.includes(`id="${id}"`));

if (require.main === module) {
  console.log(`Funciones llamadas desde el HTML: ${usadas.length} · sin definir: ${JSON.stringify(sinDefinir)}`);
  console.log(`Ids usados en app.js: ${ids.length} · sin elemento en el HTML: ${JSON.stringify(idsSinHtml)}`);
  process.exit(sinDefinir.length || idsSinHtml.length ? 1 : 0);
}

module.exports = { usadas, sinDefinir, ids, idsSinHtml };
