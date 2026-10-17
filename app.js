// ═══════════════════════════════════════════════════════════════
// SomosManijas · Gestor de Boliches & Afters
//
// Modelo de datos (Firebase Realtime Database) — ver database.rules.json:
//   superadmins/{uid}                 true  (lo carga el dueño a mano en la consola)
//   usuarios/{uid}                    { bid }  a qué boliche pertenece cada cuenta
//   publicos/{bid}                    { nombre, eventoActivo, ubiBoliche }  lo único público
//   boliches/{bid}                    { nombre, aprobado, creadoPor, ... }
//   staff/{bid}/{uid}                 { nombre, username, tel, rol, isAdmin, aprobado }
//   eventos/{bid}/{eid}               una "noche": nombre, fecha, precios, ubicaciones
//   invitados/{bid}/{eid}/{gid}       UN registro por persona anotada por un RPP
//   ingresos/{bid}/{eid}/{modo_dni}   un ingreso por persona (solo se puede crear una vez)
//   djs/{bid}/{eid}/{did}             lineup
//   logs/{bid}/{eid}/{lid}            historial de modificaciones
//   acceso/{bid}/{eid}/{modo_dni}     consulta pública por DNI (Manija), de a una persona
// ═══════════════════════════════════════════════════════════════

// Configuración web de Firebase (no es un secreto: la seguridad la dan las reglas de la base)
const firebaseConfig = {
  apiKey: "AIzaSyDm3Mjl9Drba2G19vzrgeNiuPWx76ipd3g",
  authDomain: "somosmanijas-1bb2c.firebaseapp.com",
  databaseURL: "https://somosmanijas-1bb2c-default-rtdb.firebaseio.com",
  projectId: "somosmanijas-1bb2c",
  storageBucket: "somosmanijas-1bb2c.firebasestorage.app",
  messagingSenderId: "524196071103",
  appId: "1:524196071103:web:41521ec5ed5a8cdcfc680a"
};

// Firebase Auth pide un email: se arma uno interno a partir del nombre de usuario.
// Debe coincidir con DOMINIO en scripts/build-rules.js
const DOMINIO_EMAIL = 'usuarios.somosmanijas.app';
const ROL_DUENO = 'Dueño del Boliche / Admin Local';
const USUARIOS_RESERVADOS = ['panda', 'manija', 'admin'];
const MIN_PASSWORD = 6;

// Solo para desarrollar: en localhost y con ?emulador se usan los emuladores locales de Firebase
// (npm run emuladores). En producción esto no hace nada.
const usarEmuladores = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulador');
if (usarEmuladores) {
  firebaseConfig.projectId = 'demo-nightlife';
  firebaseConfig.databaseURL = 'https://demo-nightlife-default-rtdb.firebaseio.com';
}

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

if (usarEmuladores) {
  auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
  db.useEmulator('127.0.0.1', 9000);
}


// ─────────────────────────── Estado ───────────────────────────
let sesion = null;          // { uid, username, nombre, tel, rol, isAdmin, esSuper }
let bolicheActual = null;   // { bid, nombre }
let manija = null;          // { bid, nombreBoliche }  (modo público, sin cuenta)
let publicos = {};          // bid -> { nombre, eventoActivo, ubiBoliche }
let publicosCargados = false;
let eventos = {};           // eid -> evento del boliche actual
let eid = null;             // noche seleccionada
let eidDeseado = null;      // noche recién creada, a seleccionar cuando llegue
let evento = null;          // { id, ...datos } de la noche seleccionada
let invitados = [];
let ingresos = {};          // "modo_dni" -> ingreso
let djs = [];
let staff = [];             // personal del boliche (solo admins)
let historialLogs = [];
let bolichesTodos = [];     // solo Panda
let modoEventoActual = 'boliche';
let registrandoCuenta = false;
let turnoAuth = 0;

const grupos = { sesion: [], boliche: [], evento: [], publico: [] };

// ─────────────────────────── Utilidades ───────────────────────────
// Fecha local YYYY-MM-DD (toISOString usa UTC: en Argentina, después de las 21 hs ya daba "mañana")
function fechaHoy() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Escapa texto de usuario antes de meterlo en innerHTML (evita inyección de HTML/JS)
function esc(valor) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// DNI / teléfono: se comparan solo por dígitos ("38.123.456" == "38123456")
function soloDigitos(valor) {
  return String(valor === undefined || valor === null ? '' : valor).replace(/\D/g, '');
}

// Pesos con separador de miles; los negativos como -$1.000 (no $-1.000)
function dinero(n) {
  const valor = Number(n) || 0;
  return `${valor < 0 ? '-' : ''}$${Math.abs(valor).toLocaleString('es-AR')}`;
}

function emailDe(username) { return `${username}@${DOMINIO_EMAIL}`; }
function usernameDeEmail(email) { return String(email || '').split('@')[0]; }
function el(id) { return document.getElementById(id); }
function bid() { return manija ? manija.bid : (bolicheActual ? bolicheActual.bid : null); }

function objetoAArray(obj) {
  if (!obj) return [];
  return Object.entries(obj).filter(([, v]) => v && typeof v === 'object').map(([id, v]) => ({ ...v, id }));
}

function esManijaActual() { return !!manija; }
function esAdminActual() { return !!sesion && (sesion.esSuper === true || sesion.isAdmin === true); }
function esPandaActual() { return !!sesion && sesion.esSuper === true; }
function esDjActual() { return !!sesion && (sesion.rol || '').includes('DJ'); }

// Solo se abren enlaces http(s); cualquier otra cosa se busca como dirección en Google Maps
function enlaceMapa(texto) {
  const t = String(texto || '').trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://maps.google.com/?q=${encodeURIComponent(t)}`;
}

function rutaNoche(coleccion) { return `${coleccion}/${bid()}/${eid}`; }
function claveIngreso(modo, dni) { return `${modo}_${dni}`; }

// ─────────────────────────── Avisos y errores ───────────────────────────
function mostrarAvisoConexion(texto) {
  const banner = el('bannerConexion');
  if (!banner) return;
  banner.innerText = texto || '';
  banner.classList.toggle('hidden', !texto);
}

function esPermisoDenegado(err) {
  return !!err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(err.message || ''));
}

// Error al LEER: casi siempre son reglas sin publicar o sesión vencida
function errorFirebase(err) {
  mostrarAvisoConexion(esPermisoDenegado(err)
    ? '⚠️ La base de datos rechazó el acceso (reglas de Firebase). Los datos no se pueden leer ni guardar hasta publicar las reglas.'
    : '⚠️ No se pudo conectar con la base de datos. Revisá tu conexión.');
}

// Error al ESCRIBIR: la regla de seguridad dijo que no
function errorEscritura(err) {
  if (esPermisoDenegado(err)) alert('🚫 La base de datos no permitió esta acción (permisos). Si creés que es un error, recargá la página.');
  else errorFirebase(err);
  return false;
}

async function guardarDb(ruta, valor) {
  try { await db.ref(ruta).set(valor); return true; } catch (err) { return errorEscritura(err); }
}

async function actualizarDb(cambios) {
  try { await db.ref().update(cambios); return true; } catch (err) { return errorEscritura(err); }
}

async function borrarDb(ruta) {
  try { await db.ref(ruta).remove(); return true; } catch (err) { return errorEscritura(err); }
}

// ─────────────────────────── Suscripciones ───────────────────────────
function escuchar(grupo, ruta, callback, armar) {
  const ref = db.ref(ruta);
  const consulta = armar ? armar(ref) : ref;
  const fn = snap => callback(snap);
  consulta.on('value', fn, errorFirebase);
  grupos[grupo].push({ consulta, fn });
}

function limpiarGrupo(nombre) {
  grupos[nombre].forEach(e => e.consulta.off('value', e.fn));
  grupos[nombre] = [];
}

function suscribirPublicos() {
  escuchar('publico', 'publicos', snap => {
    publicos = snap.val() || {};
    publicosCargados = true;
    mostrarAvisoConexion('');
    actualizarSelectBoliches();
    actualizarSelectBolichesManija();
    renderizarSelectorEventos();
  });
}

function suscribirSesion() {
  const uid = sesion.uid;

  if (sesion.esSuper) {
    escuchar('sesion', 'boliches', snap => {
      bolichesTodos = objetoAArray(snap.val());
      renderizarPanelSuperAdminPanda();
    });
    return;
  }

  escuchar('sesion', `staff/${bolicheActual.bid}/${uid}`, snap => revalidarSesion(snap.val()));
  suscribirBoliche();
}

// Si lo eliminan, lo deshabilitan o le cambian el rol mientras está conectado, se actualiza en vivo
function revalidarSesion(perfil) {
  if (!sesion || sesion.esSuper) return;
  if (!perfil || perfil.aprobado !== true) {
    alert('Tu acceso fue deshabilitado o eliminado por la administración.');
    auth.signOut();
    return;
  }
  const antes = JSON.stringify([sesion.nombre, sesion.rol, sesion.isAdmin, sesion.tel]);
  sesion = { ...sesion, nombre: perfil.nombre, tel: perfil.tel || '', rol: perfil.rol, isAdmin: perfil.isAdmin === true };
  if (antes !== JSON.stringify([sesion.nombre, sesion.rol, sesion.isAdmin, sesion.tel])) {
    // Cambió el rol: se rearman las suscripciones que dependen de ser admin
    suscribirBoliche();
    verificarSesion();
  }
}

