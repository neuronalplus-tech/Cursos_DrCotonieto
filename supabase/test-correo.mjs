// Arnés de prueba: simula ContentService / GmailApp / Session para ejecutar el
// .gs en Node y comprobar qué devuelve de verdad, sin desplegar nada.
import { readFileSync } from 'node:fs'

const src = readFileSync('apps-script/Notificador.gs', 'utf8')

const salida = { mime: '' }
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
    if (opts && opts.from && remitenteRechazado) {
      throw new Error('Argumento no válido: ' + opts.from)
    }
    enviados.push({ para, asunto, tieneHtml: !!opts.htmlBody, from: opts && opts.from })
  },
}
globalThis.Session = { getActiveUser: () => ({ getEmail: () => 'neuronal.plus@gmail.com' }) }
globalThis.HtmlService = { createHtmlOutput: (h) => ({ getContent: () => h }) }
globalThis.Logger = { log: () => {} }

/** Carga el script, opcionalmente con otro valor de CONFIG.remitente. */
function cargar(remitente) {
  const codigo = remitente === undefined
    ? src
    : src.replace("remitente: '',", "remitente: '" + remitente + "',")
  const fn = new Function(codigo + '\nreturn { responder: responder, responderCon: responderCon, ' +
    'asuntoDe: asuntoDe, destinatarios: destinatarios, cuerpoHtml: cuerpoHtml, ' +
    'normalizarContenido: normalizarContenido, contenidoPorDefecto: contenidoPorDefecto, ' +
    'plantilla: plantilla, MARCA: MARCA, testPlantilla: testPlantilla, ' +
    'remitenteParecenValido: remitenteParecenValido, cuentaActual: cuentaActual, CONFIG: CONFIG };')
  return fn()
}

const M = cargar()

let ok = 0, fallos = 0
const check = (nombre, cond, extra = '') => {
  if (cond) { ok++; console.log('  OK   ' + nombre) }
  else { fallos++; console.log('  FALLA ' + nombre + (extra ? ' -> ' + extra : '')) }
}

const textoDe = (res) => {
  if (typeof res.getContent === 'function') return res.getContent()
  return res._value
}

// El ping sin reqid devuelve JSON plano, mucho más fácil de parsear.
const ping = () => JSON.parse(textoDe(M.responder({ parameter: { payload: JSON.stringify({ tipo: 'ping' }) } })))

const enviar = (mod, alumnos, reqid = 'r') => {
  enviados.length = 0
  const res = mod.responder({ parameter: { reqid, payload: JSON.stringify({ tipo: 'recurso-nuevo', alumnos }) } })
  return { res, enviados: enviados.slice() }
}
/* ------------------------------ Protocolo ------------------------------ */

const r1 = M.responder({ parameter: { reqid: 'r42', payload: JSON.stringify({ tipo: 'ping' }) } })
const t1 = textoDe(r1)
check('con reqid llama a __appsCorreoRespuesta', t1.includes('window.__appsCorreoRespuesta('), t1)
check('con reqid incluye el reqid', t1.includes('"r42"'), t1)
check('con reqid usa MimeType JAVASCRIPT', r1.getMimeType() === 'JS', r1.getMimeType())
check('el texto es JavaScript válido', (() => { try { new Function(t1); return true } catch { return false } })(), t1)

const r2 = M.responder({ parameter: { payload: JSON.stringify({ tipo: 'ping' }) } })
check('sin reqid devuelve JSON', textoDe(r2).trim().startsWith('{') && JSON.parse(textoDe(r2)).ok === true, textoDe(r2))

/* ------------------------- Diagnóstico del ping ------------------------ */

const info = ping()
check('el ping informa la versión', !!info.version && info.version.length > 0, JSON.stringify(info))
check('el ping informa la cuenta que envía', info.cuentaQueEnvia === 'neuronal.plus@gmail.com', JSON.stringify(info))
check('el ping informa el remitente configurado', 'remitenteEnElScript' in info, JSON.stringify(info))

/* ---------------------------- Destinatarios ---------------------------- */

