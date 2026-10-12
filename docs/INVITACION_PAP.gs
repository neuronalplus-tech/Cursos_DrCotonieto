// ======================================================================
//  INVITACIÓN AL TALLER "PRIMEROS AUXILIOS PSICOLÓGICOS"
//  Lista amplia · envío en CCO por lotes de 50
// ----------------------------------------------------------------------
//  CÓMO USARLO
//  1) Hoja de cálculo con una columna de correos (ej. "Correo").
//  2) Pega el ID del logo en CFG_INV_PAP.LOGO_FILE_ID (archivo en Drive).
//  3) Pon tu correo en CFG_INV_PAP.CORREO_RESPUESTA.
//  4) Ejecuta pruebaInvitacionPAP() → te manda el correo a ti mismo.
//  5) Si se ve bien, ejecuta enviarInvitacionPAP() (manda en tandas de 50).
//
//  NOTA: los 50 van en CCO, nadie ve los correos de los demás. El "Para"
//  (To) es tu propio correo; las respuestas llegan a ti por el Reply-To.
// ======================================================================

const CFG_INV_PAP = {
  // --- Hoja de cálculo ---
  HOJA: "Invitados PAP",          // nombre de la pestaña con los correos
  COL_CORREO: "Correo",           // encabezado de la columna de correos
  COL_NOMBRE: "Nombre",           // opcional (en CCO masivo el saludo es genérico)
  FILA_ENCABEZADO: 1,             // fila donde están los títulos

  // --- Envío ---
  MAX_DESTINOS: 50,               // correos por lote en CCO (límite práctico)
  PAUSA_MS: 3000,                 // pausa entre lotes (evita parecer spam)
  CORREO_RESPUESTA: "neuronal.plus@gmail.com",       // To + Reply-To (tu correo)
  ASUNTO: "🎁 Taller gratuito: Primeros Auxilios Psicológicos · 20 oct (constancia y grabación)",
  LOGO_FILE_ID: "1do5_9u5js05xq-U2uf2xburDrJGBSgV1",  // mismo logo que usas en Ansiedad

  // --- Link de registro a la plataforma ---
  // Lleva al hub de "Talleres gratuitos": se registran UNA sola vez y,
  // tras confirmar, ya tienen acceso a constancia y grabación de este y
  // de los futuros talleres gratuitos.
  ENLACE_REGISTRO_PLATAFORMA:
    "https://cursos-drcotonieto.neuronal-plus.workers.dev/registro?redirigir=/curso/6",
};

