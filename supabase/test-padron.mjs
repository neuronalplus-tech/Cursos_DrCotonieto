/**
 * Pruebas del lector de padrones.
 *
 * Lo que entra aquí viene de un Excel que escribió alguien más, así
 * que llega como llegue: con encabezado o sin él, con el correo en la
 * primera columna o en la tercera, con filas vacías, con repetidos.
 * Lo único que no se vale es inventar: una fila sin correo se reporta
 * y se salta, nunca se adivina.
 *
 * Uso: node supabase/test-padron.mjs
 */
const { parsePadron, cruzarGeneraciones, esCorreo, PLANTILLA_PADRON } =
  await import('../src/lib/padron.js')

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

const tsv = (...lineas) => lineas.join('\n')

console.log('\n=== ¿ES UN CORREO? ===')
check('uno normal', esCorreo('ana@ejemplo.mx') === true)
check('con punto y guion', esCorreo('ana.lopez-ruiz@sub.ejemplo.com.mx') === true)
check('sin arroba, no', esCorreo('ana ejemplo.mx') === false)
check('sin dominio, no', esCorreo('ana@ejemplo') === false)
check('con espacio, no', esCorreo('ana lopez@ejemplo.mx') === false)
check('vacío, no', esCorreo('') === false)
check('nulo no truena', esCorreo(null) === false)

console.log('\n=== LA LISTA DE SIEMPRE (solo correos) ===')
{
  const r = parsePadron(tsv('ana@ejemplo.mx', 'juan@ejemplo.mx'))
  check('sigue funcionando', r.filas.length === 2)
  check('normaliza a minúsculas',
    parsePadron('ANA@Ejemplo.MX').filas[0].email === 'ana@ejemplo.mx')
  check('no cree que haya columnas', r.conColumnas === false)
  check('sin errores', r.errores.length === 0)
}
check('separados por comas', parsePadron('ana@ejemplo.mx,juan@ejemplo.mx').filas.length === 2)

console.log('\n=== PADRÓN CON ENCABEZADO ===')
{
  const r = parsePadron(tsv(
    'nombre\tcorreo\tgeneracion\truta',
    'Ana López Ruiz\tana@ejemplo.mx\t2026-A\tClínica',
    'Juan Pérez\tjuan@ejemplo.mx\t2026-A\tEducativa',
  ))
  check('lee las dos filas', r.filas.length === 2)
  check('se queda con el nombre', r.filas[0].nombre === 'Ana López Ruiz')
  check('y con la generación', r.filas[0].generacion === '2026-A')
  check('y con la ruta', r.filas[1].grupo === 'Educativa')
  check('avisa que hay columnas', r.conColumnas === true)
  check('no mete el encabezado como alumno',
    !r.filas.some(f => f.email === 'correo'))
}
{
  // El orden de las columnas lo decide quien manda el archivo.
  const r = parsePadron(tsv(
    'Correo electrónico\tGeneración\tNombre completo',
    'ana@ejemplo.mx\t2026-B\tAna López',
  ))
  check('mapea por nombre de columna, no por posición',
    r.filas[0].nombre === 'Ana López' && r.filas[0].generacion === '2026-B')
  check('tolera acentos y mayúsculas en el encabezado', r.filas.length === 1)
}
{
  const r = parsePadron(tsv('alumno;email;cohorte;sede',
    'Ana;ana@ejemplo.mx;2026-A;Norte'))
  check('acepta sinónimos y punto y coma',
    r.filas[0].nombre === 'Ana' && r.filas[0].generacion === '2026-A'
    && r.filas[0].grupo === 'Norte')
}

console.log('\n=== SIN ENCABEZADO, PERO CON COLUMNAS ===')
{
  const r = parsePadron(tsv('Ana López\tana@ejemplo.mx', 'Juan Pérez\tjuan@ejemplo.mx'))
  check('encuentra el correo aunque vaya segundo', r.filas.length === 2)
  check('toma la otra celda como nombre', r.filas[0].nombre === 'Ana López')
}
{
  const r = parsePadron('ana@ejemplo.mx\tAna López')
  check('y también si el correo va primero',
    r.filas[0].email === 'ana@ejemplo.mx' && r.filas[0].nombre === 'Ana López')
}

