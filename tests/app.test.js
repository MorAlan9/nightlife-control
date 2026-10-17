const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, iniciarSesion, semilla, invitado, CUENTAS, ROL_DUENO, RPP, staff, email } = require('./helpers');

// Abre la app con la base de ejemplo y deja iniciada la sesión de `usuario`
async function entrar(usuario, { extra = {}, ...opciones } = {}) {
  const app = await cargarApp({ datos: semilla(extra), cuentas: CUENTAS, ...opciones });
  if (usuario) await iniciarSesion(app, usuario);
  return app;
}

// Anota un invitado desde el formulario
async function anotar(app, { nombre, documento, tipo = 'Free', tel = '' }) {
  app.$('nombre').value = nombre;
  app.$('documento').value = documento;
  app.$('telefono').value = tel;
  app.$('tipoLista').value = tipo;
  await app.w.guardarInvitado({ preventDefault() {} });
  await app.tick();
}

const filas = app => [...app.$('guestList').querySelectorAll('tr')];
const botonDe = (app, accion) => app.$('guestList').querySelector(`button[data-accion="${accion}"]`);
const invitadosEnBase = (app, bid = 'b1', eid = 'e1') => Object.values(app.leer(`invitados/${bid}/${eid}`) || {});

// ═════════════════════════ Arranque y acceso ═════════════════════════

test('la página carga y muestra el login; borra la sesión vieja guardada con la contraseña', async () => {
  const app = await cargarApp();
  assert.ok(app.visible('authSection'));
  assert.ok(!app.visible('appDashboard'));
  assert.equal(app.w.localStorage.getItem('vortexx_current_user'), null);
});

test('ya no existe el indicador que revelaba qué letras de la contraseña eran correctas', async () => {
  const app = await cargarApp();
  app.$('loginPassword').value = 'abc';
  app.w.validarContrasenaEnVivo();
  const puntos = app.$('passwordFeedback').querySelectorAll('span');
  assert.equal(puntos.length, 3);
  assert.ok(!app.$('passwordFeedback').textContent.match(/[✓✗]/));
});

test('login correcto de un admin: ve su boliche y la noche activa', async () => {
  const app = await entrar('franco');
  assert.ok(app.visible('appDashboard'));
  assert.equal(app.$('headerUserName').innerText, 'Franco');
  assert.match(app.$('headerBolicheName').innerText, /Club XL/);
  assert.equal(app.ev('eid'), 'e1');
  assert.ok(app.visible('panelAdmin'));
});

test('contraseña o usuario incorrectos no entran', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  await iniciarSesion(app, 'franco', 'mala');
  assert.match(app.alertas.at(-1), /incorrectos/);
  await iniciarSesion(app, 'nadie', 'clave123');
  assert.match(app.alertas.at(-1), /incorrectos/);
  assert.ok(!app.visible('appDashboard'));
});

test('un boliche sin habilitar no puede entrar', async () => {
  const extra = { usuarios: { ...semilla().usuarios, uX: { bid: 'b3' } }, staff: { ...semilla().staff, b3: { uX: staff('zoe', ROL_DUENO, { isAdmin: true }) } } };
  const app = await cargarApp({ datos: semilla(extra), cuentas: [...CUENTAS, { uid: 'uX', email: email('zoe'), password: 'clave123' }] });
  await iniciarSesion(app, 'zoe');
  assert.match(app.alertas.at(-1), /Boliche\/After aún no fue habilitado/);
  assert.ok(!app.visible('appDashboard'));
});

test('personal pendiente de aprobación no puede entrar', async () => {
  const app = await entrar('pend');
  assert.match(app.alertas.at(-1), /todavía no fue aprobada/);
  assert.ok(!app.visible('appDashboard'));
});

test('una cuenta sin boliche asociado no entra', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: [...CUENTAS, { uid: 'uHuerfano', email: email('huerfano'), password: 'clave123' }] });
  await iniciarSesion(app, 'huerfano');
  assert.match(app.alertas.at(-1), /no está asociada/);
});

test('cerrar sesión vuelve al login', async () => {
  const app = await entrar('lucas');
  assert.ok(app.visible('appDashboard'));
  await app.w.cerrarSesion();
  await app.tick();
  assert.ok(app.visible('authSection'));
  assert.ok(!app.visible('appDashboard'));
});

test('una sesión que ya existía al abrir la página se recupera sola', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS, sesion: email('lucas') });
  assert.ok(app.visible('appDashboard'));
  assert.equal(app.$('headerUserName').innerText, 'Lucas');
});

test('si deshabilitan al usuario mientras está conectado, se cierra su sesión', async () => {
  const app = await entrar('lucas');
  assert.ok(app.visible('appDashboard'));
  await app.w.eval(`db.ref('staff/b1/uLucas/aprobado').set(false)`);
  await app.tick(10);
  assert.ok(!app.visible('appDashboard'));
  assert.match(app.alertas.at(-1), /deshabilitado o eliminado/);
});

test('si le quitan el rol de admin mientras está conectado, se oculta el panel de admin', async () => {
  const app = await entrar('franco');
  assert.ok(app.visible('panelAdmin'));
  await app.w.eval(`db.ref('staff/b1/uOwner/isAdmin').set(false)`);
  await app.tick(10);
  assert.ok(!app.visible('panelAdmin'));
});

// ═════════════════════════ Aislamiento entre boliches ═════════════════════════

test('cada boliche ve solo sus propios invitados', async () => {
  const extra = {
    invitados: {
      b1: { e1: { ...invitado('g1', { nombre: 'De Club XL' }) } },
      b2: { e1: { ...invitado('x1', { nombre: 'De Otro Boliche', dni: '40000000', documento: '40000000' }) } }
    }
  };
  const xl = await entrar('franco', { extra });
  assert.match(xl.texto('guestList'), /De Club XL/);
  assert.ok(!xl.texto('guestList').includes('De Otro Boliche'));

  const otro = await entrar('ana', { extra });
  assert.match(otro.texto('guestList'), /De Otro Boliche/);
  assert.ok(!otro.texto('guestList').includes('De Club XL'));
});

// ═════════════════════════ Registro ═════════════════════════

async function completarRegistroBoliche(app, { nombre = 'Secret After', usuario = 'anita', pass = 'secreta1' } = {}) {
  app.$('regBolicheNombre').value = nombre;
  app.$('regBolicheEncargado').value = 'Ana Gómez';
  app.$('regBolicheUsuario').value = usuario;
  app.$('regBolicheTel').value = '549351000';
  app.$('regBolichePassword').value = pass;
  await app.w.registrarBoliche({ preventDefault() {} });
  await app.tick(10);
}

