// Pruebas de las reglas de seguridad contra el EMULADOR oficial de Firebase.
// Se corren con:  npm run test:rules   (levanta el emulador solo; necesita Java)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

const DOMINIO = 'usuarios.somosmanijas.app';
const ROL_DUENO = 'Dueño del Boliche / Admin Local';
const RPP = 'RPP / Promotor';

let env;
// Marcas de tiempo REALES (≈1.7e12): una regla con tope numérico bajo rechazaría todo en producción
const AHORA = Date.now();

const staff = (username, rol, extra = {}) => ({ nombre: username, username, tel: '', rol, isAdmin: false, aprobado: true, ...extra });
const guest = (rppUid, extra = {}) => ({
  nombre: 'Juan', documento: '30111222', dni: '30111222', telefono: '', rppUid, rppNombre: 'RPP', tipoLista: 'Free',
  modo: 'boliche', cumpleanero: '', esCumpleanero: false, monto: 0, ts: AHORA, ...extra
});
const ingreso = (porUid, extra = {}) => ({ rppUid: 'uRpp', rppNombre: 'RPP', porUid, porNombre: 'Alguien', monto: 0, ts: AHORA, ...extra });

const SEMILLA = {
  superadmins: { uSuper: true },
  usuarios: {
    uOwner: { bid: 'b1' }, uRpp: { bid: 'b1' }, uRpp2: { bid: 'b1' }, uDj: { bid: 'b1' }, uPend: { bid: 'b1' }, uOwner2: { bid: 'b2' }
  },
  publicos: { b1: { nombre: 'Club XL', eventoActivo: 'e1' }, b2: { nombre: 'Otro Boliche' } },
  boliches: {
    b1: { nombre: 'Club XL', aprobado: true, creadoPor: 'uOwner', encargado: 'Franco', tel: '', creado: AHORA },
    b2: { nombre: 'Otro Boliche', aprobado: true, creadoPor: 'uOwner2', encargado: 'Ana', tel: '', creado: AHORA }
  },
  staff: {
    b1: {
      uOwner: staff('owner', ROL_DUENO, { isAdmin: true }),
      uRpp: staff('rpp', RPP),
      uRpp2: staff('rpp2', RPP),
      uDj: staff('dj', 'DJ / Artista'),
      uPend: staff('pend', RPP, { aprobado: false })
    },
    b2: { uOwner2: staff('owner2', ROL_DUENO, { isAdmin: true }) }
  },
  eventos: {
    b1: { e1: { nombre: 'Sábado', fecha: '2026-10-17', precioBoliche: 8000, precioAfter: 5000, pagoCabeza: 1000, sePagaRPP: true, sePagaDJ: true, ubiBoliche: '', ubiAfter: 'secreto', creado: AHORA } },
    b2: { e1: { nombre: 'Otro', fecha: '2026-10-17', creado: AHORA } }
  },
  invitados: {
    b1: { e1: { g1: guest('uRpp'), g2: guest('uRpp2', { dni: '30999888', documento: '30999888' }) } },
    b2: { e1: { x1: guest('uOwner2') } }
  },
  acceso: { b1: { e1: { after_30111222: { nombre: 'Juan', modo: 'after', tipoLista: 'Free', rpp: 'RPP', mapa: 'https://maps.example/x' } } } },
  djs: { b1: { e1: { d1: { nombre: 'DJ Uno', modo: 'boliche', monto: 100 } } } }
};

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nightlife',
    database: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'),
      host: '127.0.0.1',
      port: 9000
    }
  });
});

test.after(async () => { if (env) await env.cleanup(); });

test.beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async ctx => { await ctx.database().ref().set(SEMILLA); });
});

const como = (uid, username) => env.authenticatedContext(uid, { email: `${username}@${DOMINIO}` }).database();
const anonimo = () => env.unauthenticatedContext().database();

// ───────────────────────── Sin sesión ─────────────────────────
test('sin sesión: solo se ven los datos públicos', async () => {
  const db = anonimo();
  await assertSucceeds(db.ref('publicos').get());
  for (const ruta of ['boliches', 'boliches/b1', 'staff/b1', 'usuarios/uRpp', 'invitados/b1/e1', 'ingresos/b1/e1', 'eventos/b1', 'djs/b1/e1', 'logs/b1/e1', 'superadmins/uSuper', 'acceso/b1/e1']) {
    await assertFails(db.ref(ruta).get());
  }
});

