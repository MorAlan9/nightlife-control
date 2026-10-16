// Corre las pruebas de reglas contra el emulador de Firebase y limpia el emulador al terminar.
// En Windows firebase-tools suele dejar un proceso java escuchando; si queda vivo, la corrida siguiente falla.
const { spawnSync } = require('node:child_process');

const PUERTO = 9000;

function liberarPuerto() {
  if (process.platform !== 'win32') return;
  const powershell = require('node:path').join(process.env.SystemRoot || 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  spawnSync(powershell, ['-NoProfile', '-Command',
    `Get-NetTCPConnection -LocalPort ${PUERTO} -State Listen -ErrorAction SilentlyContinue | ` +
    `ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'java' } | Stop-Process -Force }`
  ], { stdio: 'ignore' });
}

liberarPuerto();
const resultado = spawnSync(
  'npx firebase emulators:exec --only database --project demo-nightlife "node --test tests/rules.test.js"',
  { stdio: 'inherit', shell: true }
);
liberarPuerto();
process.exit(resultado.status === null ? 1 : resultado.status);