test('registrar un boliche crea la cuenta, el boliche PENDIENTE y al dueño como admin', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  await completarRegistroBoliche(app);
  assert.match(app.alertas.at(-1), /Solicitud de Boliche enviada/);

  const cuenta = app.auth._cuentas.get(email('anita'));
  assert.ok(cuenta);
  const uid = cuenta.uid;
  const bid = app.leer(`usuarios/${uid}`).bid;
  assert.equal(app.leer(`boliches/${bid}/aprobado`), false);
  assert.equal(app.leer(`boliches/${bid}/creadoPor`), uid);
  assert.equal(app.leer(`staff/${bid}/${uid}/isAdmin`), true);
  assert.equal(app.leer(`staff/${bid}/${uid}/rol`), ROL_DUENO);
  assert.equal(app.leer(`publicos/${bid}`), null, 'no es público hasta que Panda lo habilite');
  assert.ok(app.visible('authSection'), 'termina en la pantalla de acceso, sin sesión');
});

test('la contraseña nunca se guarda en la base de datos', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  await completarRegistroBoliche(app, { pass: 'UnaClaveUnica9' });
  assert.ok(!JSON.stringify(app.backend.datos()).includes('UnaClaveUnica9'));
});

test('registro: usuarios reservados, formato y contraseña corta se rechazan', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  assert.match(app.ev("validarNuevoUsuario('manija','abcdef')"), /reservado/);
  assert.match(app.ev("validarNuevoUsuario('panda','abcdef')"), /reservado/);
  assert.match(app.ev("validarNuevoUsuario('a b','abcdef')"), /entre 3 y 30/);
  assert.match(app.ev("validarNuevoUsuario('Mayus','abcdef')"), /entre 3 y 30/);
  assert.match(app.ev("validarNuevoUsuario('bueno','123')"), /al menos 6/);
  assert.equal(app.ev("validarNuevoUsuario('nuevo.user','abcdef')"), '');
});

test('registro con un usuario que ya existe avisa y no crea nada', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  const antes = JSON.stringify(app.backend.datos());
  await completarRegistroBoliche(app, { usuario: 'franco' });
  assert.match(app.alertas.at(-1), /en uso/);
  assert.equal(JSON.stringify(app.backend.datos()), antes);
});

test('si la base rechaza el registro, se borra la cuenta (no quedan usuarios a medias)', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS, opcionesBackend: { rechazarEscrituraSi: ruta => ruta.includes('boliches/') } });
  await completarRegistroBoliche(app, { usuario: 'fallido' });
  assert.match(app.alertas.at(-1), /no permitió el registro/);
  assert.equal(app.auth._cuentas.has(email('fallido')), false);
});

test('registrar personal: queda PENDIENTE y sin permisos en el boliche elegido', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  app.w.cambiarTabAuth('regPersonal');
  const opciones = [...app.$('regPersonalBolicheSelect').options].map(o => o.textContent);
  assert.deepEqual(opciones.sort(), ['Club XL', 'Otro Boliche']);
  app.$('regPersonalBolicheSelect').value = 'b1';
  app.$('regPersonalNombre').value = 'Nico Pérez';
  app.$('regPersonalUsuario').value = 'nico';
  app.$('regPersonalTel').value = '549';
  app.$('regPersonalRol').value = RPP;
  app.$('regPersonalPassword').value = 'nico1234';
  await app.w.registrarPersonal({ preventDefault() {} });
  await app.tick(10);

  const uid = app.auth._cuentas.get(email('nico')).uid;
  assert.equal(app.leer(`staff/b1/${uid}/aprobado`), false);
  assert.equal(app.leer(`staff/b1/${uid}/isAdmin`), false);
  assert.equal(app.leer(`usuarios/${uid}/bid`), 'b1');
  assert.match(app.alertas.at(-1), /aprobar tu cuenta/);
});

test('el selector de boliches solo lista los habilitados (los pendientes no aparecen)', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS });
  assert.ok(![...app.$('manijaBolicheSelect').options].some(o => /Pendiente/.test(o.textContent)));
});

// ═════════════════════════ Panda ═════════════════════════

test('Panda ve el panel central; las herramientas peligrosas esperan a que elija un boliche', async () => {
  const app = await entrar('panda');
  assert.ok(app.visible('panelSuperAdminPanda'));
  assert.ok(!app.visible('barAdminTools'));
  assert.ok(!app.visible('seccionListaControl'));
  assert.match(app.texto('gridSolicitudesBoliches'), /Pendiente SA/);
  assert.match(app.texto('gridSolicitudesBoliches'), /PENDIENTE DE APROBACIÓN/);
});

test('un admin local NO tiene las herramientas de Panda ni el panel central', async () => {
  const app = await entrar('franco');
  assert.ok(!app.visible('barAdminTools'));
  assert.ok(!app.visible('panelSuperAdminPanda'));
});

test('Panda habilita un boliche (queda público) y lo puede deshabilitar', async () => {
  const app = await entrar('panda');
  await app.w.toggleEstadoAprobacionBoliche('b3');
  await app.tick();
  assert.equal(app.leer('boliches/b3/aprobado'), true);
  assert.equal(app.leer('publicos/b3/nombre'), 'Pendiente SA');

  await app.w.toggleEstadoAprobacionBoliche('b3');
  await app.tick();
  assert.equal(app.leer('boliches/b3/aprobado'), false);
  assert.equal(app.leer('publicos/b3'), null);
});

test('Panda puede entrar a mirar un boliche y ahí ve la noche y sus herramientas', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1', { nombre: 'Visible' }) } } };
  const app = await entrar('panda', { extra });
  await app.w.gestionarBoliche('b1');
  await app.tick(10);
  assert.ok(app.visible('barAdminTools'));
  assert.ok(app.visible('seccionListaControl'));
  assert.match(app.texto('guestList'), /Visible/);
});

test('Panda carga datos de ejemplo en la noche y los puede borrar', async () => {
  const app = await entrar('panda');
  await app.w.gestionarBoliche('b1');
  await app.tick(10);
  await app.w.cargarDatosDemo();
  await app.tick(10);
  assert.ok(invitadosEnBase(app).length >= 4);
  assert.equal(app.leer('eventos/b1/e1/precioBoliche'), 8000);

  await app.w.borrarDatosDeLaNoche();
  await app.tick(10);
  assert.equal(invitadosEnBase(app).length, 0);
  assert.equal(app.leer('acceso/b1/e1'), null);
  assert.equal(app.leer('eventos/b1/e1/nombre'), 'Sábado', 'la noche en sí no se borra');
});

