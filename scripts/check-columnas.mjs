/**
 * ¿Alguna consulta pide una columna que no existe?
 *
 * POR QUÉ HACE FALTA
 * Pedirle a PostgREST una columna inexistente no da un error visible:
 * la consulta falla, `data` llega nulo, y la pantalla simplemente no
 * enseña esa sección. Nada se rompe a la vista. Así estuvieron rotos
 * los exámenes en «Mis calificaciones» (pedía `examenes.puntos_max`)
 * y la lista lateral de módulos (pedía `modulos.oculto`), sin que el
 * lint, el build ni ninguna prueba dijeran nada.
 *
 * DE DÓNDE SACA LAS COLUMNAS
 * De `supabase/ESTRUCTURA.md`, que se genera leyendo la base. Así
 * esta comprobación no necesita conexión: corre en cualquier momento
 * y en cualquier máquina, como el resto de `npm run check`.
 *
 * El precio es que ESTRUCTURA.md tiene que estar al día. Si cambias
 * la base y no lo regeneras, esto avisará de columnas que sí existen.
 * Es el lado seguro: un falso aviso se mira en diez segundos; una
 * columna mal escrita vive meses.
 *
 * Uso: node scripts/check-columnas.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raizProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docEstructura = path.join(raizProyecto, 'supabase', 'ESTRUCTURA.md')
const dirFuente = path.join(raizProyecto, 'src')

if (!fs.existsSync(docEstructura)) {
  console.log('No encuentro supabase/ESTRUCTURA.md; me salto la comprobación.')
  process.exit(0)
}

/* --- Leer la estructura ---------------------------------------
   El documento trae, por tabla, una tabla de Markdown cuya primera
   celda es el nombre de la columna entre acentos graves. */
const columnas = {}
let tablaActual = null
for (const linea of fs.readFileSync(docEstructura, 'utf8').split('\n')) {
  const cab = linea.match(/^###\s+`([a-z_0-9]+)`/)
  if (cab) { tablaActual = cab[1]; columnas[tablaActual] = new Set(); continue }
  if (!tablaActual) continue
  const fila = linea.match(/^\|\s*`([a-z_0-9]+)`\s*\|/)
  if (fila) columnas[tablaActual].add(fila[1])
}

const tablas = Object.keys(columnas)
if (!tablas.length) {
  console.log('ESTRUCTURA.md no tiene tablas que pueda leer; me salto la comprobación.')
  process.exit(0)
}
const esTabla = new Set(tablas)

/* --- Recorrer el código --------------------------------------- */
const archivos = []
;(function recorrer(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.jsx?$/.test(e.name)) archivos.push(p)
  }
})(dirFuente)

// .from('tabla') ... .select('a, b, relacion(x)')
const RE = /\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)[\s\S]{0,120}?\.select\(\s*['"`]([^'"`]*)['"`]/g

const avisos = []
for (const archivo of archivos) {
  const src = fs.readFileSync(archivo, 'utf8')
  for (const m of src.matchAll(RE)) {
    const [, tabla, seleccion] = m
    // Una vista que no esté documentada no se puede comprobar.
    if (!columnas[tabla]) continue
    if (seleccion.includes('*')) continue

    // `cursos(titulo)` es una relación anidada, no una columna: se
    // quita el paréntesis y después se descarta el nombre, que es el
    // de otra tabla.
    const sinRelaciones = seleccion.replace(/\([^)]*\)/g, '')
    for (const trozo of sinRelaciones.split(',')) {
      // `alias:columna` -> columna
      const col = trozo.trim().split(':').pop().trim()
      if (!col) continue
      if (!/^[a-z_][a-z_0-9]*$/.test(col)) continue
      if (esTabla.has(col)) continue          // relación anidada
      if (columnas[tabla].has(col)) continue
      const linea = src.slice(0, m.index).split('\n').length
      avisos.push({
        archivo: path.relative(raizProyecto, archivo),
        linea, tabla, col,
      })
    }
  }
}

console.log('')
if (!avisos.length) {
  console.log(`✅ ${archivos.length} archivos · todas las columnas pedidas existen`)
  process.exit(0)
}

for (const a of avisos) {
  console.log(`❌ ${a.archivo}:${a.linea} — ${a.tabla}.${a.col} no existe`)
}
console.log('')
console.log(`${avisos.length} columna(s) inexistente(s).`)
console.log('Una consulta así no da error visible: devuelve nulo y la')
console.log('pantalla se queda sin esa sección, en silencio.')
console.log('')
console.log('Si la columna SÍ existe en tu base, regenera supabase/ESTRUCTURA.md.')
process.exit(1)