test('sin sesión: no se puede escribir nada', async () => {
  const db = anonimo();
  await assertFails(db.ref('publicos/b9').set({ nombre: 'Falso' }));
  await assertFails(db.ref('invitados/b1/e1/zz').set(guest('x')));
  await assertFails(db.ref('acceso/b1/e1/boliche_30111222').set({ nombre: 'x', modo: 'boliche', tipoLista: 'Free' }));
});

test('Manija: lee UNA persona por DNI, pero no puede listar', async () => {
  const db = anonimo();
  const snap = await assertSucceeds(db.ref('acceso/b1/e1/after_30111222').get());
  assert.equal(snap.val().nombre, 'Juan');
  await assertFails(db.ref('acceso/b1/e1').get());
  await assertFails(db.ref('acceso/b1').get());
});

// ───────────────────────── Aislamiento entre boliches ─────────────────────────
test('un admin NO puede leer ni escribir los datos de otro boliche', async () => {
  const db = como('uOwner', 'owner');
  await assertSucceeds(db.ref('invitados/b1/e1').get());
  await assertFails(db.ref('invitados/b2/e1').get());
  await assertFails(db.ref('staff/b2').get());
  await assertFails(db.ref('eventos/b2').get());
  await assertFails(db.ref('invitados/b2/e1/nuevo').set(guest('uOwner')));
  await assertFails(db.ref('eventos/b2/e9').set({ nombre: 'x', fecha: '2026-10-18' }));
  await assertFails(db.ref('publicos/b2/eventoActivo').set('e1'));
});

test('el personal tampoco ve otros boliches', async () => {
  const db = como('uRpp', 'rpp');
  await assertFails(db.ref('invitados/b2/e1').get());
  await assertFails(db.ref('eventos/b2').get());
});

// ───────────────────────── Roles dentro de un boliche ─────────────────────────
test('RPP: lee la lista, anota a nombre propio, no a nombre de otro', async () => {
  const db = como('uRpp', 'rpp');
  await assertSucceeds(db.ref('invitados/b1/e1').get());
  await assertSucceeds(db.ref('invitados/b1/e1/nuevo').set(guest('uRpp', { dni: '31000111', documento: '31000111' })));
  await assertFails(db.ref('invitados/b1/e1/otro').set(guest('uRpp2', { dni: '31000222', documento: '31000222' })));
});

test('RPP: edita y borra lo suyo, no lo de otro RPP', async () => {
  const db = como('uRpp', 'rpp');
  await assertSucceeds(db.ref('invitados/b1/e1/g1/nombre').set('Juan Editado'));
  await assertFails(db.ref('invitados/b1/e1/g2/nombre').set('Hackeado'));
  await assertFails(db.ref('invitados/b1/e1/g2').remove());
  await assertSucceeds(db.ref('invitados/b1/e1/g1').remove());
});

test('RPP: no puede cambiar de dueño una anotación (robar la lista)', async () => {
  const db = como('uRpp', 'rpp');
  await assertFails(db.ref('invitados/b1/e1/g1/rppUid').set('uRpp2'));
  await assertFails(db.ref('invitados/b1/e1/g2/rppUid').set('uRpp'));
});

test('RPP: una vez que la persona ingresó, ya no puede editarla ni borrarla', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.database().ref('ingresos/b1/e1/boliche_30111222').set(ingreso('uOwner'));
  });
  const db = como('uRpp', 'rpp');
  await assertFails(db.ref('invitados/b1/e1/g1/nombre').set('Tarde'));
  await assertFails(db.ref('invitados/b1/e1/g1').remove());
  await assertSucceeds(como('uOwner', 'owner').ref('invitados/b1/e1/g1').remove());
});

test('RPP: datos inválidos se rechazan (DNI no numérico, monto negativo, campos de más)', async () => {
  const db = como('uRpp', 'rpp');
  await assertFails(db.ref('invitados/b1/e1/m1').set(guest('uRpp', { dni: 'abc' })));
  await assertFails(db.ref('invitados/b1/e1/m2').set(guest('uRpp', { dni: '31000333', monto: -5 })));
  await assertFails(db.ref('invitados/b1/e1/m3').set(guest('uRpp', { dni: '31000444', esAdmin: true })));
  await assertFails(db.ref('invitados/b1/e1/m4').set(guest('uRpp', { dni: '31000555', modo: 'otro' })));
});