test('si se cancela la confirmación, no se borra nada', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1') } } };
  const app = await entrar('panda', { extra, confirmar: false });
  await app.w.gestionarBoliche('b1');
  await app.tick(10);
  await app.w.borrarDatosDeLaNoche();
  assert.equal(invitadosEnBase(app).length, 1);
});

// ═════════════════════════ Noches (eventos) ═════════════════════════

test('el admin crea una noche nueva: queda activa para el público y seleccionada', async () => {
  const app = await entrar('franco');
  app.w.abrirModalEvento();
  app.$('eventoNombre').value = 'Viernes Neón';
  app.$('eventoFecha').value = '2026-10-23';
  await app.w.crearEvento({ preventDefault() {} });
  await app.tick(10);

  const eventos = app.leer('eventos/b1');
  const nuevoId = Object.keys(eventos).find(id => id !== 'e1');
  assert.equal(eventos[nuevoId].nombre, 'Viernes Neón');
  assert.equal(app.leer('publicos/b1/eventoActivo'), nuevoId);
  assert.equal(app.ev('eid'), nuevoId);
  assert.ok(!app.visible('modalEvento'));
});

test('la noche nueva copia precios y ubicaciones de la anterior, y arranca vacía', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1') } } };
  const app = await entrar('franco', { extra });
  app.w.abrirModalEvento();
  app.$('eventoNombre').value = 'Viernes';
  app.$('eventoFecha').value = '2026-10-23';
  await app.w.crearEvento({ preventDefault() {} });
  await app.tick(10);

  const nuevoId = app.ev('eid');
  assert.notEqual(nuevoId, 'e1');
  assert.equal(app.leer(`eventos/b1/${nuevoId}/precioBoliche`), 8000);
  assert.equal(app.leer(`eventos/b1/${nuevoId}/ubiAfter`), 'https://maps.example/after');
  assert.equal(filas(app).length, 1);
  assert.match(filas(app)[0].textContent, /No hay personas/);
});

test('cambiar de noche muestra los invitados de esa noche (no se mezclan)', async () => {
  const extra = {
    eventos: { b1: { e1: semilla().eventos.b1.e1, e2: { nombre: 'Viernes', fecha: '2026-10-10', creado: 1 } } },
    invitados: { b1: { e1: invitado('g1', { nombre: 'Del sábado' }), e2: invitado('g2', { nombre: 'Del viernes', dni: '40000001', documento: '40000001' }) } }
  };
  const app = await entrar('franco', { extra });
  assert.match(app.texto('guestList'), /Del sábado/);
  app.w.cambiarEvento('e2');
  await app.tick(10);
  assert.match(app.texto('guestList'), /Del viernes/);
  assert.ok(!app.texto('guestList').includes('Del sábado'));
});

test('quien ingresó en una noche no figura adentro en otra', async () => {
  const extra = {
    eventos: { b1: { e1: semilla().eventos.b1.e1, e2: { nombre: 'Viernes', fecha: '2026-10-10', creado: 1 } } },
    invitados: { b1: { e1: invitado('g1'), e2: invitado('g2') } },
    ingresos: { b1: { e1: { boliche_30111222: { rppUid: 'uLucas', rppNombre: 'Lucas', porUid: 'uOwner', porNombre: 'Franco', monto: 0, ts: 1 } } } }
  };
  const app = await entrar('franco', { extra });
  assert.match(app.texto('guestList'), /INGRESÓ/);
  app.w.cambiarEvento('e2');
  await app.tick(10);
  assert.match(app.texto('guestList'), /PENDIENTE/);
});

test('sin ninguna noche: se avisa y no se puede anotar', async () => {
  const sinNoches = semilla();
  delete sinNoches.eventos.b1;
  delete sinNoches.publicos.b1.eventoActivo;
  const app = await cargarApp({ datos: sinNoches, cuentas: CUENTAS });
  await iniciarSesion(app, 'franco');
  assert.ok(app.visible('sinEventoAviso'));
  assert.match(app.texto('sinEventoAviso'), /Nueva noche/);
  assert.ok(!app.visible('contenedorFormCarga'));

  const rpp = await cargarApp({ datos: sinNoches, cuentas: CUENTAS });
  await iniciarSesion(rpp, 'lucas');
  assert.match(rpp.texto('sinEventoAviso'), /administrador/);
});

test('un RPP no puede crear noches ni cambiar cuál es la activa', async () => {
  const app = await entrar('lucas');
  assert.ok(!app.visible('accionesEvento'));
  await app.w.crearEvento({ preventDefault() {} });
  await app.w.marcarEventoActivo();
  assert.equal(Object.keys(app.leer('eventos/b1')).length, 1);
});

test('marcar otra noche como activa la publica para el público', async () => {
  const extra = { eventos: { b1: { e1: semilla().eventos.b1.e1, e2: { nombre: 'Viernes', fecha: '2026-10-10', creado: 1 } } } };
  const app = await entrar('franco', { extra });
  app.w.cambiarEvento('e2');
  await app.tick(10);
  assert.ok(app.visible('btnEventoActivo'));
  await app.w.marcarEventoActivo();
  await app.tick(10);
  assert.equal(app.leer('publicos/b1/eventoActivo'), 'e2');
  assert.ok(app.visible('badgeEventoActivo'));
});

// ═════════════════════════ Invitados ═════════════════════════

test('un RPP anota a alguien: queda un registro propio y la hoja de acceso pública', async () => {
  const app = await entrar('lucas');
  await anotar(app, { nombre: 'Juan Pérez', documento: '30.111.222', tel: '549351' });

  const [g] = invitadosEnBase(app);
  assert.equal(g.nombre, 'Juan Pérez');
  assert.equal(g.dni, '30111222');
  assert.equal(g.rppUid, 'uLucas');
  assert.equal(g.modo, 'boliche');
  assert.equal(app.leer('acceso/b1/e1/boliche_30111222/nombre'), 'Juan Pérez');
  assert.match(app.texto('guestList'), /Juan Pérez/);
});

