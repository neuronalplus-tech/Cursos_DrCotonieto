/* ============================================================
   RETENCIÓN · quién está por irse, y por qué lo sabemos
   ------------------------------------------------------------
   Un director no necesita otra tabla de promedios: necesita la
   lista corta de «a quién llamo esta semana». La inactividad es
   el predictor más barato de deserción que tenemos —más que la
   calificación— porque no exige calificar nada: basta con mirar
   cuándo tocó algo por última vez cada inscrito.

   POR QUÉ LÓGICA PURA AQUÍ Y CÁLCULO EN LA BASE
   `alertas_retencion()` (RETENCION_1_ALERTAS.sql) trae una fila
   por inscripción con días inactivo y avance. Aquí solo se
   decide el NIVEL (alto/medio/bajo) y el orden. Si mañana el
   umbral cambia (21 días en vez de 14), se cambia aquí sin
   tocar la base, y todas las pantallas coinciden.

   UMBRALES
   · Alto: 21+ días sin movimiento, o 14+ con avance < 20%.
     El segundo caso es el que se va sin avisar: entró, vio
     poco y desapareció.
   · Medio: 14+ días, o 7+ con avance < 20%.
   · Bajo: el resto. No se enseña como alerta, pero se cuenta.
   ============================================================ */

/** Días desde una fecha hasta hoy. Null si no hay fecha (nunca entró). */
export function diasDesde(fecha, hoy = new Date()) {
  if (!fecha) return null
  const ms = new Date(hoy).getTime() - new Date(fecha).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86400000))
}

/**
 * Nivel de riesgo de una inscripción.
 * `fila` = { ultimo_acceso, dias_inactivo, avance_medio }.
 * `dias_inactivo` manda si viene de la base; si no, se calcula.
 */
export function nivelRiesgo(fila, hoy = new Date()) {
  const dias = fila?.dias_inactivo ?? diasDesde(fila?.ultimo_acceso, hoy)
  // Sin movimiento registrado nunca: no es alerta, es «sin datos».
  // Marcarlo como alto llenaría el tablero de ruido en cursos nuevos.
  if (dias == null) return 'sin_dato'
  const avance = Number(fila?.avance_medio)
  const avanceBajo = Number.isFinite(avance) && avance < 20
  if (dias >= 21 || (dias >= 14 && avanceBajo)) return 'alto'
  if (dias >= 14 || (dias >= 7 && avanceBajo)) return 'medio'
  return 'bajo'
}

export const ETIQUETA_RIESGO = {
  alto: 'Riesgo alto',
  medio: 'Riesgo medio',
  bajo: 'En curso',
  sin_dato: 'Sin datos',
}

/** Solo los que piden atención, ordenados: primero alto, luego más días. */
export function soloAlertas(filas, hoy = new Date()) {
  return (filas || [])
    .map((f) => ({ ...f, riesgo: nivelRiesgo(f, hoy) }))
    .filter((f) => f.riesgo === 'alto' || f.riesgo === 'medio')
    .sort((a, b) => {
      const orden = { alto: 0, medio: 1 }
      if (orden[a.riesgo] !== orden[b.riesgo]) return orden[a.riesgo] - orden[b.riesgo]
      return (b.dias_inactivo ?? 0) - (a.dias_inactivo ?? 0)
    })
}

/** Resumen para el encabezado: cuántos en cada nivel. */
export function resumirRiesgo(filas, hoy = new Date()) {
  const r = { alto: 0, medio: 0, bajo: 0, sin_dato: 0, total: 0 }
  for (const f of filas || []) {
    r.total++
    const n = nivelRiesgo(f, hoy)
    if (r[n] != null) r[n]++
  }
  return r
}
