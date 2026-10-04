import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { supabase } from './lib/supabase'
import { enviarCorreo, obtenerEmailsInscritos, notificarInscritos } from './lib/correo'
import {
  esContenedorTalleres, esTallerIndividual, moduloVisible, moduloBloqueadoParaAlumno,
  emiteConstancia, cursoEspecial, esCursoProblemasContemporaneos,
  normalizarTexto, analizarUrl,
} from './lib/helpers'
import {
  BUCKET_PAGO, BUCKET_TALLERES, AVATAR_BUCKET,
  CONTACTO_EMAIL, wa, WA_CONSULTA,
  LOGO_CLARO, FOTO_PERFIL,
  ENLACE_DIAPOSITIVAS_PRESENTAR_CASO, ENLACE_ENTREGABLES,
  MARCA, REDES, SERVICIOS, CASOS, ENFOQUES, LINEA_COPY,
  ICONO_TIPO, NOMBRE_TIPO, rutaAcceso,
} from './config'
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
import Perfil from './components/Perfil'
import CursoDetalle from './components/CursoDetalle'
import Constancia from './components/Constancia'
import ForoCurso from './components/ForoCurso'
import {
  ModalEditarBotonesRuta, ModalNuevoModulo, ModalEditarBotonesModulo,
} from './components/AdminModales'
import {
  ModalPortal, Breadcrumb, WhatsAppFlotante, BandaRedes, NavegacionFlotante,
  VideoPlayer, EmbedFrame, EditorBotonesExtra, BarreraErrores,
} from './components/ui'
import { jsPDF } from 'jspdf'  
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/* ============================================================
   CONFIGURACIÓN
   (movida a src/config.js)
   CURSOS CON METADATOS ESPECIALES sigue aquí porque es contenido
   editorial de un curso concreto. DETALLES_DUELO se movió a
   config.js: lo consume CursoDetalle, no este archivo.
   ============================================================ */

/* ============================================================
   HELPERS
   (esContenedorTalleres, esTallerIndividual, moduloVisible,
    moduloBloqueadoParaAlumno, emiteConstancia, cursoEspecial,
    esCursoProblemasContemporaneos, normalizarTexto y analizarUrl
    se movieron a src/lib/helpers.js)

   UI COMPARTIDA
   (ModalPortal, Breadcrumb, WhatsAppFlotante, BandaRedes,
    NavegacionFlotante, VideoPlayer, EmbedFrame y EditorBotonesExtra
    se movieron a src/components/ui.jsx)
   ============================================================ */

// (normalizarTexto y analizarUrl se movieron a src/lib/helpers.js)

// (analizarUrl se movió a src/lib/helpers.js)

/* ============================================================
   PORTADAS VECTORIALES
   ============================================================ */
// (PortadaCurso, motivoDe se movieron a src/components/PortadaCurso.jsx)

/* ============================================================
   CARRUSEL
   ============================================================ */
// (CarruselCursos se movió a src/components/CarruselCursos.jsx)

/* ============================================================
   UTILIDADES
   (Breadcrumb, WhatsAppFlotante, BandaRedes y NavegacionFlotante
    se movieron a src/components/ui.jsx)
   ============================================================ */

// (rutaAcceso se movió a src/config.js)

/* ============================================================
   HEADER (movido a src/components/Header.jsx)
   ============================================================ */

/* ============================================================
   LOGIN
   ============================================================ */
// (Login se movió a src/components/Login.jsx)

/* ============================================================
   TARJETA DE CURSO
   ============================================================ */
// (CursoCard se movió a src/components/CursoCard.jsx)

/* ============================================================
   HOME
   ============================================================ */
// (Home se movió a src/components/Home.jsx)

/* ============================================================
   PERFIL
   ============================================================ */
// (Perfil se movió a src/components/Perfil.jsx)

// (MensajesInbox y MensajesPage se movieron a src/components/MensajesInbox.jsx)
/* ============================================================
   PANEL ADMIN
   ============================================================ */
// (Admin se movió a src/components/Admin.jsx)

/* ============================================================
   VISOR PDF
   ============================================================ */
// (PdfViewer, PdfPage, Autoevaluacion, ModalEditarRecurso, ModalDuplicarModulo, ModalDuplicarRecurso, ModalNotificarRecurso, RecursoCard, DiapositivasPresentarCaso, Entregables se movieron a src/components/RecursosModulo.jsx)

// (ExamenModulo se movio a src/components/ExamenModulo.jsx)

// (ModalEditarBotonesRuta, ModalNuevoModulo y ModalEditarBotonesModulo
// se movieron a src/components/AdminModales.jsx)

// (ModalEditarTaller y TallerRecursos se movieron a src/components/TallerRecursos.jsx)

/* ============================================================
   CURSO
   ============================================================ */
// (CursoView se movió a src/components/CursoView.jsx)

/* ============================================================
   DETALLE DEL CURSO
   ============================================================ */
// (CursoDetalle se movió a src/components/CursoDetalle.jsx)

/* ============================================================
   MÓDULO
   ============================================================ */
// (ModuloView se movió a src/components/ModuloView.jsx)

/* ============================================================
   CONSTANCIA
   ============================================================ */
// (Constancia se movió a src/components/Constancia.jsx)

/* ============================================================
   APP
   ============================================================ */
function App() {
  const [session, setSession] = useState(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const navigate = useNavigate()
  // La barrera de errores se remonta en cada ruta: un fallo pasajero en una
  // pantalla no debe dejar a la persona atrapada en el aviso de error.
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
    })
    return () => subscription.unsubscribe()
  }, [])

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
            <Route path="/" element={<Home user={user} esAdmin={esAdmin} />} />
            <Route path="/acceso" element={<Login message={message} />} />
            <Route path="/perfil" element={<Perfil user={user} />} />
            <Route path="/admin" element={<Admin user={user} esAdmin={esAdmin} />} />
            <Route path="/curso/:id" element={<CursoView user={user} esAdmin={esAdmin} />} />
            <Route path="/curso/:id/detalles" element={<CursoDetalle user={user} esAdmin={esAdmin} />} />
            <Route path="/modulo/:id" element={<ModuloView user={user} esAdmin={esAdmin} />} />
            <Route path="/constancia/:cursoId" element={<Constancia user={user} />} />
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
