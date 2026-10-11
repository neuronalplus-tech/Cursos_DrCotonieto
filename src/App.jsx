import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import Home from './components/Home'
import Login from './components/Login'
import Recuperar from './components/Recuperar'
import VerificarConstancia from './components/VerificarConstancia'
import { WhatsAppFlotante, BarreraErrores } from './components/ui'
import './App.css'

/* Alta/C4: lo pesado y lo de rol se carga bajo demanda.
   Antes todo venía eager (Admin + pdfjs + exámenes + talleres) y el
   alumno que solo abría /verificar descargaba el panel entero.
   Rutas públicas y de uso diario quedan eager; el resto va lazy con
   Suspense para no cambiar la navegación. */
const Admin = lazy(() => import('./components/Admin'))
const Perfil = lazy(() => import('./components/Perfil'))
const MisCalificaciones = lazy(() => import('./components/MisCalificaciones'))
const Calendario = lazy(() => import('./components/Calendario'))
const CursoView = lazy(() => import('./components/CursoView'))
const CursoDetalle = lazy(() => import('./components/CursoDetalle'))
const ModuloView = lazy(() => import('./components/ModuloView'))
const Constancia = lazy(() => import('./components/Constancia'))
const ForoCurso = lazy(() => import('./components/ForoCurso'))
/* MensajesInbox exporta default + named: el lazy necesita el default
   como componente para Suspense, así que se envuelve el named. */
const PaginaMensajes = lazy(() => import('./components/MensajesInbox').then(m => ({ default: m.MensajesPage })))

function App() {
  const [session, setSession] = useState(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession()
      const s = data?.session || null
      if (s) {
        const t = localStorage.getItem('login_time')
        if (t && Date.now() - parseInt(t, 10) > 30 * 24 * 60 * 60 * 1000) {
          await supabase.auth.signOut(); localStorage.removeItem('login_time')
          setSession(null); setMessage('Tu acceso expiró. Escríbeme para renovarlo.')
          setLoading(false); return
        }
        if (!t) localStorage.setItem('login_time', String(Date.now()))
      }
      setSession(s); setLoading(false)
    }
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) { localStorage.removeItem('login_time'); setEsAdmin(false); setNombreUsuario('') }
      if (_e === 'PASSWORD_RECOVERY' && window.location.pathname !== '/recuperar') {
        navigate('/recuperar')
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  const user = session?.user || null

  useEffect(() => {
    if (!user) { setEsAdmin(false); setNombreUsuario(''); return }
    supabase.from('admins').select('email').eq('email', user.email).maybeSingle()
      .then(({ data }) => setEsAdmin(!!data))

    supabase.from('perfiles').select('nombre_completo').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.nombre_completo) setNombreUsuario(data.nombre_completo)
      })
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut(); localStorage.removeItem('login_time')
    setSession(null); navigate('/')
  }

  if (loading) return <div className="loading pantalla">Cargando...</div>

  return (
    <>
      <Header user={user} esAdmin={esAdmin} onLogout={handleLogout} nombreUsuario={nombreUsuario} />
      <main className="app-main">
        <BarreraErrores key={pathname}>
          {/* El fallback vive dentro del main para no mover el header ni el
              botón de WhatsApp mientras carga el chunk de la ruta. */}
          <Suspense fallback={<div className="loading pantalla">Cargando…</div>}>
            <Routes>
              <Route path="/" element={<Home user={user} />} />
              <Route path="/acceso" element={<Login message={message} />} />
              <Route path="/recuperar" element={<Recuperar />} />
              <Route path="/perfil" element={<Perfil user={user} />} />
              <Route path="/mis-calificaciones" element={<MisCalificaciones user={user} />} />
              <Route path="/calendario" element={<Calendario user={user} />} />
              <Route path="/admin" element={<Admin user={user} />} />
              <Route path="/curso/:id" element={<CursoView user={user} />} />
              <Route path="/curso/:id/detalles" element={<CursoDetalle user={user} />} />
              <Route path="/modulo/:id" element={<ModuloView user={user} />} />
              <Route path="/constancia/:cursoId" element={<Constancia user={user} />} />
              <Route path="/verificar/:folio?" element={<VerificarConstancia />} />
              <Route path="/mensajes" element={<PaginaMensajes user={user} esAdmin={esAdmin} />} />
              <Route path="/foro/:cursoId" element={<ForoCurso user={user} />} />
            </Routes>
          </Suspense>
        </BarreraErrores>
      </main>
      <WhatsAppFlotante />
    </>
  )
}

export default function Root() {
  return <BrowserRouter><App /></BrowserRouter>
}