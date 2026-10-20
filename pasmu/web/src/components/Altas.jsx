import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hasPermission } from '../lib/permissions'
import { parsePadronClinico } from '../lib/anatomiaPasmu'

export default function Altas({ user }) {
  const canAdmin = hasPermission(user, 'admin.roles') || Boolean(!user?.authUserId)
  const [tab, setTab] = useState('equipo')
  const [form, setForm] = useState({ email: '', nombre: '', rol: 'terapeuta' })
  const [padron, setPadron] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  if (!canAdmin) return <p>No tienes permiso para altas.</p>

  const preAlta = async (event) => {
    event.preventDefault()
    setMsg(''); setErr('')
    try {
      if (!supabase) { setMsg('Demo: pre-alta simulada. Con Supabase se valida alcance por unidad.'); return }
      const { data, error } = await supabase.rpc('pasmu_preAlta_equipo', {
        _email: form.email, _nombre: form.nombre, _rol: form.rol, _unidad: user.unitId, _programa: user.programId ?? null,
      })
      if (error) throw error
      setMsg(`Pre-alta ${data} registrada. La cuenta Auth la crea el responsable y se audita por instituto.`)
      setForm({ email: '', nombre: '', rol: 'terapeuta' })
    } catch (e) { setErr(e.message) }
  }

  const preview = parsePadronClinico(padron)

  return (
    <section>
      <h1>Altas por instituto</h1>
      <div className="panel">
        <div className="toolbar">
          <button type="button" className="secondary-btn" onClick={() => setTab('equipo')}>Dar de alta a equipo (terapeuta/supervisor/responsable)</button>
          <button type="button" className="secondary-btn" onClick={() => setTab('paciente')}>Dar de alta a paciente</button>
        </div>
        <p className="form-hint" role="note">
          {tab === 'equipo'
            ? 'Equipo: solo en tus unidades. Se audita quién invitó, a quién y en qué instituto.'
            : 'Paciente: crea persona usuaria + caso con expediente sintético, sin PII. El responsable figura como No asignado hasta vincular terapeuta.'}
        </p>
        {tab === 'equipo' ? (
          <form className="auth-form" onSubmit={preAlta}>
            <label>Correo<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="equipo@ejemplo.mx" /></label>
            <label>Nombre<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre y apellidos" /></label>
            <label>Rol
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                <option value="terapeuta">Terapeuta</option>
                <option value="coordinador_clinico">Coordinación clínica</option>
                <option value="supervisor_clinico">Supervisión clínica</option>
                <option value="responsable_unidad">Responsable de unidad</option>
                <option value="clinico_administrativo">Clínico-administrativo</option>
                <option value="practicante">Prácticas y servicio social</option>
                <option value="tallerista">Tallerista</option>
                <option value="experiencia_demo">Experiencia DEMO (solo lectura, unidad DEMO)</option>
              </select>
            </label>
            <button type="submit" className="primary-btn">Registrar pre-alta (auditable)</button>
          </form>
        ) : (
          <div>
            <label>Padrón (nombre + correo por línea)
              <textarea rows={5} value={padron} onChange={(e) => setPadron(e.target.value)} placeholder={'Ana Ruiz\tana@ejemplo.mx'} />
            </label>
            {preview.filas.length > 0 && <p className="form-hint">{preview.filas.length} filas válidas. Sin crear por typo: revisa errores.</p>}
            {preview.errores.map((e) => <p key={e} className="form-error">{e}</p>)}
          </div>
        )}
        {msg && <p className="form-hint" role="status">{msg}</p>}
        {err && <p className="form-error" role="alert">{err}</p>}
      </div>
    </section>
  )
}
