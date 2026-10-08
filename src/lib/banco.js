/* ============================================================
   BANCO DE PREGUNTAS · conversión y identificadores
   ------------------------------------------------------------
   El banco guarda preguntas sueltas; los exámenes guardan su
   propia copia. Esa decisión es la importante de este archivo, así
   que conviene decir por qué.

   POR QUÉ SE COPIA Y NO SE REFERENCIA
   Si el examen apuntara al banco, corregir una pregunta cambiaría
   retroactivamente el examen que ya respondieron doscientas
   personas: sus respuestas guardadas dejarían de corresponder al
   enunciado, y una calificación que ya comunicaste pasaría a ser
   indefendible. Un examen aplicado es un registro de evaluación y
   tiene que quedar congelado. El banco es una biblioteca de la que
   sacas copias, no una fuente viva.

   SOBRE LOS IDENTIFICADORES
   Las respuestas del alumno se guardan en `intentos_examen` con la
   forma { id_de_pregunta: respuesta }. Por eso:

     · dos preguntas del mismo examen NO pueden compartir id, o la
       respuesta de una se lee como la de la otra;
     · y el id de una pregunta que ya se aplicó NO puede cambiar, o
       los intentos viejos quedan huérfanos.

   De ahí que al agregar preguntas se busquen ids libres en vez de
   renumerar todo, que sería más limpio y rompería el historial.
   ============================================================ */

// Con extensión a propósito: Vite resuelve `./examenes` igual, pero
// Node no, y las pruebas de supabase/test-banco.mjs importan este
// archivo directamente.
import { tipoDe } from './examenes.js'

export const DIFICULTADES = [
  [1, 'Fácil'],
  [2, 'Media'],
  [3, 'Difícil'],
]

export const ETIQUETA_DIFICULTAD = Object.fromEntries(DIFICULTADES)

/**
 * Agrega preguntas a un examen sin pisar los ids que ya tiene.
 *
 * Se usa para todas las vías de alta —banco, pegado de Excel y
 * escritura a mano— porque todas generaban ids empezando en p1 y
 * colisionaban al agregar una segunda tanda.
 */
export function agregarPreguntas(existentes, nuevas) {
  const previas = existentes || []
  const usados = new Set(previas.map(p => p?.id).filter(Boolean))
  let n = 1

  const libres = () => {
    let id
    do { id = `p${n++}` } while (usados.has(id))
    usados.add(id)
    return id
  }

  const agregadas = (nuevas || []).map(q => {
    const id = libres()
    // Los pares de "emparejar" se identifican aparte: si dos
    // preguntas tuvieran pares con el mismo id, el emparejado de una
    // se evaluaría con el de la otra.
    if (Array.isArray(q.pares)) {
      return { ...q, id, pares: q.pares.map((x, j) => ({ ...x, id: `${id}_${j + 1}` })) }
    }
    return { ...q, id }
  })

  return [...previas, ...agregadas]
}

/** Una fila del banco, lista para entrar en un examen. */
export function aPregunta(fila) {
  const contenido = fila?.contenido || {}
  return {
    id: fila?.id != null ? `banco${fila.id}` : 'banco',
    tipo: fila?.tipo || 'opcion',
    pregunta: fila?.pregunta || '',
    ...contenido,
    // Queda de dónde salió. No se usa para calificar: es para que
    // dentro de un año puedas saber si esta pregunta es la del banco
    // o una que editaste solo aquí.
    banco_id: fila?.id ?? null,
  }
}

/**
 * Una pregunta de examen, lista para guardarse en el banco.
 *
 * El enunciado y el tipo se sacan a columnas propias para poder
 * listar y filtrar sin abrir el JSON; el resto —opciones, respuesta
 * o pares— se guarda tal cual en `contenido`.
 */
export function aFila(pregunta, { organizacionId, tema, dificultad }) {
  const tipo = tipoDe(pregunta)
  const contenido = {}
  if (pregunta.opciones) contenido.opciones = pregunta.opciones
  if (pregunta.respuesta != null) contenido.respuesta = pregunta.respuesta
  if (pregunta.pares) contenido.pares = pregunta.pares
  return {
    organizacion_id: organizacionId,
    tipo,
    pregunta: String(pregunta.pregunta || '').trim(),
    contenido,
    tema: (tema || '').trim() || null,
    dificultad: dificultad ? Number(dificultad) : null,
  }
}

/**
 * Toma `cuantas` al azar de una lista.
 *
 * Mezcla Fisher-Yates sobre una copia. Lo tentador es
 * `sort(() => Math.random() - 0.5)`, que parece hacer lo mismo y no
 * reparte igual: deja las primeras posiciones sesgadas hacia el
 * orden original, justo lo que no quieres cuando armas versiones
 * distintas de un examen.
 */
