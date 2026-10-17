// Genera database.rules.json. Uso: node scripts/build-rules.js
// Se mantiene como script porque las expresiones de las reglas se repiten mucho.
const fs = require('node:fs');
const path = require('node:path');

const DOMINIO = 'usuarios.somosmanijas.app'; // debe coincidir con DOMINIO_EMAIL de index.html
const ROL_DUENO = 'Dueño del Boliche / Admin Local';
const ROLES_PERSONAL = ['RPP / Promotor', 'DJ / Artista', 'Control de Puerta', 'Socio'];

const una = texto => texto.replace(/\s+/g, ' ').trim();

const SUPER = "(auth != null && root.child('superadmins').child(auth.uid).val() === true)";
const staffOk = b => `(auth != null && root.child('staff').child(${b}).child(auth.uid).child('aprobado').val() === true && root.child('boliches').child(${b}).child('aprobado').val() === true)`;
const esStaff = b => `(${SUPER} || ${staffOk(b)})`;
const esAdmin = b => `(${SUPER} || (${staffOk(b)} && root.child('staff').child(${b}).child(auth.uid).child('isAdmin').val() === true))`;
const noEsDj = b => `root.child('staff').child(${b}).child(auth.uid).child('rol').val() !== 'DJ / Artista'`;

const str = (max, min = 1) => `newData.isString() && newData.val().length >= ${min} && newData.val().length <= ${max}`;
const num = 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000000';
// Marcas de tiempo (Date.now() ronda 1.7e12): sin el tope de los montos
const marca = 'newData.isNumber() && newData.val() >= 0 && newData.val() < 100000000000000';
const bool = 'newData.isBoolean()';
const prohibido = { '.validate': false };
const rolesPersonal = ROLES_PERSONAL.map(r => `newData.child('rol').val() === '${r}'`).join(' || ');
const emailCoincide = `auth.token.email === newData.child('username').val() + '@${DOMINIO}'`;

