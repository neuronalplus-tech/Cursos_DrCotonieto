import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Recuperar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const recuperacionTitle = step === 1 ? 'Recuperar acceso' : step === 2 ? 'Revisa tu correo' : 'Crear nueva contraseña'

  const solicitarEnlace = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/recuperar`
      })
      if (error) throw error
      setMessage('Correo de recuperación enviado. Revisa tu bandeja de entrada (incluye spam).')
      setStep(2)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el correo de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  const guardarPassword = async (e) => {
    e.preventDefault()
    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (nuevaPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
      if (error) throw error
      setMessage('Contraseña actualizada correctamente.')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.message || 'No se pudo guardar la nueva contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const iniciarNuevaPassword = () => {
    const token = searchParams.get('access_token')
    const type = searchParams.get('type')
    if (token && type === 'recovery') {
      setStep(3)
    } else {
      setMessage('Enlace no válido o expirado. Pide uno nuevo desde el inicio de sesión.')
      setStep(1)
    }
  }

  return (
    <section>
      <h1>{recuperacionTitle}</h1>
      {message && <p className="form-hint" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {step === 1 && (
        <form className="auth-form" onSubmit={solicitarEnlace}>
          <label>
            Correo institucional
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@institucion.edu.mx"
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={loading}>Enviar enlace de recuperación</button>
          <p className="form-hint">Enviaremos un enlace a tu correo para crear una nueva contraseña.</p>
        </form>
      )}

      {step === 2 && (
        <div className="panel">
          <h2>Revisa tu correo</h2>
          <p className="form-hint">Enviamos un enlace a <strong>{email}</strong>. Sigue el enlace (puede ir a tu móvil) para crear tu nueva contraseña.</p>
          <button type="button" className="secondary-btn" onClick={() => setStep(1)}>Enviar de nuevo</button>
        </div>
      )}

      {step === 3 && (
        <form className="auth-form" onSubmit={guardarPassword}>
          <h2>Crear nueva contraseña</h2>
          <label>
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </label>
          <label>
            Confirmar contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
            />
          </label>
          <button type="submit" className="primary-btn" disabled={loading}>Guardar contraseña</button>
          <p className="form-hint">La contraseña se guardará y serás redirigido al inicio de sesión.</p>
        </form>
      )}
    </section>
  )
}