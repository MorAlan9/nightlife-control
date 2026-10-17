// Rol Socio y varios precios en la puerta.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, iniciarSesion, semilla, invitado, CUENTAS, staff, email } = require('./helpers');

async function entrar(usuario, { extra = {}, ...opciones } = {}) {
  const app = await cargarApp({ datos: semilla(extra), cuentas: CUENTAS, ...opciones });
  if (usuario) await iniciarSesion(app, usuario);
  return app;
}

async function anotar(app, { nombre, documento, tipo = 'Free' }) {
  app.$('nombre').value = nombre;
  app.$('documento').value = documento;
  app.$('tipoLista').value = tipo;
  await app.w.guardarInvitado({ preventDefault() {} });
  await app.tick();
}

const botonDe = (app, accion) => app.$('guestList').querySelector(`button[data-accion="${accion}"]`);
const invitadosEnBase = app => Object.values(app.leer('invitados/b1/e1') || {});

// ═════════════════════════ Rol Socio ═════════════════════════

test('un Socio se registra pendiente; al aprobarlo queda con permisos de admin', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.cambiarTabAuth('regPersonal');
  assert.ok([...app.$('regPersonalRol').options].some(o => o.value === 'Socio'));
  app.$('regPersonalBolicheSelect').value = 'b1';
  app.$('regPersonalNombre').value = 'Sergio Socio';
  app.$('regPersonalUsuario').value = 'sergio';
  app.$('regPersonalRol').value = 'Socio';
  app.$('regPersonalPassword').value = 'sergio-123';
  await app.w.registrarPersonal({ preventDefault() {} });
  await app.tick(10);
  const cuentaNueva = app.auth._cuentas.get(email('sergio'));
  const uid = cuentaNueva.uid;
  assert.equal(app.leer(`staff/b1/${uid}/rol`), 'Socio');
  assert.equal(app.leer(`staff/b1/${uid}/isAdmin`), false, 'antes de aprobarlo no es admin');

  const admin = await cargarApp({ datos: app.backend.datos(), cuentas: [...CUENTAS, cuentaNueva] });
  await iniciarSesion(admin, 'franco');
  assert.match(admin.texto('listaUsuariosGrid'), /al aprobar tendrá permisos de admin/);
  await admin.w.aprobarPersonal(uid);
  await admin.tick(10);
  assert.equal(admin.leer(`staff/b1/${uid}/aprobado`), true);
  assert.equal(admin.leer(`staff/b1/${uid}/isAdmin`), true);
});

test('un Socio aprobado ve y puede hacer lo mismo que el admin', async () => {
  const base = semilla();
  const extra = {
    staff: { ...base.staff, b1: { ...base.staff.b1, uSocio: staff('sergio', 'Socio', { isAdmin: true }) } },
    usuarios: { ...base.usuarios, uSocio: { bid: 'b1' } }
  };
  const app = await cargarApp({ datos: semilla(extra), cuentas: [...CUENTAS, { uid: 'uSocio', email: email('sergio'), password: 'clave123' }] });
  await iniciarSesion(app, 'sergio');
  assert.equal(app.$('headerUserRole').innerText, 'Socio');
  for (const id of ['panelAdmin', 'panelCajaAdmin', 'metricasCajaAdmin', 'seccionHistorial', 'accionesEvento']) {
    assert.ok(app.visible(id), `${id} debería verse`);
  }
  assert.ok(!app.visible('barAdminTools'), 'las herramientas de Panda siguen siendo solo de Panda');
  await app.w.aprobarPersonal('uPend');
  await app.tick();
  assert.equal(app.leer('staff/b1/uPend/aprobado'), true);
});

// ═════════════════════════ Varios precios en la puerta ═════════════════════════

async function agregarPrecioUI(app, nombre, monto) {
  app.$('precioNombreNuevo').value = nombre;
  app.$('precioMontoNuevo').value = String(monto);
  await app.w.agregarPrecio({ preventDefault() {} });
  await app.tick(8);
}

const eventoConPrecios = extraEvento => ({ eventos: { b1: { e1: { ...semilla().eventos.b1.e1, ...extraEvento } } } });
const mujeres = { precios: { boliche: { p1: { nombre: 'Mujeres', monto: 5000 } } } };

const conPrecios = (invitadoExtra = {}) => ({
  ...eventoConPrecios(mujeres),
  invitados: { b1: { e1: invitado('g1', { tipoLista: 'Entrada Paga', monto: 8000, precioNombre: 'General', ...invitadoExtra }) } }
});

test('el admin suma precios en la puerta por modo; no se repiten nombres', async () => {
  const app = await entrar('franco');
  assert.match(app.texto('listaPrecios'), /General \$8\.000/);
  await agregarPrecioUI(app, 'Mujeres', 5000);
  await agregarPrecioUI(app, 'mujeres', 1);
  assert.match(app.alertas.at(-1), /Ya hay un precio con ese nombre/);
  assert.match(app.texto('listaPrecios'), /Mujeres \$5\.000/);
  assert.equal(Object.values(app.leer('eventos/b1/e1/precios/boliche')).length, 1);

  app.w.cambiarModoEvento('after');
  assert.ok(!app.texto('listaPrecios').includes('Mujeres'), 'los precios son por modo');
});

