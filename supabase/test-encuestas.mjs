/**
 * Pruebas de NPS + marca blanca (F5-3).
 *
 * El NPS decide si un curso se presume o se revisa. Con pocas
 * respuestas el número miente: por eso <10 no da NPS.
 * El CSS del cliente no debe poder exfiltrar ni romper nada.
 *
 * Funciones puras, sin base ni navegador.
 *
 * Uso: node supabase/test-encuestas.mjs
 */
const {
  grupoNps, calcularNps, resumirNps, sanearCss,
} = await import('../src/lib/encuestas.js')

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

console.log('\n=== GRUPOS NPS ===')
check('10 = promotor', grupoNps(10) === 'promotor')
check('9 = promotor', grupoNps(9) === 'promotor')
check('8 = pasivo', grupoNps(8) === 'pasivo')
check('7 = pasivo', grupoNps(7) === 'pasivo')
check('6 = detractor', grupoNps(6) === 'detractor')
check('0 = detractor', grupoNps(0) === 'detractor')
check('sin dato = null', grupoNps(null) === null)

console.log('\n=== CÁLCULO NPS ===')
check('con menos de 10 no da número (miente)',
  calcularNps([10, 10, 10]) === null)
check('todos promotores = 100',
  calcularNps(Array(10).fill(10)) === 100)
check('mitad y mitad = 0',
  calcularNps([...Array(5).fill(10), ...Array(5).fill(0)]) === 0)
check('todos detractores = -100',
  calcularNps(Array(10).fill(0)) === -100)
check('lista vacía = null', calcularNps([]) === null)

console.log('\n=== RESUMEN ===')
{
  const r = resumirNps([
    ...Array(6).fill({ puntaje: 10 }),
    ...Array(2).fill({ puntaje: 8 }),
    ...Array(2).fill({ puntaje: 3 }),
  ])
  check('cuenta total', r.total === 10, JSON.stringify(r))
  check('cuenta promotores', r.promotores === 6, JSON.stringify(r))
  check('NPS 60-20=40', r.nps === 40, String(r.nps))
}

console.log('\n=== SANEO CSS ===')
check('vacío da vacío', sanearCss('') === '')
check('regla simple pasa',
  sanearCss('.titulo { color: red }').includes('color: red'))
check('url() se descarta', !sanearCss('.a { background: url(evil) }').includes('url'))
check('@import se descarta', !sanearCss('@import "x"; .a { color: red }').includes('@import'))
check('selector global se descarta', sanearCss('* { color: red }') === '')
check('pseudo-clase se descarta', sanearCss('a:hover { color: red }') === '')
// Escape CSS: `u\72l(` es `url(` para el navegador.
check('url() con escape se descarta',
  sanearCss('.a { background: u\\72l(https://x.example/a) }') === '')
check('image-set se descarta',
  sanearCss('.a { background-image: image-set("https://x.example/a" 1x) }') === '')
check('comentario se descarta',
  sanearCss('.a { background: ur/**/l(https://x.example/a) }') === '')
check('regla legítima sigue pasando',
  sanearCss('.titulo { color: #123456; font-weight: 700 }') === '.titulo { color: #123456; font-weight: 700 }')

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)