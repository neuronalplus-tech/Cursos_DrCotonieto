/**
 * Extrae un componente de un archivo grande a otro, y lo borra del original.
 *
 * Uso:
 *   node scripts/extraer.mjs <origen> <desde> <hasta> <destino> <cabecera>
 *
 * - Valida que el bloque empiece por una declaración de función y termine en
 *   su llave de cierre; si no, aborta sin tocar nada.
 * - La cabecera va al principio del archivo nuevo (los imports).
 * - Deja en el original un comentario con el destino.
 * - Añade `export default` al final del archivo nuevo.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [origen, desde, hasta, destino, ...resto] = process.argv.slice(2)
const cabecera = resto.join(' ').replace(/\\n/g, '\n')

if (!origen || !desde || !hasta || !destino) {
  console.error('Uso: node scripts/extraer.mjs <origen> <desde> <hasta> <destino> [cabecera]')
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

const nombre = (bloque[0].match(/function\s+([A-Za-z0-9_$]+)/) || [])[1] || 'componente'
const rutaDestino = destino.replace(/\\/g, '/')

writeFileSync(
  destino,
  (cabecera ? cabecera + '\n\n' : '') +
  bloque.join('\n') +
  '\n\nexport default ' + nombre + '\n',
  'utf8',
)

const nuevo = [
  ...lineas.slice(0, a - 1),
  `// (${nombre} se movió a ${rutaDestino})`,
  ...lineas.slice(b),
]
writeFileSync(origen, nuevo.join('\n'), 'utf8')

console.log(`✓ ${nombre}: extraídas ${b - a + 1} líneas a ${rutaDestino}`)
console.log(`  ${origen}: ${lineas.length} -> ${nuevo.length} líneas`)