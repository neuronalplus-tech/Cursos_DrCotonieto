// Vuelca los puntos de codigo EXACTOS de las lineas sospechosas.
//
// Razon de existir: la consola de Windows (CP850/CP437) re-codifica lo que
// imprime, asi que lo que "se ve" al leer un archivo no es necesariamente lo
// que hay dentro. Este volcado sale en ASCII puro (\\uXXXX) y por eso no se
// puede falsear. Solo LEE: no modifica nada.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZES = ['src', 'docs', 'scripts', 'supabase', 'apps-script'];
const EXT = /\.(jsx|js|css|html|md|gs|sql|mjs)$/i;
// Valores que solo aparecen cuando algo UTF-8 se leyo como Latin-1/CP1252.
const SOSPECHOSOS = /[ÂÃ][-¿–‘’“”•—™]/;

function archivos(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (EXT.test(e)) acc.push(p);
  }
  return acc;
}

function escape(s) {
  return [...s]
    .map((c) => {
      const cp = c.codePointAt(0);
      return cp < 128 ? c : '\\u' + cp.toString(16).toUpperCase().padStart(4, '0');
    })
    .join('');
}

let total = 0;
for (const raiz of RAIZES) {
  let lista;
  try {
    lista = archivos(raiz);
  } catch {
    continue;
  }
  for (const f of lista) {
    const buf = readFileSync(f);
    const texto = buf.toString('utf8');
    // Si los bytes no sobreviven un ida y vuelta UTF-8, el archivo esta peor
    // que mojibake: tiene bytes sueltos que no son secuencia valida.
    if (Buffer.compare(Buffer.from(texto, 'utf8'), buf) !== 0) {
      console.log(`!! ${f}: BYTES NO SON UTF-8 VALIDOS`);
      total++;
      continue;
    }
    texto.split(/\r?\n/).forEach((linea, i) => {
      if (SOSPECHOSOS.test(linea)) {
        total++;
        console.log(`${f}:${i + 1}  ${escape(linea.trim()).slice(0, 220)}`);
      }
    });
  }
}
console.log(`--- total: ${total} ---`);