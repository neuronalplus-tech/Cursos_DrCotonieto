/**
 * Pruebas del banco de preguntas.
 *
 * Lo que más importa aquí son los IDENTIFICADORES. Las respuestas del
 * alumno se guardan como { id_de_pregunta: respuesta }, así que:
 *
 *   · dos preguntas del mismo examen con el mismo id hacen que la
 *     respuesta de una se lea como la de la otra al calificar;
 *   · y cambiarle el id a una pregunta ya aplicada deja huérfanos los
 *     intentos que ya estaban guardados.
 *
 * Las dos cosas producen calificaciones mal puestas sin que nada
 * parezca roto, que es la peor clase de error en una plataforma de
 * evaluación. De ahí el peso de esta primera sección.
 *
 * Uso: node supabase/test-banco.mjs
 */
const {
  agregarPreguntas, aPregunta, aFila, tomarAlAzar,
  filtrar, temasDe, paraBuscar,
} = await import('../src/lib/banco.js')
const { esCorrecta, calificar } = await import('../src/lib/examenes.js')

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
  tipo: 'opcion', pregunta: texto,
  opciones: ['a', 'b', 'c'].map((t, i) => ({ texto: t, correcta: i === correcta })),
})

const emparejar = (texto) => ({
  tipo: 'emparejar', pregunta: texto,
  pares: [
    { id: 'p1a', premisa: 'ACT', respuesta: 'Aceptar' },
    { id: 'p1b', premisa: 'DBT', respuesta: 'Regular' },
  ],
})

console.log('\n=== IDENTIFICADORES: QUE NO SE PISEN ===')
{
  const examen = [{ ...opcion('ya estaba'), id: 'p1' }]
  const r = agregarPreguntas(examen, [opcion('nueva')])
  check('no reusa un id ocupado', r[1].id !== 'p1', r[1].id)
  check('conserva el id de la que ya estaba', r[0].id === 'p1')
  check('agrega al final', r.length === 2 && r[1].pregunta === 'nueva')
}
{
  // El caso real: el editor siempre propone "p1" y antes se agregaba tal cual.
  const examen = [
    { ...opcion('uno'), id: 'p1' },
    { ...opcion('dos'), id: 'p2' },
    { ...opcion('tres'), id: 'p3' },
  ]
  const nuevas = [{ ...opcion('cuatro'), id: 'p1' }, { ...opcion('cinco'), id: 'p2' }]
  const r = agregarPreguntas(examen, nuevas)
  const ids = r.map(p => p.id)
  check('una tanda que choca entera se reubica',
    new Set(ids).size === 5, ids.join(','))
  check('los ids viejos no se tocan',
    ids[0] === 'p1' && ids[1] === 'p2' && ids[2] === 'p3', ids.join(','))
}
{
  const r = agregarPreguntas([], [opcion('a'), opcion('b'), opcion('c')])
  check('en un examen vacío numera desde p1',
    r.map(p => p.id).join(',') === 'p1,p2,p3', r.map(p => p.id).join(','))
}
{
  const examen = agregarPreguntas([], [emparejar('relaciona 1')])
  const r = agregarPreguntas(examen, [emparejar('relaciona 2')])
  const todos = r.flatMap(p => p.pares.map(x => x.id))
  check('los pares de dos "emparejar" no comparten id',
    new Set(todos).size === todos.length, todos.join(','))
  check('los pares conservan premisa y respuesta',
    r[1].pares[0].premisa === 'ACT' && r[1].pares[0].respuesta === 'Aceptar')
}
{
  // La consecuencia real de un id repetido, demostrada.
  const malo = [{ ...opcion('uno', 0), id: 'p1' }, { ...opcion('dos', 1), id: 'p1' }]
  const r1 = calificar(malo, { p1: 0 }, 50)
  check('con ids repetidos la calificación sale mal (el bug que se corrigió)',
    r1.correctas === 1 && r1.total === 2, JSON.stringify(r1))

  const bueno = agregarPreguntas([], [opcion('uno', 0), opcion('dos', 1)])
  const r2 = calificar(bueno, { [bueno[0].id]: 0, [bueno[1].id]: 1 }, 50)
  check('con ids libres las dos se califican bien',
    r2.correctas === 2 && r2.calificacion === 100, JSON.stringify(r2))
}
{
  const r = agregarPreguntas(null, null)
  check('listas nulas no truenan', Array.isArray(r) && r.length === 0)
}