function suscribirBoliche() {
  limpiarGrupo('boliche');
  limpiarGrupo('evento');
  eventos = {}; evento = null; eid = null; staff = [];
  invitados = []; ingresos = {}; djs = []; historialLogs = [];

  escuchar('boliche', `eventos/${bid()}`, snap => {
    eventos = snap.val() || {};
    reconciliarEventoSeleccionado();
  });

  if (esAdminActual()) {
    escuchar('boliche', `staff/${bid()}`, snap => {
      staff = objetoAArray(snap.val());
      renderizarGestionUsuariosAdmin();
    });
  }
}

function eventoPorDefecto() {
  const ids = Object.keys(eventos);
  if (ids.length === 0) return null;
  const activo = publicos[bid()] && publicos[bid()].eventoActivo;
  if (activo && eventos[activo]) return activo;
  return ids.sort((a, b) => String(eventos[b].fecha).localeCompare(String(eventos[a].fecha)))[0];
}

function reconciliarEventoSeleccionado() {
  let objetivo = null;
  if (eidDeseado && eventos[eidDeseado]) { objetivo = eidDeseado; eidDeseado = null; }
  else if (eid && eventos[eid]) objetivo = eid;
  else objetivo = eventoPorDefecto();

  if (objetivo !== eid) {
    seleccionarEvento(objetivo);
  } else {
    evento = eid ? { id: eid, ...eventos[eid] } : null;
    renderizarSelectorEventos();
    renderizarTodo();
  }
}