test('RPP: no ve el historial ni la lista de personal, solo su propio perfil', async () => {
  const db = como('uRpp', 'rpp');
  await assertFails(db.ref('logs/b1/e1').get());
  await assertFails(db.ref('staff/b1').get());
  await assertSucceeds(db.ref('staff/b1/uRpp').get());
  await assertFails(db.ref('staff/b1/uRpp2').get());
});

test('RPP: no puede crear noches, DJs ni cambiar precios o el evento activo', async () => {
  const db = como('uRpp', 'rpp');
  await assertFails(db.ref('eventos/b1/e2').set({ nombre: 'Falsa', fecha: '2026-10-20' }));
  await assertFails(db.ref('eventos/b1/e1/precioBoliche').set(1));
  await assertFails(db.ref('djs/b1/e1/d2').set({ nombre: 'DJ', modo: 'boliche' }));
  await assertFails(db.ref('publicos/b1/eventoActivo').set('e1'));
});

test('DJ: ve la noche pero no anota ni marca ingresos', async () => {
  const db = como('uDj', 'dj');
  await assertSucceeds(db.ref('invitados/b1/e1').get());
  await assertFails(db.ref('invitados/b1/e1/dj1').set(guest('uDj', { dni: '31000999', documento: '31000999' })));
  await assertFails(db.ref('ingresos/b1/e1/boliche_30111222').set(ingreso('uDj')));
});

test('personal pendiente de aprobación no ve nada de la noche', async () => {
  const db = como('uPend', 'pend');
  await assertFails(db.ref('invitados/b1/e1').get());
  await assertFails(db.ref('eventos/b1').get());
  await assertSucceeds(db.ref('staff/b1/uPend').get());
  await assertSucceeds(db.ref('boliches/b1').get());
});

test('boliche no habilitado: ni su dueño accede a los datos', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await ctx.database().ref('boliches/b1/aprobado').set(false); });
  await assertFails(como('uOwner', 'owner').ref('invitados/b1/e1').get());
  await assertFails(como('uRpp', 'rpp').ref('invitados/b1/e1').get());
});

// ───────────────────────── Ingresos ─────────────────────────
test('ingreso: se crea una sola vez; el segundo portero no puede pisarlo', async () => {
  const uno = como('uRpp', 'rpp');
  const dos = como('uRpp2', 'rpp2');
  await assertSucceeds(uno.ref('ingresos/b1/e1/boliche_30111222').set(ingreso('uRpp')));
  await assertFails(dos.ref('ingresos/b1/e1/boliche_30111222').set(ingreso('uRpp2')));
});

test('ingreso: no se puede falsificar quién lo marcó, ni deshacer sin ser admin', async () => {
  const rpp = como('uRpp', 'rpp');
  await assertFails(rpp.ref('ingresos/b1/e1/boliche_30999888').set(ingreso('uRpp2')));
  await assertSucceeds(rpp.ref('ingresos/b1/e1/boliche_30999888').set(ingreso('uRpp')));
  await assertFails(rpp.ref('ingresos/b1/e1/boliche_30999888').remove());
  await assertSucceeds(como('uOwner', 'owner').ref('ingresos/b1/e1/boliche_30999888').remove());
});

test('ingreso: la clave debe tener el formato modo_dni', async () => {
  await assertFails(como('uRpp', 'rpp').ref('ingresos/b1/e1/cualquiera').set(ingreso('uRpp')));
});

// ───────────────────────── Admin del boliche ─────────────────────────
test('admin: crea noches, DJs, marca la activa y ve el historial', async () => {
  const db = como('uOwner', 'owner');
  await assertSucceeds(db.ref('eventos/b1/e2').set({ nombre: 'Viernes', fecha: '2026-10-23', creado: AHORA }));
  await assertSucceeds(db.ref('eventos/b1/e2/precioBoliche').set(9000));
  await assertSucceeds(db.ref('djs/b1/e1/d2').set({ nombre: 'DJ Dos', modo: 'after', monto: 5 }));
  await assertSucceeds(db.ref('publicos/b1/eventoActivo').set('e2'));
  await assertSucceeds(db.ref('publicos/b1/ubiBoliche').set('Calle 123'));
  await assertSucceeds(db.ref('logs/b1/e1').get());
  await assertSucceeds(db.ref('staff/b1').get());
});

