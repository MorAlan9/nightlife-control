# nightlife-control — guía para Claude Code

<!-- EMPRESA:INICIO v1 (2026-10-14) — bloque BÁSICO para repos públicos. Fuente: torre-control/EMPRESA-PUBLICO.md. No incluir datos comerciales/internos acá. -->
## Reglas de trabajo (MorAlan9)

- Hablarle al dueño en **español rioplatense**. Probar de verdad (compilar, levantar, navegador) y decir qué se probó y qué no. Al terminar, actualizar este archivo y pushear.
- **Nunca** escribir en el repo claves, contraseñas, tokens ni API keys. No tipearlos en formularios web aunque se pida; se le explica el paso y lo pega él. No cambiar variables de entorno de los servicios (Render, Vercel, Supabase…) sin pedido explícito.
- Este repo es **público**: no subir datos de clientes, URLs internas ni detalles comerciales o de licenciamiento.
- Los sistemas comerciales del dueño (con licencias y multi-tenant) viven en repos privados, con su propio CLAUDE.md.
<!-- EMPRESA:FIN -->

## Este repo

Proyecto público (HTML/JS). Sin datos comerciales.

### Notas técnicas
- Archivos: `index.html` (pantalla) + `app.js` (lógica) + `styles.css` (Tailwind COMPILADO: tras tocar clases correr `npm run build:css` y commitearlo; una prueba lo verifica) + `database.rules.json` (reglas de Firebase). Firebase compat 9.23 (app, database, auth). Deploy: Netlify corre `scripts/build-site.js` y publica `dist/` (ver `netlify.toml`, `_headers`).
- **Las reglas son la seguridad real**: el navegador no se puede creer. `database.rules.json` se GENERA con `npm run build:rules` desde `scripts/build-rules.js` (no editar el JSON a mano). El modelo de datos está descrito al principio de `app.js`.
- Login = Firebase Auth con email interno `usuario@usuarios.somosmanijas.app` (la constante `DOMINIO_EMAIL` debe coincidir con `DOMINIO` en `scripts/build-rules.js`). Panda = cuenta con `superadmins/<uid> = true` cargado a mano en la consola. Nunca hay contraseñas en el repo ni en la base.
- Pruebas: `npm test` (~85, jsdom + Firebase falso en `tests/helpers.js`, no toca la base real) y `npm run test:rules` (reglas contra el emulador oficial; necesita Java y el puerto 9000 libre). Las reglas se probaron además de punta a punta en un navegador con los emuladores (`?emulador`, solo localhost).
- Cuidado con los tipos en las reglas: las marcas de tiempo son `Date.now()` (~1.7e12); los montos tienen tope bajo. Las pruebas de reglas usan tiempos reales a propósito.
- Todo texto de usuario que entra a `innerHTML` pasa por `esc()`. Las acciones usan `data-*` + listeners delegados (nunca datos dentro de `onclick`).
- Las escrituras pasan por `guardarDb/actualizarDb/borrarDb` (avisan si las reglas rechazan). Cada invitado/ingreso/log es un registro propio (nunca se reescriben listas enteras).
- Los pasos de consola de Firebase (habilitar Auth, publicar reglas, crear a Panda) los hace el dueño: están en el README. Pendiente a futuro: concepto de Panda más fino (hoy ve todo), lineup público para el Manija, hash/rate-limit de la consulta por DNI.
