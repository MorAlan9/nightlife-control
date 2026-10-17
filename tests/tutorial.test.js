// Tutorial guiado y Centro de Ayuda.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, iniciarSesion, semilla, invitado, CUENTAS, ROL_DUENO, RPP, staff, email } = require('./helpers');

async function entrar(usuario, { extra = {}, ...opciones } = {}) {
  const app = await cargarApp({ datos: semilla(extra), cuentas: CUENTAS, ...opciones });
  if (usuario) await iniciarSesion(app, usuario);
  return app;
}

const clave = app => app.ev('tutorialClaveActual()');
const capa = app => app.w.document.getElementById('tutorialCapa');
const contador = app => app.$('tutorialContador').textContent;
const clic = (app, id) => app.$(id).click();

// ═════════════════════════ Que el tutorial no quede desactualizado ═════════════════════════

test('cada paso de cada recorrido apunta a algo que existe en la pantalla', async () => {
  const app = await cargarApp();
  // Se muestra todo para comprobar que cada selector/campo/botón existe en el HTML
  app.w.document.querySelectorAll('.hidden').forEach(e => e.classList.remove('hidden'));
  const rotos = [];
  const claves = app.ev('Object.keys(TUTORIALES)');
  for (const k of claves) {
    const pasos = app.ev(`TUTORIALES['${k}']`);
    pasos.forEach((paso, i) => {
      if (!app.w.tutorialBuscar(paso)) rotos.push(`${k} #${i + 1} (${paso.titulo})`);
    });
  }
  assert.deepEqual(rotos, [], 'estos pasos apuntan a algo que ya no existe: actualizá tutorial.js');
});

test('todos los pasos tienen título y texto, y cada recorrido tiene al menos un paso', async () => {
  const app = await cargarApp();
  for (const k of app.ev('Object.keys(TUTORIALES)')) {
    const pasos = app.ev(`TUTORIALES['${k}']`);
    assert.ok(pasos.length >= 1, `${k} está vacío`);
    pasos.forEach((p, i) => {
      assert.ok(p.titulo && p.titulo.length > 2, `${k} #${i + 1} sin título`);
      assert.ok(p.texto && p.texto.length > 10, `${k} #${i + 1} sin texto`);
    });
  }
});

test('hay recorrido para cada pantalla y rol', async () => {
  const app = await cargarApp();
  const claves = app.ev('Object.keys(TUTORIALES)');
  for (const esperada of ['login', 'regBoliche', 'regPersonal', 'manija', 'manijaConsulta', 'panda', 'sinNoche', 'admin', 'rpp', 'puerta', 'dj', 'modalEvento', 'miCuenta']) {
    assert.ok(claves.includes(esperada), `falta el recorrido "${esperada}"`);
  }
});

test('el tutorial explica cómo se llenan los campos clave (DNI, teléfono, usuario, precios)', async () => {
  const app = await cargarApp();
  const texto = JSON.stringify(app.ev('TUTORIALES')).toLowerCase();
  for (const frase of ['DNI', 'sin 0 ni 15', 'minúsculas', 'Entrada Paga', 'Cumpleaños', 'Google Maps', 'cachet', 'Precios en la puerta']) {
    assert.ok(texto.includes(frase.toLowerCase()), `el tutorial no menciona "${frase}"`);
  }
});

// ═════════════════════════ En qué pantalla estás ═════════════════════════

test('la pantalla de ingreso cambia de recorrido según la pestaña', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  assert.equal(clave(app), 'login');
  app.w.cambiarTabAuth('regBoliche');
  assert.equal(clave(app), 'regBoliche');
  app.w.cambiarTabAuth('regPersonal');
  assert.equal(clave(app), 'regPersonal');
  app.w.cambiarTabAuth('manija');
  assert.equal(clave(app), 'manija');
});

test('cada rol ve el recorrido que le corresponde', async () => {
  const base = semilla();
  const puerta = { staff: { ...base.staff, b1: { ...base.staff.b1, uPuerta: staff('puerta', 'Control de Puerta') } }, usuarios: { ...base.usuarios, uPuerta: { bid: 'b1' } } };
  const cuentasPuerta = [...CUENTAS, { uid: 'uPuerta', email: email('puerta'), password: 'clave123' }];

  assert.equal(clave(await entrar('franco')), 'admin');
  assert.equal(clave(await entrar('lucas')), 'rpp');
  assert.equal(clave(await entrar('dj')), 'dj');
  assert.equal(clave(await cargarApp({ datos: semilla(puerta), cuentas: cuentasPuerta }).then(async a => { await iniciarSesion(a, 'puerta'); return a; })), 'puerta');
  assert.equal(clave(await entrar('panda')), 'panda');
});

test('Panda mirando un boliche usa el recorrido de administrador', async () => {
  const app = await entrar('panda');
  await app.w.gestionarBoliche('b1');
  await app.tick(10);
  assert.equal(clave(app), 'admin');
});

