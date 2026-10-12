// ---------- MENÚ ----------
// Reúne los 3 módulos: Ansiedad, Supervisión e Invitación PAP.
// Reemplaza tu onOpen() actual por este para tenerlo todo en el menú.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙ Supervisión")

    // --- Taller "Acompañar la ansiedad" ---
    .addItem("Enviar confirmaciones pendientes", "enviarConfirmaciones")
    .addItem("Enviar recordatorio (solo confirmados)", "enviarRecordatorio")
    .addItem("Enviar aviso por WhatsApp a la comunidad", "avisoWhatsApp")
    .addItem("Enviar invitación registro asistencia (confirmados)", "enviarInvitacionRegistroAsistencia")
    .addSeparator()

    // --- Supervisión clínica ---
    .addItem("Enviar acceso a plataforma supervisión", "enviarInvitacionSupervision")
    .addSeparator()

    // --- Invitación Taller PAP (lista amplia, CCO en lotes de 50) ---
    .addItem("Enviar invitación PAP (lista amplia)", "enviarInvitacionPAP")
    .addSeparator()

    // --- Pruebas (te envían el correo a ti mismo) ---
    .addItem("PRUEBA · confirmación", "pruebaRapida")
    .addItem("PRUEBA · recordatorio", "pruebaRecordatorio")
    .addItem("PRUEBA · registro asistencia", "pruebaRegAsisAnsiedad")
    .addItem("PRUEBA · invitación PAP", "pruebaInvitacionPAP")
    .addItem("PRUEBA · supervisión", "pruebaSupervision")

    .addToUi();
}
