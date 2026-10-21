/* ============================================================
   UI COMPARTIDA
   Piezas reutilizadas por varias pantallas. Extraído de App.jsx
   durante el refactor (etapa 2b). Mismo render, mismo comportamiento.
   ============================================================ */

import { Component, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { analizarUrl } from '../lib/helpers'
import { subirPdfBoton, borrarPdfBoton } from '../lib/botonesPdf'
import { WA_MENSAJE_CONSULTA, LOGO_BLANCO, MARCA, REDES, ESTILOS_BOTON } from '../config'
import { TextoEditable, ListaEditable, BotonEditable } from './Editable'

/* ------------------------------------------------------------
   BARRERA DE ERRORES
   ------------------------------------------------------------
   Un error lanzado al pintar (o dentro de un useEffect) que nadie
   captura desmonta TODA la aplicación: la pantalla queda en blanco, sin
   menú ni pista de qué pasó. Fue justo lo que ocurrió con el foro.

   Con esta barrera se ve un aviso con el motivo y el resto de la web
   sigue en pie. Se remonta sola al cambiar de ruta (ver `key` en App).
   ------------------------------------------------------------ */
export class BarreraErrores extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error al pintar la pantalla:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <section className="contenedor">
          <h2 className="titulo-seccion">Algo se rompió al cargar esta pantalla</h2>
          <p className="aviso-error" style={{ marginBottom: 14 }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button type="button" className="button primary"
                  onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
        </section>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------
   PORTAL DE MODALES
   Todo modal se monta con un portal directo a <body>. Sin esto, un modal
   renderizado dentro de una tarjeta con hover (transform: translateY en
   .course-card, por ejemplo) queda "atrapado" dentro de esa tarjeta en vez de
   cubrir toda la pantalla: cualquier ancestro con transform/filter crea un
   nuevo containing block para position:fixed, así que el modal se ve chico y
   parpadea al entrar/salir del hover.
   ------------------------------------------------------------ */
/* El contrato de accesibilidad de un diálogo, en un solo sitio. Los ~32
   modales que usan ModalPortal lo heredan sin tocarse:
   · role="dialog" + aria-modal => el lector de pantalla lo anuncia como
     diálogo en vez de leer el fondo.
   · bloqueo del scroll del fondo => en móvil el fondo deja de arrastrarse
     al desplazar un modal alto.
   · Escape y retorno del foco => SOLO cuando el llamador pasa `onClose`,
     para no cambiar el comportamiento de los que no lo esperan.
   Todo es aditivo: un modal que no pase `onClose` se comporta igual que
   antes, solo que ahora se anuncia y no deja correr el fondo. */
export function ModalPortal({ children, onClose, label }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const foco = document.activeElement
    const alTeclear = (e) => { if (e.key === 'Escape' && onClose) onClose() }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', alTeclear)
      // Devuelve el foco a quien abrió el modal, si sigue en el documento.
      if (foco && typeof foco.focus === 'function' && document.contains(foco)) {
        foco.focus()
      }
    }
  }, [onClose])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label || undefined} style={{ display: 'contents' }}>
      {children}
    </div>,
    document.body
  )
}

export function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Ruta de navegación">
      {items.map((it, i) => (
        <span key={i}>
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
          {i < items.length - 1 && <span className="bc-sep">›</span>}
        </span>
      ))}
    </nav>
  )
}

export function WhatsAppFlotante() {
  return (
    <BotonEditable clave="sitio.whatsapp.flotante" clase="wa-flotante" lapizDentro
      ariaLabel="Escríbeme por WhatsApp"
      defecto={{ texto: 'WhatsApp', mensaje: WA_MENSAJE_CONSULTA }}
      pintar={(t) => <><span className="wa-icono" aria-hidden="true">💬</span><span className="wa-texto">{t}</span></>} />
  )
}

