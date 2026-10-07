import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LOGO_BLANCO } from '../config'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'

/* ============================================================
   BARRA SUPERIOR
   ------------------------------------------------------------
   Antes todo colgaba en fila: Inicio · Mi perfil · Mensajes ·
   Panel · nombre · Salir. Con cada rol nuevo la fila crecía y en
   pantallas estrechas se amontonaba.

   Ahora lo que se usa a diario queda a mano (el buzón, con su
   contador) y lo demás se agrupa bajo el nombre, que es donde la
   gente ya lo busca por costumbre.
   ============================================================ */
export default function Header({ user, esAdmin, onLogout, nombreUsuario }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [sinLeer, setSinLeer] = useState(0)
  const [foto, setFoto] = useState(null)
  const cajaCuenta = useRef(null)
  const { organizacion } = useOrganizacion()

  // La marca de quien hospeda, con la de casa como repliegue: una
  // organización sin logo propio no debe quedarse sin cabecera.
  const marcaNombre = organizacion?.nombre || 'Dr. Ernesto Cotonieto'
  const marcaLogo = organizacion?.logo_url || LOGO_BLANCO


  const ir = (ruta) => {
    navigate(ruta)
    setMenuAbierto(false)
    setCuentaAbierta(false)
  }

  // La foto que la persona subió en su perfil. Las iniciales se quedan
  // como repliegue: quien no ha subido ninguna no debe ver un hueco.
  useEffect(() => {
    if (!user?.id) { setFoto(null); return }
    let vivo = true
    supabase.from('perfiles').select('avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (vivo) setFoto(data?.avatar_url || null) })
    return () => { vivo = false }
  }, [user?.id])

  // Mensajes sin leer, para el contador del sobre. Se recalcula al
  // cambiar de pantalla: así baja solo al salir de la bandeja, sin
  // necesidad de mantener una suscripción abierta todo el rato.
  useEffect(() => {
    if (!user?.id) { setSinLeer(0); return }
    let vivo = true
    supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('para_id', user.id)
      .eq('leido', false)
      .then(({ count }) => { if (vivo) setSinLeer(count || 0) })
    return () => { vivo = false }
  }, [user?.id, location.pathname])

  // Cerrar el menú de cuenta al pulsar fuera. Sin esto se queda
  // abierto tapando la página hasta que se elige algo.
  useEffect(() => {
    if (!cuentaAbierta) return
    const fuera = (e) => {
      if (cajaCuenta.current && !cajaCuenta.current.contains(e.target)) setCuentaAbierta(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [cuentaAbierta])

  const iniciales = (texto) => {
    const p = String(texto || '?').trim().split(/\s+/)
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-area" onClick={() => navigate('/')} role="button" tabIndex={0}
             onKeyDown={(e) => e.key === 'Enter' && navigate('/')}>
          <img src={marcaLogo} alt={marcaNombre} className="logo-header" />
          <span className="brand-name">{marcaNombre}</span>
        </div>

        <button className="menu-toggle" onClick={() => setMenuAbierto(v => !v)} aria-label="Menú">☰</button>

        <nav className={`header-actions ${menuAbierto ? 'abierto' : ''}`}>
          {location.pathname !== '/' && <button className="nav-link" onClick={() => ir('/')}>Inicio</button>}

          {!user && (
            <button className="button secundario-claro" onClick={() => ir('/acceso')}>Iniciar sesión</button>
          )}

          {user && (
            <>
              {/* El buzón sale del menú: es lo que más se consulta y
                  necesita enseñar si hay algo pendiente. */}
              <button className="header-icono" onClick={() => ir('/mensajes')}
                      title={sinLeer ? `${sinLeer} mensaje(s) sin leer` : 'Mensajes'}
                      aria-label={sinLeer ? `Mensajes, ${sinLeer} sin leer` : 'Mensajes'}>
                <span aria-hidden="true">✉️</span>
                {sinLeer > 0 && <span className="header-globo">{sinLeer > 99 ? '99+' : sinLeer}</span>}
              </button>

              <div className="header-cuenta" ref={cajaCuenta}>
                <button className="header-cuenta-btn" onClick={() => setCuentaAbierta(v => !v)}
                        aria-expanded={cuentaAbierta} aria-haspopup="menu">
                  {foto
                    ? <img className="header-avatar-img" src={foto} alt="" />
                    : <span className="header-avatar" aria-hidden="true">
                        {iniciales(nombreUsuario || user.email)}
                      </span>}
                  <span className="header-cuenta-nombre">{nombreUsuario || user.email}</span>
                  <span aria-hidden="true">▾</span>
                </button>

                {cuentaAbierta && (
                  <div className="header-menu" role="menu">
                    <button role="menuitem" onClick={() => ir('/perfil')}>Mi perfil</button>
                    <button role="menuitem" onClick={() => ir('/mis-calificaciones')}>
                      Mis calificaciones
                    </button>
                    <button role="menuitem" onClick={() => ir('/mensajes')}>
                      Mensajes{sinLeer > 0 ? ` (${sinLeer})` : ''}
                    </button>
                    {esAdmin && (
                      <button role="menuitem" className="destacado" onClick={() => ir('/admin')}>
                        Panel de administración
                      </button>
                    )}
                    <hr />
                    <button role="menuitem" onClick={() => { setCuentaAbierta(false); onLogout() }}>
                      Salir
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
