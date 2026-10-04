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
// (CursoCard se movió a src/components/CursoCard.jsx)

/* ============================================================
   HOME
   ============================================================ */
function Home({ user, esAdmin }) {
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
            {disponibles.map((c) => <CursoCard key={c.id} curso={c} user={user} esAdmin={esAdmin} tieneAcceso={accesos.has(c.id)} />)}
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
            {proximos.map((c) => <CursoCard key={c.id} curso={c} user={user} esAdmin={esAdmin} tieneAcceso={false} />)}
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
    const modsRuta = modulos.filter(m => m.grupo === ruta.grupo).sort((a, b) => (a.orden || 0) - (b.orden || 0))
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
// (ModuloView se movió a src/components/ModuloView.jsx)

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
               href={wa(`Hola, quiero un comprobante del curso "${curso?.titulo || ''}".`)}>Escríbeme por WhatsApp</a>
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
          <Route path="/" element={<Home user={user} esAdmin={esAdmin} />} />
          <Route path="/acceso" element={<Login message={message} />} />
          <Route path="/perfil" element={<Perfil user={user} />} />
          <Route path="/admin" element={<Admin user={user} esAdmin={esAdmin} />} />
          <Route path="/curso/:id" element={<CursoView user={user} esAdmin={esAdmin} />} />
          <Route path="/curso/:id/detalles" element={<CursoDetalle user={user} esAdmin={esAdmin} />} />
          <Route path="/modulo/:id" element={<ModuloView user={user} esAdmin={esAdmin} />} />
          <Route path="/constancia/:cursoId" element={<Constancia user={user} />} />
          <Route path="/mensajes" element={<MensajesPage user={user} esAdmin={esAdmin} />} />
        </Routes>
      </main>
      <WhatsAppFlotante />
    </>
  )
}

export default function Root() {
  return <BrowserRouter><App /></BrowserRouter>
}
