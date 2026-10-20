import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { ROLES, ROLE_ORDER, USERS } from '../lib/permissions'
import { checkSupabaseConnection, isSupabaseConfigured } from '../lib/supabase'

export default function Login({ onLogin, authError, hasSession, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [connection, setConnection] = useState({ status: 'checking', message: 'Verificando conexión…' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState(ROLE_ORDER[4])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const configured = isSupabaseConfigured()

  useEffect(() => {
    let active = true

    checkSupabaseConnection()
      .then(({ configured: isConfigured, connected }) => {
        if (!active) return
        setConnection(isConfigured && connected
          ? { status: 'connected', message: 'Supabase conectado.' }
          : { status: 'local', message: 'Modo local: Supabase no está configurado.' })
      })
      .catch((error) => {
        if (!active) return
        setConnection({ status: 'error', message: `No se pudo conectar con Supabase: ${error.message}` })
      })

    return () => {
      active = false
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (submittingRef.current) return

    submittingRef.current = true
    setFormError('')
    setSubmitting(true)

    try {
      await onLogin(email.trim(), password)
      setPassword('')
    } catch (error) {
      setFormError(typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'No se pudo iniciar sesión por un error inesperado.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const simulateLogin = (key) => {
    onLogin(USERS[key])
    navigate('/dashboard')
  }

  const simulateRoleLogin = () => {
    const base = USERS.terapeuta
    onLogin({ ...base, name: `${ROLES[selectedRole]?.name} (demo)`, role: selectedRole })
    navigate('/dashboard')
  }

  return (
    <div className="login-box">
      <h1>Acceso PASMU</h1>
      <p className={`connection-status ${connection.status}`} role="status">{connection.message}</p>
      {location.state?.from && (
        <p className="form-hint" role="status">
          Inicia sesión para abrir el módulo solicitado. Las pantallas están protegidas y no se pueden abrir sin una cuenta autorizada.
        </p>
      )}

      {configured ? (
        <form className="auth-form" onSubmit={submit}>
          <label>
            Rol con el que ingresas (vista diferenciada para auditar)
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} aria-label="Seleccionar rol de ingreso">
              {ROLE_ORDER.map((code) => (
                <option key={code} value={code}>{ROLES[code]?.name}</option>
              ))}
            </select>
          </label>
          <label>
            Correo institucional
            <input
              type="email"
              autoComplete="username"
              required
              disabled={submitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {(formError || authError) && (
            <p className="form-error" role="alert">{formError || authError}</p>
          )}
          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
          {hasSession && (
            <button className="secondary-btn" type="button" onClick={onLogout} disabled={submitting}>
              Cerrar sesión actual
            </button>
          )}
          <p className="form-hint">Las cuentas deben ser creadas por una persona administradora en Supabase Auth y vinculadas a un perfil PASMU. Tu cuenta auditora (ernesto_cotonieto@uaeh.edu.mx) conmuta entre roles solo en demo; con Supabase la vista la deciden tus membresías vigentes, no el selector.</p>
          <p className="form-hint">
            <Link to="/recuperar" className="link-primario">¿Olvidaste tu contraseña?</Link>
          </p>
        </form>
      ) : (
        <>
          <p>1) Elige tu rol, 2) entra y audita su vista diferenciada.</p>
          <label>
            Rol con el que ingresas
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} aria-label="Seleccionar rol de ingreso">
              {ROLE_ORDER.map((code) => (
                <option key={code} value={code}>{ROLES[code]?.name}</option>
              ))}
            </select>
          </label>
          <button className="primary-btn" type="button" onClick={simulateRoleLogin}>
            Entrar como {ROLES[selectedRole]?.name}
          </button>
          <p className="form-hint">O entra con un perfil nominal de prueba:</p>
          <div className="login-grid">
            {Object.entries(USERS).map(([key, user]) => (
              <button key={key} className="login-btn" onClick={() => simulateLogin(key)}>
                {user.name}
                <small>{user.role}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