export function tomarAlAzar(lista, cuantas) {
  const copia = [...(lista || [])]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia.slice(0, Math.max(0, Math.min(cuantas, copia.length)))
}

/** Normaliza para buscar: sin acentos, sin mayúsculas. */
export const paraBuscar = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Filtra el banco por tema, tipo, dificultad y texto libre. */
export function filtrar(filas, { tema, tipo, dificultad, busca }) {
  const q = paraBuscar(busca).trim()
  return (filas || []).filter(f => {
    if (tema && (f.tema || '') !== tema) return false
    if (tipo && f.tipo !== tipo) return false
    if (dificultad && String(f.dificultad || '') !== String(dificultad)) return false
    if (q && !paraBuscar(f.pregunta).includes(q)) return false
    return true
  })
}

/** Los temas que existen hoy, para ofrecerlos en vez de pedirlos a ciegas. */
export function temasDe(filas) {
  return [...new Set((filas || []).map(f => f.tema).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'es'))
}

/* ============================================================
   JUEGO SERVIDO · espejo de supabase/EXAMENES_ALEATORIOS.sql
   ------------------------------------------------------------
   servir_examen() y entregar_examen() viven en la base y el
   navegador nunca ve las respuestas. Pero la REGLA de qué se
   quita y qué cuenta como acierto tiene que ser la misma en los
   dos lados, o volverán a discrepar (ya pasó con la calificación
   del curso y hubo que unificarla).

   Por eso estas dos funciones puras replican, paso a paso, lo que
   hace el SQL: limpiar_pregunta() quita lo mismo que
   public.limpiar_pregunta(), y esCorrectaServidor() cuenta lo
   mismo que public.es_correcta_examen(). Las pruebas de
   supabase/test-aleatorios.mjs las enfrentan caso por caso.
   ============================================================ */

/**
 * La pregunta tal como la ve el alumno: sin la marca de correcta,
 * sin la respuesta esperada y sin las respuestas de los pares.
 * En emparejar se agrega `respuestas_posibles` para armar el
 * selector sin adivinar escribiendo.
 */
export function limpiarPregunta(p) {
  if (!p) return null
  const tipo = p.tipo || 'opcion'
  const limpia = { id: p.id, tipo, pregunta: p.pregunta }
  if (tipo === 'opcion' || tipo === 'vf') {
    limpia.opciones = (p.opciones || []).map(o => ({ texto: o.texto }))
  }
  if (tipo === 'emparejar') {
    limpia.pares = (p.pares || []).map(x => ({ id: x.id, premisa: x.premisa }))
    limpia.respuestas_posibles = (p.pares || []).map(x => x.respuesta)
  }
  return limpia
}

/**
 * ¿La respuesta dada es correcta? Réplica exacta de
 * public.es_correcta_examen(): si una discrepa de la otra, la que
 * manda es esta (la probada) y hay que llevar el SQL hacia ella.
 */
export function esCorrectaServidor(p, r) {
  if (r == null) return false
  const tipo = p?.tipo || 'opcion'
  if (tipo === 'vf' || tipo === 'opcion') {
    const txt = (typeof r === 'object' ? null : String(r))
    if (txt == null || !/^-?[0-9]+$/.test(txt.trim())) return false
    return !!p.opciones?.[Number(txt)]?.correcta
  }
  if (tipo === 'corta') {
    const esperado = String(p.respuesta || '').trim().toLowerCase()
    if (!esperado) return false
    const dada = String(typeof r === 'object' ? '' : r).trim().toLowerCase()
    if (!dada) return false
    if (dada === esperado) return true
    return esperado.replace(/;/g, '|').split('|')
      .map(s => s.trim()).filter(Boolean).includes(dada)
  }
  if (tipo === 'emparejar') {
    const pares = p.pares || []
    if (!pares.length || typeof r !== 'object' || r == null) return false
    return pares.every(par =>
      String(r[par.id] ?? '').trim() === String(par.respuesta ?? '').trim())
  }
  return false
}

/**
 * Califica contra el juego SERVIDO, no contra el examen actual.
 * Es lo que hace entregar_examen() en la base: el editor pudo
 * haber cambiado las preguntas mientras el alumno respondía.
 */
export function calificarJuego(juego, respuestas, umbral) {
  const lista = juego || []
  let correctas = 0
  lista.forEach(p => { if (esCorrectaServidor(p, respuestas?.[p.id])) correctas++ })
  const calificacion = lista.length ? Math.round((correctas / lista.length) * 100) : 0
  return { calificacion, aprobado: calificacion >= (umbral ?? 0), correctas, total: lista.length }
}
