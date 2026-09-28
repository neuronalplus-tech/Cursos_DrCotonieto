import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { jsPDF } from 'jspdf'
import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const BUCKET_PAGO = 'curso_duelo'
const BUCKET_TALLERES = 'talleres'
const AVATAR_BUCKET = 'avatares'

const CONTACTO_EMAIL = 'cotonietoe@gmail.com'
const WHATSAPP = '5215637841931'
const wa = (t) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t)}`
const WA_CONSULTA = wa('Hola, vi tu página y me gustaría agendar una llamada de encuadre.')

const LOGO_BLANCO = '/logo_blanco_1024.png'
const LOGO_CLARO = '/logo_claro_1024.png'
const FOTO_PERFIL = 'https://ohhdnaewtjfqszxemrju.supabase.co/storage/v1/object/public/avatares/foto_perfil_instagram_facebook.png'

const ENLACE_DIAPOSITIVAS_PRESENTAR_CASO = 'https://1drv.ms/p/c/a43668d1cdc6e346/IQABiMuYL5oQQLuzj7m72L_FAR9JRwJCn52xxu9qaRKAENU?e=NA3oRy'
const ENLACE_ENTREGABLES = 'https://1drv.ms/f/c/a43668d1cdc6e346/IgCxnJ6u1wjqSYKpW0N7eSgzAWc1XQw02u1GwWpkduAL9EI?e=h9CAvA'
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyXelwiqlZwGDeKhe724rUmbh5fLNaph4Cpm83LxRxWjfOXZ1sGr8eHFzNwPCAfXbK4Rw/exec'

const MARCA = {
  nombre: 'Dr. Ernesto Cotonieto',
  credencial: 'Cédula profesional 10521804 · Doctorado en Ciencias del Comportamiento Saludable',
  slogan: 'No tienes que traducirte para que te entiendan.',
  subtitulo: 'Un espacio afirmativo, para quienes cargan más de lo que muestran.',
  bio: 'Acompaño a adolescentes (desde 13 años) y adultos en procesos psicológicos basados en evidencia, y formo a profesionales de la salud mental. Combino la práctica clínica con la investigación y la docencia.'
}

const REDES = [
  { nombre: 'Página oficial', corto: 'Web', url: 'https://drcotonieto.netlify.app/', icono: '🌐' },
  { nombre: 'Instagram', corto: 'Instagram', url: 'https://www.instagram.com/dr.cotonieto/', icono: '📷' },
  { nombre: 'Facebook', corto: 'Facebook', url: 'https://www.facebook.com/dr.cotonieto', icono: '👥' },
  { nombre: 'LinkedIn', corto: 'LinkedIn', url: 'https://www.linkedin.com/in/ernesto-cotonieto-928039235/', icono: '💼' },
  { nombre: 'Google Scholar', corto: 'Publicaciones', url: 'https://scholar.google.com/citations?hl=es&user=8wRWA-sAAAAJ', icono: '🎓' }
]

const SERVICIOS = [
  { titulo: 'Terapia individual en línea', detalle: 'Adolescentes desde 13 años y adultos. Procesos basados en evidencia.' },
  { titulo: 'Llamada de encuadre sin costo', detalle: '15 a 20 minutos para conocernos y ver si es buen momento.' },
  { titulo: 'Supervisión clínica grupal', detalle: 'Grupos cerrados de 5 a 6 profesionales, con método de formulación.' },
  { titulo: 'Cursos y talleres', detalle: 'Formación clínica aplicada para profesionales de la salud mental.' }
]

const CASOS = [
  'Ansiedad intensa y ataques de pánico', 'Trauma y TEPT',
  'Distimia y estados de ánimo persistentes', 'Neurodivergencia',
  'Crisis emocionales', 'Estrés profesional y autoexigencia extrema'
]

const ENFOQUES = ['Terapia de Aceptación y Compromiso (ACT)', 'Análisis funcional de la conducta', 'Terapia Dialéctico-Conductual (DBT)']

const LINEA_COPY = {
  'Formulación y terapias contextuales': { texto: 'Formulación de caso, ACT, DBT, mindfulness y análisis funcional para decidir con criterio clínico.', motivo: 'red' },
  'Duelo y pérdida': { texto: 'Duelo normativo, complicado, infantil y escritura emocional reflexiva.', motivo: 'ondas' },
  'Neurodivergencia': { texto: 'Detección, diagnóstico diferencial y acompañamiento afirmativo, con criterios DSM-5-TR.', motivo: 'malla' },
  'Riesgo, documentación y ética': { texto: 'Evaluación de riesgo suicida, documentación clínica y límites éticos en la práctica.', motivo: 'escudo' },
  'Peritaje psicológico': { texto: 'Fundamentos del peritaje y revisión metodológica de entrevistas forenses.', motivo: 'prisma' },
  'Ciclo vital y bienestar': { texto: 'Mindfulness clínico, ansiedad y pánico, y bienestar en la adultez y la vejez.', motivo: 'circulos' },
  'Práctica profesional': { texto: 'Supervisión clínica grupal, psicometría aplicada y prevención del desgaste profesional.', motivo: 'arcos' },
  'Talleres gratuitos': { texto: 'Formación breve y de acceso libre para empezar a formarte hoy mismo.', motivo: 'arcos' },
  'Educación': { texto: 'Debates contemporáneos y herramientas aplicables para profesionales de la educación.', motivo: 'prisma' }
}

const ICONO_TIPO = { pdf: '📄', video: '🎬', word: '📝', enlace: '🔗', autoevaluacion: '✍️' }
const NOMBRE_TIPO = { pdf: 'Documento', video: 'Video', word: 'Descargable', enlace: 'Enlace', autoevaluacion: 'Autoevaluación' }

/* ============================================================
   CURSOS CON METADATOS ESPECIALES
   ============================================================ */
const CURSOS_ESPECIALES = {
  duelo: {
    patron: /duelo\s+normativo/i,
    disponibleDesde: '1 de octubre',
    detallesKey: 'duelo'
  }
}

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
   ============================================================ */
function esContenedorTalleres(curso) {
  if (!curso) return false
  const t = (curso.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return t.includes('taller') && t.includes('gratuit')
}

function esTallerIndividual(curso) {
  if (!curso || !curso.gratuito) return false
  if (esContenedorTalleres(curso)) return false
  return !curso.linea
}

function moduloVisible(m, { user, esAdmin, miGrupo }) {
  if (esAdmin) return true
  if (m.oculto && !user) return false
  if (m.grupo) {
    if (!user) return false
    if (m.grupo !== miGrupo) return false
  }
  return true
}

function moduloBloqueadoParaAlumno(m) {
  return m && m.disponible === false
}

function emiteConstancia(curso) {
  if (!curso) return false
  if (curso.gratuito) return false
  if (curso.constancia === false) return false
  return true
}

function cursoEspecial(curso) {
  if (!curso) return null
  return Object.values(CURSOS_ESPECIALES).find(e => e.patron.test(curso.titulo || '')) || null
}

function esCursoProblemasContemporaneos(curso) {
  if (!curso) return false
  const t = (curso.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return t.includes('problemas') && t.includes('contempor')
}

function normalizarTexto(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/* ============================================================
   PORTADAS VECTORIALES
   ============================================================ */
function PortadaCurso({ motivo, uid }) {
  const gid = `p${uid}`

  if (motivo === 'red') {
    const nodos = [[88,108,4],[148,58,5],[206,96,9],[132,148,4],[252,150,5],[312,74,4],[330,132,3],[60,60,3]]
    const aristas = [[0,1],[1,2],[0,3],[3,2],[2,4],[3,4],[2,5],[4,6],[5,6],[7,1],[7,0]]
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#F2EEE9" />
        <g stroke="#1B3A4B" strokeOpacity=".28" strokeWidth="1.4">
          {aristas.map(([a,b],i) => <line key={i} x1={nodos[a][0]} y1={nodos[a][1]} x2={nodos[b][0]} y2={nodos[b][1]} />)}
        </g>
        {nodos.map(([cx,cy,r],i) => <circle key={i} cx={cx} cy={cy} r={r} fill={i===2?'#C17A5E':'#1B3A4B'} fillOpacity={i===2?1:.82} />)}
        <circle cx="206" cy="96" r="18" fill="none" stroke="#C17A5E" strokeOpacity=".38" strokeWidth="1.4" />
        <circle cx="206" cy="96" r="27" fill="none" stroke="#C17A5E" strokeOpacity=".18" strokeWidth="1.2" />
      </svg>
    )
  }

  if (motivo === 'arcos') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id={`${gid}a`} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#B76F53" /><stop offset="100%" stopColor="#D9A184" /></linearGradient></defs>
        <rect width="400" height="200" fill={`url(#${gid}a)`} />
        <g fill="none" stroke="#FAFAF8" strokeLinecap="round" strokeWidth="1.8">
          <circle cx="68" cy="172" r="44" strokeOpacity=".55" /><circle cx="68" cy="172" r="82" strokeOpacity=".42" />
          <circle cx="68" cy="172" r="120" strokeOpacity=".30" /><circle cx="68" cy="172" r="158" strokeOpacity=".20" />
          <circle cx="68" cy="172" r="196" strokeOpacity=".12" />
        </g>
        <circle cx="68" cy="172" r="10" fill="#FAFAF8" />
        <g fill="#FAFAF8" fillOpacity=".85"><circle cx="262" cy="54" r="3.5" /><circle cx="318" cy="96" r="2.5" /><circle cx="214" cy="30" r="2" /></g>
      </svg>
    )
  }

  if (motivo === 'circulos') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#1B3A4B" />
        <g fill="none" stroke="#FAFAF8" strokeWidth="1.6">
          {[20,42,64,86,108,130].map((r,i) => <circle key={i} cx="200" cy="100" r={r} strokeOpacity={0.5 - i*0.06} />)}
        </g>
        <circle cx="200" cy="100" r="9" fill="#C17A5E" />
        <circle cx="200" cy="100" r="9" fill="none" stroke="#FAFAF8" strokeOpacity=".5" strokeWidth="1.4" />
      </svg>
    )
  }

  if (motivo === 'malla') {
    const pts = []
    for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) pts.push([28 + c*32, 24 + r*32])
    const destacados = new Set([15, 28, 41, 54, 7, 62])
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#F2EEE9" />
        {pts.map(([cx,cy],i) => destacados.has(i)
          ? <circle key={i} cx={cx} cy={cy} r="6.5" fill="#C17A5E" />
          : <circle key={i} cx={cx} cy={cy} r="3" fill="#1B3A4B" fillOpacity=".45" />)}
      </svg>
    )
  }

  if (motivo === 'prisma') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#1B3A4B" />
        <polygon points="150,40 210,100 150,160" fill="none" stroke="#FAFAF8" strokeOpacity=".5" strokeWidth="1.6" />
        <g strokeWidth="2" strokeLinecap="round">
          <line x1="210" y1="100" x2="360" y2="60" stroke="#C17A5E" strokeOpacity=".9" />
          <line x1="210" y1="100" x2="360" y2="86" stroke="#E0A88C" strokeOpacity=".8" />
          <line x1="210" y1="100" x2="360" y2="112" stroke="#FAFAF8" strokeOpacity=".55" />
          <line x1="210" y1="100" x2="360" y2="138" stroke="#8FB2C4" strokeOpacity=".5" />
        </g>
        <line x1="60" y1="100" x2="150" y2="100" stroke="#FAFAF8" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (motivo === 'espiral') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id={`${gid}e`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C17A5E" /><stop offset="100%" stopColor="#A5624A" /></linearGradient></defs>
        <rect width="400" height="200" fill={`url(#${gid}e)`} />
        <path d="M200 100 C 200 84 224 84 224 104 C 224 132 184 132 184 100 C 184 60 240 60 240 108 C 240 168 152 168 152 96"
              fill="none" stroke="#FAFAF8" strokeOpacity=".85" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="200" cy="100" r="4" fill="#FAFAF8" />
      </svg>
    )
  }

  if (motivo === 'escudo') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#EEF2F4" />
        <path d="M200 40 L248 58 V104 C248 138 224 156 200 166 C176 156 152 138 152 104 V58 Z"
              fill="#1B3A4B" fillOpacity=".9" />
        <path d="M180 102 l14 14 l28 -30" fill="none" stroke="#C17A5E" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <g stroke="#1B3A4B" strokeOpacity=".18" strokeWidth="1.4"><line x1="60" y1="72" x2="130" y2="72" /><line x1="60" y1="100" x2="120" y2="100" /><line x1="60" y1="128" x2="132" y2="128" /><line x1="286" y1="72" x2="352" y2="72" /><line x1="296" y1="100" x2="352" y2="100" /><line x1="284" y1="128" x2="352" y2="128" /></g>
      </svg>
    )
  }

  return (
    <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id={`${gid}o`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1B3A4B" /><stop offset="100%" stopColor="#2F5B72" /></linearGradient></defs>
      <rect width="400" height="200" fill={`url(#${gid}o)`} />
      <g fill="none" stroke="#FAFAF8" strokeLinecap="round" strokeWidth="1.8">
        <path d="M-20 168 C 60 140, 130 192, 210 162 S 350 132, 420 156" strokeOpacity=".14" />
        <path d="M-20 146 C 60 118, 130 170, 210 140 S 350 110, 420 134" strokeOpacity=".20" />
        <path d="M-20 124 C 60 96, 130 148, 210 118 S 350 88, 420 112" strokeOpacity=".28" />
        <path d="M-20 102 C 60 74, 130 126, 210 96 S 350 66, 420 90" strokeOpacity=".36" />
      </g>
      <path d="M-20 78 C 60 50, 130 102, 210 72 S 350 42, 420 66" fill="none" stroke="#C17A5E" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="210" cy="72" r="5.5" fill="#C17A5E" />
      <circle cx="210" cy="72" r="13" fill="none" stroke="#C17A5E" strokeOpacity=".45" strokeWidth="1.4" />
    </svg>
  )
}

function motivoDe(curso) {
  if (curso.caratula) return curso.caratula
  if (curso.gratuito) return 'arcos'
  if (/supervis/i.test(curso.titulo || '')) return 'red'
  return 'ondas'
}

/* ============================================================
   CARRUSEL
   ============================================================ */
