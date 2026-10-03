// Prueba rápida de la lógica de exámenes (no es parte de la app).
// Ejecutar: node supabase/test-examenes.mjs
import { parseTabla, filasAPreguntas, preguntasATSV, calificar, tipoDe, PLANTILLA_TSV } from '../src/lib/examenes.js'

let ok = 0, fallos = 0
const check = (nombre, cond) => {
  if (cond) { ok++; console.log('  ok  ' + nombre) }
  else { fallos++; console.log('  FALLA  ' + nombre) }
}

console.log('\n1) Compatibilidad con preguntas viejas (sin "tipo")')
const vieja = { id: 'x1', pregunta: 'Vieja', opciones: [{ texto: 'A', correcta: true }, { texto: 'B', correcta: false }] }
check('detecta opcion', tipoDe(vieja) === 'opcion')
check('califica bien', calificar([vieja], { x1: 0 }, 70).calificacion === 100)
check('califica mal', calificar([vieja], { x1: 1 }, 70).calificacion === 0)

console.log('\n2) Detecta V/F por heuristica (2 opciones Verdero/Falso, sin tipo)')
const vfViejo = { id: 'x2', pregunta: 'VF', opciones: [{ texto: 'Verdadero', correcta: false }, { texto: 'Falso', correcta: true }] }
check('detecta vf', tipoDe(vfViejo) === 'vf')
check('califica V', calificar([vfViejo], { x2: 1 }, 50).calificacion === 100)

console.log('\n3) Los 4 tipos, ida y vuelta (TSV -> preguntas -> TSV)')
const { preguntas, errores } = filasAPreguntas(parseTabla(PLANTILLA_TSV))
check('sin errores', errores.length === 0)
check('4 preguntas', preguntas.length === 4)
check('tipos correctos', JSON.stringify(preguntas.map(p => p.tipo)) === '["opcion","vf","corta","emparejar"]')

console.log('\n4) Opcion multiple: correcta por numero y por texto')
const { preguntas: p2 } = filasAPreguntas(parseTabla('tipo\tpregunta\topción 1\topción 2\tOpción 3\tCorrecta\nopcion\tP1\tUno\tDos\tTres\t2'))
check('correcta = numero', p2[0].opciones[1].correcta === true && p2[0].opciones[0].correcta === false)
const { preguntas: p3 } = filasAPreguntas(parseTabla('tipo,pregunta,op1,op2,Correcta\nopcion,P2,Uno,Dos,Dos'))
check('correcta = texto', p3[0].opciones[1].correcta === true)

console.log('\n4b) Mapeo por NOMBRE de encabezado (tabla con menos columnas)')
const { preguntas: p2b, errores: e2b } = filasAPreguntas(parseTabla(
  'Enunciado\tA\tB\tC\tCorrecta\n' +
  'P3\tUno\tDos\tTres\t3'))
check('sin errores con 5 columnas', e2b.length === 0 && p2b.length === 1)
check('opciones en orden A,B,C', p2b[0].opciones[2].texto === 'Tres')
check('correcta = tercera', p2b[0].opciones[2].correcta === true)
const { preguntas: p2c } = filasAPreguntas(parseTabla(
  'respuesta correcta\topción 1\topción 2\ttipo\tenunciado\n' +
  'SI\tSI\tNO\tvf\tEl duelo es universal'))
check('encabezados desordenados', p2c.length === 1 && p2c[0].tipo === 'vf' && p2c[0].opciones[0].correcta === true)
const { preguntas: p2d } = filasAPreguntas(parseTabla(
  'Tipo\tPregunta\tRespuesta\n' +
  'corta\t¿Qué sigla tiene TEPT?\tTEPT|trastorno de estrés postraumático'))
check('tabla de 3 columnas para "corta"', p2d.length === 1 && p2d[0].tipo === 'corta' && p2d[0].respuesta.startsWith('TEPT'))
const { preguntas: p2e } = filasAPreguntas(parseTabla(
  'Tipo\tPregunta\tPares\n' +
  'emparejar\tRelaciona\tACT=Aceptar; DBT=Regular'))
check('tabla de 3 columnas para "emparejar"', p2e.length === 1 && p2e[0].pares.length === 2)


