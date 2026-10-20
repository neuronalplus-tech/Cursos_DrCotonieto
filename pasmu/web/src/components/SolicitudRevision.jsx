import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCasos } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

export default function SolicitudRevision({ user }) {
  const esDemo = isExperienciaDemo(user)
  if (esDemo) {
    return (
      <section>
        <h1>Solicitud de revisión</h1>
        <p className="form-hint" role="note">
          Exploración DEMO: la solicitud de revisiones no está disponible en modo de solo lectura.
        </p>
      </section>
    )
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const caseId = searchParams.get('casoId')
  const { data: casos, loading: casesLoading, error: casesError } = useServiceData(getCasos, user)
  const [revisiones, setRevisiones] = useState([])
  const [nuevo, setNuevo] = useState({ casoId: '', notaId: '', comentario: '' })
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (!caseId) return
    const listarRevisiones = async () => {
      try {
        const { data, error } = await fetch(`/rpc/pasmu_revisiones_listar?p_caso_id=${caseId}`, {
          headers: { 'Content-Type': 'application/json' }
        }).then(async (r) => r.json())
        if (error) throw error
        setRevisiones(data || [])
      } catch (error) {
        setMensaje(`No se pudieron cargar las revisiones: ${error.message}`)
      }
    }
    listarRevisiones()
  }, [caseId])

  const solicitarRevision = async (e) => {
    e.preventDefault()
    if (!nuevo.casoId || !nuevo.notaId || !nuevo.comentario.trim()) return
    try {
      const { data, error } = await fetch('/rpc/pasmu_supervision_solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_caso_id: Number(nuevo.casoId),
          p_nota_id: Number(nuevo.notaId),
          p_comentario: nuevo.comentario.trim()
        })
      }).then(async (r) => r.json())
      if (error) throw error
      setMensaje(`Revisión solicitada: ${data[0]?.estado || 'pendiente'}`)
      setNuevo({ casoId: '', notaId: '', comentario: '' })
      // Recargar la lista (en una app real se usaría estado global)
      setRevisiones((prev) => [data[0], ...prev])
    } catch (error) {
      setMensaje(`Error: ${error.message}`)
    }
  }

  return (
    <section>
      <h1>Solicitud de revisión</h1>
      {casesLoading && <p role="status">Cargando casos…</p>}
      {casesError && <p className="form-error" role="alert">{casesError}</p>}
      {!!casos?.length && (
        <>
          <label className="case-picker">
            Caso
            <select value={nuevo.casoId} onChange={(e) => setNuevo({ ...nuevo, casoId: e.target.value })}>
              {casos.map((c) => <option key={c.id} value={c.id}>{c.paciente}</option>)}
            </select>
          </label>
          <label className="note-picker">
            Nota SOAP
            <select value={nuevo.notaId} onChange={(e) => setNuevo({ ...nuevo, notaId: e.target.value })}>
              <option value="">Selecciona una nota…</option>
            </select>
          </label>
          <div className="form-group">
            <label className="field-label" htmlFor="comentario">Comentario de solicitud</label>
            <textarea id="comentario" value={nuevo.comentario} onChange={(e) => setNuevo({ ...nuevo, comentario: e.target.value })} rows={3} placeholder="Ej.: Revisión de estado del caso, ausencia de notas en la semana." />
          </div>
          <button type="button" className="primary-btn" onClick={solicitarRevision} disabled={!nuevo.casoId || !nuevo.notaId}>Solicitar revisión</button>
        </>
      )}
      {!caseId && !casesLoading && !!casos?.length && <p className="form-hint">Selecciona un caso y nota para solicitar una revisión.</p>}

      {revisiones.length > 0 && (
        <div className="panel">
          <h3>Revisiones activas</h3>
          <ul className="list compact">
            {revisiones.map((r) => (
              <li key={r.id} style={{
                border: '1px solid #e4edf7', borderRadius: '8px', padding: '10px 12px',
                background: r.estado === 'atendida' ? '#e8f8f0' : r.estado === 'justificada' ? '#fffdf5' : '#f7fbff'
              }}>
                <strong>Nota {r.nota_id || '—'}</strong> · Estado: <strong>{r.estado}</strong>
                <p style={{ fontSize: '0.9rem', color: '#5f6c7b', margin: '6px 0 0' }}>{r.comentario}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!revisiones.length && !mensaje && <p className="form-hint">No hay revisiones activas.</p>}
      {mensaje && <p className="form-hint" role="status">{mensaje}</p>}
    </section>
  )
}