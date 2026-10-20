import { getAgenda } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'

export default function Agenda({ user }) {
  const { data: agenda, loading, error } = useServiceData(getAgenda, user)

  return (
    <section>
      <h1>Agenda</h1>
      <div className="panel">
        <div className="toolbar">
          <span className="tag">Semana actual · {user?.unit || 'Unidad asignada'}</span>
        </div>
        {!user?.authUserId && (
          <p className="form-hint" role="note">
            Datos simulados: la agenda real muestra tipo y estado, sin nombres de personas usuarias.
            La programación de citas aún requiere el flujo controlado pendiente de grants mínimos.
          </p>
        )}
        {loading && <p role="status">Cargando agenda…</p>}
        {error && <p className="form-error" role="alert">No se pudo cargar la agenda: {error}</p>}
        <ul className="list">
          {(agenda || []).map((item) => (
            <li key={item.id || `${item.hora}-${item.titulo}`} className="agenda-item">
              <strong>{item.hora}</strong>
              <div>
                <span>{item.titulo}</span>
                <small>{item.tipo} · {item.responsable}</small>
              </div>
            </li>
          ))}
        </ul>
        {!loading && !error && !agenda?.length && (
          <p className="empty-state" role="status">No hay citas visibles en los próximos siete días.</p>
        )}
      </div>
    </section>
  )
}
