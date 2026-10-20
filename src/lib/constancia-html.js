/* ============================================================
   HTML DE LA CONSTANCIA (fuente única)
   ------------------------------------------------------------
   El PDF que ve el alumno (Constancia.jsx) y la vista previa que
   ve el docente antes de activar el botón (TallerRecursos.jsx)
   salen de AQUÍ, con el mismo HTML: lo que se previsualiza es
   exactamente lo que se imprime. Si cambias el diseño, cambia
   para los dos lados a la vez.
   ============================================================ */
import { CONTACTO_EMAIL } from '../config'
import { conLetra } from './plantillas'

// Servir la firma desde el mismo sitio evita que Drive exija permisos o
// devuelva una página de confirmación en vez de la imagen al alumnado.
export const FIRMA_URL = '/firma_escaneada.png'
export const LOGO_URL = '/logo_terracota_1024.png'

export const escapar = (valor) => String(valor ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export function esperarImagen(url, timeout = 9000) {
  return new Promise(resolve => {
    const img = new Image()
    const reloj = setTimeout(() => resolve(false), timeout)
    img.onload = () => { clearTimeout(reloj); resolve(img.naturalWidth > 0) }
    img.onerror = () => { clearTimeout(reloj); resolve(false) }
    img.src = url
  })
}

/* Textos que el docente puede elegir (Gestión → Constancia). Cada curso
   guarda el suyo; vacío = el de siempre. Las opciones son solo atajos:
   se puede escribir cualquier texto. */
export const TITULO_CONSTANCIA = 'CONSTANCIA DE ACREDITACIÓN'
export const TEXTO_CONSTANCIA = 'por haber acreditado satisfactoriamente el curso'
export const PRESETS_CONSTANCIA = [
  { nombre: 'Acreditación', titulo: 'CONSTANCIA DE ACREDITACIÓN', texto: 'por haber acreditado satisfactoriamente el curso' },
  { nombre: 'Asistencia a taller', titulo: 'CONSTANCIA DE ASISTENCIA', texto: 'por haber asistido al taller' },
  { nombre: 'Asistencia a curso', titulo: 'CONSTANCIA DE ASISTENCIA', texto: 'por haber asistido al curso' },
  { nombre: 'Participación', titulo: 'CONSTANCIA DE PARTICIPACIÓN', texto: 'por su participación en el taller' },
  { nombre: 'Conclusión', titulo: 'CONSTANCIA DE CONCLUSIÓN', texto: 'por haber concluido el curso' },
]

export function htmlConstancia({ nombre, curso, nota10, folio, fecha, firmaUrl, logoUrl, incluirHoras, horas, titulo, texto, mostrarNota = true }) {
  const tituloLimpio = escapar((titulo || '').trim() || TITULO_CONSTANCIA)
  const textoLimpio = escapar((texto || '').trim() || TEXTO_CONSTANCIA)
  const nombreLimpio = escapar(nombre)
  const cursoLimpio = escapar(curso)
  const logo = escapar(logoUrl)
  // Un taller gratuito no califica: sin nota no se imprime la línea de
  // calificación (antes salía «0/10» porque Number(null) es 0).
  const conNota = mostrarNota !== false && nota10 != null && nota10 !== ''
  const nota = conNota ? Number(nota10).toFixed(1).replace(/\.0$/, '') : null
  const nombreFont = nombre.length > 44 ? 25 : nombre.length > 32 ? 30 : 36
  const cursoFont = curso.length > 100 ? 16 : curso.length > 64 ? 19 : curso.length > 44 ? 22 : 26
  const tituloTxt = (titulo || '').trim() || TITULO_CONSTANCIA
  const textoTxt = (texto || '').trim() || TEXTO_CONSTANCIA
  const tituloFont = tituloTxt.length > 44 ? 10 : tituloTxt.length > 32 ? 11.5 : 13
  const motivoFont = textoTxt.length > 110 ? 11 : textoTxt.length > 80 ? 12 : 13
  // Con mucho texto se recortan los espacios verticales para que la firma y
  // el pie nunca queden fuera de la hoja.
  const compacto = nombre.length + curso.length + textoTxt.length + tituloTxt.length > 230
  const firma = escapar(firmaUrl)
  const folioHtml = escapar(folio)
  const verificar = `${window.location.origin}/verificar/${encodeURIComponent(folio)}`
  const contacto = escapar(CONTACTO_EMAIL)
  const telefono = '56 3784 1931'
  const cargo = 'Cédula profesional 10521804'
  const nombreFirma = 'Dr. Ernesto Cotonieto Martínez'

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Constancia · ${cursoLimpio}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: letter portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { font-family: Inter, Arial, sans-serif; color: #1B3A4B; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hoja { position: relative; width: 8.5in; height: 11in; overflow: hidden; display: flex; flex-direction: column; align-items: center; padding: .58in .68in .42in; background: #FAFAF8; }
  .franja { position: absolute; inset: 0 0 auto; height: 7pt; background: #1B3A4B; }
  .encabezado { width: 100%; display: flex; flex-direction: column; align-items: center; margin-top: .32in; }
  .logo { width: .78in; height: auto; }
  .antetitulo { max-width: 100%; margin-top: .28in; text-align: center; font-size: ${tituloFont}pt; letter-spacing: ${tituloFont > 11 ? '.25em' : '.12em'}; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  .acento { width: .55in; height: 2pt; margin: .3in auto; background: #C17A5E; }
  .contenido { width: 100%; min-width: 0; padding: 0 .1in; text-align: center; margin-top: .38in; }
  .se-otorga { font-size: 13pt; }
  .nombre { margin: .26in 0 .34in; text-align: center; font: 600 ${nombreFont}pt Fraunces, Georgia, serif; color: #1B3A4B; line-height: 1.18; overflow-wrap: anywhere; }
  .separador { width: 2.5in; height: 1pt; margin: 0 auto .35in; background: #D6DCE3; }
  .motivo { font-size: ${motivoFont}pt; line-height: 1.55; overflow-wrap: anywhere; }
  .curso { margin: .24in auto 0; font: 600 ${cursoFont}pt Fraunces, Georgia, serif; line-height: 1.25; overflow-wrap: anywhere; }
  .horas { margin-top: .22in; color: #6B7A85; font-size: 11pt; }
  .calificacion { margin-top: .34in; color: #C17A5E; font-size: 12pt; font-weight: 600; }
  .verificacion { width: 100%; margin-top: .35in; text-align: center; color: #8A9BAD; font-size: 8pt; line-height: 1.45; overflow-wrap: anywhere; }
  .bloque-firma { width: 100%; margin-top: auto; display: flex; flex-direction: column; align-items: center; padding-top: .35in; }
  .firma { width: 3.1in; height: 1.24in; object-fit: contain; filter: contrast(1.32) brightness(0.9); }
  .linea-firma { width: 3.4in; height: 1pt; margin-top: .02in; background: #1B3A4B; }
  .firmante { margin-top: .13in; text-align: center; font-size: 10pt; font-weight: 700; }
  .cargo { margin-top: .06in; text-align: center; font-size: 8.5pt; color: #8A9BAD; }
  .pie > * { min-width: 0; overflow-wrap: anywhere; }
  .pie { width: calc(100% + 1.36in); min-height: .42in; margin: .3in -.68in -.42in; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; padding: 0 .55in; background: #1B3A4B; color: #D6DCE3; font-size: 8pt; }
  .pie strong { text-align: center; color: #FAFAF8; font-size: 10pt; }
  .pie span:last-child { display: inline-flex; align-items: center; justify-content: flex-end; gap: .07in; }
  .pie .wa-icono { width: .15in; height: .15in; fill: #25D366; flex: none; display: block; }
  ${compacto ? '.encabezado { margin-top: .1in; } .antetitulo { margin-top: .15in; } .acento { margin: .15in auto; } .contenido { margin-top: .1in; } .nombre { margin: .12in 0 .16in; } .separador { margin-bottom: .16in; } .curso { margin-top: .12in; } .calificacion, .horas { margin-top: .12in; } .verificacion { margin-top: .15in; } .bloque-firma { padding-top: .1in; } .firma { height: 1in; }' : ''}
  @media screen { body { display: flex; padding: 24px; background: #e8e5df; } .hoja { flex: 0 0 auto; margin: 0 auto; box-shadow: 0 8px 30px #0002; } }
  @media print { html, body { width: 8.5in; height: 11in; } body { display: block; } .hoja { margin: 0; box-shadow: none; } }
</style></head><body><main class="hoja">
  <div class="franja"></div>
  <header class="encabezado">
  <img class="logo" src="${logo}" alt="">
  <div class="antetitulo">${tituloLimpio}</div>
  <div class="acento"></div>
  </header>
  <section class="contenido">
  <div class="se-otorga">Se otorga a</div>
  <div class="nombre">${nombreLimpio}</div>
  <div class="separador"></div>
  <div class="motivo">${textoLimpio}</div>
  <div class="curso">«${cursoLimpio}»</div>
  ${incluirHoras && horas ? `<div class="horas">Duración: ${horas} hora${horas !== 1 ? 's' : ''}</div>` : ''}
  ${conNota ? `<div class="calificacion">Calificación final: ${nota}/10 · ${escapar(conLetra(nota10))}</div>` : ''}
  </section>
  <div class="verificacion">${fecha} · Verificable en ${escapar(verificar)} · ${contacto}</div>
  <section class="bloque-firma">
  <img id="firma-escaneada" class="firma" src="${firma}" alt="Firma autógrafa digital de ${escapar(nombreFirma)}">
  <div class="linea-firma"></div>
  <div class="firmante">${escapar(nombreFirma)}</div>
  <div class="cargo">${escapar(cargo)}</div>
  </section>
  <footer class="pie"><span>Folio ${folioHtml}</span><strong>@dr.cotonieto</strong><span><svg class="wa-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.347-.347.52-.52.174-.174.232-.298.347-.497.116-.198.058-.372-.022-.52-.081-.148-.676-1.63-.927-2.23-.245-.587-.494-.508-.676-.517-.174-.009-.373-.011-.572-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>${telefono}</span></footer>
</main></body></html>`
}