function CarruselCursos({ lineas, cursos, onSelect }) {
  const slides = lineas.map((l) => {
    const info = LINEA_COPY[l]
    const enLinea = cursos.filter((c) => c.linea === l)
    const n = enLinea.length
    return {
      linea: l,
      texto: info?.texto || `${n} ${n === 1 ? 'curso disponible' : 'cursos disponibles'} en esta línea.`,
      motivo: info?.motivo || enLinea[0]?.caratula || 'espiral'
    }
  })

  const [indice, setIndice] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const inicioRef = useRef(0)
  const pausadoRef = useRef(false)

  useEffect(() => {
    if (slides.length < 2) return
    const id = setInterval(() => {
      if (!pausadoRef.current) setIndice((i) => (i + 1) % slides.length)
    }, 5500)
    return () => clearInterval(id)
  }, [slides.length])

  useEffect(() => { if (indice >= slides.length) setIndice(0) }, [slides.length, indice])

  if (slides.length === 0) return null

  const irA = (i) => setIndice(((i % slides.length) + slides.length) % slides.length)
  const onDown = (e) => { setArrastrando(true); pausadoRef.current = true; inicioRef.current = e.clientX }
  const onMove = (e) => { if (arrastrando) setOffsetX(e.clientX - inicioRef.current) }
  const terminarArrastre = (dx) => {
    setArrastrando(false); setOffsetX(0); pausadoRef.current = false
    if (dx > 50) irA(indice - 1); else if (dx < -50) irA(indice + 1)
  }
  const onUp = (e) => terminarArrastre(e.clientX - inicioRef.current)
  const onLeaveTrack = () => { if (arrastrando) terminarArrastre(0) }

  return (
    <div className="carrusel"
      onMouseEnter={() => { pausadoRef.current = true }}
      onMouseLeave={() => { if (!arrastrando) pausadoRef.current = false }}>
      <div className={`carrusel-track${arrastrando ? ' arrastando' : ''}`}
        style={{ transform: `translateX(calc(${-indice * 100}% + ${offsetX}px))` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={onLeaveTrack} onPointerCancel={onLeaveTrack}>
        {slides.map((s, i) => (
          <div className="carrusel-slide" key={s.linea}>
            <div className="carrusel-fondo"><PortadaCurso motivo={s.motivo} uid={`car${i}`} /></div>
            <div className="carrusel-velo" />
            <div className="carrusel-texto">
              <h3>{s.linea}</h3>
              <p>{s.texto}</p>
              <button type="button" className="button whatsapp" onClick={() => onSelect(s.linea)}>Ver cursos</button>
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className="carrusel-flecha izq" aria-label="Línea anterior" onClick={() => irA(indice - 1)}>‹</button>
          <button type="button" className="carrusel-flecha der" aria-label="Línea siguiente" onClick={() => irA(indice + 1)}>›</button>
          <div className="carrusel-puntos">
            {slides.map((s, i) => (
              <button type="button" key={s.linea}
                className={`punto${i === indice ? ' activo' : ''}`}
                aria-label={`Ir a ${s.linea}`}
                onClick={() => irA(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================
   UTILIDADES
   ============================================================ */
function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Ruta de navegación">
      {items.map((it, i) => (
        <span key={i}>
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
          {i < items.length - 1 && <span className="bc-sep">›</span>}
        </span>
      ))}
    </nav>
  )
}

function WhatsAppFlotante() {
  return (
    <a className="wa-flotante" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer" aria-label="Escríbeme por WhatsApp">
      <span className="wa-icono">💬</span><span className="wa-texto">WhatsApp</span>
    </a>
  )
}

/* ============================================================
   BANDA DE REDES SOCIALES (FOOTER GLOBAL)
   ============================================================ */
function BandaRedes() {
  return (
    <section className="banda-redes">
      <div className="banda-redes-inner">
        <div className="banda-redes-marca">
          <img src={LOGO_BLANCO} alt="Dr. Ernesto Cotonieto" className="banda-redes-logo" />
          <div>
            <p className="banda-redes-nombre">{MARCA.nombre}</p>
            <p className="banda-redes-credencial">{MARCA.credencial}</p>
          </div>
        </div>
        <div className="banda-redes-sociales">
          <p className="banda-redes-titulo">Sígueme</p>
          <div className="banda-redes-iconos">
            {REDES.map((r) => (
              <a key={r.nombre} className="banda-redes-icono" href={r.url}
                 target="_blank" rel="noopener noreferrer" title={r.nombre}>
                <span aria-hidden="true">{r.icono}</span>
                <span>{r.corto}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="banda-redes-legal">
          <p className="banda-redes-legal-texto">
            El contenido de este sitio es informativo y formativo, y no sustituye la atención clínica individual.
            Si estás en una situación de urgencia, comunícate al <strong>911</strong> o a la Línea de la Vida <strong>800 911 2000</strong> (24 h, México).
          </p>
          <p className="banda-redes-copy">© {new Date().getFullYear()} Dr. Ernesto Cotonieto. Todos los derechos reservados.</p>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   NAVEGACIÓN FLOTANTE EN MÓDULOS
   ============================================================ */
function NavegacionFlotante({ prev, next, curso, mostrarConstancia }) {
  const navigate = useNavigate()
  return (
    <nav className="nav-flotante" aria-label="Navegación del módulo">
      <button type="button" className="nav-flotante-btn" onClick={() => navigate('/')}>
        <span className="nav-flotante-icono">🏠</span>
        <span className="nav-flotante-texto">Inicio</span>
      </button>
      <button type="button" className="nav-flotante-btn" disabled={!prev}
              onClick={() => prev && navigate(`/modulo/${prev.id}`)}>
        <span className="nav-flotante-icono">←</span>
        <span className="nav-flotante-texto">Anterior</span>
      </button>
      {curso && (
        <button type="button" className="nav-flotante-btn" onClick={() => navigate(`/curso/${curso.id}`)}>
          <span className="nav-flotante-icono">📚</span>
          <span className="nav-flotante-texto">Curso</span>
        </button>
      )}
      {next ? (
        <button type="button" className="nav-flotante-btn destacado" onClick={() => navigate(`/modulo/${next.id}`)}>
          <span className="nav-flotante-texto">Siguiente</span>
          <span className="nav-flotante-icono">→</span>
        </button>
      ) : (mostrarConstancia && curso) ? (
        <button type="button" className="nav-flotante-btn constancia" onClick={() => navigate(`/constancia/${curso.id}`)}>
          <span className="nav-flotante-icono">🏆</span>
          <span className="nav-flotante-texto">Constancia</span>
        </button>
      ) : (
        <button type="button" className="nav-flotante-btn" disabled>
          <span className="nav-flotante-texto">Fin</span>
        </button>
      )}
    </nav>
  )
}

const rutaAcceso = (destino) => `/acceso?redirigir=${encodeURIComponent(destino)}`

/* ============================================================
   HEADER
   ============================================================ */
function Header({ user, esAdmin, onLogout, nombreUsuario }) {
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

/* ============================================================
   LOGIN
   ============================================================ */
function Login({ message }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const crudo = new URLSearchParams(location.search).get('redirigir')
  const destino = crudo && crudo.startsWith('/') && !crudo.startsWith('//') ? crudo : '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError('Correo o contraseña incorrectos. Revisa que no haya espacios de más.'); setLoading(false) }
    else { localStorage.setItem('login_time', String(Date.now())); navigate(destino, { replace: true }) }
  }

  return (
    <main className="portal centered">
      <section className="card login-card">
        <img src={LOGO_CLARO} alt="" className="logo-login" />
        <p className="eyebrow">Aula virtual</p>
        <h1>Iniciar sesión</h1>
        <p className="sutil">
          {destino !== '/'
            ? 'Ingresa tus datos y te llevo directo al curso que abriste.'
            : 'Ingresa con el usuario y contraseña que te compartí. Los talleres gratuitos no requieren cuenta.'}
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="button primary ancho">
            {loading ? 'Verificando...' : 'Entrar al aula'}
          </button>
        </form>
        {(error || message) && <p className="aviso-error">{error || message}</p>}
        <div className="login-pie">
          <button className="enlace-texto" onClick={() => navigate('/')}>← Volver al inicio</button>
          <a className="enlace-texto" href={wa('Hola, no puedo entrar al aula virtual. ¿Me ayudas con mi acceso?')}
             target="_blank" rel="noopener noreferrer">¿Problemas para entrar?</a>
        </div>
      </section>
    </main>
  )
}

/* ============================================================
   TARJETA DE CURSO
   ============================================================ */
function CursoCard({ curso, user, tieneAcceso }) {
  const [abierto, setAbierto] = useState(false)
  const [abiertoCustom, setAbiertoCustom] = useState(false)
  const navigate = useNavigate()
  const gratis = !!curso.gratuito
  const prox = !!curso.proximamente
  const esContenedor = esContenedorTalleres(curso)
  const mostrarCustom = !gratis && !prox && !esContenedor
  const especial = cursoEspecial(curso)
  const tieneDetalles = !!especial

  if (esContenedor) {
    return (
      <article className="course-card gratis contenedor">
        <div className="course-portada">
          <PortadaCurso motivo={motivoDe(curso)} uid={curso.id} />
        </div>
        <div className="course-info">
          <span className="badge verde">Sección</span>
          <h3>{curso.titulo}</h3>
          <p className="contenedor-desc">{curso.descripcion}</p>
          <div className="course-acciones">
            <Link to={`/curso/${curso.id}`} className="button primary ancho">Ver todos los talleres →</Link>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`course-card ${gratis ? 'gratis' : ''} ${prox ? 'proximo' : ''}`}>
      <div className="course-portada">
        <PortadaCurso motivo={motivoDe(curso)} uid={curso.id} />
        {prox && <span className="cinta-prox">Próximamente</span>}
      </div>

      <div className="course-info">
        {prox ? <span className="badge proximo">En preparación</span>
          : gratis ? <span className="badge verde">Acceso libre</span>
            : tieneAcceso ? <span className="badge ok">✔ Estás inscrito</span>
              : <span className="badge neutro">Requiere inscripción</span>}

        <h3>{curso.titulo}</h3>

        {especial && (
          <p className="curso-disponible-card">
            <span className="curso-disponible-label">Disponible a partir del</span>
            <span className="curso-disponible-fecha">{especial.disponibleDesde}</span>
          </p>
        )}

        {curso.fecha_sesion && (
          <p className="fecha-sesion">📅 {curso.fecha_sesion}</p>
        )}

        <button className="saber-mas" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}>
          {abierto ? 'Ocultar detalles ▲' : 'Saber más ▼'}
        </button>

        {abierto && (
          <div className="course-detalle">
            <p>{curso.descripcion}</p>
            {curso.info_curso && (
              <div className="course-detalle-extra">
                {curso.info_curso.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
          </div>
        )}

        {mostrarCustom && (
          <>
            <button className="saber-mas" onClick={() => setAbiertoCustom(v => !v)} aria-expanded={abiertoCustom}>
              {abiertoCustom ? 'Ocultar información ▲' : '¿Quieres un curso a la medida? ▼'}
            </button>

            {abiertoCustom && (
              <div className="course-detalle">
                <p>
                  Diseño cursos y talleres <strong>personalizados</strong> para instituciones educativas,
                  hospitales, equipos clínicos y organizaciones. Si quieres capacitar a tu equipo en un tema
                  específico, armamos juntos el programa, los materiales y la logística.
                </p>
                <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
                   href={wa(`Hola, me interesa un curso personalizado para mí o mi institución. Me gustó la línea del curso "${curso.titulo}" y quiero algo a la medida.`)}>
                  💬 Quiero mi curso personalizado
                </a>
              </div>
            )}
          </>
        )}

        <div className="course-acciones">
          {tieneDetalles && (
            <Link to={`/curso/${curso.id}/detalles`} className="button secondary ancho">
              📋 Ver detalles y rutas
            </Link>
          )}
          {prox ? (
            <a className="button primary ancho" target="_blank" rel="noopener noreferrer"
               href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me avisas cuándo abre?`)}>
              Me interesa · avísame
            </a>
          ) : gratis ? (
            <>
              <Link to={`/curso/${curso.id}`} className="button secondary ancho">Entrar al taller</Link>

              {curso.link_sesion_vivo ? (
                <a className="button azul ancho" target="_blank" rel="noopener noreferrer" href={curso.link_sesion_vivo}>
                  📅 Registrarme a la sesión en vivo
                </a>
              ) : (
                <a className="button azul ancho" target="_blank" rel="noopener noreferrer"
                   href={wa(`Hola, me interesa el taller "${curso.titulo}". ¿Me avisas cuando abra el registro?`)}>
                  📅 Próximamente — avísame
                </a>
              )}

              {curso.link_grabacion ? (
                <a className="button secondary ancho" target="_blank" rel="noopener noreferrer" href={curso.link_grabacion}>
                  🎬 Ver grabación
                </a>
              ) : (
                <button className="button secondary ancho" disabled>
                  🎬 Grabación en proceso
                </button>
              )}
            </>
          ) : tieneAcceso ? (
            <Link to={`/curso/${curso.id}`} className="button primary ancho">Continuar curso</Link>
          ) : (
            <>
              <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
                 href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me compartes el costo y cómo apartar mi lugar?`)}>
                Quiero inscribirme
              </a>
              <button className="button secondary ancho"
                      onClick={() => navigate(user ? `/curso/${curso.id}` : rutaAcceso(`/curso/${curso.id}`))}>
                Ya tengo acceso
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

/* ============================================================
   HOME
   ============================================================ */
function Home({ user }) {
  const [cursos, setCursos] = useState([])
  const [accesos, setAccesos] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lineaActiva, setLineaActiva] = useState('todas')

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from('cursos').select('*').eq('activo', true).order('orden')
        if (error) throw error
        const cursosHome = (data || []).filter(c => !esTallerIndividual(c))
        setCursos(cursosHome)
        if (user) {
          const { data: acc } = await supabase.from('acceso').select('curso_id').eq('usuario_id', user.id)
          setAccesos(new Set((acc || []).map(a => a.curso_id)))
        }
      } catch (e) {
        console.error('Error cargando cursos:', e); setError(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [user])

  const lineas = []
  cursos.forEach(c => { if (c.linea && !lineas.includes(c.linea)) lineas.push(c.linea) })

  const cursosVisibles = lineaActiva === 'todas' ? cursos : cursos.filter(c => c.linea === lineaActiva)
  const disponibles = cursosVisibles.filter(c => !c.proximamente)
  const proximos = cursosVisibles.filter(c => c.proximamente)

  const irACurso = (linea) => {
    setLineaActiva(linea)
    document.getElementById('cursos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing">
      <section className="franja-superior">
        <div className="mini-perfil">
          <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="mini-foto" />
          <div className="mini-perfil-texto">
            <h1>{MARCA.nombre}</h1>
            <p className="mini-credencial">{MARCA.credencial}</p>
            <p className="mini-slogan">"{MARCA.slogan}"</p>
            <p className="mini-sub">{MARCA.subtitulo}</p>
            <a className="button whatsapp" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer">
              Agenda tu llamada sin costo
            </a>
          </div>
        </div>
        {!loading && <CarruselCursos lineas={lineas} cursos={cursos} onSelect={irACurso} />}
      </section>

      <section className="seccion" id="cursos">
        <h2>Cursos y talleres</h2>
        <p className="seccion-intro">
          Formación clínica aplicada, agrupada por línea temática. Los talleres gratuitos son de acceso
          libre; los cursos requieren inscripción. Toca "Saber más" para ver de qué trata cada uno.
        </p>

        {lineas.length > 0 && (
          <div className="menu-lineas">
            <button type="button" className={`linea-pill${lineaActiva === 'todas' ? ' activa' : ''}`}
              onClick={() => setLineaActiva('todas')}>Todas</button>
            {lineas.map((l) => (
              <button type="button" key={l}
                className={`linea-pill${lineaActiva === l ? ' activa' : ''}`}
                onClick={() => setLineaActiva(l)}>{l}</button>
            ))}
          </div>
        )}

        {loading && <div className="loading">Cargando cursos...</div>}
        {error && <p className="aviso-error">No se pudo cargar el catálogo: {error}</p>}
        {!loading && !error && cursos.length === 0 &&
          <p className="aviso-error">El catálogo está vacío. Si acabas de publicar, recarga en un momento.</p>}
        {!loading && disponibles.length > 0 && (
          <div className="course-grid">
            {disponibles.map((c) => <CursoCard key={c.id} curso={c} user={user} tieneAcceso={accesos.has(c.id)} />)}
          </div>
        )}
        {!loading && !error && cursos.length > 0 && lineaActiva !== 'todas' && disponibles.length === 0 && proximos.length === 0 && (
          <p className="aviso-error">Todavía no hay cursos publicados en esta línea.</p>
        )}
      </section>

      {!loading && proximos.length > 0 && (
        <section className="seccion" id="proximos">
          <h2>Próximamente</h2>
          <p className="seccion-intro">
            Estos cursos están en preparación. Toca "Me interesa" y te aviso en cuanto abra su inscripción —
            así también sé qué producir primero.
          </p>
          <div className="course-grid">
            {proximos.map((c) => <CursoCard key={c.id} curso={c} user={user} tieneAcceso={false} />)}
          </div>
        </section>
      )}

      <section className="seccion">
        <h2>Servicios</h2>
        <div className="servicios-grid">
          {SERVICIOS.map((s, i) => (
            <div key={i} className="servicio-card"><h3>{s.titulo}</h3><p>{s.detalle}</p></div>
          ))}
        </div>
      </section>

      <section className="seccion">
        <h2>Casos que atiendo</h2>
        <div className="lista-chips">{CASOS.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>
        <p className="enfoques"><strong>Enfoques:</strong> {ENFOQUES.join(' · ')}</p>
      </section>

      <section className="seccion sobre-mi">
        <h2>Sobre mí</h2>
        <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="sobre-mi-foto" />
        <p className="hero-bio">{MARCA.bio}</p>
        <div className="redes">
          {REDES.map((r) => (
            <a key={r.nombre} className="red-btn" href={r.url} target="_blank" rel="noopener noreferrer" title={r.nombre}>
              <span aria-hidden="true">{r.icono}</span><span>{r.corto}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="seccion cierre">
        <h2>¿Empezamos?</h2>
        <p>Escríbeme y resolvemos dudas sobre terapia, cursos o supervisión clínica.</p>
        <a className="button whatsapp grande" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer">
          Escríbeme por WhatsApp
        </a>
      </section>

      <BandaRedes />
    </div>
  )
}

/* ============================================================
   PERFIL
   ============================================================ */
function Perfil({ user }) {
  const [perfil, setPerfil] = useState({ nombre_completo: '', profesion: '', descripcion: '', ubicacion: '', avatar_url: '' })
  const [misCursos, setMisCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/perfil')); return }
    async function load() {
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()
      if (data) setPerfil({
        nombre_completo: data.nombre_completo || '', profesion: data.profesion || '',
        descripcion: data.descripcion || '', ubicacion: data.ubicacion || '', avatar_url: data.avatar_url || ''
      })
      const { data: acc } = await supabase.from('acceso').select('curso_id, cursos(titulo)').eq('usuario_id', user.id)
      if (acc) setMisCursos(acc.map(a => ({ id: a.curso_id, titulo: a.cursos?.titulo })).filter(x => x.titulo))
      setCargando(false)
    }
    load()
  }, [user, navigate])

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setMsg('Error: la imagen debe pesar menos de 3 MB.'); return }
    setSubiendo(true); setMsg('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`
      await supabase.from('perfiles').upsert({ id: user.id, avatar_url: url }, { onConflict: 'id' })
      setPerfil(p => ({ ...p, avatar_url: url }))
      setMsg('Foto actualizada.')
    } catch (err) { setMsg('Error al subir la foto: ' + err.message) }
    setSubiendo(false)
  }

  const handleGuardar = async () => {
    setMsg('')
    const { error } = await supabase.from('perfiles').upsert({
      id: user.id, nombre_completo: perfil.nombre_completo, profesion: perfil.profesion,
      descripcion: perfil.descripcion, ubicacion: perfil.ubicacion
    }, { onConflict: 'id' })
    setMsg(error ? 'Error: ' + error.message : 'Perfil guardado correctamente.')
  }

  if (!user) return null
  if (cargando) return <div className="loading">Cargando perfil...</div>

  return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mi perfil' }]} />
      <h1>Mi perfil</h1>
      <div className="perfil-avatar-zona">
        <div className="perfil-avatar">
          {perfil.avatar_url
            ? <img src={perfil.avatar_url} alt="Tu foto de perfil" />
            : <div className="perfil-avatar-placeholder">{(perfil.nombre_completo || user.email || '?').charAt(0).toUpperCase()}</div>}
        </div>
        <label className="button secondary">
          {subiendo ? 'Subiendo...' : 'Cambiar foto'}
          <input type="file" accept="image/*" onChange={handleAvatar} disabled={subiendo} style={{ display: 'none' }} />
        </label>
        <p className="nota">JPG o PNG, menos de 3 MB.</p>
      </div>
      <div className="formulario-datos">
        <label htmlFor="nom">Nombre completo</label>
        <input id="nom" type="text" value={perfil.nombre_completo}
               onChange={(e) => setPerfil({ ...perfil, nombre_completo: e.target.value })}
               placeholder="Como quieres que aparezca en tu constancia" />
        <label htmlFor="prof">Profesión o especialidad</label>
        <input id="prof" type="text" value={perfil.profesion}
               onChange={(e) => setPerfil({ ...perfil, profesion: e.target.value })} placeholder="Ej. Psicóloga clínica" />
        <label htmlFor="ubi">Ubicación</label>
        <input id="ubi" type="text" value={perfil.ubicacion}
               onChange={(e) => setPerfil({ ...perfil, ubicacion: e.target.value })} placeholder="Ciudad, país" />
        <label htmlFor="desc">Sobre mí</label>
        <textarea id="desc" rows="4" value={perfil.descripcion}
                  onChange={(e) => setPerfil({ ...perfil, descripcion: e.target.value })}
                  placeholder="Cuéntanos brevemente sobre ti y tu práctica." />
        <button className="button primary" onClick={handleGuardar}>Guardar cambios</button>
      </div>
      {msg && <p className={msg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'}>{msg}</p>}
      <div className="panel-info">
        <h3>Mis cursos</h3>
        {misCursos.length > 0
          ? <ul className="lista-cursos">{misCursos.map((c) => <li key={c.id}><Link to={`/curso/${c.id}`}>{c.titulo}</Link></li>)}</ul>
          : <p className="sutil">Aún no estás inscrito en ningún curso.</p>}
      </div>
      <BandaRedes />
    </section>
  )
}

/* ============================================================
   PANEL ADMIN
   ============================================================ */
function Admin({ user, esAdmin }) {
  const [vista, setVista] = useState('inscripciones')

  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [error, setError] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoPass, setNuevoPass] = useState('')
  const [cursosLista, setCursosLista] = useState([])
  const [cursosSeleccionados, setCursosSeleccionados] = useState([])
  const [creando, setCreando] = useState(false)
  const [msg, setMsg] = useState('')

  const [usuarios, setUsuarios] = useState([])
  const [accesos, setAccesos] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroCursoUsuario, setFiltroCursoUsuario] = useState('todos')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [expandidos, setExpandidos] = useState(new Set())
  const [toggling, setToggling] = useState({})
  const [cargandoGestion, setCargandoGestion] = useState(false)
  const [msgGestion, setMsgGestion] = useState('')
  const [bulkCursoId, setBulkCursoId] = useState('')
  const [bulkAccion, setBulkAccion] = useState('dar')
  const [bulkProcesando, setBulkProcesando] = useState(false)

  const [modalNotas, setModalNotas] = useState(null)
  const [guardandoNota, setGuardandoNota] = useState(false)

  const [confirmacion, setConfirmacion] = useState(null)

    // Inscripción masiva
  const [masivoAbierto, setMasivoAbierto] = useState(false)
  const [emailsMasivos, setEmailsMasivos] = useState('')
  const [passMasivo, setPassMasivo] = useState('')
  const [cursosMasivos, setCursosMasivos] = useState([])
  const [creandoMasivo, setCreandoMasivo] = useState(false)
  const [progresoMasivo, setProgresoMasivo] = useState({ actual: 0, total: 0 })
  const [resultadoMasivo, setResultadoMasivo] = useState(null)
  const [msgMasivo, setMsgMasivo] = useState('')
  
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/admin')); return }
    async function load() {
      const { data, error } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      if (error) setError(error.message); else setFilas(data || [])
      setCargando(false)
    }
    load()
  }, [user, navigate])

  useEffect(() => {
    if (!esAdmin) return
    supabase.from('cursos').select('id, titulo').eq('activo', true).order('orden')
      .then(({ data }) => setCursosLista(data || []))
  }, [esAdmin])

  const cargarGestion = async () => {
    setCargandoGestion(true)
    try {
      const { data: usrs, error: errU } = await supabase.rpc('listar_usuarios_con_accesos')
      if (errU) throw errU
      setUsuarios(usrs || [])

      const { data: todosAccesos } = await supabase.from('acceso').select('usuario_id, curso_id')
      const accMap = {}
      ;(todosAccesos || []).forEach(a => {
        if (!accMap[a.usuario_id]) accMap[a.usuario_id] = new Set()
        accMap[a.usuario_id].add(a.curso_id)
      })
      setAccesos(accMap)
    } catch (e) {
      console.error('Error cargando gestión:', e)
      setMsgGestion('Error cargando usuarios: ' + e.message)
    } finally {
      setCargandoGestion(false)
    }
  }

  useEffect(() => {
    if (!esAdmin || vista !== 'usuarios') return
    if (usuarios.length === 0) cargarGestion()
  }, [esAdmin, vista, usuarios.length])

  const fecha = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const esActivo = (u) => {
    if (!u.ultimo_ingreso) return false
    const dias = (Date.now() - new Date(u.ultimo_ingreso).getTime()) / (1000 * 60 * 60 * 24)
    return dias <= 14
  }
  const diasSinEntrar = (u) => {
    if (!u.ultimo_ingreso) return null
    return Math.floor((Date.now() - new Date(u.ultimo_ingreso).getTime()) / (1000 * 60 * 60 * 24))
  }

  const toggleExpandido = (usuario_id) => {
    setExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(usuario_id)) nuevo.delete(usuario_id)
      else nuevo.add(usuario_id)
      return nuevo
    })
  }

  const toggleCurso = (id) => {
    setCursosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const crearUsuario = async () => {
    setMsg('')
    if (!nuevoEmail || !nuevoPass) { setMsg('Error: correo y contraseña son obligatorios'); return }
    if (nuevoPass.length < 6) { setMsg('Error: la contraseña debe tener al menos 6 caracteres'); return }
    if (cursosSeleccionados.length === 0) { setMsg('Error: selecciona al menos un curso'); return }

    setCreando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setMsg('Error: no hay sesión activa'); setCreando(false); return }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuario`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          email: nuevoEmail,
          password: nuevoPass,
          curso_ids: cursosSeleccionados
        })
      })

      const texto = await res.text()
      let json = {}
      try { json = JSON.parse(texto) } catch {}
      const errorReal = json.error || json.message || json.code || texto || 'sin detalles'

      if (!res.ok || json.error) {
        setMsg(`Error (HTTP ${res.status}): ${errorReal}`)
      } else {
        setMsg(`✅ Usuario ${json.email} creado y asignado a ${cursosSeleccionados.length} curso(s)`)
        setNuevoEmail('')
        setNuevoPass('')
        setCursosSeleccionados([])
        const { data } = await supabase.from('vista_admin_inscripciones')
          .select('*').order('inscrito_el', { ascending: false })
        setFilas(data || [])
        setUsuarios([])
      }
    } catch (e) {
      setMsg('Error inesperado: ' + (e.message || e.toString()))
    }
    setCreando(false)
  }
  const toggleCursoMasivo = (id) => {
    setCursosMasivos(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const parsearEmails = (texto) => {
    return texto
      .split(/[,;\n\r\t ]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e.includes('@') && e.includes('.'))
      .filter((e, i, arr) => arr.indexOf(e) === i)
  }

  const crearUsuariosMasivos = async () => {
    setMsgMasivo('')
    setResultadoMasivo(null)

    const emails = parsearEmails(emailsMasivos)

    if (emails.length === 0) { setMsgMasivo('Error: pega al menos un correo válido'); return }
    if (emails.length > 200) { setMsgMasivo(`Error: máximo 200 correos por lote (pegaste ${emails.length})`); return }
    if (!passMasivo || passMasivo.length < 6) { setMsgMasivo('Error: la contraseña debe tener al menos 6 caracteres'); return }
    if (cursosMasivos.length === 0) { setMsgMasivo('Error: selecciona al menos un curso'); return }

    const confirmado = await new Promise(resolve => {
      setConfirmacion({
        mensaje: `¿Crear ${emails.length} usuario(s) y asignarlos a ${cursosMasivos.length} curso(s)? Esta acción no se puede deshacer.`,
        onConfirm: () => { setConfirmacion(null); resolve(true) },
        onCancel: () => { setConfirmacion(null); resolve(false) }
      })
    })
    if (!confirmado) return

    setCreandoMasivo(true)
    setProgresoMasivo({ actual: 0, total: emails.length })

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuarios-bulk`
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setMsgMasivo('Error: no hay sesión activa'); setCreandoMasivo(false); return }

    const BATCH = 25
    const todosResultados = []
    let creados = 0, existentes = 0, errores = 0

    try {
      for (let i = 0; i < emails.length; i += BATCH) {
        const lote = emails.slice(i, i + BATCH)
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            emails: lote,
            password: passMasivo,
            curso_ids: cursosMasivos,
          }),
        })

        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)

        creados += json.creados || 0
        existentes += json.existentes || 0
        errores += json.errores || 0
        todosResultados.push(...(json.resultados || []))

        setProgresoMasivo({ actual: Math.min(i + BATCH, emails.length), total: emails.length })
      }

      setResultadoMasivo({
        total: emails.length,
        creados,
        existentes,
        errores,
        detalles: todosResultados,
      })
      setMsgMasivo(`✓ Proceso terminado: ${creados} creados, ${existentes} ya existían, ${errores} con error.`)

      const { data } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      setFilas(data || [])
      setUsuarios([])
      setEmailsMasivos('')
      setCursosMasivos([])

    } catch (e) {
      console.error('Error masivo:', e)
      setMsgMasivo('Error en inscripción masiva: ' + e.message)
    } finally {
      setCreandoMasivo(false)
      setProgresoMasivo({ actual: 0, total: 0 })
    }
  }

  const toggleAcceso = async (usuario_id, curso_id, tiene, email) => {
    if (tiene) {
      const ok = await new Promise(resolve => {
        setConfirmacion({
          mensaje: `¿Seguro que quieres quitar a ${email} del curso?`,
          onConfirm: () => { setConfirmacion(null); resolve(true) },
          onCancel: () => { setConfirmacion(null); resolve(false) }
        })
      })
      if (!ok) return
    }

    const key = `${usuario_id}-${curso_id}`
    setToggling(prev => ({ ...prev, [key]: true }))
    setMsgGestion('')
    try {
      if (tiene) {
        const { error } = await supabase
          .from('acceso')
          .delete()
          .eq('usuario_id', usuario_id)
          .eq('curso_id', curso_id)
        if (error) throw error
        setAccesos(prev => {
          const nuevo = { ...prev }
          nuevo[usuario_id] = new Set(nuevo[usuario_id] || [])
          nuevo[usuario_id].delete(curso_id)
          return nuevo
        })
        setMsgGestion('✓ Acceso revocado')
      } else {
        const { error } = await supabase
          .from('acceso')
          .insert({ usuario_id, curso_id, grupo: null })
        if (error) throw error
        setAccesos(prev => {
          const nuevo = { ...prev }
          nuevo[usuario_id] = new Set(nuevo[usuario_id] || [])
          nuevo[usuario_id].add(curso_id)
          return nuevo
        })
        setMsgGestion('✓ Acceso otorgado')
      }
      const { data } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      setFilas(data || [])
      setUsuarios(prev => prev.map(u => {
        if (u.usuario_id !== usuario_id) return u
        const count = (accesos[usuario_id]?.size || 0)
        return { ...u, cursos_inscritos: tiene ? Math.max(0, count - 1) : count + 1 }
      }))
    } catch (e) {
      setMsgGestion('Error: ' + e.message)
    } finally {
      setToggling(prev => {
        const nuevo = { ...prev }
        delete nuevo[key]
        return nuevo
      })
    }
  }

  const toggleSeleccion = (usuario_id) => {
    setSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(usuario_id)) nuevo.delete(usuario_id)
      else nuevo.add(usuario_id)
      return nuevo
    })
  }

  const toggleTodos = (lista) => {
    const todosSeleccionados = lista.every(u => seleccionados.has(u.usuario_id))
    if (todosSeleccionados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(lista.map(u => u.usuario_id)))
    }
  }

  const ejecutarBulk = async () => {
    if (!bulkCursoId) { setMsgGestion('Error: elige un curso'); return }
    const usuariosArr = [...seleccionados]
    if (usuariosArr.length === 0) { setMsgGestion('Error: no hay usuarios seleccionados'); return }

    if (bulkAccion === 'quitar') {
      const ok = await new Promise(resolve => {
        setConfirmacion({
          mensaje: `¿Quitar acceso al curso seleccionado a ${usuariosArr.length} usuario(s)?`,
          onConfirm: () => { setConfirmacion(null); resolve(true) },
          onCancel: () => { setConfirmacion(null); resolve(false) }
        })
      })
      if (!ok) return
    }

    setBulkProcesando(true)
    setMsgGestion('')

    try {
      const rpcName = bulkAccion === 'dar' ? 'bulk_grant_course_access' : 'bulk_remove_course_access'
      
      const { error } = await supabase.rpc(rpcName, {
        user_ids: usuariosArr,
        target_course_id: parseInt(bulkCursoId)
      })

      if (error) throw error

      setMsgGestion(`✓ Acción completada para ${usuariosArr.length} usuario(s)`)
      setSeleccionados(new Set())
      
      // Recargar la vista de inscripciones
      const { data } = await supabase.from('vista_admin_inscripciones')
        .select('*').order('inscrito_el', { ascending: false })
      setFilas(data || [])
      
      // Recargar la gestión de usuarios para actualizar los contadores
      await cargarGestion()
      
    } catch (e) {
      console.error('Error bulk:', e)
      setMsgGestion('Error en la acción masiva: ' + e.message)
    } finally {
      setBulkProcesando(false)
    }
  }

  const guardarNotas = async () => {
    if (!modalNotas) return
    setGuardandoNota(true)
    try {
      const { error } = await supabase
        .from('perfiles')
        .upsert({ id: modalNotas.usuario_id, notas_admin: modalNotas.texto }, { onConflict: 'id' })
      if (error) throw error
      setUsuarios(prev => prev.map(u =>
        u.usuario_id === modalNotas.usuario_id ? { ...u, notas_admin: modalNotas.texto } : u
      ))
      setModalNotas(null)
      setMsgGestion('✓ Notas guardadas')
    } catch (e) {
      setMsgGestion('Error al guardar nota: ' + e.message)
    } finally {
      setGuardandoNota(false)
    }
  }
  // ===== MÉTRICAS / ANALYTICS =====
  const [metricasCargando, setMetricasCargando] = useState(false)

  const calcularMetricas = () => {
    if (!filas || filas.length === 0) {
      return {
        alumnosUnicos: 0,
        totalInscripciones: 0,
        tasaFinalizacion: 0,
        activos30d: 0,
        inscripcionesPorMes: [],
        finalizacionPorCurso: [],
        alumnosPorCurso: [],
        alumnosEnRiesgo: [],
      }
    }

    // 1. Alumnos únicos
    const alumnosUnicos = new Set(filas.map(f => f.usuario_id)).size

    // 2. Total inscripciones
    const totalInscripciones = filas.length

    // 3. Tasa de finalización global
    let totalRecursos = 0
    let totalCompletados = 0
    filas.forEach(f => {
      totalRecursos += (f.total_recursos || 0)
      totalCompletados += (f.recursos_completados || 0)
    })
    const tasaFinalizacion = totalRecursos > 0
      ? Math.round((totalCompletados / totalRecursos) * 100)
      : 0

    // 4. Alumnos activos últimos 30 días (únicos)
    const hoy = Date.now()
    const hace30d = 30 * 24 * 60 * 60 * 1000
    const activosSet = new Set()
    filas.forEach(f => {
      if (f.ultimo_ingreso) {
        const dias = hoy - new Date(f.ultimo_ingreso).getTime()
        if (dias <= hace30d) activosSet.add(f.usuario_id)
      }
    })
    const activos30d = activosSet.size

    // 5. Inscripciones por mes (últimos 12 meses)
    const meses = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      meses.push({
        anio: d.getFullYear(),
        mes: d.getMonth(),
        label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
        count: 0,
      })
    }
    filas.forEach(f => {
      if (!f.inscrito_el) return
      const d = new Date(f.inscrito_el)
      const slot = meses.find(m => m.anio === d.getFullYear() && m.mes === d.getMonth())
      if (slot) slot.count++
    })
    const inscripcionesPorMes = meses

    // 6. Finalización por curso + alumnos por curso
    const porCurso = {}
    filas.forEach(f => {
      const key = f.curso || 'Sin curso'
      if (!porCurso[key]) {
        porCurso[key] = {
          curso: key,
          inscritos: 0,
          sumaRecursos: 0,
          sumaCompletados: 0,
          alumnosSet: new Set(),
        }
      }
      porCurso[key].inscritos++
      porCurso[key].sumaRecursos += (f.total_recursos || 0)
      porCurso[key].sumaCompletados += (f.recursos_completados || 0)
      porCurso[key].alumnosSet.add(f.usuario_id)
    })

    const finalizacionPorCurso = Object.values(porCurso)
      .map(c => ({
        curso: c.curso,
        inscritos: c.inscritos,
        tasa: c.sumaRecursos > 0
          ? Math.round((c.sumaCompletados / c.sumaRecursos) * 100)
          : 0,
      }))
      .sort((a, b) => b.tasa - a.tasa)

    const alumnosPorCurso = Object.values(porCurso)
      .map(c => ({
        curso: c.curso,
        alumnos: c.alumnosSet.size,
      }))
      .sort((a, b) => b.alumnos - a.alumnos)

    // 7. Alumnos en riesgo (>15 días sin entrar)
    const hace15d = 15 * 24 * 60 * 60 * 1000
    const riesgosMap = {}
    filas.forEach(f => {
      if (!f.ultimo_ingreso) return
      const dias = Math.floor((hoy - new Date(f.ultimo_ingreso).getTime()) / (1000 * 60 * 60 * 24))
      if (dias > 15) {
        if (!riesgosMap[f.usuario_id]) {
          riesgosMap[f.usuario_id] = {
            usuario_id: f.usuario_id,
            email: f.email,
            nombre_completo: f.nombre_completo,
            dias,
            cursos: [],
            ultimo_ingreso: f.ultimo_ingreso,
          }
        }
        riesgosMap[f.usuario_id].cursos.push(f.curso)
        // si hay varias inscripciones, guardar el más reciente
        if (new Date(f.ultimo_ingreso) > new Date(riesgosMap[f.usuario_id].ultimo_ingreso)) {
          riesgosMap[f.usuario_id].ultimo_ingreso = f.ultimo_ingreso
          riesgosMap[f.usuario_id].dias = dias
        }
      }
    })
    const alumnosEnRiesgo = Object.values(riesgosMap)
      .sort((a, b) => b.dias - a.dias)

    return {
      alumnosUnicos,
      totalInscripciones,
      tasaFinalizacion,
      activos30d,
      inscripcionesPorMes,
      finalizacionPorCurso,
      alumnosPorCurso,
      alumnosEnRiesgo,
    }
  }

  const metricas = calcularMetricas()
  const maxInscripcionesMes = Math.max(...metricas.inscripcionesPorMes.map(m => m.count), 1)
  const maxAlumnosCurso = Math.max(...metricas.alumnosPorCurso.map(c => c.alumnos), 1)

  // ===== FIN MÉTRICAS =====

  const usuariosFiltrados = usuarios.filter(u => {
    const t = busqueda.toLowerCase()
    const matchBusqueda = !t || u.email.toLowerCase().includes(t) || (u.nombre_completo || '').toLowerCase().includes(t)

    let matchEstado = true
    if (filtroEstado === 'con-acceso') matchEstado = (u.cursos_inscritos || 0) > 0
    else if (filtroEstado === 'sin-acceso') matchEstado = (u.cursos_inscritos || 0) === 0
    else if (filtroEstado === 'activos') matchEstado = esActivo(u)
    else if (filtroEstado === 'inactivos') matchEstado = !esActivo(u) && u.ultimo_ingreso !== null

    let matchCurso = true
    if (filtroCursoUsuario !== 'todos') {
      matchCurso = accesos[u.usuario_id]?.has(parseInt(filtroCursoUsuario)) || false
    }

    return matchBusqueda && matchEstado && matchCurso
  })

  if (!user) return null
  if (!esAdmin) return <div className="contenedor"><p className="aviso-error">No tienes permisos para ver esta sección.</p></div>
  if (cargando) return <div className="loading">Cargando panel...</div>
  if (error) return <div className="contenedor"><p className="aviso-error">Error: {error}</p></div>

  const cursosInscripciones = [...new Set(filas.map(f => f.curso))]
  const visibles = filtro === 'todos' ? filas : filas.filter(f => f.curso === filtro)
  const alumnosUnicos = new Set(filas.map(f => f.usuario_id)).size

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Panel de administración' }]} />
      <h1>Panel de administración</h1>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${vista === 'inscripciones' ? 'activa' : ''}`}
          onClick={() => setVista('inscripciones')}
        >
          📋 Inscripciones
        </button>
        <button
          type="button"
          className={`admin-tab ${vista === 'usuarios' ? 'activa' : ''}`}
          onClick={() => setVista('usuarios')}
        >
          👥 Gestión de usuarios
        </button>
                <button
          type="button"
          className={`admin-tab ${vista === 'metricas' ? 'activa' : ''}`}
          onClick={() => setVista('metricas')}
        >
          📊 Métricas
        </button>
      </div>

      {vista === 'inscripciones' && (
        <>
          <div className="admin-bloque-nuevo">
            <button
              type="button"
              className="button primary"
              onClick={() => setFormAbierto(v => !v)}
            >
              {formAbierto ? '✕ Cerrar' : '➕ Crear nuevo usuario'}
            </button>

            {formAbierto && (
              <div className="nuevo-usuario-form">
                <h3>Nuevo usuario</h3>
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={nuevoEmail}
                  onChange={e => setNuevoEmail(e.target.value)}
                  placeholder="alumno@ejemplo.com"
                />
                <label>Contraseña temporal</label>
                <input
                  type="text"
                  value={nuevoPass}
                  onChange={e => setNuevoPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <label>Cursos a los que tendrá acceso</label>
                <div className="cursos-checkboxes">
                  {cursosLista.map(c => (
                    <label key={c.id} className="curso-checkbox">
                      <input
                        type="checkbox"
                        checked={cursosSeleccionados.includes(c.id)}
                        onChange={() => toggleCurso(c.id)}
                      />
                      <span>{c.titulo}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="button whatsapp"
                  onClick={crearUsuario}
                  disabled={creando}
                >
                  {creando ? 'Creando...' : 'Crear usuario y asignar cursos'}
                </button>
                {msg && <p className={msg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'}>{msg}</p>}
              </div>
            )}
          </div>
          {/* ===== INSCRIPCIÓN MASIVA ===== */}
          <div className="admin-bloque-nuevo">
            <button
              type="button"
              className="button secondary"
              onClick={() => setMasivoAbierto(v => !v)}
            >
              {masivoAbierto ? '✕ Cerrar inscripción masiva' : '📥 Inscripción masiva (hasta 200 correos)'}
            </button>

            {masivoAbierto && (
              <div className="nuevo-usuario-form">
                <h3>Inscripción masiva de usuarios</h3>
                <p className="sutil" style={{ marginTop: 0, marginBottom: 14 }}>
                  Pega los correos separados por coma, punto y coma o salto de línea.
                  Se crearán todos con la misma contraseña temporal y se asignarán a los cursos que elijas.
                </p>

                <label>Correos electrónicos</label>
                <textarea
                  rows="6"
                  className="modal-textarea"
                  value={emailsMasivos}
                  onChange={e => setEmailsMasivos(e.target.value)}
                  placeholder={"alumno1@correo.com, alumno2@correo.com\nalumno3@correo.com; alumno4@correo.com"}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
                />
                <p className="nota" style={{ marginTop: 6 }}>
                  {parsearEmails(emailsMasivos).length} correo(s) válido(s) detectado(s)
                </p>

                <label>Contraseña temporal (misma para todos)</label>
                <input
                  type="text"
                  value={passMasivo}
                  onChange={e => setPassMasivo(e.target.value)}
                  placeholder="Ej. Curso2026!"
                />
                <p className="nota" style={{ marginTop: 6 }}>
                  ⚠️ Todos los usuarios nuevos compartirán esta contraseña. Avísales que la cambien después.
                </p>

                <label>Cursos a los que tendrán acceso</label>
                <div className="cursos-checkboxes">
                  {cursosLista.map(c => (
                    <label key={c.id} className="curso-checkbox">
                      <input
                        type="checkbox"
                        checked={cursosMasivos.includes(c.id)}
                        onChange={() => toggleCursoMasivo(c.id)}
                      />
                      <span>{c.titulo}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  className="button whatsapp"
                  onClick={crearUsuariosMasivos}
                  disabled={creandoMasivo}
                >
                  {creandoMasivo
                    ? `Procesando... ${progresoMasivo.actual} / ${progresoMasivo.total}`
                    : `Crear ${parsearEmails(emailsMasivos).length} usuario(s)`}
                </button>

                {msgMasivo && (
                  <p className={msgMasivo.startsWith('Error') ? 'aviso-error' : 'aviso-ok'} style={{ marginTop: 12 }}>
                    {msgMasivo}
                  </p>
                )}

                {resultadoMasivo && (
                  <div style={{ marginTop: 18 }}>
                    <div className="kpi-fila" style={{ marginTop: 8 }}>
                      <div className="kpi"><span className="kpi-num">{resultadoMasivo.creados}</span><span className="kpi-lbl">Creados</span></div>
                      <div className="kpi"><span className="kpi-num">{resultadoMasivo.existentes}</span><span className="kpi-lbl">Ya existían</span></div>
                      <div className="kpi"><span className="kpi-num">{resultadoMasivo.errores}</span><span className="kpi-lbl">Con error</span></div>
                    </div>

                    {resultadoMasivo.errores > 0 && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                          Ver detalle de errores ({resultadoMasivo.errores})
                        </summary>
                        <ul style={{ fontSize: 13, marginTop: 8 }}>
                          {resultadoMasivo.detalles
                            .filter(r => r.status !== 'creado')
                            .map((r, i) => (
                              <li key={i}>
                                <strong>{r.email}</strong> — {r.status}: {r.mensaje}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="kpi-fila">
            <div className="kpi"><span className="kpi-num">{alumnosUnicos}</span><span className="kpi-lbl">Alumnos</span></div>
            <div className="kpi"><span className="kpi-num">{filas.length}</span><span className="kpi-lbl">Inscripciones</span></div>
            <div className="kpi"><span className="kpi-num">{cursosInscripciones.length}</span><span className="kpi-lbl">Cursos con alumnos</span></div>
          </div>
          <div className="filtros">
            <button className={`filtro ${filtro === 'todos' ? 'activo' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
            {cursosInscripciones.map(c => (
              <button key={c} className={`filtro ${filtro === c ? 'activo' : ''}`} onClick={() => setFiltro(c)}>{c}</button>
            ))}
          </div>
          <div className="tabla-scroll">
            <table className="tabla-admin">
              <thead><tr><th>Alumno</th><th>Curso</th><th>Progreso</th><th>Inscrito</th><th>Último ingreso</th></tr></thead>
              <tbody>
                {visibles.map((f, i) => {
                  const pct = f.total_recursos > 0 ? Math.round((f.recursos_completados / f.total_recursos) * 100) : 0
                  return (
                    <tr key={i}>
                      <td>
                        <strong>{f.nombre_completo || '(sin nombre)'}</strong>
                        <span className="celda-sub">{f.email}</span>
                        {f.profesion && <span className="celda-sub">{f.profesion}</span>}
                      </td>
                      <td>{f.curso}</td>
                      <td>
                        <div className="mini-barra"><div className="mini-lleno" style={{ width: `${pct}%` }} /></div>
                        <span className="celda-sub">{f.recursos_completados}/{f.total_recursos} · {pct}%</span>
                      </td>
                      <td>{fecha(f.inscrito_el)}</td>
                      <td>{fecha(f.ultimo_ingreso)}</td>
                    </tr>
                  )
                })}
                {visibles.length === 0 && <tr><td colSpan="5" className="sutil">Sin inscripciones todavía.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === 'usuarios' && (
        <>
          <p className="seccion-intro">
            Administra el acceso de cada usuario a los cursos. La contraseña del usuario nunca se modifica.
            Haz clic en un usuario para ver y editar sus cursos.
          </p>

          <div className="gestion-filtros">
            <input
              type="text"
              className="gestion-busqueda"
              placeholder="🔍 Buscar por correo o nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <select
              className="gestion-select"
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
            >
              <option value="todos">Todos los estados</option>
              <option value="con-acceso">Con acceso a cursos</option>
              <option value="sin-acceso">Sin acceso a cursos</option>
              <option value="activos">Activos (últimos 14 días)</option>
              <option value="inactivos">Inactivos</option>
            </select>
            <select
              className="gestion-select"
              value={filtroCursoUsuario}
              onChange={e => setFiltroCursoUsuario(e.target.value)}
            >
              <option value="todos">Todos los cursos</option>
              {cursosLista.map(c => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>
          </div>

          {msgGestion && (
            <p className={msgGestion.startsWith('Error') ? 'aviso-error' : 'aviso-ok'} style={{ marginTop: 8 }}>
              {msgGestion}
            </p>
          )}

          {seleccionados.size > 0 && (
            <div className="bulk-bar">
              <span className="bulk-count">{seleccionados.size} seleccionado(s)</span>
              <select
                className="gestion-select"
                value={bulkAccion}
                onChange={e => setBulkAccion(e.target.value)}
              >
                <option value="dar">Dar acceso a</option>
                <option value="quitar">Quitar acceso de</option>
              </select>
              <select
                className="gestion-select"
                value={bulkCursoId}
                onChange={e => setBulkCursoId(e.target.value)}
              >
                <option value="">— Elige un curso —</option>
                {cursosLista.map(c => (
                  <option key={c.id} value={c.id}>{c.titulo}</option>
                ))}
              </select>
              <button
                type="button"
                className="button primary"
                onClick={ejecutarBulk}
                disabled={bulkProcesando || !bulkCursoId}
              >
                {bulkProcesando ? 'Procesando...' : 'Aplicar a seleccionados'}
              </button>
              <button
                type="button"
                className="button texto"
                onClick={() => setSeleccionados(new Set())}
              >
                Cancelar
              </button>
            </div>
          )}

          {cargandoGestion ? (
            <div className="loading">Cargando usuarios...</div>
          ) : usuarios.length === 0 ? (
            <p className="sutil">No hay usuarios registrados todavía.</p>
          ) : (
            <>
              {usuariosFiltrados.length > 0 && (
                <div className="gestion-toolbar">
                  <button
                    type="button"
                    className="button texto"
                    onClick={() => toggleTodos(usuariosFiltrados)}
                  >
                    {usuariosFiltrados.every(u => seleccionados.has(u.usuario_id))
                      ? '☐ Deseleccionar todos'
                      : '☑ Seleccionar todos los visibles'}
                  </button>
                  <span className="sutil">{usuariosFiltrados.length} usuario(s) mostrado(s)</span>
                </div>
              )}

              <div className="gestion-usuarios">
                {usuariosFiltrados.length === 0 && (
                  <p className="sutil">No se encontraron usuarios con ese criterio.</p>
                )}
                {usuariosFiltrados.map(u => {
                  const cursosDelUsuario = u.cursos_inscritos || 0
                  const seleccionado = seleccionados.has(u.usuario_id)
                  const expandido = expandidos.has(u.usuario_id)
                  const inactivo = u.ultimo_ingreso && !esActivo(u)
                  const dias = diasSinEntrar(u)
                  return (
                    <div key={u.usuario_id} className={`gestion-usuario-card ${seleccionado ? 'seleccionado' : ''} ${expandido ? 'expandido' : ''}`}>
                      <div className="gestion-usuario-header">
                        <div className="gestion-usuario-check">
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() => toggleSeleccion(u.usuario_id)}
                          />
                        </div>
                        <div className="gestion-usuario-info">
                          <div className="gestion-usuario-nombre-linea">
                            <strong>{u.nombre_completo || '(sin nombre)'}</strong>
                            {cursosDelUsuario > 0
                              ? <span className="badge ok">{cursosDelUsuario} curso(s)</span>
                              : <span className="badge neutro">Sin acceso</span>}
                            {inactivo && <span className="badge" style={{ background: '#FBEDEA', color: '#9B2C20' }}>
                              Inactivo {dias}d
                            </span>}
                          </div>
                          <span className="celda-sub">{u.email}</span>
                          {u.profesion && <span className="celda-sub">{u.profesion}</span>}
                          {u.ultimo_ingreso && (
                            <span className="celda-sub">Último ingreso: {fecha(u.ultimo_ingreso)}</span>
                          )}
                          {u.notas_admin && (
                            <span className="gestion-nota-preview">📝 {u.notas_admin}</span>
                          )}
                        </div>
                        <div className="gestion-usuario-acciones">
                          <button
                            type="button"
                            className="button texto"
                            onClick={() => setModalNotas({
                              usuario_id: u.usuario_id,
                              email: u.email,
                              texto: u.notas_admin || ''
                            })}
                          >
                            {u.notas_admin ? '✏️ Editar nota' : '📝 Añadir nota'}
                          </button>
                          <button
                            type="button"
                            className="gestion-expandir-btn"
                            onClick={() => toggleExpandido(u.usuario_id)}
                          >
                            {expandido ? '▲ Ocultar cursos' : '▼ Ver cursos'}
                          </button>
                        </div>
                      </div>

                      {expandido && (
                        <div className="gestion-cursos">
                          {cursosLista.map(c => {
                            const tiene = accesos[u.usuario_id]?.has(c.id) || false
                            const key = `${u.usuario_id}-${c.id}`
                            const ocupado = toggling[key]
                            return (
                              <div key={c.id} className={`gestion-curso-fila ${tiene ? 'con-acceso' : ''}`}>
                                <span className="gestion-curso-titulo">{c.titulo}</span>
                                <button
                                  type="button"
                                  className={`gestion-toggle ${tiene ? 'quitar' : 'dar'}`}
                                  onClick={() => toggleAcceso(u.usuario_id, c.id, tiene, u.email)}
                                  disabled={ocupado}
                                >
                                  {ocupado ? '...' : tiene ? '✓ Con acceso · Quitar' : '+ Dar acceso'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
      {vista === 'metricas' && (
        <>
          <p className="seccion-intro">
            Vista general del comportamiento de la plataforma. Los datos se calculan al vuelo desde las inscripciones actuales.
          </p>

          <div className="kpi-fila">
            <div className="kpi">
              <span className="kpi-num">{metricas.alumnosUnicos}</span>
              <span className="kpi-lbl">Alumnos únicos</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{metricas.totalInscripciones}</span>
              <span className="kpi-lbl">Inscripciones</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{metricas.tasaFinalizacion}%</span>
              <span className="kpi-lbl">Finalización global</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{metricas.activos30d}</span>
              <span className="kpi-lbl">Activos últimos 30 días</span>
            </div>
          </div>

          {/* ===== Inscripciones por mes ===== */}
          <section className="metricas-bloque">
            <h3 className="metricas-titulo">📅 Inscripciones por mes (últimos 12)</h3>
            <div className="grafico-barras-vertical">
              {metricas.inscripcionesPorMes.map((m, i) => (
                <div key={i} className="barra-v-col">
                  <div className="barra-v-valor">{m.count > 0 ? m.count : ''}</div>
                  <div
                    className="barra-v-relleno"
                    style={{
                      height: `${maxInscripcionesMes > 0 ? (m.count / maxInscripcionesMes) * 100 : 0}%`,
                      minHeight: m.count > 0 ? '4px' : '0',
                    }}
                    title={`${m.count} inscripción(es)`}
                  />
                  <div className="barra-v-label">{m.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== Finalización por curso ===== */}
          <section className="metricas-bloque">
            <h3 className="metricas-titulo">🎯 Tasa de finalización por curso</h3>
            {metricas.finalizacionPorCurso.length === 0
              ? <p className="sutil">Sin datos todavía.</p>
              : <div className="grafico-barras-horizontal">
                  {metricas.finalizacionPorCurso.map((c, i) => (
                    <div key={i} className="barra-h-fila">
                      <div className="barra-h-label" title={c.curso}>{c.curso}</div>
                      <div className="barra-h-track">
                        <div
                          className="barra-h-relleno"
                          style={{ width: `${c.tasa}%` }}
                        />
                      </div>
                      <div className="barra-h-valor">{c.tasa}%</div>
                    </div>
                  ))}
                </div>}
          </section>

          {/* ===== Alumnos por curso ===== */}
          <section className="metricas-bloque">
            <h3 className="metricas-titulo">👥 Alumnos por curso</h3>
            {metricas.alumnosPorCurso.length === 0
              ? <p className="sutil">Sin datos todavía.</p>
              : <div className="grafico-barras-horizontal">
                  {metricas.alumnosPorCurso.map((c, i) => (
                    <div key={i} className="barra-h-fila">
                      <div className="barra-h-label" title={c.curso}>{c.curso}</div>
                      <div className="barra-h-track">
                        <div
                          className="barra-h-relleno azul"
                          style={{ width: `${(c.alumnos / maxAlumnosCurso) * 100}%` }}
                        />
                      </div>
                      <div className="barra-h-valor">{c.alumnos}</div>
                    </div>
                  ))}
                </div>}
          </section>

          {/* ===== Alumnos en riesgo ===== */}
          <section className="metricas-bloque">
            <h3 className="metricas-titulo">⚠️ Alumnos en riesgo ({metricas.alumnosEnRiesgo.length})</h3>
            <p className="nota" style={{ marginTop: 0, marginBottom: 12 }}>
              Inscritos que no ingresan desde hace más de 15 días. Buen momento para un correo de reactivación.
            </p>
            {metricas.alumnosEnRiesgo.length === 0
              ? <p className="aviso-ok">🎉 Ningún alumno en riesgo. Todos activos.</p>
              : <div className="tabla-scroll">
                  <table className="tabla-admin">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Días sin entrar</th>
                        <th>Cursos</th>
                        <th>Último ingreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricas.alumnosEnRiesgo.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{a.nombre_completo || '(sin nombre)'}</strong>
                            <span className="celda-sub">{a.email}</span>
                          </td>
                          <td>
                            <span className="badge" style={{ background: '#FBEDEA', color: '#9B2C20' }}>
                              {a.dias} días
                            </span>
                          </td>
                          <td>
                            <span className="celda-sub" style={{ fontSize: 12 }}>
                              {a.cursos.join(' · ')}
                            </span>
                          </td>
                          <td>{fecha(a.ultimo_ingreso)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
          </section>
        </>
      )}

      {modalNotas && (
        <div className="modal-overlay" onClick={() => !guardandoNota && setModalNotas(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Notas privadas</h3>
            <p className="sutil" style={{ marginBottom: 16 }}>
              Solo tú puedes ver estas notas sobre <strong>{modalNotas.email}</strong>.
            </p>
            <textarea
              rows="5"
              className="modal-textarea"
              value={modalNotas.texto}
              onChange={e => setModalNotas({ ...modalNotas, texto: e.target.value })}
              placeholder="Ej: pagó en efectivo, pidió factura, beca parcial..."
              autoFocus
            />
            <div className="modal-botones">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalNotas(null)}
                disabled={guardandoNota}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={guardarNotas}
                disabled={guardandoNota}
              >
                {guardandoNota ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacion && (
        <div className="modal-overlay">
          <div className="modal-box modal-confirm">
            <h3>⚠️ Confirmar acción</h3>
            <p>{confirmacion.mensaje}</p>
            <div className="modal-botones">
              <button
                type="button"
                className="button secondary"
                onClick={confirmacion.onCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button primary"
                onClick={confirmacion.onConfirm}
                style={{ background: '#9B2C20', borderColor: '#9B2C20' }}
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <BandaRedes />
    </section>
  )
}

/* ============================================================
   VISOR PDF
   ============================================================ */
function PdfViewer({ archivo, bucket }) {
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('Cargando documento...')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false, loadingTask = null, pdfDocument = null
    async function loadPdf() {
      try {
        setPages([]); setStatus('Descargando documento...')
        const { data: blob, error } = await supabase.storage.from(bucket).download(archivo)
        if (error) throw new Error(error.message)
        const buf = await blob.arrayBuffer()
        if (cancelled) return
        if (buf.byteLength === 0) throw new Error('El archivo está vacío')
        setStatus('Procesando...')
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false })
        pdfDocument = await loadingTask.promise
        if (cancelled) return
        const cargadas = []
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          if (cancelled) return
          cargadas.push(await pdfDocument.getPage(i))
        }
        if (!cancelled) { setPages(cargadas); setStatus('') }
      } catch (err) { if (!cancelled) { setError(err.message); setStatus('') } }
    }
    loadPdf()
    return () => { cancelled = true; if (loadingTask) loadingTask.destroy(); if (pdfDocument) pdfDocument.destroy() }
  }, [archivo, bucket])

  if (error) return <div className="aviso-error">No se pudo cargar el documento: {error}</div>
  if (status) return <div className="loading">{status}</div>
  return <div className="pdf-viewer">{pages.map((p, i) => <PdfPage key={i} page={p} n={i + 1} total={pages.length} />)}</div>
}

function PdfPage({ page, n, total }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    let renderTask = null, cancelled = false
    async function render() {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const ancho = Math.min(window.innerWidth - 60, 860)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: ancho / base.width })
      const dpr = window.devicePixelRatio || 1
      const ctx = canvas.getContext('2d', { alpha: false })
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      renderTask = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null })
      await renderTask.promise
    }
    render().catch((e) => { if (e?.name !== 'RenderingCancelledException') console.error(e) })
    return () => { cancelled = true; if (renderTask) renderTask.cancel() }
  }, [page])

  return (
    <figure className="pdf-page">
      <canvas ref={canvasRef} aria-label={`Página ${n} de ${total}`} />
      <figcaption className="pdf-num">{n} / {total}</figcaption>
    </figure>
  )
}

/* ============================================================
   RECURSOS
   ============================================================ */
function VideoPlayer({ url }) {
  if (!url) return <div className="aviso-error">La grabación todavía no está disponible. La subiré pronto.</div>
  return (
    <div className="video-wrapper">
      <iframe src={url} className="video-iframe" title="Video del curso"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  )
}

function Autoevaluacion({ url, recursoId, userId, onComplete }) {
  const [intentos, setIntentos] = useState(0)
  const [completado, setCompletado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('progreso_usuario')
        .select('intentos, completado').eq('usuario_id', userId).eq('recurso_id', recursoId).maybeSingle()
      if (data) { setIntentos(data.intentos || 0); setCompletado(data.completado || false) }
      setCargando(false)
    }
    load()
  }, [recursoId, userId])

  const marcar = async () => {
    const n = intentos + 1
    const { error } = await supabase.from('progreso_usuario').upsert(
      { usuario_id: userId, recurso_id: recursoId, intentos: n, completado: true, ultimo_acceso: new Date().toISOString() },
      { onConflict: 'usuario_id, recurso_id' })
    if (!error) { setIntentos(n); setCompletado(true); onComplete() }
  }

  if (cargando) return <div className="loading">Cargando...</div>
  if (completado) return <div className="aviso-ok">✔ Autoevaluación completada.</div>
  if (intentos >= 3) return <div className="aviso-error">Alcanzaste el límite de 3 intentos.</div>
  return (
    <div>
      <p className="sutil">Máximo 3 intentos. Llevas {intentos}.</p>
      <iframe src={url} className="forms-iframe" title="Autoevaluación" />
      <button className="button primary" onClick={marcar}>Marcar como completada</button>
    </div>
  )
}

function RecursoCard({ recurso, bucket, user, visto, onMarcarVisto }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const colapsable = ['pdf', 'video', 'autoevaluacion'].includes(recurso.tipo)
  const videoSinUrl = recurso.tipo === 'video' && !recurso.url

  const abrirNuevaPestana = async () => {
    setOcupado(true)
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(recurso.archivo, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      const { data } = supabase.storage.from(bucket).getPublicUrl(recurso.archivo)
      window.open(data.publicUrl, '_blank', 'noopener,noreferrer')
    }
    setOcupado(false)
  }

  const descargar = async () => {
    setOcupado(true)
    try {
      const { data, error } = await supabase.storage.from(bucket).download(recurso.archivo)
      if (error) throw error
      const a = document.createElement('a')
      a.href = URL.createObjectURL(data)
      a.download = recurso.archivo.split('/').pop()
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (err) { alert('Error al descargar: ' + err.message) }
    setOcupado(false)
  }

  return (
    <article className="recurso-item" id={`r-${recurso.id}`}>
      <div className="recurso-cabecera">
        <div className="recurso-titulo">
          <span className="recurso-icono" aria-hidden="true">{ICONO_TIPO[recurso.tipo] || '📌'}</span>
          <div>
            <h3>{recurso.titulo}</h3>
            <span className="recurso-tipo">{NOMBRE_TIPO[recurso.tipo] || 'Recurso'}</span>
          </div>
        </div>
        {visto && <span className="badge ok">✔ Visto</span>}
      </div>

      {recurso.descripcion && <p className="recurso-desc">{recurso.descripcion}</p>}

      <div className="recurso-acciones">
        {colapsable && !videoSinUrl && (
          <button className={`button ${abierto ? 'secondary' : 'primary'}`} onClick={() => setAbierto(v => !v)} aria-expanded={abierto}>
            {abierto ? 'Ocultar material' : 'Ver material'}
          </button>
        )}
        {videoSinUrl && <button className="button secondary" disabled>🎬 Grabación en proceso</button>}
        {recurso.tipo === 'enlace' && (
          <a className="button primary" href={recurso.url} target="_blank" rel="noopener noreferrer">Abrir enlace →</a>
        )}
        {recurso.tipo === 'pdf' && (
          <button className="button secondary" onClick={abrirNuevaPestana} disabled={ocupado}>
            {ocupado ? 'Abriendo...' : 'Abrir en pestaña nueva ↗'}
          </button>
        )}
        {recurso.tipo === 'word' && (
          <button className="button primary" onClick={descargar} disabled={ocupado}>
            {ocupado ? 'Descargando...' : 'Descargar documento'}
          </button>
        )}
        {user && !visto && recurso.tipo !== 'autoevaluacion' && !videoSinUrl && (
          <button className="button texto" onClick={() => onMarcarVisto(recurso.id)}>Marcar como visto</button>
        )}
      </div>

      {abierto && (
        <div className="recurso-contenido">
          {recurso.tipo === 'pdf' && <PdfViewer archivo={recurso.archivo} bucket={bucket} />}
          {recurso.tipo === 'video' && <VideoPlayer url={recurso.url} />}
          {recurso.tipo === 'autoevaluacion' && user &&
            <Autoevaluacion url={recurso.url} recursoId={recurso.id} userId={user.id} onComplete={() => onMarcarVisto(recurso.id)} />}
        </div>
      )}
    </article>
  )
}

/* ============================================================
   DIAPOSITIVAS PARA PRESENTAR CASO
   ============================================================ */
function DiapositivasPresentarCaso() {
  return (
    <section className="diapositivas-bloque">
      <header className="diapositivas-header">
        <span className="recurso-icono">📽️</span>
        <div>
          <h3>Diapositivas para presentar tu caso</h3>
          <p className="recurso-desc">
            Usa esta plantilla para estructurar la presentación de tu caso en la sesión de supervisión.
            Incluye los apartados que revisaremos juntos: motivo de consulta, análisis funcional, hipótesis y plan.
          </p>
        </div>
      </header>
      <div className="diapositivas-acciones">
        <a className="button primary ancho" target="_blank" rel="noopener noreferrer"
           href={ENLACE_DIAPOSITIVAS_PRESENTAR_CASO}>
          📽️ Abrir diapositivas en OneDrive
        </a>
        <p className="nota" style={{ marginTop: 8 }}>
          Se abre en una pestaña nueva. Puedes descargarla y editarla con tu propio caso.
        </p>
      </div>
    </section>
  )
}

/* ============================================================
   ENTREGABLES / PRODUCTOS
   ============================================================ */
function Entregables() {
  return (
    <section className="entregables-bloque">
      <header className="entregables-header">
        <span className="recurso-icono">📤</span>
        <div>
          <h3>Entregables / productos</h3>
          <p className="recurso-desc">
            Las actividades de las <strong>sesiones 1 y 2</strong> se realizan <strong>en equipo durante la sesión</strong>
            {' '}y se suben como entregables al final de cada una. Nombren cada archivo haciendo referencia al{' '}
            <strong>nombre de su región</strong> (ej. <em>Región_Norte_S1_análisis.pdf</em>).
          </p>
        </div>
      </header>
      <div className="entregables-acciones">
        <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
           href={ENLACE_ENTREGABLES}>
          📤 Subir mi entregable a OneDrive
        </a>
        <p className="nota" style={{ marginTop: 8 }}>
          Se abre la carpeta compartida en una pestaña nueva. Sube tu archivo ahí con el nombre indicado.
        </p>
      </div>
    </section>
  )
}

/* ============================================================
   EXAMEN POR MÓDULO
   ============================================================ */
function ExamenModulo({ moduloId, user }) {
  const [examen, setExamen] = useState(null)
  const [intentos, setIntentos] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: ex } = await supabase.from('examenes').select('*')
        .eq('modulo_id', moduloId).eq('activo', true).maybeSingle()
      setExamen(ex)
      if (ex && user) {
        const { data: int } = await supabase.from('intentos_examen')
          .select('*').eq('usuario_id', user.id).eq('examen_id', ex.id)
          .order('fecha', { ascending: false })
        setIntentos(int || [])
      }
      setCargando(false)
    }
    load()
  }, [moduloId, user])

  if (cargando) return null
  if (!examen) return null
  if (!user) return null

  const calificar = () => {
    const preguntas = examen.preguntas || []
    let correctas = 0
    preguntas.forEach(p => {
      const idx = respuestas[p.id]
      if (idx != null && p.opciones?.[idx]?.correcta) correctas++
    })
    const calificacion = preguntas.length ? Math.round((correctas / preguntas.length) * 100) : 0
    return { calificacion, aprobado: calificacion >= examen.umbral_aprobacion }
  }

  const enviar = async () => {
    const preguntas = examen.preguntas || []
    if (Object.keys(respuestas).length < preguntas.length) {
      alert('Responde todas las preguntas antes de enviar.'); return
    }
    setEnviando(true)
    const { calificacion, aprobado } = calificar()
    const { error } = await supabase.from('intentos_examen').insert({
      usuario_id: user.id,
      examen_id: examen.id,
      respuestas,
      calificacion,
      aprobado
    })
    if (error) { alert('Error al guardar: ' + error.message); setEnviando(false); return }
    setResultado({ calificacion, aprobado })
    setIntentos(prev => [{ calificacion, aprobado, fecha: new Date().toISOString() }, ...prev])
    setEnviando(false)
  }

  const reintentar = () => { setRespuestas({}); setResultado(null) }
  const mejor = intentos.reduce((m, i) => Math.max(m, i.calificacion), 0)

  return (
    <div className="examen-bloque">
      <header className="examen-header">
        <span className="recurso-icono">✍️</span>
        <div>
          <h3>{examen.titulo}</h3>
          {examen.descripcion && <p className="recurso-desc">{examen.descripcion}</p>}
          <p className="examen-meta">Aprobación con {examen.umbral_aprobacion}% · Mejor intento: {mejor}%</p>
        </div>
      </header>

      {resultado ? (
        <div className={resultado.aprobado ? 'aviso-ok' : 'aviso-error'}>
          <strong>{resultado.aprobado ? '✅ Aprobado' : '❌ No aprobado'}</strong> — {resultado.calificacion}%
          <div style={{ marginTop: 10 }}>
            <button className="button secondary" onClick={reintentar}>Volver a intentar</button>
          </div>
        </div>
      ) : (
        <>
          <ol className="examen-preguntas">
            {(examen.preguntas || []).map((p) => (
              <li key={p.id}>
                <p className="examen-pregunta">{p.pregunta}</p>
                <div className="examen-opciones">
                  {p.opciones.map((o, j) => (
                    <label key={j} className={`examen-opcion ${respuestas[p.id] === j ? 'sel' : ''}`}>
                      <input type="radio" name={p.id}
                             checked={respuestas[p.id] === j}
                             onChange={() => setRespuestas(r => ({ ...r, [p.id]: j }))} />
                      <span>{o.texto}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <button className="button primary" onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar respuestas'}
          </button>
        </>
      )}

      {intentos.length > 0 && (
        <details className="examen-historial">
          <summary>Historial de intentos ({intentos.length})</summary>
          <ul>
            {intentos.map((it, i) => (
              <li key={i}>
                {new Date(it.fecha).toLocaleDateString('es-MX')} — {it.calificacion}%{' '}
                {it.aprobado ? '✅' : '❌'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/* ============================================================
   CURSO
   ============================================================ */
function CursoView({ user, esAdmin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [talleres, setTalleres] = useState([])
  const [miGrupo, setMiGrupo] = useState(null)
  const [progreso, setProgreso] = useState(0)
  const [estado, setEstado] = useState('cargando')
  const [error, setError] = useState(null)

  const [notificando, setNotificando] = useState(null)
  const [msgNotificacion, setMsgNotificacion] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: c, error: eC } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
        if (eC) throw eC
        setCurso(c)
        if (!c) { setEstado('ok'); return }
        if (c.proximamente) { setEstado('proximo'); return }

        if (esContenedorTalleres(c)) {
          const { data: hermanos, error: eH } = await supabase.from('cursos')
            .select('*').eq('gratuito', true).eq('activo', true).neq('id', c.id).order('orden')
          if (eH) throw eH
          setTalleres(hermanos || [])
          setEstado('talleres')
          return
        }

        let grupo = null
        if (!esAdmin && !c.gratuito && user) {
          const { data: acc } = await supabase.from('acceso')
            .select('id, grupo').eq('usuario_id', user.id).eq('curso_id', id).maybeSingle()
          if (acc) grupo = acc.grupo || null
        }
        setMiGrupo(grupo)

        const { data: mods, error: eM } = await supabase.from('modulos')
          .select('*').eq('curso_id', id).eq('activo', true).order('orden')
        if (eM) throw eM

        const visibles = (mods || []).filter(m => esAdmin || !m.oculto || !!user)
        setModulos(visibles)

        if (user && visibles.length) {
          const modsConAcceso = visibles.filter(m => {
            if (esAdmin) return true
            if (m.disponible === false) return false
            if (m.grupo && m.grupo !== grupo) return false
            return true
          })
          const ids = []
          for (const m of modsConAcceso) {
            const { data: rs } = await supabase.from('recursos').select('id').eq('modulo_id', m.id)
            ids.push(...(rs || []).map(r => r.id))
          }
          if (ids.length) {
            const { data: comp } = await supabase.from('progreso_usuario').select('recurso_id')
              .eq('usuario_id', user.id).in('recurso_id', ids).eq('completado', true)
            setProgreso(Math.round(((comp?.length || 0) / ids.length) * 100))
          }
        }
        setEstado('ok')
      } catch (e) {
        console.error('Error en CursoView:', e); setError(e.message); setEstado('ok')
      }
    }
    load()
  }, [id, user, esAdmin])

  if (estado === 'cargando') return <div className="loading">Cargando...</div>
  if (error) return <div className="contenedor"><p className="aviso-error">Error al cargar el curso: {error}</p></div>
  if (!curso) return <div className="contenedor"><p className="aviso-error">Curso no encontrado.</p></div>

  if (estado === 'talleres') {
    return (
      <section className="contenedor">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo }]} />
        <div className="curso-encabezado">
          <h1>{curso.titulo}</h1>
          <p className="curso-desc">{curso.descripcion}</p>
        </div>
        {curso.info_curso && (
          <div className="curso-info-extra">
            {curso.info_curso.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
        <h2 className="titulo-seccion">Talleres disponibles</h2>
        {talleres.length === 0
          ? <p className="sutil">Todavía no hay talleres publicados en esta sección.</p>
          : <div className="course-grid">
              {talleres.map(t => <CursoCard key={t.id} curso={t} user={user} tieneAcceso={false} />)}
            </div>}
        <BandaRedes />
      </section>
    )
  }

  if (estado === 'proximo') {
    return (
      <section className="contenedor estrecho">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo }]} />
        <h1>{curso.titulo}</h1>
        <p>{curso.descripcion}</p>
        <div className="bloque-cerrado">
          <p className="bloque-icono">🗓️</p>
          <p>Este curso está en preparación. Déjame tu interés por WhatsApp y te aviso en cuanto abra su inscripción.</p>
          <div className="bloque-botones">
            <a className="button whatsapp" target="_blank" rel="noopener noreferrer"
               href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me avisas cuándo abre?`)}>
              Me interesa · avísame
            </a>
            <button className="button secondary" onClick={() => navigate('/')}>Volver al inicio</button>
          </div>
        </div>
        <BandaRedes />
      </section>
    )
  }

  const especial = cursoEspecial(curso)

  const grupos = []
  modulos.forEach(m => {
    if (m.grupo && !grupos.includes(m.grupo)) grupos.push(m.grupo)
  })
  const modsSinGrupo = modulos.filter(m => !m.grupo)

  const rutaLabel = (g) =>
    g === 'Acompañamiento' ? 'Ruta Acompañamiento'
    : g === 'Clínica' ? 'Ruta Clínica'
    : `Ruta ${g}`

  const rutaDescripcion = (g) =>
    g === 'Acompañamiento'
      ? 'Para profesionales que acompañan personas en duelo sin ser especialistas en salud mental.'
      : g === 'Clínica'
      ? 'Para profesionales de salud mental que atienden duelo en consulta.'
      : ''

  const tieneAccesoAlGrupo = (g) => {
    if (esAdmin) return true
    if (!user) return false
    if (!g) return true
    return miGrupo === g
  }

  const esModuloBloqueado = (m) => {
    if (esAdmin) return false
    if (m.disponible === false) return true
    if (!user) return true
    if (m.grupo && miGrupo !== m.grupo) return true
    return false
  }

  const toggleDisponible = async (m) => {
    if (!esAdmin) return
    const nuevo = !m.disponible

    let notificar = false
    if (nuevo === true) {
      notificar = await new Promise(resolve => {
        setConfirmacion({
          mensaje: '¿Quieres enviar un correo a los alumnos del curso avisando que este módulo está disponible?',
          botonConfirmar: 'Sí, abrir y notificar',
          botonCancelar: 'Solo abrir',
          onConfirm: () => { setConfirmacion(null); resolve(true) },
          onCancel: () => { setConfirmacion(null); resolve(false) }
        })
      })
    }

    const { error } = await supabase.from('modulos').update({ disponible: nuevo }).eq('id', m.id)
    if (error) { alert('Error al cambiar disponibilidad: ' + error.message); return }
    setModulos(prev => prev.map(x => x.id === m.id ? { ...x, disponible: nuevo } : x))

    if (notificar) {
      notificarModuloAbierto(m)
    }
  }

  const notificarModuloAbierto = async (m) => {
    try {
      setNotificando(m.id)

      // 1. Cargar TODAS las inscripciones y filtrar por título normalizado
      const { data: todas, error: errA } = await supabase
        .from('vista_admin_inscripciones')
        .select('email, nombre_completo, curso, usuario_id')
      if (errA) throw errA

      const tituloNorm = normalizarTexto(curso.titulo)
      const vistos = new Set()
      const alumnos = []
      for (const a of (todas || [])) {
        if (normalizarTexto(a.curso) !== tituloNorm) continue
        if (vistos.has(a.usuario_id)) continue
        vistos.add(a.usuario_id)
        alumnos.push({ email: a.email, nombre_completo: a.nombre_completo })
      }

      console.log('=== NOTIFICACIÓN MÓDULO ===')
      console.log('Curso:', curso.titulo)
      console.log('Título normalizado:', tituloNorm)
      console.log('Total filas en vista:', todas?.length)
      console.log('Cursos en vista:', [...new Set((todas || []).map(a => a.curso))])
      console.log('Alumnos filtrados:', alumnos.length)

      if (alumnos.length === 0) {
        setMsgNotificacion('No hay alumnos inscritos todavía')
        setNotificando(null)
        return
      }

      // 2. Llamar al Apps Script con no-cors (evita el bloqueo CORS de Google)
      const urlModulo = `${window.location.origin}/modulo/${m.id}`
      const payload = {
        tipo: 'modulo-abierto',
        curso: { titulo: curso.titulo, url: urlModulo },
        modulo: { titulo: m.titulo, descripcion: m.descripcion },
        alumnos
      }

      console.log('Enviando a Apps Script:', APPS_SCRIPT_URL)
      console.log('Payload:', JSON.stringify(payload).substring(0, 200) + '...')

      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      })

      console.log('Respuesta tipo:', res.type, 'status:', res.status)

      // Con no-cors, el status siempre es 0 y type es 'opaque'.
      // No podemos leer la respuesta, pero la petición SÍ llegó a Google.
      setMsgNotificacion(`✓ Enviado a Google Apps Script (${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'})`)
    } catch (e) {
      console.error('Error notificando:', e)
      setMsgNotificacion('Error: ' + e.message)
    } finally {
      setNotificando(null)
    }
  }

  const renderModulo = (m, i) => {
    const bloqueado = esModuloBloqueado(m)
    const bloqueadoPorRuta = bloqueado && user && m.grupo && miGrupo !== m.grupo && !esAdmin
    const bloqueadoPorDisponibilidad = bloqueado && m.disponible === false && !esAdmin
    const bloqueadoPorLogin = bloqueado && !user && !esAdmin

    const contenido = (
      <>
        <span className="modulo-num">{i + 1}</span>
        <div>
          <h3>
            {m.titulo}
            {bloqueadoPorLogin && <span className="etiqueta-grupo">🔒 Requiere acceso</span>}
            {bloqueadoPorRuta && <span className="etiqueta-grupo">🔒 Otra ruta</span>}
            {bloqueadoPorDisponibilidad && <span className="etiqueta-grupo">🔒 Próximamente</span>}
            {esAdmin && m.disponible === false && <span className="etiqueta-grupo">🔒 Bloqueado (solo admin)</span>}
            {esAdmin && m.grupo && <span className="etiqueta-grupo">{m.grupo}</span>}
          </h3>
          <p>{m.descripcion}</p>
        </div>
        <span className="modulo-flecha">{bloqueado ? '🔒' : '→'}</span>
      </>
    )

    if (bloqueado) {
      return <div key={m.id} className="modulo-card bloqueado">{contenido}</div>
    }

    if (!esAdmin) {
      return <Link key={m.id} to={`/modulo/${m.id}`} className="modulo-card">{contenido}</Link>
    }

    return (
      <div key={m.id} className="modulo-row">
        <Link to={`/modulo/${m.id}`} className="modulo-card">{contenido}</Link>
        <button
          type="button"
          className={`modulo-toggle ${m.disponible ? 'abierto' : 'cerrado'}`}
          onClick={() => toggleDisponible(m)}
          disabled={notificando === m.id}
          title={m.disponible ? 'Cerrar módulo (ocultar a alumnos)' : 'Abrir módulo (visible para alumnos)'}
        >
          {notificando === m.id ? '⏳' : (m.disponible ? '🔓' : '🔒')}
        </button>
      </div>
    )
  }

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo }]} />
      <div className="curso-encabezado">
        <h1>{curso.titulo}</h1>
        {especial && (
          <p className="curso-disponible">
            <span className="curso-disponible-label">Disponible a partir del</span>
            <span className="curso-disponible-fecha">{especial.disponibleDesde}</span>
          </p>
        )}
        <p className="curso-desc">{curso.descripcion}</p>
      </div>
      {curso.info_curso && (
        <div className="curso-info-extra">
          {curso.info_curso.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}

      {esAdmin && (
        <div className="admin-banner">
          <strong>Vista de administrador.</strong> Ves todas las rutas y módulos. Los módulos con <em>🔒 Bloqueado (solo admin)</em> no están abiertos todavía para alumnos.
        </div>
      )}

      {!user && (
        <div className="admin-banner" style={{ background: '#EEF2F4', borderLeftColor: '#1B3A4B', color: '#1B3A4B' }}>
          Estás viendo la estructura del curso. Para acceder a los materiales, <strong>inicia sesión</strong> con tus datos o escríbeme para inscribirte.
        </div>
      )}

      {user && !curso.gratuito && (
        <div className="progreso-container">
          <div className="progreso-label"><span>Tu avance</span><span>{progreso}%</span></div>
          <div className="progreso-bar"><div className="progreso-lleno" style={{ width: `${progreso}%` }} /></div>
        </div>
      )}

      <h2 className="titulo-seccion">Contenido del curso</h2>

      {grupos.length > 0 ? (
        grupos.map(g => {
          const modsRuta = modulos
            .filter(m => m.grupo === g)
            .sort((a, b) => (a.orden || 0) - (b.orden || 0))
          const tieneAcceso = tieneAccesoAlGrupo(g)
          const primerModulo = modsRuta.find(m => !esModuloBloqueado(m))

          return (
            <section key={g} className="ruta-section">
              <header className="ruta-section-header">
                <h2 className="titulo-seccion">{rutaLabel(g)}</h2>
                <p className="ruta-section-sub">{rutaDescripcion(g)}</p>
                {!tieneAcceso && (
                  <p className="ruta-section-lock">
                    {!user
                      ? '🔒 Esta ruta requiere inscripción. Inicia sesión si ya tienes acceso, o solicita información para inscribirte.'
                      : '🔒 Aún no tienes acceso a esta ruta. Puedes solicitar información o iniciar sesión con la cuenta correcta.'}
                  </p>
                )}
              </header>

              <div className="modulo-grid">
                {modsRuta.map((m, i) => renderModulo(m, i))}
                {modsRuta.length === 0 && <p className="sutil">Esta ruta aún no tiene módulos publicados.</p>}
              </div>

              <div className="ruta-cta">
                <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
                   href={wa(`Hola, me interesa la ${rutaLabel(g)} del curso "${curso.titulo}". ¿Me compartes información e inscripción?`)}>
                  💬 Solicitar información
                </a>
                <button className="button secondary ancho" onClick={() => {
                  if (esAdmin || tieneAcceso) {
                    if (primerModulo) navigate(`/modulo/${primerModulo.id}`)
                    else alert('Esta ruta aún no tiene módulos abiertos.')
                  } else if (!user) {
                    navigate(rutaAcceso(`/curso/${id}`))
                  } else {
                    alert('Tu cuenta aún no tiene acceso a esta ruta. Escríbeme por WhatsApp y lo vemos.')
                  }
                }}>
                  {esAdmin || tieneAcceso ? 'Ir al contenido →' : 'Ya estoy inscrito'}
                </button>
              </div>
            </section>
          )
        })
      ) : (
        <div className="modulo-grid">
          {modulos.map((m, i) => renderModulo(m, i))}
          {modulos.length === 0 && <p className="sutil">Este curso aún no tiene módulos publicados.</p>}
        </div>
      )}

      {modsSinGrupo.length > 0 && grupos.length > 0 && (
        <section className="ruta-section">
          <h2 className="titulo-seccion">Otros módulos</h2>
          <div className="modulo-grid">
            {modsSinGrupo.map((m, i) => renderModulo(m, i))}
          </div>
        </section>
      )}

      {confirmacion && (
        <div className="modal-overlay">
          <div className="modal-box modal-confirm">
            <h3>Confirmar</h3>
            <p>{confirmacion.mensaje}</p>
            <div className="modal-botones">
              <button
                type="button"
                className="button secondary"
                onClick={confirmacion.onCancel}
              >
                {confirmacion.botonCancelar || 'Cancelar'}
              </button>
              <button
                type="button"
                className="button primary"
                onClick={confirmacion.onConfirm}
              >
                {confirmacion.botonConfirmar || 'Sí, continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msgNotificacion && (
        <div className="notificacion-toast">
          {msgNotificacion}
          <button type="button" onClick={() => setMsgNotificacion('')}>×</button>
        </div>
      )}

      <BandaRedes />
    </section>
  )
}

/* ============================================================
   DETALLE DEL CURSO (página de rutas lado a lado)
   ============================================================ */
function CursoDetalle({ user, esAdmin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [miGrupo, setMiGrupo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
      setCurso(c)

      let grupo = null
      if (!esAdmin && user) {
        const { data: acc } = await supabase.from('acceso')
          .select('grupo').eq('usuario_id', user.id).eq('curso_id', id).maybeSingle()
        if (acc) grupo = acc.grupo || null
      }
      setMiGrupo(grupo)

      const { data: mods } = await supabase.from('modulos')
        .select('id, titulo, orden, grupo, disponible, activo')
        .eq('curso_id', id).eq('activo', true).order('orden')
      setModulos(mods || [])
      setLoading(false)
    }
    load()
  }, [id, user, esAdmin])

  if (loading) return <div className="loading">Cargando detalles...</div>
  if (!curso) return <div className="contenedor"><p className="aviso-error">Curso no encontrado.</p></div>

  const especial = cursoEspecial(curso)
  if (!especial || especial.detallesKey !== 'duelo') {
    return (
      <section className="contenedor">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo, to: `/curso/${id}` }, { label: 'Detalles' }]} />
        <h1>{curso.titulo}</h1>
        <p className="curso-desc">{curso.descripcion}</p>
        <button className="button secondary" onClick={() => navigate(`/curso/${id}`)}>← Volver al curso</button>
        <BandaRedes />
      </section>
    )
  }

  const { acompanamiento, clinica } = DETALLES_DUELO.rutas

  const tieneAccesoAlGrupo = (g) => {
    if (esAdmin) return true
    if (!user) return false
    if (!g) return true
    return miGrupo === g
  }

  const RutaCol = ({ ruta }) => {
    const tieneAcceso = tieneAccesoAlGrupo(ruta.grupo)
    const modsRuta = modulos
      .filter(m => m.grupo === ruta.grupo)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    const primerModulo = modsRuta.find(m => esAdmin || (m.disponible !== false && tieneAcceso))

    return (
      <article className="ruta-col">
        <header className="ruta-header">
          <h2>{ruta.nombre}</h2>
          <p className="ruta-dirigida">{ruta.dirigida}</p>
        </header>

        <div className="ruta-para-ti">
          <p className="ruta-para-ti-titulo">Esta ruta es para ti si…</p>
          <p>{ruta.paraTiSi}</p>
          <p className="ruta-publicos">{ruta.publicos}</p>
          <p className="ruta-nota">{ruta.notaFinal}</p>
        </div>

        <h3 className="ruta-subtitulo">Los cuatro módulos</h3>
        <ol className="ruta-modulos">
          {ruta.modulos.map(m => (
            <li key={m.num}>
              <div className="ruta-mod-num">Módulo {m.num}</div>
              <h4>{m.titulo}</h4>
              <p>{m.descripcion}</p>
            </li>
          ))}
        </ol>

        <div className="ruta-info">
          <h4>Metodología</h4>
          <p>{ruta.metodologia}</p>
          <h4>Materiales</h4>
          <p>{ruta.materiales}</p>
        </div>

        {!tieneAcceso && (
          <p className="ruta-section-lock" style={{ marginTop: 18 }}>
            {!user
              ? '🔒 Esta ruta requiere inscripción. Solicita información o inicia sesión si ya tienes acceso.'
              : '🔒 Aún no tienes acceso a esta ruta. Solicita información o usa la cuenta correcta.'}
          </p>
        )}

        <div className="ruta-cta">
          <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
             href={wa(`Hola, me interesa la ${ruta.nombre} del curso "${curso.titulo}". ¿Me compartes información e inscripción?`)}>
            💬 Solicitar información
          </a>
          <button className="button secondary ancho" onClick={() => {
            if (esAdmin || tieneAcceso) {
              if (primerModulo) navigate(`/modulo/${primerModulo.id}`)
              else navigate(`/curso/${id}`)
            } else if (!user) {
              navigate(rutaAcceso(`/curso/${id}/detalles`))
            } else {
              alert('Tu cuenta aún no tiene acceso a esta ruta. Escríbeme por WhatsApp y lo vemos.')
            }
          }}>
            {esAdmin || tieneAcceso ? 'Ir al contenido →' : 'Ya estoy inscrito'}
          </button>
        </div>
      </article>
    )
  }

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo, to: `/curso/${id}` }, { label: 'Detalles' }]} />

      <header className="detalle-header">
        <h1>{DETALLES_DUELO.intro}</h1>
        <p className="detalle-sub">{DETALLES_DUELO.subtitulo}</p>
        <p className="curso-disponible">
          <span className="curso-disponible-label">Disponible a partir del</span>
          <span className="curso-disponible-fecha">{especial.disponibleDesde}</span>
        </p>
      </header>

      {!user && (
        <div className="admin-banner" style={{ background: '#EEF2F4', borderLeftColor: '#1B3A4B', color: '#1B3A4B', marginBottom: 28 }}>
          Estás viendo los detalles de las dos rutas. Para acceder a los materiales, <strong>inicia sesión</strong> con tus datos o escríbeme para inscribirte en la ruta que te corresponde.
        </div>
      )}

      <div className="rutas-grid">
        <RutaCol ruta={acompanamiento} />
        <RutaCol ruta={clinica} />
      </div>

      <div className="detalle-cta">
        <a className="button whatsapp grande" target="_blank" rel="noopener noreferrer"
           href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me compartes más información?`)}>
          Quiero información e inscripción
        </a>
        <button className="button secondary" onClick={() => navigate(`/curso/${id}`)}>← Volver al curso</button>
      </div>

      <BandaRedes />
    </section>
  )
}

/* ============================================================
   MÓDULO
   ============================================================ */
function ModuloView({ user, esAdmin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [modulo, setModulo] = useState(null)
  const [curso, setCurso] = useState(null)
  const [recursos, setRecursos] = useState([])
  const [modulosCurso, setModulosCurso] = useState([])
  const [progresoRecursos, setProgresoRecursos] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: m, error: eM } = await supabase.from('modulos').select('*').eq('id', id).maybeSingle()
        if (eM) throw eM
        if (!m) { setError('Este módulo no existe o no tienes acceso a él.'); return }

        let miGrupo = null
        if (user) {
          const { data: accG } = await supabase.from('acceso')
            .select('grupo').eq('usuario_id', user.id).eq('curso_id', m.curso_id).maybeSingle()
          miGrupo = accG?.grupo || null
        }

        if (!moduloVisible(m, { user, esAdmin, miGrupo })) {
          setError('Este módulo es privado. Inicia sesión con tu cuenta autorizada para verlo.')
          return
        }

        if (!esAdmin && m.disponible === false) {
          setError('Este módulo todavía no está abierto. Te avisaré por WhatsApp cuando esté disponible.')
          return
        }

        setModulo(m)
        const { data: c } = await supabase.from('cursos').select('id, titulo, gratuito, constancia').eq('id', m.curso_id).maybeSingle()
        setCurso(c)
        const { data: rs, error: eR } = await supabase.from('recursos').select('*').eq('modulo_id', id).order('orden')
        if (eR) throw eR
        setRecursos(rs || [])

        const { data: mods } = await supabase.from('modulos').select('id, titulo, orden, grupo, oculto, disponible')
          .eq('curso_id', m.curso_id).eq('activo', true).order('orden')
        const modsSidebar = (mods || [])
          .filter(x => moduloVisible(x, { user, esAdmin, miGrupo }))
          .filter(x => esAdmin || x.disponible !== false)
        setModulosCurso(modsSidebar)

        if (user && rs?.length) {
          const { data: pr } = await supabase.from('progreso_usuario').select('recurso_id, completado')
            .eq('usuario_id', user.id).in('recurso_id', rs.map(r => r.id))
          const map = {}; pr?.forEach(p => { map[p.recurso_id] = p.completado })
          setProgresoRecursos(map)
        }
      } catch (e) {
        console.error('Error en ModuloView:', e); setError(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [id, user, esAdmin])

  const bucket = curso?.gratuito ? BUCKET_TALLERES : BUCKET_PAGO

  const marcarVisto = async (recursoId) => {
    if (!user) return
    const { error } = await supabase.from('progreso_usuario').upsert(
      { usuario_id: user.id, recurso_id: recursoId, completado: true, ultimo_acceso: new Date().toISOString() },
      { onConflict: 'usuario_id, recurso_id' })
    if (!error) setProgresoRecursos(prev => ({ ...prev, [recursoId]: true }))
  }

  const irA = (rid) => {
    const el = document.getElementById(`r-${rid}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return <div className="loading">Cargando módulo...</div>
  if (error) return (
    <div className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Módulo' }]} />
      <p className="aviso-error">{error}</p>
      <div className="bloque-botones" style={{ justifyContent: 'flex-start' }}>
        {!user && <button className="button primary" onClick={() => navigate(rutaAcceso(`/modulo/${id}`))}>Iniciar sesión</button>}
        <button className="button secondary" onClick={() => navigate('/')}>Volver al inicio</button>
      </div>
      <BandaRedes />
    </div>
  )
  if (!modulo) return <div className="contenedor"><p className="aviso-error">Módulo no encontrado.</p></div>

  const idx = modulosCurso.findIndex(m => m.id === parseInt(id))
  const prev = idx > 0 ? modulosCurso[idx - 1] : null
  const next = idx >= 0 && idx < modulosCurso.length - 1 ? modulosCurso[idx + 1] : null
  const vistos = recursos.filter(r => progresoRecursos[r.id]).length
  const bloqueadoParaAlumno = moduloBloqueadoParaAlumno(modulo)
  const mostrarConstancia = emiteConstancia(curso)
  const mostrarDiapositivas = modulo.grupo === 'Acompañamiento' || modulo.grupo === 'Clínica'
  const mostrarEntregables = curso && esCursoProblemasContemporaneos(curso)

  return (
    <div className="contenedor">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/' },
        { label: curso?.titulo || 'Curso', to: curso ? `/curso/${curso.id}` : '/' },
        { label: modulo.titulo }
      ]} />

      {esAdmin && bloqueadoParaAlumno && (
        <div className="admin-banner">
          <strong>Vista de administrador.</strong> Este módulo aún no está visible para alumnos (disponible = false).
          Para abrirlo: <code>update modulos set disponible = true where id = {modulo.id};</code>
        </div>
      )}

      <div className="modulo-layout">
        <aside className="modulo-sidebar">
          <div className="side-bloque">
            <h4>Módulos del curso</h4>
            <ul className="side-lista">
              {modulosCurso.map((m, i) => (
                <li key={m.id}>
                  <Link to={`/modulo/${m.id}`} className={m.id === parseInt(id) ? 'activo' : ''}>
                    <span className="side-num">{i + 1}</span>{m.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {recursos.length > 0 && (
            <div className="side-bloque">
              <h4>En este módulo</h4>
              <ul className="side-lista compacta">
                {recursos.map((r) => (
                  <li key={r.id}>
                    <button className="side-btn" onClick={() => irA(r.id)}>
                      <span aria-hidden="true">{ICONO_TIPO[r.tipo] || '📌'}</span>
                      <span className="side-txt">{r.titulo}</span>
                      {progresoRecursos[r.id] && <span className="side-check">✔</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="side-bloque contacto-bloque">
            <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="contacto-foto" />
            <h4 className="contacto-titulo">¿Dudas con el material?</h4>
            <p className="contacto-nombre">Dr. Ernesto Cotonieto</p>
            <p className="contacto-credencial">Cédula profesional 10521804</p>
            <a className="button whatsapp ancho" href={wa('Hola, tengo una duda sobre el material del aula.')}
               target="_blank" rel="noopener noreferrer">💬 Escríbeme</a>
            <a className="button secondary ancho" href={`mailto:${CONTACTO_EMAIL}`}>✉️ Por correo</a>
          </div>
          <div className="side-bloque atajos">
            <h4>Atajos</h4>
            <Link to="/" className="side-atajo">🏠 Inicio</Link>
            {curso && <Link to={`/curso/${curso.id}`} className="side-atajo">📚 Todo el curso</Link>}
            {user && <Link to="/perfil" className="side-atajo">👤 Mi perfil</Link>}
          </div>
        </aside>

        <main className="modulo-main">
          <header className="modulo-encabezado">
            <h1>
              {modulo.titulo}
              {bloqueadoParaAlumno && esAdmin && <span className="etiqueta-grupo">🔒 Bloqueado (solo admin)</span>}
              {!bloqueadoParaAlumno && modulo.oculto && <span className="etiqueta-grupo">🔒 Privado</span>}
              {modulo.grupo && <span className="etiqueta-grupo">Grupo {modulo.grupo}</span>}
            </h1>
            {modulo.descripcion && <p className="curso-desc">{modulo.descripcion}</p>}
            {user && recursos.length > 0 && (
              <p className="modulo-avance">{vistos} de {recursos.length} recursos revisados</p>
            )}
          </header>

          {mostrarDiapositivas && <DiapositivasPresentarCaso />}
          {mostrarEntregables && <Entregables />}

          <div className="recursos-list">
            {recursos.map((r) => (
              <RecursoCard key={r.id} recurso={r} bucket={bucket} user={user}
                           visto={!!progresoRecursos[r.id]} onMarcarVisto={marcarVisto} />
            ))}
            {recursos.length === 0 && <p className="sutil">Este módulo aún no tiene recursos.</p>}
          </div>
          <ExamenModulo moduloId={modulo.id} user={user} />
          <nav className="navegacion-modulos">
            {prev
              ? <button className="button secondary" onClick={() => navigate(`/modulo/${prev.id}`)}>← {prev.titulo}</button>
              : <span />}
            {next && <button className="button primary" onClick={() => navigate(`/modulo/${next.id}`)}>{next.titulo} →</button>}
            {!next && user && mostrarConstancia &&
              <Link to={`/constancia/${curso.id}`} className="button constancia-btn">Obtener constancia</Link>}
          </nav>
        </main>
      </div>

      <NavegacionFlotante
        prev={prev}
        next={next}
        curso={curso}
        mostrarConstancia={mostrarConstancia}
      />

      <BandaRedes />
    </div>
  )
}

/* ============================================================
   CONSTANCIA
   ============================================================ */
function Constancia({ user }) {
  const { cursoId } = useParams()
  const [perfil, setPerfil] = useState({ nombre: '', profesion: '' })
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [curso, setCurso] = useState(null)
  const [puede, setPuede] = useState(false)
  const [noEmite, setNoEmite] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate(rutaAcceso(`/constancia/${cursoId}`)); return }
    async function load() {
      const { data: p } = await supabase.from('perfiles').select('nombre_completo, profesion').eq('id', user.id).maybeSingle()
      if (p) setPerfil({ nombre: p.nombre_completo || '', profesion: p.profesion || '' })
      const { data: c } = await supabase.from('cursos')
        .select('titulo, constancia, gratuito').eq('id', cursoId).maybeSingle()
      setCurso(c)
      if (!c || !emiteConstancia(c)) {
        setNoEmite(true)
        setCargando(false)
        return
      }
      const { data: mods } = await supabase.from('modulos').select('id, disponible').eq('curso_id', cursoId)
      const modsActivos = (mods || []).filter(m => m.disponible !== false)
      if (modsActivos.length) {
        const { data: rs } = await supabase.from('recursos').select('id').in('modulo_id', modsActivos.map(m => m.id))
        if (rs?.length) {
          const { data: comp } = await supabase.from('progreso_usuario').select('recurso_id')
            .eq('usuario_id', user.id).in('recurso_id', rs.map(r => r.id)).eq('completado', true)
          setPuede((comp?.length || 0) === rs.length)
        }
      }
      setCargando(false)
    }
    load()
  }, [cursoId, user, navigate])

  const guardar = async () => {
    const { error } = await supabase.from('perfiles').upsert(
      { id: user.id, nombre_completo: perfil.nombre, profesion: perfil.profesion }, { onConflict: 'id' })
    alert(error ? 'Error: ' + error.message : 'Datos guardados.')
  }

  const generar = async () => {
    if (!perfil.nombre || !perfil.profesion) return alert('Completa tu nombre y profesión.')
    setGenerando(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = 297, H = 210
      doc.setFillColor(250, 250, 248); doc.rect(0, 0, W, H, 'F')
      doc.setDrawColor(193, 122, 94); doc.setLineWidth(1.5); doc.rect(10, 10, W - 20, H - 20)
      doc.setDrawColor(27, 58, 75); doc.setLineWidth(0.3); doc.rect(13, 13, W - 26, H - 26)
      doc.setTextColor(27, 58, 75); doc.setFont('times', 'normal'); doc.setFontSize(13)
      doc.text('DR. ERNESTO COTONIETO', W / 2, 32, { align: 'center' })
      doc.setFontSize(28); doc.setFont('times', 'bold')
      doc.text('CONSTANCIA', W / 2, 52, { align: 'center' })
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(122, 136, 145)
      doc.text('Se otorga la presente a', W / 2, 68, { align: 'center' })
      doc.setFontSize(24); doc.setFont('times', 'bold'); doc.setTextColor(27, 58, 75)
      doc.text(perfil.nombre.toUpperCase(), W / 2, 84, { align: 'center' })
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(122, 136, 145)
      doc.text(perfil.profesion, W / 2, 93, { align: 'center' })
      doc.text('por haber concluido satisfactoriamente', W / 2, 108, { align: 'center' })
      doc.setFontSize(15); doc.setFont('times', 'bold'); doc.setTextColor(193, 122, 94)
      doc.text(doc.splitTextToSize(curso?.titulo || '', W - 80), W / 2, 120, { align: 'center' })
      const folio = `${(curso?.titulo || 'C').substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${user.id.substring(0, 6).toUpperCase()}`
      doc.setDrawColor(27, 58, 75); doc.setLineWidth(0.4); doc.line(W / 2 - 45, 165, W / 2 + 45, 165)
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(27, 58, 75)
      doc.text('Dr. Ernesto Cotonieto Martínez', W / 2, 172, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(122, 136, 145)
      doc.text('Cédula profesional 10521804', W / 2, 178, { align: 'center' })
      doc.setFontSize(8)
      doc.text(`Folio: ${folio}`, 22, H - 20)
      doc.text(new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }), W - 22, H - 20, { align: 'right' })
      doc.save(`constancia-${folio}.pdf`)
    } catch (e) { alert('Error: ' + e.message) }
    setGenerando(false)
  }

  if (!user) return null
  if (cargando) return <div className="loading">Cargando...</div>

  if (noEmite) {
    return (
      <section className="contenedor estrecho">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Constancia' }]} />
        <h1>Constancia no disponible</h1>
        <p className="sutil">Este curso no emite constancia de participación.</p>
        <div className="bloque-cerrado">
          <p className="bloque-icono">ℹ️</p>
          <p>Si necesitas un comprobante de tu participación, escríbeme por WhatsApp y lo vemos.</p>
          <div className="bloque-botones">
            <a className="button whatsapp" target="_blank" rel="noopener noreferrer"
               href={wa(`Hola, quiero un comprobante del curso "${curso?.titulo || ''}".`)}>
              Escríbeme por WhatsApp
            </a>
            <button className="button secondary" onClick={() => navigate(`/curso/${cursoId}`)}>Volver al curso</button>
          </div>
        </div>
        <BandaRedes />
      </section>
    )
  }

  return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Constancia' }]} />
      <h1>Constancia de participación</h1>
      <p className="sutil">Verifica tus datos: así aparecerán impresos en el documento.</p>
      <div className="formulario-datos">
        <label>Nombre completo</label>
        <input type="text" value={perfil.nombre} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} />
        <label>Profesión o especialidad</label>
        <input type="text" value={perfil.profesion} onChange={(e) => setPerfil({ ...perfil, profesion: e.target.value })} />
        <button className="button secondary" onClick={guardar}>Guardar datos</button>
      </div>
      <div className="bloque-cerrado">
        {puede
          ? <>
              <p className="aviso-ok">✔ Completaste todo el curso.</p>
              <button className="button primary" onClick={generar} disabled={generando}>
                {generando ? 'Generando...' : 'Descargar constancia'}
              </button>
            </>
          : <p className="sutil">Aún no marcas todos los recursos como vistos. Al completarlos podrás descargar tu constancia.</p>}
      </div>
      <button className="button secondary" onClick={() => navigate(`/curso/${cursoId}`)}>Volver al curso</button>
      <BandaRedes />
    </section>
  )
}

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
          <Route path="/" element={<Home user={user} />} />
          <Route path="/acceso" element={<Login message={message} />} />
          <Route path="/perfil" element={<Perfil user={user} />} />
          <Route path="/admin" element={<Admin user={user} esAdmin={esAdmin} />} />
          <Route path="/curso/:id" element={<CursoView user={user} esAdmin={esAdmin} />} />
          <Route path="/curso/:id/detalles" element={<CursoDetalle user={user} esAdmin={esAdmin} />} />
          <Route path="/modulo/:id" element={<ModuloView user={user} esAdmin={esAdmin} />} />
          <Route path="/constancia/:cursoId" element={<Constancia user={user} />} />
        </Routes>
      </main>
      <WhatsAppFlotante />
    </>
  )
}

export default function Root() {
  return <BrowserRouter><App /></BrowserRouter>
}
