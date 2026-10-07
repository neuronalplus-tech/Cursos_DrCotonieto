/**
 * Pruebas de los helpers de visibilidad.
 *
 * Existen por un caso concreto: `moduloVisible` leía un parámetro
 * llamado `esAdmin` mientras quien la llamaba le mandaba
 * `gestionaCurso`. Al desestructurar, un nombre que no coincide no da
 * error: da `undefined`. El resultado fue que el permiso de quien
 * gestiona el curso no se aplicaba NUNCA, y cualquier módulo con ruta
 * aparecía como privado incluso para el administrador.
 *
 * Nada en el lint ni en el build detecta eso. Una prueba, sí.
 *
 * Uso: node supabase/test-helpers.mjs
 */
const {
  moduloVisible, moduloBloqueadoParaAlumno, emiteConstancia,
} = await import('../src/lib/helpers.js')

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

const alguien = { id: 'u1' }

console.log('\n=== QUIEN GESTIONA EL CURSO LO VE TODO ===')
check('un módulo con ruta, aunque no sea su ruta',
  moduloVisible({ grupo: 'A' }, { user: alguien, gestionaCurso: true, miGrupo: 'B' }) === true)
check('un módulo oculto sin sesión',
  moduloVisible({ oculto: true }, { user: null, gestionaCurso: true, miGrupo: null }) === true)
check('un módulo con ruta sin estar inscrito',
  moduloVisible({ grupo: 'A' }, { user: alguien, gestionaCurso: true, miGrupo: null }) === true)

console.log('\n=== EL ALUMNO, SOLO LO SUYO ===')
check('ve un módulo abierto',
  moduloVisible({}, { user: alguien, gestionaCurso: false, miGrupo: null }) === true)
check('ve el módulo de SU ruta',
  moduloVisible({ grupo: 'A' }, { user: alguien, gestionaCurso: false, miGrupo: 'A' }) === true)
check('no ve el módulo de OTRA ruta',
  moduloVisible({ grupo: 'A' }, { user: alguien, gestionaCurso: false, miGrupo: 'B' }) === false)
check('no ve un módulo con ruta si no tiene ruta',
  moduloVisible({ grupo: 'A' }, { user: alguien, gestionaCurso: false, miGrupo: null }) === false)

console.log('\n=== SIN SESIÓN ===')
check('no ve un módulo oculto',
  moduloVisible({ oculto: true }, { user: null, gestionaCurso: false, miGrupo: null }) === false)
check('no ve un módulo con ruta',
  moduloVisible({ grupo: 'A' }, { user: null, gestionaCurso: false, miGrupo: null }) === false)
check('sí ve un módulo abierto',
  moduloVisible({}, { user: null, gestionaCurso: false, miGrupo: null }) === true)

console.log('\n=== EL NOMBRE DEL PARÁMETRO (el error que motivó estas pruebas) ===')
check('mandar el nombre viejo YA NO abre el módulo',
  moduloVisible({ grupo: 'A' }, { user: alguien, esAdmin: true, miGrupo: 'B' }) === false)
check('y el nombre correcto sí',
  moduloVisible({ grupo: 'A' }, { user: alguien, gestionaCurso: true, miGrupo: 'B' }) === true)

console.log('\n=== MÓDULO TODAVÍA NO ABIERTO ===')
check('disponible false bloquea', moduloBloqueadoParaAlumno({ disponible: false }) === true)
check('disponible true no bloquea', moduloBloqueadoParaAlumno({ disponible: true }) === false)
check('sin el campo no bloquea', moduloBloqueadoParaAlumno({}) === false)
check('un módulo nulo no truena', moduloBloqueadoParaAlumno(null) === false)

console.log('\n=== CONSTANCIA ===')
check('un curso de paga la emite', emiteConstancia({ gratuito: false }) === true)
check('uno gratuito no', emiteConstancia({ gratuito: true }) === false)
check('se puede apagar por curso', emiteConstancia({ constancia: false }) === false)
check('un curso nulo no truena', emiteConstancia(null) === false)

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
