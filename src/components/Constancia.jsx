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

function htmlConstancia({ nombre, profesion, curso, nota10, folio, fecha, firmaUrl }) {
  const nombreLimpio = escapar(nombre)
  const profesionLimpia = escapar(profesion)
  const cursoLimpio = escapar(curso)
  const nota = Number(nota10).toFixed(1).replace(/\.0$/, '')
  const nombreFont = nombre.length > 34 ? 25 : nombre.length > 25 ? 28 : 30
  const cursoFont = curso.length > 48 ? 15 : curso.length > 34 ? 17 : 19
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
  @page { size: 10in 5.625in; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 10in; height: 5.625in; }
  body { font-family: Inter, Arial, sans-serif; color: #1B3A4B; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hoja { position: relative; width: 10in; height: 5.625in; overflow: hidden; background: #FAFAF8; }
  .franja { position: absolute; inset: 0 0 auto; height: 5pt; background: #1B3A4B; }
  .logo { position: absolute; left: 50%; top: 4%; width: 4.167%; height: auto; transform: translateX(-50%); }
  .antetitulo { position: absolute; top: 12.8%; left: 10%; width: 80%; text-align: center; font-size: 11pt; letter-spacing: .25em; font-weight: 600; }
  .acento { position: absolute; top: 17.8%; left: 47.22%; width: 5.56%; height: 1.5pt; background: #C17A5E; }
  .se-otorga { position: absolute; top: 20.2%; left: 10%; width: 80%; text-align: center; font-size: 11pt; }
  .nombre { position: absolute; top: 24.2%; left: 5%; width: 90%; text-align: center; font: 600 ${nombreFont}pt Fraunces, Georgia, serif; color: #1B3A4B; line-height: 1.15; }
  .profesion { position: absolute; top: 31.1%; left: 10%; width: 80%; text-align: center; color: #8A9BAD; font-size: 8.5pt; }
  .separador { position: absolute; top: 35.1%; left: 36%; width: 28%; height: .9pt; background: #D6DCE3; }
  .motivo { position: absolute; top: 37%; left: 10%; width: 80%; text-align: center; font-size: 11pt; }
  .curso { position: absolute; top: 41%; left: 10%; width: 80%; text-align: center; font: 600 ${cursoFont}pt Fraunces, Georgia, serif; line-height: 1.15; }
  .calificacion { position: absolute; top: 52.3%; left: 10%; width: 80%; text-align: center; color: #C17A5E; font-size: 10pt; font-weight: 600; }
  .verificacion { position: absolute; top: 61%; left: 8%; width: 84%; text-align: center; color: #8A9BAD; font-size: 7pt; overflow-wrap: anywhere; }
  .firma { position: absolute; left: 50%; top: 80.5%; width: 19%; height: auto; transform: translate(-50%, -83%); object-fit: contain; }
  .linea-firma { position: absolute; top: 80.5%; left: 33%; width: 34%; height: 1pt; background: #1B3A4B; }
  .firmante { position: absolute; top: 84.5%; left: 10%; width: 80%; text-align: center; font-size: 9pt; font-weight: 700; }
  .cargo { position: absolute; top: 88.5%; left: 10%; width: 80%; text-align: center; font-size: 7.5pt; color: #8A9BAD; }
  .pie { position: absolute; bottom: 0; left: 0; width: 100%; height: 6.2%; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; padding: 0 4.5%; background: #1B3A4B; color: #D6DCE3; font-size: 6.4pt; }
  .pie strong { text-align: center; color: #FAFAF8; font-size: 8pt; }
  .pie span:last-child { text-align: right; }
  @media screen { body { background: #e8e5df; padding: 24px; } .hoja { margin: auto; box-shadow: 0 8px 30px #0002; } }
</style></head><body><main class="hoja">
  <div class="franja"></div>
  <img class="logo" src="${LOGO_URL}" alt="">
  <div class="antetitulo">CONSTANCIA DE ACREDITACIÓN</div>
  <div class="acento"></div>
  <div class="se-otorga">Se otorga a</div>
  <div class="nombre">${nombreLimpio}</div>
  ${profesionLimpia ? `<div class="profesion">${profesionLimpia}</div>` : ''}
  <div class="separador"></div>
  <div class="motivo">por haber acreditado satisfactoriamente el curso</div>
  <div class="curso">«${cursoLimpio}»</div>
  <div class="calificacion">Calificación final: ${nota}/10 · ${escapar(conLetra(nota10))}</div>
  <div class="verificacion">${fecha} · Verificable en ${escapar(verificar)} · ${contacto}</div>
  <div class="linea-firma"></div>
  <img id="firma-escaneada" class="firma" src="${firma}" alt="Firma autógrafa digital de ${escapar(nombreFirma)}">
  <div class="firmante">${escapar(nombreFirma)}</div>
  <div class="cargo">${escapar(cargo)}</div>
  <footer class="pie"><span>Folio ${folioHtml}</span><strong>@dr.cotonieto</strong><span>${telefono}</span></footer>
</main></body></html>`
}

function Constancia({ user }) {
  const { cursoId } = useParams()
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState({ nombre: '', profesion: '' })
  const [curso, setCurso] = useState(null)
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [noEmite, setNoEmite] = useState(false)
  const [firmaLista, setFirmaLista] = useState(false)
  const [folio, setFolio] = useState(null)

  const firmaUrl = FIRMA_URL

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
          supabase.from('perfiles').select('nombre_completo, profesion').eq('id', user.id).maybeSingle(),
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
          setPerfil({ nombre: p?.nombre_completo || '', profesion: p?.profesion || '' })
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
    esperarImagen(firmaUrl).then(ok => { if (vivo) setFirmaLista(ok) })
    return () => { vivo = false }
  }, [firmaUrl])

  const guardar = async () => {
    const { error: e } = await supabase.from('perfiles').upsert(
      { id: user.id, nombre_completo: perfil.nombre.trim(), profesion: perfil.profesion.trim() },
      { onConflict: 'id' })
    if (e) setError('No se pudieron guardar tus datos: ' + e.message)
    else setError('')
  }

  const generar = async () => {
    if (!estado?.disponible) return setError('La constancia se habilita al alcanzar la calificación mínima del curso.')
    if (!firmaLista) return setError('La firma escaneada no está disponible desde esta página. No se generó un documento sin firma.')
    if (!perfil.nombre.trim() || !perfil.profesion.trim()) {
      return setError('Completa tu nombre y profesión para que aparezcan en la constancia.')
    }

    const ventana = window.open('', '_blank')
    if (!ventana) return setError('El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes de este sitio e inténtalo otra vez.')
    setGenerando(true)
    setError('')
    try {
      const { error: ePerfil } = await supabase.from('perfiles').upsert(
        { id: user.id, nombre_completo: perfil.nombre.trim(), profesion: perfil.profesion.trim() },
        { onConflict: 'id' })
      if (ePerfil) throw ePerfil

      // Revalida inmediatamente antes de emitir: la condición no depende
      // de lo que haya quedado en memoria en el navegador.
      const { data: revision, error: eEstado } = await supabase
        .rpc('estado_constancia', { p_curso: Number(cursoId) })
      if (eEstado) throw eEstado
      if (!revision?.disponible) throw new Error('Aún no alcanzas la calificación mínima del curso.')

      const { data: folioEmitido, error: eFolio } = await supabase
        .rpc('emitir_constancia', { p_curso: Number(cursoId) })
      if (eFolio) throw eFolio
      if (!folioEmitido) throw new Error('No se pudo emitir el folio de la constancia.')

      setEstado(revision)
      setFolio(folioEmitido)
      ventana.document.open()
      ventana.document.write(htmlConstancia({
        nombre: perfil.nombre.trim(),
        profesion: perfil.profesion.trim(),
        curso: curso?.titulo || '',
        nota10: revision.nota10,
        folio: folioEmitido,
        fecha: fechaConLetra(new Date()),
        firmaUrl,
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
      ventana.close()
      setError(e.message || 'No se pudo generar la constancia.')
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
        <label htmlFor="constancia-nombre">Nombre completo</label>
        <input id="constancia-nombre" type="text" value={perfil.nombre}
          onChange={e => setPerfil({ ...perfil, nombre: e.target.value })} />
        <label htmlFor="constancia-profesion">Profesión o especialidad</label>
        <input id="constancia-profesion" type="text" value={perfil.profesion}
          onChange={e => setPerfil({ ...perfil, profesion: e.target.value })} />
        <button className="button secondary" onClick={guardar}>Guardar datos</button>
      </div>

      <div className="bloque-cerrado">
        {estado?.disponible ? (
          <>
            <p className="aviso-ok">✓ Alcanzaste la calificación mínima para obtener la constancia.</p>
            {!firmaLista && <p className="aviso-error">No se pudo cargar la firma autógrafa escaneada. El PDF se mantiene deshabilitado para no emitir una constancia incompleta.</p>}
            <button className="button primary" onClick={generar}
              disabled={generando || !firmaLista || !perfil.nombre.trim() || !perfil.profesion.trim()}>
              {generando ? 'Preparando PDF…' : folio ? 'Descargar constancia' : 'Generar constancia'}
            </button>
            {folio && <p className="constancia-folio">
              <span className="sutil">Folio {folio} ·</span>{' '}
              <Link className="enlace-texto" to={`/verificar/${folio}`}>verificar constancia</Link>
            </p>}
            <p className="nota">Al continuar, el navegador abre el PDF para descargarlo o guardarlo.</p>
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
