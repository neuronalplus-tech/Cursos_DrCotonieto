/* ============================================================
   WHATSAPP: NÚMEROS, ENLACES Y PLANTILLAS

   POR QUÉ EXISTE ESTE MÓDULO
   Un número tecleado por una persona llega como llegue: «771 123
   4567», «+52 771-123-4567», «044 7711234567», con paréntesis o con
   el 52 ya puesto. WhatsApp, en cambio, solo acepta UNA forma:
   dígitos, con código de país, sin + ni espacios. Si eso se arregla
   a mano en cada pantalla, cada pantalla lo arregla distinto y la
   mitad de los enlaces abre un chat vacío con un número inventado.

   Aquí se normaliza una sola vez, y las dos vías de envío (el enlace
   wa.me y el Cloud API) usan el mismo resultado.
   ============================================================ */

/** Código de país que se asume cuando el número viene sin él. México. */
export const LADA_POR_DEFECTO = '52'

/**
 * Deja un número en la forma que WhatsApp entiende: solo dígitos,
 * con código de país. Devuelve null si lo que hay no puede ser un
 * teléfono — mejor ningún enlace que un enlace a un número de otro.
 *
 * El «1» que México usaba para celulares (52 1 55…) se conserva si
 * viene, porque WhatsApp lo sigue aceptando y hay cuentas antiguas
 * registradas así.
 */
export function normalizarTelefono(crudo, lada = LADA_POR_DEFECTO) {
  if (!crudo) return null
  let d = String(crudo).replace(/\D/g, '')
  if (!d) return null

  // «044» y «045» eran los prefijos para marcar a celular dentro de
  // México. Siguen apareciendo en listas viejas y no son parte del
  // número.
  if (d.startsWith('044') || d.startsWith('045')) d = d.slice(3)
  // Un 00 inicial es el prefijo internacional escrito a la europea.
  if (d.startsWith('00')) d = d.slice(2)

  // Diez dígitos es un número nacional: le falta el país.
  if (d.length === 10) d = lada + d
  // Once dígitos empezando en 1 es el celular mexicano con su 1.
  else if (d.length === 11 && d.startsWith('1')) d = lada + d

  // Menos de 11 dígitos ya con país no es un número marcable; más de
  // 15 se sale del estándar E.164.
  if (d.length < 11 || d.length > 15) return null
  return d
}

/** Cómo se ve un número ya normalizado, para leerlo en pantalla. */
export function mostrarTelefono(numero) {
  const d = normalizarTelefono(numero)
  if (!d) return String(numero || '')
  const nacional = d.length > 10 ? d.slice(-10) : d
  const pais = d.slice(0, d.length - nacional.length)
  return `+${pais} ${nacional.slice(0, 3)} ${nacional.slice(3, 6)} ${nacional.slice(6)}`
}

/**
 * Enlace de «clic para chatear». Abre WhatsApp (Web o la app del
 * celular) con el mensaje ya escrito; el envío lo da quien abre.
 */
export function enlaceWhatsApp(numero, texto) {
  const d = normalizarTelefono(numero)
  if (!d) return null
  return `https://wa.me/${d}?text=${encodeURIComponent(texto || '')}`
}

/* Los marcadores que se pueden usar en una plantilla. Se declaran
   aquí y no en la pantalla para que la ayuda que ve el admin y lo
   que de verdad se sustituye no se separen nunca. */
export const MARCADORES = [
  ['{{nombre}}', 'Nombre completo de la persona'],
  ['{{primer_nombre}}', 'Solo su primer nombre'],
  ['{{curso}}', 'Nombre del curso o taller elegido arriba'],
]

/**
 * Sustituye los marcadores de una plantilla con los datos de una
 * persona. Un marcador sin dato se queda vacío en vez de dejar el
 * «{{nombre}}» crudo a la vista.
 */
export function aplicarPlantilla(texto, datos = {}) {
  const nombre = (datos.nombre || '').trim()
  const valores = {
    '{{nombre}}': nombre,
    '{{primer_nombre}}': nombre.split(/\s+/)[0] || '',
    '{{curso}}': (datos.curso || '').trim(),
  }
  return String(texto || '').replace(/\{\{\s*\w+\s*\}\}/g, (m) => {
    const clave = '{{' + m.replace(/[{}\s]/g, '') + '}}'
    return clave in valores ? valores[clave] : ''
  })
}
