/**
 * Pruebas de la lógica de suscripciones.
 *
 * Aquí se decide si un cliente está al corriente, cuánto le queda de
 * cada tope y cuánto suma al ingreso mensual. Equivocarse no rompe una
 * pantalla: cobra de menos, cobra dos veces o deja inscribir de más.
 *
 * Son funciones puras —entra un objeto, sale un dato— así que se
 * prueban sin base de datos ni navegador. Las fechas se construyen
 * relativas a hoy para que las pruebas no caduquen en enero.
 *
 * Uso: node supabase/test-suscripciones.mjs
 */
const {
  situacion, requiereAtencion, limites, nivelUso,
  precioVigente, ingresoMensual, diasPara, fechaCorta, pesos, GRACIA_DIAS,
} = await import('../src/lib/suscripcion.js')

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

/** Una fecha a N días de hoy, en el formato 'YYYY-MM-DD' que da Postgres. */
function enDias(n) {
  const h = new Date()
  const d = new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()) + n * 86400000)
  return d.toISOString().slice(0, 10)
}

const org = (extra) => ({
  plan_id: 1, estado_suscripcion: 'activa', periodo: 'mensual',
  exenta_de_limites: false, vence_en: null, precio_acordado: null,
  max_alumnos: null, max_cursos: null, max_facilitadores: null, ...extra,
})

const PLAN = {
  id: 1, max_alumnos: 150, max_cursos: 25, max_facilitadores: 10,
  precio_mensual: 4500, precio_anual: 45000,
}

console.log('\n=== CUENTA DE DÍAS (el error clásico es el huso horario) ===')
check('hoy son 0 días', diasPara(enDias(0)) === 0, String(diasPara(enDias(0))))
check('mañana es 1 día', diasPara(enDias(1)) === 1, String(diasPara(enDias(1))))
check('ayer es -1 día', diasPara(enDias(-1)) === -1, String(diasPara(enDias(-1))))
check('30 días adelante', diasPara(enDias(30)) === 30, String(diasPara(enDias(30))))
check('sin fecha devuelve null', diasPara(null) === null)
check('acepta un timestamp completo', diasPara(enDias(5) + 'T23:59:00Z') === 5)

console.log('\n=== SITUACIÓN DE LA SUSCRIPCIÓN ===')
check('al corriente y con margen = activa',
  situacion(org({ vence_en: enDias(60) })).clave === 'activa')
check('vence pronto avisa',
  situacion(org({ vence_en: enDias(5) })).clave === 'por_vencer')
check('vencido ayer sigue en gracia',
  situacion(org({ vence_en: enDias(-1) })).clave === 'gracia')
check('el último día de gracia sigue en gracia',
  situacion(org({ vence_en: enDias(-GRACIA_DIAS) })).clave === 'gracia')
check('pasada la gracia ya es vencida',
  situacion(org({ vence_en: enDias(-GRACIA_DIAS - 1) })).clave === 'vencida')
check('vencida pinta en rojo',
  situacion(org({ vence_en: enDias(-90) })).tono === 'alerta')
check('suspendida manda sobre la fecha',
  situacion(org({ estado_suscripcion: 'suspendida', vence_en: enDias(300) })).clave === 'suspendida')
check('la casa va antes que todo',
  situacion(org({ exenta_de_limites: true, vence_en: enDias(-900) })).clave === 'exenta')
check('sin plan se señala',
  situacion(org({ plan_id: null })).clave === 'sin_plan')
check('prueba vigente',
  situacion(org({ estado_suscripcion: 'prueba', vence_en: enDias(7) })).clave === 'prueba')
check('prueba terminada alarma',
  situacion(org({ estado_suscripcion: 'prueba', vence_en: enDias(-1) })).tono === 'alerta')
check('activa sin fecha no inventa un vencimiento',
  situacion(org({ vence_en: null })).clave === 'activa')
check('una organización inexistente no truena',
  situacion(null).clave === 'neutro')

