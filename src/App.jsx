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
  VideoPlayer, EmbedFrame, EditorBotonesExtra,
} from './components/ui'
import { jsPDF } from 'jspdf'  
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

/* ============================================================
   CONFIGURACIÓN
   (movida a src/config.js)
   CURSOS CON METADATOS ESPECIALES y DETALLES_DUELO siguen aquí
   porque son contenido editorial de un curso concreto.
   ============================================================ */

/* ============================================================
   DETALLES DEL CURSO DE DUELO
   ============================================================ */
const DETALLES_DUELO = {
  intro: 'Evaluación y acompañamiento en duelo normativo y prolongado',
  subtitulo: 'Dos rutas paralelas, mismo rigor clínico, distinto punto de partida.',
  rutas: {
    acompanamiento: {
      grupo: 'Acompañamiento',
      nombre: 'Ruta Acompañamiento',
      dirigida: 'Para profesionales que acompañan personas en duelo sin ser especialistas en salud mental.',
      paraTiSi: 'En tu trabajo te toca sostener a alguien que perdió a alguien, y muchas veces no sabes qué decir. Te preocupa meter la pata, decir algo que empeore las cosas, o darte cuenta tarde de que esa persona necesitaba más ayuda de la que tú podías darle.',
      publicos: 'Docencia · salud · recursos humanos · trabajo social · acompañamiento espiritual · tanatología · servicios funerarios · voluntariado · y cualquier profesión donde acompañar sea parte del trabajo.',
      notaFinal: 'No necesitas formación en salud mental. Aquí aprendes a acompañar bien y a derivar a tiempo.',
      modulos: [
        { num: 1, titulo: 'Leer el duelo con modelo, no con intuición', descripcion: 'Los modelos que sí se sostienen con evidencia: la oscilación entre pérdida y restauración (Proceso Dual), las tareas del duelo (Worden) y la transformación del vínculo (vínculos continuos). Por qué las "cinco etapas" se malinterpretaron y qué usar en su lugar.' },
        { num: 2, titulo: 'Distinguir lo normativo de lo prolongado', descripcion: 'Los criterios actuales (DSM-5-TR) explicados y aplicados sobre dos casos gemelos, uno al lado del otro. Qué es realmente una señal de alarma y qué solo parece serlo.' },
        { num: 3, titulo: 'Acompañar con técnica', descripcion: 'Validación que no refuerza la evitación. Anclaje y regulación para sostener a alguien desbordado. Activación por valores. Desgaste por empatía y cómo prevenirlo.' },
        { num: 4, titulo: 'Riesgo, límites y derivación', descripcion: 'Cómo preguntar por ideación suicida sin rodeos. Semáforo de conducta. Dónde termina tu rol y empieza el de salud mental. Cómo derivar sin que se viva como abandono.' }
      ],
      metodologia: 'Cuatro sesiones en vivo, una por semana. Cápsula breve antes de cada una; la sesión se usa para trabajar casos, no para exponer. Dos casos gemelos te acompañan las cuatro semanas.',
      materiales: 'Cuadernillo de trabajo por módulo · guía de exploración · rejilla de señales de alarma · banco de frases · mapa de alcance y ruta de derivación · grabación · constancia de participación.'
    },
    clinica: {
      grupo: 'Clínica',
      nombre: 'Ruta Clínica',
      dirigida: 'Para profesionales de salud mental que atienden duelo en consulta.',
      paraTiSi: 'Atiendes casos de duelo en consulta y quieres pasar de acompañar con oficio a formular con método. Te interesa entender por qué esta persona sigue atascada y qué cadena concreta la mantiene ahí.',
      publicos: 'Psicología clínica · psiquiatría · psicoterapia · estudiantes de posgrado en salud mental · profesionales en formación clínica supervisada.',
      notaFinal: 'Requiere formación en salud mental. Aquí trabajas evaluación diferencial, formulación funcional y diseño de intervención.',
      modulos: [
        { num: 1, titulo: 'Evaluación diferencial del duelo', descripcion: 'Criterios DSM-5-TR aplicados reactivo por reactivo sobre dos casos gemelos. PG-13-R. Diferencial contra depresión, TEPT y adaptativo. Exploración de riesgo suicida.' },
        { num: 2, titulo: 'Formulación funcional del caso', descripcion: 'Arquitectura Nezu, Nezu y Lombardo completa. Análisis funcional del mantenimiento. Mapa de Patogénesis y Mapa de Alcance de Metas.' },
        { num: 3, titulo: 'Intervención: autorregulación y exposición graduada', descripcion: 'Secuencia DBT de tolerancia al malestar. Anclaje mindfulness. Defusión desde ACT. Jerarquía de exposición. Alternancia pérdida↔restauración.' },
        { num: 4, titulo: 'Riesgo, límites y derivación', descripcion: 'Plan de seguridad co-construido. Manejo del ámbar sostenido. Terapia de Shear (16 sesiones). Límites por profesión. Documentación alineada a NOM-004.' }
      ],
      metodologia: 'Cuatro sesiones en vivo, una por semana. Cápsula breve antes de cada una para llegar con el marco leído; la sesión se usa para formular, no para exponer.',
      materiales: 'Cuadernillo clínico por módulo · formatos de formulación y mapas · rejilla de diferencial · guía de exploración de riesgo · formato de nota clínica NOM-004 · grabación · constancia de participación.'
    }
  }
}

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
          <Route path="/foro/:cursoId" element={<ForoCurso user={user} esAdmin={esAdmin} />} />
        </Routes>
      </main>
      <WhatsAppFlotante />
    </>
  )
}

export default function Root() {
  return <BrowserRouter><App /></BrowserRouter>
}
