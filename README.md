# 🎭 SomosManijas · Gestor de Boliches & Afters

Aplicación web para el control de listas y accesos en boliches y afters. Sin build: es `index.html` + `app.js`, con Firebase (login + base de datos en tiempo real).

## Cómo funciona

- **Boliches separados**: cada boliche/after solo ve y toca sus propios datos. Lo registra su dueño y **Panda lo habilita**.
- **Noches**: el admin crea una "noche" por evento (nombre y fecha). Precios, ubicaciones, invitados, ingresos, DJs e historial son de cada noche; la noche nueva puede copiar los precios y ubicaciones de la anterior. La noche marcada como **activa** (⭐) es la que ve el público.
- **Roles**: Admin del boliche (aprueba personal, caja, DJs), RPP/Promotor (anota y marca ingresos), Control de Puerta (marca ingresos), DJ (solo mira). El personal nuevo queda **pendiente** hasta que un admin lo aprueba.
- **Una anotación = un registro**: dos RPP anotando a la vez ya no se pisan. Si una persona está en la lista de dos RPP se agrupa y, al marcar, se elige por cuál lista entra (el ingreso se acredita una sola vez y paga una sola entrada).
- **Ingreso único**: la base solo deja *crear* el ingreso una vez, así dos porteros no pueden marcar a la misma persona dos veces. Solo el admin lo deshace.
- **Manija (público, sin cuenta)**: elige el boliche, escribe su DNI y ve solo *su* lugar en la lista; si está en el After, ve el mapa. No puede ver la lista de los demás.

## Puesta en marcha en Firebase (una sola vez, lo hacés vos en la consola)

> Nada de esto se guarda en el repo: las contraseñas las elegís vos y quedan en Firebase.

1. **Authentication → Sign-in method →** habilitar **Correo electrónico/contraseña**. (La app arma un email interno a partir del usuario: `usuario@usuarios.somosmanijas.app`; no se envían mails.)
2. **Realtime Database → Reglas →** pegar el contenido de [`database.rules.json`](database.rules.json) y **Publicar**. (O con `npx firebase deploy --only database` si tenés la CLI.) Sin este paso la app muestra un aviso rojo de "reglas de Firebase".
3. **Crear a Panda (superadmin):**
   1. Authentication → Users → **Add user**: email `panda@usuarios.somosmanijas.app` y una contraseña nueva que elijas.
   2. Copiar el **UID** de ese usuario.
   3. Realtime Database → crear el nodo `superadmins` → dentro, una clave con ese UID y valor `true`.
4. (Recomendado) En Google Cloud Console → Credenciales, restringir la API key web a tu dominio de Netlify.
5. Los datos viejos (`vortexx_users`, `vortexx_guests`, etc.) ya no se usan: se pueden borrar. Los usuarios tienen que volver a registrarse.

### Seguridad: qué cambió
Antes la clave maestra y la de reseteo estaban escritas en el código (repo público), las contraseñas de todos se guardaban en texto plano en la base, y cualquiera con la dirección de la base podía leer y escribir todo. Ahora el login es de Firebase Auth (la contraseña nunca se guarda en la base) y las **reglas** de la base son las que deciden quién puede qué. Las claves viejas ya no se usan en ningún lado: si las reutilizaste en otro servicio, cambialas.

## Tutorial y ayuda
El sistema trae un **recorrido guiado** por pantalla (se abre solo la primera vez, y siempre con el botón ❓ abajo a la izquierda) y un **Centro de Ayuda** (botón ❓ Ayuda del encabezado), igual que Despensa 24/7 y Sistema Rotisería. Todo el contenido está en [`tutorial.js`](tutorial.js): `TUTORIALES` (pasos por pantalla y por rol) y `AYUDA_TEMAS` (guía por tema).

**Al agregar o cambiar una función o un campo, actualizá `tutorial.js`.** Una prueba (`tests/tutorial.test.js`) avisa si un paso apunta a algo que ya no existe en la pantalla.

## Desarrollo y pruebas

```bash
npm install
npm test              # ~85 pruebas de la app (jsdom + Firebase simulado, nunca toca la base real)
npm run test:rules    # pruebas de las reglas de seguridad contra el emulador oficial (necesita Java)
npm run build:rules   # regenera database.rules.json desde scripts/build-rules.js
```

Para probar a mano con datos de mentira (sin tocar tu proyecto real):

```bash
npx firebase emulators:start --only auth,database --project demo-nightlife   # en una terminal
node scripts/sembrar-emulador.js                                              # crea a Panda en el emulador
node scripts/serve.js 5391                                                    # y abrir http://127.0.0.1:5391/?emulador
```

`?emulador` solo funciona en `localhost`/`127.0.0.1`; en producción no hace nada.

## Deploy (Netlify)
`netlify.toml` ya está configurado: corre `node scripts/build-site.js` y publica solo `dist/` (`index.html`, `app.js`, `styles.css` y los encabezados de `_headers`). No hace falta instalar nada en Netlify.

Si cambiás clases de Tailwind en `index.html` o `app.js`, regenerá el CSS **antes de commitear**: `npm run build:css` (hay una prueba que avisa si `styles.css` quedó desactualizado). Para armar `dist/` localmente: `npm run build`.

## Lista de verificación de entrega

Antes de dárselo al cliente, en este orden:

1. Hacer los 3 pasos de **Puesta en marcha en Firebase** (arriba).
2. Subir los cambios (`git push`) y esperar el deploy de Netlify.
3. Prueba rápida en la página real (10 minutos):
   - Registrar un boliche de prueba → entrar con la cuenta de Panda → **Habilitar** → entrar con el boliche.
   - Crear una noche, cargar precio y una ubicación, anotar a una persona, marcarla y ver que la caja suma.
   - Registrar un RPP de prueba, aprobarlo desde el panel del admin y anotar con su cuenta.
   - Entrar como **Manija**, escribir el DNI anotado y ver el resultado.
   - Borrar los datos de prueba (el boliche y los usuarios de prueba, desde la consola de Firebase).
4. Entregar al cliente: la URL, [`GUIA-USUARIO.md`](GUIA-USUARIO.md) y la cuenta de Panda para quien administre.

### Limitaciones conocidas (conviene avisarle al cliente)
- **Borrar una productora o a un integrante del personal no borra su usuario de login** (la página no puede hacerlo): queda en Firebase → Authentication y su nombre de usuario sigue ocupado hasta que se borre ahí.
- **Contraseña olvidada**: no se puede recuperar desde la página (el login usa un email interno, sin casilla real). Se resuelve borrando la cuenta en Firebase → Authentication; la persona vuelve a registrarse. Lo mismo si un admin "elimina" a alguien del personal: su usuario queda ocupado hasta que se borre también esa cuenta en la consola.
- **Consulta del Manija por DNI**: no tiene límite de intentos; alguien podría probar DNIs de a uno. Solo devuelve el nombre y el lugar de esa persona en la lista.
- **Panda ve todos los boliches** (es el superadmin).
- El lineup no es público: el Manija no lo ve.