const r3 = M.responder({ parameter: { reqid: 'r7', payload: JSON.stringify({ tipo: 'recurso-nuevo', alumnos: [] }) } })
check('sin destinatarios devuelve ok:false', textoDe(r3).includes('"ok":false'), textoDe(r3))

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
check('el HTML escapa el cuerpo', M.cuerpoHtml({ tipo: 'comunicado-masivo', cuerpoHtml: '<b>a</b>' }).includes('&lt;b&gt;'))

const r5 = M.responder({ parameter: { reqid: 'r11', payload: '{roto' } })
check('payload corrupto devuelve error controlado', textoDe(r5).includes('"ok":false'), textoDe(r5))
const r6 = M.responder({})
check('llamada vacía no revienta', textoDe(r6).length > 0)

/* ------------------------------ Remitente ------------------------------ */

// Por defecto NO se manda "from": es lo que hace que el envío sea fiable.
check('CONFIG.remitente viene vacío por defecto', M.CONFIG.remitente === '', M.CONFIG.remitente)
const porDefecto = enviar(M, [{ email: 'a@b.com' }])
check('sin remitente configurado envía igual', porDefecto.enviados.length === 1, JSON.stringify(porDefecto.enviados))
check('sin remitente configurado no manda "from"', porDefecto.enviados[0] && !porDefecto.enviados[0].from)
check('sin remitente configurado confirma ok', textoDe(porDefecto.res).includes('"ok":true'))

// Si alguien configura un remitente MAL, el envío no debe perderse.
const conAlias = cargar('Dr. X <neuronal.plusO@gmail.com>')
remitenteRechazado = true
const reintento = enviar(conAlias, [{ email: 'a@b.com' }])
check('con remitente inválido reintenta sin "from"', reintento.enviados.length === 1 && !reintento.enviados[0].from, JSON.stringify(reintento.enviados))
check('con remitente inválido confirma ok', textoDe(reintento.res).includes('"ok":true'), textoDe(reintento.res))

remitenteRechazado = false

// Con un alias bien escrito sí lo usa.
const conAliasOk = cargar('Dr. X <neuronal.plus@gmail.com>')
const conFrom = enviar(conAliasOk, [{ email: 'a@b.com' }])
check('con alias válido usa "from"', conFrom.enviados[0] && conFrom.enviados[0].from === 'Dr. X <neuronal.plus@gmail.com>', JSON.stringify(conFrom.enviados))
check('con alias válido confirma ok', textoDe(conFrom.res).includes('"ok":true'), textoDe(conFrom.res))

// Detección de typos.
check('detecta la "O" en vez de arroba', !M.remitenteParecenValido('Dr. X <neuronal.plusO@gmail.com>'))
check('detecta texto sin correo', !M.remitenteParecenValido('TU_CORREO'))
check('acepta un remitente correcto', M.remitenteParecenValido('Dr. X <neuronal.plus@gmail.com>'))

console.log('\n  ' + ok + ' pruebas OK / ' + fallos + ' fallos\n')
/* ---------------------------- Plantilla de marca ------------------------- */

const K = M.MARCA.colores
const c = {
  antetitulo: 'COMUNICADO · CURSO',
  titulo: 'Título de prueba',
  bajada: 'Línea de apertura.',
  parrafos: ['Uno', 'Dos'],
  botones: [{ texto: 'Ir al material', url: 'https://ejemplo.com/a' }],
  pie: 'Pie de prueba.',
}
const html = M.plantilla(c)

check('usa tablas (Gmail no renderiza flex)', html.includes('<table'), html.slice(0, 80))
check('aplica el fondo crema', html.includes(K.crema))
check('aplica el color pizarra', html.includes(K.pizarra))
check('aplica el acento terracota', html.includes(K.terracota))
check('lleva la firma de la marca', html.includes(M.MARCA.nombre) && html.includes(M.MARCA.cargo))
check('lleva el contacto de la marca', html.includes('@dr.cotonieto'))
check('incluye el antetítulo', html.includes('COMUNICADO · CURSO'))
check('incluye el título', html.includes('Título de prueba'))
check('incluye la bajada', html.includes('Línea de apertura.'))
check('incluye todos los párrafos', html.includes('Uno') && html.includes('Dos'))
check('incluye el pie', html.includes('Pie de prueba.'))
check('dibuja el botón con su enlace', html.includes('href="https://ejemplo.com/a"') && html.includes('Ir al material'))