console.log('\n=== IDA Y VUELTA BANCO <-> EXAMEN ===')
{
  const p = opcion('¿Cuál es el criterio?', 1)
  const fila = aFila(p, { organizacionId: 7, tema: ' Duelo ', dificultad: '2' })
  check('saca el tipo a su columna', fila.tipo === 'opcion')
  check('saca el enunciado a su columna', fila.pregunta === '¿Cuál es el criterio?')
  check('guarda las opciones en contenido', fila.contenido.opciones.length === 3)
  check('recorta el tema', fila.tema === 'Duelo')
  check('la dificultad queda numérica', fila.dificultad === 2)
  check('cuelga de la organización', fila.organizacion_id === 7)

  const vuelta = aPregunta({ ...fila, id: 42 })
  check('al volver sigue siendo respondible',
    esCorrecta(vuelta, 1) === true && esCorrecta(vuelta, 0) === false)
  check('recuerda de qué fila del banco salió', vuelta.banco_id === 42)
}
{
  const corta = { tipo: 'corta', pregunta: '¿Siglas?', respuesta: 'TEPT|trastorno' }
  const vuelta = aPregunta({ ...aFila(corta, { organizacionId: 1 }), id: 1 })
  check('la respuesta corta sobrevive el viaje', esCorrecta(vuelta, 'TEPT') === true)
  check('y sus variantes también', esCorrecta(vuelta, 'trastorno') === true)
}
{
  const vf = {
    tipo: 'vf', pregunta: 'Afirmación',
    opciones: [{ texto: 'Verdadero', correcta: false }, { texto: 'Falso', correcta: true }],
  }
  const vuelta = aPregunta({ ...aFila(vf, { organizacionId: 1 }), id: 2 })
  check('verdadero/falso conserva cuál es la correcta',
    esCorrecta(vuelta, 1) === true && esCorrecta(vuelta, 0) === false)
}
{
  const vuelta = aPregunta({ ...aFila(emparejar('rel'), { organizacionId: 1 }), id: 3 })
  check('emparejar conserva los pares',
    esCorrecta(vuelta, { p1a: 'Aceptar', p1b: 'Regular' }) === true)
  check('y detecta el emparejado incorrecto',
    esCorrecta(vuelta, { p1a: 'Regular', p1b: 'Aceptar' }) === false)
}
{
  const sinTema = aFila(opcion('x'), { organizacionId: 1, tema: '   ' })
  check('un tema en blanco queda nulo, no cadena vacía', sinTema.tema === null)
  check('sin dificultad queda nula', sinTema.dificultad === null)
}

console.log('\n=== SORTEO ===')
{
  const lista = Array.from({ length: 40 }, (_, i) => ({ id: i }))
  const r = tomarAlAzar(lista, 10)
  check('devuelve la cantidad pedida', r.length === 10)
  check('no repite', new Set(r.map(x => x.id)).size === 10)
  check('no modifica la lista original', lista.length === 40 && lista[0].id === 0)
  check('pedir más de las que hay devuelve todas',
    tomarAlAzar(lista, 500).length === 40)
  check('pedir cero devuelve nada', tomarAlAzar(lista, 0).length === 0)
  check('pedir un número negativo no truena', tomarAlAzar(lista, -5).length === 0)
  check('una lista nula no truena', tomarAlAzar(null, 3).length === 0)

  // No prueba que sea uniforme (eso pide estadística), sino que de
  // verdad mezcla: dos sorteos seguidos no deberían salir iguales.
  const a = tomarAlAzar(lista, 20).map(x => x.id).join(',')
  const b = tomarAlAzar(lista, 20).map(x => x.id).join(',')
  check('dos sorteos no dan el mismo resultado', a !== b)
}

console.log('\n=== FILTROS ===')
{
  const banco = [
    { id: 1, pregunta: 'Criterios del duelo prolongado', tema: 'Duelo', tipo: 'opcion', dificultad: 3 },
    { id: 2, pregunta: 'Definición de TEPT', tema: 'Trauma', tipo: 'corta', dificultad: 1 },
    { id: 3, pregunta: 'El duelo dura un año', tema: 'Duelo', tipo: 'vf', dificultad: null },
  ]
  const f = (extra) => filtrar(banco, { tema: '', tipo: '', dificultad: '', busca: '', ...extra })
  check('sin filtros devuelve todo', f({}).length === 3)
  check('filtra por tema', f({ tema: 'Duelo' }).length === 2)
  check('filtra por tipo', f({ tipo: 'corta' }).length === 1)
  check('filtra por dificultad', f({ dificultad: '3' }).length === 1)
  check('busca en el enunciado', f({ busca: 'duelo' }).length === 2)
  check('la búsqueda ignora acentos', f({ busca: 'definicion' }).length === 1)
  check('la búsqueda ignora mayúsculas', f({ busca: 'TEPT' }).length === 1)
  check('los filtros se combinan',
    f({ tema: 'Duelo', tipo: 'vf' }).length === 1)
  check('una combinación sin resultados devuelve lista vacía',
    f({ tema: 'Trauma', tipo: 'vf' }).length === 0)
  check('lista los temas sin repetir y ordenados',
    temasDe(banco).join(',') === 'Duelo,Trauma')
  check('normalizar para buscar quita acentos',
    paraBuscar('Definición ÁÉÍ') === 'definicion aei')
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
