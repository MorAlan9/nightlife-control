// Crea en los EMULADORES la cuenta de Panda (superadmin) para probar a mano.
// Uso: node scripts/sembrar-emulador.js [clave]   (por defecto: clave-de-prueba-123; solo sirve en el emulador)
const clave = process.argv[2] || 'clave-de-prueba-123';
const DOMINIO = 'usuarios.somosmanijas.app';

async function main() {
  const registro = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=falsa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `panda@${DOMINIO}`, password: clave, returnSecureToken: true })
  });
  const datos = await registro.json();
  if (!datos.localId) throw new Error(`No se pudo crear la cuenta: ${JSON.stringify(datos)}`);

  // "Bearer owner" es el acceso de administrador del emulador (se salta las reglas)
  const marca = await fetch(`http://127.0.0.1:9000/superadmins/${datos.localId}.json?ns=demo-nightlife-default-rtdb`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: 'true'
  });
  if (!marca.ok) throw new Error(`No se pudo marcar superadmin: ${await marca.text()}`);
  console.log(`Panda creado en el emulador. Usuario: panda · uid: ${datos.localId}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