// ----------------------------------------------------------------------
//  Envío masivo en tandas de 50 (CCO). Lee la hoja, manda a quien aún
//  no tiene "Fecha invitación" y sella la fecha de cada lote enviado.
// ----------------------------------------------------------------------
function enviarInvitacionPAP() {
  const ui = SpreadsheetApp.getUi();
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG_INV_PAP.HOJA);
  if (!hoja) { ui.alert("No encuentro la pestaña '" + CFG_INV_PAP.HOJA + "'."); return; }

  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) { ui.alert("La hoja está vacía."); return; }

  const enc = datos[0].map(function (h) { return ("" + h).trim(); });

  const iCor = enc.lastIndexOf(CFG_INV_PAP.COL_CORREO);
  if (iCor === -1) { ui.alert("No encuentro la columna '" + CFG_INV_PAP.COL_CORREO + "'."); return; }

  let iFecha = enc.indexOf("Fecha invitación");
  if (iFecha === -1) {
    iFecha = enc.length;
    hoja.getRange(CFG_INV_PAP.FILA_ENCABEZADO, iFecha + 1).setValue("Fecha invitación");
    enc.push("Fecha invitación");
  }

  // Pendientes = correo válido y sin fecha de invitación previa.
  const destinatarios = [];
  const filasAActualizar = [];
  for (let f = 1; f < datos.length; f++) {
    const correo = ("" + (datos[f][iCor] || "")).trim();
    if (!correo || correo.indexOf("@") === -1) continue;
    if (("" + (datos[f][iFecha] || "")).trim() !== "") continue;
    destinatarios.push(correo);
    filasAActualizar.push(f);
  }

  if (destinatarios.length === 0) {
    ui.alert("No hay destinatarios pendientes de invitación.");
    return;
  }

  const respuesta = ui.alert(
    "Invitación PAP en CCO (lotes de " + CFG_INV_PAP.MAX_DESTINOS + ")",
    "Se enviarán " + destinatarios.length + " correos en lotes.\n\n¿Continuar?",
    ui.ButtonSet.YES_NO
  );
  if (respuesta !== ui.Button.YES) return;

  const totalLotes = Math.ceil(destinatarios.length / CFG_INV_PAP.MAX_DESTINOS);
  let enviados = 0, errores = 0;

  for (let lote = 0; lote < totalLotes; lote++) {
    const inicio = lote * CFG_INV_PAP.MAX_DESTINOS;
    const fin = Math.min(inicio + CFG_INV_PAP.MAX_DESTINOS, destinatarios.length);
    const loteDestinos = destinatarios.slice(inicio, fin);
    const loteFilas = filasAActualizar.slice(inicio, fin);

    try {
      const r = enviarInvitacionPAPCCO(loteDestinos);
      if (r.exito) {
        const fechaStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
        for (const f of loteFilas) hoja.getRange(f + 1, iFecha + 1).setValue(fechaStr);
        enviados += loteDestinos.length;
        Utilities.sleep(CFG_INV_PAP.PAUSA_MS);
      } else {
        errores += loteDestinos.length;
        ui.alert("⚠️ Error lote " + (lote + 1) + ": " + r.mensaje);
      }
    } catch (e) {
      errores += loteDestinos.length;
      ui.alert("⚠️ Excepción lote " + (lote + 1) + ": " + e);
    }
  }

  ui.alert("📊 RESUMEN INVITACIÓN PAP\n\nTotal: " + destinatarios.length +
    "\nEnviados: " + enviados + "\nErrores: " + errores);
}
// ----------------------------------------------------------------------
//  Envía UN lote (hasta 50) en CCO, con logo incrustado.
// ----------------------------------------------------------------------
function enviarInvitacionPAPCCO(destinatarios) {
  if (!destinatarios || !destinatarios.length) return { exito: false, mensaje: "Sin destinatarios" };
  try {
    let logo;
    try {
      logo = DriveApp.getFileById(CFG_INV_PAP.LOGO_FILE_ID).getBlob().setName("logo.png");
    } catch (e) {
      return { exito: false, mensaje: "LOGO_FILE_ID inválido: " + e };
    }

    GmailApp.sendEmail(CFG_INV_PAP.CORREO_RESPUESTA, CFG_INV_PAP.ASUNTO,
      textoPlanoInvitacionPAP(), {
        htmlBody: construirHTMLInvitacionPAP(),
        inlineImages: { logoCid: logo },
        bcc: destinatarios.join(","),
        replyTo: CFG_INV_PAP.CORREO_RESPUESTA,   // que te respondan a ti
        name: "Dr. Ernesto Cotonieto",
      });
    return { exito: true, mensaje: "Enviado" };
  } catch (err) {
    return { exito: false, mensaje: "" + err };
  }
}
// ----------------------------------------------------------------------
//  Cuerpo HTML del correo (todo con estilos en línea: Gmail borra <style>).
// ----------------------------------------------------------------------
function construirHTMLInvitacionPAP() {
  const AZUL = "#1B3A4B", TERRA = "#C17A5E", TXT = "#33414A",
    MUT = "#7A8891", CREMA = "#FAFAF8", CARD = "#F2EEE9";

  function botonPrincipal(url, texto) {
    return '<a href="' + url + '" target="_blank" style="display:inline-block;' +
      'background:' + AZUL + ';color:#FFFFFF;border:2px solid ' + AZUL + ';' +
      'padding:16px 32px;border-radius:8px;text-decoration:none;' +
      'font-family:Arial,sans-serif;font-size:16px;font-weight:bold;' +
      'line-height:1;margin:8px 6px;">' + texto + '</a>';
  }

  return '' +
    '<div style="margin:0;padding:0;background:#EFEDE9;">' +
    '<meta charset="UTF-8">' +
    '<div style="max-width:620px;margin:0 auto;background:' + CREMA + ';font-family:Arial,sans-serif;">' +

    '<div style="background:' + AZUL + ';padding:28px 32px;text-align:center;">' +
    '<img src="cid:logoCid" width="54" height="54" style="display:block;margin:0 auto 10px;">' +
    '<div style="font-family:Georgia,serif;font-size:26px;color:#FFFFFF;font-weight:bold;">Primeros Auxilios Psicológicos</div>' +
    '<div style="font-size:14px;color:' + TERRA + ';margin-top:6px;">Taller gratuito para profesionales · salud mental, educación, salud, recursos humanos, trabajo social y áreas afines</div>' +
    '</div>' +

    '<div style="padding:30px 32px 8px;">' +
    '<p style="font-size:16px;color:' + TXT + ';margin:0 0 16px;">Hola:</p>' +

    '<p style="font-size:15px;line-height:1.6;color:' + TXT + ';margin:0 0 18px;">' +
    'Quiero invitarte al taller gratuito <strong>"Primeros Auxilios Psicológicos"</strong>, pensado para profesionales que en su día a día acompañan a personas en crisis: salud mental, educación, salud, recursos humanos, trabajo social y áreas afines.</p>' +

    '<div style="background:' + CARD + ';border-left:4px solid ' + TERRA + ';padding:16px 20px;margin:0 0 20px;">' +
    '<div style="font-size:14px;color:' + TXT + ';line-height:1.8;">' +
    '<strong>&#128197; Fecha:</strong> Martes 20 de octubre de 2026<br>' +
    '<strong>&#128343; Horario:</strong> 19:30 a 21:00 h (hora del centro de México)<br>' +
    '<strong>&#128187; Modalidad:</strong> En línea<br>' +
    '<strong>&#10084;&#65039; Costo:</strong> Sin costo' +
    '</div>' +
    '</div>' +

    '<p style="font-size:14px;font-weight:bold;color:' + AZUL + ';margin:22px 0 10px;">QUÉ VAMOS A TRABAJAR</p>' +
    '<ul style="font-size:14px;line-height:1.8;color:' + TXT + ';margin:0 0 20px;padding-left:20px;">' +
    '<li>Qué son —y qué no son— los primeros auxilios psicológicos</li>' +
    '<li>La diferencia entre PAP y terapia: por qué no necesitas ser terapeuta para aplicarlos</li>' +
    '<li>Los 5 principios de la intervención en crisis (Observar, Escuchar, Conectar) y el modelo de los 8 pasos</li>' +
    '<li>Los primeros 10 minutos: contacto, seguridad y contención emocional</li>' +
    '<li>Qué decir y qué <strong>no</strong> decir ante una persona en crisis, con frases exactas</li>' +
    '<li>Cómo actuar con niños, adolescentes y adultos en contextos educativos, laborales y de salud</li>' +
    '<li>Cuándo un caso excede tu alcance profesional y cómo derivar sin que se viva como abandono</li>' +
    '<li>Autocuidado del interviniente</li>' +
    '</ul>' +
    '<p style="font-size:14px;font-weight:bold;color:' + AZUL + ';margin:22px 0 10px;">CÓMO ACCEDER AL TALLER</p>' +
    '<p style="font-size:15px;line-height:1.6;color:' + TXT + ';margin:0 0 14px;">' +
    'El enlace de la reunión y todos los materiales están en la plataforma educativa. Para entrar solo necesitas <strong>registrarte una sola vez</strong> (es gratis y toma menos de un minuto).</p>' +

    '<div style="text-align:center;margin:0 0 22px;">' +
    botonPrincipal(CFG_INV_PAP.ENLACE_REGISTRO_PLATAFORMA, "Registrarme y acceder al taller") +
    '</div>' +

    '<div style="background:' + CARD + ';border-left:4px solid ' + TERRA + ';padding:16px 20px;margin:0 0 20px;">' +
    '<div style="font-size:14px;color:' + TXT + ';line-height:1.8;">' +
    '<strong>Al registrarte obtienes:</strong><br>' +
    '• Acceso al taller en vivo<br>' +
    '• Grabación disponible 48 h después de la sesión<br>' +
    '• Constancia de participación (se habilita al terminar el taller)<br>' +
    '• Cuadernillo y materiales complementarios<br>' +
    '• Con el <strong>mismo usuario</strong entras a futuros talleres: no vuelvas a registrarte' +
    '</div>' +
    '</div>' +

    '<p style="font-size:14px;color:' + TXT + ';line-height:1.6;margin:0 0 18px;">' +
    '<strong>Sobre el registro:</strong> te pedirá tu correo (dos veces), una contraseña (dos veces) y tu <strong>nombre completo tal como quieres que aparezca en la constancia</strong>. Ese nombre se usará automáticamente al emitirla, y te servirá para todos los talleres gratuitos y para los cursos que tomes conmigo.</p>' +

    '<p style="font-size:13px;color:' + MUT + ';line-height:1.6;margin:0 0 18px;font-style:italic;">' +
    'Conforme a las recomendaciones de la OMS y la Secretaría de Salud, el taller respeta la autonomía de cada persona: participas en la medida en que decidas, y no se te pedirá compartir nada que no quieras.</p>' +

    '<p style="font-size:14px;color:' + MUT + ';text-align:center;margin:0 0 8px;">' +
    '¿Dudas? Responde a este correo o escríbeme por WhatsApp.</p>' +
    '</div>' +

    '<div style="padding:22px 32px 30px;">' +
    '<table cellpadding="0" cellspacing="0" style="width:100%;background:#FFFFFF;border:1px solid #E5DED6;border-radius:6px;">' +
    '<tr>' +
    '<td style="padding:18px 20px;width:70px;vertical-align:top;">' +
    '<img src="cid:logoCid" width="52" height="52" style="display:block;">' +
    '</td>' +
    '<td style="padding:18px 20px 18px 0;vertical-align:top;">' +
    '<div style="font-family:Georgia,serif;font-size:17px;color:' + AZUL + ';font-weight:bold;">Dr. Ernesto Cotonieto Martínez</div>' +
    '<div style="font-size:12px;color:' + TERRA + ';margin-top:3px;">Psicología especializada basada en evidencia</div>' +
    '<div style="font-size:11px;color:' + MUT + ';margin-top:6px;">Cédula profesional 10521804</div>' +
    '<div style="font-size:12px;margin-top:10px;">' +
    '<a href="https://wa.me/5215637841931" style="color:' + AZUL + ';text-decoration:none;">WhatsApp</a>' +
    '<span style="color:' + MUT + ';"> · </span>' +
    '<a href="https://www.instagram.com/dr.cotonieto" style="color:' + AZUL + ';text-decoration:none;">Instagram</a>' +
    '<span style="color:' + MUT + ';"> · </span>' +
    '<a href="https://cursos-drcotonieto.neuronal-plus.workers.dev" style="color:' + AZUL + ';text-decoration:none;">Plataforma</a>' +
    '</div>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +

    '</div></div>';
}

