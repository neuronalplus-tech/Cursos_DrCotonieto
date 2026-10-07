/* ============================================================
   CALIFICACIÓN FINAL DEL CURSO
   ------------------------------------------------------------
   UNA sola implementación, usada por las dos pantallas que
   muestran la nota: la del alumno (Mis calificaciones) y la rejilla
   del facilitador (Panel de progreso).

   POR QUÉ ESTO VIVE AQUÍ Y NO EN CADA PANTALLA
   Antes la nota se calculaba solo del lado del alumno. La rejilla
   del facilitador no la tenía, y en cuanto la tuviera habría dos
   implementaciones del mismo número. Dos implementaciones del mismo
   número siempre acaban dando dos números distintos, y el día que
   un alumno reclame su constancia no vas a poder defender ninguno.

   LAS TRES REGLAS QUE IMPORTAN

   1. Lo no calificado NO cuenta como cero. A mitad de curso, contar
      los ceros de lo que todavía no se entrega da un 20% que no
      significa nada y asusta sin motivo.

   2. Todo se normaliza a base 100 ANTES de promediar. Un examen
      sobre 10 y una tarea sobre 100 no se pueden promediar crudos.

   3. Si un componente no tiene nada calificado, su peso se reparte
      entre los demás en vez de restarse del total. Con "exámenes
      40 / tareas 40 / foro 20", quien lleva solo el examen hecho
      debe ver su nota del examen, no un 40 sobre 100.

   SIN CONFIGURAR, NADA CAMBIA
   Un curso sin ponderación promedia todo por igual, que es
   exactamente lo que hacía antes.
   ============================================================ */

export const COMPONENTES = [
  ['examenes', 'Exámenes'],
  ['tareas', 'Tareas'],
  ['foro', 'Foro'],
  ['avance', 'Avance del material'],
]

export const ETIQUETA_COMPONENTE = Object.fromEntries(COMPONENTES)

/** Ponderación de arranque cuando decides configurar una. */
export const PONDERACION_SUGERIDA = {
  examenes: 40, tareas: 40, foro: 20, avance: 0, minima: 70,
}

const redondear = (n) => Math.round(n * 10) / 10

/** Una nota suelta llevada a base 100. `maximo` nulo se asume 100. */
export function aBase100(valor, maximo) {
  if (valor == null || valor === '') return null
  const m = Number(maximo)
  const tope = Number.isFinite(m) && m > 0 ? m : 100
  const v = Number(valor)
  if (!Number.isFinite(v)) return null
  return (v / tope) * 100
}

/** ¿Hay una ponderación de verdad, o es un objeto vacío disfrazado? */
export function tienePonderacion(config) {
  if (!config) return false
  return COMPONENTES.some(([k]) => Number(config[k]) > 0)
}

/**
 * Calcula la calificación del curso.
 *
 * @param entradas {{
 *   examenes?: Array<{valor:number, maximo?:number}>,
 *   tareas?:   Array<{valor:number, maximo?:number}>,
 *   foro?:     Array<{valor:number, maximo?:number}>,
 *   avance?:   {hechos:number, total:number} | null
 * }}
 * @param config ponderación del curso, o null para promedio simple.
 *
 * @returns null si no hay NADA calificado todavía, o
 *   { valor, ponderada, minima, aprobado, de, detalle[] }
 */
export function calcular(entradas, config) {
  const medias = {}   // componente -> media en base 100
  const cuentas = {}  // componente -> cuántas notas la formaron

  for (const [clave] of COMPONENTES) {
    if (clave === 'avance') continue
    const notas = (entradas?.[clave] || [])
      .map(x => aBase100(x?.valor, x?.maximo))
      .filter(n => n != null)
    if (notas.length) {
      medias[clave] = notas.reduce((s, n) => s + n, 0) / notas.length
      cuentas[clave] = notas.length
    }
  }

  // El avance es un porcentaje que ya existe; solo cuenta si se le
  // dio peso. Meterlo en el promedio simple castigaría a quien va al
  // corriente con las entregas pero no ha abierto cada recurso.
  const av = entradas?.avance
  const hayAvance = av && Number(av.total) > 0
  if (hayAvance && tienePonderacion(config) && Number(config.avance) > 0) {
    medias.avance = (Number(av.hechos) / Number(av.total)) * 100
    cuentas.avance = 1
  }

  const presentes = Object.keys(medias)
  if (!presentes.length) return null

  const minima = config?.minima != null ? Number(config.minima) : null
  const ponderada = tienePonderacion(config)

  if (!ponderada) {
    // Promedio simple de TODAS las notas, no de las medias por
    // componente: es lo que hacía antes y cambiarlo en silencio
    // movería notas ya comunicadas.
    const todas = []
    for (const [clave] of COMPONENTES) {
      if (clave === 'avance') continue
      for (const x of entradas?.[clave] || []) {
        const n = aBase100(x?.valor, x?.maximo)
        if (n != null) todas.push(n)
      }
    }
    const valor = redondear(todas.reduce((s, n) => s + n, 0) / todas.length)
    return {
      valor, ponderada: false, minima,
      aprobado: minima != null ? valor >= minima : null,
      de: todas.length,
      detalle: presentes.map(clave => ({
        clave, etiqueta: ETIQUETA_COMPONENTE[clave],
        media: redondear(medias[clave]), n: cuentas[clave],
        peso: null, pesoEfectivo: null,
      })),
    }
  }

  // Ponderado: solo pesan los componentes que tienen algo calificado,
  // y sus pesos se renormalizan sobre la suma de los presentes.
  const conPeso = presentes.filter(k => Number(config[k]) > 0)
  if (!conPeso.length) {
    // Hay notas, pero ninguna de un componente con peso. Devolver 0
    // sería mentir; se cae al promedio simple de lo que sí hay.
    return calcular(entradas, null)
  }

  const sumaPesos = conPeso.reduce((s, k) => s + Number(config[k]), 0)
  let acumulado = 0
  const detalle = []
  for (const clave of presentes) {
    const peso = Number(config[clave]) || 0
    const efectivo = peso > 0 ? (peso / sumaPesos) * 100 : 0
    if (peso > 0) acumulado += medias[clave] * (peso / sumaPesos)
    detalle.push({
      clave, etiqueta: ETIQUETA_COMPONENTE[clave],
      media: redondear(medias[clave]), n: cuentas[clave],
      peso, pesoEfectivo: redondear(efectivo),
    })
  }

  const valor = redondear(acumulado)
  return {
    valor, ponderada: true, minima,
    aprobado: minima != null ? valor >= minima : null,
    de: conPeso.reduce((s, k) => s + (cuentas[k] || 0), 0),
    detalle,
  }
}

/**
 * ¿La ponderación está bien escrita?
 * Devuelve un aviso para la pantalla, o null.
 *
 * No impide guardar: que los pesos no sumen 100 es raro pero legítimo
 * —se renormalizan— y bloquear el guardado a media edición es peor
 * que avisar.
 */
export function revisarPonderacion(config) {
  if (!tienePonderacion(config)) return null
  const suma = COMPONENTES.reduce((s, [k]) => s + (Number(config[k]) || 0), 0)
  if (suma === 100) return null
  return `Los pesos suman ${suma}, no 100. Se repartirán proporcionalmente, ` +
    `así que la nota sale igual, pero conviene revisarlo.`
}

/** Texto corto para la pantalla: "82.5" o "—". */
export const mostrar = (nota) => (nota == null ? '—' : String(nota.valor))
