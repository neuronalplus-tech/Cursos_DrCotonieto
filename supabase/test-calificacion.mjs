/**
 * Pruebas de la calificación final.
 *
 * Este número va en una constancia. Si está mal, está mal en un
 * documento con folio verificable que alguien va a enseñar en una
 * entrevista de trabajo. Por eso se prueba más a fondo que el resto.
 *
 * Uso: node supabase/test-calificacion.mjs
 */
const {
  calcular, aBase100, tienePonderacion, revisarPonderacion,
  PONDERACION_SUGERIDA,
} = await import('../src/lib/calificacion.js')

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

const n = (valor, maximo) => ({ valor, maximo })

console.log('\n=== NORMALIZAR A BASE 100 ===')
check('un 8 sobre 10 es 80', aBase100(8, 10) === 80)
check('un 80 sobre 100 es 80', aBase100(80, 100) === 80)
check('sin máximo se asume 100', aBase100(80) === 80)
check('un máximo de 0 no divide entre cero', aBase100(5, 0) === 5)
check('nulo no inventa un cero', aBase100(null, 10) === null)
check('cadena vacía tampoco', aBase100('', 10) === null)
check('un cero real sí cuenta', aBase100(0, 10) === 0)
check('texto no numérico se descarta', aBase100('ocho', 10) === null)

console.log('\n=== SIN PONDERACIÓN (el comportamiento de siempre) ===')
{
  const r = calcular({ examenes: [n(8, 10)], tareas: [n(90, 100)] }, null)
  check('promedia normalizado, no crudo', r.valor === 85, String(r.valor))
  check('se marca como no ponderada', r.ponderada === false)
  check('dice de cuántas notas sale', r.de === 2)
}
check('sin nada calificado devuelve null',
  calcular({ examenes: [], tareas: [], foro: [] }, null) === null)
check('entradas vacías no truenan', calcular({}, null) === null)
check('entradas nulas no truenan', calcular(null, null) === null)
{
  const r = calcular({ examenes: [n(10, 10), n(5, 10)], tareas: [n(100, 100)] }, null)
  check('promedia TODAS las notas, no las medias por componente',
    r.valor === 83.3, String(r.valor))
}
{
  // La regla que más importa a mitad de curso.
  const r = calcular({ examenes: [n(9, 10)], tareas: [] }, null)
  check('lo no entregado no cuenta como cero', r.valor === 90, String(r.valor))
}

console.log('\n=== PONDERADA ===')
const P = { examenes: 40, tareas: 40, foro: 20 }
{
  const config = {
    version: 2, escala: 10, minima10: 7,
    grupos: [{
      id: 'modulo:1', moduloId: 1, peso: 100, modo: 'rubrica',
      criterios: [{ id: 'tareas', peso: 100, fuente: 'tipos', tipos: ['tareas'], distribucion: 'igual' }],
    }],
  }
  const parcial = calcular({ tareas: [
    { id: 1, moduloId: 1, valor: 66, maximo: 100 },
    { id: 2, moduloId: 1, valor: null, maximo: 100 },
  ] }, config)
  check('una tarea de dos aporta 3.3/10 y conserva el 50% pendiente',
    parcial.equivalente10 === 3.3 && parcial.pesoEvaluado === 50 && parcial.aprobado === false,
    `${parcial.equivalente10}/10 · ${parcial.pesoEvaluado}% evaluado`)
  const completa = calcular({ tareas: [
    { id: 1, moduloId: 1, valor: 66, maximo: 100 },
    { id: 2, moduloId: 1, valor: 100, maximo: 100 },
  ], examenes: [
    { id: 3, moduloId: 1, valor: null, maximo: 100 },
  ] }, config)
  check('66 y 100 en dos tareas iguales dan 8.3/10',
    completa.equivalente10 === 8.3 && completa.aprobado === true,
    `${completa.equivalente10}/10`)
  check('un examen con peso cero no bloquea la aprobación', completa.pesoEvaluado === 100)
  const superaMinimoConPendiente = calcular({ tareas: [
    { id: 1, moduloId: 1, valor: 100, maximo: 100 },
    { id: 2, moduloId: 1, valor: 100, maximo: 100 },
    { id: 3, moduloId: 1, valor: 100, maximo: 100 },
    { id: 4, moduloId: 1, valor: null, maximo: 100 },
  ] }, config)
  check('alcanza el mínimo aunque quede una actividad ponderada pendiente',
    superaMinimoConPendiente.equivalente10 === 7.5 && superaMinimoConPendiente.aprobado === true)
}
{
  const r = calcular({
    examenes: [n(100, 100)], tareas: [n(50, 100)], foro: [n(10, 10)],
  }, P)
  check('aplica los pesos', r.valor === 80, String(r.valor))  // 40+20+20
  check('se marca como ponderada', r.ponderada === true)
  check('explica solo los componentes configurados', r.detalle.length === 3)
  check('el detalle trae la media del componente',
    r.detalle.find(d => d.clave === 'tareas').media === 50)
}
{
  const r = calcular({ examenes: [n(90, 100), n(70, 100)], tareas: [n(100, 100)] },
    { examenes: 50, tareas: 50 })
  check('promedia DENTRO del componente antes de pesar',
    r.valor === 90, String(r.valor))  // (80*.5)+(100*.5)
}
{
  // El total se calcula sobre el curso completo; lo pendiente conserva su peso.
  const r = calcular({ examenes: [n(80, 100)] }, P)
  check('muestra el desempeño de lo calificado', r.valor === 80, String(r.valor))
  check('conserva el peso pendiente en la nota acumulada',
    r.equivalente10 === 3.2 && r.pesoEvaluado === 40,
    `${r.equivalente10}/10 con ${r.pesoEvaluado}% evaluado`)
}
{
  const r = calcular({ examenes: [n(80, 100)], foro: [n(10, 10)] }, P)
  check('con dos de tres componentes se reparte proporcional',
    r.valor === 86.7, String(r.valor))  // 80*(40/60) + 100*(20/60)
}
{
  const r = calcular({ examenes: [n(100, 100)], tareas: [n(0, 100)] }, P)
  check('un cero calificado SÍ baja la nota', r.valor === 50, String(r.valor))
}
{
  // Pesos que no suman 100: se renormalizan.
  const a = calcular({ examenes: [n(100, 100)], tareas: [n(0, 100)] }, { examenes: 1, tareas: 1 })
  const b = calcular({ examenes: [n(100, 100)], tareas: [n(0, 100)] }, { examenes: 50, tareas: 50 })
  check('1:1 da lo mismo que 50:50', a.valor === b.valor && a.valor === 50)
}
{
  const r = calcular({ examenes: [n(90, 100)] }, { examenes: 0, tareas: 100 })
  check('una actividad con peso cero no entra a la nota', r === null)
}

