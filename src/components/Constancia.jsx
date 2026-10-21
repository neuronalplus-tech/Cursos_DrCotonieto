import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rutaAcceso, wa } from '../config'
import { emiteConstancia } from '../lib/helpers'
import { fechaConLetra } from '../lib/plantillas'
import { FIRMA_URL, LOGO_URL, esperarImagen, htmlConstancia } from '../lib/constancia-html'
import { descargarPdfDeConstancia, nombreArchivoConstancia } from '../lib/constancia-pdf'
import { Breadcrumb, BandaRedes } from './ui'


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
  const [ultimaEmision, setUltimaEmision] = useState(null)

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
          supabase.from('cursos').select('*').eq('id', cursoId).maybeSingle(),
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

  // Escribe la constancia en la ventana nueva, con los botones de guardado
  // (descargar PDF / imprimir). No imprime sola: quien la abre elige cómo guardarla.
  const pintarConstancia = async (ventana, emision) => {
    ventana.document.open()
    ventana.document.write(htmlConstancia({
      nombre: emision.nombre,
      curso: curso?.titulo || '',
      nota10: emision.nota10,
      folio: emision.folio,
      fecha: fechaConLetra(emision.fechaEmision),
      firmaUrl,
      logoUrl,
      incluirHoras: curso?.constancia_incluir_horas !== false,
      horas: curso?.constancia_horas || null,
      titulo: curso?.constancia_titulo,
      texto: curso?.constancia_texto,
      mostrarNota: curso?.constancia_mostrar_nota !== false,
      barra: true,
    }))
    ventana.document.close()
    // Se engancha DESPUÉS de cerrar el documento: abrirlo borra lo anterior.
    ventana.__guardarPdf = () => descargarPdfDeConstancia(
      ventana.document, nombreArchivoConstancia(curso?.titulo, emision.folio))

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
  }

  // Vuelve a abrir la constancia ya generada en esta visita, sin gastar otra
  // descarga: por si la ventana se cerró antes de guardarla.
  const reabrir = async () => {
    if (!ultimaEmision) return
    const ventana = window.open('', '_blank')
    if (!ventana) return setError('El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio e inténtalo otra vez.')
    setError('')
    try { await pintarConstancia(ventana, ultimaEmision) } catch (e) {
      try { mostrarAvisoVentana(ventana, 'No se pudo abrir la constancia', e.message) } catch {}
      setError(e.message || 'No se pudo abrir la constancia.')
    }
  }

  const generar = async () => {
    if (!estado?.disponible) return setError(estado?.limiteAlcanzado
      ? `Ya utilizaste las ${maxDescargas} descargas permitidas para esta constancia.`
      : curso?.gratuito
        ? 'La constancia del taller se habilita cuando el docente la publica, al terminar el taller.'
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
      setUltimaEmision(emision)
      await pintarConstancia(ventana, emision)
    } catch (e) {
      const mensaje = e.message || 'No se pudo generar la constancia.'
      try { mostrarAvisoVentana(ventana, 'No se pudo generar la constancia', mensaje) } catch {}
      setError(mensaje)
    } finally {
      setGenerando(false)
    }
  }
  const maxDescargas = Number(estado?.maxDescargas ?? curso?.constancia_max_descargas ?? 2) || 2
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
        <p className="nota">La constancia toma el nombre de tu perfil y conserva ese nombre durante todas sus descargas.
          </p>
      </div>
      <div className="bloque-cerrado">
        {estado?.limiteAlcanzado ? (
          <>
            <p className="aviso-ok">Esta constancia ya alcanzó el límite de {maxDescargas} {maxDescargas === 1 ? 'descarga' : 'descargas'}.</p>
            {ultimaEmision && (
              <p><button type="button" className="button primary" onClick={reabrir}>Abrir mi constancia otra vez</button>
                <span className="nota"> No gasta otra descarga; disponible mientras no recargues esta página.</span></p>
            )}
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
            {ultimaEmision && (
              <p><button type="button" className="button secondary" onClick={reabrir}>Abrir mi constancia otra vez</button>
                <span className="nota"> No gasta otra descarga; disponible mientras no recargues esta página.</span></p>
            )}
            <p className="nota">Descargas usadas: {Number(estado?.descargas || 0)} de {maxDescargas}. Cada vez que generas la constancia se consume una.</p>
            {folio && <p className="constancia-folio">
              <span className="sutil">Folio {folio} ·</span>{' '}
              <Link className="enlace-texto" to={`/verificar/${folio}`}>verificar constancia</Link>
            </p>}
            <p className="nota">Se abre en una ventana nueva con los botones «Descargar PDF» e «Imprimir / Guardar como PDF». Guárdala antes de cerrarla.</p>
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