console.log('\n=== LO QUE NO SE VALE INVENTAR ===')
{
  const r = parsePadron(tsv(
    'nombre\tcorreo',
    'Ana López\tana@ejemplo.mx',
    'Juan Sin Correo\t',
  ))
  check('la fila sin correo no entra', r.filas.length === 1)
  check('y se reporta', r.errores.length === 1 && /Fila 3/.test(r.errores[0]), r.errores[0])
}
{
  const r = parsePadron(tsv('nombre\tcorreo', 'Ana\testo no es correo'))
  check('un correo mal escrito se reporta', r.errores.length === 1)
  check('y no se da de alta', r.filas.length === 0)
}
{
  const r = parsePadron(tsv('ana@ejemplo.mx', 'ANA@ejemplo.mx', 'juan@ejemplo.mx'))
  check('los repetidos se quitan', r.filas.length === 2)
  check('y se avisa cuál', /ana@ejemplo\.mx/.test(r.errores[0] || ''), r.errores[0])
}
check('líneas en blanco se ignoran sin quejarse',
  parsePadron('ana@ejemplo.mx\n\n\njuan@ejemplo.mx').errores.length === 0)
check('texto vacío devuelve lista vacía', parsePadron('').filas.length === 0)
check('nulo no truena', parsePadron(null).filas.length === 0)

console.log('\n=== CASO BORDE: UNA COLUMNA QUE SE LLAMA COMO UN DATO ===')
{
  // Si la primera fila trae un correo, es un alumno y no una cabecera,
  // por muy bien que encajen los nombres de columna.
  const r = parsePadron(tsv('correo\tnombre', 'ana@ejemplo.mx\tAna'))
  check('con cabecera de verdad hay 1 alumno', r.filas.length === 1)
  const r2 = parsePadron(tsv('ana@ejemplo.mx\tAna', 'juan@ejemplo.mx\tJuan'))
  check('sin cabecera no se pierde la primera fila', r2.filas.length === 2)
}

console.log('\n=== CRUCE DE GENERACIONES ===')
{
  const gens = [{ id: 7, nombre: '2026-A' }, { id: 8, nombre: 'Generación B' }]
  const filas = [
    { email: 'ana@ejemplo.mx', generacion: '2026-a' },
    { email: 'juan@ejemplo.mx', generacion: ' GENERACIÓN B ' },
    { email: 'luis@ejemplo.mx', generacion: 'No existe' },
    { email: 'eva@ejemplo.mx', generacion: '' },
  ]
  const { asignadas, sinCruzar } = cruzarGeneraciones(filas, gens)
  check('cruza ignorando mayúsculas', asignadas['ana@ejemplo.mx'] === 7)
  check('cruza ignorando acentos y espacios', asignadas['juan@ejemplo.mx'] === 8)
  check('lo que no existe NO se inventa', asignadas['luis@ejemplo.mx'] === undefined)
  check('y se reporta para que decidas', sinCruzar.includes('No existe'))
  check('sin generación no estorba', asignadas['eva@ejemplo.mx'] === undefined)
  check('no se reporta el vacío como faltante', sinCruzar.length === 1)
}
check('sin generaciones en la base no truena',
  cruzarGeneraciones([{ email: 'a@b.mx', generacion: 'X' }], null).sinCruzar.length === 1)
check('listas nulas no truenan', cruzarGeneraciones(null, null).sinCruzar.length === 0)

console.log('\n=== LA PLANTILLA SE LEE A SÍ MISMA ===')
{
  const r = parsePadron(PLANTILLA_PADRON)
  check('la plantilla produce 2 alumnos', r.filas.length === 2, String(r.filas.length))
  check('sin errores', r.errores.length === 0, r.errores.join(' | '))
  check('con todas las columnas',
    r.filas[0].nombre && r.filas[0].generacion && r.filas[0].grupo)
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
