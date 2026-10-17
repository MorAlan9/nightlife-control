// Carga index.html + app.js en jsdom con Firebase (base y login) simulado en memoria.
// Así las pruebas NUNCA tocan la base de datos real. Las reglas de seguridad se prueban aparte (rules.test.js).
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(RAIZ, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
  .replace('<script src="app.js"></script>', () => `<script>${APP_JS}</script>`);

const DOMINIO = 'usuarios.somosmanijas.app';
const clonar = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tickReal = () => new Promise(r => setTimeout(r, 0));

function crearBackend(datosIniciales = {}, opciones = {}) {
  let raiz = clonar(datosIniciales);
  const oyentes = [];
  const escrituras = [];
  let contadorClaves = 0;

  const partes = ruta => String(ruta).split('/').filter(Boolean);

  function leer(ruta) {
    let nodo = raiz;
    for (const p of partes(ruta)) {
      if (nodo === null || typeof nodo !== 'object') return null;
      nodo = nodo[p];
    }
    return nodo === undefined ? null : clonar(nodo);
  }

  function podar(nodo) {
    if (nodo === null || typeof nodo !== 'object') return nodo;
    Object.keys(nodo).forEach(k => {
      nodo[k] = podar(nodo[k]);
      if (nodo[k] === null || (typeof nodo[k] === 'object' && Object.keys(nodo[k]).length === 0)) delete nodo[k];
    });
    return nodo;
  }

  function escribir(ruta, valor) {
    const ps = partes(ruta);
    if (ps.length === 0) { raiz = clonar(valor) || {}; return; }
    let nodo = raiz;
    ps.slice(0, -1).forEach(p => {
      if (nodo[p] === null || typeof nodo[p] !== 'object') nodo[p] = {};
      nodo = nodo[p];
    });
    const ultimo = ps[ps.length - 1];
    if (valor === null || valor === undefined) delete nodo[ultimo];
    else nodo[ultimo] = clonar(valor);
    podar(raiz);
  }

  function snapshot(ruta, valor) {
    return { key: partes(ruta).pop() || null, exists: () => valor !== null, val: () => clonar(valor) };
  }

  function aplicarConsulta(valor, consulta) {
    if (valor === null || typeof valor !== 'object' || !consulta.limiteFinal) return valor;
    const claves = Object.keys(valor).sort().slice(-consulta.limiteFinal);
    return Object.fromEntries(claves.map(k => [k, valor[k]]));
  }

  function notificar() {
    oyentes.forEach(o => {
      const valor = aplicarConsulta(leer(o.ruta), o.consulta);
      const texto = JSON.stringify(valor);
      if (texto !== o.ultimo) {
        o.ultimo = texto;
        setTimeout(() => { if (o.activo) o.cb(snapshot(o.ruta, clonar(valor))); }, 0);
      }
    });
  }

  function validarEscritura(rutas) {
    if (opciones.denegarEscrituras) return { code: 'PERMISSION_DENIED', message: 'permission_denied' };
    if (opciones.rechazarEscrituraSi && rutas.some(opciones.rechazarEscrituraSi)) return { code: 'PERMISSION_DENIED', message: 'permission_denied' };
    return null;
  }

  function crearRef(ruta, consulta = {}) {
    const ref = {
      key: partes(ruta).pop() || null,
      orderByKey: () => crearRef(ruta, { ...consulta }),
      limitToLast: n => crearRef(ruta, { ...consulta, limiteFinal: n }),
      on(evento, cb, errCb) {
        if (opciones.denegarLecturas) {
          if (errCb) setTimeout(() => errCb({ code: 'PERMISSION_DENIED', message: 'permission_denied' }), 0);
          return cb;
        }
        const o = { ruta, cb, consulta, activo: true, ultimo: null };
        o.ultimo = JSON.stringify(aplicarConsulta(leer(ruta), consulta));
        oyentes.push(o);
        setTimeout(() => { if (o.activo) o.cb(snapshot(ruta, aplicarConsulta(leer(ruta), consulta))); }, 0);
        return cb;
      },
      off(evento, cb) {
        oyentes.forEach(o => { if (o.ruta === ruta && (!cb || o.cb === cb)) o.activo = false; });
      },
      once() {
        if (opciones.denegarLecturas) return Promise.reject({ code: 'PERMISSION_DENIED', message: 'permission_denied' });
        return Promise.resolve(snapshot(ruta, aplicarConsulta(leer(ruta), consulta)));
      },
      set(valor) {
        const error = validarEscritura([ruta]);
        if (error) return Promise.reject(error);
        escribir(ruta, valor);
        escrituras.push(ruta);
        notificar();
        return Promise.resolve();
      },
      remove() { return ref.set(null); },
      update(cambios) {
        const rutas = Object.keys(cambios).map(k => `${ruta}/${k}`.replace(/\/+/g, '/'));
        const error = validarEscritura(rutas);
        if (error) return Promise.reject(error);
        Object.entries(cambios).forEach(([k, v]) => { escribir(`${ruta}/${k}`, v === undefined ? null : v); escrituras.push(`${ruta}/${k}`); });
        notificar();
        return Promise.resolve();
      },
      push(valor) {
        const clave = `-K${String(++contadorClaves).padStart(6, '0')}`;
        const hijo = crearRef(`${ruta}/${clave}`);
        if (valor === undefined) return hijo;
        const promesa = hijo.set(valor);
        hijo.then = (a, b) => promesa.then(a, b);
        hijo.catch = fn => promesa.catch(fn);
        return hijo;
      }
    };
    return ref;
  }

  return { crearRef, leer, escrituras, datos: () => clonar(raiz) };
}

function crearAuth(usuariosIniciales = [], opciones = {}) {
  const cuentas = new Map(usuariosIniciales.map(u => [u.email, { ...u }]));
  const observadores = [];
  let actual = null;
  let contador = 0;

  function aUsuario(c) {
    const usuario = {
      uid: c.uid,
      email: c.email,
      async delete() { cuentas.delete(c.email); if (actual && actual.uid === c.uid) { actual = null; emitir(); } },
      async updatePassword(nueva) {
        if (opciones.exigirLoginReciente) throw { code: 'auth/requires-recent-login' };
        c.password = nueva;
      }
    };
    return usuario;
  }

  function emitir() {
    const u = actual;
    observadores.forEach(cb => setTimeout(() => cb(u), 0));
  }

  const auth = {
    get currentUser() { return actual; },
    onAuthStateChanged(cb) {
      observadores.push(cb);
      setTimeout(() => cb(actual), 0);
      return () => {};
    },
    async signInWithEmailAndPassword(email, password) {
      const c = cuentas.get(email);
      if (!c || c.password !== password) throw { code: 'auth/invalid-login-credentials' }; // el código real de Firebase 9.23 (verificado en producción)
      actual = aUsuario(c);
      emitir();
      return { user: actual };
    },
    async createUserWithEmailAndPassword(email, password) {
      if (cuentas.has(email)) throw { code: 'auth/email-already-in-use' };
      if (password.length < 6) throw { code: 'auth/weak-password' };
      const c = { uid: `uid-nuevo-${++contador}`, email, password };
      cuentas.set(email, c);
      actual = aUsuario(c);
      emitir();
      return { user: actual };
    },
    async signOut() { actual = null; emitir(); },
    _cuentas: cuentas,
    _entrarSinPasar(email) { actual = aUsuario(cuentas.get(email)); }
  };
  return auth;
}

// Crea la app lista para usar.
//  datos: contenido inicial de la base · cuentas: [{uid, email, password}] · sesion: email con sesión ya iniciada
async function cargarApp({ datos = {}, cuentas = [], sesion = null, confirmar = true, opcionesBackend = {}, opcionesAuth = {}, reloj = null } = {}) {
  const backend = crearBackend(datos, opcionesBackend);
  const auth = crearAuth(cuentas, opcionesAuth);
  if (sesion) auth._entrarSinPasar(sesion);
  const alertas = [];

  const dom = new JSDOM(HTML, {
    url: 'https://nightlife.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.firebase = {
        initializeApp() {},
        database: () => ({ ref: ruta => backend.crearRef(ruta || '') }),
        auth: () => auth
      };
      window.alert = msg => alertas.push(String(msg));
      window.confirm = () => (typeof confirmar === 'function' ? confirmar() : confirmar);
      window.localStorage.setItem('vortexx_current_user', '{"pass":"vieja"}');
      if (reloj) {
        const RealDate = window.Date;
        window.Date = class extends RealDate {
          constructor(...args) { super(...(args.length ? args : [reloj])); }
          static now() { return new RealDate(reloj).getTime(); }
        };
      }
    }
  });

  const w = dom.window;
  const app = {
    w, dom, backend, auth, alertas,
    $: id => w.document.getElementById(id),
    ev: codigo => w.eval(codigo),
    async tick(veces = 6) { for (let i = 0; i < veces; i++) await tickReal(); },
    visible: id => !w.document.getElementById(id).classList.contains('hidden'),
    // jsdom no implementa innerText: lo que la app asigna con innerText queda como propiedad suelta
    texto: id => {
      const e = w.document.getElementById(id);
      return String(e.textContent || e.innerText || '').replace(/\s+/g, ' ').trim();
    },
    leer: ruta => backend.leer(ruta)
  };
  await app.tick();
  return app;
}

