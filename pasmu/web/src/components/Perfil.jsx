import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Perfil({ user }) {
  const [saveMode, setSaveMode] = useState(false)
  const [form, setForm] = useState({
    nombre: user?.name || '',
    apellidos: user?.apellidos || '',
    unidad: user?.unit || '',
    programa: user?.program || '',
    foto: user?.foto || null
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const guardar = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('personas')
        .update({ nombre: form.nombre, apellidos: form.apellidos, unidad: form.unidad, programa: form.programa })
        .eq('auth_user_id', user?.authUserId)
        .select()
        .single()
      if (error) throw error
      setMessage('Perfil actualizado.')
      setSaveMode(false)
    } catch (err) {
      setError(err.message || 'No se pudo guardar el perfil.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h1>Perfil</h1>
      {message && <p className="form-hint" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="panel">
        <div className="toolbar">
          <h2>Datos personales</h2>
          <button type="button" className="primary-btn" onClick={() => setSaveMode(!saveMode)}>
            {saveMode ? 'Cancelar' : 'Guardar cambios'}
          </button>
        </div>

        <form className="auth-form" onSubmit={guardar}>
          <div className="login-grid">
            <label className="form-group">
              <span className="field-label">Nombre</span>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre"
              />
            </label>
            <label className="form-group">
              <span className="field-label">Apellidos</span>
              <input
                type="text"
                value={form.apellidos}
                onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                placeholder="Apellidos"
              />
            </label>
          </div>

          <div className="login-grid">
            <label className="form-group">
              <span className="field-label">Unidad</span>
              <input
                type="text"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="Unidad (ej. UAPA)"
              />
            </label>
            <label className="form-group">
              <span className="field-label">Programa</span>
              <input
                type="text"
                value={form.programa}
                onChange={(e) => setForm({ ...form, programa: e.target.value })}
                placeholder="Programa (ej. SSP)"
              />
            </label>
          </div>

          {saveMode && (
            <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: '12px' }}>
              {loading ? 'Guardando…' : 'Guardar perfil'}
            </button>
          )}
        </form>
      </div>

      <div className="panel">
        <h2>Seguridad</h2>
        <p className="form-hint">Cambia tu contraseña desde <a href="/login">Iniciar sesión</a> → menú de usuario.</p>
      </div>

      <div className="panel">
        <h3>Tu rol y permisos</h3>
        <ul className="list compact">
          <li><strong>Rol:</strong> <strong>{user?.roleName || user?.role}</strong></li>
          <li><strong>Unidad:</strong> {user?.unit || '—'}</li>
          <li><strong>Programa:</strong> {user?.program || '—'}</li>
          <li><strong>Membresías activas:</strong> {user?.contexts?.length || 0}</li>
        </ul>
        {user?.permissions && user.permissions.length > 0 && (
          <ul className="list compact">
            <li><strong>Permisos asignados:</strong> {user.permissions.join(', ')}</li>
          </ul>
        )}
      </div>
    </section>
  )
}