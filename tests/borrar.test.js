// Borrar una noche (admin o Panda) y borrar una productora entera (solo Panda).
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, iniciarSesion, semilla, invitado, CUENTAS } = require('./helpers');

async function entrar(usuario, { extra = {}, ...opciones } = {}) {
  const app = await cargarApp({ datos: semilla(extra), cuentas: CUENTAS, ...opciones });
  if (usuario) await iniciarSesion(app, usuario);
  return app;
}

const nocheCompleta = () => ({
  invitados: { b1: { e1: invitado('g1') } },
  ingresos: { b1: { e1: { boliche_30111222: { rppUid: 'uLucas', rppNombre: 'Lucas', porUid: 'uOwner', porNombre: 'Franco', monto: 0, ts: 1 } } } },
  djs: { b1: { e1: { d1: { nombre: 'DJ', modo: 'boliche', monto: 10 } } } },
  logs: { b1: { e1: { l1: { uid: 'uOwner', texto: 'algo', ts: 1 } } } },
  acceso: { b1: { e1: { boliche_30111222: { nombre: 'Persona', modo: 'boliche', tipoLista: 'Free', rpp: 'Lucas', mapa: '' } } } }
});

const quedaAlgo = (app, ruta) => app.leer(ruta) !== null;

// ═════════════════════════ Borrar una noche ═════════════════════════

test('el botón "Borrar noche" lo ve el admin (con una noche elegida), no el RPP', async () => {
  const admin = await entrar('franco');
  assert.ok(admin.visible('accionesEvento'));
  assert.ok(admin.visible('btnBorrarNoche'));
  const rpp = await entrar('lucas');
  assert.ok(!rpp.visible('accionesEvento'));
});

test('el admin borra la noche escribiendo su nombre: se va todo lo que colgaba de ella', async () => {
  const app = await entrar('franco', { extra: nocheCompleta(), respuestaPrompt: 'Sábado' });
  await app.w.borrarNoche();
  await app.tick(10);
  for (const ruta of ['eventos/b1/e1', 'invitados/b1/e1', 'ingresos/b1/e1', 'djs/b1/e1', 'logs/b1/e1', 'acceso/b1/e1']) {
    assert.ok(!quedaAlgo(app, ruta), `${ruta} debería estar borrado`);
  }
  assert.equal(app.leer('publicos/b1/eventoActivo'), null, 'ya no es la noche pública');
  assert.equal(app.leer('publicos/b1/nombre'), 'Club XL', 'el boliche sigue público');
  assert.match(app.alertas.at(-1), /Noche borrada/);
  assert.ok(app.visible('sinEventoAviso'));
});

test('si el nombre no coincide o se cancela, no se borra nada', async () => {
  const mal = await entrar('franco', { extra: nocheCompleta(), respuestaPrompt: 'sabado' });
  await mal.w.borrarNoche();
  await mal.tick(8);
  assert.match(mal.alertas.at(-1), /no coincide/);
  assert.ok(quedaAlgo(mal, 'eventos/b1/e1') && quedaAlgo(mal, 'invitados/b1/e1'));

  const cancelado = await entrar('franco', { extra: nocheCompleta(), respuestaPrompt: null });
  await cancelado.w.borrarNoche();
  await cancelado.tick(8);
  assert.ok(quedaAlgo(cancelado, 'eventos/b1/e1') && quedaAlgo(cancelado, 'invitados/b1/e1'));
});

test('al borrar la noche seleccionada, se pasa a otra noche del mismo boliche', async () => {
  const base = semilla();
  const extra = { ...nocheCompleta(), eventos: { ...base.eventos, b1: { e1: base.eventos.b1.e1, e2: { nombre: 'Viernes', fecha: '2026-10-10', creado: 1 } } } };
  const app = await entrar('franco', { extra, respuestaPrompt: 'Sábado' });
  assert.equal(app.ev('eid'), 'e1');
  await app.w.borrarNoche();
  await app.tick(10);
  assert.equal(app.ev('eid'), 'e2');
  assert.ok(quedaAlgo(app, 'eventos/b1/e2'));
  assert.ok(!app.visible('sinEventoAviso'));
});

