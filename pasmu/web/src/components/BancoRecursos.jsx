import { useState } from 'react'
import { OBJETIVOS_CLINICOS } from '../lib/anatomiaPasmu'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

const DEMO_BANCO = [
  { id: 'r1', tipo: 'autoevaluacion', titulo: 'Estrés percibido (10 ítems, carga manual)', objetivo: 'estres' },
  { id: 'r2', tipo: 'psicoeducativo', titulo: 'PDF: higiene del sueño', objetivo: 'sueno' },
  { id: 'r3', tipo: 'formato', titulo: 'Registro de rumiación entre sesiones', objetivo: 'rumiacion' },
  { id: 'r4', tipo: 'video', titulo: 'Video: respiración diafragmática', objetivo: 'ansiedad' },
  { id: 'r5', tipo: 'guia_tecnica', titulo: 'Guía: cómo aplicar reestructuración (terapeuta)', objetivo: 'ansiedad' },
  { id: 'r6', tipo: 'ludica', titulo: 'Actividad lúdica: jerarquía de exposición', objetivo: 'ansiedad' },
]

export default function BancoRecursos({ user }) {
  const [objetivo, setObjetivo] = useState('todos')
  const [asignados, setAsignados] = useState([])
  const esDemo = isExperienciaDemo(user)
  if (!hasPermission(user, 'expediente.ver')) return <p>Sin permiso de expediente.</p>
  const visibles = DEMO_BANCO.filter((r) => objetivo === 'todos' || r.objetivo === objetivo)
  return (
    <section>
      <h1>Banco de recursos por objetivo clínico</h1>
      <div className="panel">
        <p className="form-hint">Demo con datos sintéticos. Con Supabase: catálogo + `material_del_caso` por RPC, sin lectura directa de archivos.</p>
        {esDemo && (
          <p className="form-hint" role="note">
            Exploración DEMO: puedes consultar el catálogo; la asignación a pacientes está deshabilitada.
          </p>
        )}
        <label>Objetivo
          <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>
            <option value="todos">Todos</option>
            {OBJETIVOS_CLINICOS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <ul className="list">
          {visibles.map((r) => (
            <li key={r.id}>
              <strong>{r.titulo}</strong>
              <small>{r.tipo} · {r.objetivo}</small>
              {!esDemo && (
                <button type="button" className="secondary-btn" onClick={() => setAsignados((a) => [...a, r.id])}>
                  Insertar en módulo del paciente
                </button>
              )}
            </li>
          ))}
        </ul>
        {asignados.length > 0 && <p className="form-hint" role="status">{asignados.length} recurso(s) asignados en esta sesión demo.</p>}
      </div>
    </section>
  )
}
