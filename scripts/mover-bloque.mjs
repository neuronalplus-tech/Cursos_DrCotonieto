/**
 * Mueve un bloque de líneas de un archivo a otro, sin tocar el original más
 * que para dejar un comentario. A diferencia de `extraer.mjs`, NO añade
 * `export default`: sirve para mover VARIOS componentes de golpe, a los que
 * luego se les pone `export` a mano.
 *
 * Uso: node scripts/mover-bloque.mjs <origen> <desde> <hasta> <destino> <cabecera>
 *
 * Valida los bordes del bloque antes de escribir nada.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [origen, desde, hasta, destino, ...resto] = process.argv.slice(2)
const cabecera = resto.join(' ').replace(/\\n/g, '\n')

if (!origen || !desde || !hasta || !destino) {
  console.error('Uso: node scripts/mover-bloque.mjs <origen> <desde> <hasta> <destino> [cabecera]')
  process.exit(1)
}

const a = Number(desde)
const b = Number(hasta)
const lineas = readFileSync(origen, 'utf8').split(/\r?\n/)

if (!(a >= 1 && b <= lineas.length && a <= b)) {
  console.error(`Rango inválido: ${a}..${b} (${origen} tiene ${lineas.length} líneas)`)
  process.exit(1)
}

const bloque = lineas.slice(a - 1, b)
if (!/^\s*(export\s+)?(default\s+)?function\s+[A-Za-z0-9_$]+/.test(bloque[0])) {
  console.error('El bloque no empieza por una declaración de función:\n  ' + bloque[0])
  process.exit(1)
}
if (bloque[bloque.length - 1].trim() !== '}') {
  console.error('El bloque no termina en la llave de cierre:\n  ' + bloque[bloque.length - 1])
  process.exit(1)
}

writeFileSync(destino, (cabecera ? cabecera + '\n\n' : '') + bloque.join('\n') + '\n', 'utf8')

const nombres = bloque
  .filter(l => /^function\s/.test(l))
  .map(l => (l.match(/function\s+([A-Za-z0-9_$]+)/) || [])[1])
  .filter(Boolean)

const nuevo = [
  ...lineas.slice(0, a - 1),
  `// (${nombres.join(', ')} se movieron a ${destino.replace(/\\/g, '/')})`,
  ...lineas.slice(b),
]
writeFileSync(origen, nuevo.join('\n'), 'utf8')

console.log(`✓ movidas ${b - a + 1} líneas a ${destino.replace(/\\/g, '/')}`)
console.log(`  componentes: ${nombres.join(', ')}`)
console.log(`  ${origen}: ${lineas.length} -> ${nuevo.length} líneas`)