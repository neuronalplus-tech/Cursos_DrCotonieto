// Repara mojibake: texto UTF-8 que se guardo leido como CP1252.
//
// MECANISMO
// ---------
// "modulo" con tilde son los bytes C3 B3 en UTF-8. Si PowerShell 5.1 los lee
// como CP1252 (que es lo que hace Set-Content sin -Encoding UTF8) y vuelve a
// guardar, quedan los caracteres U+00C3 U+00B3. La vuelta al origen es exacta:
// se reconstruyen los bytes originales y se decodifican como UTF-8.
//
// POR QUE HACE FALTA EL MAPA MANUAL
// ---------------------------------
// CP1252 no es latin1: el rango 0x80-0x9F lo ocupa con signos tipograficos
// (0x80 = euro, 0x97 = raya, 0x95 = vineta). Sin ese mapa, un emoji como
// U+1F50B quedaria como bytes sueltos que no forman una secuencia valida.
// Buffer.from(texto,'latin1') no sirve: trunca todo lo que pase de U+00FF.
//
// SEGURIDAD
// ---------
//   1. Solo toca archivos que ya traen marcas de corrupcion.
//   2. Si al reparar queda un caracter que no se puede mapear, o el resultado
//      no es UTF-8 valido, NO escribe: avisa y deja el archivo como estaba.
//   3. Nunca aplica mas de una pasada: doble-dano y texto sano se confundirian.
//
// USO:  node scripts/reparar-mojibake.mjs           (simula, no escribe)
//       node scripts/reparar-mojibake.mjs --aplicar (escribe)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZES = ['src', 'docs', 'supabase', 'apps-script'];
const EXT = /\.(jsx|js|css|html|md|gs|sql|json|ts|tsx)$/i;
const APLICAR = process.argv.includes('--aplicar');

// Mapa inverso de CP1252: de caracter Unicode a byte, para 0x80-0x9F.
const INVERSO_CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

// Secuencia INEQUIVOCAMENTE corrupta: el byte U+00C2/U+00C3/U+00E2 seguido de
// algo que en CP1252 ocupa 0x80-0x9F. En espanol sano no existe: "a" es U+0061,
// la "o" acentuada es U+00F3. El riesgo de falsos positivos es practicamente
// nulo, y aun asi la reparacion se valida antes de escribir.
const MARCAS =
  /[\u00c2\u00c3\u00e2][\u0080-\u00bf\u20ac\u201a\u201e\u2020\u2021\u2022\u2026\u2030\u0152\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2039\u203a]/;

function archivos(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (EXT.test(e)) acc.push(p);
  }
  return acc;
}

/** Convierte el texto corrupto de vuelta a sus bytes originales. */
function aBytes(texto) {
  const bytes = [];
  for (const ch of texto) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfeff) continue; // BOM: artefacto de Set-Content, no texto
    if (cp <= 0xff) bytes.push(cp);
    else if (INVERSO_CP1252[cp] !== undefined) bytes.push(INVERSO_CP1252[cp]);
    else return null; // no se sabe de que byte salio: no se repara
  }
  return Buffer.from(bytes);
}

const cambios = [];
const problemas = [];

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
    if (!MARCAS.test(texto)) continue;

    const bytes = aBytes(texto);
    if (!bytes) {
      problemas.push(`${f}: hay caracteres sin origen known; se deja como esta`);
      continue;
    }
    const reparado = bytes.toString('utf8');

    // El resultado tiene que ser UTF-8 de verdad: si el decoder cambio un
    // caracter por U+FFFD, el archivo original tenia bytes que no eran UTF-8.
    if (reparado.includes('\ufffd')) {
      problemas.push(`${f}: la reparacion produce caracteres invalidos; se deja`);
      continue;
    }
    const restantes = (reparado.match(MARCAS) || []).length;
    const antes = (texto.match(MARCAS) || []).length;
    if (restantes >= antes) {
      problemas.push(`${f}: la reparacion no reduce las marcas; se deja`);
      continue;
    }

    cambios.push({ f, antes, restantes, reparado, bytes });
  }
}

for (const c of cambios) console.log(`${c.f}: ${c.antes} -> ${c.restantes} marcas`);
for (const p of problemas) console.log(`AVISO  ${p}`);

if (cambios.length === 0) {
  console.log('\nNada que reparar.');
} else if (APLICAR) {
  for (const c of cambios) writeFileSync(c.f, c.bytes);
  console.log(`\nReparados ${cambios.length} archivo(s).`);
} else {
  console.log(`\nSimulacion: ${cambios.length} archivo(s). Usa --aplicar.`);
}