test('dos RPP anotando a la vez no se pisan: cada anotación es un registro aparte', async () => {
  // Misma base compartida: Lucas y Sofía escriben sin esperar a ver lo del otro
  const lucas = await entrar('lucas');
  const sofia = await cargarApp({ datos: lucas.backend.datos(), cuentas: CUENTAS });
  await iniciarSesion(sofia, 'sofia');
  await Promise.all([
    anotar(lucas, { nombre: 'De Lucas', documento: '30000001' }),
    anotar(sofia, { nombre: 'De Sofia', documento: '30000002' })
  ]);
  assert.equal(invitadosEnBase(lucas).length, 1);
  assert.equal(invitadosEnBase(sofia).length, 1);

  // En una sola base, anotar a nombre de dos RPP seguidos deja los dos registros
  const compartida = await entrar('lucas');
  await anotar(compartida, { nombre: 'Primero', documento: '30000003' });
  await compartida.w.cerrarSesion();
  await compartida.tick();
  await iniciarSesion(compartida, 'sofia');
  await anotar(compartida, { nombre: 'Segundo', documento: '30000004' });
  assert.equal(invitadosEnBase(compartida).length, 2);
});

test('no se anota dos veces al mismo DNI en la misma lista (aunque cambie el formato)', async () => {
  const app = await entrar('lucas');
  await anotar(app, { nombre: 'Juan', documento: '30111222' });
  await anotar(app, { nombre: 'Juan', documento: '30.111.222' });
  assert.match(app.alertas.at(-1), /ya está anotada/);
  assert.equal(invitadosEnBase(app).length, 1);
});

test('DNI vacío, corto o con letras se rechaza', async () => {
  const app = await entrar('lucas');
  await anotar(app, { nombre: 'Sin Dni', documento: 'abc' });
  assert.match(app.alertas.at(-1), /DNI válido/);
  await anotar(app, { nombre: 'Corto', documento: '123' });
  assert.equal(invitadosEnBase(app).length, 0);
});

test('Entrada Paga toma el precio de LA NOCHE; editar no lo cambia retroactivamente', async () => {
  const app = await entrar('lucas');
  await anotar(app, { nombre: 'Ana', documento: '55555555', tipo: 'Entrada Paga' });
  const [g] = invitadosEnBase(app);
  assert.equal(g.monto, 8000);

  await app.w.eval(`db.ref('eventos/b1/e1/precioBoliche').set(12000)`);
  await app.tick();
  app.w.editarInvitado(app.ev('invitados[0].id'));
  app.$('nombre').value = 'Ana María';
  await app.w.guardarInvitado({ preventDefault() {} });
  await app.tick();
  assert.equal(invitadosEnBase(app)[0].monto, 8000);
  assert.equal(invitadosEnBase(app)[0].nombre, 'Ana María');
});

test('un RPP edita y quita lo suyo, pero no lo de otro RPP', async () => {
  const extra = { invitados: { b1: { e1: { ...invitado('g1', { nombre: 'Mío' }), ...invitado('g2', { nombre: 'De Sofia', rppUid: 'uSofia', rppNombre: 'Sofia', dni: '30999888', documento: '30999888' }) } } } };
  const app = await entrar('lucas', { extra });
  const tr = filas(app).find(f => f.textContent.includes('De Sofia'));
  assert.equal(tr.querySelector('button[data-accion="editar"]'), null);
  assert.equal(tr.querySelector('button[data-accion="quitar"]'), null);

  await app.w.eliminarInvitado('g2');
  assert.match(app.alertas.at(-1), /permiso/);
  assert.equal(invitadosEnBase(app).length, 2);

  await app.w.eliminarInvitado('g1');
  await app.tick();
  assert.equal(invitadosEnBase(app).length, 1);
});

test('el admin puede quitar a cualquiera', async () => {
  const extra = { invitados: { b1: { e1: invitado('g2', { nombre: 'De Sofia', rppUid: 'uSofia', rppNombre: 'Sofia' }) } } };
  const app = await entrar('franco', { extra });
  await app.w.eliminarInvitado('g2');
  await app.tick();
  assert.equal(invitadosEnBase(app).length, 0);
});

test('quitar a una persona borra su hoja pública, salvo que siga en la lista de otro RPP', async () => {
  const extra = {
    invitados: { b1: { e1: { ...invitado('g1'), ...invitado('g2', { rppUid: 'uSofia', rppNombre: 'Sofia' }) } } },
    acceso: { b1: { e1: { boliche_30111222: { nombre: 'Persona', modo: 'boliche', tipoLista: 'Free', rpp: 'Lucas', mapa: '' } } } }
  };
  const app = await entrar('franco', { extra });
  await app.w.eliminarInvitado('g1');
  await app.tick();
  assert.ok(app.leer('acceso/b1/e1/boliche_30111222'), 'sigue en la lista de Sofia');
  await app.w.eliminarInvitado('g2');
  await app.tick();
  assert.equal(app.leer('acceso/b1/e1/boliche_30111222'), null);
});

test('un RPP no puede editar ni quitar a alguien que ya ingresó', async () => {
  const extra = {
    invitados: { b1: { e1: invitado('g1') } },
    ingresos: { b1: { e1: { boliche_30111222: { rppUid: 'uLucas', rppNombre: 'Lucas', porUid: 'uOwner', porNombre: 'Franco', monto: 0, ts: 1 } } } }
  };
  const app = await entrar('lucas', { extra });
  await app.w.eliminarInvitado('g1');
  assert.match(app.alertas.at(-1), /permiso/);
  assert.equal(invitadosEnBase(app).length, 1);
});

test('el DJ no tiene formulario para anotar ni botón de Marcar', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1') } } };
  const app = await entrar('dj', { extra });
  assert.ok(!app.visible('contenedorFormCarga'));
  assert.equal(botonDe(app, 'marcar'), null);
});

// ═════════════════════════ Ingresos ═════════════════════════

test('marcar ingreso crea UN registro de ingreso con quién lo marcó y el monto', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1', { tipoLista: 'Entrada Paga', monto: 8000 }) } } };
  const app = await entrar('franco', { extra });
  botonDe(app, 'marcar').click();
  await app.tick(10);

  const ing = app.leer('ingresos/b1/e1/boliche_30111222');
  assert.equal(ing.porUid, 'uOwner');
  assert.equal(ing.rppUid, 'uLucas');
  assert.equal(ing.monto, 8000);
  assert.match(app.texto('guestList'), /DENTRO/);
});

test('la misma persona en dos RPP se agrupa, y al marcar se elige por cuál lista entra', async () => {
  const extra = {
    invitados: { b1: { e1: { ...invitado('g1', { dni: '38123456', documento: '38.123.456', nombre: 'Martín' }), ...invitado('g2', { dni: '38123456', documento: '38123456', nombre: 'Martín', rppUid: 'uSofia', rppNombre: 'Sofia' }) } } }
  };
  const app = await entrar('franco', { extra });
  assert.equal(filas(app).length, 1);
  assert.match(app.texto('guestList'), /Duplicado en 2 RPPs/);

  botonDe(app, 'marcar').click();
  assert.ok(app.visible('modalConflicto'));
  const opciones = app.$('opcionesRppConflicto').querySelectorAll('button');
  assert.equal(opciones.length, 2);
  opciones[1].click(); // Sofía
  await app.tick(10);

  assert.equal(app.leer('ingresos/b1/e1/boliche_38123456/rppUid'), 'uSofia');
  assert.ok(!app.visible('modalConflicto'));
  assert.match(app.texto('guestList'), /Entró por otro RPP/);
});

