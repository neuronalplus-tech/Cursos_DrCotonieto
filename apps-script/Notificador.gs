/**
 * ============================================================================
 *  NOTIFICADOR POR CORREO — Google Apps Script  (Dr. Ernesto Cotonieto)
 * ============================================================================
 *
 *  CÓMO USARLO
 *  1. script.google.com → abre ESTE proyecto → sustituye todo Codigo.gs por
 *     el contenido de este archivo (Ctrl+A, Ctrl+V en el editor).
 *  2. Implementar → Añadir implementación → Aplicación web:
 *       - Ejecutar como:           Yo (tu cuenta)
 *       - Quién tiene acceso:      Cualquier persona        ← IMPRESCINDIBLE
 *  3. Copia la URL /exec a src/config.js → APPS_SCRIPT_URL.
 *
 *  CÓMO DEVUELVE EL RESULTADO A LA WEB (leído con un deployment real)
 *  Desde el navegador no hay CORS, así que la web inyecta esto como <script>
 *  y solo puede ejecutar JavaScript. Por eso el script devuelve él mismo la
 *  llamada, usando el `reqid` que le manda la web:
 *
 *      window.__appsCorreoRespuesta("r123...", {"ok":true, ...});
 *
 *  Se descartó usar el parámetro `callback` de Google porque, comprobado
 *  contra un deployment real, NO envuelve la salida: la respuesta llegaba
 *  intacta, el callback nunca se llamaba y todos los envíos terminaban en
 *  tiempo de espera aunque el correo sí se hubiera enviado.
 *
 *  Sin `reqid` (prueba manual en el navegador) devuelve JSON legible.
 * ============================================================================
 */

const VERSION = '2026-10-03.v5-plantilla-marca';

const CONFIG = {
  // VACÍO A PROPÓSITO, y no es descuido.
  //
  // Sin `from`, Gmail envía desde la cuenta que ejecuta el script, que
  // siempre es una dirección válida. En cambio, poner aquí un remitente
  // SOLO funciona si es un alias real de esa misma cuenta: si no lo es,
  // Gmail responde "Argumento no válido" y el envío se pierde entero.
  // Un nombre bonito no compensa arriesgar que no salga ningún correo.
  //
  // Si algún día lo quieres: crea antes el alias en
  // Configuración de Gmail → Cuentas → Enviar correo como, y pon aquí
  // 'Nombre <ese-alias@gmail.com>'.
  remitente: '',
  replyTo: 'neuronal.plus@gmail.com',
  linkPortal: 'https://cursos-drcotonieto.neuronal-plus.workers.dev',
};

/**
 * ════════════════════════════════════════════════════════════════════════
 *  MARCA — plantilla base de los correos
 * ════════════════════════════════════════════════════════════════════════
 *  Solo se edita el CONTENIDO: el envoltorio con la marca vive aquí y no se
 *  toca nunca. Desde la web se envía:
 *
 *      contenido: {
 *        antetitulo: 'NUEVO MATERIAL',        // opcional, sale en versalitas
 *        titulo:     'Título del correo',
 *        bajada:     'Una línea de apertura',  // opcional
 *        parrafos:   ['Texto 1', 'Texto 2'],
 *        botones:    [{ texto: 'Ir al material', url: 'https://...' }],
 *        pie:        'Texto pequeño del pie'   // opcional
 *      }
 *
 *  Si no viene `contenido`, el script lo arma según el tipo de envío.
 *  El HTML usa <table> y estilos en línea porque Gmail no soporta flex/grid.
 *  Para cambiar colores o textos fijos de la marca, edita SOLO este bloque.
 */
