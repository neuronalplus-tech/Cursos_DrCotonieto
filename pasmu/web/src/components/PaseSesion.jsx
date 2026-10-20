import { useState } from 'react'
import { ESTADOS_SESION } from '../lib/anatomiaPasmu'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

const SIG = { presente: 'ausente', ausente: 'retardo', retardo: 'permiso', permiso: 'presente' }
const SIMBOLO = Object.fromEntries(ESTADOS_SESION.map(([k, , s]) => [k, s]))

export default function PaseSesion({ user }) {
  const [marcas, setMarcas] = useState({ 'Ana R.': 'presente', 'José P.': 'presente', 'Lucía T.': 'presente' })
  const [guardado, setGuardado] = useState(false)
  const esDemo = isExperienciaDemo(user)
  if (!hasPermission(user, 'agenda.ver')) return <p>Sin permiso de agenda.</p>
  return (
    <section>
      <h1>Pase de sesión</h1>
      <div className="panel">
        <p className="form-hint">Todos arrancan en presente; un toque cicla. Se guarda al final, de una vez. Demo sintética.</p>
        {esDemo && (
          <p className="form-hint" role="note">
            Exploración DEMO: consulta de solo lectura; el registro de asistencia está deshabilitado.
          </p>
        )}
        <ul className="list">
          {Object.entries(marcas).map(([nombre, estado]) => (
            <li key={nombre}>
              <button type="button" className="secondary-btn" disabled={esDemo} onClick={() => { setMarcas((m) => ({ ...m, [nombre]: SIG[estado] })); setGuardado(false) }}>
                {SIMBOLO[estado]} {nombre} — {estado}
              </button>
            </li>
          ))}
        </ul>
        {!esDemo && <button type="button" className="primary-btn" onClick={() => setGuardado(true)}>Guardar pase</button>}
        {guardado && <p className="form-hint" role="status">Pase guardado en demo. Con Supabase: `asistencia_sesion` por RPC + bitácora.</p>}
      </div>
    </section>
  )
}