test('sin noche cargada, se muestra el recorrido de "sin noche"', async () => {
  const sinNoches = semilla();
  delete sinNoches.eventos.b1;
  delete sinNoches.publicos.b1.eventoActivo;
  const app = await cargarApp({ datos: sinNoches, cuentas: CUENTAS });
  await iniciarSesion(app, 'franco');
  assert.equal(clave(app), 'sinNoche');
});

test('el Manija tiene su propio recorrido, y las ventanas (nueva noche, mi cuenta) también', async () => {
  const manija = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  manija.w.cambiarTabAuth('manija');
  manija.$('manijaBolicheSelect').value = 'b1';
  manija.w.ingresarComoManija();
  await manija.tick();
  assert.equal(clave(manija), 'manijaConsulta');

  const admin = await entrar('franco');
  admin.w.abrirModalEvento();
  assert.equal(clave(admin), 'modalEvento');
  admin.w.cerrarModalEvento();
  admin.w.abrirModalMiCuenta();
  assert.equal(clave(admin), 'miCuenta');
});

// ═════════════════════════ El recorrido guiado ═════════════════════════

test('el recorrido muestra "Paso 1 de N", avanza, retrocede y termina con ¡Listo!', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  assert.equal(app.w.tutorialAbrir(false), true);
  assert.ok(capa(app));
  const total = app.ev('tutorialPasos.length');
  assert.ok(total >= 5);
  assert.equal(contador(app), `Paso 1 de ${total}`);
  assert.equal(app.$('tutorialTitulo').textContent, 'Tu usuario');
  assert.equal(app.$('tutorialAnterior'), null, 'en el primer paso no hay "Anterior"');

  clic(app, 'tutorialSiguiente');
  assert.equal(contador(app), `Paso 2 de ${total}`);
  assert.ok(app.$('tutorialAnterior'));
  clic(app, 'tutorialAnterior');
  assert.equal(contador(app), `Paso 1 de ${total}`);

  for (let i = 1; i < total; i++) clic(app, 'tutorialSiguiente');
  assert.equal(app.$('tutorialSiguiente').textContent, '¡Listo!');
  clic(app, 'tutorialSiguiente');
  assert.equal(capa(app), null, 'al terminar se cierra');
});

test('al cerrarlo se marca como visto y no vuelve a abrirse solo; el botón "?" lo fuerza', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  assert.equal(app.w.tutorialAbrir(false), true);
  clic(app, 'tutorialSaltar');
  assert.equal(capa(app), null);
  assert.ok(app.w.localStorage.getItem('tutorial-nightlife-visto-v1:login'));

  assert.equal(app.w.tutorialAbrir(false), false, 'ya lo vio: no se abre solo');
  assert.equal(app.w.tutorialAbrir(true), true, 'forzado (botón ?): sí');
  assert.ok(capa(app));
});

test('la tecla Escape cierra el recorrido y las flechas lo recorren', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.tutorialAbrir(true);
  const tecla = key => app.w.document.dispatchEvent(new app.w.KeyboardEvent('keydown', { key }));
  tecla('ArrowRight');
  assert.match(contador(app), /Paso 2 de/);
  tecla('ArrowLeft');
  assert.match(contador(app), /Paso 1 de/);
  tecla('Escape');
  assert.equal(capa(app), null);
});

test('los pasos cuyo elemento no está a la vista se saltean solos', async () => {
  const app = await entrar('lucas');
  const configurados = app.ev("TUTORIALES['rpp'].length");
  app.w.tutorialAbrir(true);
  const mostrados = app.ev('tutorialPasos.length');
  assert.ok(mostrados < configurados, `el campo del cumpleañero está oculto: ${mostrados} < ${configurados}`);
  assert.ok(!app.ev('tutorialPasos').some(p => p.paso.campo === 'cumpleanero'));

  // Al elegir "Cumpleaños" ese campo aparece y entra en el recorrido
  app.w.tutorialCerrar(false);
  app.$('tipoLista').value = 'Cumpleaños';
  app.w.toggleOpcionesLista();
  app.w.tutorialAbrir(true);
  assert.ok(app.ev('tutorialPasos').some(p => p.paso.campo === 'cumpleanero'));
});

test('el recorrido del administrador incluye la caja, los precios y la lista; el de Panda las herramientas', async () => {
  const admin = await entrar('franco');
  admin.w.tutorialAbrir(true);
  const campos = admin.ev('tutorialPasos').map(p => p.paso.campo || p.paso.css);
  for (const esperado of ['precioBoliche', 'precioAfter', 'pagoPorCabeza', '#formPrecio', '#formCargaDj', 'ubiBoliche', 'searchInput', 'documento', '#guestList']) {
    assert.ok(campos.includes(esperado), `falta ${esperado}`);
  }
  assert.ok(!campos.includes('#barAdminTools'), 'las herramientas de Panda no se muestran al administrador');

  const panda = await entrar('panda');
  await panda.w.gestionarBoliche('b1');
  await panda.tick(10);
  panda.w.tutorialAbrir(true);
  assert.ok(panda.ev('tutorialPasos').some(p => p.paso.css === '#barAdminTools'));
});

