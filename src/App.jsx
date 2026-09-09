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
   CONFIGURACIÓN — edita aquí tus datos, no hace falta tocar más
   ============================================================ */
const BUCKET_PAGO = 'curso_duelo'       // materiales de cursos de paga
const BUCKET_TALLERES = 'talleres'      // materiales gratuitos (bucket público)
const AVATAR_BUCKET = 'avatares'

const CONTACTO_EMAIL = 'cotonietoe@gmail.com'
const WHATSAPP = '5215637841931'
const wa = (t) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t)}`
const WA_CONSULTA = wa('Hola, vi tu página y me gustaría agendar una llamada de encuadre.')

// Imágenes: colócalas en la carpeta public/ de tu repo
const FOTO_PERFIL = '/foto-perfil.jpg'   // tu foto profesional
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

const ICONO_TIPO = { pdf: '📄', video: '🎬', word: '📝', enlace: '🔗', autoevaluacion: '✍️' }
const NOMBRE_TIPO = { pdf: 'Documento', video: 'Video', word: 'Descargable', enlace: 'Enlace', autoevaluacion: 'Autoevaluación' }

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
    <a className="wa-flotante" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer"
       aria-label="Escríbeme por WhatsApp">
      <span className="wa-icono">💬</span><span className="wa-texto">WhatsApp</span>
    </a>
  )
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ user, esAdmin, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
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
          {location.pathname !== '/' && <button className="nav-link" onClick={() => { navigate('/'); setMenuAbierto(false) }}>Inicio</button>}
          {user && <button className="nav-link" onClick={() => { navigate('/perfil'); setMenuAbierto(false) }}>Mi perfil</button>}
          {esAdmin && <button className="nav-link destacado" onClick={() => { navigate('/admin'); setMenuAbierto(false) }}>Panel</button>}
          {user ? (
            <>
              <span className="user-email" title={user.email}>{user.email}</span>
              <button className="button secundario-claro" onClick={onLogout}>Salir</button>
            </>
          ) : (
            <button className="button secundario-claro" onClick={() => { navigate('/acceso'); setMenuAbierto(false) }}>Iniciar sesión</button>
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError('Correo o contraseña incorrectos. Revisa que no haya espacios de más.'); setLoading(false) }
    else { localStorage.setItem('login_time', String(Date.now())); navigate('/') }
  }

  return (
    <main className="portal centered">
      <section className="card login-card">
        <img src={LOGO_CLARO} alt="" className="logo-login" />
        <p className="eyebrow">Aula virtual</p>
        <h1>Iniciar sesión</h1>
        <p className="sutil">Ingresa con el usuario y contraseña que te compartí. Los talleres gratuitos no requieren cuenta.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
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
   HOME (pública)
   ============================================================ */
function Home({ user }) {
  const [cursos, setCursos] = useState([])
  const [accesos, setAccesos] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('cursos').select('*').eq('activo', true).order('orden')
      setCursos(data || [])
      if (user) {
        const { data: acc } = await supabase.from('acceso').select('curso_id').eq('usuario_id', user.id)
        setAccesos(new Set((acc || []).map(a => a.curso_id)))
      }
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-foto-zona">
          <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="hero-foto"
               onError={(e) => { e.currentTarget.src = LOGO_CLARO; e.currentTarget.classList.add('es-logo') }} />
        </div>
        <h1>{MARCA.nombre}</h1>
        <p className="hero-credencial">{MARCA.credencial}</p>
        <p className="hero-slogan">“{MARCA.slogan}”</p>
        <p className="hero-sub">{MARCA.subtitulo}</p>
        <p className="hero-bio">{MARCA.bio}</p>
        <div className="hero-cta">
          <a className="button whatsapp grande" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer">
            Agenda tu llamada sin costo
          </a>
          <a className="button secondary grande" href="#cursos">Ver cursos</a>
        </div>
        <div className="redes">
          {REDES.map((r) => (
            <a key={r.nombre} className="red-btn" href={r.url} target="_blank" rel="noopener noreferrer" title={r.nombre}>
              <span aria-hidden="true">{r.icono}</span><span>{r.corto}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="seccion" id="cursos">
        <h2>Cursos y talleres</h2>
        <p className="seccion-intro">
          Formación clínica aplicada. Los talleres gratuitos son de acceso libre;
          los cursos requieren inscripción.
        </p>
        {loading ? <div className="loading">Cargando cursos...</div> : (
          <div className="course-grid">
            {cursos.map((curso) => {
              const gratis = curso.gratuito
              const tiene = accesos.has(curso.id)
              return (
                <article key={curso.id} className={`course-card ${gratis ? 'gratis' : ''}`}>
                  {curso.imagen_portada
                    ? <img src={curso.imagen_portada} alt="" className="course-image" />
                    : <div className={`course-image placeholder ${gratis ? 'verde' : ''}`}>{gratis ? '🎁' : '📚'}</div>}
                  <div className="course-info">
                    {gratis ? <span className="badge verde">Acceso libre</span>
                      : tiene ? <span className="badge ok">✔ Inscrito</span>
                        : <span className="badge neutro">Requiere inscripción</span>}
                    <h3>{curso.titulo}</h3>
                    <p>{curso.descripcion}</p>
                    <div className="course-acciones">
                      {gratis || tiene ? (
                        <Link to={`/curso/${curso.id}`} className="button primary ancho">
                          {gratis ? 'Entrar libremente' : 'Continuar curso'}
                        </Link>
                      ) : (
                        <>
                          <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
                             href={wa(`Hola, me interesa inscribirme al curso "${curso.titulo}". ¿Me compartes el costo y cómo apartar mi lugar?`)}>
                            Quiero inscribirme
                          </a>
                          {!user && (
                            <button className="button secondary ancho" onClick={() => navigate('/acceso')}>
                              Ya tengo acceso
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="seccion">
        <h2>Servicios</h2>
        <div className="servicios-grid">
          {SERVICIOS.map((s, i) => (
            <div key={i} className="servicio-card">
              <h3>{s.titulo}</h3>
              <p>{s.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="seccion">
        <h2>Casos que atiendo</h2>
        <div className="lista-chips">{CASOS.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>
        <p className="enfoques"><strong>Enfoques:</strong> {ENFOQUES.join(' · ')}</p>
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
          El contenido de este sitio es informativo y formativo, y no sustituye la atención
          clínica individual. Si estás en una situación de urgencia, comunícate al <strong>911</strong> o
          a la Línea de la Vida <strong>800 911 2000</strong> (24 h, México).
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
    if (!user) { navigate('/acceso'); return }
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
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type })
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
               onChange={(e) => setPerfil({ ...perfil, nombre_completo: e.target.value })} placeholder="Como quieres que aparezca en tu constancia" />
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
   PANEL DE ADMINISTRADOR
   ============================================================ */
function Admin({ user, esAdmin }) {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate('/acceso'); return }
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
          <thead>
            <tr>
              <th>Alumno</th><th>Curso</th><th>Progreso</th><th>Inscrito</th><th>Último ingreso</th>
            </tr>
          </thead>
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

      <div className="panel-info">
        <h3>Para inscribir a alguien</h3>
        <p className="sutil">
          1) Authentication → Users → Add user (con “Auto Confirm User”).<br />
          2) SQL Editor → el INSERT en <code>acceso</code> con su correo y el nombre del curso.
        </p>
      </div>
    </section>
  )
}

/* ============================================================
   VISOR DE PDF (carga solo cuando se abre el material)
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

  return (
    <div className="pdf-viewer">
      {pages.map((p, i) => <PdfPage key={i} page={p} n={i + 1} total={pages.length} />)}
    </div>
  )
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
   OTROS TIPOS DE RECURSO
   ============================================================ */
function VideoPlayer({ url }) {
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

/* ============================================================
   TARJETA DE RECURSO (colapsable)
   ============================================================ */
function RecursoCard({ recurso, bucket, user, visto, onMarcarVisto }) {
  const [abierto, setAbierto] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const colapsable = ['pdf', 'video', 'autoevaluacion'].includes(recurso.tipo)

  const abrirNuevaPestana = async () => {
    setAbriendo(true)
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(recurso.archivo, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      const { data } = supabase.storage.from(bucket).getPublicUrl(recurso.archivo)
      window.open(data.publicUrl, '_blank', 'noopener,noreferrer')
    }
    setAbriendo(false)
  }

  const descargar = async () => {
    setAbriendo(true)
    try {
      const { data, error } = await supabase.storage.from(bucket).download(recurso.archivo)
      if (error) throw error
      const a = document.createElement('a')
      a.href = URL.createObjectURL(data)
      a.download = recurso.archivo.split('/').pop()
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (err) { alert('Error al descargar: ' + err.message) }
    setAbriendo(false)
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
        {colapsable && (
          <button className={`button ${abierto ? 'secondary' : 'primary'}`} onClick={() => setAbierto(v => !v)}
                  aria-expanded={abierto}>
            {abierto ? 'Ocultar material' : 'Ver material'}
          </button>
        )}
        {recurso.tipo === 'enlace' && (
          <a className="button primary" href={recurso.url} target="_blank" rel="noopener noreferrer">Abrir enlace →</a>
        )}
        {(recurso.tipo === 'pdf') && (
          <button className="button secondary" onClick={abrirNuevaPestana} disabled={abriendo}>
            {abriendo ? 'Abriendo...' : 'Abrir en pestaña nueva ↗'}
          </button>
        )}
        {recurso.tipo === 'word' && (
          <button className="button primary" onClick={descargar} disabled={abriendo}>
            {abriendo ? 'Descargando...' : 'Descargar documento'}
          </button>
        )}
        {user && !visto && !['autoevaluacion'].includes(recurso.tipo) && (
          <button className="button texto" onClick={() => onMarcarVisto(recurso.id)}>Marcar como visto</button>
        )}
      </div>

      {abierto && (
        <div className="recurso-contenido">
          {recurso.tipo === 'pdf' && <PdfViewer archivo={recurso.archivo} bucket={bucket} />}
          {recurso.tipo === 'video' && <VideoPlayer url={recurso.url} />}
          {recurso.tipo === 'autoevaluacion' && user &&
            <Autoevaluacion url={recurso.url} recursoId={recurso.id} userId={user.id}
                            onComplete={() => onMarcarVisto(recurso.id)} />}
        </div>
      )}
    </article>
  )
}

/* ============================================================
   CURSO
   ============================================================ */
function CursoView({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [progreso, setProgreso] = useState(0)
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
      setCurso(c)
      if (!c) { setEstado('ok'); return }
      if (!c.gratuito) {
        if (!user) { setEstado('requiere_login'); return }
        const { data: acc } = await supabase.from('acceso').select('id').eq('usuario_id', user.id).eq('curso_id', id)
        if (!acc || acc.length === 0) { setEstado('sin_acceso'); return }
      }
      const { data: mods } = await supabase.from('modulos').select('*').eq('curso_id', id).eq('activo', true).order('orden')
      setModulos(mods || [])
      if (user) {
        const ids = []
        for (const m of (mods || [])) {
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
    }
    load()
  }, [id, user])

  if (estado === 'cargando') return <div className="loading">Cargando...</div>
  if (!curso) return <div className="contenedor"><p className="aviso-error">Curso no encontrado.</p></div>

  if (estado === 'requiere_login' || estado === 'sin_acceso') {
    return (
      <section className="contenedor estrecho">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo }]} />
        <h1>{curso.titulo}</h1>
        <p>{curso.descripcion}</p>
        <div className="bloque-cerrado">
          <p className="bloque-icono">🔒</p>
          <p>{estado === 'requiere_login'
            ? 'Este curso es para personas inscritas. Si ya tienes tus datos de acceso, inicia sesión.'
            : 'Tu cuenta aún no tiene acceso a este curso.'}</p>
          <div className="bloque-botones">
            {estado === 'requiere_login' &&
              <button className="button primary" onClick={() => navigate('/acceso')}>Iniciar sesión</button>}
            <a className="button whatsapp" target="_blank" rel="noopener noreferrer"
               href={wa(`Hola, me interesa inscribirme al curso "${curso.titulo}".`)}>Quiero inscribirme</a>
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

      {user && !curso.gratuito && (
        <div className="progreso-container">
          <div className="progreso-label"><span>Tu avance</span><span>{progreso}%</span></div>
          <div className="progreso-bar"><div className="progreso-lleno" style={{ width: `${progreso}%` }} /></div>
        </div>
      )}

      <h2 className="titulo-seccion">Contenido del curso</h2>
      <div className="modulo-grid">
        {modulos.map((m, i) => (
          <Link key={m.id} to={`/modulo/${m.id}`} className="modulo-card">
            <span className="modulo-num">{i + 1}</span>
            <div>
              <h3>{m.titulo}</h3>
              <p>{m.descripcion}</p>
            </div>
            <span className="modulo-flecha">→</span>
          </Link>
        ))}
        {modulos.length === 0 && <p className="sutil">Este curso aún no tiene módulos publicados.</p>}
      </div>
    </section>
  )
}

/* ============================================================
   MÓDULO (con navegación lateral)
   ============================================================ */
function ModuloView({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [modulo, setModulo] = useState(null)
  const [curso, setCurso] = useState(null)
  const [recursos, setRecursos] = useState([])
  const [modulosCurso, setModulosCurso] = useState([])
  const [progresoRecursos, setProgresoRecursos] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: m } = await supabase.from('modulos').select('*, cursos(id, titulo, gratuito)').eq('id', id).maybeSingle()
        if (!m) { setLoading(false); return }
        setModulo(m); setCurso(m.cursos)
        const { data: rs } = await supabase.from('recursos').select('*').eq('modulo_id', id).order('orden')
        setRecursos(rs || [])
        const { data: mods } = await supabase.from('modulos').select('id, titulo, orden')
          .eq('curso_id', m.curso_id).eq('activo', true).order('orden')
        setModulosCurso(mods || [])
        if (user && rs?.length) {
          const { data: pr } = await supabase.from('progreso_usuario').select('recurso_id, completado')
            .eq('usuario_id', user.id).in('recurso_id', rs.map(r => r.id))
          const map = {}; pr?.forEach(p => { map[p.recurso_id] = p.completado })
          setProgresoRecursos(map)
        }
      } finally { setLoading(false) }
    }
    load()
  }, [id, user])

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
  if (!modulo) return <div className="contenedor"><p className="aviso-error">Módulo no encontrado.</p></div>

  const idx = modulosCurso.findIndex(m => m.id === parseInt(id))
  const prev = idx > 0 ? modulosCurso[idx - 1] : null
  const next = idx < modulosCurso.length - 1 ? modulosCurso[idx + 1] : null
  const vistos = recursos.filter(r => progresoRecursos[r.id]).length

  return (
    <div className="contenedor">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/' },
        { label: curso?.titulo || 'Curso', to: `/curso/${curso?.id}` },
        { label: modulo.titulo }
      ]} />

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
            <Link to={`/curso/${curso?.id}`} className="side-atajo">📚 Todo el curso</Link>
            {user && <Link to="/perfil" className="side-atajo">👤 Mi perfil</Link>}
            <a className="side-atajo" href={wa('Hola, tengo una duda sobre el material del aula.')}
               target="_blank" rel="noopener noreferrer">💬 Dudas</a>
          </div>
        </aside>

        <main className="modulo-main">
          <header className="modulo-encabezado">
            <h1>{modulo.titulo}</h1>
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
            {prev && <button className="button secondary" onClick={() => navigate(`/modulo/${prev.id}`)}>← {prev.titulo}</button>}
            {next && <button className="button primary" onClick={() => navigate(`/modulo/${next.id}`)}>{next.titulo} →</button>}
            {!next && user && !curso?.gratuito &&
              <Link to={`/constancia/${curso?.id}`} className="button constancia-btn">Obtener constancia</Link>}
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
    if (!user) { navigate('/acceso'); return }
    async function load() {
      const { data: p } = await supabase.from('perfiles').select('nombre_completo, profesion').eq('id', user.id).maybeSingle()
      if (p) setPerfil({ nombre: p.nombre_completo || '', profesion: p.profesion || '' })
      const { data: c } = await supabase.from('cursos').select('titulo').eq('id', cursoId).maybeSingle()
      setCurso(c)
      const { data: mods } = await supabase.from('modulos').select('id').eq('curso_id', cursoId)
      if (mods?.length) {
        const { data: rs } = await supabase.from('recursos').select('id').in('modulo_id', mods.map(m => m.id))
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
          <Route path="/curso/:id" element={<CursoView user={user} />} />
          <Route path="/modulo/:id" element={<ModuloView user={user} />} />
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
