/**
 * ============================================================================
 *  NOTIFICADOR POR CORREO — Google Apps Script  (Dr. Ernesto Cotonieto)
 * ============================================================================
 *
 *  CÓMO USARLO
 *  1. Abre script.google.com → nuevo proyecto → pega este archivo completo.
 *  2. Implementa → Añadir implementación → Aplicación web:
 *       - Ejecutar como:           Yo (tu cuenta)
 *       - Quién tiene acceso:      Cualquier persona        ← IMPRESCINDIBLE
 *  3. Copia la URL /exec y ponla en src/config.js → APPS_SCRIPT_URL.
 *
 *  POR QUÉ ESTA VERSIÓN DEVUELVE UNA RESPUESTA
 *  Antes el script no devolvía nada y la web usaba fetch(...,'no-cors'), con lo
 *  cual el navegador recibía una respuesta opaca: IMPOSIBLE saber si el envío
 *  había ocurrido. La web siempre pintaba "✓ enviado". Ahora el script devuelve
 *  un JSON y la web lo lee por JSONP, así que ves la verdad.
 *  App Script envuelve solo la salida en el callback si lo pides con ?callback=.
 * ============================================================================
 */

const CONFIG = {
  remitente: 'Dr. Ernesto Cotonieto <TU_CORREO@gmail.com>', // <- pon tu Gmail
  replyTo: 'TU_CORREO@gmail.com',                          // <- pon tu Gmail
  linkPortal: 'https://cursos-drcotonieto.neuronal-plus.workers.dev',
};

/** Punto de entrada único: el front manda POST con ?payload=<json>. */
function doPost(e) {
  return responder(e);
}
/** También acepta GET, para poder probar desde el navegador sin la web. */
function doGet(e) {
  return responder(e);
}

function responder(e) {
  try {
    const crudo = (e && e.parameter && e.parameter.payload) || '{}';
    const datos = JSON.parse(crudo);
    const tipo = datos.tipo;

    if (tipo === 'ping') {
      return json({ ok: true, mensaje: 'Conexión OK. El script está desplegado y responde.' });
    }

    const asunto = asuntoDe(datos);
    const html = cuerpoHtml(datos);
    const texto = cuerpoTexto(datos, html);
    const alumnos = destinatarios(datos);

    if (!alumnos.length) {
      return json({ ok: false, error: 'No hay destinatarios válidos en el payload.' });
    }
    if (!asunto) {
      return json({ ok: false, error: 'El payload no trae "asunto".' });
    }

    const fallos = [];
    for (let i = 0; i < alumnos.length; i++) {
      const correo = alumnos[i];
      try {
        GmailApp.sendEmail(correo, asunto, texto, {
          htmlBody: html,
          replyTo: CONFIG.replyTo,
          from: CONFIG.remitente,
        });
      } catch (err) {
        fallos.push(correo + ' → ' + err.message);
      }
    }

    if (fallos.length) {
      return json({
        ok: false,
        error: 'Falló ' + fallos.length + ' de ' + alumnos.length + ': ' + fallos.slice(0, 5).join(' | '),
      });
    }

    return json({
      ok: true,
      enviados: alumnos.length,
      asunto: asunto,
      mensaje: 'Correo enviado a ' + alumnos.length + ' persona(s).',
    });
  } catch (err) {
/* -----------------------------Armado de texto---------------------------- */

function asuntoDe(d) {
  if (d.asunto) return d.asunto;
  const c = d.curso && d.curso.titulo ? d.curso.titulo : 'la plataforma';
  if (d.tipo === 'recurso-nuevo') return 'Nuevo material en ' + c;
  if (d.tipo === 'modulo-abierto') return 'Nuevo módulo en ' + c;
  return 'Aviso de ' + c;
}

function destinatarios(d) {
  let lista = [];
  if (Array.isArray(d.alumnos)) {
    lista = d.alumnos.map(a => (typeof a === 'string' ? a : a && a.email) || '');
  }
  if (d.email) lista.push(d.email);
  const vistos = {};
  return lista
    .map(e => String(e).trim().toLowerCase())
    .filter(e => e && e.indexOf('@') > 0 && !vistos[e] && (vistos[e] = true));
}

function cuerpoTexto(d, html) {
  if (d.cuerpoTexto) return d.cuerpoTexto;
  const bruto = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
  return bruto.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function cuerpoHtml(d) {
  if (d.cuerpoHtml) return envolver(d.cuerpoHtml);
  if (d.tipo === 'recurso-nuevo') {
    const r = d.recurso || {};
    return envolver(
      '<p>Se acaba de publicar un material nuevo:</p>' +
      '<p style="font-size:18px;font-weight:700;margin:16px 0">' + esc(r.titulo || '') + '</p>' +
      (r.descripcion ? '<p>' + esc(r.descripcion) + '</p>' : '') +
      boton(d.curso && d.curso.url)
    );
  }
  if (d.tipo === 'modulo-abierto') {
    const m = d.modulo || {};
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
    return json({ ok: false, error: 'Error en el script: ' + err.message });
  }
}

/** Envuelve la respuesta como JSON. Apps Script aplica el ?callback= solo. */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}