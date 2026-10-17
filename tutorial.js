// ═══════════════════════════════════════════════════════════════
// Tutorial guiado + Centro de Ayuda (mismo esquema que Despensa 24/7 y Sistema Rotisería)
//
// - Recorrido guiado: resalta cada campo/botón de la pantalla con una burbuja "Paso X de N".
//   Se abre solo la primera vez que se entra a cada pantalla y siempre con el botón "?" (abajo a la izquierda).
// - Centro de Ayuda (botón "Ayuda" del encabezado): guía por tema, con cómo se llena cada campo.
//
// AL AGREGAR O CAMBIAR UNA FUNCIÓN O UN CAMPO, ACTUALIZAR ACÁ EL TUTORIAL Y LA AYUDA DE ESA PANTALLA.
// (Una prueba avisa si un paso apunta a algo que ya no existe en la pantalla.)
// ═══════════════════════════════════════════════════════════════

const TUTORIAL_CLAVE_VISTO = 'tutorial-nightlife-visto-v1:';

// Cada paso señala un elemento de UNA de estas formas:
//   campo  → id de un campo (se resalta con su etiqueta)     css    → selector CSS
//   boton  → texto de un botón o link
// (`titulo` y `texto` son lo que dice la burbuja.)
// Si el elemento no está en pantalla en ese momento (ej. el campo del cumpleañero), el paso se saltea solo.
const TUTORIALES = {
  // ───────── Antes de ingresar ─────────
  login: [
    { campo: 'loginUsuario', titulo: 'Tu usuario', texto: 'Escribí el usuario que elegiste al registrarte, en minúsculas y sin espacios (ejemplo: franco). No es tu mail.' },
    { campo: 'loginPassword', titulo: 'Tu contraseña', texto: 'La que elegiste al registrarte (mínimo 6 caracteres). Con el ojito la ves mientras escribís. Los puntitos de abajo solo cuentan las letras que llevás: no muestran nada de tu clave.' },
    { css: '#btnIngresar', titulo: 'Ingresar', texto: 'Tocá Ingresar. Si tu boliche todavía no fue habilitado por Panda, o tu cuenta no fue aprobada por el administrador, el sistema te lo avisa.' },
    { css: '#tabRegBolicheBtn', titulo: '¿Sos dueño de un boliche o after?', texto: 'En "Reg. Boliche" registrás tu local. Panda lo habilita y después entrás como administrador.' },
    { css: '#tabRegPersonalBtn', titulo: '¿Trabajás en un boliche?', texto: 'En "Reg. Personal" se registran RPPs, DJs, personal de puerta y socios. El administrador de tu boliche tiene que aprobarte.' },
    { css: '#tabManijaBtn', titulo: '¿Querés saber si estás en lista?', texto: 'En "Manija" cualquier persona consulta su lugar en la lista con su DNI, sin crear cuenta.' },
    { css: '#btnAyuda', titulo: 'Centro de Ayuda', texto: 'Acá tenés una guía de cada tema, con cómo se llena cada campo. Está siempre disponible.' }
  ],
  regBoliche: [
    { campo: 'regBolicheNombre', titulo: 'Nombre del boliche o after', texto: 'Como lo conoce la gente. Ejemplo: Club XL o Secret After. Así lo van a ver el personal y el público.' },
    { campo: 'regBolicheEncargado', titulo: 'Encargado principal', texto: 'Tu nombre y apellido. Ejemplo: Franco Rossi.' },
    { campo: 'regBolicheUsuario', titulo: 'Tu usuario', texto: 'Con este usuario vas a ingresar. De 3 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo. Sin espacios ni mayúsculas. Ejemplo: francorp.' },
    { campo: 'regBolicheTel', titulo: 'Teléfono WhatsApp', texto: 'Con código de país y de área, sin 0 ni 15. Ejemplo: 5493512345678. Panda lo usa para contactarte.' },
    { campo: 'regBolichePassword', titulo: 'Contraseña', texto: 'Mínimo 6 caracteres. Guardala bien: por ahora no se puede recuperar desde la página.' },
    { css: '#registerBolicheForm button[type="submit"]', titulo: 'Enviar la solicitud', texto: 'Tu boliche queda pendiente: Panda lo tiene que habilitar. Hasta entonces no podés ingresar. Cuando te habiliten, entrás con tu usuario y contraseña.' }
  ],
  regPersonal: [
    { campo: 'regPersonalBolicheSelect', titulo: '¿Para qué boliche vas a trabajar?', texto: 'Elegí de la lista. Solo aparecen los boliches ya habilitados. Si no está el tuyo, pedile al dueño que se registre primero.' },
    { campo: 'regPersonalNombre', titulo: 'Tu nombre completo', texto: 'Nombre y apellido. Ejemplo: Mateo Lopez. Es el que van a ver en las listas.' },
    { campo: 'regPersonalUsuario', titulo: 'Tu usuario', texto: 'Con este ingresás. De 3 a 30 caracteres: minúsculas, números, punto, guion o guion bajo, sin espacios. Ejemplo: mateorpp.' },
    { campo: 'regPersonalTel', titulo: 'Teléfono WhatsApp', texto: 'Con código de país y de área, sin 0 ni 15. Ejemplo: 5493512345678.' },
    { campo: 'regPersonalRol', titulo: 'Tu rol', texto: 'RPP / Promotor: anota gente en su lista. DJ / Artista: ve la noche y el lineup. Control de Puerta: marca los ingresos. Socio: tiene los mismos permisos que el administrador.' },
    { campo: 'regPersonalPassword', titulo: 'Contraseña', texto: 'Mínimo 6 caracteres.' },
    { css: '#registerPersonalForm button[type="submit"]', titulo: 'Enviar el registro', texto: 'Tu cuenta queda pendiente hasta que el administrador del boliche la apruebe. Cuando lo haga, ya podés ingresar.' }
  ],
  manija: [
    { campo: 'manijaBolicheSelect', titulo: 'Elegí el boliche', texto: 'Seleccioná el boliche o after donde te anotaron.' },
    { boton: 'Entrar Modo Manija', titulo: 'Entrar', texto: 'Después te va a pedir tu DNI para decirte si estás en la lista. No hace falta crear cuenta.' }
  ],

  // ───────── Público (Manija) ─────────
  manijaConsulta: [
    { campo: 'inputDniManija', titulo: 'Tu DNI', texto: 'Escribilo sin puntos ni espacios. Ejemplo: 38123456.' },
    { boton: 'Consultar', titulo: 'Consultar', texto: 'Te dice si estás en la lista del boliche y/o del After, y por qué RPP. Por privacidad no ves a nadie más.' },
    { css: '#resultadoManija', titulo: 'Tu resultado', texto: 'Si estás anotado en el After, acá aparece el botón para ver la ubicación en el mapa. Si no estás, pedile a tu RPP que te anote.' }
  ],

  // ───────── Panda ─────────
  panda: [
    { css: '#gridSolicitudesBoliches', titulo: 'Productoras y boliches', texto: 'Acá ves todos los boliches registrados. Los pendientes aparecen en amarillo: tocá "Habilitar" para que puedan ingresar.' },
    { css: '#panelSuperAdminPanda', titulo: 'Ver, deshabilitar o borrar', texto: '"Ver" entra a mirar y gestionar ese boliche. "Deshabilitar" le corta el acceso. El tacho 🗑️ borra la productora entera (pide escribir su nombre, y no se puede deshacer).' }
  ],

  // ───────── Sin ninguna noche cargada ─────────
  sinNoche: [
    { css: '#sinEventoAviso', titulo: 'Todavía no hay noches', texto: 'Todo se organiza por noche (un evento). Si sos administrador, creá la primera con "＋ Nueva noche". Si no, pedile al administrador que la cree.' },
    { boton: 'Nueva noche', titulo: 'Crear la primera noche', texto: 'Ponele nombre (ejemplo: Sábado 18/10) y fecha.' }
  ],

  // ───────── Administrador / Socio ─────────
  admin: [
    { css: '#barraEvento', titulo: 'La noche', texto: 'Todo lo que ves (invitados, caja, DJs) es de la noche elegida acá. La ⭐ marca la noche que ve el público. Con "＋ Nueva noche" creás otra y con 🗑️ la borrás.' },
    { css: '#selectorModoEvento', titulo: 'Boliche o Solo After', texto: 'Cada noche tiene dos listas: la del boliche y la del after. Con estos botones cambiás de una a la otra (listas, DJs y precios son distintos).' },
    { css: '#panelAdmin', titulo: 'Tu equipo', texto: 'Cuando alguien se registra queda pendiente: tocá "Aprobar". Los Socios quedan como administradores al aprobarlos. "Hacer admin" da o saca permisos; la ✕ elimina a la persona.' },
    { campo: 'precioBoliche', titulo: 'Entrada del boliche', texto: 'El precio base de la entrada (se llama "General"). Poné solo el número, sin $ ni puntos. Ejemplo: 8000. Se usa cuando alguien se anota como "Entrada Paga".' },
    { campo: 'precioAfter', titulo: 'Entrada del after', texto: 'Lo mismo, para la lista del After. Ejemplo: 5000.' },
    { campo: 'pagoPorCabeza', titulo: 'Pago a los RPPs', texto: 'Tildá "¿Hoy se paga a RPPs?" y poné cuánto cobra cada RPP por persona que ingresa por su lista. Ejemplo: 1000. Cada RPP ve su comisión en su pantalla.' },
    { css: '#formPrecio', titulo: 'Varios precios en la puerta', texto: 'Si hay otros precios (Mujeres, Anticipada, VIP), cargá el nombre y el monto y tocá "+ Agregar precio". En la puerta se elige cuál se cobró. Son distintos para Boliche y para After.' },
    { css: '#metricasCajaAdmin', titulo: 'La caja', texto: 'Anotados, cuántos ingresaron, lo recaudado en puerta y el balance (recaudado menos cachets de DJs y comisiones de RPPs). Son de toda la noche, aunque busques o filtres.' },
    { css: '#formCargaDj', titulo: 'Cargar un DJ', texto: 'Alias del DJ, su WhatsApp, hora de inicio y de fin de su set, y el cachet (solo el número). El lineup se ordena solo por horario.' },
    { campo: 'ubiBoliche', titulo: 'Ubicación del boliche', texto: 'Pegá el link de Google Maps o escribí la dirección, y tocá "Guardar". El público ve este mapa.' },
    { campo: 'ubiAfter', titulo: 'Ubicación del after (secreta)', texto: 'Igual que el boliche, pero este mapa solo lo ve quien está anotado en el After (lo consulta con su DNI). Tocá "Guardar" para publicarlo.' },
    { campo: 'searchInput', titulo: 'Buscador', texto: 'Buscá por nombre, DNI, teléfono o cumpleañero. Sirve con o sin puntos en el DNI. A la derecha filtrás por tipo de lista o por RPP.' },
    { campo: 'nombre', titulo: 'Anotar a alguien: nombre', texto: 'Nombre y apellido de la persona. Ejemplo: Juan Pérez.' },
    { campo: 'documento', titulo: 'DNI', texto: 'Solo números, con o sin puntos. Ejemplo: 30111222. Con el DNI el sistema detecta si la misma persona está en dos listas.' },
    { campo: 'telefono', titulo: 'Teléfono (opcional)', texto: 'WhatsApp de la persona. Ejemplo: 5493515551234.' },
    { campo: 'tipoLista', titulo: 'Tipo de lista', texto: 'Free: entra gratis. Cumpleaños: lista de un cumpleañero. Entrada Paga: cobra en la puerta (después elegís el precio).' },
    { campo: 'cumpleanero', titulo: 'Cumpleaños', texto: 'Si elegiste "Cumpleaños", poné el nombre del cumpleañero/a y tildá "Esta persona ES EL CUMPLEAÑERO/A" solo para la persona que cumple.' },
    { campo: 'precioLista', titulo: 'Precio de la entrada', texto: 'Si hay varios precios, elegí con cuál se anota. En la puerta se confirma el que realmente se cobra.' },
    { css: '#btnSubmitGuest', titulo: 'Guardar en lista', texto: 'Tocá "Guardar en Lista". Si esa persona ya está anotada en tu lista, el sistema avisa.' },
    { css: '#guestList', titulo: 'La lista', texto: '✅ Marcar: la persona entró. ✏️ editar y 🗑️ quitar. Si está en dos listas, aparece "Duplicado" y al marcar elegís por cuál entra. Si te equivocaste, "Deshacer" (solo admin).' },
    { css: '#seccionHistorial', titulo: 'Historial', texto: 'Cada cosa que hace el equipo queda registrada acá con la hora y quién la hizo.' },
    { css: '#barAdminTools', titulo: 'Herramientas de Panda', texto: 'Cargar datos de ejemplo y borrar los datos de la noche. Solo las ve Panda.' }
  ],

  // ───────── RPP / Promotor ─────────
  rpp: [
    { css: '#perfilRppSection', titulo: 'Tu rendimiento', texto: 'Cuántos anotaste, cuántos ya ingresaron por tu lista, cuántos faltan y, si hoy se paga, tu comisión.' },
    { campo: 'nombre', titulo: 'Nombre de tu invitado', texto: 'Nombre y apellido. Ejemplo: Juan Pérez.' },
    { campo: 'documento', titulo: 'DNI', texto: 'Solo números, con o sin puntos. Es lo que usa la puerta para encontrarlo. Ejemplo: 30111222.' },
    { campo: 'telefono', titulo: 'Teléfono (opcional)', texto: 'WhatsApp de tu invitado.' },
    { campo: 'tipoLista', titulo: 'Tipo de lista', texto: 'Free: gratis. Cumpleaños: lista de un cumpleañero. Entrada Paga: paga en la puerta.' },
    { campo: 'cumpleanero', titulo: 'Cumpleaños', texto: 'Poné el nombre del cumpleañero/a. Tildá "ES EL CUMPLEAÑERO/A" solo en la fila de esa persona.' },
    { campo: 'precioLista', titulo: 'Precio', texto: 'Si el boliche tiene varios precios, elegí cuál le corresponde a tu invitado.' },
    { css: '#btnSubmitGuest', titulo: 'Guardar en lista', texto: 'Después de guardar, tu invitado aparece en la tabla. No podés anotar dos veces a la misma persona en tu lista.' },
    { campo: 'searchInput', titulo: 'Buscador', texto: 'Buscá por nombre, DNI o teléfono.' },
    { css: '#guestList', titulo: 'Tu lista y la puerta', texto: '✏️ editás y 🗑️ quitás a tus invitados, mientras no hayan entrado. ✅ Marcar registra el ingreso.' }
  ],

  // ───────── Control de puerta ─────────
  puerta: [
    { campo: 'searchInput', titulo: 'Buscá a la persona', texto: 'Por nombre, DNI o teléfono, con o sin puntos. Lo más rápido es el DNI.' },
    { css: '#selectorModoEvento', titulo: 'Boliche o After', texto: 'Cambiá entre la lista del boliche y la del after.' },
    { css: '#guestList', titulo: 'Marcar el ingreso', texto: 'Tocá ✅ Marcar cuando entra: la fila se tacha y queda "DENTRO". Si está en dos listas, elegí por cuál entra. Si es Entrada Paga y hay varios precios, elegí cuál se cobró.' },
    { campo: 'filtroTipoLista', titulo: 'Filtros', texto: 'Podés ver solo un tipo de lista o solo la de un RPP.' }
  ],

  // ───────── DJ ─────────
  dj: [
    { css: '#seccionDjs', titulo: 'Lineup', texto: 'Los DJs de la noche con su horario de inicio y de fin, en orden. Usá "Boliche / Solo After" para ver cada lineup.' },
    { campo: 'ubiBoliche', titulo: 'Dónde es', texto: 'La dirección del boliche. Si tocás "Abrir Mapa", se abre en Google Maps.' }
  ],

  // ───────── Ventanas ─────────
  modalEvento: [
    { campo: 'eventoNombre', titulo: 'Nombre de la noche', texto: 'Como la querés ver en la lista. Ejemplo: Sábado 18/10 - Fiesta Neón.' },
    { campo: 'eventoFecha', titulo: 'Fecha', texto: 'El día del evento.' },
    { campo: 'eventoCopiarConfig', titulo: 'Copiar la configuración', texto: 'Si lo dejás tildado, la noche nueva arranca con los mismos precios y ubicaciones que la anterior (los invitados no se copian). Después podés cambiarlos.' },
    { css: '#modalEvento form button[type="submit"]', titulo: 'Crear noche', texto: 'La noche nueva queda como la activa para el público y la seleccionás automáticamente.' }
  ],
  miCuenta: [
    { campo: 'cuentaNombre', titulo: 'Tu nombre', texto: 'Es el que ven los demás en las listas y el historial.' },
    { campo: 'cuentaTel', titulo: 'Tu WhatsApp', texto: 'Con código de país y de área, sin 0 ni 15.' },
    { campo: 'cuentaPassword', titulo: 'Nueva contraseña', texto: 'Dejala vacía para no cambiarla. Si la cambiás, mínimo 6 caracteres; si pide volver a entrar, cerrá sesión y probá de nuevo.' }
  ]
};

