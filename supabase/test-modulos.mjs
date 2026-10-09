/**
 * Pruebas de los módulos activables.
 *
 * El error que importa: esconderle una sección a quien SÍ la
 * contrató. No da un mensaje de error, no sale en ningún registro —
 * simplemente no está, y el cliente llama diciendo que la plataforma
 * «perdió» su pase de lista.
 *
 * Por eso lo que no se sabe se enseña, y por eso lo esencial no se
 * apaga nunca.
 *
 * Uso: node supabase/test-modulos.mjs
 */
const {
  seccionVisible, conjuntoModulos, estadoModulos, ganariaCon,
  planSinModulos, MODULO_DE_SECCION, SECCIONES_PLATAFORMA,
} = await import('../src/lib/modulos.js')

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

const CATALOGO = [
  { clave: 'aula', nombre: 'Aula virtual', esencial: true, orden: 10 },
  { clave: 'mensajeria', nombre: 'Mensajería', esencial: false, orden: 20 },
  { clave: 'evaluacion', nombre: 'Evaluación avanzada', esencial: false, orden: 30 },
  { clave: 'control_escolar', nombre: 'Control escolar', esencial: false, orden: 50 },
  { clave: 'documentos', nombre: 'Documentos', esencial: false, orden: 60 },
]

console.log('\n=== QUÉ SECCIONES SE VEN ===')
{
  const m = conjuntoModulos(['aula', 'mensajeria'])
  check('una sección de un módulo contratado se ve',
    seccionVisible('cursos', m) === true)
  check('una de un módulo NO contratado se esconde',
    seccionVisible('banco', m) === false)
  check('mensajería se ve si la tiene', seccionVisible('mensajes', m) === true)
  check('plantillas no, si no tiene documentos',
    seccionVisible('plantillas', m) === false)
}
{
  // El caso que no debe fallar nunca.
  const m = conjuntoModulos(['aula'])
  check('el aula es esencial y siempre se ve',
    seccionVisible('cursos', m) === true)
  check('y también sus inscripciones y usuarios',
    seccionVisible('inscripciones', m) && seccionVisible('usuarios', m))
}
check('una sección sin módulo declarado se ve siempre',
  seccionVisible('loquesea', conjuntoModulos(['aula'])) === true)

console.log('\n=== MIENTRAS NO SE SABE, SE ENSEÑA ===')
check('sin módulos cargados todavía, se enseña todo',
  seccionVisible('banco', new Set()) === true)
check('con módulos nulos, también',
  seccionVisible('banco', null) === true)
check('y con indefinido', seccionVisible('banco', undefined) === true)

console.log('\n=== EL CONJUNTO ===')
check('acepta una lista de textos',
  conjuntoModulos(['aula', 'documentos']).has('documentos'))
check('acepta lo que devuelve la base',
  conjuntoModulos([{ modulo: 'aula' }, { modulo: 'roles' }]).has('roles'))
check('ignora los vacíos', conjuntoModulos([null, '', 'aula']).size === 1)
check('una lista nula da un conjunto vacío', conjuntoModulos(null).size === 0)

console.log('\n=== LA FICHA DEL CLIENTE ===')
{
  const e = estadoModulos(CATALOGO, ['mensajeria'])
  const porClave = Object.fromEntries(e.map(m => [m.clave, m]))
  check('lo contratado sale activo', porClave.mensajeria.activo === true)
  check('lo no contratado sale inactivo', porClave.documentos.activo === false)
  check('lo ESENCIAL sale activo aunque no se haya listado',
    porClave.aula.activo === true)
  check('salen todos los del catálogo', e.length === CATALOGO.length)
  check('en el orden del catálogo', e[0].clave === 'aula' && e[1].clave === 'mensajeria')
  check('no modifica el catálogo original', CATALOGO[0].clave === 'aula')
}
check('sin nada contratado, solo lo esencial queda activo',
  estadoModulos(CATALOGO, []).filter(m => m.activo).length === 1)

console.log('\n=== QUÉ GANARÍA SUBIENDO DE PLAN ===')
{
  const g = ganariaCon(['aula', 'mensajeria'],
    ['aula', 'mensajeria', 'control_escolar', 'documentos'], CATALOGO)
  check('solo lo que no tiene', g.length === 2, g.join())
  check('con el nombre legible, no la clave',
    g.includes('Control escolar'), g.join())
  check('si ya lo tiene todo, no gana nada',
    ganariaCon(['aula'], ['aula'], CATALOGO).length === 0)
  check('una clave fuera del catálogo no se pierde',
    ganariaCon([], ['inventado'], CATALOGO)[0] === 'inventado')
  check('listas nulas no truenan', ganariaCon(null, null, null).length === 0)
}

console.log('\n=== AVISOS AL CONFIGURAR ===')
check('un plan sin módulos se detecta', planSinModulos([]) === true)
check('y uno nulo también', planSinModulos(null) === true)
check('uno con módulos, no', planSinModulos(['aula']) === false)

console.log('\n=== EL MAPA DE SECCIONES ===')
check('todas las secciones apuntan a un módulo con nombre',
  Object.values(MODULO_DE_SECCION).every(v => typeof v === 'string' && v.length))
check('las de la plataforma NO están en el mapa',
  SECCIONES_PLATAFORMA.every(s => !MODULO_DE_SECCION[s]))
check('hay secciones de plataforma declaradas', SECCIONES_PLATAFORMA.length === 3)
{
  // Si alguien añade una sección y olvida el módulo, se ve siempre.
  // Es el lado seguro, pero conviene que esté dicho.
  const m = conjuntoModulos(['aula'])
  check('una sección nueva sin declarar se ve (lado seguro)',
    seccionVisible('seccion_que_alguien_olvido', m) === true)
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