function seleccionarEvento(id) {
  limpiarGrupo('evento');
  eid = id || null;
  evento = eid && eventos[eid] ? { id: eid, ...eventos[eid] } : null;
  invitados = []; ingresos = {}; djs = []; historialLogs = [];

  if (eid) {
    escuchar('evento', rutaNoche('invitados'), snap => { invitados = objetoAArray(snap.val()); renderizarTodo(); });
    escuchar('evento', rutaNoche('ingresos'), snap => { ingresos = snap.val() || {}; renderizarTodo(); });
    escuchar('evento', rutaNoche('djs'), snap => { djs = objetoAArray(snap.val()); renderizarTodo(); });
    if (esAdminActual()) {
      escuchar('evento', rutaNoche('logs'), snap => {
        historialLogs = objetoAArray(snap.val()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
        renderizarHistorialLogs();
      }, ref => ref.orderByKey().limitToLast(60));
    }
  }
  renderizarSelectorEventos();
  renderizarTodo();
}

function cambiarEvento(id) {
  if (id === eid) return;
  seleccionarEvento(id);
}

// ─────────────────────────── Autenticación ───────────────────────────
function mensajeAuth(err) {
  switch (err && err.code) {
    case 'auth/invalid-login-credentials': // nombre que devuelve Firebase 9.x
    case 'auth/invalid-credential': // nombre en versiones más nuevas
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email': return 'Usuario o contraseña incorrectos.';
    case 'auth/email-already-in-use': return 'Nombre de usuario en uso.';
    case 'auth/weak-password': return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
    case 'auth/too-many-requests': return 'Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo.';
    case 'auth/network-request-failed': return 'Sin conexión. Revisá tu internet.';
    case 'auth/operation-not-allowed': return 'El ingreso con usuario y contraseña no está habilitado en Firebase (ver README, paso 1).';
    default: return 'No se pudo completar la operación. Probá de nuevo.';
  }
}

// Un punto por cada letra escrita: animado, pero no revela nada de la contraseña
function validarContrasenaEnVivo() {
  const largo = el('loginPassword').value.length;
  el('passwordFeedback').innerHTML = Array.from({ length: largo }, () =>
    '<span class="anim-pop w-2.5 h-2.5 rounded-full bg-purple-500/80 inline-block"></span>').join('');
}

function togglePasswordVisibility(inputId, iconId) {
  const input = el(inputId);
  const icon = el(iconId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = SVG_OJO_CERRADO;
  } else {
    input.type = 'password';
    icon.innerHTML = SVG_OJO_ABIERTO;
  }
}

const SVG_OJO_ABIERTO = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
const SVG_OJO_CERRADO = `<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 013.858-.863c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18"/></svg>`;

// Valida usuario/contraseña de un registro nuevo. Devuelve el mensaje de error o '' si está bien.
function validarNuevoUsuario(username, pass) {
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return 'El usuario debe tener entre 3 y 30 caracteres (letras minúsculas, números, punto, guion o guion bajo, sin espacios).';
  if (USUARIOS_RESERVADOS.includes(username)) return 'Ese nombre de usuario está reservado.';
  if (!pass || pass.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  return '';
}

async function iniciarSesion(e) {
  e.preventDefault();
  const username = el('loginUsuario').value.trim().toLowerCase();
  const pass = el('loginPassword').value;
  const boton = el('btnIngresar');
  boton.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(emailDe(username), pass);
    // El resto lo resuelve alCambiarAuth()
  } catch (err) {
    alert(mensajeAuth(err));
  } finally {
    boton.disabled = false;
  }
}

async function cerrarSesion() {
  manija = null;
  el('passwordFeedback').innerHTML = '';
  el('loginPassword').value = '';
  if (auth.currentUser) await auth.signOut();
  else await alCambiarAuth();
}

// Firebase avisa los cambios de sesión de forma asíncrona: un aviso viejo puede llegar cuando la sesión
// ya es otra. Por eso se ignora el usuario que trae el aviso y siempre se mira la sesión ACTUAL.
async function alCambiarAuth() {
  if (registrandoCuenta) return;
  const user = auth.currentUser;
  if (user && sesion && sesion.uid === user.uid) return; // ya está cargada
  const turno = ++turnoAuth;

  limpiarGrupo('sesion'); limpiarGrupo('boliche'); limpiarGrupo('evento');
  sesion = null; bolicheActual = null; eventos = {}; evento = null; eid = null;
  invitados = []; ingresos = {}; djs = []; staff = []; historialLogs = []; bolichesTodos = [];

  if (!user) {
    verificarSesion();
    return;
  }

  try {
    const perfil = await cargarPerfil(user);
    if (turno !== turnoAuth) return;
    if (perfil.error) {
      alert(perfil.error);
      await auth.signOut();
      return;
    }
    manija = null;
    sesion = perfil.sesion;
    bolicheActual = perfil.bolicheActual;
    mostrarAvisoConexion('');
    suscribirSesion();
    verificarSesion();
  } catch (err) {
    errorFirebase(err);
    await auth.signOut();
  }
}

async function cargarPerfil(user) {
  const uid = user.uid;

  const esSuper = (await db.ref(`superadmins/${uid}`).once('value')).val() === true;
  if (esSuper) {
    return {
      sesion: { uid, username: usernameDeEmail(user.email), nombre: 'Panda', tel: '', rol: 'SuperAdmin Central', isAdmin: true, esSuper: true },
      bolicheActual: null
    };
  }

  const puntero = (await db.ref(`usuarios/${uid}`).once('value')).val();
  if (!puntero || !puntero.bid) return { error: 'Tu cuenta no está asociada a ningún boliche. Pedile ayuda a Panda.' };

  const [snapStaff, snapBoliche] = await Promise.all([
    db.ref(`staff/${puntero.bid}/${uid}`).once('value'),
    db.ref(`boliches/${puntero.bid}`).once('value')
  ]);
  const perfil = snapStaff.val();
  const boliche = snapBoliche.val();

  if (!perfil || !boliche) return { error: 'Tu usuario fue eliminado o el boliche ya no existe.' };
  if (!boliche.aprobado) return { error: '⏳ Tu Boliche/After aún no fue habilitado por Panda.' };
  if (!perfil.aprobado) return { error: '⏳ Tu cuenta todavía no fue aprobada por el administrador del boliche.' };

  return {
    sesion: { uid, username: perfil.username, nombre: perfil.nombre, tel: perfil.tel || '', rol: perfil.rol, isAdmin: perfil.isAdmin === true, esSuper: false },
    bolicheActual: { bid: puntero.bid, nombre: boliche.nombre }
  };
}

// Crea la cuenta y escribe sus datos; si algo falla, borra la cuenta para no dejar usuarios a medias
async function registrarCuenta(username, pass, armarCambios) {
  registrandoCuenta = true;
  let credencial = null;
  try {
    credencial = await auth.createUserWithEmailAndPassword(emailDe(username), pass);
    await db.ref().update(armarCambios(credencial.user.uid));
    await auth.signOut();
    return true;
  } catch (err) {
    if (credencial && credencial.user) { try { await credencial.user.delete(); } catch (e2) { /* ya no importa */ } }
    alert(esPermisoDenegado(err) ? '🚫 La base de datos no permitió el registro (revisá que las reglas estén publicadas).' : mensajeAuth(err));
    return false;
  } finally {
    registrandoCuenta = false;
    await alCambiarAuth();
  }
}

async function registrarBoliche(e) {
  e.preventDefault();
  const nombreBoliche = el('regBolicheNombre').value.trim();
  const nombre = el('regBolicheEncargado').value.trim();
  const username = el('regBolicheUsuario').value.trim().toLowerCase();
  const tel = el('regBolicheTel').value.trim();
  const pass = el('regBolichePassword').value;

  const errorUsuario = validarNuevoUsuario(username, pass);
  if (errorUsuario) return alert(errorUsuario);

  const nuevoBid = db.ref('boliches').push().key;
  const ok = await registrarCuenta(username, pass, uid => ({
    [`boliches/${nuevoBid}`]: { nombre: nombreBoliche, aprobado: false, creadoPor: uid, encargado: nombre, tel, creado: Date.now() },
    [`staff/${nuevoBid}/${uid}`]: { nombre, username, tel, rol: ROL_DUENO, isAdmin: true, aprobado: true },
    [`usuarios/${uid}`]: { bid: nuevoBid }
  }));
  if (!ok) return;

  alert('⏳ Solicitud de Boliche enviada con éxito. Debe ser habilitado por Panda antes de ingresar.');
  el('registerBolicheForm').reset();
  cambiarTabAuth('login');
}

async function registrarPersonal(e) {
  e.preventDefault();
  const bidElegido = el('regPersonalBolicheSelect').value;
  const nombre = el('regPersonalNombre').value.trim();
  const username = el('regPersonalUsuario').value.trim().toLowerCase();
  const tel = el('regPersonalTel').value.trim();
  const rol = el('regPersonalRol').value;
  const pass = el('regPersonalPassword').value;

  if (!bidElegido || !publicos[bidElegido]) return alert('Debes seleccionar un boliche habilitado.');
  const errorUsuario = validarNuevoUsuario(username, pass);
  if (errorUsuario) return alert(errorUsuario);

  const ok = await registrarCuenta(username, pass, uid => ({
    [`staff/${bidElegido}/${uid}`]: { nombre, username, tel, rol, isAdmin: false, aprobado: false },
    [`usuarios/${uid}`]: { bid: bidElegido }
  }));
  if (!ok) return;

  alert('✅ Registro enviado. El administrador del boliche tiene que aprobar tu cuenta antes de que puedas ingresar.');
  el('registerPersonalForm').reset();
  cambiarTabAuth('login');
}

// ─────────────────────────── Mi cuenta ───────────────────────────
function abrirModalMiCuenta() {
  if (!sesion) return;
  el('cuentaUsername').value = sesion.username;
  el('cuentaNombre').value = sesion.nombre || '';
  el('cuentaTel').value = sesion.tel || '';
  el('cuentaPassword').value = '';
  el('modalMiCuenta').classList.remove('hidden');
}

function cerrarModalMiCuenta() {
  el('modalMiCuenta').classList.add('hidden');
}

async function actualizarMiCuenta(e) {
  e.preventDefault();
  if (!sesion || sesion.esSuper) return;

  const nombre = el('cuentaNombre').value.trim();
  const tel = el('cuentaTel').value.trim();
  const nuevaPass = el('cuentaPassword').value;
  if (!nombre) return alert('El nombre no puede quedar vacío.');
  if (nuevaPass && nuevaPass.length < MIN_PASSWORD) return alert(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);

  const ok = await actualizarDb({
    [`staff/${bid()}/${sesion.uid}/nombre`]: nombre,
    [`staff/${bid()}/${sesion.uid}/tel`]: tel
  });
  if (!ok) return;

  if (nuevaPass) {
    try {
      await auth.currentUser.updatePassword(nuevaPass);
    } catch (err) {
      return alert(err && err.code === 'auth/requires-recent-login'
        ? 'Por seguridad, para cambiar la contraseña cerrá sesión, volvé a entrar e intentá de nuevo. (Tu nombre y teléfono sí se guardaron.)'
        : mensajeAuth(err));
    }
  }

  sesion = { ...sesion, nombre, tel };
  el('headerUserName').innerText = nombre;
  registrarLog('Actualizó sus datos personales de cuenta');
  alert('✅ Datos de cuenta actualizados correctamente.');
  cerrarModalMiCuenta();
}

// ─────────────────────────── Pestañas de acceso ───────────────────────────
function cambiarTabAuth(tab) {
  el('loginForm').classList.toggle('hidden', tab !== 'login');
  el('registerBolicheForm').classList.toggle('hidden', tab !== 'regBoliche');
  el('registerPersonalForm').classList.toggle('hidden', tab !== 'regPersonal');
  el('manijaForm').classList.toggle('hidden', tab !== 'manija');

  el('tabLoginBtn').className = `w-1/4 pb-2.5 ${tab === 'login' ? 'text-purple-400 border-b-2 border-purple-500 font-bold' : 'text-gray-500 border-b-2 border-transparent'}`;
  el('tabRegBolicheBtn').className = `w-1/4 pb-2.5 ${tab === 'regBoliche' ? 'text-purple-400 border-b-2 border-purple-500 font-bold' : 'text-gray-500 border-b-2 border-transparent'}`;
  el('tabRegPersonalBtn').className = `w-1/4 pb-2.5 ${tab === 'regPersonal' ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold' : 'text-gray-500 border-b-2 border-transparent'}`;
  el('tabManijaBtn').className = `w-1/4 pb-2.5 ${tab === 'manija' ? 'text-pink-400 border-b-2 border-pink-500 font-bold' : 'text-gray-500 border-b-2 border-transparent'}`;

  if (tab === 'regPersonal') actualizarSelectBoliches();
  if (tab === 'manija') actualizarSelectBolichesManija();
}

function opcionesDeBoliches() {
  return Object.entries(publicos)
    .filter(([, p]) => p && p.nombre)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
}

function llenarSelect(select, vacio) {
  if (!select) return;
  const seleccion = select.value;
  const lista = opcionesDeBoliches();
  select.innerHTML = '';
  if (lista.length === 0) {
    select.innerHTML = `<option value="">${esc(vacio)}</option>`;
    return;
  }
  lista.forEach(([id, p]) => { select.innerHTML += `<option value="${esc(id)}">${esc(p.nombre)}</option>`; });
  if (lista.some(([id]) => id === seleccion)) select.value = seleccion;
}

function actualizarSelectBoliches() { llenarSelect(el('regPersonalBolicheSelect'), 'No hay Boliches habilitados aún'); }
function actualizarSelectBolichesManija() { llenarSelect(el('manijaBolicheSelect'), 'No hay Boliches habilitados aún'); }

// ─────────────────────────── Manija (público) ───────────────────────────
function ingresarComoManija() {
  const elegido = el('manijaBolicheSelect').value;
  if (!elegido || !publicos[elegido]) return alert('Todavía no hay boliches habilitados.');
  manija = { bid: elegido, nombreBoliche: publicos[elegido].nombre };
  verificarSesion();
}

async function consultarDniManija(e) {
  e.preventDefault();
  if (!manija) return;
  const dni = soloDigitos(el('inputDniManija').value);
  const salida = el('resultadoManija');
  if (dni.length < 5) return alert('Ingresá tu DNI (solo números).');

  salida.innerHTML = '<p class="text-xs text-gray-400">Consultando…</p>';
  try {
    // La noche visible al público es la que el boliche marcó como activa
    const activo = (await db.ref(`publicos/${manija.bid}/eventoActivo`).once('value')).val();
    if (!activo) {
      salida.innerHTML = '<p class="text-xs text-amber-300">⏳ Este boliche todavía no publicó una noche.</p>';
      return;
    }
    const [enBoliche, enAfter] = await Promise.all([
      db.ref(`acceso/${manija.bid}/${activo}/${claveIngreso('boliche', dni)}`).once('value'),
      db.ref(`acceso/${manija.bid}/${activo}/${claveIngreso('after', dni)}`).once('value')
    ]);
    renderizarResultadoManija([enBoliche.val(), enAfter.val()]);
  } catch (err) {
    salida.innerHTML = '';
    errorFirebase(err);
  }
}

function renderizarResultadoManija(resultados) {
  const salida = el('resultadoManija');
  const encontrados = resultados.filter(Boolean);

  if (encontrados.length === 0) {
    salida.innerHTML = '<p class="text-sm text-amber-300">⚠️ Tu DNI no figura en ninguna lista de esta noche. Pedile a tu RPP que te anote.</p>';
    return;
  }

  salida.innerHTML = encontrados.map(r => {
    const esAfter = r.modo === 'after';
    const titulo = esAfter ? '<span class="emoji-fan">🪭</span> After' : '🏛️ Boliche';
    const mapa = esAfter
      ? (r.mapa
        ? `<a href="${esc(enlaceMapa(r.mapa))}" target="_blank" rel="noopener" class="inline-block mt-2 text-xs bg-pink-900/60 hover:bg-pink-800 text-pink-200 px-3 py-1.5 rounded transition">🗺️ Ver ubicación del After</a>`
        : '<span class="block mt-2 text-[11px] text-gray-400">⏳ La ubicación aún no fue cargada por la organización.</span>')
      : '';
    return `<div class="bg-gray-950 border border-emerald-900/60 rounded-xl p-3">
      <span class="text-emerald-400 font-bold text-xs">✅ Estás en la lista · ${titulo}</span>
      <span class="block text-white font-bold">${esc(r.nombre)}</span>
      <span class="block text-xs text-gray-400">${esc(r.tipoLista)}${r.rpp ? ` · Lista de ${esc(r.rpp)}` : ''}</span>
      ${mapa}
    </div>`;
  }).join('');
}

// ─────────────────────────── Vistas por rol ───────────────────────────
const SECCIONES_DE_NOCHE = ['bannerModoActual', 'seccionDjs', 'seccionUbicaciones', 'seccionListaControl'];

function verificarSesion() {
  const logueado = !!sesion || !!manija;
  el('authSection').classList.toggle('hidden', logueado);
  el('appDashboard').classList.toggle('hidden', !logueado);
  el('userHeaderInfo').classList.toggle('hidden', !logueado);

  if (logueado) {
    el('headerUserName').innerText = sesion ? sesion.nombre : 'Soy Manija 🪭';
    el('headerUserRole').innerText = sesion ? sesion.rol : 'Manija (Público)';
    const lugar = bolicheActual ? bolicheActual.nombre : (manija ? manija.nombreBoliche : 'SOMOSMANIJAS CENTRAL');
    el('headerBolicheName').innerText = `📍 ${lugar}`;
    configurarVistasPorRol();
    renderizarTodo();
  } else {
    el('selectorModoEvento').classList.add('hidden');
  }
}

function configurarVistasPorRol() {
  if (!sesion && !manija) return;
  const esManija = esManijaActual();
  const esPanda = esPandaActual();
  const esAdmin = esAdminActual();
  const esRpp = !!sesion && (sesion.rol || '').includes('RPP');
  const esDj = esDjActual();
  const hayBoliche = !!bolicheActual;
  const hayNoche = hayBoliche && !!evento;

  el('btnMiCuenta').classList.toggle('hidden', esManija || esPanda);
  el('selectorModoEvento').classList.toggle('hidden', esManija || !hayNoche);
  el('panelSuperAdminPanda').classList.toggle('hidden', !esPanda);
  el('barAdminTools').classList.toggle('hidden', !(esPanda && hayNoche));
  el('panelAdmin').classList.toggle('hidden', !(esAdmin && hayBoliche));
  el('panelCajaAdmin').classList.toggle('hidden', !(esAdmin && hayNoche));
  el('metricasCajaAdmin').classList.toggle('hidden', !(esAdmin && hayNoche));
  el('seccionHistorial').classList.toggle('hidden', !(esAdmin && hayNoche));
  el('formCargaDj').classList.toggle('hidden', !(esAdmin && hayNoche));
  el('btnGuardarUbiBoliche').classList.toggle('hidden', !esAdmin);
  el('btnGuardarUbiAfter').classList.toggle('hidden', !esAdmin);
  el('contenedorFormCarga').classList.toggle('hidden', esManija || esDj || !hayNoche);
  el('perfilRppSection').classList.toggle('hidden', !esRpp || !hayNoche);
  el('barraEvento').classList.toggle('hidden', esManija || !hayBoliche);
  el('accionesEvento').classList.toggle('hidden', !esAdmin);

  el('seccionManija').classList.toggle('hidden', !esManija);
  SECCIONES_DE_NOCHE.forEach(id => el(id).classList.toggle('hidden', esManija || !hayNoche));

  el('ubiBoliche').readOnly = !esAdmin;
  el('ubiAfter').readOnly = !esAdmin;

  const aviso = el('sinEventoAviso');
  if (hayBoliche && !evento) {
    aviso.innerText = esAdmin
      ? '🗓️ Todavía no creaste ninguna noche. Tocá “＋ Nueva noche” para empezar.'
      : '🗓️ Todavía no hay ninguna noche cargada. Pedile al administrador que cree una.';
    aviso.classList.remove('hidden');
  } else {
    aviso.classList.add('hidden');
  }

  if (esManija) {
    el('btnBolicheManija').classList.toggle('hidden', !(publicos[manija.bid] && publicos[manija.bid].ubiBoliche));
    if (publicos[manija.bid] && publicos[manija.bid].ubiBoliche) el('btnBolicheManija').href = enlaceMapa(publicos[manija.bid].ubiBoliche);
  }
}

function cambiarModoEvento(modo) {
  modoEventoActual = modo;
  const btnB = el('btnModoBoliche');
  const btnA = el('btnModoAfter');
  const bannerText = el('textoBannerModo');
  const bannerBox = el('bannerModoActual');

  if (modo === 'boliche') {
    btnB.className = 'px-4 py-1.5 rounded-lg transition bg-purple-600 text-white shadow';
    btnA.className = 'px-4 py-1.5 rounded-lg transition text-gray-400 hover:text-white';
    bannerBox.className = 'bg-gray-900/80 p-3 rounded-xl border border-purple-900/40 flex justify-between items-center text-xs';
    bannerText.innerText = '🏛️ Mostrando datos del: BOLICHE PRINCIPAL';
    el('tituloTablaGeneral').innerText = '🔍 Control y Búsqueda (Boliche Principal)';
    el('tituloFormInvitado').innerText = '➕ Anotar Invitado a la Lista (Boliche)';
    el('tituloSeccionDjs').innerText = '🎧 Lineup & Horarios (Boliche)';
  } else {
    btnA.className = 'px-4 py-1.5 rounded-lg transition bg-pink-600 text-white shadow';
    btnB.className = 'px-4 py-1.5 rounded-lg transition text-gray-400 hover:text-white';
    bannerBox.className = 'bg-gray-900/80 p-3 rounded-xl border border-pink-900/40 flex justify-between items-center text-xs';
    bannerText.innerHTML = '<span class="emoji-fan">🪭</span> Mostrando datos del: SOLO AFTER';
    el('tituloTablaGeneral').innerText = '🔍 Control y Búsqueda (Exclusivo SOLO AFTER)';
    el('tituloFormInvitado').innerText = '➕ Anotar Invitado a la Lista (AFTER)';
    el('tituloSeccionDjs').innerText = '🎧 Lineup & Horarios (SOLO AFTER)';
  }
  renderizarTodo();
}

// ─────────────────────────── Historial ───────────────────────────
function registrarLog(accion) {
  if (!sesion || !bolicheActual || !eid) return;
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const texto = `[${hora}] [${modoEventoActual.toUpperCase()}] ${sesion.nombre}: ${accion}`.slice(0, 400);
  // Cada entrada es un registro nuevo (push): dos usuarios a la vez ya no se pisan el historial
  db.ref(rutaNoche('logs')).push({ uid: sesion.uid, texto, ts: Date.now() }).catch(() => { /* el historial nunca debe frenar la operación */ });
}

function renderizarHistorialLogs() {
  const container = el('listaHistorialLogs');
  el('badgeHistorial').innerText = `${historialLogs.length} registros`;
  container.innerHTML = '';

  if (historialLogs.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic p-1">No hay modificaciones registradas.</p>';
    return;
  }
  historialLogs.forEach(log => {
    const div = document.createElement('div');
    div.className = 'py-1 text-gray-300 hover:text-white transition';
    div.textContent = log.texto;
    container.appendChild(div);
  });
}

// ─────────────────────────── Panel de Panda ───────────────────────────
function renderizarPanelSuperAdminPanda() {
  const grid = el('gridSolicitudesBoliches');
  grid.innerHTML = '';

  if (bolichesTodos.length === 0) {
    grid.innerHTML = '<p class="text-gray-500 italic p-2">No hay Boliches o Afters registrados.</p>';
    return;
  }

  bolichesTodos
    .sort((a, b) => Number(a.aprobado) - Number(b.aprobado) || String(a.nombre).localeCompare(String(b.nombre)))
    .forEach(b => {
      const div = document.createElement('div');
      const actual = bolicheActual && bolicheActual.bid === b.id;
      div.className = `p-3 rounded-xl border flex justify-between items-center gap-2 ${actual ? 'border-purple-500 bg-purple-950/30' : (b.aprobado ? 'bg-gray-950/80 border-emerald-800' : 'bg-yellow-950/30 border-yellow-700/80')}`;
      div.innerHTML = `
        <div>
          <strong class="text-white block text-xs">🏛️ ${esc(b.nombre) || 'Sin Nombre'}</strong>
          <span class="text-gray-300 block text-[11px]">${esc(b.encargado)} - Tel: ${esc(b.tel) || 'S/D'}</span>
          <span class="text-[10px] font-mono ${b.aprobado ? 'text-emerald-400 font-bold' : 'text-amber-400'}">
            ${b.aprobado ? '✅ HABILITADO' : '⏳ PENDIENTE DE APROBACIÓN'}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          ${b.aprobado ? `<button data-accion="gestionar" data-bid="${esc(b.id)}" class="text-[10px] font-bold px-2.5 py-1.5 rounded transition bg-purple-900 hover:bg-purple-800 text-purple-100 border border-purple-600">${actual ? '👁️ Viendo' : '👁️ Ver'}</button>` : ''}
          <button data-accion="aprobar" data-bid="${esc(b.id)}" class="text-[10px] font-bold px-2.5 py-1.5 rounded transition ${b.aprobado ? 'bg-red-950 hover:bg-red-900 text-red-200 border border-red-800' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'}">
            ${b.aprobado ? '🚫 Deshabilitar' : '✅ Habilitar'}
          </button>
        </div>`;
      grid.appendChild(div);
    });
}

async function toggleEstadoAprobacionBoliche(id) {
  const b = bolichesTodos.find(x => x.id === id);
  if (!b || !esPandaActual()) return;
  const aprobar = !b.aprobado;
  const cambios = { [`boliches/${id}/aprobado`]: aprobar };
  // Solo los boliches habilitados aparecen en las listas públicas
  cambios[`publicos/${id}`] = aprobar ? { nombre: b.nombre } : null;
  await actualizarDb(cambios);
}

// Panda entra a mirar y gestionar un boliche concreto
function gestionarBoliche(id) {
  const b = bolichesTodos.find(x => x.id === id);
  if (!b || !esPandaActual()) return;
  bolicheActual = { bid: id, nombre: b.nombre };
  suscribirBoliche();
  renderizarPanelSuperAdminPanda();
  verificarSesion();
}

// ─────────────────────────── Personal del boliche ───────────────────────────
function renderizarGestionUsuariosAdmin() {
  const grid = el('listaUsuariosGrid');
  grid.innerHTML = '';

  const orden = [...staff].sort((a, b) => Number(a.aprobado) - Number(b.aprobado) || String(a.nombre).localeCompare(String(b.nombre)));
  orden.forEach(u => {
    const soyYo = sesion && u.id === sesion.uid;
    const div = document.createElement('div');
    div.className = `bg-gray-950 p-3 rounded-xl border flex justify-between items-center ${u.aprobado ? 'border-gray-800' : 'border-yellow-700/80'}`;
    div.innerHTML = `
      <div>
        <strong class="text-white block text-xs">${esc(u.nombre)} (@${esc(u.username)})</strong>
        <span class="text-purple-400 block font-mono text-[10px]">${esc(u.rol)}${u.aprobado ? '' : ' · ⏳ pendiente'}</span>
      </div>
      <div class="flex items-center gap-2">
        ${soyYo ? '<span class="text-[10px] text-gray-500">(vos)</span>' : `
        ${u.aprobado ? '' : `<button data-accion="aprobar-staff" data-uid="${esc(u.id)}" class="text-[10px] font-bold px-2 py-1 rounded transition bg-emerald-600 hover:bg-emerald-500 text-white">✅ Aprobar</button>`}
        ${u.aprobado ? `<button data-accion="admin-staff" data-uid="${esc(u.id)}" class="text-[10px] font-bold px-2 py-1 rounded transition ${u.isAdmin ? 'bg-purple-900 text-purple-200 border border-purple-600' : 'bg-gray-800 text-gray-400'}">${u.isAdmin ? '👑 ADMIN ACTIVO' : '🔒 HACER ADMIN'}</button>` : ''}
        <button data-accion="quitar-staff" data-uid="${esc(u.id)}" aria-label="Eliminar usuario" class="text-red-400 text-xs">✕</button>`}
      </div>`;
    grid.appendChild(div);
  });
}

async function aprobarPersonal(uid) {
  if (!esAdminActual() || (sesion && uid === sesion.uid)) return;
  const u = staff.find(x => x.id === uid);
  if (!u) return;
  if (await actualizarDb({ [`staff/${bid()}/${uid}/aprobado`]: true })) registrarLog(`Aprobó la cuenta de ${u.nombre} (@${u.username})`);
}

async function toggleAdminPermiso(uid) {
  if (sesion && uid === sesion.uid) return alert('No podés cambiar tus propios permisos.');
  const u = staff.find(x => x.id === uid);
  if (!u || !esAdminActual()) return;
  if (await actualizarDb({ [`staff/${bid()}/${uid}/isAdmin`]: !u.isAdmin })) registrarLog(`Cambió permisos de administración de ${u.nombre} (@${u.username})`);
}

async function eliminarUsuario(uid) {
  if (sesion && uid === sesion.uid) return alert('No podés eliminar tu propio usuario.');
  const u = staff.find(x => x.id === uid);
  if (!u || !esAdminActual()) return;
  if (!confirm(`¿Eliminar a ${u.nombre} (@${u.username})?`)) return;
  if (await borrarDb(`staff/${bid()}/${uid}`)) registrarLog(`Eliminó al usuario ${u.nombre} (@${u.username})`);
}

// ─────────────────────────── Noches (eventos) ───────────────────────────
function etiquetaEvento(id, ev) {
  const activo = publicos[bid()] && publicos[bid()].eventoActivo === id;
  return `${ev.fecha} · ${ev.nombre}${activo ? ' ⭐' : ''}`;
}

function renderizarSelectorEventos() {
  const select = el('selectorEvento');
  if (!select) return;
  const ids = Object.keys(eventos).sort((a, b) => String(eventos[b].fecha).localeCompare(String(eventos[a].fecha)));
  select.innerHTML = ids.length === 0 ? '<option value="">(sin noches)</option>' : '';
  ids.forEach(id => { select.innerHTML += `<option value="${esc(id)}">${esc(etiquetaEvento(id, eventos[id]))}</option>`; });
  if (eid && eventos[eid]) select.value = eid;

  const esActiva = !!eid && !!publicos[bid()] && publicos[bid()].eventoActivo === eid;
  el('badgeEventoActivo').classList.toggle('hidden', !esActiva);
  el('btnEventoActivo').classList.toggle('hidden', esActiva || !eid);
}

function abrirModalEvento() {
  if (!esAdminActual() || !bolicheActual) return;
  el('eventoNombre').value = '';
  el('eventoFecha').value = fechaHoy();
  el('eventoCopiarConfig').checked = !!evento;
  el('modalEvento').classList.remove('hidden');
}

function cerrarModalEvento() {
  el('modalEvento').classList.add('hidden');
}

async function crearEvento(e) {
  e.preventDefault();
  if (!esAdminActual() || !bolicheActual) return;
  const nombre = el('eventoNombre').value.trim();
  const fecha = el('eventoFecha').value;
  if (!nombre || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return alert('Completá el nombre y la fecha de la noche.');

  const base = el('eventoCopiarConfig').checked && evento ? evento : {};
  const nuevo = {
    nombre, fecha, creado: Date.now(),
    precioBoliche: Number(base.precioBoliche) || 0,
    precioAfter: Number(base.precioAfter) || 0,
    pagoCabeza: base.pagoCabeza === undefined ? 1000 : Number(base.pagoCabeza) || 0,
    sePagaRPP: base.sePagaRPP === undefined ? true : base.sePagaRPP === true,
    sePagaDJ: base.sePagaDJ === undefined ? true : base.sePagaDJ === true,
    ubiBoliche: base.ubiBoliche || '',
    ubiAfter: base.ubiAfter || ''
  };
  const nuevoEid = db.ref(`eventos/${bid()}`).push().key;

  eidDeseado = nuevoEid;
  const ok = await actualizarDb({
    [`eventos/${bid()}/${nuevoEid}`]: nuevo,
    // La noche nueva queda visible para el público (Manija) y el mapa del boliche se publica
    [`publicos/${bid()}/eventoActivo`]: nuevoEid,
    [`publicos/${bid()}/ubiBoliche`]: nuevo.ubiBoliche
  });
  if (!ok) { eidDeseado = null; return; }
  cerrarModalEvento();
}

async function marcarEventoActivo() {
  if (!esAdminActual() || !eid) return;
  if (await guardarDb(`publicos/${bid()}/eventoActivo`, eid)) registrarLog('Marcó esta noche como la activa para el público');
}

// ─────────────────────────── Caja ───────────────────────────
async function guardarPrecios() {
  if (!esAdminActual() || !eid) return;
  const ok = await actualizarDb({
    [`eventos/${bid()}/${eid}/precioBoliche`]: parseFloat(el('precioBoliche').value) || 0,
    [`eventos/${bid()}/${eid}/precioAfter`]: parseFloat(el('precioAfter').value) || 0,
    [`eventos/${bid()}/${eid}/pagoCabeza`]: parseFloat(el('pagoPorCabeza').value) || 0,
    [`eventos/${bid()}/${eid}/sePagaRPP`]: el('sePagaRPP').checked,
    [`eventos/${bid()}/${eid}/sePagaDJ`]: el('sePagaDJ').checked
  });
  if (ok) registrarLog('Actualizó configuración de precios de Caja.');
}

// ─────────────────────────── DJs ───────────────────────────
async function agregarDJ(e) {
  e.preventDefault();
  if (!esAdminActual() || !eid) return;
  const nombre = el('djNombre').value.trim();
  const did = db.ref(rutaNoche('djs')).push().key;
  const ok = await guardarDb(`${rutaNoche('djs')}/${did}`, {
    nombre,
    tel: el('djTel').value.trim(),
    modo: modoEventoActual,
    inicio: el('djInicio').value,
    fin: el('djFin').value,
    monto: parseFloat(el('djMonto').value) || 0,
    pagado: false
  });
  if (!ok) return;
  registrarLog(`Agregó al DJ "${nombre}" al Lineup del ${modoEventoActual.toUpperCase()}.`);
  ['djNombre', 'djTel', 'djInicio', 'djFin', 'djMonto'].forEach(id => { el(id).value = ''; });
}

async function eliminarDJ(did) {
  if (!esAdminActual()) return;
  const dj = djs.find(d => d.id === did);
  if (!dj || !confirm(`¿Quitar a "${dj.nombre}" del lineup?`)) return;
  if (await borrarDb(`${rutaNoche('djs')}/${did}`)) registrarLog(`Quitó al DJ "${dj.nombre}" del Lineup del ${(dj.modo || modoEventoActual).toUpperCase()}.`);
}

function renderizarDJs() {
  const roadmap = el('roadmapDjs');
  roadmap.innerHTML = '';

  const ordenados = djs.filter(d => d.modo === modoEventoActual).sort((a, b) => {
    if (a.inicio && b.inicio) return a.inicio.localeCompare(b.inicio);
    if (a.inicio && !b.inicio) return -1;
    if (!a.inicio && b.inicio) return 1;
    return String(a.nombre).localeCompare(String(b.nombre));
  });

  if (ordenados.length === 0) {
    roadmap.innerHTML = `<p class="text-xs text-gray-500 italic">No hay DJs cargados para el ${modoEventoActual.toUpperCase()}.</p>`;
    return;
  }

  ordenados.forEach(d => {
    const div = document.createElement('div');
    div.className = 'bg-gray-950 p-3 rounded-xl border border-gray-800 flex justify-between items-center';
    const horaBadge = d.inicio && d.fin
      ? `<span class="text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800 px-2.5 py-1 rounded">⏱️ ${esc(d.inicio)} hs - ${esc(d.fin)} hs</span>`
      : '<span class="text-xs font-mono bg-gray-900 text-gray-500 border border-gray-800 px-2.5 py-1 rounded">⏱️ --:-- hs - --:-- hs (Horario a confirmar)</span>';
    const botonBorrar = esAdminActual()
      ? `<button data-accion="quitar-dj" data-id="${esc(d.id)}" aria-label="Quitar DJ" class="text-red-400 text-xs px-2">✕</button>`
      : '';
    div.innerHTML = `<div class="flex items-center gap-3">${horaBadge}<strong class="text-white text-xs block">${esc(d.nombre)}</strong></div>${botonBorrar}`;
    roadmap.appendChild(div);
  });
}

// ─────────────────────────── Ubicaciones ───────────────────────────
async function guardarUbicacion(tipo) {
  if (!esAdminActual() || !eid) return;
  const valor = (tipo === 'boliche' ? el('ubiBoliche') : el('ubiAfter')).value.trim().slice(0, 300);
  const cambios = {};

  if (tipo === 'boliche') {
    cambios[`eventos/${bid()}/${eid}/ubiBoliche`] = valor;
    cambios[`publicos/${bid()}/ubiBoliche`] = valor;
  } else {
    cambios[`eventos/${bid()}/${eid}/ubiAfter`] = valor;
    // El mapa del After se copia a la consulta por DNI de cada anotado (solo ellos pueden verlo)
    invitados.filter(i => i.modo === 'after').forEach(i => { cambios[`acceso/${bid()}/${eid}/${claveIngreso('after', i.dni)}/mapa`] = valor; });
  }
  if (await actualizarDb(cambios)) registrarLog(`Actualizó ubicación de ${tipo.toUpperCase()}`);
}

function renderizarUbicaciones() {
  const ev = evento || {};
  if (document.activeElement !== el('ubiBoliche')) el('ubiBoliche').value = ev.ubiBoliche || '';
  if (document.activeElement !== el('ubiAfter')) el('ubiAfter').value = ev.ubiAfter || '';

  const btnB = el('btnBoliche');
  const btnA = el('btnAfter');
  if (ev.ubiBoliche) { btnB.href = enlaceMapa(ev.ubiBoliche); btnB.classList.remove('hidden'); } else btnB.classList.add('hidden');
  if (ev.ubiAfter) { btnA.href = enlaceMapa(ev.ubiAfter); btnA.classList.remove('hidden'); } else btnA.classList.add('hidden');
}

// ─────────────────────────── Invitados ───────────────────────────
function toggleOpcionesLista() {
  el('cumpleContainer').classList.toggle('hidden', el('tipoLista').value !== 'Cumpleaños');
}

function precioDeEntrada(modo) {
  return Number(evento && (modo === 'boliche' ? evento.precioBoliche : evento.precioAfter)) || 0;
}

// Arma lo que público puede ver de una persona (de a un DNI), a partir de sus filas de lista
function hojaDeAcceso(filas, modo) {
  const primera = filas[0];
  const mapa = modo === 'after' ? ((evento && evento.ubiAfter) || '') : '';
  return { nombre: primera.nombre, modo, tipoLista: primera.tipoLista, rpp: primera.rppNombre, mapa };
}

// Calcula las escrituras de "acceso" para las claves afectadas, según cómo queda la lista
function cambiosDeAcceso(listaResultante, claves) {
  const cambios = {};
  [...new Set(claves)].forEach(clave => {
    const filas = listaResultante.filter(i => claveIngreso(i.modo, i.dni) === clave);
    cambios[`acceso/${bid()}/${eid}/${clave}`] = filas.length ? hojaDeAcceso(filas, filas[0].modo) : null;
  });
  return cambios;
}

async function guardarInvitado(e) {
  e.preventDefault();
  if (!sesion || esManijaActual() || esDjActual()) return;
  if (!evento) return alert('Primero elegí o creá una noche.');

  const editId = el('editGuestId').value;
  const nombre = el('nombre').value.trim();
  const documento = el('documento').value.trim();
  const dni = soloDigitos(documento);
  const tipoLista = el('tipoLista').value;
  const cumpleanero = tipoLista === 'Cumpleaños' ? el('cumpleanero').value.trim() : '';
  const esCumpleanero = tipoLista === 'Cumpleaños' ? el('esElCumpleanero').checked : false;

  if (!nombre || dni.length < 5 || dni.length > 12) return alert('Completá el nombre y un DNI válido (solo números).');

  const base = {
    nombre, documento, dni,
    telefono: el('telefono').value.trim(),
    tipoLista, cumpleanero, esCumpleanero
  };

  let listaNueva;
  let clavesAfectadas;

  if (editId) {
    const original = invitados.find(i => i.id === editId);
    if (!original) return cancelarEdicion();
    if (!puedeGestionarFila(original)) return alert('Solo podés editar invitados de tu propia lista (y mientras no hayan ingresado).');

    // Si ya era Entrada Paga y sigue siéndolo, se respeta el precio con el que se anotó
    const monto = tipoLista === 'Entrada Paga'
      ? (original.tipoLista === 'Entrada Paga' ? (original.monto || 0) : precioDeEntrada(original.modo))
      : 0;
    const editado = { ...original, ...base, monto };
    listaNueva = invitados.map(i => i.id === editId ? editado : i);
    clavesAfectadas = [claveIngreso(original.modo, original.dni), claveIngreso(editado.modo, editado.dni)];

    const { id, ...registro } = editado;
    if (!await actualizarDb({ [`${rutaNoche('invitados')}/${id}`]: registro, ...cambiosDeAcceso(listaNueva, clavesAfectadas) })) return;
    registrarLog(`Editó los datos del invitado "${nombre}" (${original.modo.toUpperCase()})`);
  } else {
    const yaAnotado = invitados.some(i => i.dni === dni && i.rppUid === sesion.uid && i.modo === modoEventoActual);
    if (yaAnotado) return alert('Esa persona ya está anotada en tu lista para este evento.');

    const nuevo = {
      ...base,
      rppUid: sesion.uid,
      rppNombre: sesion.nombre,
      modo: modoEventoActual,
      monto: tipoLista === 'Entrada Paga' ? precioDeEntrada(modoEventoActual) : 0,
      ts: Date.now()
    };
    const gid = db.ref(rutaNoche('invitados')).push().key;
    listaNueva = [...invitados, { ...nuevo, id: gid }];
    clavesAfectadas = [claveIngreso(nuevo.modo, nuevo.dni)];

    // Cada anotación es un registro propio: dos RPP anotando a la vez ya no se pisan
    if (!await actualizarDb({ [`${rutaNoche('invitados')}/${gid}`]: nuevo, ...cambiosDeAcceso(listaNueva, clavesAfectadas) })) return;
    registrarLog(`Anotó a "${nombre}" en la lista de ${sesion.nombre} (${modoEventoActual.toUpperCase()})`);
  }
  cancelarEdicion();
}

// Admin: cualquiera. RPP: solo lo suyo y mientras la persona no haya ingresado.
function puedeGestionarFila(fila) {
  if (!sesion || esManijaActual()) return false;
  if (esAdminActual()) return true;
  return fila.rppUid === sesion.uid && !ingresos[claveIngreso(fila.modo, fila.dni)];
}

function editarInvitado(id) {
  const item = invitados.find(i => i.id === id);
  if (!item) return;

  el('editGuestId').value = item.id;
  el('nombre').value = item.nombre;
  el('documento').value = item.documento;
  el('telefono').value = item.telefono || '';
  el('tipoLista').value = item.tipoLista;
  el('cumpleanero').value = item.cumpleanero || '';
  el('esElCumpleanero').checked = item.esCumpleanero || false;

  toggleOpcionesLista();
  el('tituloFormInvitado').innerText = `✏️ Editar Datos de Invitado (${item.modo.toUpperCase()})`;
  el('btnSubmitGuest').innerText = 'Guardar Cambios';
  el('btnCancelarEdicion').classList.remove('hidden');
}

function cancelarEdicion() {
  el('guestForm').reset();
  el('editGuestId').value = '';
  el('tituloFormInvitado').innerText = `➕ Anotar Invitado a la Lista (${modoEventoActual.toUpperCase()})`;
  el('btnSubmitGuest').innerText = 'Guardar en Lista';
  el('btnCancelarEdicion').classList.add('hidden');
  el('cumpleContainer').classList.add('hidden');
}

async function eliminarInvitado(id) {
  const item = invitados.find(i => i.id === id);
  if (!item || esManijaActual()) return;
  if (!puedeGestionarFila(item)) return alert('No tenés permiso para quitar a este invitado.');
  if (!confirm(`¿Quitar a "${item.nombre}" de la lista de ${item.rppNombre}?`)) return;

  const listaNueva = invitados.filter(i => i.id !== id);
  const ok = await actualizarDb({
    [`${rutaNoche('invitados')}/${id}`]: null,
    ...cambiosDeAcceso(listaNueva, [claveIngreso(item.modo, item.dni)])
  });
  if (ok) registrarLog(`Quitó a "${item.nombre}" de la lista de ${item.rppNombre} (${item.modo.toUpperCase()})`);
}

// ─────────────────────────── Ingresos (puerta) ───────────────────────────
function filasDePersona(dni, modo) {
  return invitados.filter(i => i.dni === dni && i.modo === modo);
}

function solicitarIngreso(filas) {
  if (!sesion || esManijaActual() || esDjActual() || !filas || filas.length === 0) return;

  if (filas.length === 1) {
    ejecutarIngreso(filas[0].id);
    return;
  }

  el('nombrePersonaConflicto').innerText = filas[0].nombre;
  const container = el('opcionesRppConflicto');
  container.innerHTML = '';
  filas.forEach(fila => {
    const btn = document.createElement('button');
    btn.className = 'w-full bg-purple-950 hover:bg-purple-900 border border-purple-700 text-purple-200 py-2 px-3 rounded-xl text-xs font-bold transition flex justify-between items-center';
    btn.innerHTML = `<span>Lista de: <strong>${esc(fila.rppNombre)}</strong></span> <span>Elegir ✅</span>`;
    btn.onclick = () => { cerrarModalConflicto(); ejecutarIngreso(fila.id); };
    container.appendChild(btn);
  });
  el('modalConflicto').classList.remove('hidden');
}

async function ejecutarIngreso(gid) {
  const fila = invitados.find(i => i.id === gid);
  if (!fila || !sesion || esManijaActual() || esDjActual()) return;
  const clave = claveIngreso(fila.modo, fila.dni);
  if (ingresos[clave]) return alert('Esa persona ya figura como ingresada.');

  // Un solo ingreso por persona: la base solo deja CREARLO una vez, así dos porteros a la vez no duplican
  const ok = await guardarDb(`${rutaNoche('ingresos')}/${clave}`, {
    rppUid: fila.rppUid,
    rppNombre: fila.rppNombre,
    porUid: sesion.uid,
    porNombre: sesion.nombre,
    monto: Number(fila.monto) || 0,
    ts: Date.now()
  });
  if (ok) registrarLog(`Marcó ingreso de "${fila.nombre}" a través de la lista de ${fila.rppNombre} (${fila.modo.toUpperCase()})`);
}

function cerrarModalConflicto() {
  el('modalConflicto').classList.add('hidden');
}

// Solo admin: corrige un "Marcar" hecho por error
async function deshacerIngreso(clave) {
  if (!esAdminActual()) return;
  const ing = ingresos[clave];
  if (!ing) return;
  const fila = invitados.find(i => claveIngreso(i.modo, i.dni) === clave);
  const nombre = fila ? fila.nombre : clave;
  if (!confirm(`¿Deshacer el ingreso de "${nombre}"?`)) return;
  if (await borrarDb(`${rutaNoche('ingresos')}/${clave}`)) registrarLog(`Deshizo el ingreso de "${nombre}"`);
}

// ─────────────────────────── Render principal ───────────────────────────
function renderizarTodo() {
  if (!sesion && !manija) return;
  const ev = evento || {};
  el('precioBoliche').value = ev.precioBoliche || '';
  el('precioAfter').value = ev.precioAfter || '';
  el('pagoPorCabeza').value = ev.pagoCabeza || '';
  el('sePagaRPP').checked = ev.sePagaRPP === true;
  el('sePagaDJ').checked = ev.sePagaDJ === true;

  configurarVistasPorRol();
  if (esManijaActual()) return;
  renderizarUbicaciones();
  renderizarHistorialLogs();
  renderizarDJs();
  renderizarFiltroCreadores();
  renderizarRendimientoRPP();
  filtrarInvitados();
}

function renderizarFiltroCreadores() {
  const select = el('filtroRppTabla');
  const seleccion = select.value;
  const creadores = new Map();
  invitados.filter(i => i.modo === modoEventoActual).forEach(i => creadores.set(i.rppUid, i.rppNombre));

  select.innerHTML = '<option value="TODOS">Ver Todas las Listas</option>';
  creadores.forEach((nombre, uid) => { select.innerHTML += `<option value="${esc(uid)}">${esc(nombre)}</option>`; });
  // Se conserva el filtro elegido aunque la lista se refresque en vivo
  select.value = creadores.has(seleccion) ? seleccion : 'TODOS';
}

function ingresosDelModo() {
  return Object.entries(ingresos).filter(([clave]) => clave.startsWith(`${modoEventoActual}_`));
}

function renderizarRendimientoRPP() {
  if (!sesion || !(sesion.rol || '').includes('RPP')) return;

  const mias = invitados.filter(i => i.rppUid === sesion.uid && i.modo === modoEventoActual);
  // El ingreso se acredita una sola vez, a la lista por la que la persona entró
  const misIngresos = ingresosDelModo().filter(([, ing]) => ing.rppUid === sesion.uid);

  el('rppAnotados').innerText = mias.length;
  el('rppIngresados').innerText = misIngresos.length;
  el('rppPendientes').innerText = mias.filter(i => !ingresos[claveIngreso(i.modo, i.dni)]).length;

  const box = el('rppComisionBox');
  if (evento && evento.sePagaRPP) {
    box.classList.remove('hidden');
    el('rppComision').innerText = dinero(misIngresos.length * (Number(evento.pagoCabeza) || 0));
  } else {
    box.classList.add('hidden');
  }
}

function filtrarInvitados() {
  if (!sesion) return;
  const query = el('searchInput').value.toLowerCase().trim();
  const rppFiltro = el('filtroRppTabla').value;
  const tipoFiltro = el('filtroTipoLista').value;

  let resultado = invitados.filter(i => i.modo === modoEventoActual);
  if (rppFiltro && rppFiltro !== 'TODOS') resultado = resultado.filter(i => i.rppUid === rppFiltro);
  if (tipoFiltro && tipoFiltro !== 'TODOS') resultado = resultado.filter(i => i.tipoLista === tipoFiltro);

  if (query) {
    const queryDigitos = soloDigitos(query);
    resultado = resultado.filter(i =>
      String(i.nombre || '').toLowerCase().includes(query) ||
      String(i.documento || '').toLowerCase().includes(query) ||
      (queryDigitos && (String(i.dni).includes(queryDigitos) || soloDigitos(i.telefono).includes(queryDigitos))) ||
      (i.cumpleanero && i.cumpleanero.toLowerCase().includes(query))
    );
  }

  renderizarTablaAgrupada(resultado);
  actualizarEstadisticasAdmin();
}

function renderizarTablaAgrupada(lista) {
  const tbody = el('guestList');
  tbody.innerHTML = '';

  const esAdmin = esAdminActual();
  const gruposPorDni = {};
  lista.forEach(item => { (gruposPorDni[item.dni] = gruposPorDni[item.dni] || []).push(item); });
  const dnis = Object.keys(gruposPorDni);

  if (dnis.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">No hay personas anotadas para ${modoEventoActual.toUpperCase()}.</td></tr>`;
    return;
  }

  dnis.forEach(dni => {
    const filas = gruposPorDni[dni];
    const prim = filas[0];
    const clave = claveIngreso(prim.modo, dni);
    const ingreso = ingresos[clave];
    const esIngresado = !!ingreso;
    const tr = document.createElement('tr');
    tr.className = esIngresado ? 'line-through-fade transition' : 'hover:bg-gray-800/40 transition';

    const rppBadges = filas.map(f => {
      if (esIngresado && ingreso.rppUid === f.rppUid) {
        return `<span class="inline-block bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">✅ ${esc(f.rppNombre)}</span>`;
      } else if (esIngresado) {
        return `<span class="inline-block bg-gray-900 text-gray-500 text-[10px] px-1.5 py-0.5 rounded">⚠️ ${esc(f.rppNombre)} (Entró por otro RPP)</span>`;
      }
      return `<span class="inline-block bg-purple-950 text-purple-300 text-[10px] px-1.5 py-0.5 rounded">${esc(f.rppNombre)}</span>`;
    }).join(' ');

    const alertDuplicado = filas.length > 1 ? `<span class="block text-[9px] text-yellow-400 font-bold mt-1">⚔️ Duplicado en ${filas.length} RPPs</span>` : '';

    let detalleTipo = `<span class="font-medium text-gray-200">${esc(prim.tipoLista)}</span>`;
    if (prim.tipoLista === 'Cumpleaños') {
      if (prim.esCumpleanero) detalleTipo += '<span class="block text-amber-300 font-black text-[10px]">🎧 CUMPLEAÑERO/A</span>';
      else if (prim.cumpleanero) detalleTipo += `<span class="block text-pink-400 text-[10px]">🎂 Cumple de: <strong>${esc(prim.cumpleanero)}</strong></span>`;
    }

    // Fila que este usuario puede editar/quitar: la suya, o la primera si es admin
    const filaGestionable = filas.find(f => puedeGestionarFila(f) && f.rppUid === sesion.uid) || (esAdmin ? prim : null);
    const puedeMarcar = !esDjActual();

    let btnAccion = '';
    if (esIngresado) {
      btnAccion = '<span class="px-2 py-1 rounded bg-gray-800 text-emerald-400 text-xs font-bold">✅ DENTRO</span>';
      if (esAdmin) btnAccion += ` <button data-accion="deshacer" data-clave="${esc(clave)}" class="text-[10px] text-gray-400 hover:text-white underline ml-1">Deshacer</button>`;
    } else {
      btnAccion = `
        <div class="flex items-center justify-center gap-2">
          ${puedeMarcar ? `<button data-accion="marcar" data-dni="${esc(dni)}" class="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow">✅ Marcar</button>` : ''}
          ${filaGestionable ? `
          <button data-accion="editar" data-id="${esc(filaGestionable.id)}" aria-label="Editar invitado" class="text-xs bg-gray-800 hover:bg-gray-700 text-purple-300 px-2 py-1 rounded">✏️</button>
          <button data-accion="quitar" data-id="${esc(filaGestionable.id)}" aria-label="Quitar invitado" class="text-xs bg-gray-800 hover:bg-red-900 text-red-300 px-2 py-1 rounded">🗑️</button>` : ''}
        </div>`;
    }

    tr.innerHTML = `
      <td class="p-3">
        <span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${esIngresado ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}">
          ${esIngresado ? 'INGRESÓ' : 'PENDIENTE'}
        </span>
      </td>
      <td class="p-3">
        <strong class="text-white block">${esc(prim.nombre)}</strong>
        <span class="text-xs text-gray-400">${esc(prim.documento)}</span>
      </td>
      <td class="p-3 text-xs">${rppBadges} ${alertDuplicado}</td>
      <td class="p-3 text-xs">${detalleTipo}</td>
      <td class="p-3 text-center">${btnAccion}</td>`;
    tbody.appendChild(tr);
  });
}

// Las métricas son de TODA la noche en el modo elegido (no cambian al buscar o filtrar)
function actualizarEstadisticasAdmin() {
  if (!esAdminActual()) return;

  const delModo = invitados.filter(i => i.modo === modoEventoActual);
  const unicos = new Set(delModo.map(i => i.dni));
  const entradas = ingresosDelModo();
  const recaudado = entradas.reduce((suma, [, ing]) => suma + (Number(ing.monto) || 0), 0);

  const gastosDjs = djs.filter(d => d.modo === modoEventoActual).reduce((suma, d) => suma + (Number(d.monto) || 0), 0);
  const comisiones = evento && evento.sePagaRPP ? entradas.length * (Number(evento.pagoCabeza) || 0) : 0;

  el('statTotal').innerText = unicos.size;
  el('statIngresaron').innerText = entradas.length;
  el('statRecaudado').innerText = dinero(recaudado);
  el('statBalance').innerText = dinero(recaudado - (gastosDjs + comisiones));
}

// ─────────────────────────── Datos de ejemplo (solo Panda) ───────────────────────────
async function cargarDatosDemo() {
  if (!esPandaActual() || !evento) return;
  if (!confirm('Esto AGREGA invitados, DJs y precios de ejemplo a la noche elegida. ¿Continuar?')) return;

  const ahora = Date.now();
  const base = { cumpleanero: '', esCumpleanero: false, monto: 0 };
  const demo = [
    { ...base, nombre: 'Martín Fernández', documento: '38123456', dni: '38123456', telefono: '549351555111', rppUid: 'demo-lucas', rppNombre: 'Lucas RRPP', tipoLista: 'Free', modo: 'boliche', ts: ahora },
    { ...base, nombre: 'Martín Fernández', documento: '38123456', dni: '38123456', telefono: '549351555111', rppUid: 'demo-sofia', rppNombre: 'Sofía Eventos', tipoLista: 'Free', modo: 'boliche', ts: ahora },
    { ...base, nombre: 'Camila Rossi', documento: '40987654', dni: '40987654', telefono: '549351555222', rppUid: 'demo-lucas', rppNombre: 'Lucas RRPP', tipoLista: 'Cumpleaños', cumpleanero: 'Camila Rossi', esCumpleanero: true, modo: 'boliche', ts: ahora },
    { ...base, nombre: 'Lucas Gomez', documento: '41111222', dni: '41111222', telefono: '549351555999', rppUid: 'demo-sofia', rppNombre: 'Sofía Eventos', tipoLista: 'Entrada Paga', monto: 5000, modo: 'after', ts: ahora }
  ];
  const djsDemo = [
    { nombre: 'DJ SoundSystem', tel: '', modo: 'boliche', inicio: '', fin: '', monto: 120000, pagado: false },
    { nombre: 'Alejo Fort', tel: '', modo: 'boliche', inicio: '02:00', fin: '03:30', monto: 80000, pagado: false },
    { nombre: 'adelqui', tel: '', modo: 'after', inicio: '05:30', fin: '08:00', monto: 85000, pagado: false }
  ];

  const cambios = {
    [`eventos/${bid()}/${eid}/precioBoliche`]: 8000,
    [`eventos/${bid()}/${eid}/precioAfter`]: 5000,
    [`eventos/${bid()}/${eid}/pagoCabeza`]: 1000,
    [`eventos/${bid()}/${eid}/sePagaRPP`]: true,
    [`eventos/${bid()}/${eid}/sePagaDJ`]: true
  };
  demo.forEach(g => { cambios[`${rutaNoche('invitados')}/${db.ref(rutaNoche('invitados')).push().key}`] = g; });
  djsDemo.forEach(d => { cambios[`${rutaNoche('djs')}/${db.ref(rutaNoche('djs')).push().key}`] = d; });
  demo.forEach(g => { cambios[`acceso/${bid()}/${eid}/${claveIngreso(g.modo, g.dni)}`] = hojaDeAcceso([g], g.modo); });

  if (await actualizarDb(cambios)) {
    registrarLog('⚡ Cargó los datos DEMO de ejemplo.');
    alert('⚡ Datos DEMO cargados correctamente.');
  }
}

async function borrarDatosDeLaNoche() {
  if (!esPandaActual() || !evento) return;
  if (!confirm(`⚠️ Esto BORRA invitados, ingresos, DJs e historial de la noche "${evento.nombre}". No se puede deshacer. ¿Continuar?`)) return;

  const ok = await actualizarDb({
    [rutaNoche('invitados')]: null,
    [rutaNoche('ingresos')]: null,
    [rutaNoche('djs')]: null,
    [rutaNoche('logs')]: null,
    [rutaNoche('acceso')]: null
  });
  if (ok) alert('🧹 Datos de la noche borrados.');
}

// ─────────────────────────── Eventos de la pantalla ───────────────────────────
function limpiarTodoLoGuardadoAntes() {
  // Versiones anteriores guardaban la sesión (con la contraseña) en el navegador
  try { localStorage.removeItem('vortexx_current_user'); } catch (err) { /* sin storage: no pasa nada */ }
}

function conectarAcciones() {
  el('guestList').addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-accion]');
    if (!btn) return;
    const { accion, clave, id, dni } = btn.dataset;

    if (accion === 'marcar') solicitarIngreso(filasDePersona(dni, modoEventoActual));
    else if (accion === 'deshacer') deshacerIngreso(clave);
    else if (accion === 'editar') editarInvitado(id);
    else if (accion === 'quitar') eliminarInvitado(id);
  });

  el('roadmapDjs').addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-accion="quitar-dj"]');
    if (btn) eliminarDJ(btn.dataset.id);
  });

  el('listaUsuariosGrid').addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-accion]');
    if (!btn) return;
    const { accion, uid } = btn.dataset;
    if (accion === 'aprobar-staff') aprobarPersonal(uid);
    else if (accion === 'admin-staff') toggleAdminPermiso(uid);
    else if (accion === 'quitar-staff') eliminarUsuario(uid);
  });

  el('gridSolicitudesBoliches').addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-accion]');
    if (!btn) return;
    if (btn.dataset.accion === 'aprobar') toggleEstadoAprobacionBoliche(btn.dataset.bid);
    else if (btn.dataset.accion === 'gestionar') gestionarBoliche(btn.dataset.bid);
  });
}

limpiarTodoLoGuardadoAntes();
conectarAcciones();
suscribirPublicos();
auth.onAuthStateChanged(() => { alCambiarAuth(); });
