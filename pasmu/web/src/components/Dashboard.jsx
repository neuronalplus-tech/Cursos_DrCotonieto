import { getDashboardMetrics } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'
import { Link } from 'react-router-dom'
import { getDashboardActions, getDashboardGuidance } from '../lib/dashboardGuidance'

function formatConsultationTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export default function Dashboard({ user }) {
  const { data, loading, error } = useServiceData(getDashboardMetrics, user)
  const guidance = getDashboardGuidance(user)
  const actions = getDashboardActions(user)
  const metrics = data?.metrics || []
  const consultedAt = formatConsultationTime(data?.generatedAt)

  return (
    <section>
      <h1>Dashboard institucional</h1>
      {loading && <p role="status">Cargando resumen…</p>}
      {error && <p className="form-error" role="alert">No se pudo cargar el resumen: {error}</p>}
      {data && (
        <div className="dashboard-scope">
          <strong>Ámbito de consulta:</strong> {data.scope || 'Contexto autorizado'}
          {data.demo
            ? <span className="tag">Datos simulados</span>
            : consultedAt && <span>Consulta realizada: {consultedAt}</span>}
        </div>
      )}
      {metrics.length > 0 && <div className="cards">
        {metrics.map((metric) => (
          <div key={metric.label} className="card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>}
      {!loading && !error && !metrics.length && (
        <p className="empty-state" role="status">No hay métricas disponibles para este contexto.</p>
      )}

      <div className="panel">
        <h2>{guidance.title}</h2>
        <p>{guidance.summary}</p>
        <ul className="list compact">
          {guidance.principles.map((principle) => <li key={principle}>{principle}</li>)}
        </ul>
        {actions.length > 0 && (
          <>
            <h3>Accesos de seguimiento disponibles</h3>
            <div className="dashboard-actions">
              {actions.map((action) => (
                <Link key={action.to} className="secondary-btn" to={action.to}>
                  {action.label}
                </Link>
              ))}
            </div>
          </>
        )}
        <p className="form-hint">
          Este resumen no asigna responsables, no confirma pendientes y no sustituye la revisión profesional ni el cierre institucional de un periodo.
        </p>
      </div>
    </section>
  )
}
