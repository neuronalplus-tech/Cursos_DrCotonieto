import { getCasos, getExpediente } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NotaSoap from './NotaSoap'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

export default function Expediente({ user }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [soapCaseId, setSoapCaseId] = useState(null)
  const caseId = searchParams.get('casoId')
  const { data: casos, loading: casesLoading, error: casesError } = useServiceData(getCasos, user)
  const { data: expediente, loading, error } = useServiceData(getExpediente, user, caseId)

  useEffect(() => {
    if (!caseId && casos?.length) {
      setSearchParams({ casoId: String(casos[0].id) }, { replace: true })
    }
  }, [caseId, casos, setSearchParams])

  const openSoap = (id) => {
    setSoapCaseId(id)
    setSoapStep(0)
  }

  const closeSoap = () => {
    setSoapCaseId(null)
    setSoapStep(0)
  }

  const fechaApertura = expediente?.fecha_apertura
    ? new Date(expediente.fecha_apertura).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  const esDemo = isExperienciaDemo(user)
  const puedeEditar = hasPermission(user, 'expediente.editar') && !esDemo

  const equipo = expediente?.caso_profesionales
    ? [...new Set(expediente.caso_profesionales.map((p) => p.persona?.nombre || p.persona_id || p.profesional || ''))].filter(Boolean)
    : []

  return (
    <section>
      <h1>Expediente clínico</h1>
      {casesLoading && <p role="status">Cargando casos disponibles…</p>}
      {casesError && <p className="form-error" role="alert">No se pudieron cargar los casos: {casesError}</p>}
      {!!casos?.length && (
        <label className="case-picker">
          Caso
          <select value={caseId || ''} onChange={(event) => setSearchParams({ casoId: event.target.value })}>
            {casos.map((caso) => (
              <option key={caso.id} value={caso.id}>{caso.paciente} · {caso.estado}</option>
            ))}
          </select>
        </label>
      )}
      {loading && caseId && <p role="status">Cargando expediente…</p>}
      {error && <p className="form-error" role="alert">No se pudo cargar el expediente: {error}</p>}
      {!caseId && !casesLoading && !casos?.length && <p>No hay expedientes disponibles para tu perfil.</p>}
      {!caseId && !!casos?.length && <p>Selecciona un caso para consultar su expediente.</p>}
      {!loading && caseId && !expediente && !error && <p>No hay expediente disponible para este caso.</p>}

      {expediente && (
        <div className="panel">
          <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
            <h2>Ficha del expediente</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" className="primary-btn" onClick={() => openSoap(caseId)} disabled={!puedeEditar}>
                {puedeEditar ? 'Nueva nota clínica' : 'Comunicado'}
              </button>
              {!esDemo && <a href={`/expediente/exportar?casoId=${caseId}`} className="secondary-btn">Exportar PDF</a>}
              {!puedeEditar && (
                <span className="status-pill" style={{ background: '#e7f0f7', color: '#1c5a9d' }}>Solo lectura</span>
              )}
            </div>
          </div>

          <div className="module-grid" style={{ marginTop: '16px' }}>
            <div>
              <h3>Datos del caso</h3>
              <ul className="list compact">
                <li><strong>Paciente:</strong> {expediente.paciente}</li>
                <li><strong>Motivo de referencia:</strong> {expediente.motivo}</li>
                {fechaApertura && <li><strong>Apertura:</strong> {fechaApertura}</li>}
                <li><strong>Unidad:</strong> {expediente.datos.find((d) => d.etiqueta === 'Unidad')?.valor || '—'}</li>
                <li><strong>Estado:</strong> {expediente.datos.find((d) => d.etiqueta === 'Estado')?.valor || '—'}</li>
                {equipo.length > 0 && <li><strong>Equipo:</strong> {equipo.join(', ')}</li>}
              </ul>
            </div>

            <div>
              <h3>Historial relevante</h3>
              <ul className="list compact">
                {expediente.historial.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
                {!expediente.historial?.length && <li>Sin historial registrado en esta vista.</li>}
              </ul>
            </div>
          </div>

          <div className="panel" style={{ marginTop: '16px' }}>
            <h3>Notas clínicas</h3>
            <p className="form-hint">Familia SOAP: Subjetivo, Objetivo, Evaluación y Plan. La vista actual es lectora; la edición está disponible para los roles autorizados.</p>

            {soapCaseId === caseId && (
              <div style={{ marginTop: '12px' }}>
                <NotaSoap caseId={soapCaseId} onSaved={closeSoap} user={user} />
              </div>
            )}

            <div className="list compact" style={{ marginTop: '12px' }}>
              <li style={{ border: '1px solid #e4edf7', borderRadius: '8px', padding: '10px 12px', background: '#f7fbff' }}>
                <strong>Última nota:</strong> {expediente.ultimaNota}
              </li>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