// ═════════════ Centro de Ayuda: guía por tema ═════════════
const AYUDA_TEMAS = [
  {
    nombre: 'Primeros pasos del dueño', paraQuien: 'Dueño / productora',
    resumen: 'Cómo registrar tu boliche o after y dejarlo funcionando.',
    pasos: [
      'En la pantalla de ingreso, tocá "Reg. Boliche".',
      'Completá: nombre del boliche, tu nombre, un usuario (minúsculas, sin espacios), tu WhatsApp con código de país y área (ej: 5493512345678) y una contraseña de mínimo 6 caracteres.',
      'Tocá "Solicitar Registro". Panda tiene que habilitar tu boliche: hasta entonces no podés ingresar.',
      'Cuando te habiliten, ingresá con tu usuario y contraseña.',
      'Tocá "＋ Nueva noche", poné el nombre y la fecha, y empezá a cargar la configuración.'
    ],
    consejo: 'Guardá bien tu contraseña: por ahora no se puede recuperar desde la página.'
  },
  {
    nombre: 'Registrarse como personal', paraQuien: 'RPP, DJ, puerta, socio',
    resumen: 'Cómo darte de alta para trabajar en un boliche.',
    pasos: [
      'En la pantalla de ingreso, tocá "Reg. Personal".',
      'Elegí el boliche (solo aparecen los habilitados), poné tu nombre completo, un usuario, tu WhatsApp y tu rol.',
      'RPP / Promotor anota gente. DJ / Artista ve la noche y el lineup. Control de Puerta marca ingresos. Socio tiene los mismos permisos que el administrador.',
      'Elegí una contraseña (mínimo 6 caracteres) y tocá "Registrar Personal".',
      'Tu cuenta queda pendiente: el administrador del boliche tiene que aprobarte. Después ya podés ingresar.'
    ]
  },
  {
    nombre: 'Noches (eventos)', paraQuien: 'Administrador',
    resumen: 'Cada fiesta es una "noche" con sus propios invitados, ingresos, DJs, precios y caja.',
    pasos: [
      'Arriba, el selector "Noche" muestra la noche que estás viendo. La ⭐ marca la que ve el público.',
      'Tocá "＋ Nueva noche": poné el nombre (ej: Sábado 18/10) y la fecha. Dejá tildado "Copiar precios y ubicaciones" si querés arrancar con lo de la noche anterior.',
      'Para cambiar de noche, elegila en el selector. Si querés que otra sea la pública, elegila y tocá "Marcar como activa".',
      'Para borrar una noche, tocá 🗑️ Borrar noche y escribí su nombre exacto. Se borra todo lo de esa noche y no se puede deshacer.'
    ],
    consejo: 'Creá una noche por evento: así las listas, la caja y el historial de cada fecha quedan separados.'
  },
  {
    nombre: 'Caja y precios', paraQuien: 'Administrador',
    resumen: 'Cuánto cuesta la entrada, cuánto se paga a los RPPs y cómo ver lo recaudado.',
    pasos: [
      'En "Configuración de Caja" poné el precio de la entrada del boliche y del after: solo el número, sin $ ni puntos (ej: 8000).',
      'Tildá "¿Hoy se paga a RPPs?" y poné el monto por persona que ingresa (ej: 1000).',
      '"¿Mostrar cachet a DJs?" controla si el cachet se tiene en cuenta para el equipo.',
      'Para tener varios precios en la puerta (Mujeres, Anticipada, VIP), cargá el nombre y el monto en "Precios en la puerta" y tocá "+ Agregar precio". Cada modo (boliche o after) tiene los suyos.',
      'Los cuadros de abajo muestran anotados, ingresados, recaudado y balance neto. Si hay varios precios, ves el detalle de cuánto entró por cada uno.'
    ],
    consejo: 'Si cambiás un precio después de anotar gente, a los ya anotados se les respeta el monto con el que se anotaron.'
  },
  {
    nombre: 'Ubicaciones y mapas', paraQuien: 'Administrador',
    resumen: 'Dónde es el boliche y el After (que es secreto).',
    pasos: [
      'En "Ubicaciones & Mapas" pegá el link de Google Maps o escribí la dirección del boliche y tocá "Guardar".',
      'Hacé lo mismo con el After: su mapa solo lo ve quien está anotado en la lista del After (lo consulta con su DNI).',
      'Si cambiás el mapa del After, se actualiza para todos los anotados.'
    ]
  },
  {
    nombre: 'Lineup de DJs', paraQuien: 'Administrador',
    resumen: 'Cargar los DJs de la noche con su horario.',
    pasos: [
      'Elegí arriba "Boliche" o "Solo After": el lineup es distinto en cada uno.',
      'Completá: alias del DJ, su WhatsApp, hora de inicio y de fin de su set y el cachet (solo el número).',
      'Tocá "+ Guardar DJ". La lista se ordena sola por horario.',
      'Para sacar a un DJ, tocá la ✕ de su fila.'
    ]
  },
  {
    nombre: 'Anotar invitados', paraQuien: 'RPP y administrador',
    resumen: 'Cómo se llena el formulario de la lista.',
    pasos: [
      'Nombre completo: nombre y apellido (ej: Juan Pérez).',
      'DNI / Documento: solo números, con o sin puntos (ej: 30111222). Con el DNI el sistema detecta si la misma persona está en dos listas.',
      'Teléfono: opcional, el WhatsApp de la persona.',
      'Tipo de lista: Free (gratis), Cumpleaños (lista de un cumpleañero) o Entrada Paga (cobra en la puerta).',
      'Si elegís Cumpleaños, poné el nombre del cumpleañero/a y tildá "ES EL CUMPLEAÑERO/A" solo en la fila de la persona que cumple.',
      'Si elegís Entrada Paga y hay varios precios, elegí con cuál se anota.',
      'Tocá "Guardar en Lista". Con ✏️ editás y con 🗑️ quitás (mientras la persona no haya ingresado).'
    ],
    consejo: 'Cada RPP ve y edita solo su propia lista. El administrador ve y edita todas.'
  },
  {
    nombre: 'La puerta', paraQuien: 'Puerta, RPP y administrador',
    resumen: 'Buscar a alguien y marcar que entró.',
    pasos: [
      'En el buscador escribí nombre, DNI o teléfono. Con el DNI es lo más rápido.',
      'Tocá "✅ Marcar" cuando la persona entra: la fila se tacha y queda "DENTRO".',
      'Si la persona está anotada por dos RPPs, el sistema pregunta por cuál lista entra. La entrada se cobra una sola vez y el ingreso se le acredita a ese RPP.',
      'Si es Entrada Paga y hay varios precios, el sistema pregunta qué precio se cobró (aparece marcado el que tenía al anotarse).',
      'Si te equivocaste, el administrador toca "Deshacer".',
      'Con los botones "Boliche / Solo After" cambiás de lista. Los filtros de arriba muestran un tipo de lista o la lista de un solo RPP.'
    ],
    consejo: 'Si dos personas de la puerta marcan a la vez a la misma persona, el sistema solo deja un ingreso.'
  },
  {
    nombre: 'Tu rendimiento (RPP)', paraQuien: 'RPP',
    resumen: 'Cómo ver cuánta gente anotaste y cuánto ganás.',
    pasos: [
      'Arriba de la lista aparece "Tu rendimiento": anotados, ingresados, pendientes y, si hoy se paga, tu comisión.',
      'Un ingreso cuenta para el RPP por cuya lista entró la persona. Si estaba en dos listas, cuenta una sola vez.'
    ]
  },
  {
    nombre: 'Personal y permisos', paraQuien: 'Administrador',
    resumen: 'Aprobar a tu equipo y dar permisos.',
    pasos: [
      'Cuando alguien se registra, aparece en "Personal del Boliche" como pendiente. Tocá "Aprobar".',
      'Los Socios quedan como administradores al aprobarlos: ven y hacen lo mismo que vos.',
      '"Hacer admin" da o saca permisos de administrador a cualquier persona del equipo.',
      'La ✕ elimina a la persona del equipo. No podés eliminarte ni cambiarte los permisos a vos mismo.'
    ]
  },
  {
    nombre: 'Historial', paraQuien: 'Administrador',
    resumen: 'Quién hizo qué y cuándo.',
    pasos: [
      'En "Historial de Modificaciones" queda registrado cada ingreso marcado, cada invitado anotado o quitado y cada cambio de precios, con la hora y el nombre de quien lo hizo.'
    ]
  },
  {
    nombre: 'Consultar tu lugar (Manija)', paraQuien: 'Público',
    resumen: 'Cómo saber si estás en la lista, sin crear cuenta.',
    pasos: [
      'En la pantalla de ingreso tocá "Manija".',
      'Elegí el boliche y tocá "Entrar Modo Manija".',
      'Escribí tu DNI sin puntos y tocá "Consultar".',
      'Vas a ver si estás en la lista del boliche y/o del After y por qué RPP. Si estás en el After, aparece el botón para ver la ubicación.',
      'Si no estás, pedile a tu RPP que te anote.'
    ],
    consejo: 'Por privacidad no se muestra la lista de nadie más.'
  },
  {
    nombre: 'Panda: boliches y borrados', paraQuien: 'Panda',
    resumen: 'Habilitar boliches y limpiar datos.',
    pasos: [
      'En el panel central, los boliches pendientes aparecen en amarillo: tocá "Habilitar".',
      '"Ver" entra a mirar y gestionar ese boliche. "Deshabilitar" le corta el acceso.',
      'El botón 🗑️ de cada tarjeta borra la productora entera: noches, personal, invitados e historial. Pide escribir el nombre exacto y no se puede deshacer.',
      'Dentro de un boliche, Panda tiene "Cargar datos de ejemplo" y "Borrar los datos de esta noche" (borra invitados, ingresos, DJs e historial pero deja la noche).',
      'Los usuarios de login de una productora borrada siguen en Firebase → Authentication; para liberar su nombre de usuario hay que borrarlos ahí.'
    ]
  },
  {
    nombre: 'Problemas frecuentes', paraQuien: 'Todos',
    resumen: 'Qué hacer si algo no anda.',
    pasos: [
      '"Usuario o contraseña incorrectos": revisá mayúsculas y espacios. El usuario va en minúsculas.',
      '"Tu cuenta todavía no fue aprobada": avisale al administrador de tu boliche.',
      '"Tu Boliche/After aún no fue habilitado": avisale a Panda.',
      'Aviso rojo arriba de la pantalla: no hay conexión con la base de datos. Revisá tu internet y recargá.',
      '"La base de datos no permitió esta acción": recargá la página; si sigue, avisale a tu administrador.',
      'Olvidé mi contraseña: por ahora no se recupera desde la página. Pedile a Panda que borre tu cuenta y volvé a registrarte.'
    ]
  }
];

