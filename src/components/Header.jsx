import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LOGO_BLANCO } from '../config'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import { usePermisos, useMisPermisos } from '../lib/permisos'
import { TextoEditable, ImagenEditable, BotonEditable } from './Editable'
import Icon from './Icon'

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
  const [misCursos, setMisCursos] = useState([])
  const cajaCuenta = useRef(null)
  const { organizacion } = useOrganizacion()
  // El Centro de gestión es para quien gestiona algo: administra, facilita
  // un curso o tiene un rol. Mismo criterio que la propia página.
  const permisos = usePermisos(user)
  const permisosRol = useMisPermisos(user, organizacion?.id)
  const gestiona = esAdmin || permisos.esFacilitador || permisosRol.tieneAlguno

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

  useEffect(() => {
    if (!cuentaAbierta || !user?.id || misCursos.length) return
    let vivo = true
    ;(async () => {
      const { data: acc } = await supabase.from('acceso')
        .select('curso_id').eq('usuario_id', user.id)
      const ids = [...new Set((acc || []).map(a => a.curso_id))]
      if (!ids.length || !vivo) return
      const { data } = await supabase.from('cursos')
        .select('id, titulo').in('id', ids).order('orden')
      if (vivo) setMisCursos(data || [])
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaAbierta, user?.id])

  // Cerrar el menú de cuenta al pulsar fuera. Sin esto se queda
  // abierto tapando la página hasta que se elige algo.
  useEffect(() => {
    if (!cuentaAbierta) return
    const fuera = (e) => {
      // El diálogo de edición vive en un portal (fuera de la caja): si
      // cerrara el menú, desmontaría el botón que se está editando.
      if (e.target.closest?.('.modal-overlay')) return
      if (cajaCuenta.current && !cajaCuenta.current.contains(e.target)) setCuentaAbierta(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [cuentaAbierta])

  // Los eventos del diálogo de edición (un portal) suben por React hasta
  // aquí: sin este filtro, escribir o pulsar en él llevaba al inicio.
  const desdeElLogo = (e) =>
    e.currentTarget.contains(e.target) && !e.target.closest?.('.editable-lapiz')

  const iniciales = (texto) => {
    const p = String(texto || '?').trim().split(/\s+/)
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-area" role="button" tabIndex={0}
             aria-label="Ir al inicio"
             onClick={(e) => { if (desdeElLogo(e)) navigate('/') }}
             onKeyDown={(e) => {
               // Un role="button" debe responder a Enter Y a Espacio; antes
               // solo a Enter, así que con Espacio la página solo hacía scroll.
               if (e.target !== e.currentTarget) return
               if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/') }
             }}>
          {/* Logo y nombre salen de la organización; el lápiz los
              sobreescribe solo en la cabecera de ESTA organización. */}
          <ImagenEditable clave="encabezado.logo" defecto={marcaLogo} alt={marcaNombre} className="logo-header" />
          <TextoEditable className="brand-name" clave="encabezado.nombre" defecto={marcaNombre} />
        </div>

        <button className="menu-toggle" onClick={() => setMenuAbierto(v => !v)} aria-label="Menú">
          <Icon name="menu" size={24} />
        </button>

        <nav className={`header-actions ${menuAbierto ? 'abierto' : ''}`}>
          {location.pathname !== '/' && (
            <BotonEditable clave="encabezado.inicio" clase="nav-link"
              defecto={{ texto: 'Inicio' }} onClick={() => ir('/')} />
          )}

          {!user && (
            <BotonEditable clave="encabezado.iniciar-sesion" clase="button secundario-claro"
              defecto={{ texto: 'Iniciar sesión' }} onClick={() => ir('/acceso')} />
          )}

          {user && (
            <>
              {/* El buzón sale del menú: es lo que más se consulta y
                  necesita enseñar si hay algo pendiente. */}
              <button className="header-icono" onClick={() => ir('/mensajes')}
                      title={sinLeer ? `${sinLeer} mensaje(s) sin leer` : 'Mensajes'}
                      aria-label={sinLeer ? `Mensajes, ${sinLeer} sin leer` : 'Mensajes'}>
                <Icon name="mail" size={22} />
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
                  <Icon name="chevron-down" size={18} className={cuentaAbierta ? 'girado' : ''} />
                </button>

                {cuentaAbierta && (
                  <div className="header-menu" role="menu">
                    {misCursos.length > 0 && (
                      <>
                        <TextoEditable as="p" className="header-menu-titulo" clave="encabezado.menu.mis-cursos-titulo" defecto="Mis cursos" />
                        {misCursos.map(c => (
                          <button key={c.id} role="menuitem" className="header-menu-curso"
                                  onClick={() => ir(`/curso/${c.id}`)}>
                            {c.titulo}
                          </button>
                        ))}
                        <hr />
                      </>
                    )}
                    <BotonEditable clave="encabezado.menu.mis-cursos" clase="" role="menuitem"
                      defecto={{ texto: 'Mis cursos' }} onClick={() => ir('/mis-cursos')} />
                    <BotonEditable clave="encabezado.menu.perfil" clase="" role="menuitem"
                      defecto={{ texto: 'Mi perfil' }} onClick={() => ir('/perfil')} />
                    <BotonEditable clave="encabezado.menu.calificaciones" clase="" role="menuitem"
                      defecto={{ texto: 'Mis calificaciones' }} onClick={() => ir('/mis-calificaciones')} />
                    <BotonEditable clave="encabezado.menu.calendario" clase="" role="menuitem"
                      defecto={{ texto: 'Calendario' }} onClick={() => ir('/calendario')} />
                    <BotonEditable clave="encabezado.menu.mensajes" clase="" role="menuitem"
                      defecto={{ texto: 'Mensajes' }} onClick={() => ir('/mensajes')}
                      pintar={(t) => `${t}${sinLeer > 0 ? ` (${sinLeer})` : ''}`} />
                    {gestiona && (
                      <BotonEditable clave="encabezado.menu.gestion" clase="destacado" role="menuitem"
                        defecto={{ texto: 'Centro de gestión' }} onClick={() => ir('/gestion')} />
                    )}
                    {esAdmin && (
                      <BotonEditable clave="encabezado.menu.panel" clase="destacado" role="menuitem"
                        defecto={{ texto: 'Panel de administración' }} onClick={() => ir('/admin')} />
                    )}
                    <hr />
                    <BotonEditable clave="encabezado.menu.salir" clase="" role="menuitem"
                      defecto={{ texto: 'Salir' }} onClick={() => { setCuentaAbierta(false); onLogout() }} />
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