export function BandaRedes() {
  return (
    <section className="banda-redes">
      <div className="banda-redes-inner">
        <div className="banda-redes-marca">
          <img src={LOGO_BLANCO} alt="Dr. Ernesto Cotonieto" className="banda-redes-logo" />
          <div>
            <TextoEditable as="p" className="banda-redes-nombre" clave="perfil.nombre" defecto={MARCA.nombre} />
            <TextoEditable as="p" className="banda-redes-credencial" clave="perfil.credencial" defecto={MARCA.credencial} />
          </div>
        </div>
        <div className="banda-redes-sociales">
          <TextoEditable as="p" className="banda-redes-titulo" clave="pie.redes.titulo" defecto="Sígueme" />
          {/* Misma clave que la portada: se editan una vez y cambian en los dos sitios. */}
          <ListaEditable clave="sitio.redes" defecto={REDES} etiqueta="Redes sociales"
            campos={[{ k: 'nombre', etiqueta: 'Nombre' }, { k: 'corto', etiqueta: 'Texto corto' },
              { k: 'url', etiqueta: 'Enlace' }, { k: 'icono', etiqueta: 'Icono' }]}>
            {(items) => (
              <div className="banda-redes-iconos">
                {items.map((r, i) => (
                  <a key={i} className="banda-redes-icono" href={r.url}
                     target="_blank" rel="noopener noreferrer" title={r.nombre}>
                    <span aria-hidden="true">{r.icono}</span>
                    <span>{r.corto}</span>
                  </a>
                ))}
              </div>
            )}
          </ListaEditable>
        </div>
        <div className="banda-redes-legal">
          <TextoEditable as="p" className="banda-redes-legal-texto" clave="pie.aviso"
            defecto="El contenido de este sitio es informativo y formativo, y no sustituye la atención clínica individual. Si estás en una situación de urgencia, comunícate al 911 o a la Línea de la Vida 800 911 2000 (24 h, México)." />
          <TextoEditable as="p" className="banda-redes-copy" clave="pie.copy"
            datos={{ anio: new Date().getFullYear() }}
            defecto="© {anio} Dr. Ernesto Cotonieto. Todos los derechos reservados. (v2)" />
        </div>
      </div>
    </section>
  )
}

export function NavegacionFlotante({ prev, next, curso, mostrarConstancia }) {
  const navigate = useNavigate()
  return (
    <nav className="nav-flotante" aria-label="Navegación del módulo">
      <button type="button" className="nav-flotante-btn" onClick={() => navigate('/')}>
        <span className="nav-flotante-icono">🏠</span>
        <span className="nav-flotante-texto">Inicio</span>
      </button>
      <button type="button" className="nav-flotante-btn" disabled={!prev}
              onClick={() => prev && navigate(`/modulo/${prev.id}`)}>
        <span className="nav-flotante-icono">←</span>
        <span className="nav-flotante-texto">Anterior</span>
      </button>
      {curso && (
        <button type="button" className="nav-flotante-btn" onClick={() => navigate(`/curso/${curso.id}`)}>
          <span className="nav-flotante-icono">📚</span>
          <span className="nav-flotante-texto">Curso</span>
        </button>
      )}
      {next ? (
        <button type="button" className="nav-flotante-btn destacado" onClick={() => navigate(`/modulo/${next.id}`)}>
          <span className="nav-flotante-texto">Siguiente</span>
          <span className="nav-flotante-icono">→</span>
        </button>
      ) : (mostrarConstancia && curso) ? (
        <button type="button" className="nav-flotante-btn constancia" onClick={() => navigate(`/constancia/${curso.id}`)}>
          <span className="nav-flotante-icono">🏆</span>
          <span className="nav-flotante-texto">Constancia</span>
        </button>
      ) : (
        <button type="button" className="nav-flotante-btn" disabled>
          <span className="nav-flotante-texto">Fin</span>
        </button>
      )}
    </nav>
  )
}

/* ------------------------------------------------------------
   REPRODUCTORES EMBEBIDOS
   ------------------------------------------------------------ */