async function iniciarSesion(app, username, password = 'clave123') {
  app.$('loginUsuario').value = username;
  app.$('loginPassword').value = password;
  await app.w.iniciarSesion({ preventDefault() {} });
  await app.tick(10);
}

const email = username => `${username}@${DOMINIO}`;
const cuenta = (uid, username, password = 'clave123') => ({ uid, email: email(username), password });

const ROL_DUENO = 'Dueño del Boliche / Admin Local';
const RPP = 'RPP / Promotor';
const staff = (username, rol, extra = {}) => ({ nombre: username[0].toUpperCase() + username.slice(1), username, tel: '', rol, isAdmin: false, aprobado: true, ...extra });

// Base de ejemplo: dos boliches, una noche con personal de todos los roles
function semilla(extra = {}) {
  return {
    superadmins: { uSuper: true },
    usuarios: { uOwner: { bid: 'b1' }, uLucas: { bid: 'b1' }, uSofia: { bid: 'b1' }, uDj: { bid: 'b1' }, uPend: { bid: 'b1' }, uOwner2: { bid: 'b2' } },
    publicos: { b1: { nombre: 'Club XL', eventoActivo: 'e1' }, b2: { nombre: 'Otro Boliche' } },
    boliches: {
      b1: { nombre: 'Club XL', aprobado: true, creadoPor: 'uOwner', encargado: 'Franco', tel: '1', creado: 1 },
      b2: { nombre: 'Otro Boliche', aprobado: true, creadoPor: 'uOwner2', encargado: 'Ana', tel: '2', creado: 1 },
      b3: { nombre: 'Pendiente SA', aprobado: false, creadoPor: 'uX', encargado: 'Zoe', tel: '3', creado: 1 }
    },
    staff: {
      b1: {
        uOwner: staff('franco', ROL_DUENO, { isAdmin: true }),
        uLucas: staff('lucas', RPP),
        uSofia: staff('sofia', RPP),
        uDj: staff('dj', 'DJ / Artista'),
        uPend: staff('pend', RPP, { aprobado: false })
      },
      b2: { uOwner2: staff('ana', ROL_DUENO, { isAdmin: true }) }
    },
    eventos: {
      b1: { e1: { nombre: 'Sábado', fecha: '2026-10-17', precioBoliche: 8000, precioAfter: 5000, pagoCabeza: 1000, sePagaRPP: true, sePagaDJ: true, ubiBoliche: 'Calle 123', ubiAfter: 'https://maps.example/after', creado: 1 } },
      b2: { e1: { nombre: 'Otro', fecha: '2026-10-17', creado: 1 } }
    },
    ...extra
  };
}

const CUENTAS = [
  cuenta('uSuper', 'panda'), cuenta('uOwner', 'franco'), cuenta('uLucas', 'lucas'), cuenta('uSofia', 'sofia'),
  cuenta('uDj', 'dj'), cuenta('uPend', 'pend'), cuenta('uOwner2', 'ana')
];

function invitado(id, extra = {}) {
  return {
    [id]: {
      nombre: 'Persona', documento: '30111222', dni: '30111222', telefono: '', rppUid: 'uLucas', rppNombre: 'Lucas',
      tipoLista: 'Free', modo: 'boliche', cumpleanero: '', esCumpleanero: false, monto: 0, ts: 1, ...extra
    }
  };
}

module.exports = { cargarApp, iniciarSesion, semilla, invitado, cuenta, email, staff, CUENTAS, ROL_DUENO, RPP, DOMINIO };