const MARCA = {
  colores: {
    crema:     '#FAFAF8',
    pizarra:   '#1B3A4B',
    terracota: '#C17A5E',
    gris:      '#8A9BAD',
    borde:     '#E7E7E2',
  },
  nombre:   'Dr. Ernesto Cotonieto',
  cargo:    'Psicología especializada basada en evidencia',
  contacto: '@dr.cotonieto · fb.com/dr.cotonieto · 56 3784 1931',
  sitio:    'https://cursos-drcotonieto.neuronal-plus.workers.dev',
  ancho:    560,
};

function doPost(e) {
  return responder(e);
}

/** También acepta GET, para poder probar desde el navegador sin la web. */
function doGet(e) {
  return responder(e);
}

function responder(e) {
  var reqid = (e && e.parameter && e.parameter.reqid) || '';
  try {
    var crudo = (e && e.parameter && e.parameter.payload) || '{}';
    var datos = JSON.parse(crudo);
    var tipo = datos.tipo;

    if (tipo === 'ping') {
      return responderCon(reqid, {
        ok: true,
        version: VERSION,
        // Esto permite ver qué código está VIVO de verdad, sin adivinar.
        remitenteEnElScript: CONFIG.remitente || '(vacio: envia desde la cuenta del script)',
        cuentaQueEnvia: cuentaActual(),
        mensaje: 'Conexión OK. El script está desplegado y responde.'
      });
    }

    var asunto = asuntoDe(datos);
    var html = cuerpoHtml(datos);
    var texto = cuerpoTexto(datos, html);
    var alumnos = destinatarios(datos);

    if (!alumnos.length) {
      return responderCon(reqid, { ok: false, error: 'No hay destinatarios válidos en el payload.' });
    }
    if (!asunto) {
      return responderCon(reqid, { ok: false, error: 'El payload no trae "asunto".' });
    }

    var fallos = [];
    for (var i = 0; i < alumnos.length; i++) {
      var correo = alumnos[i];
      var r = enviarUno(correo, asunto, texto, html);
      if (!r.ok) fallos.push(correo + ' → ' + r.error);
    }

    if (fallos.length) {
      return responderCon(reqid, {
        ok: false,
        error: 'Falló ' + fallos.length + ' de ' + alumnos.length + ': ' + fallos.slice(0, 5).join(' | ')
      });
    }

    return responderCon(reqid, {
      ok: true,
      enviados: alumnos.length,
      asunto: asunto,
      mensaje: 'Correo enviado a ' + alumnos.length + ' persona(s).'
    });
  } catch (err) {
    return responderCon(reqid, { ok: false, error: 'Error en el script: ' + err.message });
  }
}

