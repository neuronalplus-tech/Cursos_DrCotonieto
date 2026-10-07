/* ============================================================
   PADRÓN · leer una lista de inscripción con columnas
   ------------------------------------------------------------
   El alta en lote ya existía, pero su lector se quedaba solo con lo
   que llevara arroba. Una institución manda un padrón así:

     Nombre              Correo                 Generación  Ruta
     Ana López Ruiz      ana@ejemplo.mx         2026-A      Clínica

   ...y de esas cuatro columnas se aprovechaba una. El nombre, la
   generación y la ruta había que capturarlos después a mano, uno por
   uno, que es exactamente el trabajo que el alta en lote existe para
   evitar.

   SE REUSA EL LECTOR DE LOS EXÁMENES
   Separar celdas respetando comillas y adivinar si el separador es
   tabulador o coma ya estaba resuelto en examenes.js. Escribirlo
   otra vez sería tener dos lectores de CSV que se comportan distinto
   ante el mismo pegado.

   NO SE INVENTA NADA
   Si una fila no trae correo, se reporta y se salta; no se adivina.
   Dar de alta a alguien con un correo adivinado es crearle una
   cuenta que nunca va a poder abrir.
   ============================================================ */

import { separarLinea, normalizarEncabezado } from './examenes.js'

/* El detector de examenes.js solo distingue tabulador de coma, y no
   puede ampliarse: en un examen el punto y coma separa los pares de
   "emparejar" ("ACT=Aceptar; DBT=Regular"), así que tomarlo por
   separador partiría esas preguntas por la mitad.

   Aquí sí hace falta, porque es lo que usa Excel en español —y lo que
   usan los CSV que exporta esta misma plataforma—. Como un padrón no
   lleva punto y coma dentro de un nombre, no hay ambigüedad. */
const TAB = String.fromCharCode(9)

function separadorDePadron(texto) {
  const saltos = new RegExp('\\r?\\n')
  const muestra = String(texto).split(saltos).slice(0, 5).join(String.fromCharCode(10))
  const cuenta = (ch) => muestra.split(ch).length - 1
  const candidatos = [[TAB, cuenta(TAB)], [';', cuenta(';')], [',', cuenta(',')]]
  candidatos.sort((a, b) => b[1] - a[1])
  return candidatos[0][1] > 0 ? candidatos[0][0] : TAB
}

export const COLUMNAS_PADRON = ['email', 'nombre', 'generacion', 'grupo']

/** Encabezados que se reconocen para cada columna. */
export function columnaDesdeEncabezado(k) {
  if (['correo', 'correoelectronico', 'email', 'mail', 'ema'].includes(k)) return 'email'
  if (['nombre', 'nombrecompleto', 'alumno', 'participante', 'nombreyapellidos']
    .includes(k)) return 'nombre'
  if (['generacion', 'cohorte', 'promocion'].includes(k)) return 'generacion'
  if (['ruta', 'grupo', 'modalidad', 'sede'].includes(k)) return 'grupo'
  return null
}

const PARECE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ¿Esta celda es un correo? Es lo que ancla cada fila. */
export const esCorreo = (s) => PARECE_CORREO.test(String(s || '').trim())

/**
 * Lee el texto pegado.
 *
 * @returns {{ filas: Array, errores: string[], conColumnas: boolean }}
 *   filas: [{ email, nombre, generacion, grupo }]
 *   conColumnas: si venía algo más que correos, para que la pantalla
 *                sepa si enseñar la vista previa o no.
 */