export function VideoPlayer({ url }) {
  if (!url) return <div className="aviso-error">La grabación todavía no está disponible. La subiré pronto.</div>
  const { embeddable, embedUrl } = analizarUrl(url)
  const src = embeddable ? embedUrl : url
  return (
    <div className="video-wrapper">
      <iframe src={src} className="video-iframe" title="Video del curso"
              allow="accelerometer; autoplay; camera; microphone; display-capture; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
    </div>
  )
}

export function EmbedFrame({ url }) {
  const { embedUrl } = analizarUrl(url)
  return (
    <div className="embed-wrapper">
      <iframe src={embedUrl || url} className="embed-iframe" title="Material"
              allow="camera; microphone; display-capture; fullscreen; picture-in-picture; clipboard-write" allowFullScreen />
    </div>
  )
}

// Editor reutilizable de "botones libres" — lo usan curso, módulo y ruta/subgrupo.
// El padre es dueño del estado (botones + onChange); este componente es solo la UI.
export function EditorBotonesExtra({ botones, onChange }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const selector = useRef(null)
  const actualizar = (i, campo, valor) =>
    onChange(botones.map((b, idx) => idx === i ? { ...b, [campo]: valor } : b))
  const agregar = () => onChange([...botones, { texto: '', url: '', estilo: 'azul', activo: true }])
  const eliminar = (i) => {
    // Un PDF recién subido que se descarta no debe quedar huérfano en el almacén.
    if (botones[i]?.archivo && botones[i].nuevo) borrarPdfBoton(botones[i].archivo)
    onChange(botones.flatMap((b, idx) => idx !== i ? [b] :
      b.tipo === 'entregables' ? [{ ...b, eliminado: true }] : []))
  }

  const elegirPdf = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(''); setSubiendo(true)
    try {
      const ruta = await subirPdfBoton(archivo)
      onChange([...botones, {
        texto: archivo.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '),
        url: '', archivo: ruta, nuevo: true, estilo: 'azul', activo: true,
      }])
    } catch (err) { setError(err.message) }
    setSubiendo(false)
  }

  return (
    <>
      {botones.map((b, i) => (
        <div key={i} className="boton-extra-fila">
          {b.eliminado ? <>
            <span>Entregables eliminado</span>
            <button type="button" className="button texto" onClick={() => actualizar(i, 'eliminado', false)}>Restaurar</button>
          </> : <>
          <select value={b.estilo} onChange={e => actualizar(i, 'estilo', e.target.value)}>
            {ESTILOS_BOTON.map(e => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
          </select>
          <input type="text" placeholder="Texto del botón" value={b.texto}
                 onChange={e => actualizar(i, 'texto', e.target.value)} />
          {b.archivo
            ? <span className="nota" style={{ flex: 1, margin: 0 }} title={b.archivo}>
                📄 PDF: {b.archivo.replace(/^\d+_/, '')} · se lee dentro de la plataforma
              </span>
            : <input type="url" placeholder="https://..." value={b.url}
                     onChange={e => actualizar(i, 'url', e.target.value)} />}
          <label className="boton-extra-activo"><input type="checkbox" checked={b.activo !== false}
            onChange={e => actualizar(i, 'activo', e.target.checked)} /> Activo</label>
          <button type="button" className="boton-extra-quitar" onClick={() => eliminar(i)} title="Quitar botón">✕</button>
          </>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="button secondary" onClick={agregar}>➕ Agregar botón</button>
        <button type="button" className="button secondary" onClick={() => selector.current?.click()} disabled={subiendo}>
          {subiendo ? 'Subiendo PDF…' : '📄 Agregar botón con PDF'}
        </button>
        <input ref={selector} type="file" accept="application/pdf,.pdf" onChange={elegirPdf} hidden />
      </div>
      {error && <p className="aviso-error" style={{ marginTop: 8 }}>{error}</p>}
    </>
  )
}