// ═════════════ Motor del recorrido ═════════════
let tutorialPasos = [];      // pasos encontrados en pantalla: { paso, el }
let tutorialIndice = 0;
let tutorialClave = null;    // pantalla del recorrido abierto
let tutorialUltimaClave = null;
let tutorialTimer = null;

// Visible = ni él ni ninguno de sus padres está oculto con la clase "hidden"
function tutorialVisible(elemento) {
  for (let nodo = elemento; nodo && nodo !== document.body; nodo = nodo.parentElement) {
    if (nodo.classList && nodo.classList.contains('hidden')) return false;
    if (nodo.hidden) return false;
  }
  return !!elemento;
}

// Busca el elemento que señala un paso. Los campos se resaltan junto con su etiqueta.
function tutorialBuscar(paso) {
  let encontrado = null;
  if (paso.campo) {
    const input = document.getElementById(paso.campo);
    if (input) {
      let envoltorio = input.parentElement;
      if (envoltorio && envoltorio.classList.contains('relative') && envoltorio.parentElement) envoltorio = envoltorio.parentElement;
      encontrado = envoltorio || input;
    }
  } else if (paso.css) {
    encontrado = document.querySelector(paso.css);
  } else if (paso.boton) {
    const texto = paso.boton.toLowerCase();
    encontrado = [...document.querySelectorAll('button, a')].find(b => tutorialVisible(b) && (b.textContent || '').trim().toLowerCase().includes(texto)) || null;
  }
  return encontrado && tutorialVisible(encontrado) ? encontrado : null;
}

