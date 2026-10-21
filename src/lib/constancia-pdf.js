/* ============================================================
   CONSTANCIA → ARCHIVO PDF
   ------------------------------------------------------------
   Convierte la hoja que ya se ve en la ventana de la constancia
   (la misma de htmlConstancia) en un PDF tamaño carta y lo guarda
   como descarga. Así quien no sabe usar «Imprimir → Guardar como
   PDF», o está en un teléfono, igual se lleva su archivo.

   html2canvas y jsPDF pesan: se cargan solo al pulsar el botón.
   El PDF es una imagen de la hoja (el texto no se puede seleccionar);
   para un PDF con texto seleccionable está el botón de imprimir.
   ============================================================ */

/** Genera el PDF de la hoja de `documento` y lo descarga ahí mismo. */
export async function descargarPdfDeConstancia(documento, nombreArchivo) {
  const hoja = documento.querySelector('.hoja')
  if (!hoja) throw new Error('No se encontró la constancia')
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  if (documento.fonts?.ready) await documento.fonts.ready

  // En pantallas angostas la hoja se achica con `zoom`; para fotografiarla
  // se vuelve a su tamaño real y se restaura al terminar.
  const zoomPrevio = hoja.style.zoom
  hoja.style.zoom = '1'
  let lienzo
  try {
    lienzo = await html2canvas(hoja, {
      scale: 2, useCORS: true, backgroundColor: '#FAFAF8', logging: false,
      windowWidth: 1100, scrollX: 0, scrollY: 0,
    })
  } finally {
    hoja.style.zoom = zoomPrevio
  }

  const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait', compress: true })
  pdf.addImage(lienzo.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 8.5, 11)
  const blob = pdf.output('blob')

  const a = documento.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombreArchivo
  documento.body.appendChild(a)
  a.click()
  documento.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 60000)
}

/** Nombre de archivo seguro: «Constancia - Curso - FOLIO.pdf». */
export function nombreArchivoConstancia(curso, folio) {
  const limpio = String(curso || 'curso').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return `Constancia - ${limpio} - ${folio}.pdf`
}