test('un segundo "Marcar" sobre alguien que ya entró no lo duplica', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1') } } };
  const app = await entrar('franco', { extra });
  await app.w.ejecutarIngreso('g1');
  await app.tick(10);
  await app.w.ejecutarIngreso('g1');
  assert.match(app.alertas.at(-1), /ya figura como ingresada/);
});

test('si la base rechaza el ingreso (otro portero llegó primero), se avisa', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1') } } };
  const app = await entrar('franco', { extra, opcionesBackend: { rechazarEscrituraSi: ruta => ruta.includes('ingresos') } });
  await app.w.ejecutarIngreso('g1');
  assert.match(app.alertas.at(-1), /no permitió/);
  assert.equal(app.leer('ingresos/b1/e1'), null);
});

test('el ingreso en el boliche no cuenta para la lista del After', async () => {
  const extra = { invitados: { b1: { e1: { ...invitado('g1'), ...invitado('g2', { modo: 'after' }) } } } };
  const app = await entrar('franco', { extra });
  await app.w.ejecutarIngreso('g1');
  await app.tick(10);
  assert.ok(app.leer('ingresos/b1/e1/boliche_30111222'));
  assert.equal(app.leer('ingresos/b1/e1/after_30111222'), null);
  app.w.cambiarModoEvento('after');
  assert.match(app.texto('guestList'), /PENDIENTE/);
});

test('solo el admin puede deshacer un ingreso', async () => {
  const extra = {
    invitados: { b1: { e1: invitado('g1') } },
    ingresos: { b1: { e1: { boliche_30111222: { rppUid: 'uLucas', rppNombre: 'Lucas', porUid: 'uOwner', porNombre: 'Franco', monto: 0, ts: 1 } } } }
  };
  const rpp = await entrar('lucas', { extra });
  assert.equal(botonDe(rpp, 'deshacer'), null);

  const admin = await entrar('franco', { extra });
  botonDe(admin, 'deshacer').click();
  await admin.tick(10);
  assert.equal(admin.leer('ingresos/b1/e1'), null);
});

// ═════════════════════════ Caja y rendimiento ═════════════════════════

const conDuplicadoPagado = () => ({
  invitados: { b1: { e1: { ...invitado('g1', { tipoLista: 'Entrada Paga', monto: 8000, dni: '38123456', documento: '38123456' }), ...invitado('g2', { tipoLista: 'Entrada Paga', monto: 8000, dni: '38123456', documento: '38123456', rppUid: 'uSofia', rppNombre: 'Sofia' }) } } }
});

test('caja: una persona duplicada en dos listas paga UNA sola entrada', async () => {
  const app = await entrar('franco', { extra: conDuplicadoPagado() });
  await app.w.ejecutarIngreso('g1');
  await app.tick(10);
  assert.equal(String(app.$('statTotal').innerText), '1');
  assert.equal(String(app.$('statIngresaron').innerText), '1');
  assert.equal(app.$('statRecaudado').innerText, '$8.000');
  assert.equal(app.$('statBalance').innerText, '$7.000'); // 8000 - 1000 de comisión
});

test('las métricas son de toda la noche: no cambian al buscar ni filtrar', async () => {
  const extra = { invitados: { b1: { e1: { ...invitado('g1', { nombre: 'Ana' }), ...invitado('g2', { nombre: 'Beto', dni: '30000002', documento: '30000002' }) } } } };
  const app = await entrar('franco', { extra });
  assert.equal(String(app.$('statTotal').innerText), '2');
  app.$('searchInput').value = 'ana';
  app.w.filtrarInvitados();
  assert.equal(filas(app).length, 1);
  assert.equal(String(app.$('statTotal').innerText), '2');
});

test('balance: descuenta cachets y comisiones, sin NaN si falta un monto', async () => {
  const extra = {
    invitados: { b1: { e1: invitado('g1', { tipoLista: 'Entrada Paga', monto: 10000 }) } },
    ingresos: { b1: { e1: { boliche_30111222: { rppUid: 'uLucas', rppNombre: 'Lucas', porUid: 'uOwner', porNombre: 'Franco', monto: 10000, ts: 1 } } } },
    djs: { b1: { e1: { d1: { nombre: 'A', modo: 'boliche', monto: 3000 }, d2: { nombre: 'B', modo: 'boliche' } } } }
  };
  const app = await entrar('franco', { extra });
  assert.equal(app.$('statBalance').innerText, '$6.000'); // 10000 - 3000 - 1000
});

test('rendimiento del RPP: el ingreso se acredita solo a quien corresponde', async () => {
  const lucas = await entrar('lucas', { extra: conDuplicadoPagado() });
  await lucas.w.ejecutarIngreso('g1');
  await lucas.tick(10);
  assert.equal(String(lucas.$('rppAnotados').innerText), '1');
  assert.equal(String(lucas.$('rppIngresados').innerText), '1');
  assert.equal(lucas.$('rppComision').innerText, '$1.000');

  const sofia = await cargarApp({ datos: lucas.backend.datos(), cuentas: CUENTAS });
  await iniciarSesion(sofia, 'sofia');
  assert.equal(String(sofia.$('rppIngresados').innerText), '0');
  assert.equal(String(sofia.$('rppPendientes').innerText), '0');
});

test('guardar precios persiste en la noche elegida, no en las demás', async () => {
  const extra = { eventos: { b1: { e1: semilla().eventos.b1.e1, e2: { nombre: 'Otra', fecha: '2026-10-01', creado: 1, precioBoliche: 100 } } } };
  const app = await entrar('franco', { extra });
  app.$('precioBoliche').value = '9000';
  app.$('pagoPorCabeza').value = '1500';
  await app.w.guardarPrecios();
  await app.tick();
  assert.equal(app.leer('eventos/b1/e1/precioBoliche'), 9000);
  assert.equal(app.leer('eventos/b1/e1/pagoCabeza'), 1500);
  assert.equal(app.leer('eventos/b1/e2/precioBoliche'), 100);
});

// ═════════════════════════ Búsqueda y filtros ═════════════════════════

