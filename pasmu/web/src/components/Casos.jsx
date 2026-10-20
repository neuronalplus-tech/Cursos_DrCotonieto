import { getCasos, crearCasoControlado } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

export default function Casos({ user }) {
  const { data: casos, loading, error } = useServiceData(getCasos, user)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [motivo, setMotivo] = useState('')
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')
  const esDemo = isExperienciaDemo(user)
  const canCreate = hasPermission(user, 'casos.crear') && Boolean(user?.authUserId) && !esDemo
  const statuses = [...new Set((casos || []).map((caso) => caso.estado))]
  const visibleCases = useMemo(() => (casos || []).filter((caso) => {
    const matchesSearch = [caso.paciente, caso.unidad, caso.estado]
      .some((value) => value?.toLowerCase().includes(search.trim().toLowerCase()))
    return matchesSearch && (statusFilter === 'todos' || caso.estado === statusFilter)
  }), [casos, search, statusFilter])

  return (
    <section>
      <h1>Casos y pacientes</h1>
      <div className="panel">
        <div className="toolbar">
          <span className="tag">{user?.unit || 'Unidad asignada'} / Casos visibles</span>
        </div>
        {!user?.authUserId && (
          <p className="form-hint" role="note">
            Datos simulados: prioridad y responsable solo existen en la demo. Con Supabase se muestran
            Expediente, unidad y estado; el responsable figura como No asignado hasta habilitar asignaciones.
          </p>
        )}
        {canCreate && (
          <form
            className="filter-row"
            onSubmit={async (event) => {
              event.preventDefault()
              setFormError('')
              setFormOk('')
              try {
                const id = await crearCasoControlado(user, motivo.trim())
                setFormOk(`Caso ${id} creado con expediente sintético. Sin datos personales.`)
                setMotivo('')
              } catch (submitError) {
                setFormError(submitError.message)
              }
            }}
          >
            <label>
              Motivo genérico (5-500, sin PII)
              <input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Registro inicial pendiente de admisión" />
            </label>
            <button type="submit" className="secondary-btn">Crear caso controlado</button>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            {formOk && <p className="form-hint" role="status">{formOk}</p>}
          </form>
        )}
        <div className="filter-row">
          <label>
            Buscar
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Expediente, unidad o estado" />
          </label>
          <label>
            Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="todos">Todos</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        {loading && <p role="status">Cargando casos…</p>}
        {error && <p className="form-error" role="alert">No se pudieron cargar los casos: {error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Expediente</th><th>Unidad</th><th>Estado</th><th>Prioridad</th><th>Responsable</th>
                {hasPermission(user, 'expediente.ver') && <th>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((caso) => (
                <tr key={caso.id || caso.paciente}>
                  <td>{caso.paciente}</td>
                  <td>{caso.unidad}</td>
                  <td><span className="status-pill">{caso.estado}</span></td>
                  <td>{caso.prioridad}</td>
                  <td>{caso.responsable}</td>
                  {hasPermission(user, 'expediente.ver') && (
                    <td><Link to={`/expediente?casoId=${encodeURIComponent(caso.id)}`}>Abrir expediente</Link></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && visibleCases.length === 0 && casos?.length > 0 && (
          <p className="empty-state" role="status">No hay casos que coincidan con los filtros.</p>
        )}
        {!loading && !error && !casos?.length && (
          <p className="empty-state" role="status">No hay casos visibles para tu perfil.</p>
        )}
      </div>
    </section>
  )
}