// ----------------------------------------------------------------------
//  Versión en texto plano (por si el cliente de correo no muestra HTML).
// ----------------------------------------------------------------------
function textoPlanoInvitacionPAP() {
  return "Hola:\n\n" +
    "Quiero invitarte al taller gratuito 'Primeros Auxilios Psicológicos', pensado para profesionales que en su día a día acompañan a personas en crisis: salud mental, educación, salud, recursos humanos, trabajo social y áreas afines.\n\n" +
    "Fecha: Martes 20 de octubre de 2026\n" +
    "Horario: 19:30 a 21:00 h (horario del centro de México)\n" +
    "Modalidad: En línea\n" +
    "Costo: Sin costo\n\n" +
    "CÓMO ACCEDER\n" +
    "El enlace de la reunión y todos los materiales están en la plataforma educativa. Para entrar solo necesitas registrarte una sola vez (es gratis y toma menos de un minuto):\n" +
    CFG_INV_PAP.ENLACE_REGISTRO_PLATAFORMA + "\n\n" +
    "Al registrarte obtienes:\n" +
    "· Acceso al taller en vivo\n" +
    "· Grabación disponible 48 h después de la sesión\n" +
    "· Constancia de participación (se habilita al terminar el taller)\n" +
    "· Cuadernillo y materiales complementarios\n" +
    "· Con el mismo usuario entras a futuros talleres: no vuelvas a registrarte\n\n" +
    "Sobre el registro: te pedirá tu correo (dos veces), una contraseña (dos veces) y tu nombre completo tal como quieres que aparezca en la constancia.\n\n" +
    "Un cordial saludo,\n" +
    "Dr. Ernesto Cotonieto Martínez\n" +
    "wa.me/5215637841931";
}

// ---------- PRUEBA: te manda el correo a ti mismo ----------
function pruebaInvitacionPAP() {
  const ui = SpreadsheetApp.getUi();
  const yo = Session.getActiveUser().getEmail();
  const r = enviarInvitacionPAPCCO([yo]);
  ui.alert(r.exito ? "✅ Invitación PAP enviada a: " + yo : "❌ Error: " + r.mensaje);
}