// En qué pantalla está la persona ahora (depende de la pestaña, del rol y de si hay noche)
function tutorialClaveActual() {
  const abierto = id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); };
  if (abierto('modalEvento')) return 'modalEvento';
  if (abierto('modalMiCuenta')) return 'miCuenta';
  if (abierto('authSection')) {
    if (abierto('registerBolicheForm')) return 'regBoliche';
    if (abierto('registerPersonalForm')) return 'regPersonal';
    if (abierto('manijaForm')) return 'manija';
    return 'login';
  }
  if (!abierto('appDashboard')) return null;
  if (esManijaActual()) return 'manijaConsulta';
  if (!sesion) return null;
  if (esPandaActual() && !bolicheActual) return 'panda';
  // Mientras llegan las noches del boliche todavía no se sabe si hay o no: no se muestra nada
  if (!evento) return eventosCargados ? 'sinNoche' : null;
  if (esAdminActual()) return 'admin';
  if (esDjActual()) return 'dj';
  if ((sesion.rol || '').includes('RPP')) return 'rpp';
  return 'puerta';
}

function tutorialYaVisto(clave) {
  try { return !!localStorage.getItem(TUTORIAL_CLAVE_VISTO + clave); } catch (e) { return false; }
}

function tutorialMarcarVisto(clave) {
  try { localStorage.setItem(TUTORIAL_CLAVE_VISTO + clave, '1'); } catch (e) { /* sin storage: se vuelve a mostrar */ }
}

