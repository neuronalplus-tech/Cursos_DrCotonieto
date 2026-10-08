/**
 * Pruebas del juego servido (aleatorización por alumno).
 *
 * Lo que se prueba aquí NO necesita base de datos: limpiarPregunta,
 * esCorrectaServidor y calificarJuego son el espejo en JS de lo que
 * hacen limpiar_pregunta, es_correcta_examen y entregar_examen en
 * supabase/EXAMENES_ALEATORIOS.sql. Si un día discrepan, la queja
 * será "a mí me puso mal la nota" y no habrá forma de defender
 * ninguna de las dos versiones. De ahí que cada rama del SQL tenga
 * su caso aquí.
 *
 * Uso: node supabase/test-aleatorios.mjs
 */
const {
  limpiarPregunta, esCorrectaServidor, calificarJuego,
} = await import('../src/lib/banco.js')

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

const opcion = (texto, correcta = 0) => ({
  id: 'p1', tipo: 'opcion', pregunta: texto,
  opciones: ['a', 'b', 'c'].map((t, i) => ({ texto: t, correcta: i === correcta })),
})

console.log('\n=== LIMPIAR: EL ALUMNO NUNCA VE LA RESPUESTA ===')
{
  const limpia = limpiarPregunta(opcion('¿Cuál?', 1))
  check('quita la marca de correcta',
    limpia.opciones.every(o => !('correcta' in o)),
    JSON.stringify(limpia.opciones))
  check('conserva textos e id',
    limpia.opciones[1].texto === 'b' && limpia.id === 'p1')
}
{
  const corta = { id: 'c1', tipo: 'corta', pregunta: 'Siglas', respuesta: 'TEPT' }
  const limpia = limpiarPregunta(corta)
  check('la corta sale sin respuesta', !('respuesta' in limpia))
}
{
  const emp = {
    id: 'e1', tipo: 'emparejar', pregunta: 'Relaciona',
    pares: [
      { id: 'e1_1', premisa: 'ACT', respuesta: 'Aceptar' },
      { id: 'e1_2', premisa: 'DBT', respuesta: 'Regular' },
    ],
  }
  const limpia = limpiarPregunta(emp)
  check('los pares salen sin respuesta',
    limpia.pares.every(x => !('respuesta' in x)))
  check('pero con las posibles para el selector',
    (limpia.respuestas_posibles || []).join(',') === 'Aceptar,Regular')
  check('conserva premisas', limpia.pares[0].premisa === 'ACT')
}
{
  check('nula no truena', limpiarPregunta(null) === null)
}

console.log('\n=== CORRECCIÓN: CADA RAMA DEL SQL ===')
{
  const p = opcion('¿Cuál?', 2)
  check('opcion acierta', esCorrectaServidor(p, 2) === true)
  check('opcion falla', esCorrectaServidor(p, 0) === false)
  check('opcion acepta texto numérico', esCorrectaServidor(p, '2') === true)
  check('opcion rechaza texto libre', esCorrectaServidor(p, 'b') === false)
  check('opcion rechaza índice fuera de rango', esCorrectaServidor(p, 9) === false)
  check('opcion rechaza nulo', esCorrectaServidor(p, null) === false)
  check('opcion rechaza objeto', esCorrectaServidor(p, {}) === false)
}
{
  const vf = {
    id: 'v1', tipo: 'vf', pregunta: 'Afirmación',
    opciones: [{ texto: 'Verdadero', correcta: false }, { texto: 'Falso', correcta: true }],
  }
  check('vf acierta', esCorrectaServidor(vf, 1) === true)
  check('vf falla', esCorrectaServidor(vf, 0) === false)
}
{
  const corta = { id: 'c1', tipo: 'corta', pregunta: 'Siglas', respuesta: 'TEPT|trastorno de estrés postraumático' }
  check('corta exacta', esCorrectaServidor(corta, 'TEPT') === true)
  check('corta ignora mayúsculas', esCorrectaServidor(corta, 'tept') === true)
  check('corta acepta variante con |', esCorrectaServidor(corta, 'trastorno de estrés postraumático') === true)
  const corta2 = { id: 'c2', tipo: 'corta', pregunta: 'X', respuesta: 'A;B' }
  check('corta acepta variante con ;', esCorrectaServidor(corta2, 'b') === true)
  check('corta rechaza otra cosa', esCorrectaServidor(corta, 'no existe') === false)
  check('corta rechaza vacío', esCorrectaServidor(corta, '  ') === false)
  check('corta sin esperada nunca acierta',
    esCorrectaServidor({ id: 'c3', tipo: 'corta', pregunta: 'X', respuesta: '' }, 'lo que sea') === false)
}
{
  const emp = {
    id: 'e1', tipo: 'emparejar', pregunta: 'Relaciona',
    pares: [
      { id: 'e1_1', premisa: 'ACT', respuesta: 'Aceptar' },
      { id: 'e1_2', premisa: 'DBT', respuesta: 'Regular' },
    ],
  }
  check('emparejar acierta',
    esCorrectaServidor(emp, { e1_1: 'Aceptar', e1_2: 'Regular' }) === true)
  check('emparejar falla si uno está mal',
    esCorrectaServidor(emp, { e1_1: 'Aceptar', e1_2: 'Mal' }) === false)
  check('emparejar rechaza no-objeto', esCorrectaServidor(emp, 'Aceptar') === false)
  check('emparejar sin pares nunca acierta',
    esCorrectaServidor({ id: 'e9', tipo: 'emparejar', pregunta: 'X', pares: [] }, {}) === false)
}
{
  check('tipo desconocido no acierta',
    esCorrectaServidor({ id: 'x', tipo: 'raro', pregunta: 'X' }, 'lo que sea') === false)
  const vieja = { id: 'x1', pregunta: 'Vieja', opciones: [{ texto: 'A', correcta: true }, { texto: 'B', correcta: false }] }
  check('pregunta vieja sin tipo sigue siendo opcion', esCorrectaServidor(vieja, 0) === true)
}

console.log('\n=== CALIFICAR EL JUEGO, NO EL EXAMEN ===')
{
  const juego = [opcion('uno', 0), opcion('dos', 1)]
  juego[0].id = 'p1'; juego[1].id = 'p2'
  const r = calificarJuego(juego, { p1: 0, p2: 1 }, 70)
  check('todo bien = 100 y aprobado',
    r.calificacion === 100 && r.aprobado === true && r.correctas === 2 && r.total === 2)
  const r2 = calificarJuego(juego, { p1: 0, p2: 0 }, 70)
  check('mitad = 50 y no aprobado con umbral 70',
    r2.calificacion === 50 && r2.aprobado === false)
  check('juego vacío = 0 sin tronar',
    calificarJuego([], {}, 70).calificacion === 0)
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
