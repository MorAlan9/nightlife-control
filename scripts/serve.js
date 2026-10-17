// Servidor estático mínimo para desarrollo: node scripts/serve.js [puerto]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PUERTO = Number(process.argv[2]) || 5173;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const PUBLICOS = new Set(['index.html', 'app.js', 'styles.css']); // lo único que se sirve: nada de node_modules ni reglas

http.createServer((req, res) => {
  const pedido = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  if (!PUBLICOS.has(pedido)) { res.writeHead(404); res.end('No encontrado'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(pedido)] || 'text/plain', 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(RAIZ, pedido)).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => console.log(`http://localhost:${PUERTO}/?emulador`));
