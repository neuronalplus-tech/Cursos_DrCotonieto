/**
 * Pruebas del motor de plantillas.
 *
 * Lo que sale de aquí es un acta o una constancia: un documento que
 * alguien firma y que puede acabar en una revalidación. Un nombre mal
 * escapado rompe el HTML; un marcador que desaparece en silencio deja
 * un hueco en blanco que nadie nota hasta que ya está firmado.
 *
 * Uso: node supabase/test-plantillas.mjs
 */
const {
  rellenar, escapar, conLetra, fechaConLetra,
  marcadoresDesconocidos, bloquesSinCerrar,
  MARCADORES, BLOQUES, EJEMPLOS, SIN_DATO,
} = await import('../src/lib/plantillas.js')

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

const DATOS = {
  institucion: { nombre: 'Federación Mexicana de Psicología' },
  alumno: { nombre: 'Ana López', profesion: 'Psicóloga' },
  curso: { titulo: 'Duelo prolongado' },
  calificacion: { final: 87.5 },
  modulos: [
    { titulo: 'Módulo 1', calificacion: 90 },
    { titulo: 'Módulo 2', calificacion: 85 },
  ],
}

console.log('\n=== SUSTITUCIÓN ===')
check('cambia un marcador',
  rellenar('Hola {{alumno.nombre}}', DATOS) === 'Hola Ana López')
check('acepta espacios dentro de las llaves',
  rellenar('{{ alumno.nombre }}', DATOS) === 'Ana López')
check('baja por la ruta con puntos',
  rellenar('{{curso.titulo}}', DATOS) === 'Duelo prolongado')
check('cambia varios en la misma línea',
  rellenar('{{alumno.nombre}} — {{curso.titulo}}', DATOS)
    === 'Ana López — Duelo prolongado')
check('convierte números a texto',
  rellenar('{{calificacion.final}}', DATOS) === '87.5')
check('el texto sin marcadores no se toca',
  rellenar('Texto normal.', DATOS) === 'Texto normal.')

console.log('\n=== LO QUE FALTA SE VE ===')
check('un marcador sin dato queda marcado, no vacío',
  rellenar('{{alumno.curp}}', DATOS) === SIN_DATO)
check('una rama que no existe tampoco desaparece',
  rellenar('{{no.existe.nada}}', DATOS) === SIN_DATO)
check('una cadena vacía cuenta como sin dato',
  rellenar('{{x}}', { x: '' }) === SIN_DATO)
check('un cero SÍ es un dato', rellenar('{{x}}', { x: 0 }) === '0')
check('un false también', rellenar('{{x}}', { x: false }) === 'false')

console.log('\n=== ESCAPADO (lo que rompe un documento) ===')
check('escapa los signos de HTML',
  escapar('<b>Ana & "Luis"</b>')
    === '&lt;b&gt;Ana &amp; &quot;Luis&quot;&lt;/b&gt;')
{
  const r = rellenar('{{alumno.nombre}}', { alumno: { nombre: 'Ana <script>' } })
  check('un nombre con etiquetas no entra como HTML',
    !r.includes('<script>'), r)
}
check('un apellido con & no rompe el documento',
  rellenar('{{x}}', { x: 'Pérez & Pérez' }) === 'Pérez &amp; Pérez')
check('se puede desactivar el escapado para HTML de confianza',
  rellenar('{{x}}', { x: '<b>ok</b>' }, { escaparHtml: false }) === '<b>ok</b>')

console.log('\n=== BLOQUES QUE SE REPITEN ===')
{
  const r = rellenar('{{#modulos}}[{{titulo}}:{{calificacion}}]{{/modulos}}', DATOS)
  check('repite una vez por fila', r === '[Módulo 1:90][Módulo 2:85]', r)
}
{
  const r = rellenar('{{#modulos}}{{indice}}.{{titulo}} {{/modulos}}', DATOS)
  check('numera las filas', r === '1.Módulo 1 2.Módulo 2 ', JSON.stringify(r))
}
{
  const r = rellenar('{{#modulos}}{{institucion.nombre}};{{/modulos}}', DATOS)
  check('dentro del bloque también se ven los datos generales',
    r.includes('Federación'), r)
}
check('un bloque sin filas no deja rastro',
  rellenar('A{{#alumnos}}X{{/alumnos}}B', DATOS) === 'AB')
