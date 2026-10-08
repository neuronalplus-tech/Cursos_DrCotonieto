import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Breadcrumb, BandaRedes, ModalPortal, EmbedFrame } from './ui'
import { rutaAcceso, FOTO_PERFIL, CHAT_ADJUNTOS_BUCKET } from '../config'
import { firmarAdjunto } from '../lib/adjuntos'
import { usePermisos } from '../lib/permisos'

/* ============================================================
   MENSAJES - bandeja (Supabase Realtime) + pagina completa
   Extraido de App.jsx en el refactor (etapa 2c).
   ============================================================ */

// Contador de canales de Realtime. `supabase.channel(tema)` reutiliza el
// canal con ese tema y `.on(...)` lanza si ya está suscrito, así que cada
// suscripción pide un tema propio. Ver el comentario del efecto.
let CANAL_INBOX = 0

/* ============================================================
   MENSAJES · INBOX (Supabase Realtime)
   ============================================================ */
export default function MensajesInbox({ user, esAdmin }) {
  // El admin ve a todos; el facilitador, a los inscritos de los cursos
  // que gestiona. Ambos necesitan poder iniciar una conversacion.
  const { esFacilitador, cursosGestionados } = usePermisos(user)
  const [conversaciones, setConversaciones] = useState([])
  const [chatCon, setChatCon] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [msgExito, setMsgExito] = useState('')
  const mensajesEndRef = useRef(null)
  const inputRef = useRef(null)

  const [vistaSidebar, setVistaSidebar] = useState('conversaciones')
  const [contactos, setContactos] = useState([])
  const [cargandoContactos, setCargandoContactos] = useState(false)
  const [cursosLista, setCursosLista] = useState([])
  const [cursoFiltro, setCursoFiltro] = useState('todos')

  const [seleccionadosContactos, setSeleccionadosContactos] = useState(new Set())
  const [modoEnvioMultiple, setModoEnvioMultiple] = useState(false)

  const [archivoAdjunto, setArchivoAdjunto] = useState(null)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user || esAdmin) return
    supabase.rpc('get_admin_id').then(({ data, error }) => {
      if (error) { console.error('adminId error:', error); return }
      if (data) setChatCon(data)
    })
  }, [user, esAdmin])

  useEffect(() => {
    if (!esAdmin || !user) return
    supabase.from('cursos').select('id, titulo').eq('activo', true).order('orden')
      .then(({ data }) => setCursosLista(data || []))
  }, [esAdmin, user])

  useEffect(() => {
    if (!esAdmin || !user) return
    async function load() {
      const { data, error } = await supabase
        .from('mensajes')
        .select('de_id, para_id, created_at, contenido, leido')
        .or(`de_id.eq.${user.id},para_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
      if (error) { setError(error.message); setCargando(false); return }

      const mapa = {}
      ;(data || []).forEach(m => {
        const otro = m.de_id === user.id ? m.para_id : m.de_id
        if (!mapa[otro]) mapa[otro] = { usuario_id: otro, ultimo: m, noLeidos: 0 }
        if (m.para_id === user.id && !m.leido) mapa[otro].noLeidos++
      })

      const ids = Object.keys(mapa)
      if (ids.length > 0) {
        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .in('id', ids)
        ;(perfiles || []).forEach(p => { if (mapa[p.id]) mapa[p.id].nombre = p.nombre_completo })
      }

      setConversaciones(Object.values(mapa))
      setCargando(false)
    }
    load()
  }, [esAdmin, user, mensajes.length])

  useEffect(() => {
    if ((!esAdmin && !esFacilitador) || !user || vistaSidebar !== 'contactos') return
    async function load() {
      setCargandoContactos(true)

      // Facilitador: se arma desde `acceso`, cuyo RLS ya lo acota a los
      // cursos que gestiona. No se usa la vista de admin a proposito:
      // una vista puede ejecutarse con los permisos de su dueño y
      // saltarse RLS, y entonces enseñaria la plataforma entera.
      if (!esAdmin) {
        const ids = [...cursosGestionados]
        if (!ids.length) { setContactos([]); setCargandoContactos(false); return }
        const { data: insc } = await supabase.from('acceso')
          .select('usuario_id, curso_id').in('curso_id', ids)
        const personas = [...new Set((insc || []).map(a => a.usuario_id))]
        if (!personas.length) { setContactos([]); setCargandoContactos(false); return }

        const { data: perfs } = await supabase.from('perfiles')
          .select('id, nombre_completo').in('id', personas)
        const { data: curs } = await supabase.from('cursos')
          .select('id, titulo').in('id', ids)
        const nombrePorId = Object.fromEntries((perfs || []).map(p => [p.id, p.nombre_completo]))
        const tituloPorCurso = Object.fromEntries((curs || []).map(c => [c.id, c.titulo]))

        const porPersona = {}
        for (const a of insc || []) {
          if (a.usuario_id === user.id) continue
          if (!porPersona[a.usuario_id]) {
            porPersona[a.usuario_id] = {
              usuario_id: a.usuario_id,
              email: nombrePorId[a.usuario_id] || '(sin nombre)',
              nombre: nombrePorId[a.usuario_id],
              cursos: [], curso_ids: [],
            }
          }
          const t = tituloPorCurso[a.curso_id]
          if (t && !porPersona[a.usuario_id].cursos.includes(t)) {
            porPersona[a.usuario_id].cursos.push(t)
            porPersona[a.usuario_id].curso_ids.push(a.curso_id)
          }
        }
        setContactos(Object.values(porPersona))
        setCargandoContactos(false)
        return
      }

      setCargandoContactos(true)
      const { data, error } = await supabase
        .from('vista_admin_inscripciones')
        .select('usuario_id, email, nombre_completo, curso, curso_id')
      if (error) { setError(error.message); setCargandoContactos(false); return }

      const mapa = {}
      ;(data || []).forEach(f => {
        if (!f.usuario_id) return
        if (!mapa[f.usuario_id]) {
          mapa[f.usuario_id] = {
            usuario_id: f.usuario_id, email: f.email, nombre: f.nombre_completo,
            cursos: [], curso_ids: [],
          }
        }
        if (f.curso && !mapa[f.usuario_id].cursos.includes(f.curso)) {
          mapa[f.usuario_id].cursos.push(f.curso)
          mapa[f.usuario_id].curso_ids.push(f.curso_id)
        }
      })
      setContactos(Object.values(mapa))
      setCargandoContactos(false)
    }
    load()
  }, [esAdmin, esFacilitador, cursosGestionados, user, vistaSidebar])

  useEffect(() => {
    if (!user || !chatCon || modoEnvioMultiple) return
    async function load() {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .or(`and(de_id.eq.${user.id},para_id.eq.${chatCon}),and(de_id.eq.${chatCon},para_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      if (error) { setError(error.message); return }
      setMensajes(data || [])
    }
    load()
  }, [user, chatCon, modoEnvioMultiple])

  useEffect(() => {
    if (!user) return
    // El nombre del canal lleva un contador a propósito.
    // `supabase.channel(tema)` REUTILIZA el canal existente y `.on(...)`
    // LANZA una excepción si el canal ya está suscrito:
    //   "cannot add postgres_changes callbacks for ... after subscribe()"
    // Como este efecto se repite al abrir otro chat (chatCon cambia) y
    // `removeChannel` es asíncrono, el tema fijo devolvía el canal viejo
    // todavía vivo: la excepción dentro del useEffect tumbaba el árbol
    // entero de React y la página quedaba en blanco.
    let canal = null
    try {
      canal = supabase
        .channel(`inbox-${user.id}-${++CANAL_INBOX}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mensajes' },
          (payload) => {
            const m = payload.new
            if (m.de_id !== user.id && m.para_id !== user.id) return
            if (chatCon && !modoEnvioMultiple) {
              const esDeEsta =
                (m.de_id === user.id && m.para_id === chatCon) ||
                (m.de_id === chatCon && m.para_id === user.id)
              if (esDeEsta) {
                setMensajes(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
              }
            }
          }
        )
        .subscribe()
    } catch (e) {
      // Sin Realtime la bandeja sigue funcionando: solo se pierde la
      // llegada automática de mensajes.
      console.warn('Tiempo real de mensajes no disponible:', e?.message || e)
    }
    return () => {
      if (canal) { try { supabase.removeChannel(canal) } catch { /* ya cerrado */ } }
    }
  }, [user, chatCon, modoEnvioMultiple])

  useEffect(() => {
    if (!user || !chatCon || modoEnvioMultiple) return
    supabase.from('mensajes')
      .update({ leido: true })
      .eq('para_id', user.id)
      .eq('de_id', chatCon)
      .eq('leido', false)
      .then(() => {
        if (esAdmin) {
          setConversaciones(prev => prev.map(c =>
            c.usuario_id === chatCon ? { ...c, noLeidos: 0 } : c
          ))
        }
      })
  }, [user, chatCon, mensajes.length, esAdmin, modoEnvioMultiple])

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const toggleSeleccionContacto = (id) => {
    setSeleccionadosContactos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  const toggleTodosContactos = (lista) => {
    const todos = lista.every(c => seleccionadosContactos.has(c.usuario_id))
    if (todos) {
      setSeleccionadosContactos(new Set())
    } else {
      setSeleccionadosContactos(new Set(lista.map(c => c.usuario_id)))
    }
  }

  const limpiarSeleccion = () => {
    setSeleccionadosContactos(new Set())
    setModoEnvioMultiple(false)
    setNuevoMensaje('')
    setArchivoAdjunto(null)
    setError(null)
  }

  const abrirEnvioMultiple = () => {
    if (seleccionadosContactos.size === 0) return
    if (seleccionadosContactos.size === 1) {
      const soloId = [...seleccionadosContactos][0]
      setChatCon(soloId)
      setModoEnvioMultiple(false)
      setSeleccionadosContactos(new Set())
      return
    }
    setModoEnvioMultiple(true)
    setChatCon(null)
    setNuevoMensaje('')
    setArchivoAdjunto(null)
  }

  const seleccionarArchivo = () => fileInputRef.current?.click()

  const onArchivoSeleccionado = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera los 10 MB. Comprime o elige otro.')
      return
    }
    setError(null)
    setArchivoAdjunto(file)
  }

  const subirArchivo = async () => {
    if (!archivoAdjunto || !user) return null
    setSubiendoArchivo(true)
    try {
      const limpio = archivoAdjunto.name.replace(/[^\w.\-]/g, '_')
      const path = `${user.id}/${Date.now()}_${limpio}`
      const { error: errU } = await supabase.storage
        .from(CHAT_ADJUNTOS_BUCKET)
        .upload(path, archivoAdjunto, { contentType: archivoAdjunto.type })
      if (errU) throw errU
      // Se guarda la RUTA, no una direccion publica: el bucket pasa a
      // ser privado y la direccion se firma al mostrarla.
      const esImagen = archivoAdjunto.type?.startsWith('image/')
      return {
        url: path,
        nombre: archivoAdjunto.name,
        tipo: esImagen ? 'imagen' : 'archivo',
      }
    } finally {
      setSubiendoArchivo(false)
    }
  }

  const enviar = async () => {
    const texto = nuevoMensaje.trim()
    if ((!texto && !archivoAdjunto) || !user || enviando) return

    setEnviando(true)
    setError(null)

    try {
      let adjunto = null
      if (archivoAdjunto) adjunto = await subirArchivo()

      if (modoEnvioMultiple && seleccionadosContactos.size > 0) {
        const destinatarios = [...seleccionadosContactos]
        const inserts = destinatarios.map(para_id => ({
          de_id: user.id,
          para_id,
          contenido: texto || '(adjunto)',
          adjunto_url: adjunto?.url || null,
          adjunto_nombre: adjunto?.nombre || null,
          adjunto_tipo: adjunto?.tipo || null,
        }))
        const { error: errI } = await supabase.from('mensajes').insert(inserts)
        if (errI) throw errI

        setMsgExito(`✓ Enviado a ${destinatarios.length} alumno(s)`)
        setTimeout(() => setMsgExito(''), 3500)
        setNuevoMensaje('')
        setArchivoAdjunto(null)
        setSeleccionadosContactos(new Set())
        setModoEnvioMultiple(false)
        setVistaSidebar('conversaciones')
        return
      }

      if (!chatCon) return
      const { error: errI } = await supabase.from('mensajes').insert({
        de_id: user.id,
        para_id: chatCon,
        contenido: texto || '(adjunto)',
        adjunto_url: adjunto?.url || null,
        adjunto_nombre: adjunto?.nombre || null,
        adjunto_tipo: adjunto?.tipo || null,
      })
      if (errI) throw errI
      setNuevoMensaje('')
      setArchivoAdjunto(null)
      inputRef.current?.focus()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const conversacionesFiltradas = conversaciones.filter(c => {
    if (!busqueda.trim()) return true
    const t = busqueda.toLowerCase()
    return (c.nombre || '').toLowerCase().includes(t)
  })

  const contactosFiltrados = contactos.filter(c => {
    if (cursoFiltro !== 'todos') {
      if (!c.curso_ids?.includes(parseInt(cursoFiltro))) return false
    }
    if (!busqueda.trim()) return true
    const t = busqueda.toLowerCase()
    return (c.nombre || '').toLowerCase().includes(t)
        || (c.email || '').toLowerCase().includes(t)
  })

  const nombreChatActivo = () => {
    const c = conversaciones.find(c => c.usuario_id === chatCon)
    if (c) return c.nombre || 'Alumno'
    const ct = contactos.find(c => c.usuario_id === chatCon)
    if (ct) return ct.nombre || ct.email || 'Alumno'
    return 'Alumno'
  }

  const renderizarTexto = (texto) => {
    if (!texto) return null
    const regex = /(https?:\/\/[^\s]+)/g
    const partes = texto.split(regex)
    return partes.map((p, i) =>
      regex.test(p)
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="chat-link">{p}</a>
        : <span key={i}>{p}</span>
    )
  }

  // Un componente y no una funcion suelta porque firmar la direccion
  // es asincrono: hay que pedirsela al servidor, esperar, y volver a
  // pedirla cuando caduque. Una funcion que devuelve JSX no puede
  // esperar a nada.
  const renderAdjunto = (m) => (m.adjunto_url ? <Adjunto mensaje={m} /> : null)

  const inputFileOculto = (
    <input
      ref={fileInputRef}
      type="file"
      style={{ display: 'none' }}
      onChange={onArchivoSeleccionado}
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
    />
  )

  const previewAdjunto = archivoAdjunto && (
    <div className="chat-adjunto-preview">
      <span className="chat-adjunto-preview-icono">
        {archivoAdjunto.type?.startsWith('image/') ? '🖼️' : '📎'}
      </span>
      <span className="chat-adjunto-preview-nombre">{archivoAdjunto.name}</span>
      <button
        type="button"
        className="chat-adjunto-preview-quitar"
        onClick={() => setArchivoAdjunto(null)}
        title="Quitar adjunto"
      >×</button>
    </div>
  )

  if (!user) return null

  // La vista simplificada (un solo hilo contigo) es la del ALUMNO. El
  // facilitador necesita la bandeja completa: tiene un grupo al que
  // escribir, no una sola conversacion.
  if (!esAdmin && !esFacilitador) {
    return (
      <div className="inbox-simple">
        <header className="inbox-simple-header">
          <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="inbox-avatar-img" />
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Dr. Ernesto Cotonieto</h2>
            <p className="sutil" style={{ margin: 0, fontSize: 12.5 }}>Te responderé pronto</p>
          </div>
        </header>

        <div className="chat-mensajes">
          {mensajes.length === 0 ? (
            <p className="sutil" style={{ textAlign: 'center', marginTop: 40, lineHeight: 1.7 }}>
              Escríbeme lo que necesites.<br />Te responderé pronto.
            </p>
          ) : (
            mensajes.map(m => {
              const esMio = m.de_id === user.id
              return (
                <div key={m.id} className={`chat-mensaje ${esMio ? 'mio' : 'suyo'}`}>
                  <div className="chat-burbuja">
                    {renderizarTexto(m.contenido)}
                    {renderAdjunto(m)}
                  </div>
                  <div className="chat-hora">
                    {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )
            })
          )}
          <div ref={mensajesEndRef} />
        </div>

        {error && (
          <p className="aviso-error" style={{ margin: '8px 12px 0', fontSize: 12.5 }}>{error}</p>
        )}
        {previewAdjunto}

        <div className="chat-input-area">
          <button type="button" className="chat-attach-btn" onClick={seleccionarArchivo}
                  disabled={subiendoArchivo} title="Adjuntar archivo">
            📎
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Escribe un mensaje..."
            value={nuevoMensaje}
            onChange={e => setNuevoMensaje(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
            }}
            rows="1"
          />
          <button type="button" className="chat-enviar-btn" onClick={enviar}
                  disabled={enviando || subiendoArchivo || (!nuevoMensaje.trim() && !archivoAdjunto)}>
            {subiendoArchivo ? '⏳' : '➤'}
          </button>
        </div>
        {inputFileOculto}
      </div>
    )
  }

  const seleccionArray = [...seleccionadosContactos]
  const nombresSeleccionados = seleccionArray
    .map(id => contactos.find(c => c.usuario_id === id))
    .filter(Boolean)

  return (
    <div className="inbox-admin">
      <aside className="inbox-lista">

        <div className="inbox-sidebar-tabs">
          <button
            type="button"
            className={`inbox-sidebar-tab ${vistaSidebar === 'conversaciones' ? 'activa' : ''}`}
            onClick={() => { setVistaSidebar('conversaciones'); setBusqueda(''); limpiarSeleccion() }}
          >💬 Conversaciones</button>
          <button
            type="button"
            className={`inbox-sidebar-tab ${vistaSidebar === 'contactos' ? 'activa' : ''}`}
            onClick={() => { setVistaSidebar('contactos'); setBusqueda('') }}
          >👥 Contactos</button>
        </div>

        {vistaSidebar === 'contactos' && seleccionadosContactos.size > 0 && (
          <div className="inbox-seleccion-bar">
            <span className="inbox-seleccion-count">
              {seleccionadosContactos.size} seleccionado(s)
            </span>
            <button type="button" className="inbox-seleccion-btn" onClick={abrirEnvioMultiple}>
              {seleccionadosContactos.size === 1 ? 'Abrir chat' : '✉️ Enviar mensaje'}
            </button>
            <button type="button" className="inbox-seleccion-cancel" onClick={limpiarSeleccion}>
              Cancelar
            </button>
          </div>
        )}

        {vistaSidebar === 'conversaciones' ? (
          <>
            <div className="inbox-buscar">
              <input
                type="text"
                placeholder="🔍 Buscar conversación..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="inbox-input-buscar"
              />
            </div>
            <div className="inbox-conversaciones">
              {cargando ? (
                <p className="sutil" style={{ padding: 20, textAlign: 'center' }}>Cargando...</p>
              ) : conversacionesFiltradas.length === 0 ? (
                <p className="sutil" style={{ padding: 20, textAlign: 'center', lineHeight: 1.6 }}>
                  Aún no hay conversaciones.<br />
                  Cuando un alumno te escriba aparecerá aquí.<br /><br />
                  <em>Para iniciar una nueva, ve a la pestaña "Contactos".</em>
                </p>
              ) : (
                conversacionesFiltradas.map(c => (
                  <button
                    key={c.usuario_id}
                    type="button"
                    className={`inbox-conv-item ${chatCon === c.usuario_id && !modoEnvioMultiple ? 'activo' : ''} ${c.noLeidos > 0 ? 'no-leido' : ''}`}
                    onClick={() => { setChatCon(c.usuario_id); setModoEnvioMultiple(false) }}
                  >
                    <div className="chat-avatar">
                      {(c.nombre || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="inbox-conv-info">
                      <div className="inbox-conv-nombre">{c.nombre || 'Alumno'}</div>
                      <div className="inbox-conv-preview">
                        {c.ultimo.contenido.substring(0, 45)}
                        {c.ultimo.contenido.length > 45 ? '...' : ''}
                      </div>
                    </div>
                    {c.noLeidos > 0 && <span className="chat-conv-badge">{c.noLeidos}</span>}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="inbox-buscar">
              <select value={cursoFiltro} onChange={e => setCursoFiltro(e.target.value)}
                className="inbox-select-curso">
                <option value="todos">📚 Todos los cursos</option>
                {cursosLista.map(c => (
                  <option key={c.id} value={c.id}>{c.titulo}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="🔍 Buscar alumno..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="inbox-input-buscar"
              />
              {contactosFiltrados.length > 0 && (
                <button
                  type="button"
                  className="inbox-seleccion-cancel"
                  style={{ marginTop: 6, textAlign: 'left', padding: 0 }}
                  onClick={() => toggleTodosContactos(contactosFiltrados)}
                >
                  {contactosFiltrados.every(c => seleccionadosContactos.has(c.usuario_id))
                    ? '☐ Deseleccionar todos'
                    : `☑ Seleccionar los ${contactosFiltrados.length} visibles`}
                </button>
              )}
            </div>
            <div className="inbox-conversaciones">
              {cargandoContactos ? (
                <p className="sutil" style={{ padding: 20, textAlign: 'center' }}>Cargando...</p>
              ) : contactosFiltrados.length === 0 ? (
                <p className="sutil" style={{ padding: 20, textAlign: 'center', lineHeight: 1.6 }}>
                  No se encontraron alumnos<br />con ese criterio.
                </p>
              ) : (
                contactosFiltrados.map(c => {
                  const checked = seleccionadosContactos.has(c.usuario_id)
                  return (
                    <div
                      key={c.usuario_id}
                      className={`inbox-conv-item ${chatCon === c.usuario_id && !modoEnvioMultiple ? 'activo' : ''} ${checked ? 'seleccionado' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setChatCon(c.usuario_id); setModoEnvioMultiple(false) }}
                      onKeyDown={e => { if (e.key === 'Enter') { setChatCon(c.usuario_id); setModoEnvioMultiple(false) } }}
                      style={checked ? { background: '#FFF4E6' } : undefined}
                    >
                      <span
                        className="inbox-conv-check"
                        onClick={e => { e.stopPropagation(); toggleSeleccionContacto(c.usuario_id) }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSeleccionContacto(c.usuario_id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </span>
                      <div className="chat-avatar">
                        {(c.nombre || c.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="inbox-conv-info">
                        <div className="inbox-conv-nombre">{c.nombre || '(sin nombre)'}</div>
                        <div className="inbox-conv-preview">{c.email}</div>
                        {c.cursos.length > 0 && (
                          <div className="inbox-conv-cursos">
                            {c.cursos.slice(0, 2).map((cur, i) => (
                              <span key={i} className="badge-curso" title={cur}>{cur}</span>
                            ))}
                            {c.cursos.length > 2 && (
                              <span className="badge-curso">+{c.cursos.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </aside>

      <main className="inbox-chat">
        {modoEnvioMultiple ? (
          <div className="inbox-chat-multiple">
            <div className="inbox-multiple-header">
              <h3 className="inbox-multiple-titulo">
                📢 Enviando a {nombresSeleccionados.length} alumno(s)
              </h3>
              <div className="inbox-multiple-lista">
                {nombresSeleccionados.slice(0, 6).map((c, i) => (
                  <span key={i}>
                    {c.nombre || c.email}{i < Math.min(nombresSeleccionados.length, 6) - 1 ? ' · ' : ''}
                  </span>
                ))}
                {nombresSeleccionados.length > 6 && (
                  <span> y {nombresSeleccionados.length - 6} más…</span>
                )}
              </div>
            </div>

            <div className="inbox-multiple-body">
              <p className="sutil" style={{ maxWidth: 380, lineHeight: 1.7 }}>
                Escribe el mensaje que quieres enviar a todos.<br />
                Cada alumno lo verá en su propio chat individual.
              </p>
            </div>

            {error && (
              <p className="aviso-error" style={{ margin: '0 14px 8px', fontSize: 12.5 }}>{error}</p>
            )}
            {previewAdjunto}

            <div className="chat-input-area">
              <button type="button" className="chat-attach-btn" onClick={seleccionarArchivo}
                      disabled={subiendoArchivo} title="Adjuntar archivo">
                📎
              </button>
              <textarea
                className="chat-input"
                placeholder={`Escribe el mensaje para ${nombresSeleccionados.length} alumno(s)...`}
                value={nuevoMensaje}
                onChange={e => setNuevoMensaje(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
                }}
                rows="2"
              />
              <button type="button" className="chat-enviar-btn" onClick={enviar}
                      disabled={enviando || subiendoArchivo || (!nuevoMensaje.trim() && !archivoAdjunto)}>
                {enviando ? '...' : (subiendoArchivo ? '⏳' : '➤')}
              </button>
            </div>
          </div>
        ) : !chatCon ? (
          <div className="inbox-vacio">
            <div className="inbox-vacio-icono">💬</div>
            <p className="sutil" style={{ textAlign: 'center', lineHeight: 1.7 }}>
              Selecciona una conversación<br />
              o marca varios contactos y pulsa "Enviar mensaje".
            </p>
          </div>
        ) : (
          <>
            <header className="inbox-chat-header">
              <div className="chat-avatar">{nombreChatActivo().charAt(0).toUpperCase()}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{nombreChatActivo()}</h3>
              </div>
            </header>

            <div className="chat-mensajes">
              {error && (
                <p className="aviso-error" style={{ margin: 12, fontSize: 13 }}>{error}</p>
              )}
              {mensajes.length === 0 ? (
                <p className="sutil" style={{ textAlign: 'center', marginTop: 40 }}>
                  Inicia la conversación.
                </p>
              ) : (
                mensajes.map(m => {
                  const esMio = m.de_id === user.id
                  return (
                    <div key={m.id} className={`chat-mensaje ${esMio ? 'mio' : 'suyo'}`}>
                      <div className="chat-burbuja">
                        {renderizarTexto(m.contenido)}
                        {renderAdjunto(m)}
                      </div>
                      <div className="chat-hora">
                        {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={mensajesEndRef} />
            </div>

            {previewAdjunto}

            <div className="chat-input-area">
              <button type="button" className="chat-attach-btn" onClick={seleccionarArchivo}
                      disabled={subiendoArchivo} title="Adjuntar archivo">
                📎
              </button>
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Escribe un mensaje..."
                value={nuevoMensaje}
                onChange={e => setNuevoMensaje(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
                }}
                rows="1"
              />
              <button type="button" className="chat-enviar-btn" onClick={enviar}
                      disabled={enviando || subiendoArchivo || (!nuevoMensaje.trim() && !archivoAdjunto)}>
                {subiendoArchivo ? '⏳' : '➤'}
              </button>
            </div>
          </>
        )}

        {msgExito && <div className="chat-toast">{msgExito}</div>}
      </main>

      {inputFileOculto}
    </div>
  )
}

/* ============================================================
   MENSAJES · PÁGINA COMPLETA (para alumnos)
   ============================================================ */
export function MensajesPage({ user, esAdmin }) {
  const navigate = useNavigate()
  useEffect(() => { if (!user) navigate(rutaAcceso('/mensajes')) }, [user, navigate])
  if (!user) return null
  return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mensajes' }]} />
      <MensajesInbox user={user} esAdmin={esAdmin} />
      <BandaRedes />
    </section>
  )
}


/* ------------------------------------------------------------
   UN ADJUNTO
   ------------------------------------------------------------
   El bucket es privado, asi que cada adjunto necesita una
   direccion firmada que caduca. Se pide al montar.

   Si no se puede firmar no se enseña un enlace roto ni se cae de
   vuelta a la direccion publica —eso reabriria el agujero—: se dice
   que no esta disponible, que es la verdad.
   ------------------------------------------------------------ */
function Adjunto({ mensaje }) {
  const [url, setUrl] = useState(null)
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const firmada = await firmarAdjunto(supabase, mensaje.adjunto_url)
      if (!vivo) return
      setUrl(firmada)
      setEstado(firmada ? 'listo' : 'error')
    })()
    return () => { vivo = false }
  }, [mensaje.adjunto_url])

  if (estado === 'cargando') {
    return <span className="chat-adjunto-archivo sutil">📎 Abriendo…</span>
  }
  if (estado === 'error' || !url) {
    return (
      <span className="chat-adjunto-archivo sutil"
            title="Puede que el archivo se haya borrado o que no tengas acceso">
        📎 {mensaje.adjunto_nombre || 'Archivo'} · no disponible
      </span>
    )
  }
  if (mensaje.adjunto_tipo === 'imagen') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={mensaje.adjunto_nombre || ''}
             className="chat-adjunto-img" loading="lazy" />
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="chat-adjunto-archivo">
      📎 {mensaje.adjunto_nombre || 'Archivo adjunto'}
    </a>
  )
}
