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

const CONFIG = {
  // Opcional. Solo úsalo si es un ALIAS de la cuenta que ejecuta el script.
  // Si está mal escrito o no es alias, Gmail responde "Argumento no válido" y
  // el envío se pierde, así que el script lo detecta y reintenta sin él.
  remitente: 'Dr. Ernesto Cotonieto <neuronal.plus@gmail.com>',
  replyTo: 'neuronal.plus@gmail.com',
  linkPortal: 'https://cursos-drcotonieto.neuronal-plus.workers.dev',
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
function cuerpoHtml(d) {
  if (d.cuerpoHtml) return envolver(d.cuerpoHtml);
  if (d.tipo === 'recurso-nuevo') {
    var r = d.recurso || {};
    return envolver(
      '<p>Se acaba de publicar un material nuevo:</p>' +
      '<p style="font-size:18px;font-weight:700;margin:16px 0">' + esc(r.titulo || '') + '</p>' +
      (r.descripcion ? '<p>' + esc(r.descripcion) + '</p>' : '') +
      boton(d.curso && d.curso.url)
    );
  }
  if (d.tipo === 'modulo-abierto') {
    var m = d.modulo || {};
    return envolver(
      '<p>Se abrió un módulo nuevo:</p>' +
      '<p style="font-size:18px;font-weight:700;margin:16px 0">' + esc(m.titulo || '') + '</p>' +
      (m.descripcion ? '<p>' + esc(m.descripcion) + '</p>' : '') +
      boton(d.curso && d.curso.url)
    );
  }
  return envolver('<p>' + esc(cuerpoTexto(d, '')).replace(/\n/g, '<br>') + '</p>');
}

function boton(url) {
  if (!url) return '';
  return '<p style="margin:24px 0">' +
    '<a href="' + esc(url) + '" style="background:#0f6f6b;color:#fff;padding:12px 22px;' +
    'border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">' +
    'Ir al material</a></p>';
}

/** Plantilla con la firma; ya no hace falta que la web la agregue. */
function envolver(interior) {
  return '<div style="font-family:Arial,sans-serif;color:#222;max-width:620px">' +
    interior +
    '<hr style="border:none;border-top:1px solid #ddd;margin:28px 0">' +
    '<p style="font-size:12px;color:#777;margin:0">Dr. Ernesto Cotonieto · ' +
    '<a href="' + CONFIG.linkPortal + '" style="color:#0f6f6b">Plataforma de cursos</a></p>' +
    '</div>';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}