// Escape: el contenido del usuario NUNCA puede inyectar HTML.
const mala = M.plantilla({
  titulo: '<script>alert(1)</script>',
  parrafos: ['<img src=x onerror=alert(2)>', 'Tom & Jerry'],
  botones: [{ texto: 'x', url: 'https://ok.com/" onmouseover="alert(3)' }],
  pie: '',
})
check('escapa <script> del título', !mala.includes('<script>') && mala.includes('&lt;script&gt;'))
check('escapa <img onerror> de los párrafos', !mala.includes('<img'))
check('escapa comillas en la URL del botón', !mala.includes('onmouseover="alert(3)'))
check('convierte & en &amp;', mala.includes('Tom &amp; Jerry'), mala.slice(0, 200))

// normalizarContenido
check('descarta botones sin texto o sin URL', (() => {
  const n = M.normalizarContenido({ botones: [{ texto: '', url: 'https://a.com' }, { texto: 'x', url: '' }], parrafos: ['p'] })
  return n.botones.length === 0
})())
check('acepta botones con label/href', (() => {
  const n = M.normalizarContenido({ botones: [{ label: 'A', href: 'https://a.com' }] })
  return n.botones.length === 1 && n.botones[0].texto === 'A'
})())
check('ignora párrafos vacíos', (() => {
  const n = M.normalizarContenido({ parrafos: ['  ', 'real', ''] })
  return n.parrafos.length === 1 && n.parrafos[0] === 'real'
})())
check('devuelve null si no hay nada', M.normalizarContenido({}) === null)
check('devuelve null si no viene contenido', M.normalizarContenido(null) === null)

// Contenido por defecto según el tipo.
const defRecurso = M.contenidoPorDefecto({
  tipo: 'recurso-nuevo',
  curso: { titulo: 'C', url: 'https://x.com/m' },
  recurso: { titulo: 'Material 1', descripcion: 'Desc' },
})
check('recurso-nuevo: antetítulo correcto', defRecurso.antetitulo === 'NUEVO MATERIAL')
check('recurso-nuevo: pone botón con el link', defRecurso.botones[0].url === 'https://x.com/m')
check('recurso-nuevo: el botón se llama "Ir al material"', defRecurso.botones[0].texto === 'Ir al material')

const defModulo = M.contenidoPorDefecto({ tipo: 'modulo-abierto', modulo: { titulo: 'M1' }, curso: { titulo: 'C', url: 'https://x.com' } })
check('modulo-abierto: antetítulo correcto', defModulo.antetitulo === 'NUEVO MÓDULO')

const defComunicado = M.contenidoPorDefecto({ tipo: 'comunicado-masivo', asunto: 'Aviso', cuerpoTexto: 'Uno\n\nDos\nTres', curso: { titulo: 'Curso X' } })
check('comunicado: separa párrafos por línea en blanco', defComunicado.parrafos.length === 2, JSON.stringify(defComunicado.parrafos))
check('comunicado: une las líneas sueltas', defComunicado.parrafos[1] === 'Dos Tres', JSON.stringify(defComunicado.parrafos))
check('comunicado: el antetítulo lleva el curso', defComunicado.antetitulo === 'COMUNICADO · CURSO X')

// cuerpoHtml usa el contenido de la web si viene.
check('cuerpoHtml respeta el contenido de la web', M.cuerpoHtml({ tipo: 'comunicado-masivo', contenido: { titulo: 'MI TITULO', parrafos: ['MI PARRAFO'] } }).includes('MI TITULO'))
check('cuerpoHtml cae al default si no hay contenido', M.cuerpoHtml({ tipo: 'recurso-nuevo', recurso: { titulo: 'Fallback' } }).includes('Fallback'))

// La vista previa se genera sin romperse.
const previa = M.testPlantilla().getContent()
check('testPlantilla genera HTML con la marca', previa.includes('CURSO DE PRUEBA'), previa.slice(0, 160))
check('testPlantilla trae la firma', previa.includes('@dr.cotonieto'))

console.log('\n  ' + ok + ' pruebas OK / ' + fallos + ' fallos\n')
process.exit(fallos ? 1 : 0)