// Abre el recorrido de la pantalla actual. `forzar` lo abre aunque ya se haya visto (botón "?").
function tutorialAbrir(forzar) {
  const clave = tutorialClaveActual();
  const config = clave && TUTORIALES[clave];
  if (!config) return false;
  if (!forzar && tutorialYaVisto(clave)) return false;

  const encontrados = config
    .map(paso => ({ paso, el: tutorialBuscar(paso) }))
    .filter(x => x.el !== null);
  if (encontrados.length === 0) return false;

  tutorialCerrar(false);
  tutorialPasos = encontrados;
  tutorialIndice = 0;
  tutorialClave = clave;
  tutorialDibujar();
  tutorialRefrescar();
  return true;
}

function tutorialCerrar(marcarVisto = true) {
  if (marcarVisto && tutorialClave) tutorialMarcarVisto(tutorialClave);
  tutorialPasos = [];
  tutorialClave = null;
  const capa = document.getElementById('tutorialCapa');
  if (capa) capa.remove();
  window.removeEventListener('resize', tutorialPosicionar);
  window.removeEventListener('scroll', tutorialPosicionar, true);
  document.removeEventListener('keydown', tutorialTecla);
  tutorialRefrescar();
}

function tutorialTecla(ev) {
  if (ev.key === 'Escape') tutorialCerrar();
  else if (ev.key === 'ArrowRight') tutorialSiguiente();
  else if (ev.key === 'ArrowLeft') tutorialAnterior();
}

