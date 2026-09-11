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

const FOTO_PERFIL = '/foto-perfil.jpg'
const LOGO_CLARO = '/logo_claro_1024.png'
const LOGO_BLANCO = '/logo_blanco_1024.png'

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
  'Talleres gratuitos': { texto: 'Formación breve y de acceso libre para empezar a formarte hoy mismo.', motivo: 'arcos' }
}

const ICONO_TIPO = { pdf: '📄', video: '🎬', word: '📝', enlace: '🔗', autoevaluacion: '✍️' }
const NOMBRE_TIPO = { pdf: 'Documento', video: 'Video', word: 'Descargable', enlace: 'Enlace', autoevaluacion: 'Autoevaluación' }

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

// ¿El módulo está bloqueado para alumnos (no disponible todavía)?
function moduloBloqueadoParaAlumno(m) {
  return m && m.disponible === false
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
      <div className={`carrusel-track${arrastrando ? ' arrastrando' : ''}`}
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

const rutaAcceso = (destino) => `/acceso?redirigir=${encodeURIComponent(destino)}`

/* ============================================================
   HEADER
   ============================================================ */
function Header({ user, esAdmin, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const ir = (ruta) => { navigate(ruta); setMenuAbierto(false) }
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-area" onClick={() => navigate('/')} role="button" tabIndex={0}
             onKeyDown={(e) => e.key === 'Enter' && navigate('/')}>
          <img src={LOGO_BLANCO} alt="" className="logo" />
          <span className="brand-name">Dr. Ernesto Cotonieto</span>
        </div>
        <button className="menu-toggle" onClick={() => setMenuAbierto(v => !v)} aria-label="Menú">☰</button>
        <nav className={`header-actions ${menuAbierto ? 'abierto' : ''}`}>
          {location.pathname !== '/' && <button className="nav-link" onClick={() => ir('/')}>Inicio</button>}
          {user && <button className="nav-link" onClick={() => ir('/perfil')}>Mi perfil</button>}
          {esAdmin && <button className="nav-link destacado" onClick={() => ir('/admin')}>Panel</button>}
          {user ? (
            <>
              <span className="user-email" title={user.email}>{user.email}</span>
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
  const navigate = useNavigate()
  const gratis = !!curso.gratuito
  const prox = !!curso.proximamente
  const esContenedor = esContenedorTalleres(curso)

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

        <div className="course-acciones">
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
          <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="mini-foto"
               onError={(e) => { e.currentTarget.src = LOGO_CLARO; e.currentTarget.classList.add('es-logo') }} />
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

      <footer className="pie-pagina">
        <p><strong>{MARCA.nombre}</strong> · {MARCA.credencial}</p>
        <p className="pie-legal">
          El contenido de este sitio es informativo y formativo, y no sustituye la atención clínica
          individual. Si estás en una situación de urgencia, comunícate al <strong>911</strong> o a la
          Línea de la Vida <strong>800 911 2000</strong> (24 h, México).
        </p>
      </footer>
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
    </section>
  )
}

/* ============================================================
   PANEL ADMIN
   ============================================================ */
function Admin({ user, esAdmin }) {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [error, setError] = useState(null)
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

  if (!user) return null
  if (!esAdmin) return <div className="contenedor"><p className="aviso-error">No tienes permisos para ver esta sección.</p></div>
  if (cargando) return <div className="loading">Cargando panel...</div>
  if (error) return <div className="contenedor"><p className="aviso-error">Error: {error}</p></div>

  const cursos = [...new Set(filas.map(f => f.curso))]
  const visibles = filtro === 'todos' ? filas : filas.filter(f => f.curso === filtro)
  const alumnosUnicos = new Set(filas.map(f => f.usuario_id)).size
  const fecha = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Panel de administración' }]} />
      <h1>Panel de administración</h1>
      <div className="kpi-fila">
        <div className="kpi"><span className="kpi-num">{alumnosUnicos}</span><span className="kpi-lbl">Alumnos</span></div>
        <div className="kpi"><span className="kpi-num">{filas.length}</span><span className="kpi-lbl">Inscripciones</span></div>
        <div className="kpi"><span className="kpi-num">{cursos.length}</span><span className="kpi-lbl">Cursos con alumnos</span></div>
      </div>
      <div className="filtros">
        <button className={`filtro ${filtro === 'todos' ? 'activo' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
        {cursos.map(c => (
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
   CURSO
   ============================================================ */
function CursoView({ user, esAdmin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [talleres, setTalleres] = useState([])
  const [progreso, setProgreso] = useState(0)
  const [estado, setEstado] = useState('cargando')
  const [error, setError] = useState(null)

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

        let miGrupo = null
        if (!esAdmin && !c.gratuito) {
          if (!user) { setEstado('requiere_login'); return }
          const { data: acc } = await supabase.from('acceso')
            .select('id, grupo').eq('usuario_id', user.id).eq('curso_id', id).maybeSingle()
          if (!acc) { setEstado('sin_acceso'); return }
          miGrupo = acc.grupo || null
        }

        const { data: mods, error: eM } = await supabase.from('modulos')
          .select('*').eq('curso_id', id).eq('activo', true).order('orden')
        if (eM) throw eM

        const modsVisibles = (mods || []).filter(m => moduloVisible(m, { user, esAdmin, miGrupo }))
        setModulos(modsVisibles)

        if (user && modsVisibles.length) {
          // El progreso solo cuenta módulos disponibles para el alumno.
          // Para admin se cuentan todos, así ve su propio 100%.
          const modsParaConteo = modsVisibles.filter(m => esAdmin || m.disponible !== false)
          const ids = []
          for (const m of modsParaConteo) {
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
      </section>
    )
  }

  if (estado === 'proximo' || estado === 'requiere_login' || estado === 'sin_acceso') {
    const prox = estado === 'proximo'
    return (
      <section className="contenedor estrecho">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo }]} />
        <h1>{curso.titulo}</h1>
        <p>{curso.descripcion}</p>
        <div className="bloque-cerrado">
          <p className="bloque-icono">{prox ? '🗓️' : '🔒'}</p>
          <p>{prox
            ? 'Este curso está en preparación. Déjame tu interés por WhatsApp y te aviso en cuanto abra su inscripción.'
            : estado === 'requiere_login'
              ? 'Este curso es para personas inscritas. Si ya tienes tus datos de acceso, inicia sesión y te traigo de vuelta aquí.'
              : 'Tu cuenta aún no tiene acceso a este curso.'}</p>
          <div className="bloque-botones">
            {estado === 'requiere_login' &&
              <button className="button primary" onClick={() => navigate(rutaAcceso(`/curso/${id}`))}>Iniciar sesión</button>}
            <a className="button whatsapp" target="_blank" rel="noopener noreferrer"
               href={wa(prox
                 ? `Hola, me interesa el curso "${curso.titulo}". ¿Me avisas cuándo abre?`
                 : `Hola, me interesa inscribirme al curso "${curso.titulo}".`)}>
              {prox ? 'Me interesa · avísame' : 'Quiero inscribirme'}
            </a>
            <button className="button secondary" onClick={() => navigate('/')}>Volver al inicio</button>
          </div>
        </div>
      </section>
    )
  }

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

      {esAdmin && (
        <div className="admin-banner">
          <strong>Vista de administrador.</strong> Los módulos marcados como <em>🔒 Bloqueado (solo admin)</em> aún no son visibles para alumnos.
        </div>
      )}

      {user && !curso.gratuito && (
        <div className="progreso-container">
          <div className="progreso-label"><span>Tu avance</span><span>{progreso}%</span></div>
          <div className="progreso-bar"><div className="progreso-lleno" style={{ width: `${progreso}%` }} /></div>
        </div>
      )}

      <h2 className="titulo-seccion">Contenido del curso</h2>
      <div className="modulo-grid">
        {modulos.map((m, i) => {
          const bloqueadoParaAlumno = moduloBloqueadoParaAlumno(m)
          const bloqueadoEnUI = bloqueadoParaAlumno && !esAdmin

          const contenido = (
            <>
              <span className="modulo-num">{i + 1}</span>
              <div>
                <h3>
                  {m.titulo}
                  {bloqueadoEnUI && <span className="etiqueta-grupo">🔒 Próximamente</span>}
                  {bloqueadoParaAlumno && esAdmin && <span className="etiqueta-grupo">🔒 Bloqueado (solo admin)</span>}
                  {!bloqueadoParaAlumno && m.oculto && <span className="etiqueta-grupo">🔒 Privado</span>}
                  {m.grupo && <span className="etiqueta-grupo">Grupo {m.grupo}</span>}
                </h3>
                <p>{m.descripcion}</p>
              </div>
              <span className="modulo-flecha">{bloqueadoEnUI ? '🔒' : '→'}</span>
            </>
          )

          return bloqueadoEnUI
            ? <div key={m.id} className="modulo-card bloqueado">{contenido}</div>
            : <Link key={m.id} to={`/modulo/${m.id}`} className="modulo-card">{contenido}</Link>
        })}
        {modulos.length === 0 && <p className="sutil">Este curso aún no tiene módulos publicados.</p>}
      </div>
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
        const { data: c } = await supabase.from('cursos').select('id, titulo, gratuito').eq('id', m.curso_id).maybeSingle()
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
    </div>
  )
  if (!modulo) return <div className="contenedor"><p className="aviso-error">Módulo no encontrado.</p></div>

  const idx = modulosCurso.findIndex(m => m.id === parseInt(id))
  const prev = idx > 0 ? modulosCurso[idx - 1] : null
  const next = idx >= 0 && idx < modulosCurso.length - 1 ? modulosCurso[idx + 1] : null
  const vistos = recursos.filter(r => progresoRecursos[r.id]).length
  const bloqueadoParaAlumno = moduloBloqueadoParaAlumno(modulo)

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
          <div className="side-bloque atajos">
            <h4>Atajos</h4>
            <Link to="/" className="side-atajo">🏠 Inicio</Link>
            {curso && <Link to={`/curso/${curso.id}`} className="side-atajo">📚 Todo el curso</Link>}
            {user && <Link to="/perfil" className="side-atajo">👤 Mi perfil</Link>}
            <a className="side-atajo" href={wa('Hola, tengo una duda sobre el material del aula.')}
               target="_blank" rel="noopener noreferrer">💬 Dudas</a>
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
          <div className="recursos-list">
            {recursos.map((r) => (
              <RecursoCard key={r.id} recurso={r} bucket={bucket} user={user}
                           visto={!!progresoRecursos[r.id]} onMarcarVisto={marcarVisto} />
            ))}
            {recursos.length === 0 && <p className="sutil">Este módulo aún no tiene recursos.</p>}
          </div>
          <nav className="navegacion-modulos">
            {prev
              ? <button className="button secondary" onClick={() => navigate(`/modulo/${prev.id}`)}>← {prev.titulo}</button>
              : <span />}
            {next && <button className="button primary" onClick={() => navigate(`/modulo/${next.id}`)}>{next.titulo} →</button>}
            {!next && user && curso && !curso.gratuito &&
              <Link to={`/constancia/${curso.id}`} className="button constancia-btn">Obtener constancia</Link>}
          </nav>
        </main>
      </div>
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
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate(rutaAcceso(`/constancia/${cursoId}`)); return }
    async function load() {
      const { data: p } = await supabase.from('perfiles').select('nombre_completo, profesion').eq('id', user.id).maybeSingle()
      if (p) setPerfil({ nombre: p.nombre_completo || '', profesion: p.profesion || '' })
      const { data: c } = await supabase.from('cursos').select('titulo').eq('id', cursoId).maybeSingle()
      setCurso(c)
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
      if (!s) { localStorage.removeItem('login_time'); setEsAdmin(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user || null

  useEffect(() => {
    if (!user) { setEsAdmin(false); return }
    supabase.from('admins').select('email').eq('email', user.email).maybeSingle()
      .then(({ data }) => setEsAdmin(!!data))
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut(); localStorage.removeItem('login_time')
    setSession(null); navigate('/')
  }

  if (loading) return <div className="loading pantalla">Cargando...</div>

  return (
    <>
      <Header user={user} esAdmin={esAdmin} onLogout={handleLogout} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/acceso" element={<Login message={message} />} />
          <Route path="/perfil" element={<Perfil user={user} />} />
          <Route path="/admin" element={<Admin user={user} esAdmin={esAdmin} />} />
          <Route path="/curso/:id" element={<CursoView user={user} esAdmin={esAdmin} />} />
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