export function parsePadron(texto) {
  const errores = []
  if (!texto || !texto.trim()) return { filas: [], errores, conColumnas: false }

  const sep = separadorDePadron(texto)
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').filter(l => l.trim() !== '')
  const celdas = lineas.map(l => separarLinea(l, sep).map(c => c.trim()))

  // ¿La primera línea es un encabezado reconocible?
  const mapa = {}
  for (const [i, c] of (celdas[0] || []).entries()) {
    const col = columnaDesdeEncabezado(normalizarEncabezado(c))
    if (col && mapa[col] == null) mapa[col] = i
  }
  // Un encabezado de verdad no contiene correos: si la primera fila
  // trae uno, es un dato y no una cabecera, por muy bien que encajen
  // los nombres de columna.
  const hayEncabezado = mapa.email != null && !(celdas[0] || []).some(esCorreo)
  const cuerpo = hayEncabezado ? celdas.slice(1) : celdas

  const filas = []
  const vistos = new Set()

  cuerpo.forEach((c, i) => {
    const numero = i + (hayEncabezado ? 2 : 1)

    // `nombre` sin valor inicial: las dos ramas lo asignan siempre.
    // La generación y la ruta solo existen con encabezado, así que
    // esas sí arrancan vacías.
    let email, nombre, generacion = '', grupo = ''
    if (hayEncabezado) {
      email = (c[mapa.email] || '').trim().toLowerCase()
      nombre = mapa.nombre != null ? (c[mapa.nombre] || '').trim() : ''
      generacion = mapa.generacion != null ? (c[mapa.generacion] || '').trim() : ''
      grupo = mapa.grupo != null ? (c[mapa.grupo] || '').trim() : ''
    } else {
      // Sin encabezado, el correo se busca donde esté: hay quien pone
      // el nombre primero y quien lo pone después.
      const indices = c.map((x, j) => (esCorreo(x) ? j : -1)).filter(j => j >= 0)
      if (!indices.length) {
        if (c.some(x => x)) errores.push(`Fila ${numero}: no encontré un correo.`)
        return
      }
      // Varios correos en la misma línea es la lista de toda la vida
      // ("ana@…, juan@…"), no un padrón: cada uno es una persona y no
      // hay nombre que repartir entre ellos.
      if (indices.length > 1) {
        for (const j of indices) {
          const e2 = c[j].toLowerCase()
          if (vistos.has(e2)) {
            errores.push(`Fila ${numero}: ${e2} estaba repetido; se usa solo la primera vez.`)
            continue
          }
          vistos.add(e2)
          filas.push({ email: e2, nombre: '', generacion: '', grupo: '' })
        }
        return
      }
      const idx = indices[0]
      email = c[idx].toLowerCase()
      nombre = c.filter((_, j) => j !== idx).find(x => x && !esCorreo(x)) || ''
    }

    if (!email) {
      errores.push(`Fila ${numero}: falta el correo.`)
      return
    }
    if (!esCorreo(email)) {
      errores.push(`Fila ${numero}: "${email}" no parece un correo.`)
      return
    }
    if (vistos.has(email)) {
      errores.push(`Fila ${numero}: ${email} estaba repetido; se usa solo la primera vez.`)
      return
    }
    vistos.add(email)
    filas.push({ email, nombre, generacion, grupo })
  })

  const conColumnas = filas.some(f => f.nombre || f.generacion || f.grupo)
  return { filas, errores, conColumnas }
}

/**
 * Cruza las generaciones del padrón con las que existen en la base.
 *
 * Compara sin acentos ni mayúsculas porque nadie teclea "2026-A"
 * igual dos veces. Lo que no cuadra se devuelve aparte en vez de
 * crearse solo: crear generaciones por un error de dedo llenaría la
 * lista de duplicados que luego hay que limpiar a mano.
 */
export function cruzarGeneraciones(filas, generaciones) {
  const clave = (s) => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const porNombre = {}
  for (const g of generaciones || []) porNombre[clave(g.nombre)] = g.id

  const asignadas = {}
  const sinCruzar = new Set()
  for (const f of filas || []) {
    if (!f.generacion) continue
    const id = porNombre[clave(f.generacion)]
    if (id != null) asignadas[f.email] = id
    else sinCruzar.add(f.generacion)
  }
  return { asignadas, sinCruzar: [...sinCruzar] }
}

/** Plantilla para que el cliente te mande el padrón ya en forma. */
export const PLANTILLA_PADRON = [
  ['nombre', 'correo', 'generacion', 'ruta'].join('\t'),
  ['Ana López Ruiz', 'ana@ejemplo.mx', '2026-A', 'Clínica'].join('\t'),
  ['Juan Pérez Soto', 'juan@ejemplo.mx', '2026-A', 'Educativa'].join('\t'),
].join('\n')