function tutorialSiguiente() {
  if (tutorialIndice + 1 < tutorialPasos.length) {
    tutorialIndice += 1;
    tutorialDibujar();
  } else {
    tutorialCerrar();
  }
}

function tutorialAnterior() {
  if (tutorialIndice > 0) {
    tutorialIndice -= 1;
    tutorialDibujar();
  }
}

// Crea la capa (resaltado + burbuja) del paso actual
function tutorialDibujar() {
  const actual = tutorialPasos[tutorialIndice];
  if (!actual) return;

  let capa = document.getElementById('tutorialCapa');
  if (!capa) {
    capa = document.createElement('div');
    capa.id = 'tutorialCapa';
    capa.style.cssText = 'position:fixed;inset:0;z-index:100;';
    capa.setAttribute('aria-live', 'polite');
    document.body.appendChild(capa);
    window.addEventListener('resize', tutorialPosicionar);
    window.addEventListener('scroll', tutorialPosicionar, true);
    document.addEventListener('keydown', tutorialTecla);
  }
  capa.innerHTML = '';

  const resaltado = document.createElement('div');
  resaltado.id = 'tutorialResaltado';
  resaltado.style.cssText = 'position:fixed;border-radius:10px;pointer-events:none;transition:all .2s;box-shadow:0 0 0 9999px rgba(0,0,0,.7);outline:2px solid #38bdf8;';

  const burbuja = document.createElement('div');
  burbuja.id = 'tutorialBurbuja';
  burbuja.setAttribute('role', 'dialog');
  burbuja.style.cssText = 'position:fixed;border:1px solid #38bdf8;background:#111827;color:#fff;border-radius:14px;padding:14px;box-shadow:0 20px 40px rgba(0,0,0,.6);';

  const cabecera = document.createElement('div');
  cabecera.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;';
  const contador = document.createElement('span');
  contador.id = 'tutorialContador';
  contador.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#38bdf8;';
  contador.textContent = `Paso ${tutorialIndice + 1} de ${tutorialPasos.length}`;
  const x = document.createElement('button');
  x.type = 'button';
  x.setAttribute('aria-label', 'Cerrar tutorial');
  x.style.cssText = 'color:#9ca3af;font-size:14px;';
  x.textContent = '✕';
  x.onclick = () => tutorialCerrar();
  cabecera.append(contador, x);

  const titulo = document.createElement('p');
  titulo.id = 'tutorialTitulo';
  titulo.style.cssText = 'font-size:14px;font-weight:700;margin-bottom:4px;';
  titulo.textContent = actual.paso.titulo;
  const texto = document.createElement('p');
  texto.id = 'tutorialTexto';
  texto.style.cssText = 'font-size:13px;color:#9ca3af;margin-bottom:12px;line-height:1.4;';
  texto.textContent = actual.paso.texto;

  const botones = document.createElement('div');
  botones.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const estiloBoton = fondo => `font-size:12px;border-radius:8px;padding:6px 12px;background:${fondo};`;
  const saltar = document.createElement('button');
  saltar.type = 'button';
  saltar.id = 'tutorialSaltar';
  saltar.style.cssText = 'font-size:12px;color:#9ca3af;';
  saltar.textContent = 'Saltar';
  saltar.onclick = () => tutorialCerrar();
  const espacio = document.createElement('div');
  espacio.style.flex = '1';
  botones.append(saltar, espacio);
  if (tutorialIndice > 0) {
    const anterior = document.createElement('button');
    anterior.type = 'button';
    anterior.id = 'tutorialAnterior';
    anterior.style.cssText = estiloBoton('#374151') + 'color:#fff;';
    anterior.textContent = 'Anterior';
    anterior.onclick = tutorialAnterior;
    botones.append(anterior);
  }
  const siguiente = document.createElement('button');
  siguiente.type = 'button';
  siguiente.id = 'tutorialSiguiente';
  siguiente.style.cssText = estiloBoton('#38bdf8') + 'color:#0b0c10;font-weight:700;';
  siguiente.textContent = tutorialIndice + 1 < tutorialPasos.length ? 'Siguiente' : '¡Listo!';
  siguiente.onclick = tutorialSiguiente;
  botones.append(siguiente);

  burbuja.append(cabecera, titulo, texto, botones);
  capa.append(resaltado, burbuja);

  if (actual.el.scrollIntoView) actual.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  tutorialPosicionar();
  setTimeout(tutorialPosicionar, 350); // después del scroll suave
}

