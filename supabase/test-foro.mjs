/**
 * Pruebas del sanitizador del foro.
 *
 * Es la pieza más importante de seguridad: cualquiera con cuenta escribe
 * aquí, y lo que se guarda se vuelve a pintar con dangerouslySetInnerHTML.
 * Si `sanear` deja pasar algo, es un XSS esperando a que alguien lo use.
 *
 * Para esto hace falta un DOM real, así que se usa jsdom (ya está como
 * dependencia de las pruebas de render).
 *
 * Uso: node supabase/test-foro.mjs
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.DOMParser = dom.window.DOMParser

const { sanear, aTextoPlano, resumen, esTextoPlano } = await import('../src/lib/foro.js')

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

console.log('\n=== SCRIPT Y EVENTOS (lo que de verdad importa) ===')
check('elimina <script>', !/<script/i.test(sanear('<p>hola</p><script>alert(1)</script>')))
check('elimina el contenido del script', !sanear('<script>alert(1)</script>').includes('alert'))
check('elimina onerror', !/onerror/i.test(sanear('<img src=x onerror=alert(1)>')))
check('elimina onclick', !/onclick/i.test(sanear('<p onclick="alert(1)">x</p>')))
check('elimina onload en svg', !/onload/i.test(sanear('<svg onload=alert(1)></svg>')))
check('conserva el texto útil tras quitar la etiqueta',
  sanear('<p>hola</p><script>alert(1)</script>').includes('hola'))

console.log('\n=== ETIQUETAS PELIGROSAS ===')
check('elimina <iframe>', !/<iframe/i.test(sanear('<iframe src="https://malo"></iframe>')))
check('elimina <object>', !/<object/i.test(sanear('<object data="x"></object>')))
check('elimina <embed>', !/<embed/i.test(sanear('<embed src="x">')))
check('elimina <style>', !/<style/i.test(sanear('<style>body{display:none}</style>')))
check('elimina <form>', !/<form/i.test(sanear('<form action="x"><input></form>')))
check('elimina <meta>', !/<meta/i.test(sanear('<meta http-equiv="refresh">')))
check('elimina <base>', !/<base/i.test(sanear('<base href="https://malo">')))

console.log('\n=== ENLACES ===')
check('quita javascript: en href',
  !/javascript/i.test(sanear('<a href="javascript:alert(1)">x</a>')))
check('quita data: en href',
  !/data:/i.test(sanear('<a href="data:text/html,<script>1</script>">x</a>')))
check('conserva https', sanear('<a href="https://ejemplo.com">x</a>').includes('https://ejemplo.com'))
check('conserva mailto', sanear('<a href="mailto:a@b.com">x</a>').includes('mailto:a@b.com'))
check('fuerza rel=noopener en enlaces externos',
  /noopener/.test(sanear('<a href="https://x.com">y</a>')))
check('fuerza target=_blank',
  /_blank/.test(sanear('<a href="https://x.com">y</a>')))

console.log('\n=== FORMATO QUE SÍ DEBE PASAR ===')
check('conserva <b> y <strong>', /<(b|strong)>/i.test(sanear('<b>x</b>')))
check('conserva <em>', /<em>/i.test(sanear('<em>x</em>')))
check('conserva listas', /<ul>/i.test(sanear('<ul><li>x</li></ul>')))
check('conserva blockquote', /<blockquote>/i.test(sanear('<blockquote>x</blockquote>')))
check('conserva encabezados', /<h3>/i.test(sanear('<h3>x</h3>')))
check('conserva saltos de línea', /<br>/i.test(sanear('a<br>b')))
check('NO conserva style (el lector decide el formato)',
  !/style=/i.test(sanear('<p style="color:red">x</p>')))

console.log('\n=== TEXTO PLANO Y RESUMEN ===')
check('aTextoPlano quita etiquetas', aTextoPlano('<p>hola <b>mundo</b></p>') === 'hola mundo')
check('aTextoPlano normaliza espacios',
  aTextoPlano('<p>hola</p>\n\n<p>mundo</p>') === 'hola mundo')
check('resumen recorta con puntos suspensivos',
  resumen('a'.repeat(300), 100).endsWith('…'))
check('resumen no alarga textos cortos', resumen('corto', 100) === 'corto')
check('esTextoPlano distingue', esTextoPlano('sin formato') === true)
check('esTextoPlano detecta html', esTextoPlano('<p>con</p>') === false)

console.log('\n=== CASOS LIMITE ===')
check('texto vacío no truena', sanear('') === '')
check('null no truena', sanear(null) === '')
check('html roto no truena', typeof sanear('<p><b>sin cerrar') === 'string')
check('solo script queda vacío', sanear('<script>x</script>').trim() === '')

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)