const lista3 = () => ({
  invitados: {
    b1: { e1: {
      ...invitado('g1', { nombre: 'Camila Rossi', documento: '40987654', dni: '40987654', telefono: '549351555222', tipoLista: 'Cumpleaños', cumpleanero: 'Camila Rossi' }),
      ...invitado('g2', { nombre: 'Pedro Gómez', documento: '35111222', dni: '35111222', telefono: '5493516667777' }),
      ...invitado('g3', { nombre: 'Lola', documento: '36000111', dni: '36000111', tipoLista: 'Entrada Paga', rppUid: 'uSofia', rppNombre: 'Sofia' })
    } }
  }
});

async function buscar(app, texto) {
  app.$('searchInput').value = texto;
  app.w.filtrarInvitados();
  return filas(app).map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
}

test('búsqueda por nombre, DNI (con o sin puntos), teléfono y cumpleañero', async () => {
  const app = await entrar('franco', { extra: lista3() });
  assert.equal((await buscar(app, 'pedro')).length, 1);
  assert.equal((await buscar(app, '40987654')).length, 1);
  assert.equal((await buscar(app, '40.987.654')).length, 1);
  assert.equal((await buscar(app, '6667777')).length, 1);
  assert.equal((await buscar(app, 'camila')).length, 1);
  assert.match((await buscar(app, 'zzzz'))[0], /No hay personas/);
});

test('filtros por tipo de lista y por RPP', async () => {
  const app = await entrar('franco', { extra: lista3() });
  app.$('filtroTipoLista').value = 'Cumpleaños';
  app.w.filtrarInvitados();
  assert.equal(filas(app).length, 1);

  app.$('filtroTipoLista').value = 'TODOS';
  app.$('filtroRppTabla').value = 'uSofia';
  app.w.filtrarInvitados();
  assert.equal(filas(app).length, 1);
  assert.match(app.texto('guestList'), /Lola/);
});

test('el filtro de RPP elegido se mantiene cuando llegan datos nuevos en vivo', async () => {
  const app = await entrar('franco', { extra: lista3() });
  app.$('filtroRppTabla').value = 'uSofia';
  await app.w.eval(`db.ref('invitados/b1/e1/zzz').set({nombre:'Nuevo',documento:'37000000',dni:'37000000',telefono:'',rppUid:'uLucas',rppNombre:'Lucas',tipoLista:'Free',modo:'boliche',cumpleanero:'',esCumpleanero:false,monto:0,ts:5})`);
  await app.tick(10);
  assert.equal(app.$('filtroRppTabla').value, 'uSofia');
});

test('modo After muestra solo los invitados del after', async () => {
  const extra = { invitados: { b1: { e1: { ...invitado('g1', { nombre: 'Boli' }), ...invitado('g2', { nombre: 'Aftero', modo: 'after', dni: '30000002', documento: '30000002' }) } } } };
  const app = await entrar('franco', { extra });
  assert.match(app.texto('guestList'), /Boli/);
  app.w.cambiarModoEvento('after');
  assert.match(app.texto('guestList'), /Aftero/);
  assert.ok(!app.texto('guestList').includes('Boli '));
});

// ═════════════════════════ Manija (público) ═════════════════════════

async function comoManija(extra = {}, boliche = 'b1') {
  const app = await cargarApp({ datos: semilla(extra), cuentas: CUENTAS });
  app.w.cambiarTabAuth('manija');
  app.$('manijaBolicheSelect').value = boliche;
  app.w.ingresarComoManija();
  await app.tick();
  return app;
}

async function consultar(app, dni) {
  app.$('inputDniManija').value = dni;
  await app.w.consultarDniManija({ preventDefault() {} });
  await app.tick();
}

const acceso = {
  acceso: { b1: { e1: {
    boliche_30111222: { nombre: 'Juan Pérez', modo: 'boliche', tipoLista: 'Free', rpp: 'Lucas', mapa: '' },
    after_30111222: { nombre: 'Juan Pérez', modo: 'after', tipoLista: 'Free', rpp: 'Lucas', mapa: 'https://maps.example/after' }
  } } }
};

test('Manija entra sin cuenta, y solo ve la consulta por DNI (no la lista, ni formularios)', async () => {
  const app = await comoManija({ ...acceso, invitados: { b1: { e1: invitado('g1', { nombre: 'Secreto' }) } } });
  assert.ok(app.visible('appDashboard'));
  assert.ok(app.visible('seccionManija'));
  for (const id of ['seccionListaControl', 'seccionUbicaciones', 'seccionDjs', 'contenedorFormCarga', 'panelAdmin', 'barAdminTools', 'barraEvento', 'selectorModoEvento']) {
    assert.ok(!app.visible(id), `${id} debería estar oculto`);
  }
  assert.ok(!app.texto('guestList').includes('Secreto'));
});

test('Manija consulta su DNI y ve su lugar y el mapa del After', async () => {
  const app = await comoManija(acceso);
  await consultar(app, '30.111.222');
  const texto = app.texto('resultadoManija');
  assert.match(texto, /Estás en la lista/);
  assert.match(texto, /Juan Pérez/);
  const enlace = app.$('resultadoManija').querySelector('a');
  assert.equal(enlace.href, 'https://maps.example/after');
  assert.equal(enlace.rel, 'noopener');
});

test('Manija con un DNI que no está en la lista no ve nada', async () => {
  const app = await comoManija(acceso);
  await consultar(app, '99999999');
  assert.match(app.texto('resultadoManija'), /no figura/);
  assert.equal(app.$('resultadoManija').querySelector('a'), null);
});

test('Manija: si la ubicación del After no está cargada, lo dice', async () => {
  const sinMapa = { acceso: { b1: { e1: { after_30111222: { nombre: 'Juan', modo: 'after', tipoLista: 'Free', rpp: 'Lucas', mapa: '' } } } } };
  const app = await comoManija(sinMapa);
  await consultar(app, '30111222');
  assert.match(app.texto('resultadoManija'), /aún no fue cargada/);
});

test('Manija: un enlace raro en el mapa no se convierte en javascript:', async () => {
  const malo = { acceso: { b1: { e1: { after_30111222: { nombre: 'Juan', modo: 'after', tipoLista: 'Free', rpp: 'Lucas', mapa: 'javascript:alert(1)' } } } } };
  const app = await comoManija(malo);
  await consultar(app, '30111222');
  assert.ok(app.$('resultadoManija').querySelector('a').href.startsWith('https://maps.google.com/?q='));
});