// Coloca el resaltado sobre el elemento y la burbuja abajo (o arriba si no entra)
function tutorialPosicionar() {
  const actual = tutorialPasos[tutorialIndice];
  const resaltado = document.getElementById('tutorialResaltado');
  const burbuja = document.getElementById('tutorialBurbuja');
  if (!actual || !resaltado || !burbuja) return;

  const rect = actual.el.getBoundingClientRect();
  const margen = 8;
  const ancho = Math.min(340, window.innerWidth - 24);
  const alto = burbuja.offsetHeight || 190;
  const abajo = rect.bottom + alto + 24 < window.innerHeight;
  const top = abajo ? rect.bottom + margen + 8 : Math.max(12, rect.top - margen - 8 - alto);
  const left = Math.min(Math.max(12, rect.left), window.innerWidth - ancho - 12);

  resaltado.style.top = `${rect.top - margen}px`;
  resaltado.style.left = `${rect.left - margen}px`;
  resaltado.style.width = `${rect.width + margen * 2}px`;
  resaltado.style.height = `${rect.height + margen * 2}px`;
  burbuja.style.top = `${top}px`;
  burbuja.style.left = `${left}px`;
  burbuja.style.width = `${ancho}px`;
}

// Muestra u oculta el botón "?" según la pantalla actual
function tutorialRefrescar() {
  const boton = document.getElementById('btnTutorial');
  if (!boton) return;
  const clave = tutorialClaveActual();
  boton.classList.toggle('hidden', !(clave && TUTORIALES[clave]) || !!document.getElementById('tutorialCapa'));
}

