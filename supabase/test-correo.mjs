// Arnés de prueba: simula ContentService / GmailApp para ejecutar el .gs en
// Node y comprobar qué devuelve realmente, sin desplegar nada.
import { readFileSync } from 'node:fs'

const src = readFileSync('apps-script/Notificador.gs', 'utf8')

const salida = { valor: '', mime: '' }
globalThis.ContentService = {
  MimeType: { JSON: 'JSON', JAVASCRIPT: 'JS' },
  createTextOutput: (t) => {
    const envoltura = {
      getContent: () => t,
      getMimeType: () => salida.mime,
      setMimeType: (m) => { salida.mime = m; return envoltura },
    }
    return envoltura
  },
}
const enviados = []
let remitenteRechazado = false
globalThis.GmailApp = {
  sendEmail: (para, asunto, texto, opts) => {
    // Simula el rechazo de Gmail cuando 'from' no es un alias válido.
    if (opts && opts.from && remitenteRechazado) {
      const err = new Error('Argumento no válido: ' + opts.from)
      throw err
    }
    enviados.push({ para, asunto, tieneHtml: !!opts.htmlBody, from: opts && opts.from })
  },
}

const fn = new Function(src + '\nreturn { responderCon: responderCon, responder: responder, asuntoDe: asuntoDe, destinatarios: destinatarios, cuerpoHtml: cuerpoHtml, remitenteParecenValido: remitenteParecenValido };')
const M = fn()

let ok = 0, fallos = 0
const check = (nombre, cond, extra = '') => {
  if (cond) { ok++; console.log('  OK   ' + nombre) }
  else { fallos++; console.log('  FALLA ' + nombre + (extra ? ' -> ' + extra : '')) }
}

const textoDe = (res) => {
  if (typeof res.getContent === 'function') return res.getContent()
  return res._value
}

// 1. Con reqid: debe devolver la llamada JS exacta.
const r1 = M.responder({ parameter: { reqid: 'r42', payload: JSON.stringify({ tipo: 'ping' }) } })
const t1 = textoDe(r1)
check('con reqid llama a __appsCorreoRespuesta', t1.includes('window.__appsCorreoRespuesta('), t1)
check('con reqid incluye el reqid', t1.includes('"r42"'), t1)
check('con reqid usa MimeType JAVASCRIPT', r1.getMimeType && r1.getMimeType() === 'JS')
check('el texto es JavaScript válido', (() => { try { new Function(t1); return true } catch { return false } })(), t1)

// 2. Sin reqid: JSON legible para prueba manual.
const r2 = M.responder({ parameter: { payload: JSON.stringify({ tipo: 'ping' }) } })
const t2 = textoDe(r2)
check('sin reqid devuelve JSON', t2.trim().startsWith('{') && JSON.parse(t2).ok === true, t2)

// 3. Sin destinatarios: error, nunca éxito falso.
const r3 = M.responder({ parameter: { reqid: 'r7', payload: JSON.stringify({ tipo: 'recurso-nuevo', alumnos: [] }) } })
check('sin destinatarios devuelve ok:false', textoDe(r3).includes('"ok":false'), textoDe(r3))

// 4. Envío real simulado + deduplicado.
const payload = JSON.stringify({
  tipo: 'recurso-nuevo',
  curso: { titulo: 'Curso Prueba', url: 'https://ejemplo.com/modulo/9#r-3' },
  recurso: { titulo: 'Material 1', descripcion: 'Descripción' },
  alumnos: [{ email: 'A@X.com' }, { email: 'a@x.com' }, { email: 'b@x.com' }],
})
const r4 = M.responder({ parameter: { reqid: 'r9', payload } })
check('envía sin repetir destinatarios', enviados.length === 2, JSON.stringify(enviados))
check('deduplica ignorando mayúsculas', enviados[0] && enviados[0].para === 'a@x.com')
check('confirma con la cantidad real', textoDe(r4).includes('"enviados":2'), textoDe(r4))
check('el HTML trae el botón al material', M.cuerpoHtml(JSON.parse(payload)).includes('Ir al material'))
check('el HTML escapa el asunto', M.cuerpoHtml({ tipo: 'x', cuerpoHtml: '<b>a</b>' }).includes('<b>a</b>'))
// 7. Remitente inválido: debe reintentar SIN 'from' y salir igual.
enviados.length = 0
remitenteRechazado = true
const r7 = M.responder({ parameter: { reqid: 'r12', payload: JSON.stringify({ tipo: 'recurso-nuevo', alumnos: [{ email: 'x@y.com' }] }) } })
check('con remitente rechazado igual envía', enviados.length === 1, JSON.stringify(enviados))
check('el reintento va sin "from"', enviados[0] && !enviados[0].from, JSON.stringify(enviados[0]))
check('con remitente rechazado confirma ok', textoDe(r7).includes('"ok":true'), textoDe(r7))
remitenteRechazado = false

// 8. Detecta el typo "neuronal.plusO@gmail.com" sin llamar a Gmail.
enviados.length = 0
check('detecta remitente sin arroba', !M.remitenteParecenValido('Dr. X <neuronal.plusO@gmail.com>'))
check('detecta remitente sin arroba en texto', !M.remitenteParecenValido('TU_CORREO'))
check('acepta un remitente correcto', M.remitenteParecenValido('Dr. X <neuronal.plus@gmail.com>'))
check('no llama a Gmail con remitente inválido', enviados.length === 0)
check('el envío con remitente válido usa "from"', (() => {
  enviados.length = 0
  M.responder({ parameter: { reqid: 'r13', payload: JSON.stringify({ tipo: 'recurso-nuevo', alumnos: [{ email: 'z@y.com' }] }) } })
  return enviados[0] && enviados[0].from === 'Dr. Ernesto Cotonieto <neuronal.plus@gmail.com>'
})(), JSON.stringify(enviados))

console.log('\n  ' + ok + ' pruebas OK / ' + fallos + ' fallos\n')
process.exit(fallos ? 1 : 0)

// 5. Payload corrupto: no debe reventar.
const r5 = M.responder({ parameter: { reqid: 'r11', payload: '{roto' } })
check('payload corrupto devuelve error controlado', textoDe(r5).includes('"ok":false'), textoDe(r5))

// 6. Sin reqid ni payload.
const r6 = M.responder({})
check('llamada vacía no revienta', textoDe(r6).length > 0)

console.log('\n  ' + ok + ' pruebas OK / ' + fallos + ' fallos\n')
process.exit(fallos ? 1 : 0)