test('admin: no puede cambiar el nombre público del boliche ni habilitarse solo', async () => {
  const db = como('uOwner', 'owner');
  await assertFails(db.ref('publicos/b1/nombre').set('Otro Nombre'));
  await assertFails(db.ref('boliches/b1/aprobado').set(true));
  await assertFails(db.ref('boliches/b1').remove());
});

test('admin: aprueba personal pendiente y da permisos, pero no a sí mismo', async () => {
  const db = como('uOwner', 'owner');
  await assertSucceeds(db.ref('staff/b1/uPend/aprobado').set(true));
  await assertSucceeds(db.ref('staff/b1/uRpp/isAdmin').set(true));
  await assertSucceeds(db.ref('staff/b1/uRpp2').remove());
  await assertFails(db.ref('staff/b1/uOwner/isAdmin').set(false));
  await assertFails(db.ref('staff/b1/uOwner').remove());
});

test('el historial se escribe solo como uno mismo y no se puede borrar', async () => {
  const rpp = como('uRpp', 'rpp');
  await assertSucceeds(rpp.ref('logs/b1/e1/l1').set({ uid: 'uRpp', texto: 'hizo algo', ts: AHORA }));
  await assertFails(rpp.ref('logs/b1/e1/l2').set({ uid: 'uOwner', texto: 'falso', ts: AHORA }));
  await assertFails(rpp.ref('logs/b1/e1/l1').set({ uid: 'uRpp', texto: 'reescrito', ts: AHORA }));
  await assertFails(rpp.ref('logs/b1/e1/l1').remove());
});

// ───────────────────────── Perfil propio ─────────────────────────
test('cada uno edita su nombre y teléfono, pero no su rol ni sus permisos', async () => {
  const db = como('uRpp', 'rpp');
  await assertSucceeds(db.ref('staff/b1/uRpp/nombre').set('Nuevo Nombre'));
  await assertSucceeds(db.ref('staff/b1/uRpp/tel').set('549351'));
  await assertFails(db.ref('staff/b1/uRpp/isAdmin').set(true));
  await assertFails(db.ref('staff/b1/uRpp/aprobado').set(false));
  await assertFails(db.ref('staff/b1/uRpp/rol').set(ROL_DUENO));
  await assertFails(db.ref('staff/b1/uRpp/username').set('otro'));
  await assertFails(como('uPend', 'pend').ref('staff/b1/uPend/aprobado').set(true));
});

test('el puntero usuario→boliche no se puede cambiar', async () => {
  await assertFails(como('uRpp', 'rpp').ref('usuarios/uRpp/bid').set('b2'));
  await assertFails(como('uRpp', 'rpp').ref('usuarios/uRpp').remove());
});

// ───────────────────────── Registro ─────────────────────────
test('registro de personal: entra pendiente y sin permisos', async () => {
  const db = como('uNuevo', 'nuevo');
  await assertSucceeds(db.ref().update({
    'staff/b1/uNuevo': staff('nuevo', RPP, { aprobado: false }),
    'usuarios/uNuevo': { bid: 'b1' }
  }));
});

test('registro de personal: no puede auto-aprobarse, auto-admin ni usar otro email', async () => {
  const db = como('uNuevo', 'nuevo');
  await assertFails(db.ref('staff/b1/uNuevo').set(staff('nuevo', RPP, { aprobado: true })));
  await assertFails(db.ref('staff/b1/uNuevo').set(staff('nuevo', RPP, { aprobado: false, isAdmin: true })));
  await assertFails(db.ref('staff/b1/uNuevo').set(staff('nuevo', ROL_DUENO, { aprobado: false })));
  await assertFails(db.ref('staff/b1/uNuevo').set(staff('suplantado', RPP, { aprobado: false })));
});

test('registro de personal: no se puede anotar en un boliche que no es público', async () => {
  await assertFails(como('uNuevo', 'nuevo').ref('staff/b9/uNuevo').set(staff('nuevo', RPP, { aprobado: false })));
});

