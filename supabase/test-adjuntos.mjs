/**
 * Pruebas del manejo de rutas de adjuntos.
 *
 * Importa porque el bucket pasa de público a privado SIN migrar la
 * base: los mensajes antiguos guardan la dirección pública completa y
 * los nuevos guardan la ruta. Si extraer la ruta falla en alguno de
 * los dos casos, esos adjuntos dejan de verse — y no hay forma de
 * notarlo salvo que alguien abra una conversación vieja y se queje.
 *
 * Uso: node supabase/test-adjuntos.mjs
 */
const { rutaDeAdjunto, VIGENCIA_SEGUNDOS } =
  await import('../src/lib/adjuntos.js')

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

const BASE = 'https://ohhdnaewtjfqszxemrju.supabase.co/storage/v1/object/public/chat_adjuntos/'
const UID = '12cde78d-daca-4f84-b2aa-7ba0ded8c9be'

console.log('\n=== LO NUEVO: LA RUTA TAL CUAL ===')
check('una ruta normal pasa sin tocarse',
  rutaDeAdjunto(`${UID}/1759899_informe.pdf`) === `${UID}/1759899_informe.pdf`)
check('quita la barra inicial si la trae',
  rutaDeAdjunto('/carpeta/archivo.pdf') === 'carpeta/archivo.pdf')
check('recorta los espacios', rutaDeAdjunto('  a/b.pdf  ') === 'a/b.pdf')

console.log('\n=== LO ANTIGUO: LA DIRECCIÓN COMPLETA ===')
check('saca la ruta de una dirección pública',
  rutaDeAdjunto(`${BASE}${UID}/1759899_informe.pdf`) === `${UID}/1759899_informe.pdf`)
check('también de una ya firmada, quitando el token',
  rutaDeAdjunto(`${BASE}${UID}/x.pdf?token=abc.def.ghi`) === `${UID}/x.pdf`)
check('descodifica los espacios del nombre',
  rutaDeAdjunto(`${BASE}${UID}/mi%20informe.pdf`) === `${UID}/mi informe.pdf`)
check('descodifica los acentos',
  rutaDeAdjunto(`${BASE}${UID}/evaluaci%C3%B3n.pdf`) === `${UID}/evaluación.pdf`)

console.log('\n=== CASOS QUE PODRÍAN ENGAÑAR ===')
{
  // Un archivo que se llama como el bucket: hay que cortar por
  // `/chat_adjuntos/` y no por el nombre suelto.
  const r = rutaDeAdjunto(`${BASE}${UID}/chat_adjuntos.pdf`)
  check('un archivo llamado como el bucket no confunde',
    r === `${UID}/chat_adjuntos.pdf`, String(r))
}
{
  // Una carpeta que se llama como el bucket, dentro de la ruta.
  const r = rutaDeAdjunto(`${BASE}${UID}/chat_adjuntos/x.pdf`)
  check('una carpeta con ese nombre tampoco',
    r === `${UID}/chat_adjuntos/x.pdf`, String(r))
}
check('un porcentaje suelto no hace estallar nada',
  rutaDeAdjunto(`${BASE}${UID}/100%descuento.pdf`) === `${UID}/100%descuento.pdf`)
check('una dirección de OTRO bucket no se acepta',
  rutaDeAdjunto('https://x.supabase.co/storage/v1/object/public/avatares/a.png') === null)
check('una dirección cualquiera tampoco',
  rutaDeAdjunto('https://ejemplo.com/archivo.pdf') === null)

console.log('\n=== NADA DE DEVOLVER MEDIAS TINTAS ===')
check('vacío devuelve null', rutaDeAdjunto('') === null)
check('nulo devuelve null', rutaDeAdjunto(null) === null)
check('indefinido devuelve null', rutaDeAdjunto(undefined) === null)
check('solo espacios devuelve null', rutaDeAdjunto('   ') === null)

console.log('\n=== OTRO BUCKET, SI SE LE PIDE ===')
check('se puede usar con otro bucket',
  rutaDeAdjunto('https://x.supabase.co/storage/v1/object/public/avatares/a.png', 'avatares')
    === 'a.png')

console.log('\n=== VIGENCIA ===')
check('la firma dura algo razonable',
  VIGENCIA_SEGUNDOS >= 60 && VIGENCIA_SEGUNDOS <= 3600, String(VIGENCIA_SEGUNDOS))

console.log('\n' + '─'.repeat(56))
console.log(`  ${ok} pruebas OK / ${fallos.length} fallos`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length ? 1 : 0)
