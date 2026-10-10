/* ============================================================
   UI COMPARTIDA
   Piezas reutilizadas por varias pantallas. Extraído de App.jsx
   durante el refactor (etapa 2b). Mismo render, mismo comportamiento.
   ============================================================ */

import { Component } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { analizarUrl } from '../lib/helpers'
import { WA_CONSULTA, LOGO_BLANCO, MARCA, REDES, ESTILOS_BOTON } from '../config'

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
export function ModalPortal({ children }) {
  return createPortal(children, document.body)
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
    <a className="wa-flotante" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer" aria-label="Escríbeme por WhatsApp">
      <span className="wa-icono">💬</span><span className="wa-texto">WhatsApp</span>
    </a>
  )
}

export function BandaRedes() {
  return (
    <section className="banda-redes">
      <div className="banda-redes-inner">
        <div className="banda-redes-marca">
          <img src={LOGO_BLANCO} alt="Dr. Ernesto Cotonieto" className="banda-redes-logo" />
          <div>
            <p className="banda-redes-nombre">{MARCA.nombre}</p>
            <p className="banda-redes-credencial">{MARCA.credencial}</p>
          </div>
        </div>
        <div className="banda-redes-sociales">
          <p className="banda-redes-titulo">Sígueme</p>
          <div className="banda-redes-iconos">
            {REDES.map((r) => (
              <a key={r.nombre} className="banda-redes-icono" href={r.url}
                 target="_blank" rel="noopener noreferrer" title={r.nombre}>
                <span aria-hidden="true">{r.icono}</span>
                <span>{r.corto}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="banda-redes-legal">
          <p className="banda-redes-legal-texto">
            El contenido de este sitio es informativo y formativo, y no sustituye la atención clínica individual.
            Si estás en una situación de urgencia, comunícate al <strong>911</strong> o a la Línea de la Vida <strong>800 911 2000</strong> (24 h, México).
          </p>
          <p className="banda-redes-copy">© {new Date().getFullYear()} Dr. Ernesto Cotonieto. Todos los derechos reservados. (v2)</p>
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
  const actualizar = (i, campo, valor) =>
    onChange(botones.map((b, idx) => idx === i ? { ...b, [campo]: valor } : b))
  const agregar = () => onChange([...botones, { texto: '', url: '', estilo: 'azul', activo: true }])
  const eliminar = (i) => onChange(botones.filter((_, idx) => idx !== i))

  return (
    <>
      {botones.map((b, i) => (
        <div key={i} className="boton-extra-fila">
          <select value={b.estilo} onChange={e => actualizar(i, 'estilo', e.target.value)}>
            {ESTILOS_BOTON.map(e => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
          </select>
          <input type="text" placeholder="Texto del botón" value={b.texto}
                 onChange={e => actualizar(i, 'texto', e.target.value)} />
          <input type="url" placeholder="https://..." value={b.url}
                 onChange={e => actualizar(i, 'url', e.target.value)} />
          <label className="boton-extra-activo"><input type="checkbox" checked={b.activo !== false}
            onChange={e => actualizar(i, 'activo', e.target.checked)} /> Activo</label>
          <button type="button" className="boton-extra-quitar" onClick={() => eliminar(i)} title="Quitar botón">✕</button>
        </div>
      ))}
      <button type="button" className="button secondary" style={{ marginTop: 8 }} onClick={agregar}>
        ➕ Agregar botón
      </button>
    </>
  )
}
