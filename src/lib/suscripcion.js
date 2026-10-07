/* ============================================================
   SUSCRIPCIONES · lo que se calcula, no lo que se guarda
   ------------------------------------------------------------
   En la base se guardan cuatro estados que tú decides (prueba,
   activa, suspendida, cancelada) y una fecha de vencimiento. Todo
   lo demás —"vencida", "en gracia", "por vencer"— se deduce aquí
   al leer.

   POR QUÉ NO SE GUARDA "VENCIDA"
   Guardarla obligaría a una tarea que corra cada noche para ir
   cambiando estados. El día que esa tarea falle, un cliente
   vencido sigue apareciendo activo y dejas de cobrar sin enterarte.
   Deducirlo no puede fallar: la fecha es la fecha.

   LA GRACIA
   Diez días después del vencimiento el cliente sigue contando como
   al corriente. Una transferencia interbancaria en México tarda lo
   que tarda, y nadie quiere la llamada de "me cortaste el aula por
   dos días".
   ============================================================ */

export const GRACIA_DIAS = 10
export const AVISO_DIAS = 15

const DIA = 86400000

/* Las fechas vienen como 'YYYY-MM-DD'. `new Date(ese texto)` las
   interpreta a medianoche UTC, y restarle la hora local produce un
   día de más o de menos según el huso. Comparando ambas a
   medianoche UTC el resultado es el mismo en cualquier parte. */
function aMedianocheUTC(fechaISO) {
  const [a, m, d] = String(fechaISO).slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function hoyUTC() {
  const h = new Date()
  return Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())
}

/** Días que faltan para esa fecha. Negativo si ya pasó. */
export function diasPara(fechaISO) {
  if (!fechaISO) return null
  return Math.round((aMedianocheUTC(fechaISO) - hoyUTC()) / DIA)
}

/**
 * En qué situación está la suscripción de una organización.
 *
 * `tono` es para la pantalla: 'ok' verde, 'aviso' ámbar, 'alerta'
 * rojo, 'neutro' gris. Devolverlo desde aquí evita que cada
 * componente decida un color distinto para el mismo caso.
 */
export function situacion(org) {
  if (!org) return { clave: 'neutro', etiqueta: '—', tono: 'neutro', dias: null }

  const dias = diasPara(org.vence_en)

  if (org.exenta_de_limites) {
    return { clave: 'exenta', etiqueta: 'Casa (sin tope)', tono: 'neutro', dias }
  }
  if (org.estado_suscripcion === 'cancelada') {
    return { clave: 'cancelada', etiqueta: 'Cancelada', tono: 'neutro', dias }
  }
  if (org.estado_suscripcion === 'suspendida') {
    return { clave: 'suspendida', etiqueta: 'Suspendida', tono: 'alerta', dias }
  }
  if (!org.plan_id) {
    return { clave: 'sin_plan', etiqueta: 'Sin plan', tono: 'aviso', dias }
  }
  if (org.estado_suscripcion === 'prueba') {
    return {
      clave: 'prueba',
      etiqueta: dias == null ? 'En prueba'
        : dias < 0 ? 'Prueba terminada' : `Prueba · ${dias} d`,
      tono: dias != null && dias < 0 ? 'alerta' : 'aviso',
      dias,
    }
  }

  // Activa.
  if (dias == null) return { clave: 'activa', etiqueta: 'Activa', tono: 'ok', dias }
  if (dias < -GRACIA_DIAS) {
    return { clave: 'vencida', etiqueta: `Vencida hace ${Math.abs(dias)} d`, tono: 'alerta', dias }
  }
  if (dias < 0) {
    return { clave: 'gracia', etiqueta: `En gracia · ${GRACIA_DIAS + dias} d`, tono: 'aviso', dias }
  }
  if (dias <= AVISO_DIAS) {
    return { clave: 'por_vencer', etiqueta: `Vence en ${dias} d`, tono: 'aviso', dias }
  }
  return { clave: 'activa', etiqueta: 'Activa', tono: 'ok', dias }
}

/** ¿Debe la organización ver un aviso de cobro en su panel? */
export function requiereAtencion(clave) {
  return ['vencida', 'gracia', 'suspendida', 'por_vencer', 'sin_plan'].includes(clave)
}

/**
 * Topes que le aplican: excepción de la organización → plan → sin
 * tope. Misma cascada que `limites_organizacion()` en la base; si
 * algún día discrepan, manda la base, que es la que bloquea.
 */
export function limites(org, plan) {
  const cae = (a, b) => (a ?? null) !== null ? Number(a) : (b ?? null) !== null ? Number(b) : null
  return {
    alumnos: cae(org?.max_alumnos, plan?.max_alumnos),
    cursos: cae(org?.max_cursos, plan?.max_cursos),
    facilitadores: cae(org?.max_facilitadores, plan?.max_facilitadores),
    exenta: !!org?.exenta_de_limites || !org?.plan_id,
  }
}

/** Qué tan cerca del tope va: para pintar la barra, no para bloquear. */
export function nivelUso(usado, tope) {
  if (tope == null) return 'libre'
  if (usado >= tope) return 'lleno'
  if (usado / tope >= 0.85) return 'alto'
  return 'ok'
}

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
})

/** Importes en pesos, sin centavos: los contratos se hablan en redondo. */
export function pesos(n) {
  if (n == null || n === '') return '—'
  return MXN.format(Number(n))
}

/** Lo que te paga ESTE cliente: lo negociado, o la lista del plan. */
export function precioVigente(org, plan) {
  if (org?.precio_acordado != null) return Number(org.precio_acordado)
  if (!plan) return null
  return org?.periodo === 'anual' ? plan.precio_anual : plan.precio_mensual
}

/**
 * Ingreso mensual recurrente. El anual se divide entre doce para
 * poder sumarlo con el mensual: comparar un contrato anual con uno
 * mensual sin normalizar es la forma más fácil de creerte doce
 * veces más grande de lo que eres.
 */
export function ingresoMensual(orgs, planPorId) {
  let total = 0
  for (const o of orgs || []) {
    if (o.exenta_de_limites) continue
    const s = situacion(o)
    if (!['activa', 'por_vencer', 'gracia'].includes(s.clave)) continue
    const p = precioVigente(o, planPorId[o.plan_id])
    if (p == null) continue
    total += o.periodo === 'anual' ? p / 12 : p
  }
  return total
}

export function fechaCorta(fechaISO) {
  if (!fechaISO) return '—'
  const [a, m, d] = String(fechaISO).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}