const rules = {
  '.read': false,
  '.write': false,

  // Lo marca a mano el dueño en la consola: superadmins/<uid> = true
  superadmins: {
    $uid: { '.read': 'auth != null && auth.uid === $uid' }
  },

  // Puntero "este usuario pertenece a este boliche". Se escribe una sola vez al registrarse.
  usuarios: {
    $uid: {
      '.read': `(auth != null && auth.uid === $uid) || ${SUPER}`,
      '.write': `(auth != null && auth.uid === $uid && !data.exists()) || ${SUPER}`,
      '.validate': "newData.hasChildren(['bid'])",
      bid: { '.validate': str(60) },
      $otro: prohibido
    }
  },

  // Datos públicos mínimos: boliches habilitados, evento activo y mapa del boliche.
  publicos: {
    '.read': true,
    $bid: {
      '.write': SUPER,
      '.validate': "newData.hasChildren(['nombre'])",
      nombre: { '.validate': str(80, 2) },
      eventoActivo: { '.write': esAdmin('$bid'), '.validate': str(60) },
      ubiBoliche: { '.write': esAdmin('$bid'), '.validate': str(300, 0) },
      $otro: prohibido
    }
  },

  boliches: {
    '.read': SUPER,
    $bid: {
      '.read': "auth != null && root.child('staff').child($bid).child(auth.uid).exists()",
      // Lo crea su dueño (siempre pendiente de aprobación); solo Panda lo habilita o borra.
      '.write': `${SUPER} || (auth != null && !data.exists() && newData.child('aprobado').val() === false && newData.child('creadoPor').val() === auth.uid)`,
      '.validate': "newData.hasChildren(['nombre', 'aprobado', 'creadoPor'])",
      nombre: { '.validate': str(80, 2) },
      aprobado: { '.validate': bool },
      creadoPor: { '.validate': str(128) },
      encargado: { '.validate': str(80, 0) },
      tel: { '.validate': str(30, 0) },
      creado: { '.validate': marca },
      $otro: prohibido
    }
  },

  staff: {
    $bid: {
      '.read': esAdmin('$bid'),
      $uid: {
        '.read': 'auth != null && auth.uid === $uid',
        '.write': [
          // Panda y los admins del boliche gestionan a los demás (no a sí mismos)
          SUPER,
          `(auth != null && auth.uid !== $uid && ${esAdmin('$bid')})`,
          // Alta propia como personal: siempre pendiente y sin permisos
          una(`(auth != null && auth.uid === $uid && !data.exists()
            && root.child('publicos').child($bid).child('nombre').exists()
            && newData.child('isAdmin').val() === false && newData.child('aprobado').val() === false
            && (${rolesPersonal})
            && ${emailCoincide})`),
          // Alta propia como dueño de un boliche nuevo (el boliche se crea en la misma operación)
          una(`(auth != null && auth.uid === $uid && !data.exists()
            && !root.child('boliches').child($bid).exists()
            && newData.parent().parent().parent().child('boliches').child($bid).child('creadoPor').val() === auth.uid
            && newData.child('isAdmin').val() === true && newData.child('aprobado').val() === true
            && newData.child('rol').val() === '${ROL_DUENO}'
            && ${emailCoincide})`),
          // Cada uno puede actualizar su nombre y teléfono, nada más
          una(`(auth != null && auth.uid === $uid && data.exists() && newData.exists()
            && newData.child('isAdmin').val() === data.child('isAdmin').val()
            && newData.child('aprobado').val() === data.child('aprobado').val()
            && newData.child('rol').val() === data.child('rol').val()
            && newData.child('username').val() === data.child('username').val())`)
        ].join(' || '),
        '.validate': "newData.hasChildren(['nombre', 'username', 'rol', 'isAdmin', 'aprobado'])",
        nombre: { '.validate': str(80) },
        username: { '.validate': 'newData.isString() && newData.val().matches(/^[a-z0-9._-]{3,30}$/)' },
        tel: { '.validate': str(30, 0) },
        rol: { '.validate': [ROL_DUENO, ...ROLES_PERSONAL].map(r => `newData.val() === '${r}'`).join(' || ') },
        isAdmin: { '.validate': bool },
        aprobado: { '.validate': bool },
        $otro: prohibido
      }
    }
  },

  eventos: {
    $bid: {
      '.read': esStaff('$bid'),
      $eid: {
        '.write': esAdmin('$bid'),
        '.validate': "newData.hasChildren(['nombre', 'fecha'])",
        nombre: { '.validate': str(80) },
        fecha: { '.validate': 'newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)' },
        precioBoliche: { '.validate': num },
        precioAfter: { '.validate': num },
        pagoCabeza: { '.validate': num },
        sePagaRPP: { '.validate': bool },
        sePagaDJ: { '.validate': bool },
        ubiBoliche: { '.validate': str(300, 0) },
        ubiAfter: { '.validate': str(300, 0) },
        // Precios extra de la puerta, por modo: precios/{boliche|after}/{id} = { nombre, monto }
        precios: {
          $modo: {
            '.validate': "$modo === 'boliche' || $modo === 'after'",
            $pid: {
              '.validate': "newData.hasChildren(['nombre', 'monto'])",
              nombre: { '.validate': str(40) },
              monto: { '.validate': num },
              $otro: prohibido
            }
          }
        },
        creado: { '.validate': marca },
        $otro: prohibido
      }
    }
  },

  invitados: {
    $bid: {
      $eid: {
      // Borrar una noche entera (invitados, ingresos...) lo puede hacer solo Panda
        '.write': SUPER,
        '.read': esStaff('$bid'),
        $gid: {
          // Cualquiera del personal (salvo DJs) anota; cada RPP toca solo lo suyo y mientras no haya ingresado.
          '.write': una(`${esAdmin('$bid')} || (${staffOk('$bid')} && (
            (!data.exists() && ${noEsDj('$bid')} && newData.child('rppUid').val() === auth.uid)
            || (data.exists() && data.child('rppUid').val() === auth.uid
              && (!newData.exists() || newData.child('rppUid').val() === auth.uid)
              && !root.child('ingresos').child($bid).child($eid).child(data.child('modo').val() + '_' + data.child('dni').val()).exists())))`),
          '.validate': "newData.hasChildren(['nombre', 'documento', 'dni', 'rppUid', 'rppNombre', 'tipoLista', 'modo', 'ts'])",
          nombre: { '.validate': str(100) },
          documento: { '.validate': str(20) },
          dni: { '.validate': 'newData.isString() && newData.val().matches(/^[0-9]{5,12}$/)' },
          telefono: { '.validate': str(30, 0) },
          rppUid: { '.validate': str(128) },
          rppNombre: { '.validate': str(100) },
          tipoLista: { '.validate': "newData.val() === 'Free' || newData.val() === 'Cumpleaños' || newData.val() === 'Entrada Paga'" },
          modo: { '.validate': "newData.val() === 'boliche' || newData.val() === 'after'" },
          cumpleanero: { '.validate': str(100, 0) },
          esCumpleanero: { '.validate': bool },
          monto: { '.validate': num },
          precioNombre: { '.validate': str(40, 0) },
          ts: { '.validate': marca },
          $otro: prohibido
        }
      }
    }
  },

  // Un ingreso por persona y modo. Solo se puede CREAR una vez: si dos porteros marcan a la vez, el segundo falla.
  ingresos: {
    $bid: {
      $eid: {
      // Borrar una noche entera (invitados, ingresos...) lo puede hacer solo Panda
        '.write': SUPER,
        '.read': esStaff('$bid'),
        $key: {
          '.write': `${esAdmin('$bid')} || (${staffOk('$bid')} && ${noEsDj('$bid')} && !data.exists() && newData.child('porUid').val() === auth.uid)`,
          '.validate': "$key.matches(/^(boliche|after)_[0-9]{5,12}$/) && newData.hasChildren(['rppUid', 'rppNombre', 'porUid', 'porNombre', 'monto', 'ts'])",
          rppUid: { '.validate': str(128) },
          rppNombre: { '.validate': str(100) },
          porUid: { '.validate': str(128) },
          porNombre: { '.validate': str(100) },
          monto: { '.validate': num },
          precioNombre: { '.validate': str(40, 0) },
          ts: { '.validate': marca },
          $otro: prohibido
        }
      }
    }
  },

  djs: {
    $bid: {
      $eid: {
      // Borrar una noche entera (invitados, ingresos...) lo puede hacer solo Panda
        '.write': SUPER,
        '.read': esStaff('$bid'),
        $did: {
          '.write': esAdmin('$bid'),
          '.validate': "newData.hasChildren(['nombre', 'modo'])",
          nombre: { '.validate': str(80) },
          tel: { '.validate': str(30, 0) },
          modo: { '.validate': "newData.val() === 'boliche' || newData.val() === 'after'" },
          inicio: { '.validate': str(5, 0) },
          fin: { '.validate': str(5, 0) },
          monto: { '.validate': num },
          pagado: { '.validate': bool },
          $otro: prohibido
        }
      }
    }
  },

  logs: {
    $bid: {
      $eid: {
      // Borrar una noche entera (invitados, ingresos...) lo puede hacer solo Panda
        '.write': SUPER,
        '.read': esAdmin('$bid'),
        $lid: {
          '.write': `${staffOk('$bid')} && !data.exists() && newData.child('uid').val() === auth.uid`,
          '.validate': "newData.hasChildren(['uid', 'texto', 'ts'])",
          uid: { '.validate': str(128) },
          texto: { '.validate': str(400) },
          ts: { '.validate': marca },
          $otro: prohibido
        }
      }
    }
  },

  // Lo único que ve el público (Manija): se consulta de a UNA persona, por DNI. No se puede listar.
  acceso: {
    $bid: {
      $eid: {
      // Borrar una noche entera (invitados, ingresos...) lo puede hacer solo Panda
        '.write': SUPER,
        $k: {
          '.read': true,
          '.write': esStaff('$bid'),
          '.validate': "$k.matches(/^(boliche|after)_[0-9]{5,12}$/) && newData.hasChildren(['nombre', 'modo', 'tipoLista'])",
          nombre: { '.validate': str(100) },
          modo: { '.validate': "newData.val() === 'boliche' || newData.val() === 'after'" },
          tipoLista: { '.validate': str(30) },
          rpp: { '.validate': str(100, 0) },
          mapa: { '.validate': str(300, 0) },
          $otro: prohibido
        }
      }
    }
  }
};

const salida = path.join(__dirname, '..', 'database.rules.json');
fs.writeFileSync(salida, JSON.stringify({ rules }, null, 2) + '\n');
console.log('Escrito', salida);
