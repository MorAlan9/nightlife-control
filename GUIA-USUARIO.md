# Guía de uso · SomosManijas

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
| **Control de Puerta** | Buscar y marcar ingresos |
| **DJ** | Ver la noche y el lineup |

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

## Si algo no anda

- **"Usuario o contraseña incorrectos"**: revisá mayúsculas y espacios. El usuario va en minúsculas.
- **"Tu cuenta todavía no fue aprobada"**: tu admin tiene que aprobarte.
- **Aviso rojo arriba de la pantalla**: no hay conexión con la base de datos; revisá tu internet y recargá.
- **Olvidé mi contraseña**: por ahora no se puede recuperar desde la página. Pedile a Panda que borre tu cuenta (en Firebase → Authentication) y volvé a registrarte.
