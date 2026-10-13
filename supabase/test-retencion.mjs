/**
 * Pruebas de la lógica de retención (F5-2).
 *
 * Aquí se decide a quién llamar esta semana. Equivocarse no
 * rompe una pantalla: deja ir a quien se iba a quedar, o hace
 * llamar a quien estaba bien.
 *
 * Son funciones puras —entra una fila, sale un nivel— así que se
 * prueban sin base ni navegador. Las fechas se construyen
 * relativas a hoy para que no caduquen.
 *
 * Uso: node supabase/test-retencion.mjs
 */
const {
  diasDesde, nivelRiesgo, soloAlertas, resumirRiesgo,
} = await import('../src/lib/retencion.js')

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

/** Una fecha hace N días, en ISO. */
function haceDias(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

console.log('\n=== DÍAS DESDE ===')
check('hoy son 0 días', diasDesde(new Date().toISOString()) === 0)
check('ayer es 1 día', diasDesde(haceDias(1)) === 1)
check('sin fecha devuelve null', diasDesde(null) === null)
check('fecha inválida devuelve null', diasDesde('no-fecha') === null)

console.log('\n=== NIVEL DE RIESGO ===')
check('21 días = alto',
  nivelRiesgo({ dias_inactivo: 21, avance_medio: 80 }) === 'alto')
check('14 días con avance bajo = alto (se va sin avisar)',
  nivelRiesgo({ dias_inactivo: 14, avance_medio: 10 }) === 'alto')
check('14 días con buen avance = medio',
  nivelRiesgo({ dias_inactivo: 14, avance_medio: 80 }) === 'medio')
check('7 días con avance bajo = medio',
  nivelRiesgo({ dias_inactivo: 7, avance_medio: 5 }) === 'medio')
check('7 días con buen avance = bajo',
  nivelRiesgo({ dias_inactivo: 7, avance_medio: 80 }) === 'bajo')
check('ayer = bajo',
  nivelRiesgo({ dias_inactivo: 1, avance_medio: 50 }) === 'bajo')
check('nunca entró = sin_dato, NO alto (no es ruido)',
  nivelRiesgo({ dias_inactivo: null, ultimo_acceso: null }) === 'sin_dato')
check('se calcula desde ultimo_acceso si no viene dias',
  nivelRiesgo({ ultimo_acceso: haceDias(30), avance_medio: 50 }) === 'alto')
check('dias_inactivo manda sobre ultimo_acceso',
  nivelRiesgo({ dias_inactivo: 2, ultimo_acceso: haceDias(30) }) === 'bajo')

console.log('\n=== SOLO ALERTAS (lista corta, ordenada) ===')
{
  const filas = [
    { nombre: 'al-día', dias_inactivo: 1, avance_medio: 80 },
    { nombre: 'medio', dias_inactivo: 15, avance_medio: 80 },
    { nombre: 'alto', dias_inactivo: 30, avance_medio: 80 },
    { nombre: 'sin-dato', dias_inactivo: null, ultimo_acceso: null },
  ]
  const lista = soloAlertas(filas)
  check('solo alto y medio (2 de 4)',
    lista.length === 2, lista.map((f) => f.nombre).join())
  check('primero el alto',
    lista[0]?.nombre === 'alto', lista[0]?.nombre)
  check('cada fila trae su riesgo',
    lista.every((f) => f.riesgo === 'alto' || f.riesgo === 'medio'))
  check('lista nula no truena', soloAlertas(null).length === 0)
}

console.log('\n=== RESUMEN ===')
{
  const r = resumirRiesgo([
    { dias_inactivo: 30 }, { dias_inactivo: 15 },
    { dias_inactivo: 1 }, { dias_inactivo: null, ultimo_acceso: null },
  ])
  check('cuenta alto', r.alto === 1, JSON.stringify(r))
  check('cuenta medio', r.medio === 1, JSON.stringify(r))
  check('cuenta bajo', r.bajo === 1, JSON.stringify(r))
  check('cuenta sin_dato', r.sin_dato === 1, JSON.stringify(r))
  check('cuenta total', r.total === 4, JSON.stringify(r))
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
