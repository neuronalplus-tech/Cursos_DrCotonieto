// Busca, por archivo, el ULTIMO commit cuyo contenido estaba limpio.
//
// Por que hace falta: el mojibake se cuela al escribir con Set-Content desde
// PowerShell 5.1, que usa ANSI/CP1252 por defecto. Git conserva cada version,
// asi que el original se puede recuperar en vez de reconstruirlo a mano.
import { execFileSync } from 'node:child_process';

const ARCHIVOS = process.argv.slice(2);

// Con encoding:'buffer' execFileSync DEVUELVE el Buffer directamente.
// (No viene envuelto en {stdout}, como con encoding:'utf8'.)
function git(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Bytes que UTF-8 produce al leerse como CP1252. Cualquiera de estos en un
// blob sano significa que el archivo ya esta corrupto.
const CORRUPTO = /[\u00C2\u00C3\u00E2][\u0080-\u00BF\u20AC\u201A-\u201E]/;

for (const archivo of ARCHIVOS) {
  const commits = git(['log', '--format=%H', '--', archivo])
    .toString('utf8')
    .trim()
    .split('\n')
    .filter(Boolean);

  let limpio = null;
  let sucio = null;
  for (const sha of commits) {
    let blob;
    try {
      blob = git(['show', `${sha}:${archivo}`]);
    } catch {
      continue;
    }
    const texto = blob.toString('utf8');
    const roto =
      CORRUPTO.test(texto) ||
      Buffer.compare(Buffer.from(texto, 'utf8'), blob) !== 0;
    if (roto && !sucio) sucio = sha;
    if (!roto && !limpio) {
      limpio = sha;
      break;
    }
  }

  console.log(`\n${archivo}`);
  console.log(`  commits      : ${commits.length}`);
  console.log(`  ultimo bueno : ${limpio ? limpio.slice(0, 8) : 'NINGUNO'}`);
  console.log(`  primero malo: ${sucio ? sucio.slice(0, 8) : '(sin dano)'}`);
  if (limpio && sucio) {
    const linea = execFileSync(
      'git',
      ['log', '-1', '--format=%h %s', sucio],
      { encoding: 'utf8' }
    ).trim();
    console.log(` commit malo  : ${linea}`);
  }
}