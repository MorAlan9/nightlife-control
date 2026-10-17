# Guía de uso · SomosManijas

## Tutorial dentro del sistema

No hace falta leer este documento para empezar: el sistema trae su propio tutorial.

- **Recorrido guiado**: la primera vez que entrás a cada pantalla, el sistema resalta cada campo y te explica qué poner y cómo ("Paso 1 de 7"). Podés avanzar con **Siguiente**, volver con **Anterior** o cerrarlo con **Saltar**.
- **Botón ❓ (abajo a la izquierda)**: en cualquier pantalla vuelve a mostrar el recorrido.
- **Botón ❓ Ayuda (arriba)**: abre el Centro de Ayuda, con una guía por tema (cómo registrarse, anotar invitados, la puerta, la caja, etc.). Está disponible antes de ingresar.

El contenido de esta guía es el mismo que el del Centro de Ayuda.

Sistema para manejar las listas y la puerta de un boliche o after. Funciona desde el celular o la compu, sin instalar nada.

## Primeros pasos del dueño del boliche

1. Entrá a la página y tocá **Reg. Boliche**. Cargá el nombre del boliche, tu nombre, un usuario, tu WhatsApp y una contraseña (mínimo 6 caracteres).
2. Esperá a que **Panda habilite tu boliche**. Hasta entonces no vas a poder entrar.
3. Cuando te habiliten, ingresá con tu usuario y contraseña.
4. Tocá **＋ Nueva noche**, poné el nombre (ej: "Sábado 18/10") y la fecha. Cada noche tiene sus propios invitados, ingresos, precios y DJs. La noche con ⭐ es la que ve el público.
5. En **Configuración de Caja** cargá el precio de la entrada del boliche y del after, y cuánto se le paga a cada RPP por persona que ingresa.
6. En **Ubicaciones** cargá la dirección o el link de Maps. La del After es secreta: solo la ve quien está anotado.
7. En **Lineup** cargá los DJs con su horario.

## Sumar a tu equipo

- Cada persona de tu equipo entra a **Reg. Personal**, elige tu boliche y su rol (RPP, DJ o Control de Puerta).
- En tu panel **Personal del Boliche** vas a ver un aviso "pendiente": tocá **Aprobar**. Sin tu aprobación no pueden entrar.
- Desde ahí también podés darle permisos de administrador a alguien o quitarlo.

## Qué puede hacer cada rol

| Rol | Puede |
|---|---|
| **Admin** | Todo: crear noches, caja, DJs, aprobar personal, ver el historial, deshacer un ingreso |
| **RPP / Promotor** | Anotar gente en su lista, editar o quitar lo suyo (mientras no haya ingresado), marcar ingresos, ver su rendimiento y su comisión |
| **Socio** | Lo mismo que el admin (se le dan los permisos de admin cuando el admin lo aprueba) |
| **Control de Puerta** | Buscar y marcar ingresos |
| **DJ** | Ver la noche y el lineup |

## Borrar una noche

Si cargaste una noche por error o ya no la necesitás, el admin toca **🗑️ Borrar noche** (arriba, junto al selector de noche). Se borra la noche con todos sus invitados, ingresos, DJs, caja e historial, y **no se puede deshacer**: por seguridad hay que escribir el nombre exacto de la noche para confirmar. Para borrar solo los datos de prueba sin perder la noche, pedíselo a Panda.

## Varios precios en la puerta

En **Configuración de Caja** el precio de arriba es el base y se llama **General**. En **Precios en la puerta** podés sumar otros (ej: Mujeres, Anticipada, VIP), cada uno con su monto. Son distintos para el Boliche y para el After.

- Al anotar a alguien con **Entrada Paga**, el RPP elige con qué precio.
- En la puerta, al tocar **Marcar** sobre alguien de Entrada Paga, el sistema pregunta **qué precio se cobró** (aparece marcado el que tenía al anotarse). La caja suma lo que realmente se cobró y muestra el detalle por precio.
- Si quitás un precio, a quienes ya se anotaron con él no les cambia el monto.

## En la puerta

- Buscá por **nombre, DNI o teléfono** (con o sin puntos).
- Tocá **✅ Marcar** cuando la persona entra. La fila se tacha y queda "DENTRO".
- Si la misma persona está anotada por **dos RPP**, el sistema te pregunta por cuál lista entra. La entrada se cobra una sola vez y el ingreso se le acredita a ese RPP.
- Si te equivocaste, el admin puede tocar **Deshacer**.
- Con los botones **Boliche / Solo After** cambiás entre una lista y la otra.

## Para el público (Manija)

Quien quiere saber si está en lista entra a **Manija**, elige el boliche, escribe su DNI y ve:
- si está en la lista del boliche y/o del After, y por qué RPP;
- el mapa del After (solo si está anotado ahí).

No puede ver a nadie más.

## Borrar una productora (solo Panda)

En el panel central, cada tarjeta tiene un botón **🗑️**. Borra la productora con todas sus noches, personal, invitados e historial. Hay que escribir el nombre exacto para confirmar. Los usuarios de login del personal siguen existiendo en Firebase → Authentication: si hace falta que puedan registrarse de nuevo con el mismo usuario, hay que borrarlos también ahí.

## Si algo no anda

- **"Usuario o contraseña incorrectos"**: revisá mayúsculas y espacios. El usuario va en minúsculas.
- **"Tu cuenta todavía no fue aprobada"**: tu admin tiene que aprobarte.
- **Aviso rojo arriba de la pantalla**: no hay conexión con la base de datos; revisá tu internet y recargá.
- **Olvidé mi contraseña**: por ahora no se puede recuperar desde la página. Pedile a Panda que borre tu cuenta (en Firebase → Authentication) y volvé a registrarte.
