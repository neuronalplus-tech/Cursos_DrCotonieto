/**
 * Extrae un bloque de líneas de un archivo y lo deja como comentario.
 * Útil para el refactor por etapas: mueve el bloque a otro archivo y borra
 * el original sin depender de que un editor de texto clone los 6.000+ caracteres.
 *
 * Uso: node scripts/recortar.mjs <archivo> <desde> <hasta> <comentario>
 * Las líneas son 1-based y ambas incluidas. Valida que los bordes anclen.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [archivo, desde, hasta, ...resto] = process.argv.slice(2)
const comentario = resto.join(' ')

if (!archivo || !desde || !hasta) {
  console.error('Uso: node scripts/recortar.mjs <archivo> <desde> <hasta> [comentario]')
  process.exit(1)
}

const a = Number(desde)
const b = Number(hasta)
const lineas = readFileSync(archivo, 'utf8').split(/\r?\n/)

if (!(a >= 1 && b <= lineas.length && a <= b)) {
  console.error(`Rango inválido: ${a}..${b} (el archivo tiene ${lineas.length} líneas)`)
  process.exit(1)
}

const bloque = lineas.slice(a - 1, b)
console.log(`Recortando ${b - a + 1} líneas (${a}..${b})`)
console.log('  inicio : ' + bloque[0].trim().slice(0, 70))
console.log('  cierre : ' + bloque[bloque.length - 1].trim().slice(0, 70))

// Ancla: la primera y la última deben parecer inicio y fin de bloque.
if (!/^\s*(function|export function|const \w+ = \()/.test(bloque[0])) {
  console.error('El inicio del bloque no parece una declaración de función. Abortando.')
  process.exit(1)
}
if (bloque[bloque.length - 1].trim() !== '}') {
  console.error('La última línea del bloque no es una llave de cierre. Abortando.')
  process.exit(1)
}

const sustituto = comentario
  ? comentario.split('|').map(s => s.trim()).map(s => '// ' + s)
  : []

const salida = [
  ...lineas.slice(0, a - 1),
  ...sustituto,
  ...lineas.slice(b),
]
writeFileSync(archivo, salida.join('\n'), 'utf8')
console.log(`Listo. ${archivo}: ${lineas.length} -> ${salida.length} líneas`)