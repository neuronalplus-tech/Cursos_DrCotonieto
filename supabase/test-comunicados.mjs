/**
 * Pruebas de comunicados: historial y programado (F5-1).
 *
 * Aquí se decide qué queda registrado de cada envío. Equivocarse
 * no rompe el envío: deja un historial que miente (destino mal
 * descrito) o un programado que nunca avisa.
 *
 * Funciones puras, sin base ni navegador.
 *
 * Uso: node supabase/test-comunicados.mjs
 */
const {
  etiquetaDestino, filaHistorial, programadosVencidos,
} = await import('../src/lib/comunicados.js')

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

console.log('\n=== ETIQUETA DE DESTINO ===')
check('todos por omisión',
  etiquetaDestino({ destino: 'todos' }) === 'Todos con acceso')
check('curso con título',
  etiquetaDestino({ destino: 'curso', destino_detalle: { curso_titulo: 'Duelo' } }) === 'Curso: Duelo')
check('tanda con número',
  etiquetaDestino({ destino: 'tanda', destino_detalle: { tanda: 3 } }) === 'Tanda 3')
check('manual',
  etiquetaDestino({ destino: 'manual' }) === 'Lista manual')
check('riesgo',
  etiquetaDestino({ destino: 'riesgo' }) === 'En riesgo (+15 días)')
check('sin dato no truena',
  etiquetaDestino(null) === 'Todos con acceso')

console.log('\n=== FILA DE HISTORIAL ===')
{
  const f = filaHistorial({
    organizacionId: 1, canal: 'correo', asunto: ' Hola ',
    cuerpo: '<p>Hola</p>', destino: 'tanda',
    detalle: { tanda: 2 }, total: 50, estado: 'enviado',
    email: 'admin@ejemplo.com',
  })
  check('recorta el asunto', f.asunto === 'Hola', f.asunto)
  check('marca enviado_en al enviar', !!f.enviado_en, String(f.enviado_en))
  check('guarda el total', f.total === 50, String(f.total))
  check('guarda el criterio, no los correos',
    f.destino_detalle?.tanda === 2 && !f.destino_detalle?.correos)
}
{
  const p = filaHistorial({
    organizacionId: 1, asunto: 'Recordatorio', destino: 'todos',
    total: 120, estado: 'programado',
    programadoPara: new Date(Date.now() + 86400000).toISOString(),
  })
  check('programado no marca enviado_en', p.enviado_en === null)
  check('programado guarda la fecha', !!p.programado_para)
}

console.log('\n=== PROGRAMADOS VENCIDOS ===')
{
  const filas = [
    { id: 1, estado: 'programado', programado_para: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, estado: 'programado', programado_para: new Date(Date.now() + 86400000).toISOString() },
    { id: 3, estado: 'enviado', programado_para: new Date(Date.now() - 3600000).toISOString() },
  ]
  const v = programadosVencidos(filas)
  check('solo el vencido pendiente', v.length === 1 && v[0].id === 1,
    v.map((x) => x.id).join())
  check('lista nula no truena', programadosVencidos(null).length === 0)
}

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)