test('un precio con monto inválido no se guarda, y un RPP no puede agregar precios', async () => {
  const admin = await entrar('franco');
  await agregarPrecioUI(admin, 'Raro', -5);
  assert.match(admin.alertas.at(-1), /monto válido/);
  assert.equal(admin.leer('eventos/b1/e1/precios'), null);

  const rpp = await entrar('lucas');
  assert.ok(!rpp.visible('panelCajaAdmin'));
  await agregarPrecioUI(rpp, 'Colado', 100);
  assert.equal(rpp.leer('eventos/b1/e1/precios'), null);
});

test('al anotar una Entrada Paga se elige el precio; el selector aparece solo si hay más de uno', async () => {
  const unico = await entrar('lucas');
  unico.$('tipoLista').value = 'Entrada Paga';
  unico.w.toggleOpcionesLista();
  assert.ok(!unico.visible('precioContainer'), 'con un solo precio no hace falta elegir');

  const varios = await entrar('lucas', { extra: eventoConPrecios({ precios: { boliche: { p1: { nombre: 'Mujeres', monto: 5000 }, p2: { nombre: 'VIP', monto: 15000 } } } }) });
  varios.$('tipoLista').value = 'Entrada Paga';
  varios.w.toggleOpcionesLista();
  assert.ok(varios.visible('precioContainer'));
  assert.deepEqual([...varios.$('precioLista').options].map(o => o.value), ['General', 'Mujeres', 'VIP']);

  varios.$('precioLista').value = 'Mujeres';
  await anotar(varios, { nombre: 'Ana', documento: '31000001', tipo: 'Entrada Paga' });
  const g = invitadosEnBase(varios)[0];
  assert.equal(g.monto, 5000);
  assert.equal(g.precioNombre, 'Mujeres');
});

test('en la puerta, con varios precios, se pregunta cuál se cobró y se registra', async () => {
  const app = await entrar('franco', { extra: conPrecios() });
  botonDe(app, 'marcar').click();
  await app.tick();
  assert.ok(app.visible('modalPrecio'));
  const botones = [...app.$('opcionesPrecio').querySelectorAll('button')];
  assert.equal(botones.length, 2);
  assert.match(botones[0].textContent, /como se anotó/);
  assert.equal(app.leer('ingresos/b1/e1'), null, 'todavía no se marcó nada');

  botones[1].click(); // Mujeres $5.000
  await app.tick(10);
  const ing = app.leer('ingresos/b1/e1/boliche_30111222');
  assert.equal(ing.monto, 5000);
  assert.equal(ing.precioNombre, 'Mujeres');
  assert.ok(!app.visible('modalPrecio'));
  assert.equal(app.$('statRecaudado').innerText, '$5.000');
  assert.match(app.texto('detallePrecios'), /Mujeres × 1 = \$5\.000/);
});

test('en la puerta, "como se anotó" cobra el precio original; cancelar no marca nada', async () => {
  const app = await entrar('franco', { extra: conPrecios() });
  botonDe(app, 'marcar').click();
  await app.tick();
  app.w.cerrarModalPrecio();
  assert.equal(app.leer('ingresos/b1/e1'), null);

  botonDe(app, 'marcar').click();
  await app.tick();
  app.$('opcionesPrecio').querySelectorAll('button')[0].click();
  await app.tick(10);
  assert.equal(app.leer('ingresos/b1/e1/boliche_30111222/monto'), 8000);
});

test('una lista Free no pregunta precio aunque haya varios, y con un solo precio se marca directo', async () => {
  const free = await entrar('franco', { extra: conPrecios({ tipoLista: 'Free', monto: 0, precioNombre: '' }) });
  botonDe(free, 'marcar').click();
  await free.tick(10);
  assert.ok(!free.visible('modalPrecio'));
  assert.equal(free.leer('ingresos/b1/e1/boliche_30111222/monto'), 0);

  const unico = await entrar('franco', { extra: { invitados: { b1: { e1: invitado('g1', { tipoLista: 'Entrada Paga', monto: 8000 }) } } } });
  botonDe(unico, 'marcar').click();
  await unico.tick(10);
  assert.ok(!unico.visible('modalPrecio'));
  assert.equal(unico.leer('ingresos/b1/e1/boliche_30111222/monto'), 8000);
});

test('quitar un precio no cambia lo que ya pagaron los anotados con él', async () => {
  const app = await entrar('franco', { extra: conPrecios({ monto: 5000, precioNombre: 'Mujeres' }) });
  await app.w.quitarPrecio('p1');
  await app.tick(8);
  assert.equal(app.leer('eventos/b1/e1/precios'), null);
  assert.equal(invitadosEnBase(app)[0].monto, 5000);
  botonDe(app, 'marcar').click();
  await app.tick(10);
  assert.equal(app.leer('ingresos/b1/e1/boliche_30111222/monto'), 5000);
  assert.equal(app.leer('ingresos/b1/e1/boliche_30111222/precioNombre'), 'Mujeres');
});

test('editar a alguien que pagó un precio especial conserva su monto', async () => {
  const app = await entrar('franco', { extra: conPrecios({ monto: 5000, precioNombre: 'Mujeres' }) });
  await app.w.eval(`db.ref('eventos/b1/e1/precios/boliche/p1/monto').set(7000)`);
  await app.tick(8);
  app.w.editarInvitado('g1');
  assert.equal(app.$('precioLista').value, 'Mujeres');
  app.$('nombre').value = 'Nombre corregido';
  await app.w.guardarInvitado({ preventDefault() {} });
  await app.tick(8);
  assert.equal(invitadosEnBase(app)[0].monto, 5000);
  assert.equal(invitadosEnBase(app)[0].nombre, 'Nombre corregido');
});