test('Manija: sin una noche activa publicada, no hay consulta', async () => {
  const sinActiva = semilla();
  delete sinActiva.publicos.b1.eventoActivo;
  const app = await cargarApp({ datos: sinActiva, cuentas: CUENTAS });
  app.$('manijaBolicheSelect').value = 'b1';
  app.w.ingresarComoManija();
  await consultar(app, '30111222');
  assert.match(app.texto('resultadoManija'), /todavía no publicó una noche/);
});

test('Manija: muestra el mapa del boliche solo si el boliche lo publicó', async () => {
  const conMapa = semilla();
  conMapa.publicos.b1.ubiBoliche = 'Av. Siempre Viva 742';
  const app = await cargarApp({ datos: conMapa, cuentas: CUENTAS });
  app.$('manijaBolicheSelect').value = 'b1';
  app.w.ingresarComoManija();
  await app.tick();
  assert.ok(app.visible('btnBolicheManija'));
  assert.match(app.$('btnBolicheManija').href, /Av\.%20Siempre%20Viva%20742/);
});

test('Manija no puede anotar ni marcar nada aunque llame a las funciones', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1') } } };
  const app = await comoManija(extra);
  await anotar(app, { nombre: 'Intruso', documento: '31000000' });
  await app.w.ejecutarIngreso('g1');
  await app.w.eliminarInvitado('g1');
  await app.tick();
  assert.equal(invitadosEnBase(app).length, 1);
  assert.equal(app.leer('ingresos/b1/e1'), null);
});

// ═════════════════════════ Personal del boliche ═════════════════════════

test('el admin aprueba personal pendiente y da/quita permisos de admin', async () => {
  const app = await entrar('franco');
  assert.match(app.texto('listaUsuariosGrid'), /pendiente/);
  await app.w.aprobarPersonal('uPend');
  await app.tick();
  assert.equal(app.leer('staff/b1/uPend/aprobado'), true);

  await app.w.toggleAdminPermiso('uLucas');
  await app.tick();
  assert.equal(app.leer('staff/b1/uLucas/isAdmin'), true);
});

test('el admin elimina personal con confirmación', async () => {
  const app = await entrar('franco');
  await app.w.eliminarUsuario('uSofia');
  await app.tick();
  assert.equal(app.leer('staff/b1/uSofia'), null);
});

test('un admin no puede borrarse ni cambiarse los permisos a sí mismo', async () => {
  const app = await entrar('franco');
  await app.w.eliminarUsuario('uOwner');
  assert.match(app.alertas.at(-1), /propio usuario/);
  await app.w.toggleAdminPermiso('uOwner');
  assert.match(app.alertas.at(-1), /propios permisos/);
  assert.ok(app.leer('staff/b1/uOwner'));
});

test('el personal común no ve el panel de usuarios ni el historial', async () => {
  const app = await entrar('lucas');
  assert.ok(!app.visible('panelAdmin'));
  assert.ok(!app.visible('seccionHistorial'));
  assert.ok(!app.visible('panelCajaAdmin'));
});

// ═════════════════════════ DJs y ubicaciones ═════════════════════════

test('DJs: se agregan, se ordenan por horario y el admin puede quitarlos', async () => {
  const app = await entrar('franco');
  const cargar = async (nombre, ini, fin) => {
    app.$('djNombre').value = nombre; app.$('djInicio').value = ini; app.$('djFin').value = fin; app.$('djMonto').value = '1000';
    await app.w.agregarDJ({ preventDefault() {} });
    await app.tick();
  };
  await cargar('Tarde', '04:00', '05:00');
  await cargar('Temprano', '01:00', '02:00');
  assert.deepEqual([...app.$('roadmapDjs').querySelectorAll('strong')].map(s => s.textContent), ['Temprano', 'Tarde']);

  app.$('roadmapDjs').querySelector('button[data-accion="quitar-dj"]').click();
  await app.tick(10);
  assert.equal(app.$('roadmapDjs').querySelectorAll('strong').length, 1);
});

test('un RPP no ve el botón para quitar DJs', async () => {
  const extra = { djs: { b1: { e1: { d1: { nombre: 'DJ', modo: 'boliche', monto: 10 } } } } };
  const app = await entrar('lucas', { extra });
  assert.equal(app.$('roadmapDjs').querySelector('button'), null);
});

test('guardar la ubicación del After actualiza el mapa de cada anotado del After', async () => {
  const extra = {
    invitados: { b1: { e1: invitado('g1', { modo: 'after' }) } },
    acceso: { b1: { e1: { after_30111222: { nombre: 'Persona', modo: 'after', tipoLista: 'Free', rpp: 'Lucas', mapa: 'viejo' } } } }
  };
  const app = await entrar('franco', { extra });
  app.$('ubiAfter').value = 'https://maps.example/nuevo';
  await app.w.guardarUbicacion('after');
  await app.tick();
  assert.equal(app.leer('eventos/b1/e1/ubiAfter'), 'https://maps.example/nuevo');
  assert.equal(app.leer('acceso/b1/e1/after_30111222/mapa'), 'https://maps.example/nuevo');
});

test('guardar la ubicación del boliche también la publica', async () => {
  const app = await entrar('franco');
  app.$('ubiBoliche').value = 'Calle Nueva 55';
  await app.w.guardarUbicacion('boliche');
  await app.tick();
  assert.equal(app.leer('publicos/b1/ubiBoliche'), 'Calle Nueva 55');
});

// ═════════════════════════ Historial ═════════════════════════

test('las acciones quedan en el historial como registros separados', async () => {
  const app = await entrar('lucas');
  await anotar(app, { nombre: 'Uno', documento: '30000010' });
  await anotar(app, { nombre: 'Dos', documento: '30000011' });
  const logs = Object.values(app.leer('logs/b1/e1') || {});
  assert.equal(logs.length, 2);
  assert.ok(logs.every(l => l.uid === 'uLucas' && l.ts > 0));

  const admin = await cargarApp({ datos: app.backend.datos(), cuentas: CUENTAS });
  await iniciarSesion(admin, 'franco');
  assert.equal(admin.$('badgeHistorial').innerText, '2 registros');
  assert.match(admin.texto('listaHistorialLogs'), /Anotó a "Dos"/);
});

// ═════════════════════════ Mi cuenta ═════════════════════════

test('Mi Cuenta actualiza nombre y teléfono en el perfil del boliche', async () => {
  const app = await entrar('lucas');
  app.w.abrirModalMiCuenta();
  app.$('cuentaNombre').value = 'Lucas Nuevo';
  app.$('cuentaTel').value = '549351999';
  await app.w.actualizarMiCuenta({ preventDefault() {} });
  await app.tick();
  assert.equal(app.leer('staff/b1/uLucas/nombre'), 'Lucas Nuevo');
  assert.equal(app.leer('staff/b1/uLucas/tel'), '549351999');
  assert.equal(app.leer('staff/b1/uLucas/isAdmin'), false);
  assert.equal(app.$('headerUserName').innerText, 'Lucas Nuevo');
});

