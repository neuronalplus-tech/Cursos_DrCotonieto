import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LOGO_BLANCO } from '../config'

/** Barra superior: logo, navegación y salida. */
export default function Header({ user, esAdmin, onLogout, nombreUsuario }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const ir = (ruta) => { navigate(ruta); setMenuAbierto(false) }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-area" onClick={() => navigate('/')} role="button" tabIndex={0}
             onKeyDown={(e) => e.key === 'Enter' && navigate('/')}>
          <img src={LOGO_BLANCO} alt="Dr. Ernesto Cotonieto" className="logo-header" />
          <span className="brand-name">Dr. Ernesto Cotonieto</span>
        </div>
        <button className="menu-toggle" onClick={() => setMenuAbierto(v => !v)} aria-label="Menú">☰</button>
        <nav className={`header-actions ${menuAbierto ? 'abierto' : ''}`}>
          {location.pathname !== '/' && <button className="nav-link" onClick={() => ir('/')}>Inicio</button>}
          {user && <button className="nav-link" onClick={() => ir('/perfil')}>Mi perfil</button>}
          {user && !esAdmin && <button className="nav-link" onClick={() => ir('/mensajes')}>💬 Mensajes</button>}
          {esAdmin && <button className="nav-link destacado" onClick={() => ir('/admin')}>Panel</button>}
          {user ? (
            <>
              <span className="user-email" title={nombreUsuario || user.email}>
                {nombreUsuario || user.email}
              </span>
              <button className="button secundario-claro" onClick={onLogout}>Salir</button>
            </>
          ) : (
            <button className="button secundario-claro" onClick={() => ir('/acceso')}>Iniciar sesión</button>
          )}
        </nav>
      </div>
    </header>
  )
}