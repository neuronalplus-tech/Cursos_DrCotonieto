/**
 * Encuentra el rango exacto de una declaración de nivel superior.
 *
 * Adivinar el final contando secciones de comentario es frágil; esto cuenta
 * llaves de verdad. Se saltan cadenas, plantillas y comentarios para no
 * confundirse con un `{` o un `}` dentro de texto.
 *
 * Uso: node scripts/limites.mjs <archivo> <nombre>
 * Salida: LÍNEA_INICIO LÍNEA_FIN   (1-based, ambas incluidas)
 */
import { readFileSync } from 'node:fs'

const [archivo, nombre] = process.argv.slice(2)
if (!archivo || !nombre) {
  console.error('Uso: node scripts/limites.mjs <archivo> <nombreDeFuncion>')
  process.exit(1)
}

const fuente = readFileSync(archivo, 'utf8')
const lineas = fuente.split(/\r?\n/)

// Localiza la línea donde empieza la declaración.
let inicio = -1
for (let i = 0; i < lineas.length; i++) {
  const re = new RegExp('^\\s*(export\\s+)?(default\\s+)?function\\s+' + nombre + '\\s*\\(')
  if (re.test(lineas[i])) { inicio = i; break }
}
if (inicio === -1) {
  console.error(`No se encontró la función "${nombre}" en ${archivo}`)
  process.exit(1)
}

// Recorre desde ahí contando llaves, ignorando cadenas y comentarios.
// Importante: la firma puede traer desestructuración (function X({ a, b }) {),
// y esas llaves NO son el cuerpo. Solo cuenta desde el `{` que abre el cuerpo.
let profundidad = 0
let cuerpoAbierto = false
let enPlantilla = false
let paren = 0
let fin = -1

for (let i = inicio; i < lineas.length; i++) {
  const linea = lineas[i]
  let enCadena = null

  for (let j = 0; j < linea.length; j++) {
    const c = linea[j]

    if (enCadena) {
      if (c === '\\') { j++; continue }
      if (c === enCadena) enCadena = null
      continue
    }
    if (enPlantilla) {
      if (c === '\\') { j++; continue }
      if (c === '`') enPlantilla = false
      continue
    }
    if (c === '/' && linea[j + 1] === '/') break
    if (c === '/' && linea[j + 1] === '*') {
      const cierre = linea.indexOf('*/', j + 2)
      if (cierre === -1) { j = linea.length } else { j = cierre + 1 }
      continue
    }
    if (c === '"' || c === "'") { enCadena = c; continue }
    if (c === '`') { enPlantilla = true; continue }

    // Paréntesis de la firma: solo para saber dónde acaba.
    if (!cuerpoAbierto) {
      if (c === '(') paren++
      if (c === ')') paren--
      if (c === '{' && paren === 0) { cuerpoAbierto = true; profundidad = 1 }
      continue
    }

    if (c === '{') profundidad++
    if (c === '}') {
      profundidad--
      if (profundidad === 0) { fin = i; break }
    }
  }
  if (fin !== -1) break
}

if (fin === -1) {
  console.error(`No se pudo cerrar la función "${nombre}": revisa el emparejado de llaves.`)
  process.exit(1)
}

console.log(`${inicio + 1} ${fin + 1}`)
console.log(`  inicio: ${lineas[inicio].trim().slice(0, 70)}`)
console.log(`  cierre: ${lineas[fin].trim().slice(0, 70)}`)