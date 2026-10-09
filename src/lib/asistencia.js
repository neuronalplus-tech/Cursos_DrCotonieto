/* ============================================================
   ASISTENCIA
   ------------------------------------------------------------
   Reglas de conteo y presentación. Las mismas que aplica
   `asistencia_de_generacion()` en la base, porque el porcentaje lo
   piden tres sitios —el pase de lista, el informe y el acta— y tres
   implementaciones acaban dando tres números.

   LAS DOS REGLAS QUE HAY QUE CONOCER
   · Una sesión cancelada no cuenta para nadie: no hubo clase.
   · Un retardo cuenta como asistencia. Si no, el porcentaje castiga
     igual a quien llegó diez minutos tarde que a quien no fue, y
     entonces deja de servir para decidir nada.
   ============================================================ */

export const ESTADOS = [
  ['presente', 'Presente', '✓'],
  ['retardo', 'Retardo', '⏱'],
  ['ausente', 'Ausente', '✕'],
  ['permiso', 'Permiso', '◐'],
]

export const ETIQUETA_ESTADO = Object.fromEntries(ESTADOS.map(([k, t]) => [k, t]))

/** Los que cuentan como haber asistido. */
const CUENTAN = new Set(['presente', 'retardo'])

export const MODALIDADES = [
  ['linea', 'En línea'],
  ['presencial', 'Presencial'],
  ['mixta', 'Mixta'],
]

/** ¿Este grupo pasa lista? Un grupo en línea sin sesiones, no. */
export const llevaAsistencia = (modalidad) =>
  modalidad === 'presencial' || modalidad === 'mixta'

/**
 * Resumen de una persona a partir de sus marcas.
 *
 * @param marcas  [{estado, justificada}]
 * @param totalSesiones  sesiones NO canceladas del grupo
 */
export function resumen(marcas, totalSesiones) {
  const m = marcas || []
  const cuenta = (e) => m.filter(x => x.estado === e).length
  const asistidas = m.filter(x => CUENTAN.has(x.estado)).length
  return {
    sesiones: totalSesiones || 0,
    presentes: cuenta('presente'),
    retardos: cuenta('retardo'),
    ausencias: cuenta('ausente'),
    permisos: cuenta('permiso'),
    justificadas: m.filter(x => x.justificada).length,
    // Sin sesiones no hay porcentaje. Devolver 0 diría «faltó a
    // todo», que es lo contrario de «todavía no hay clases».
    porcentaje: totalSesiones
      ? Math.round((asistidas / totalSesiones) * 1000) / 10
      : null,
    // Lo que no se ha registrado no es una falta: es que no se pasó
    // lista ese día. Distinguirlo evita acusar a alguien por un
    // descuido del docente.
    sinRegistro: Math.max(0, (totalSesiones || 0) - m.length),
  }
}

/** Para pintar: por debajo de 80 suele ser el límite para acreditar. */
export const MINIMO_SUGERIDO = 80

export function tonoAsistencia(porcentaje, minimo = MINIMO_SUGERIDO) {
  if (porcentaje == null) return 'neutro'
  if (porcentaje >= minimo) return 'ok'
  if (porcentaje >= minimo - 10) return 'aviso'
  return 'alerta'
}

/** La fecha de una sesión, corta y legible. */
export function fechaSesion(fecha) {
  if (!fecha) return ''
  const [a, m, d] = String(fecha).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

/** La hora, sin los segundos que guarda Postgres. */
export const horaCorta = (h) => (h ? String(h).slice(0, 5) : '')

/**
 * Ordena a quien hay que mirar primero: los de menor asistencia.
 * Sirve igual para el informe y para la pantalla de seguimiento.
 */
export function porRiesgo(filas) {
  return [...(filas || [])].sort((a, b) => {
    const pa = a.porcentaje == null ? 101 : a.porcentaje
    const pb = b.porcentaje == null ? 101 : b.porcentaje
    return pa - pb
  })
}