test('el resaltado y la burbuja se ubican en pantalla', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.tutorialAbrir(true);
  const resaltado = app.$('tutorialResaltado');
  const burbuja = app.$('tutorialBurbuja');
  assert.ok(resaltado.style.boxShadow.includes('9999px'), 'oscurece el resto de la pantalla');
  assert.ok(burbuja.style.width.endsWith('px'));
  assert.equal(burbuja.getAttribute('role'), 'dialog');
});

test('cambiar de pantalla cierra el recorrido anterior (no queda colgado sobre otra pantalla)', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.tutorialAbrir(true);
  assert.ok(capa(app));
  app.w.cambiarTabAuth('regBoliche');
  app.w.tutorialVigilar();
  assert.equal(capa(app), null);
});

// ═════════════════════════ El botón "?" ═════════════════════════

test('el botón "?" aparece en las pantallas con tutorial y se oculta mientras corre el recorrido', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.tutorialRefrescar();
  assert.ok(app.visible('btnTutorial'));
  app.$('btnTutorial').click();
  assert.ok(capa(app), 'el botón abre el recorrido');
  assert.ok(!app.visible('btnTutorial'), 'oculto mientras se ve el recorrido');
  clic(app, 'tutorialSaltar');
  app.w.tutorialRefrescar();
  assert.ok(app.visible('btnTutorial'));
});

// ═════════════════════════ Apertura automática la primera vez ═════════════════════════

test('la primera vez que se entra a una pantalla el recorrido se abre solo; después no', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.tutorialVigilar();
  assert.equal(app.ev('tutorialUltimaClave'), 'login');
  assert.equal(capa(app), null, 'espera un momento a que la pantalla cargue');
  await new Promise(r => setTimeout(r, 1400));
  assert.ok(capa(app), 'a los ~1,2 s se abre solo');

  app.w.tutorialCerrar();
  app.ev('tutorialUltimaClave = null');
  app.w.tutorialVigilar();
  await new Promise(r => setTimeout(r, 1400));
  assert.equal(capa(app), null, 'ya lo vio: no se abre de nuevo');
});

// ═════════════════════════ Centro de Ayuda ═════════════════════════

test('el Centro de Ayuda se abre, lista todos los temas con sus pasos y se cierra', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  assert.ok(app.visible('btnAyuda'), 'el botón de Ayuda se ve antes de ingresar');
  app.w.abrirAyuda();
  assert.ok(app.visible('modalAyuda'));
  const temas = app.ev('AYUDA_TEMAS.length');
  assert.ok(temas >= 12);
  assert.equal(app.$('listaAyuda').querySelectorAll('details').length, temas);
  assert.ok(app.$('listaAyuda').querySelectorAll('li').length > temas * 2);
  app.w.cerrarAyuda();
  assert.ok(!app.visible('modalAyuda'));
});

test('la ayuda explica cómo se llenan los campos y cubre cada rol', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.abrirAyuda();
  const texto = app.texto('listaAyuda');
  for (const tema of ['Primeros pasos del dueño', 'Registrarse como personal', 'Noches', 'Caja y precios', 'Anotar invitados', 'La puerta', 'Personal y permisos', 'Manija', 'Panda', 'Problemas frecuentes']) {
    assert.ok(texto.includes(tema), `falta el tema "${tema}"`);
  }
  for (const frase of ['30111222', '5493512345678', 'Socio', 'Cumpleaños', 'Entrada Paga', 'Precios en la puerta']) {
    assert.ok(texto.includes(frase), `la ayuda no menciona "${frase}"`);
  }
});

test('desde la ayuda se puede lanzar el recorrido de la pantalla actual', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.abrirAyuda();
  assert.ok(app.visible('btnVerRecorrido'));
  app.$('btnVerRecorrido').click();
  assert.ok(!app.visible('modalAyuda'));
  assert.ok(capa(app));
});

test('el contenido de la ayuda se escapa (no se interpreta como HTML)', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.ev("AYUDA_TEMAS.push({ nombre: '<img src=x onerror=\"window.__xssAyuda=1\">', paraQuien: 'x', resumen: 'r', pasos: ['<b>negrita</b>'] })");
  app.w.abrirAyuda();
  assert.equal(app.w.__xssAyuda, undefined);
  assert.equal(app.$('listaAyuda').querySelector('img'), null);
  assert.equal(app.$('listaAyuda').querySelector('b'), null);
});

test('mientras se cargan las noches no se confunde "cargando" con "sin noches"', async () => {
  const sinNoches = semilla();
  delete sinNoches.eventos.b1;
  const app = await cargarApp({ datos: sinNoches, cuentas: CUENTAS });
  await iniciarSesion(app, 'franco');
  assert.equal(clave(app), 'sinNoche', 'ya cargaron y no hay noches');

  app.ev('eventosCargados = false');
  assert.equal(clave(app), null, 'todavía cargando: no se decide');
});
