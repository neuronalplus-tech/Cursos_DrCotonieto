import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { supabase } from './lib/supabase'
import AdminExamenes from './components/AdminExamenes'
import MensajesInbox, { MensajesPage } from './components/MensajesInbox'
import ExamenModulo from './components/ExamenModulo'
import TallerRecursos, { ModalEditarTaller } from './components/TallerRecursos'
import Header from './components/Header'
import ModuloView from './components/ModuloView'
import CursoView from './components/CursoView'
import CursoCard from './components/CursoCard'
import PortadaCurso from './components/PortadaCurso'
import Admin from './components/Admin'
import Home from './components/Home'
import Login from './components/Login'
import Recuperar from './components/Recuperar'
import Perfil from './components/Perfil'
import MisCalificaciones from './components/MisCalificaciones'
import Calendario from './components/Calendario'
import CursoDetalle from './components/CursoDetalle'
import Constancia from './components/Constancia'
import VerificarConstancia from './components/VerificarConstancia'
import ForoCurso from './components/ForoCurso'
import { WhatsAppFlotante, BarreraErrores } from './components/ui'
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

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
            <Route path="/mensajes" element={<MensajesPage user={user} esAdmin={esAdmin} />} />
            <Route path="/foro/:cursoId" element={<ForoCurso user={user} />} />
          </Routes>
        </BarreraErrores>
      </main>
      <WhatsAppFlotante />
    </>
  )
}

export default function Root() {
  return <BrowserRouter><App /></BrowserRouter>
}