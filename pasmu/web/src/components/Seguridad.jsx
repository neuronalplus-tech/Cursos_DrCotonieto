import { getSeguridadEventos } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'

export default function Seguridad({ user }) {
  const { data: seguridadEventos, loading, error } = useServiceData(getSeguridadEventos, user)

  return (
    <section>
      <h1>Auditoría y seguridad</h1>
      <div className="panel">
        <div className="toolbar">
          <span className="tag">Últimas 24 horas</span>
        </div>
        {loading && <p role="status">Cargando eventos…</p>}
        {error && <p className="form-error" role="alert">No se pudieron cargar los eventos: {error}</p>}
        <ul className="list">
          {(seguridadEventos || []).map((evento) => (
            <li key={`${evento.momento}-${evento.evento}`} className="audit-item">
              <strong>{evento.momento}</strong>
              <div>
                <span>{evento.evento}</span>
                <small>{evento.usuario} · {evento.detalle}</small>
              </div>
            </li>
          ))}
        </ul>
        {!loading && !error && !seguridadEventos?.length && (
          <p>La consulta de auditoría desde el cliente está deshabilitada por seguridad; aún no hay una vista redactada para este módulo.</p>
        )}
      </div>
    </section>
  )
}