// Vigila el cambio de pantalla: la primera vez que se entra a cada una, abre su recorrido solo
function tutorialVigilar() {
  const clave = tutorialClaveActual();
  if (clave !== tutorialUltimaClave) {
    tutorialUltimaClave = clave;
    if (tutorialClave && tutorialClave !== clave) tutorialCerrar(false);
    clearTimeout(tutorialTimer);
    if (clave && !tutorialYaVisto(clave)) {
      // Se espera un momento: la pantalla carga sus datos antes de buscar los elementos
      tutorialTimer = setTimeout(() => { if (tutorialClaveActual() === clave) tutorialAbrir(false); tutorialRefrescar(); }, 1200);
    }
  }
  tutorialRefrescar();
}

// ═════════════ Centro de Ayuda ═════════════
function renderizarAyuda() {
  el('listaAyuda').innerHTML = AYUDA_TEMAS.map(tema => `
    <details class="bg-gray-950 border border-gray-800 rounded-xl p-3">
      <summary class="cursor-pointer text-sm font-bold text-white">${esc(tema.nombre)} <span class="ml-1 text-[10px] font-normal text-sky-300">· ${esc(tema.paraQuien)}</span></summary>
      <p class="mt-2 text-xs text-gray-400">${esc(tema.resumen)}</p>
      <ol class="mt-2 space-y-1.5 list-decimal list-inside text-xs text-gray-300">
        ${tema.pasos.map(p => `<li>${esc(p)}</li>`).join('')}
      </ol>
      ${tema.consejo ? `<p class="mt-2 text-[11px] text-amber-300">💡 ${esc(tema.consejo)}</p>` : ''}
    </details>`).join('');
}

function abrirAyuda() {
  renderizarAyuda();
  const hayRecorrido = !!TUTORIALES[tutorialClaveActual()];
  el('btnVerRecorrido').classList.toggle('hidden', !hayRecorrido);
  el('modalAyuda').classList.remove('hidden');
}

function cerrarAyuda() {
  el('modalAyuda').classList.add('hidden');
}

function ayudaVerRecorrido() {
  cerrarAyuda();
  tutorialAbrir(true);
}

// En producción se vigila el cambio de pantalla solo; las pruebas lo desactivan para controlarlo a mano
if (!window.__sinTutorialAuto) {
  setInterval(tutorialVigilar, 600);
  tutorialVigilar();
}