test('registro de personal: no se puede dar de alta a otra persona', async () => {
  await assertFails(como('uNuevo', 'nuevo').ref('staff/b1/uOtro').set(staff('otro', RPP, { aprobado: false })));
});

test('registro de boliche nuevo: el dueño queda como admin pero el boliche pendiente', async () => {
  const db = como('uDueno', 'dueno');
  await assertSucceeds(db.ref().update({
    'boliches/bNuevo': { nombre: 'Mi Boliche', aprobado: false, creadoPor: 'uDueno', encargado: 'Yo', tel: '1', creado: AHORA },
    'staff/bNuevo/uDueno': staff('dueno', ROL_DUENO, { isAdmin: true }),
    'usuarios/uDueno': { bid: 'bNuevo' }
  }));
  // pendiente: todavía no accede a datos de noche, ni puede publicar nada
  await assertFails(db.ref('eventos/bNuevo/e1').set({ nombre: 'x', fecha: '2026-10-20' }));
  await assertFails(db.ref('publicos/bNuevo').set({ nombre: 'Mi Boliche' }));
});

test('registro de boliche: no se puede crear ya habilitado ni adueñarse de uno existente', async () => {
  const db = como('uDueno', 'dueno');
  await assertFails(db.ref().update({
    'boliches/bNuevo': { nombre: 'Mi Boliche', aprobado: true, creadoPor: 'uDueno', encargado: 'Yo', tel: '1', creado: AHORA },
    'staff/bNuevo/uDueno': staff('dueno', ROL_DUENO, { isAdmin: true })
  }));
  await assertFails(db.ref('staff/b1/uDueno').set(staff('dueno', ROL_DUENO, { isAdmin: true })));
  await assertFails(db.ref('boliches/b1').set({ nombre: 'Robado', aprobado: false, creadoPor: 'uDueno', encargado: '', tel: '', creado: AHORA }));
});

test('registro de boliche: no se puede crear admin sin crear el boliche a su nombre', async () => {
  await assertFails(como('uDueno', 'dueno').ref('staff/bFantasma/uDueno').set(staff('dueno', ROL_DUENO, { isAdmin: true })));
});

// ───────────────────────── Panda (superadmin) ─────────────────────────
test('Panda: habilita boliches, publica su nombre y lo ve todo', async () => {
  const db = como('uSuper', 'panda');
  await assertSucceeds(db.ref('boliches').get());
  await assertSucceeds(db.ref('invitados/b2/e1').get());
  await assertSucceeds(db.ref('boliches/b1/aprobado').set(false));
  await assertSucceeds(db.ref('publicos/b9').set({ nombre: 'Nuevo Habilitado' }));
});

test('nadie más puede marcarse superadmin ni leer esa lista', async () => {
  const db = como('uOwner', 'owner');
  await assertFails(db.ref('superadmins/uOwner').set(true));
  await assertFails(db.ref('superadmins').get());
  await assertSucceeds(db.ref('superadmins/uOwner').get()); // solo sabe que no lo es
});

// ───────────────────────── Acceso público (Manija) ─────────────────────────
test('el personal publica la hoja de acceso; datos con formato inválido se rechazan', async () => {
  const db = como('uRpp', 'rpp');
  await assertSucceeds(db.ref('acceso/b1/e1/boliche_30111222').set({ nombre: 'Juan', modo: 'boliche', tipoLista: 'Free', rpp: 'RPP', mapa: '' }));
  await assertFails(db.ref('acceso/b1/e1/clave_mala').set({ nombre: 'Juan', modo: 'boliche', tipoLista: 'Free' }));
  await assertFails(db.ref('acceso/b2/e1/boliche_30111222').set({ nombre: 'Juan', modo: 'boliche', tipoLista: 'Free' }));
});

