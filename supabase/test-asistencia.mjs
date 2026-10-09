/**
 * Pruebas del conteo de asistencia.
 *
 * Este número decide si alguien acredita o no. Equivocarlo por una
 * sesión cancelada o por contar mal un retardo le cuesta el módulo a
 * una persona que sí fue, y eso se descubre tarde y se discute peor.
 *
 * Uso: node supabase/test-asistencia.mjs
 */
const {
  resumen, tonoAsistencia, llevaAsistencia, porRiesgo,
  fechaSesion, horaCorta, MINIMO_SUGERIDO, ESTADOS,
} = await import('../src/lib/asistencia.js')

let ok = 0
const fallos = []

function check(nombre, condicion, detalle = '') {
  if (condicion) {
    ok++
    console.log(`  OK   ${nombre}`)
  } else {
    fallos.push(`${nombre}${detalle ? ' → ' + detalle : ''}`)
    console.log(`  FALLA ${nombre}${detalle ? ' → ' + detalle : ''}`)
  }
}

const marca = (estado, justificada = false) => ({ estado, justificada })

console.log('\n=== EL PORCENTAJE ===')
{
  const r = resumen([marca('presente'), marca('presente'), marca('ausente')], 4)
  check('cuenta sobre las sesiones del grupo, no sobre las marcadas',
    r.porcentaje === 50, String(r.porcentaje))
  check('lo no registrado no es una falta', r.sinRegistro === 1, String(r.sinRegistro))
  check('cuenta las ausencias', r.ausencias === 1)
}
{
  // La regla que más se discute.
  const r = resumen([marca('retardo'), marca('retardo')], 2)
  check('un retardo cuenta como asistencia', r.porcentaje === 100, String(r.porcentaje))
  check('pero se registra aparte', r.retardos === 2)
}
{
  const r = resumen([marca('permiso'), marca('presente')], 2)
  check('un permiso NO cuenta como asistencia', r.porcentaje === 50, String(r.porcentaje))
}
{
  const r = resumen([marca('ausente', true), marca('presente')], 2)
  check('una falta justificada sigue siendo falta para el conteo',
    r.porcentaje === 50, String(r.porcentaje))
  check('y se cuenta aparte como justificada', r.justificadas === 1)
}

console.log('\n=== CASOS QUE SE DESCUIDAN ===')
{
  const r = resumen([], 0)
  check('sin sesiones NO devuelve 0: devuelve nada',
    r.porcentaje === null, String(r.porcentaje))
}
{
  const r = resumen([], 5)
  check('con sesiones y sin marcas, el porcentaje es 0', r.porcentaje === 0)
  check('y las cinco quedan sin registro', r.sinRegistro === 5)
}
check('marcas nulas no truenan', resumen(null, 3).porcentaje === 0)
check('un total nulo no truena', resumen([marca('presente')], null).porcentaje === null)
{
  const r = resumen([marca('presente'), marca('presente'), marca('presente')], 3)
  check('asistencia perfecta da 100', r.porcentaje === 100)
}
{
  const r = resumen([marca('presente')], 3)
  check('redondea a un decimal', r.porcentaje === 33.3, String(r.porcentaje))
}

console.log('\n=== SEMÁFORO ===')
check(`${MINIMO_SUGERIDO}% está en verde`, tonoAsistencia(MINIMO_SUGERIDO) === 'ok')
check('justo debajo, en ámbar', tonoAsistencia(MINIMO_SUGERIDO - 1) === 'aviso')
check('muy por debajo, en rojo', tonoAsistencia(MINIMO_SUGERIDO - 20) === 'alerta')
check('sin dato, neutro', tonoAsistencia(null) === 'neutro')
check('el mínimo se puede cambiar por institución',
  tonoAsistencia(85, 90) === 'aviso')

console.log('\n=== MODALIDAD ===')
check('un grupo presencial pasa lista', llevaAsistencia('presencial') === true)
check('uno mixto también', llevaAsistencia('mixta') === true)
check('uno en línea no', llevaAsistencia('linea') === false)
check('sin modalidad, no', llevaAsistencia(undefined) === false)

console.log('\n=== A QUIÉN MIRAR PRIMERO ===')
{
  const r = porRiesgo([
    { id: 1, porcentaje: 90 },
    { id: 2, porcentaje: 40 },
    { id: 3, porcentaje: null },
    { id: 4, porcentaje: 70 },
  ])
  check('primero el de menor asistencia', r[0].id === 2)
  check('después el siguiente', r[1].id === 4)
  check('quien no tiene dato va al final, no al principio',
    r[r.length - 1].id === 3, String(r[r.length - 1].id))
  check('no modifica la lista original',
    porRiesgo([{ id: 9, porcentaje: 1 }]).length === 1)
  check('una lista nula no truena', porRiesgo(null).length === 0)
}

console.log('\n=== FORMATO ===')
{
  // Una fecha 'YYYY-MM-DD' leída como UTC: sin eso, en México sale
  // el día anterior.
  const t = fechaSesion('2026-06-15')
  check('la fecha no se corre un día', /15/.test(t), t)
  check('trae el día de la semana', /\w/.test(t))
}
check('una fecha vacía no truena', fechaSesion(null) === '')
check('la hora pierde los segundos', horaCorta('09:30:00') === '09:30')
check('una hora vacía da cadena vacía', horaCorta(null) === '')

console.log('\n=== LOS ESTADOS ===')
check('son cuatro', ESTADOS.length === 4)
check('todos traen clave, etiqueta y símbolo',
  ESTADOS.every(([k, t, s]) => k && t && s))
check('presente es el primero, que es el que más se pulsa',
  ESTADOS[0][0] === 'presente')

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