test('un RPP no puede borrar la noche aunque llame a la función', async () => {
  const app = await entrar('lucas', { extra: nocheCompleta(), respuestaPrompt: 'Sábado' });
  await app.w.borrarNoche();
  await app.tick(8);
  assert.ok(quedaAlgo(app, 'eventos/b1/e1') && quedaAlgo(app, 'invitados/b1/e1'));
});

test('si la base rechaza el borrado de la noche, se avisa y no se pierde nada', async () => {
  const app = await entrar('franco', { extra: nocheCompleta(), respuestaPrompt: 'Sábado', opcionesBackend: { rechazarEscrituraSi: ruta => ruta.includes('eventos/') } });
  await app.w.borrarNoche();
  assert.match(app.alertas.at(-1), /no permitió/);
  assert.ok(quedaAlgo(app, 'eventos/b1/e1'));
});

// ═════════════════════════ Borrar una productora ═════════════════════════

test('Panda ve el botón de borrar productora en cada tarjeta', async () => {
  const app = await entrar('panda');
  assert.equal(app.$('gridSolicitudesBoliches').querySelectorAll('button[data-accion="borrar-productora"]').length, 3);
});

test('Panda borra una productora entera escribiendo su nombre; las demás no se tocan', async () => {
  const app = await entrar('panda', { extra: nocheCompleta(), respuestaPrompt: 'Club XL' });
  await app.w.borrarProductora('b1');
  await app.tick(10);
  for (const ruta of ['boliches/b1', 'publicos/b1', 'staff/b1', 'eventos/b1', 'invitados/b1', 'ingresos/b1', 'djs/b1', 'logs/b1', 'acceso/b1']) {
    assert.ok(!quedaAlgo(app, ruta), `${ruta} debería estar borrado`);
  }
  for (const uid of ['uOwner', 'uLucas', 'uSofia', 'uDj', 'uPend']) assert.ok(!quedaAlgo(app, `usuarios/${uid}`), `usuarios/${uid} debería estar borrado`);
  assert.ok(quedaAlgo(app, 'boliches/b2') && quedaAlgo(app, 'staff/b2') && quedaAlgo(app, 'usuarios/uOwner2'), 'el otro boliche queda intacto');
  assert.match(app.alertas.at(-1), /Productora borrada/);
  assert.ok(!app.texto('gridSolicitudesBoliches').includes('Club XL'));
});

test('si Panda estaba mirando esa productora, la pantalla vuelve al panel central', async () => {
  const app = await entrar('panda', { respuestaPrompt: 'Club XL' });
  await app.w.gestionarBoliche('b1');
  await app.tick(10);
  assert.ok(app.visible('seccionListaControl'));
  await app.w.borrarProductora('b1');
  await app.tick(10);
  assert.ok(!app.visible('seccionListaControl'));
  assert.ok(app.visible('panelSuperAdminPanda'));
  assert.equal(app.ev('bolicheActual'), null);
});

test('borrar la productora con el nombre mal escrito o cancelando no borra nada', async () => {
  const mal = await entrar('panda', { respuestaPrompt: 'club xl' });
  await mal.w.borrarProductora('b1');
  await mal.tick(8);
  assert.match(mal.alertas.at(-1), /no coincide/);
  assert.ok(quedaAlgo(mal, 'boliches/b1') && quedaAlgo(mal, 'staff/b1'));

  const cancelado = await entrar('panda', { respuestaPrompt: null });
  await cancelado.w.borrarProductora('b1');
  await cancelado.tick(8);
  assert.ok(quedaAlgo(cancelado, 'boliches/b1'));
});

test('el admin de una productora no puede borrarla, ni siquiera llamando a la función', async () => {
  const app = await entrar('franco', { respuestaPrompt: 'Club XL' });
  await app.w.borrarProductora('b1');
  await app.tick(8);
  assert.ok(quedaAlgo(app, 'boliches/b1') && quedaAlgo(app, 'staff/b1'));
});