test('cambiar la contraseña usa el login real y avisa si hace falta volver a entrar', async () => {
  const app = await entrar('lucas', { opcionesAuth: { exigirLoginReciente: true } });
  app.w.abrirModalMiCuenta();
  app.$('cuentaNombre').value = 'Lucas';
  app.$('cuentaPassword').value = 'nuevaclave1';
  await app.w.actualizarMiCuenta({ preventDefault() {} });
  assert.match(app.alertas.at(-1), /volvé a entrar/);

  const ok = await entrar('lucas');
  ok.w.abrirModalMiCuenta();
  ok.$('cuentaNombre').value = 'Lucas';
  ok.$('cuentaPassword').value = 'nuevaclave1';
  await ok.w.actualizarMiCuenta({ preventDefault() {} });
  assert.equal(ok.auth._cuentas.get(email('lucas')).password, 'nuevaclave1');
});

test('Panda y Manija no tienen el botón Mi Cuenta', async () => {
  const panda = await entrar('panda');
  assert.ok(!panda.visible('btnMiCuenta'));
  const manija = await comoManija();
  assert.ok(!manija.visible('btnMiCuenta'));
});

// ═════════════════════════ Seguridad en pantalla ═════════════════════════

test('un nombre con HTML no se ejecuta en la tabla (XSS)', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1', { nombre: '<img src=x onerror="window.__xss=1">' }) } } };
  const app = await entrar('franco', { extra });
  assert.equal(app.w.__xss, undefined);
  assert.equal(app.$('guestList').querySelector('img'), null);
  assert.match(app.$('guestList').textContent, /<img src=x/);
});

test('comillas y apóstrofes en nombres no rompen el botón Marcar', async () => {
  const extra = { invitados: { b1: { e1: invitado('g1', { nombre: 'D\'Angelo "El Pibe"' }) } } };
  const app = await entrar('franco', { extra });
  botonDe(app, 'marcar').click();
  await app.tick(10);
  assert.ok(app.leer('ingresos/b1/e1/boliche_30111222'));
});

test('HTML en el nombre del personal o del boliche no se ejecuta en paneles ni selects', async () => {
  const sucio = semilla();
  sucio.staff.b1.uSofia.nombre = '"><script>window.__x2=1</script>';
  sucio.publicos.b2.nombre = '"><img src=x onerror="window.__x3=1">';
  sucio.boliches.b3.nombre = '<b onmouseover="window.__x4=1">Mal</b>';
  const franco = await cargarApp({ datos: sucio, cuentas: CUENTAS });
  await iniciarSesion(franco, 'franco');
  assert.equal(franco.w.__x2, undefined);
  assert.equal(franco.$('listaUsuariosGrid').querySelector('script'), null);
  assert.equal(franco.$('manijaBolicheSelect').querySelector('img'), null);

  const panda = await cargarApp({ datos: sucio, cuentas: CUENTAS });
  await iniciarSesion(panda, 'panda');
  assert.equal(panda.$('gridSolicitudesBoliches').querySelector('b'), null);
});

// ═════════════════════════ Conexión y permisos ═════════════════════════

test('si la base rechaza la lectura, se muestra un aviso claro', async () => {
  const app = await cargarApp({ opcionesBackend: { denegarLecturas: true } });
  assert.ok(app.visible('bannerConexion'));
  assert.match(app.texto('bannerConexion'), /reglas de Firebase/);
});

test('si la lectura falla al iniciar sesión, vuelve al login con el aviso', async () => {
  const app = await cargarApp({ datos: semilla(), cuentas: CUENTAS, opcionesBackend: { denegarLecturas: true } });
  await iniciarSesion(app, 'franco');
  assert.ok(!app.visible('appDashboard'));
  assert.ok(app.visible('bannerConexion'));
});

test('si la base rechaza una escritura, se le avisa a la persona', async () => {
  const app = await entrar('lucas', { opcionesBackend: { denegarEscrituras: true } });
  await anotar(app, { nombre: 'Alguien', documento: '30000099' });
  assert.match(app.alertas.at(-1), /no permitió esta acción/);
});

// ═════════════════════════ Fechas ═════════════════════════

test('la fecha de hoy es la LOCAL, no la UTC (a las 23:30 en Argentina)', async () => {
  const app = await cargarApp({ reloj: new Date(2026, 9, 16, 23, 30, 0).getTime() });
  assert.equal(app.ev('fechaHoy()'), '2026-10-16');
});

test('los pesos negativos se muestran como -$1.000 (no $-1.000)', async () => {
  const app = await cargarApp();
  assert.equal(app.ev('dinero(-44000)'), '-$44.000');
  assert.equal(app.ev('dinero(8000)'), '$8.000');
  assert.equal(app.ev('dinero(undefined)'), '$0');
});

test('el HTML no llama a funciones que no existen y app.js no usa ids inexistentes', () => {
  const { sinDefinir, idsSinHtml, usadas } = require('../scripts/verificar-referencias');
  assert.ok(usadas.length > 20);
  assert.deepEqual(sinDefinir, []);
  assert.deepEqual(idsSinHtml, []);
});

test('styles.css está al día con las clases que usan index.html y app.js', () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const raiz = path.join(__dirname, '..');
  const temporal = path.join(os.tmpdir(), `styles-${process.pid}.css`);
  execFileSync(process.execPath, [path.join(raiz, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
    '-c', path.join(raiz, 'tailwind.config.js'), '-i', path.join(raiz, 'src', 'tailwind.css'), '-o', temporal, '--minify'],
  { cwd: raiz, stdio: 'ignore' });
  assert.equal(fs.readFileSync(temporal, 'utf8'), fs.readFileSync(path.join(raiz, 'styles.css'), 'utf8'),
    'styles.css quedó desactualizado: corré npm run build:css');
  fs.rmSync(temporal, { force: true });
});

test('los mensajes de error de login cubren los códigos reales de Firebase 9.x y los nuevos', async () => {
  const app = await cargarApp();
  for (const code of ['auth/invalid-login-credentials', 'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
    assert.match(app.ev(`mensajeAuth({ code: '${code}' })`), /incorrectos/, code);
  }
  assert.match(app.ev("mensajeAuth({ code: 'auth/too-many-requests' })"), /Demasiados intentos/);
  assert.match(app.ev("mensajeAuth({ code: 'auth/network-request-failed' })"), /Sin conexión/);
});
