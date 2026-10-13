/* ============================================================
   COMUNICADOS · historial y programado (F5-1)
   ------------------------------------------------------------
   Hoy un comunicado se envía y se olvida. Esta base guarda QUÉ
   se mandó, a QUIÉN (criterio + conteo, no la lista de correos)
   y CUÁNDO, para que el director vea el historial sin depender
   de la memoria de quien lo envió.

   POR QUÉ EL DESTINO SE GUARDA COMO CRITERIO
   Guardar los 500 correos de cada envío duplica el padrón en
   cada fila y lo deja congelado: si alguien cambia de correo,
   el historial miente. Se guarda el criterio («curso 12»,
   «tanda 3», «riesgo») + cuántos eran. Alcanza para saber qué
   se hizo y no se pudre.

   PROGRAMADO SIN CRON
   El plan gratuito no tiene tareas nocturnas. «Programado» es
   un estado guardado: el panel enseña lo pendiente y quien lo
   programó lo envía con un clic cuando llega la fecha. No es
   envío automático y no se presenta como tal.
   ============================================================ */

/** Etiqueta legible del criterio de destino, para el historial. */
export function etiquetaDestino(comunicado) {
  const d = comunicado?.destino || 'todos'
  const extra = comunicado?.destino_detalle || {}
  if (d === 'curso' && extra.curso_titulo) return `Curso: ${extra.curso_titulo}`
  if (d === 'curso' && extra.curso_id) return `Curso ${extra.curso_id}`
  if (d === 'tanda' && extra.tanda) return `Tanda ${extra.tanda}`
  if (d === 'manual') return 'Lista manual'
  if (d === 'riesgo') return 'En riesgo (+15 días)'
  if (d === 'activos') return 'Activos (14 días)'
  if (d === 'completaron') return 'Completaron curso'
  return 'Todos con acceso'
}

/** Arma la fila de historial desde lo que ya sabe el editor. */
export function filaHistorial({ organizacionId, canal, asunto, cuerpo, destino, detalle, total, estado, programadoPara, email }) {
  return {
    organizacion_id: organizacionId,
    canal: canal || 'correo',
    asunto: (asunto || '').trim(),
    cuerpo: cuerpo || '',
    destino: destino || 'todos',
    destino_detalle: detalle || {},
    estado: estado || 'enviado',
    programado_para: programadoPara || null,
    enviado_en: estado === 'enviado' ? new Date().toISOString() : null,
    total: Number(total) || 0,
    creador_email: email || null,
  }
}

/** Los programados cuya fecha ya llegó, ordenados por fecha. */
export function programadosVencidos(filas, hoy = new Date()) {
  const h = new Date(hoy).getTime()
  return (filas || [])
    .filter((f) => f?.estado === 'programado' && f?.programado_para
      && new Date(f.programado_para).getTime() <= h)
    .sort((a, b) => new Date(a.programado_para) - new Date(b.programado_para))
}