console.log('\n5) Calificacion de cada tipo')
check('vf', calificar([preguntas[1]], { p2: 0 }, 50).calificacion === 100)
check('corta exacta', calificar([preguntas[2]], { p3: 'tept' }, 50).calificacion === 100)
check('corta variante', calificar([preguntas[2]], { p3: 'trastorno de estrés postraumático' }, 50).calificacion === 100)
check('corta incorrecta', calificar([preguntas[2]], { p3: 'no existe' }, 50).calificacion === 0)
check('emparejar bien', calificar([preguntas[3]], { p4: { p1: 'Aceptar', p2: 'Regular', p3: 'Restaurar' } }, 50).calificacion === 100)
check('emparejar mal', calificar([preguntas[3]], { p4: { p1: 'Aceptar', p2: 'Mal', p3: 'Restaurar' } }, 50).calificacion === 0)

console.log('\n6) Umbral de aprobacion')
const r = calificar(preguntas, { p1: 1, p2: 0, p3: 'TEPT', p4: { p1: 'Aceptar', p2: 'Regular', p3: 'Restaurar' } }, 100)
check('4 de 4 = 100% y aprobado', r.calificacion === 100 && r.aprobado === true)
check('4 de 3 = 75% y NO aprobado con umbral 100', calificar(preguntas, { p1: 1, p2: 0, p3: 'TEPT', p4: { p1: 'X', p2: 'Y', p3: 'Z' } }, 100).aprobado === false)

console.log('\n7) Export a TSV y re-import (round-trip)')
const tsv = preguntasATSV(preguntas)
const { preguntas: deVuelta, errores: e2 } = filasAPreguntas(parseTabla(tsv))
check('round-trip sin errores', e2.length === 0)
check('round-trip 4 preguntas', deVuelta.length === 4)
check('round-trip tipos', JSON.stringify(deVuelta.map(p => p.tipo)) === '["opcion","vf","corta","emparejar"]')
check('round-trip sigue calificando bien', calificar(deVuelta, { p1: 1, p2: 0, p3: 'TEPT', p4: { p1: 'Aceptar', p2: 'Regular', p3: 'Restaurar' } }, 100).calificacion === 100)

console.log('\n8) Filas malas se reportan (no revientan)')
const { preguntas: p4, errores: e3 } = filasAPreguntas(parseTabla(
  'tipo\tpregunta\top1\top2\tcorrecta\trespuesta\tpares\n' +
  'opcion\tSin suficientes\tSolo una\n' +
  'opcion\tSin correcta\tUno\tDos\t\n' +
  'vf\tVF malo\t\t\t\tX\t\t\n' +
  'corta\tSin respuesta\t\t\t\t\t\t\n' +
  'emparejar\tUn solo par\t\t\t\t\t\t\tA=B\n'))
check('0 preguntas válidas', p4.length === 0)
check('5 errores reportados', e3.length === 5)

console.log('\n9) CSV con comillas y coma dentro del texto')
const { preguntas: p5 } = filasAPreguntas(parseTabla('tipo,pregunta,op1,op2,correcta\nopcion,"Di, ¿cómo estás?",Uno,"Dos, con coma",Dos'))
check('respeta comas entre comillas', p5.length === 1 && p5[0].pregunta === 'Di, ¿cómo estás?')
check('opción con coma', p5[0].opciones[1].texto === 'Dos, con coma')

console.log('\n10) Sin encabezado: se respeta el orden fijo de 10 columnas')
const { preguntas: p6, errores: e6 } = filasAPreguntas(parseTabla(
  'opcion\tSin encabezado\tUno\tDos\t\t\t\t1\t\t\n' +
  'opcion\tTercera\tTres\tCuatro\t\t\t\t2\t\t'))
check('2 preguntas sin encabezado', p6.length === 2 && e6.length === 0)
check('opciones tomadas de op1..op5', p6[1].opciones[0].texto === 'Tres' && p6[1].opciones[1].texto === 'Cuatro')

console.log('\n11) Filas totalmente vacias se ignoran sin quejarse')
const { preguntas: p7, errores: e7 } = filasAPreguntas(parseTabla(
  'opcion\tCon texto\tUno\tDos\t\t\t\t1\t\t\n' +
  '\t\t\t\t\t\t\t\t\t\n' +
  '\n' +
  'opcion\tOtro\tTres\tCuatro\t\t\t\t2\t\t'))
check('2 preguntas (vacias ignoradas)', p7.length === 2)
check('sin errores', e7.length === 0)

console.log('\n' + '='.repeat(46))
console.log(`  ${ok} pruebas OK · ${fallos} fallos`)
console.log('='.repeat(46) + '\n')
process.exit(fallos === 0 ? 0 : 1)