console.log('\n=== A QUIÉN HAY QUE ATENDER ===')
check('vencida, sí', requiereAtencion('vencida') === true)
check('en gracia, sí', requiereAtencion('gracia') === true)
check('sin plan, sí', requiereAtencion('sin_plan') === true)
check('activa, no', requiereAtencion('activa') === false)
check('la casa, no', requiereAtencion('exenta') === false)

console.log('\n=== TOPES: EXCEPCIÓN → PLAN → SIN LÍMITE ===')
check('hereda el tope del plan', limites(org(), PLAN).alumnos === 150)
check('la excepción manda', limites(org({ max_alumnos: 200 }), PLAN).alumnos === 200)
check('una excepción de 0 se respeta, no se confunde con vacío',
  limites(org({ max_cursos: 0 }), PLAN).cursos === 0)
check('sin plan, sin tope', limites(org({ plan_id: null }), null).alumnos === null)
check('sin plan marca exenta', limites(org({ plan_id: null }), null).exenta === true)
check('la casa marca exenta', limites(org({ exenta_de_limites: true }), PLAN).exenta === true)
check('plan sin tope en un campo deja ese campo libre',
  limites(org(), { ...PLAN, max_cursos: null }).cursos === null)

console.log('\n=== NIVEL DE USO (para pintar, no para bloquear) ===')
check('holgado', nivelUso(10, 150) === 'ok')
check('85% ya es alto', nivelUso(128, 150) === 'alto')
check('al tope es lleno', nivelUso(150, 150) === 'lleno')
check('por encima del tope sigue siendo lleno', nivelUso(170, 150) === 'lleno')
check('sin tope no es lleno aunque haya muchos', nivelUso(9000, null) === 'libre')

console.log('\n=== PRECIO VIGENTE ===')
check('toma el mensual del plan', precioVigente(org(), PLAN) === 4500)
check('toma el anual si el periodo es anual',
  precioVigente(org({ periodo: 'anual' }), PLAN) === 45000)
check('lo negociado manda sobre la lista',
  precioVigente(org({ precio_acordado: 3200 }), PLAN) === 3200)
check('un precio negociado de 0 (cortesía) no cae a la lista',
  precioVigente(org({ precio_acordado: 0 }), PLAN) === 0)
check('sin plan y sin acuerdo no inventa precio',
  precioVigente(org({ plan_id: null }), null) === null)

console.log('\n=== INGRESO MENSUAL RECURRENTE ===')
const porId = { 1: PLAN }
check('suma a los activos',
  ingresoMensual([org({ vence_en: enDias(30) }), org({ vence_en: enDias(60) })], porId) === 9000)
check('el anual se divide entre doce, no se suma entero',
  ingresoMensual([org({ periodo: 'anual', vence_en: enDias(100) })], porId) === 3750)
check('no suma a la casa',
  ingresoMensual([org({ exenta_de_limites: true, vence_en: enDias(30) })], porId) === 0)
check('no suma a quien está vencido de verdad',
  ingresoMensual([org({ vence_en: enDias(-90) })], porId) === 0)
check('sí suma a quien está en gracia: ese dinero se espera',
  ingresoMensual([org({ vence_en: enDias(-2) })], porId) === 4500)
check('no suma a los suspendidos',
  ingresoMensual([org({ estado_suscripcion: 'suspendida', vence_en: enDias(30) })], porId) === 0)
check('no suma a los que están en prueba',
  ingresoMensual([org({ estado_suscripcion: 'prueba', vence_en: enDias(10) })], porId) === 0)
check('respeta el precio negociado',
  ingresoMensual([org({ precio_acordado: 2000, vence_en: enDias(30) })], porId) === 2000)
check('una cartera vacía da cero', ingresoMensual([], porId) === 0)
check('una cartera nula no truena', ingresoMensual(null, porId) === 0)

console.log('\n=== FORMATO ===')
check('fecha en formato mexicano', fechaCorta('2026-03-09') === '09/03/2026')
check('fecha vacía no dice "Invalid Date"', fechaCorta(null) === '—')
check('importe sin monto no dice NaN', pesos(null) === '—')
check('importe lleva signo de pesos', pesos(4500).includes('4,500'))
check('cero es un importe válido, no un vacío', pesos(0) !== '—')

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