// ───────────────────────── Borrado de toda una noche (Panda) ─────────────────────────
test('Panda puede borrar de una vez todos los datos de una noche; un admin común no', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const bd = ctx.database();
    await bd.ref('ingresos/b1/e1/boliche_30111222').set(ingreso('uOwner'));
    await bd.ref('logs/b1/e1/l1').set({ uid: 'uOwner', texto: 'algo', ts: AHORA });
  });
  const borrado = {
    'invitados/b1/e1': null, 'ingresos/b1/e1': null, 'djs/b1/e1': null, 'logs/b1/e1': null, 'acceso/b1/e1': null
  };
  await assertFails(como('uOwner', 'owner').ref().update(borrado));
  await assertFails(como('uRpp', 'rpp').ref().update(borrado));
  const panda = como('uSuper', 'panda'); // un contexto por usuario y por prueba
  await assertSucceeds(panda.ref().update(borrado));
  for (const ruta of ['invitados/b1/e1', 'ingresos/b1/e1', 'djs/b1/e1', 'logs/b1/e1']) {
    const snap = await panda.ref(ruta).get();
    assert.equal(snap.exists(), false, `${ruta} debería estar vacío`);
  }
});

// ───────────────────────── Rol Socio ─────────────────────────
test('Socio: se registra pendiente y sin permisos; no puede auto-aprobarse ni hacerse admin', async () => {
  const db = como('uSocioNuevo', 'socio1');
  await assertSucceeds(db.ref().update({
    'staff/b1/uSocioNuevo': staff('socio1', 'Socio', { aprobado: false }),
    'usuarios/uSocioNuevo': { bid: 'b1' }
  }));
  const otro = como('uSocioNuevo2', 'socio2');
  await assertFails(otro.ref('staff/b1/uSocioNuevo2').set(staff('socio2', 'Socio', { aprobado: false, isAdmin: true })));
  await assertFails(otro.ref('staff/b1/uSocioNuevo2').set(staff('socio2', 'Socio', { aprobado: true })));
});

test('Socio: el admin lo aprueba y le da permisos de admin en una sola operación', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.database().ref('staff/b1/uSocioNuevo').set(staff('socio1', 'Socio', { aprobado: false }));
  });
  const owner = como('uOwner', 'owner');
  await assertSucceeds(owner.ref().update({ 'staff/b1/uSocioNuevo/aprobado': true, 'staff/b1/uSocioNuevo/isAdmin': true }));
  const socio = como('uSocioNuevo', 'socio1');
  await assertSucceeds(socio.ref('staff/b1').get());
  await assertSucceeds(socio.ref('eventos/b1/e2').set({ nombre: 'Nueva', fecha: '2026-11-01', creado: AHORA }));
  await assertFails(socio.ref('invitados/b2/e1').get());
});

// ───────────────────────── Varios precios en la puerta ─────────────────────────
test('precios en puerta: el admin los carga con formato válido; el RPP no', async () => {
  const owner = como('uOwner', 'owner');
  await assertSucceeds(owner.ref('eventos/b1/e1/precios/boliche/p1').set({ nombre: 'Mujeres', monto: 5000 }));
  await assertSucceeds(owner.ref('eventos/b1/e1/precios/after/p2').set({ nombre: 'VIP', monto: 20000 }));
  await assertFails(owner.ref('eventos/b1/e1/precios/otro/p3').set({ nombre: 'X', monto: 1 }));
  await assertFails(owner.ref('eventos/b1/e1/precios/boliche/p4').set({ nombre: 'Negativo', monto: -1 }));
  await assertFails(owner.ref('eventos/b1/e1/precios/boliche/p5').set({ nombre: '', monto: 10 }));
  await assertFails(owner.ref('eventos/b1/e1/precios/boliche/p6').set({ nombre: 'Con extra', monto: 10, truco: true }));
  await assertFails(como('uRpp', 'rpp').ref('eventos/b1/e1/precios/boliche/p7').set({ nombre: 'Colado', monto: 1 }));
});

test('anotados e ingresos aceptan el nombre del precio cobrado', async () => {
  const rpp = como('uRpp', 'rpp');
  await assertSucceeds(rpp.ref('invitados/b1/e1/pn1').set(guest('uRpp', { dni: '32000001', documento: '32000001', tipoLista: 'Entrada Paga', monto: 5000, precioNombre: 'Mujeres' })));
  await assertFails(rpp.ref('invitados/b1/e1/pn2').set(guest('uRpp', { dni: '32000002', documento: '32000002', precioNombre: 'x'.repeat(41) })));
  await assertSucceeds(rpp.ref('ingresos/b1/e1/boliche_32000001').set(ingreso('uRpp', { monto: 5000, precioNombre: 'Mujeres' })));
});
