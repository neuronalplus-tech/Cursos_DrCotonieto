/**
 * Pruebas del armado de CSV para la exportación.
 *
 * Un CSV mal armado no truena: se abre, parece correcto, y tiene las
 * columnas corridas a partir de la primera fila que llevaba un punto
 * y coma dentro de un texto. Quien lo recibe no tiene forma de saber
 * que está leyendo mal los datos de sus alumnos.
 *
 * Por eso casi todas las pruebas de aquí son sobre texto sucio:
 * comillas, saltos de línea, el separador dentro del dato.
 *
 * Uso: node supabase/test-exportar.mjs
 */
const { aCSV, nombreSeguro, leeme, CONJUNTOS } =
  await import('../src/lib/exportar.js')

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

const BOM = String.fromCharCode(0xFEFF)
/** Quita la marca y parte en líneas, que es lo que haría Excel. */
const lineas = (csv) => csv.replace(BOM, '').split('\r\n')

console.log('\n=== LO BÁSICO ===')
{
  const csv = aCSV([{ a: 1, b: 'hola' }, { a: 2, b: 'adios' }])
  const l = lineas(csv)
  check('la cabecera sale de las claves', l[0] === 'a;b', l[0])
  check('una línea por fila', l.length === 3, String(l.length))
  check('los valores van en orden', l[1] === '1;hola', l[1])
  check('separa con punto y coma, que es lo que espera Excel en español',
    l[0].includes(';'))
  check('lleva la marca de orden de bytes, o Excel rompe los acentos',
    csv.startsWith(BOM))
  check('termina las líneas con CRLF', csv.includes('\r\n'))
}
check('una lista vacía no truena', typeof aCSV([]) === 'string')
check('con columnas explícitas respeta ese orden',
  lineas(aCSV([{ a: 1, b: 2 }], ['b', 'a']))[0] === 'b;a')

console.log('\n=== TEXTO SUCIO (donde se corrompen los datos) ===')
{
  const csv = aCSV([{ t: 'Modulo 1; introduccion' }])
  const l = lineas(csv)
  check('un punto y coma dentro del dato se entrecomilla',
    l[1] === '"Modulo 1; introduccion"', l[1])
  check('y no parte la fila en dos columnas', l.length === 2)
}
{
  const l = lineas(aCSV([{ t: 'Dijo "hola" y se fue' }]))
  check('las comillas se duplican, como manda el formato',
    l[1] === '"Dijo ""hola"" y se fue"', l[1])
}
{
  const csv = aCSV([{ t: 'Primera linea\nSegunda linea' }, { t: 'ok' }])
  check('un salto de línea dentro del dato se entrecomilla',
    csv.includes('"Primera linea\nSegunda linea"'))
  const l = lineas(csv)
  check('y la fila siguiente sigue existiendo',
    l[l.length - 1] === 'ok', JSON.stringify(l))
}
check('los acentos pasan tal cual',
  aCSV([{ t: 'Psicología · año ñ' }]).includes('Psicología · año ñ'))

console.log('\n=== VALORES QUE NO SON TEXTO ===')
check('un nulo queda vacío, no dice "null"',
  lineas(aCSV([{ a: null }]))[1] === '')
check('un indefinido también',
  lineas(aCSV([{ a: undefined }]))[1] === '')
check('un cero SÍ se escribe', lineas(aCSV([{ a: 0 }]))[1] === '0')
check('un false también', lineas(aCSV([{ a: false }]))[1] === 'false')
check('un objeto se guarda como JSON',
  lineas(aCSV([{ a: { x: 1 } }]))[1].includes('x'))
{
  // Una rúbrica o unas preguntas son jsonb y llevan comillas dentro.
  const l = lineas(aCSV([{ a: { texto: 'con;punto' } }]))
  check('un JSON con separador y comillas no rompe la fila', l.length === 2, String(l.length))
}

console.log('\n=== NOMBRE DE ARCHIVO ===')
check('quita acentos', nombreSeguro('Federación Mexicana') === 'federacion-mexicana')
check('quita espacios y signos', nombreSeguro('A.C. / Psicología!') === 'a-c-psicologia')
check('no empieza ni acaba en guion', !/^-|-$/.test(nombreSeguro('  hola  ')))
check('un nombre vacío no da cadena vacía', nombreSeguro('') === 'export')
check('un nombre nulo tampoco', nombreSeguro(null) === 'export')
check('recorta los nombres larguísimos', nombreSeguro('x'.repeat(200)).length <= 40)

console.log('\n=== EL ARCHIVO QUE EXPLICA EL PAQUETE ===')
{
  const txt = leeme({ nombre: 'Federación' },
    [{ nombre: 'cursos', filas: 3 }, { nombre: 'personas', filas: 40 }], '2026-10-07')
  check('nombra la organización', txt.includes('FEDERACIÓN'))
  check('lleva la fecha', txt.includes('2026-10-07'))
  check('lista cada archivo con su cuenta', txt.includes('cursos.csv') && txt.includes('3 registro'))
  check('explica cómo se relacionan', txt.includes('cursos.id'))
  check('dice que no hay contraseñas', /Contrase/i.test(txt))
  check('avisa de los archivos de las entregas', txt.includes('archivo_path'))
}

console.log('\n=== LA LISTA DE CONJUNTOS ===')
check('hay conjuntos definidos', CONJUNTOS.length >= 10)
check('todos tienen clave y título', CONJUNTOS.every(c => c.clave && c.titulo))
check('no se repiten las claves',
  new Set(CONJUNTOS.map(c => c.clave)).size === CONJUNTOS.length)
check('NO incluye la bitácora, que es de la plataforma',
  !CONJUNTOS.some(c => /auditor|bitacora/i.test(c.clave)))
check('NO incluye los pagos, que son la relación comercial',
  !CONJUNTOS.some(c => /pago/i.test(c.clave)))

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