/** Con reqid devuelve la llamada JavaScript; sin él, JSON para pruebas. */
function responderCon(reqid, obj) {
  if (reqid) {
    var js = 'window.__appsCorreoRespuesta && window.__appsCorreoRespuesta(' +
      JSON.stringify(String(reqid)) + ',' + JSON.stringify(obj) + ');';
    return ContentService.createTextOutput(js).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Envía UN correo tolerando un remitente mal configurado.
 *
 * `from` solo es válido si es un alias real de la cuenta que ejecuta el
 * script. Basta un typo (o escribir una "O" en vez de "@") para que Gmail
 * responda "Argumento no válido" y el correo se pierda sin llegar a salir.
 * Por eso se intenta con `from` y, si el error es del remitente, se reintenta
 * sin él: el correo sale igual desde la cuenta del script.
 */
function enviarUno(correo, asunto, texto, html) {
  var base = { htmlBody: html };
  if (CONFIG.replyTo) base.replyTo = CONFIG.replyTo;

  if (CONFIG.remitente && remitenteParecenValido(CONFIG.remitente)) {
    var conRemitente = {};
    for (var k in base) conRemitente[k] = base[k];
    conRemitente.from = CONFIG.remitente;
    try {
      GmailApp.sendEmail(correo, asunto, texto, conRemitente);
      return { ok: true };
    } catch (e1) {
      if (!esErrorDeRemitente(e1)) return { ok: false, error: e1.message };
    }
  }

  try {
    GmailApp.sendEmail(correo, asunto, texto, base);
    return { ok: true };
  } catch (e2) {
    return { ok: false, error: e2.message };
  }
}

/** Detecta los typos más comunes antes de molestar a Gmail. */
function remitenteParecenValido(valor) {
  var correo = String(valor).replace(/^.*<|>.*$/g, '').trim();
  if (!correo) return false;
  if (correo.indexOf('@') < 0) return false;
  if (/O@|0@/.test(correo)) return false;
  return correo.indexOf('.', correo.indexOf('@')) > correo.indexOf('@');
}

/** Reconoce el fallo típico de remitente inválido o sin alias. */
function esErrorDeRemitente(e) {
  var m = String((e && e.message) || '');
  return /Argumento no v|Invalid from|from address|no es un alias|not a valid alias/i.test(m);
}

/**
 * Cuenta que realmente ejecuta el script. Sirve para diagnosticar: si esto no
 * es lo que esperabas, los correos salen desde otro remitente del que crees.
 */
function cuentaActual() {
  try {
    return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'desconocida';
  } catch (e) {
    return 'desconocida';
  }
}

/**
 * PRUEBA MANUAL (ejecuta ▶ con esta función seleccionada en el editor)
 *
 * Manda un correo con lo MÍNIMO: sin `from`, sin `replyTo`, sin nada.
 * Si esto funciona, tu cuenta puede enviar y el problema está en el
 * deployment; si falla, el mensaje de error dice exactamente por qué.
 */
function testEnviar() {
  var destino = 'neuronal.plus@gmail.com';
  var resultado;
  try {
    GmailApp.sendEmail(destino, 'Prueba de Apps Script',
      'Si lees esto, tu cuenta si puede enviar correos.',
      { htmlBody: '<p>Si lees esto, <b>tu cuenta si puede enviar correos</b>.</p>' });
    resultado = 'OK: se envio a ' + destino;
  } catch (e) {
    resultado = 'ERROR: ' + e.message;
  }
  Logger.log(resultado);
  console.log(resultado);
  return resultado;
}

/**
 * Informa qué implementación está sirviendo realmente este proyecto.
 * Útil cuando el editor se ve bien pero el deployment parece viejo.
 */
function testEstado() {
  var salida = {
    version: VERSION,
    remitente: CONFIG.remitente || '(vacio)',
    cuenta: cuentaActual(),
    tieneFallback: (typeof enviarUno === 'function')
  };
  var texto = JSON.stringify(salida, null, 2);
  Logger.log(texto);
  console.log(texto);
  return texto;
}

/* -----------------------------Armado de texto---------------------------- */

function asuntoDe(d) {
  if (d.asunto) return d.asunto;
  var c = d.curso && d.curso.titulo ? d.curso.titulo : 'la plataforma';
  if (d.tipo === 'recurso-nuevo') return 'Nuevo material en ' + c;
  if (d.tipo === 'modulo-abierto') return 'Nuevo módulo en ' + c;
  return 'Aviso de ' + c;
}

function destinatarios(d) {
  var lista = [];
  if (Array.isArray(d.alumnos)) {
    lista = d.alumnos.map(function (a) {
      return (typeof a === 'string' ? a : a && a.email) || '';
    });
  }
  if (d.email) lista.push(d.email);
  var vistos = {};
  return lista
    .map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(function (e) { return e && e.indexOf('@') > 0 && !vistos[e] && (vistos[e] = true); });
}

function cuerpoTexto(d, html) {
  if (d.cuerpoTexto) return d.cuerpoTexto;
  var bruto = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
  return bruto.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
/**
 * Construye el HTML del correo con la marca.
 * Usa el `contenido` que manda la web; si no viene, lo arma por tipo.
 */
function cuerpoHtml(d) {
  var contenido = normalizarContenido(d.contenido) || contenidoPorDefecto(d);
  return plantilla(contenido);
}

/** Completa y sanea lo que llega de la web. */
function normalizarContenido(c) {
  if (!c) return null;
  var out = {
    antetitulo: String(c.antetitulo || '').trim(),
    titulo:     String(c.titulo || '').trim(),
    bajada:     String(c.bajada || '').trim(),
    pie:        String(c.pie || '').trim(),
    parrafos:   [],
    botones:    []
  };
  var ps = Array.isArray(c.parrafos) ? c.parrafos : (c.parrafos ? [c.parrafos] : []);
  for (var i = 0; i < ps.length; i++) {
    var p = String(ps[i] || '').trim();
    if (p) out.parrafos.push(p);
  }
  var bs = Array.isArray(c.botones) ? c.botones : [];
  for (var j = 0; j < bs.length; j++) {
    var b = bs[j] || {};
    var txt = String(b.texto || b.label || '').trim();
    var url = String(b.url || b.href || '').trim();
    if (txt && url) out.botones.push({ texto: txt, url: url });
  }
  return (out.titulo || out.parrafos.length || out.botones.length) ? out : null;
}

/** Contenido por defecto según el tipo de envío. */
function contenidoPorDefecto(d) {
  var curso = (d.curso && d.curso.titulo) ? d.curso.titulo : 'la plataforma';
  var url = d.curso && d.curso.url ? d.curso.url : '';

  if (d.tipo === 'recurso-nuevo') {
    var r = d.recurso || {};
    var p = [];
    if (r.descripcion) p.push(String(r.descripcion));
    p.push('Ya puedes verlo dentro de tu curso.');
    return {
      antetitulo: 'NUEVO MATERIAL',
      titulo: r.titulo || 'Material nuevo',
      parrafos: p,
      botones: url ? [{ texto: 'Ir al material', url: url }] : []
    };
  }
  if (d.tipo === 'modulo-abierto') {
    var m = d.modulo || {};
    var p2 = [];
    if (m.descripcion) p2.push(String(m.descripcion));
    p2.push('Ya puedes entrar con tu acceso habitual.');
    return {
      antetitulo: 'NUEVO MÓDULO',
      titulo: m.titulo || 'Módulo nuevo',
      parrafos: p2,
      botones: url ? [{ texto: 'Entrar al módulo', url: url }] : []
    };
  }
  // Comunicados: el cuerpo libre va en los párrafos, respetando los saltos.
  var libre = d.cuerpoTexto ? String(d.cuerpoTexto) : '';
  if (!libre && d.cuerpoHtml) libre = String(d.cuerpoHtml).replace(/<br\s*\/?>/gi, '\n');
  var bloques = libre.split(/\n{2,}/);
  var ps3 = [];
  for (var k = 0; k < bloques.length; k++) {
    var t = bloques[k].replace(/\n/g, ' ').trim();
    if (t) ps3.push(t);
  }
  return {
    antetitulo: 'COMUNICADO · ' + String(curso).toUpperCase(),
    titulo: d.asunto || 'Aviso',
    parrafos: ps3,
    botones: []
  };
}

/**
 * Envoltorio con la marca. Tablas + estilos en línea: Gmail no renderiza
 * flex ni grid, y un <div> suelto se descuadra en varios clientes de correo.
 */
function plantilla(c) {
  var K = MARCA.colores;
  var W = MARCA.ancho;
  var html = '';

  if (c.antetitulo) {
    html += '<div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2.5px;' +
            'color:' + K.gris + ';padding:0 0 14px 0;">' + esc(c.antetitulo) + '</div>';
  }
  html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    '<table role="presentation" width="' + W + '" cellpadding="0" cellspacing="0" style="width:' + W + 'px;background:#FFFFFF;">' +
      '<tr><td style="height:6px;line-height:6px;background:' + K.pizarra + ';">&nbsp;</td></tr>' +
      '<tr><td style="padding:36px 42px 34px 42px;">';

  if (c.titulo) {
    html += '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.3;' +
            'color:' + K.pizarra + ';margin:0 0 20px 0;">' + esc(c.titulo) + '</div>';
    html += '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;">' +
            '<tr><td style="width:44px;height:2px;line-height:2px;background:' + K.terracota + ';">&nbsp;</td></tr></table>';
  }
  if (c.bajada) {
    html += '<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;' +
            'color:' + K.pizarra + ';margin:0 0 16px 0;">' + esc(c.bajada) + '</div>';
  }
  for (var i = 0; i < c.parrafos.length; i++) {
    html += '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.75;' +
            'color:' + K.pizarra + ';margin:0 0 14px 0;">' + esc(c.parrafos[i]) + '</div>';
  }

  if (c.botones.length) {
    html += '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px 0;"><tr>';
    for (var j = 0; j < c.botones.length; j++) {
      var b = c.botones[j];
      html += '<td style="padding:0 8px 8px 0;">' + botonMarca(b.texto, b.url) + '</td>';
    }
    html += '</tr></table>';
  }

  if (c.pie) {
    html += '<div style="font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;' +
            'color:' + K.gris + ';margin:24px 0 0 0;">' + esc(c.pie) + '</div>';
  }

  // Firma fija de la marca: no se edita desde la web.
  html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0 0;">' +
          '<tr><td style="height:1px;line-height:1px;background:' + K.borde + ';">&nbsp;</td></tr></table>' +
          '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:' + K.pizarra + ';margin:22px 0 0 0;">' +
            esc(MARCA.nombre) + '</div>' +
          '<div style="font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:' + K.gris + ';margin:5px 0 0 0;">' +
            esc(MARCA.cargo) + '</div>' +
          '<div style="font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:' + K.gris + ';margin:10px 0 0 0;">' +
            esc(MARCA.contacto) + '</div>';

  html += '</td></tr>' +
      '<tr><td style="height:6px;line-height:6px;background:' + K.pizarra + ';">&nbsp;</td></tr>' +
    '</table></td></tr></table>';

  return fondo(K.crema, html);
}

function botonMarca(texto, url) {
  var K = MARCA.colores;
  return '<a href="' + esc(url) + '" style="background:' + K.pizarra + ';color:#FFFFFF;' +
    'padding:13px 24px;border-radius:6px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;' +
    'font-size:14px;font-weight:600;display:inline-block;">' + esc(texto) + '</a>';
}

function fondo(color, interior) {
  return '<div style="background:' + color + ';padding:28px 12px;font-family:Helvetica,Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    interior + '</td></tr></table></div>';
}

/**
 * VISTA PREVIA (ejecuta ▶ con esta función seleccionada).
 * Genera el HTML de un comunicado de ejemplo y lo abre en una pestaña para
 * revisar cómo se verá la marca antes de mandarlo a los alumnos.
 */
function testPlantilla() {
  var html = plantilla({
    antetitulo: 'COMUNICADO · CURSO DE PRUEBA',
    titulo: 'Aquí va el título del comunicado',
    bajada: 'Una línea de apertura que recoge la idea principal.',
    parrafos: [
      'Primer párrafo del comunicado. Puedes escribir varios y se muestran separados.',
      'Segundo párrafo. El texto se escapa solo, así que puedes escribir <libros> & símbolos sin riesgo.'
    ],
    botones: [
      { texto: 'Ir al material', url: 'https://cursos-drcotonieto.neuronal-plus.workers.dev' },
      { texto: 'Ir a la plataforma', url: 'https://cursos-drcotonieto.neuronal-plus.workers.dev/inicio' }
    ],
    pie: 'Texto pequeño opcional, antes de la firma.'
  });
  var salida = HtmlService.createHtmlOutput(html);
  Logger.log('Plantilla generada (' + html.length + ' caracteres).');
  return salida;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}