console.log('\n=== AVANCE DEL MATERIAL ===')
{
  const entradas = { examenes: [n(100, 100)], avance: { hechos: 5, total: 10 } }
  const sin = calcular(entradas, null)
  check('sin peso, el avance NO entra en el promedio simple',
    sin.valor === 100, String(sin.valor))
  const con = calcular(entradas, { examenes: 50, avance: 50 })
  check('con peso, sí entra', con.valor === 75, String(con.valor))
  const cero = calcular(entradas, { examenes: 100, avance: 0 })
  check('con peso 0 no entra', cero.valor === 100, String(cero.valor))
}
check('un curso sin recursos no divide entre cero',
  calcular({ examenes: [n(80, 100)], avance: { hechos: 0, total: 0 } },
    { examenes: 50, avance: 50 }).valor === 80)

console.log('\n=== APROBADO ===')
{
  const r = calcular({ examenes: [n(70, 100)] }, { examenes: 100, minima: 70 })
  check('justo en el mínimo aprueba', r.aprobado === true)
  const r2 = calcular({ examenes: [n(69, 100)] }, { examenes: 100, minima: 70 })
  check('un punto abajo no', r2.aprobado === false)
  const r3 = calcular({ examenes: [n(50, 100)] }, { examenes: 100 })
  check('usa 7/10 si no se configuró otro mínimo', r3.minima === 7 && r3.aprobado === false)
  const r4 = calcular({ examenes: [n(75, 100)] }, { minima: 80 })
  check('respeta el mínimo aunque use promedio simple', r4.minima === 8 && r4.aprobado === false)
}

console.log('\n=== ¿HAY PONDERACIÓN? ===')
check('null no es ponderación', tienePonderacion(null) === false)
check('objeto vacío tampoco', tienePonderacion({}) === false)
check('todo en cero tampoco', tienePonderacion({ examenes: 0, tareas: 0 }) === false)
check('solo el mínimo no es ponderación', tienePonderacion({ minima: 70 }) === false)
check('un peso mayor que cero sí', tienePonderacion({ examenes: 100 }) === true)
check('la sugerida es una ponderación válida', tienePonderacion(PONDERACION_SUGERIDA) === true)

console.log('\n=== AVISO DE PESOS ===')
check('sumando 100 no avisa', revisarPonderacion({ examenes: 40, tareas: 40, foro: 20 }) === null)
check('sumando distinto avisa', /no 100/.test(revisarPonderacion({ examenes: 30, tareas: 30 }) || ''))
check('sin ponderación no avisa', revisarPonderacion(null) === null)
check('la sugerida suma 100', revisarPonderacion(PONDERACION_SUGERIDA) === null)

console.log('\n=== EL MISMO CASO DESDE LAS DOS PANTALLAS ===')
{
  // Mismas entradas que armarían el alumno y el facilitador: el
  // número tiene que ser idéntico, que es la razón de ser del módulo.
  const entradas = {
    examenes: [n(8.5, 10)], tareas: [n(92, 100)], foro: [n(9, 10)],
    avance: { hechos: 8, total: 10 },
  }
  const a = calcular(entradas, P)
  const b = calcular(JSON.parse(JSON.stringify(entradas)), { ...P })
  check('dos llamadas con los mismos datos dan lo mismo', a.valor === b.valor)
  check('y el valor es el esperado', a.valor === 88.8, String(a.valor))  // 85*.4 + 92*.4 + 90*.2
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
