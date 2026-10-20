import { useEffect, useRef, useState } from 'react'
import { isExperienciaDemo } from '../lib/permissions'

export default function ChatInterno({ user }) {
  const esDemo = isExperienciaDemo(user)
  if (esDemo) {
    return (
      <section>
        <h1>Chat clínico</h1>
        <p className="form-hint" role="note">
          Exploración DEMO: el chat clínico no está disponible en modo de solo lectura.
        </p>
      </section>
    )
  }
  const [salaId, setSalaId] = useState(null)
  const [salaIdParam] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('salaId') || null
  })
  const [sala, setSala] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [salaCargada, setSalaCargada] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (salaIdParam) {
      setSalaId(Number(salaIdParam))
      loadSala()
    }
  }, [salaIdParam])

  const loadSala = async () => {
    if (!salaId) return
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/rpc/pasmu_chat_salas_listar', {
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await resp.json()
      const salas = data || []
      const sala = salas.find(s => s.id === salaId)
      if (!sala) throw new Error('Sala no encontrada o sin permiso.')
      setSala(sala)
      setMensajes([])
      loadMensajes()
      setSalaCargada(true)
    } catch (err) {
      setError(err.message || 'No se pudo cargar la sala.')
    } finally {
      setLoading(false)
    }
  }

  const loadMensajes = async () => {
    if (!salaId) return
    try {
      const resp = await fetch('/rpc/pasmu_chat_mensajes_listar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_sala_id: salaId, p_limite: 50 })
      })
      const data = await resp.json()
      setMensajes(data || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los mensajes.')
    }
  }

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !salaId) return
    setLoading(true)
    try {
      const resp = await fetch('/rpc/pasmu_chat_mensaje_crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_sala_id: salaId, p_contenido: nuevoMensaje.trim(), p_tipo: 'texto' })
      })
      const data = await resp.json()
      setMensajes(prev => [...data])
      setNuevoMensaje('')
      loadMensajes()
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (salaId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensajes, salaId])

  return (
    <section>
      <h1>Chat clínico</h1>

      {!sala && (
        <div className="panel">
          <div className="toolbar">
            <h2>Selecciona una sala de chat</h2>
            {loading && <span className="status-pill">Cargando…</span>}
          </div>
          <div className="list compact">
            <li style={{ border: '1px solid #e4edf7', borderRadius: '8px', padding: '10px 12px', background: '#f7fbff' }}>
              <strong>Sala de salud general</strong>
              <p className="form-hint">Room clínica para terapeutas, supervisores y coordinadores.</p>
              <button type="button" className="primary-btn" onClick={() => setSalaId(1)}>
                Abrir chat
              </button>
            </li>
          </div>
        </div>
      )}

      {sala && (
        <div className="panel">
          <div className="toolbar">
            <h2>Sala: {sala.nombre}</h2>
            <span className="status-pill">{sala.tipo}</span>
          </div>

          <div className="list compact" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {mensajes.map((m) => (
              <div key={m.id} style={{
                border: '1px solid #e4edf7', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', background: m.enviado_por === user?.id ? '#f0f7ff' : '#ffffff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ color: '#1c5a9d' }}>{m.usuario || '—'}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#5f6c7b' }}>{new Date(m.creado_en).toLocaleTimeString('es-MX')}</span>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.contenido}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="auth-form" onSubmit={enviarMensaje}>
            <div className="form-group">
              <label className="field-label" htmlFor="mensaje">Mensaje del clínico</label>
              <textarea
                id="mensaje"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                rows={3}
                placeholder="Escribe un mensaje clínico"
                required
              />
            </div>
            <button type="submit" className="primary-btn" disabled={loading || !nuevoMensaje.trim()}>
              {loading ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {!sala && !loading && !error && <p className="form-hint">Selecciona una sala para comenzar.</p>}
    </section>
  )
}