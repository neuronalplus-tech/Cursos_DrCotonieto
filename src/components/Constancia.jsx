import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CONTACTO_EMAIL, rutaAcceso, wa } from '../config'
import { emiteConstancia } from '../lib/helpers'
import { conLetra, fechaConLetra } from '../lib/plantillas'
import { Breadcrumb, BandaRedes } from './ui'

// Servir la firma desde el mismo sitio evita que Drive exija permisos o
// devuelva una página de confirmación en vez de la imagen al alumnado.
const FIRMA_URL = '/firma_escaneada.png'
const LOGO_URL = '/logo_terracota_1024.png'

const escapar = (valor) => String(valor ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

function esperarImagen(url, timeout = 9000) {
  return new Promise(resolve => {
    const img = new Image()
    const reloj = setTimeout(() => resolve(false), timeout)
    img.onload = () => { clearTimeout(reloj); resolve(img.naturalWidth > 0) }
    img.onerror = () => { clearTimeout(reloj); resolve(false) }
    img.src = url
  })
}

function htmlConstancia({ nombre, curso, nota10, folio, fecha, firmaUrl, logoUrl }) {
  const nombreLimpio = escapar(nombre)
  const cursoLimpio = escapar(curso)
  const logo = escapar(logoUrl)
  const nota = Number(nota10).toFixed(1).replace(/\.0$/, '')
  const nombreFont = nombre.length > 44 ? 25 : nombre.length > 32 ? 30 : 36
  const cursoFont = curso.length > 64 ? 19 : curso.length > 44 ? 22 : 26
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
  .antetitulo { margin-top: .28in; text-align: center; font-size: 13pt; letter-spacing: .25em; font-weight: 600; }
  .acento { width: .55in; height: 2pt; margin: .3in auto; background: #C17A5E; }
  .contenido { width: 100%; text-align: center; margin-top: .38in; }
  .se-otorga { font-size: 13pt; }
  .nombre { margin: .26in 0 .34in; text-align: center; font: 600 ${nombreFont}pt Fraunces, Georgia, serif; color: #1B3A4B; line-height: 1.18; overflow-wrap: anywhere; }
  .separador { width: 2.5in; height: 1pt; margin: 0 auto .35in; background: #D6DCE3; }
  .motivo { font-size: 13pt; line-height: 1.55; }
  .curso { margin: .24in auto 0; font: 600 ${cursoFont}pt Fraunces, Georgia, serif; line-height: 1.25; overflow-wrap: anywhere; }
  .calificacion { margin-top: .34in; color: #C17A5E; font-size: 12pt; font-weight: 600; }
  .verificacion { width: 100%; margin-top: .35in; text-align: center; color: #8A9BAD; font-size: 8pt; line-height: 1.45; overflow-wrap: anywhere; }
  .bloque-firma { width: 100%; margin-top: auto; display: flex; flex-direction: column; align-items: center; padding-top: .35in; }
  .firma { width: 1.55in; height: .62in; object-fit: contain; }
  .linea-firma { width: 2.65in; height: 1pt; margin-top: .02in; background: #1B3A4B; }
  .firmante { margin-top: .13in; text-align: center; font-size: 10pt; font-weight: 700; }
  .cargo { margin-top: .06in; text-align: center; font-size: 8.5pt; color: #8A9BAD; }
  .pie { width: calc(100% + 1.36in); min-height: .42in; margin: .3in -.68in -.42in; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; padding: 0 .55in; background: #1B3A4B; color: #D6DCE3; font-size: 8pt; }
  .pie strong { text-align: center; color: #FAFAF8; font-size: 10pt; }
  .pie span:last-child { text-align: right; }
  @media screen { body { display: flex; justify-content: center; padding: 24px; background: #e8e5df; } .hoja { flex: 0 0 auto; box-shadow: 0 8px 30px #0002; } }
  @media print { html, body { width: 8.5in; height: 11in; } body { display: block; } .hoja { margin: 0; box-shadow: none; } }
</style></head><body><main class="hoja">
  <div class="franja"></div>
  <header class="encabezado">
  <img class="logo" src="${logo}" alt="">
  <div class="antetitulo">CONSTANCIA DE ACREDITACIÓN</div>
  <div class="acento"></div>
  </header>
  <section class="contenido">
  <div class="se-otorga">Se otorga a</div>
  <div class="nombre">${nombreLimpio}</div>
  <div class="separador"></div>
  <div class="motivo">por haber acreditado satisfactoriamente el curso</div>
  <div class="curso">«${cursoLimpio}»</div>
  <div class="calificacion">Calificación final: ${nota}/10 · ${escapar(conLetra(nota10))}</div>
  </section>
  <div class="verificacion">${fecha} · Verificable en ${escapar(verificar)} · ${contacto}</div>
  <section class="bloque-firma">
  <img id="firma-escaneada" class="firma" src="${firma}" alt="Firma autógrafa digital de ${escapar(nombreFirma)}">
  <div class="linea-firma"></div>
  <div class="firmante">${escapar(nombreFirma)}</div>
  <div class="cargo">${escapar(cargo)}</div>
  </section>
  <footer class="pie"><span>Folio ${folioHtml}</span><strong>@dr.cotonieto</strong><span>${telefono}</span></footer>
</main></body></html>`
}

function mostrarAvisoVentana(ventana, titulo, mensaje) {
  if (!ventana || ventana.closed) return
  const documento = ventana.document
  documento.open()
  documento.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title></title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #FAFAF8; color: #1B3A4B; font: 16px Inter, Arial, sans-serif; }
  main { width: min(620px, 100%); padding: 36px; border: 1px solid #D6DCE3; border-radius: 16px; background: white; }
  h1 { margin: 0 0 14px; font: 600 28px Georgia, serif; }
  p { line-height: 1.6; white-space: pre-wrap; }
  .marca { height: 5px; margin: -36px -36px 28px; border-radius: 16px 16px 0 0; background: #1B3A4B; }
</style></head><body><main><div class="marca"></div><h1 id="titulo"></h1><p id="mensaje"></p></main></body></html>`)
  documento.close()
  documento.title = titulo
  documento.getElementById('titulo').textContent = titulo
  documento.getElementById('mensaje').textContent = mensaje
  ventana.focus()
}

function Constancia({ user }) {
  const { cursoId } = useParams()
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState({ nombre: '' })
  const [curso, setCurso] = useState(null)
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [noEmite, setNoEmite] = useState(false)
  const [firmaLista, setFirmaLista] = useState(false)
  const [folio, setFolio] = useState(null)

  // El smoke renderiza este componente en SSR (sin window); en el navegador
  // siempre se resuelve contra el origen real del sitio.
  const firmaUrl = typeof window === 'undefined' ? FIRMA_URL : new URL(FIRMA_URL, window.location.origin).href
  const logoUrl = typeof window === 'undefined' ? LOGO_URL : new URL(LOGO_URL, window.location.origin).href

  useEffect(() => {
    if (!user) { navigate(rutaAcceso(`/constancia/${cursoId}`)); return }
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError('')
      setNoEmite(false)
      setEstado(null)
      setFolio(null)
      try {
        const [{ data: p, error: ePerfil }, { data: c, error: eCurso }] = await Promise.all([
          supabase.from('perfiles').select('nombre_completo').eq('id', user.id).maybeSingle(),
          supabase.from('cursos').select('id, titulo, constancia, gratuito').eq('id', cursoId).maybeSingle(),
        ])
        if (ePerfil) throw ePerfil
        if (eCurso) throw eCurso
        if (!c || !emiteConstancia(c)) {
          if (vivo) { setCurso(c); setNoEmite(true) }
          return
        }
        const { data: resultado, error: eEstado } = await supabase
          .rpc('estado_constancia', { p_curso: Number(cursoId) })
        if (eEstado) throw eEstado
        if (vivo) {
          setCurso(c)
          setPerfil({ nombre: p?.nombre_completo || '' })
          setEstado(resultado)
          setFolio(resultado?.folio || null)
        }
      } catch (e) {
        if (vivo) setError(e.message || 'No se pudo verificar si ya puedes descargar tu constancia.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [cursoId, user, navigate])

  useEffect(() => {
    let vivo = true
    Promise.all([esperarImagen(firmaUrl), esperarImagen(logoUrl)])
      .then(([firmaOk, logoOk]) => { if (vivo) setFirmaLista(firmaOk && logoOk) })
    return () => { vivo = false }
  }, [firmaUrl, logoUrl])

  const generar = async () => {
    if (!estado?.disponible) return setError(estado?.limiteAlcanzado
      ? 'Ya utilizaste las 2 descargas permitidas para esta constancia.'
      : 'La constancia se habilita al alcanzar la calificación mínima del curso.')
    if (!firmaLista) return setError('La firma escaneada no está disponible desde esta página. No se generó un documento sin firma.')
    if (!(estado?.nombre || perfil.nombre).trim()) return setError('Agrega tu nombre completo en Mi perfil antes de generar la constancia.')

    const ventana = window.open('', '_blank')
    if (!ventana) return setError('El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes de este sitio e inténtalo otra vez.')
    setGenerando(true)
    setError('')
    try {
      mostrarAvisoVentana(ventana, 'Preparando tu constancia', 'Estamos verificando tu calificación y preparando el documento.')
      // El servidor lee el nombre del perfil, valida la nota y consume de
      // forma atómica una de las dos generaciones permitidas.
      const { data: emision, error: eEmision } = await supabase
        .rpc('preparar_descarga_constancia', { p_curso: Number(cursoId) })
      if (eEmision) throw eEmision
      if (!emision?.folio || !emision?.nombre) throw new Error('No se pudo preparar la constancia con el nombre de tu perfil.')

      setEstado(previo => ({
        ...previo,
        disponible: Number(emision.descargasRestantes) > 0,
        folio: emision.folio,
        nombre: emision.nombre,
        descargas: emision.descargas,
        descargasRestantes: emision.descargasRestantes,
        limiteAlcanzado: Number(emision.descargasRestantes) <= 0,
        nota10: emision.nota10,
        minima10: emision.minima10,
      }))
      setFolio(emision.folio)
      ventana.document.open()
      ventana.document.write(htmlConstancia({
        nombre: emision.nombre,
        curso: curso?.titulo || '',
        nota10: emision.nota10,
        folio: emision.folio,
        fecha: fechaConLetra(emision.fechaEmision),
        firmaUrl,
        logoUrl,
      }))
      ventana.document.close()

      const imagenes = [...ventana.document.images]
      const cargaron = await Promise.all(imagenes.map(img => img.complete
        ? Promise.resolve(img.naturalWidth > 0)
        : new Promise(resolve => {
          const reloj = setTimeout(() => resolve(false), 9000)
          img.onload = () => { clearTimeout(reloj); resolve(img.naturalWidth > 0) }
          img.onerror = () => { clearTimeout(reloj); resolve(false) }
        })))
      if (cargaron.some(ok => !ok)) throw new Error('No se pudo cargar el logo o la firma escaneada de la constancia.')
      if (ventana.document.fonts?.ready) await ventana.document.fonts.ready
      ventana.focus()
      ventana.print()
    } catch (e) {
      const mensaje = e.message || 'No se pudo generar la constancia.'
      try { mostrarAvisoVentana(ventana, 'No se pudo generar la constancia', mensaje) } catch {}
      setError(mensaje)
    } finally {
      setGenerando(false)
    }
  }
  if (!user) return null
  if (cargando) return <div className="loading">Cargando...</div>

  if (noEmite) return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Constancia' }]} />
      <h1>Constancia no disponible</h1>
      <p className="sutil">Este curso no emite constancia de acreditación.</p>
      <div className="bloque-cerrado">
        <p>Si necesitas un comprobante de tu participación, escríbeme por WhatsApp y lo vemos.</p>
        <div className="bloque-botones">
          <a className="button whatsapp" target="_blank" rel="noopener noreferrer"
             href={wa(`Hola, quiero un comprobante del curso "${curso?.titulo || ''}".`)}>Escríbeme por WhatsApp</a>
          <button className="button secondary" onClick={() => navigate(`/curso/${cursoId}`)}>Volver al curso</button>
        </div>
      </div>
      <BandaRedes />
    </section>
  )

  return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mis calificaciones', to: '/mis-calificaciones' }, { label: 'Constancia' }]} />
      <h1>Constancia de acreditación</h1>
      <p className="sutil">Se habilita al alcanzar la calificación mínima que configuró el administrador.</p>
      {error && <p className="aviso-error">{error}</p>}

      {estado?.nota10 != null && (
        <div className="bloque-cerrado constancia-nota">
          <strong>{Number(estado.nota10).toFixed(1).replace(/\.0$/, '')}/10</strong>
          <span>Calificación final acumulada · mínimo {Number(estado.minima10).toFixed(1).replace(/\.0$/, '')}/10</span>
        </div>
      )}

      <div className="formulario-datos">
        <strong>Nombre que aparecerá en la constancia</strong>
        <p><strong>{estado?.nombre || perfil.nombre || 'Aún no has agregado tu nombre completo en el perfil.'}</strong></p>
        <Link className="enlace-texto" to="/perfil">Actualizar mi nombre en Mi perfil</Link>
        <p className="nota">La constancia toma el nombre de tu perfil y conserva ese nombre durante sus dos descargas.</p>
      </div>
      <div className="bloque-cerrado">
        {estado?.limiteAlcanzado ? (
          <>
            <p className="aviso-ok">Esta constancia ya alcanzó el límite de 2 descargas.</p>
            <p className="sutil">El nombre queda asociado al folio desde la primera descarga. Si necesitas corregir un error, contacta al administrador.</p>
            {folio && <p className="constancia-folio">
              <span className="sutil">Folio {folio} ·</span>{' '}
              <Link className="enlace-texto" to={`/verificar/${folio}`}>verificar constancia</Link>
            </p>}
          </>
        ) : estado?.disponible ? (
          <>
            <p className="aviso-ok">✓ Alcanzaste la calificación mínima para obtener la constancia.</p>
            {!firmaLista && <p className="aviso-error">No se pudo cargar el logo o la firma autógrafa escaneada. El PDF se mantiene deshabilitado para no emitir una constancia incompleta.</p>}
            <button className="button primary" onClick={generar}
              disabled={generando || !firmaLista || !(estado?.nombre || perfil.nombre).trim()}>
              {generando ? 'Preparando PDF…' : folio ? 'Descargar constancia' : 'Generar constancia'}
            </button>
            <p className="nota">Descargas usadas: {Number(estado?.descargas || 0)} de 2. Cada generación consume una descarga.</p>
            {folio && <p className="constancia-folio">
              <span className="sutil">Folio {folio} ·</span>{' '}
              <Link className="enlace-texto" to={`/verificar/${folio}`}>verificar constancia</Link>
            </p>}
            <p className="nota">Al continuar, el navegador abre el PDF para imprimirlo, descargarlo o guardarlo.</p>
          </>
        ) : (
          <>
            <p className="sutil">Para obtener la constancia falta:</p>
            <ul className="constancia-requisitos">
              {(estado?.requisitos || []).map(r => (
                <li key={r.titulo} className={r.cumple ? 'cumple' : ''}>
                  <span>{r.cumple ? '✓' : '○'}</span>
                  <span>{r.titulo}</span>
                  <span className="nota">{r.detalle}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="bloque-botones" style={{ justifyContent: 'flex-start' }}>
        <Link className="button secondary" to="/mis-calificaciones">Volver a mis calificaciones</Link>
        <Link className="button texto" to={`/curso/${cursoId}`}>Ver curso</Link>
      </div>
      <BandaRedes />
    </section>
  )
}

export default Constancia
