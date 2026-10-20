import { NavLink, Outlet } from 'react-router-dom'
import { canAccessRoute, hasPermission, isExperienciaDemo, ROLES } from '../lib/permissions'
import { isSupabaseConfigured } from '../lib/supabase'

const links = [
  { to: '/dashboard', label: 'Dashboard', route: 'dashboard' },
  { to: '/casos', label: 'Casos', route: 'casos' },
  { to: '/agenda', label: 'Agenda', route: 'agenda' },
  { to: '/expediente', label: 'Expediente', route: 'expediente' },
  { to: '/expediente/revisiones', label: 'Revisiones', route: 'revisiones' },
  { to: '/expediente/exportar', label: 'PDF', route: 'exportar' },
  { to: '/reportes', label: 'Reportes', route: 'reportes' },
  { to: '/seguridad', label: 'Seguridad', route: 'seguridad' },
  { to: '/altas', label: 'Altas', route: 'admin' },
  { to: '/banco', label: 'Banco', route: 'expediente' },
  { to: '/pase', label: 'Pase', route: 'agenda' },
  { to: '/admin', label: 'Admin', route: 'admin' },
  { to: '/perfil', label: 'Perfil', route: 'perfil' },
  { to: '/conversacion', label: 'Chat', route: 'chat' }
]

// Roles que pueden ver la sección de revisiones (supervisión)
const rolesConRevisiones = ['supervisor_clinico', 'coordinador_clinico', 'terapeuta']

// Roles que pueden editar notas SOAP
const rolesConEdicion = ['terapeuta', 'coterapeuta', 'coordinador_clinico']

// Roles con acceso al expediente completo
const rolesConExpediente = ['terapeuta', 'coterapeuta', 'coordinador_clinico', 'supervisor_clinico', 'responsable_unidad', 'direccion_pasmu']

// Roles que ven el expediente solo en estado
const rolesConExpedienteSoloEstado = ['clinico_administrativo', 'tallerista']

export default function Layout({ user, authError, onLogout, onContextChange }) {
  const role = user?.role || (user?.contexts?.[0]?.role ?? null)
  const roleName = user?.roleName || (role ? ROLES[role]?.name : 'Sin sesión')
  const puedeRevisiones = rolesConRevisiones.includes(role)
  const puedeEditarNotas = rolesConEdicion.includes(role)
  const puedeExpediente = rolesConExpediente.includes(role)
  const soloExpedienteEstado = rolesConExpedienteSoloEstado.includes(role)

  // Mostrar/ocultar menús según rol
  const visibleLinks = links.filter((link) => {
    if (link.route === 'revisiones' && !puedeRevisiones) return false
    if (link.route === 'exportar' && (!puedeExpediente || isExperienciaDemo(user))) return false
    if (link.route === 'admin' && !hasPermission(user, 'admin.roles')) return false
    return canAccessRoute(user, link.route)
  })
  const esDemo = isExperienciaDemo(user)

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <aside className="sidebar">
        <h2>PASMU</h2>
        <div className="user-box">
          <strong>{user?.name}</strong>
          <span>{roleName}</span>
          <small>{user?.unit}</small>
          {user?.program && <small>{user.program}</small>}
          {user?.contexts?.length > 1 && (
            <label className="context-picker">
              Contexto de trabajo
              <select
                value={user.membershipId}
                onChange={(event) => onContextChange(event.target.value)}
                aria-label="Seleccionar unidad, programa y rol activos"
              >
                {user.contexts.map((context) => (
                  <option key={context.membershipId} value={context.membershipId}>
                    {[context.unit, context.program, context.roleName].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
              <small>El acceso final sigue controlado por RLS y tus membresías vigentes.</small>
            </label>
          )}
        </div>
        <nav>
          {visibleLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'nav active' : 'nav'}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={onLogout}>Cerrar sesión</button>
      </aside>
      <main className="content" id="main-content" tabIndex={-1}>
        {authError && <p className="form-error" role="alert">No se pudo cerrar la sesión: {authError}</p>}
        {esDemo && (
          <p className="data-notice" role="status">
            Exploración DEMO · Solo lectura con datos ficticios. Puedes navegar, no puedes crear, editar ni exportar.
            Vigencia limitada por invitación.
          </p>
        )}
        {isSupabaseConfigured() && (
          <p className="data-notice" role="status">
            {user?.authUserId
              ? 'Sesión autenticada con Supabase. Las consultas reales están limitadas por tus permisos y las políticas RLS. No ingreses información clínica real hasta completar las pruebas de autorización.'
              : 'Modo local de demostración: se muestran datos ficticios. No uses este modo con información clínica real.'}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