check('un bloque de algo que no es lista tampoco',
  rellenar('A{{#curso}}X{{/curso}}B', DATOS) === 'AB')
{
  const r = rellenar('{{#modulos}}<td>{{titulo}}</td>{{/modulos}}',
    { modulos: [{ titulo: 'A & B' }] })
  check('lo de dentro del bloque también se escapa',
    r === '<td>A &amp; B</td>', r)
}

console.log('\n=== AVISOS AL EDITAR ===')
check('detecta un marcador que no existe',
  marcadoresDesconocidos('{{alumno.nombre}} {{inventado.cosa}}')
    .includes('inventado.cosa'))
check('no se queja de los válidos',
  marcadoresDesconocidos('{{alumno.nombre}} {{fecha.hoy}}').length === 0)
check('no se queja de los campos dentro de un bloque',
  marcadoresDesconocidos('{{#alumnos}}{{nombre}}{{/alumnos}}').length === 0,
  marcadoresDesconocidos('{{#alumnos}}{{nombre}}{{/alumnos}}').join(','))
check('detecta un bloque sin cerrar',
  bloquesSinCerrar('{{#alumnos}}x').includes('alumnos'))
check('no se queja de uno bien cerrado',
  bloquesSinCerrar('{{#alumnos}}x{{/alumnos}}').length === 0)
check('detecta el que falta entre varios',
  bloquesSinCerrar('{{#a}}1{{/a}}{{#b}}2').join() === 'b')

console.log('\n=== CALIFICACIÓN CON LETRA ===')
check('un entero', conLetra(8) === 'OCHO')
check('con decimal', conLetra(87.5) === 'OCHENTA Y SIETE PUNTO CINCO', conLetra(87.5))
check('veintitantos se escriben juntos', conLetra(25) === 'VEINTICINCO', conLetra(25))
check('veinte exacto', conLetra(20) === 'VEINTE')
check('cien', conLetra(100) === 'CIEN')
check('cero', conLetra(0) === 'CERO')
check('nulo no truena', conLetra(null) === '')
check('texto no numérico no truena', conLetra('ocho') === '')

console.log('\n=== FECHA CON LETRA ===')
check('escribe el mes',
  fechaConLetra(new Date(2026, 9, 8)) === '8 de octubre de 2026',
  fechaConLetra(new Date(2026, 9, 8)))
check('una fecha inválida no truena', fechaConLetra('xxx') === '')

console.log('\n=== CATÁLOGO Y EJEMPLOS ===')
check('hay marcadores documentados', MARCADORES.length >= 15)
check('todos traen clave y descripción', MARCADORES.every(([k, d]) => k && d))
check('hay bloques documentados', BLOQUES.length >= 2)
for (const [nombre, texto] of Object.entries(EJEMPLOS)) {
  check(`el ejemplo «${nombre}» no tiene marcadores inventados`,
    marcadoresDesconocidos(texto).length === 0,
    marcadoresDesconocidos(texto).join(', '))
  check(`el ejemplo «${nombre}» cierra sus bloques`,
    bloquesSinCerrar(texto).length === 0)
}

console.log('\n=== CASOS BORDE ===')
check('plantilla vacía', rellenar('', DATOS) === '')
check('plantilla nula', rellenar(null, DATOS) === '')
check('datos nulos no truenan', rellenar('{{a.b}}', null) === SIN_DATO)
check('llaves sueltas no se tocan', rellenar('{ no es marcador }', DATOS)
  === '{ no es marcador }')

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
