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

const BUCKET_NAME = 'curso_duelo'
const AVATAR_BUCKET = 'avatares'
const CONTACTO_EMAIL = 'cotonietoe@gmail.com'

// ---------- LOGIN ----------
function Login({ onLogin, message }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
    } else {
      localStorage.setItem('login_time', String(Date.now()))
      onLogin()
    }
  }

  return (
    <main className="portal centered">
      <section className="card login-card">
        <div className="logo-login">
          <img src="/logo_claro_1024.png" alt="Dr. Cotonieto" className="logo" />
        </div>
        <p className="eyebrow">Acceso privado</p>
        <h1>Portal de aprendizaje</h1>
        <p>Ingresa con tus credenciales.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="button primary">{loading ? 'Verificando...' : 'Ingresar'}</button>
        </form>
        {(error || message) && <p className="message">{error || message}</p>}
      </section>
    </main>
  )
}

// ---------- HEADER ----------
function Header({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo-area" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/logo_blanco_1024.png" alt="Dr. Cotonieto" className="logo" />
          <span className="brand-name">Dr. Ernesto Cotonieto</span>
        </div>
        <div className="header-actions">
          {location.pathname !== '/' && <button className="nav-link" onClick={() => navigate('/')}>← Inicio</button>}
          <button className="nav-link" onClick={() => navigate('/perfil')}>Mi perfil</button>
          <span className="user-email">{user?.email}</span>
          <button className="button secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>
    </header>
  )
}

// ---------- DASHBOARD ----------
function Dashboard({ user }) {
  const [cursos, setCursos] = useState([])
  const [accesos, setAccesos] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadCursos() {
      try {
        const { data, error } = await supabase
          .from('cursos').select('*').eq('activo', true).order('orden')
        if (error) {
          setError(`Error de Supabase: ${error.message}`)
        } else {
          setCursos(data || [])
          if (data.length === 0) setError('No hay cursos en la base de datos.')
        }
        const { data: acc } = await supabase.from('acceso').select('curso_id').eq('usuario_id', user.id)
        setAccesos(new Set((acc || []).map(a => a.curso_id)))
      } catch (err) {
        setError(`Error inesperado: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    loadCursos()
  }, [user])

  if (loading) return <div className="loading">Cargando cursos...</div>

  if (error) {
    return (
      <section className="dashboard">
        <h1>Bienvenido, {user?.email}</h1>
        <div className="error" style={{ background: '#f8d7da', padding: '16px', borderRadius: '8px', color: '#721c24' }}>
          <p><strong>Error al cargar cursos:</strong></p>
          <p>{error}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h1>Bienvenido, {user?.email}</h1>
        <p className="instrucciones">
          Este es el catálogo de cursos. Si ya tienes acceso a alguno, entra con "Ver módulos".
          Si te interesa uno al que aún no estás inscrito, usa "Preguntar por costo" y con gusto te doy acceso.
        </p>
      </div>
      <div className="course-grid">
        {cursos.map((curso) => {
          const tieneAcceso = accesos.has(curso.id)
          return (
            <div key={curso.id} className={`course-card ${tieneAcceso ? '' : 'bloqueado'}`}>
              {curso.imagen_portada && <img src={curso.imagen_portada} alt={curso.titulo} className="course-image" />}
              <div className="course-info">
                <h2>{curso.titulo}</h2>
                <p>{curso.descripcion}</p>
                {tieneAcceso ? (
                  <Link to={`/curso/${curso.id}`} className="button primary">Ver módulos</Link>
                ) : (
                  <>
                    <span className="badge-bloqueado">🔒 No inscrito</span>
                    <a
                      className="button secondary"
                      href={`mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent('Interés en el curso: ' + curso.titulo)}&body=${encodeURIComponent('Hola, me interesa el curso "' + curso.titulo + '". ¿Me podrías compartir el costo y cómo obtener acceso? Gracias.')}`}
                    >
                      Preguntar por costo
                    </a>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------- PERFIL ----------
function Perfil({ user }) {
  const [perfil, setPerfil] = useState({ nombre_completo: '', profesion: '', descripcion: '', ubicacion: '', avatar_url: '' })
  const [misCursos, setMisCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
      if (data) setPerfil({
        nombre_completo: data.nombre_completo || '',
        profesion: data.profesion || '',
        descripcion: data.descripcion || '',
        ubicacion: data.ubicacion || '',
        avatar_url: data.avatar_url || ''
      })
      const { data: acc } = await supabase.from('acceso').select('cursos(titulo)').eq('usuario_id', user.id)
      if (acc) setMisCursos(acc.map(a => a.cursos?.titulo).filter(Boolean))
      setCargando(false)
    }
    load()
  }, [user])

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    setMsg('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const urlConCache = `${pub.publicUrl}?t=${Date.now()}`
      await supabase.from('perfiles').upsert({ id: user.id, avatar_url: urlConCache }, { onConflict: 'id' })
      setPerfil(p => ({ ...p, avatar_url: urlConCache }))
      setMsg('Foto actualizada.')
    } catch (err) {
      setMsg('Error al subir la foto: ' + err.message)
    }
    setSubiendo(false)
  }

  const handleGuardar = async () => {
    setMsg('')
    const { error } = await supabase.from('perfiles').upsert({
      id: user.id,
      nombre_completo: perfil.nombre_completo,
      profesion: perfil.profesion,
      descripcion: perfil.descripcion,
      ubicacion: perfil.ubicacion
    }, { onConflict: 'id' })
    setMsg(error ? 'Error: ' + error.message : 'Perfil guardado.')
  }

  if (cargando) return <div className="loading">Cargando perfil...</div>

  return (
    <section className="perfil-wrapper">
      <h1>Mi perfil</h1>

      <div className="perfil-avatar-zona">
        <div className="perfil-avatar">
          {perfil.avatar_url
            ? <img src={perfil.avatar_url} alt="Foto de perfil" />
            : <div className="perfil-avatar-placeholder">{(perfil.nombre_completo || user.email || '?').charAt(0).toUpperCase()}</div>}
        </div>
        <label className="button secondary">
          {subiendo ? 'Subiendo...' : 'Cambiar foto'}
          <input type="file" accept="image/*" onChange={handleAvatar} disabled={subiendo} style={{ display: 'none' }} />
        </label>
      </div>

      <div className="formulario-datos">
        <label>Nombre completo</label>
        <input type="text" value={perfil.nombre_completo} onChange={(e) => setPerfil({ ...perfil, nombre_completo: e.target.value })} placeholder="Tu nombre completo" />

        <label>Profesión / Especialidad</label>
        <input type="text" value={perfil.profesion} onChange={(e) => setPerfil({ ...perfil, profesion: e.target.value })} placeholder="Ej. Psicólogo clínico" />

        <label>Ubicación</label>
        <input type="text" value={perfil.ubicacion} onChange={(e) => setPerfil({ ...perfil, ubicacion: e.target.value })} placeholder="Ciudad, país" />

        <label>Sobre mí</label>
        <textarea rows="4" value={perfil.descripcion} onChange={(e) => setPerfil({ ...perfil, descripcion: e.target.value })} placeholder="Cuéntanos un poco sobre ti y tu práctica." />

        <button className="button primary" onClick={handleGuardar}>Guardar cambios</button>
      </div>

      {msg && <p className={msg.startsWith('Error') ? 'error' : 'success'}>{msg}</p>}

      <div className="perfil-cursos">
        <h3>Cursos a los que estás inscrito</h3>
        {misCursos.length > 0
          ? <ul>{misCursos.map((t, i) => <li key={i}>{t}</li>)}</ul>
          : <p className="perfil-sin-cursos">Aún no estás inscrito en ningún curso.</p>}
      </div>

      <button className="button secondary" onClick={() => navigate('/')}>Volver al inicio</button>
    </section>
  )
}

// ---------- PROGRESO BARRA ----------
function ProgresoBarra({ progreso }) {
  return (
    <div className="progreso-container">
      <div className="progreso-label"><span>Progreso del curso</span><span>{progreso}%</span></div>
      <div className="progreso-bar"><div className="progreso-lleno" style={{ width: `${progreso}%` }}></div></div>
    </div>
  )
}

// ---------- CURSO VIEW ----------
function CursoView({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [progreso, setProgreso] = useState(0)
  const [tieneAcceso, setTieneAcceso] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: cursoData } = await supabase.from('cursos').select('*').eq('id', id).single()
        setCurso(cursoData)

        const { data: acc } = await supabase.from('acceso').select('id').eq('usuario_id', user.id).eq('curso_id', id)
        const acceso = acc && acc.length > 0
        setTieneAcceso(acceso)
        if (!acceso) { setLoading(false); return }

        const { data: modulosData } = await supabase.from('modulos').select('*').eq('curso_id', id).eq('activo', true).order('orden')
        setModulos(modulosData || [])

        const recursoIds = []
        for (const mod of (modulosData || [])) {
          const { data: recs } = await supabase.from('recursos').select('id').eq('modulo_id', mod.id)
          recursoIds.push(...(recs || []).map(r => r.id))
        }
        if (recursoIds.length > 0) {
          const { data: completados } = await supabase.from('progreso_usuario').select('recurso_id').eq('usuario_id', user.id).in('recurso_id', recursoIds).eq('completado', true)
          setProgreso(Math.round((completados.length / recursoIds.length) * 100))
        } else setProgreso(0)
      } catch (error) {
        console.error('Error loading curso:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id, user])

  if (loading) return <div className="loading">Cargando módulos...</div>
  if (!curso) return <div className="error">Curso no encontrado</div>

  if (!tieneAcceso) {
    return (
      <section className="curso-view">
        <h1>{curso.titulo}</h1>
        <p>{curso.descripcion}</p>
        <div className="constancia-estado">
          <p className="error">🔒 Aún no tienes acceso a este curso.</p>
        </div>
        <a className="button primary"
           href={`mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent('Interés en el curso: ' + curso.titulo)}`}>
          Preguntar por costo
        </a>
        <button className="button secondary" onClick={() => navigate('/')} style={{ marginLeft: '10px' }}>Volver al inicio</button>
      </section>
    )
  }

  return (
    <section className="curso-view">
      <h1>{curso.titulo}</h1>
      <p>{curso.descripcion}</p>
      <ProgresoBarra progreso={progreso} />
      <div className="modulo-grid">
        {modulos.map((modulo) => (
          <div key={modulo.id} className="modulo-card">
            <h3>{modulo.titulo}</h3>
            <p>{modulo.descripcion}</p>
            <Link to={`/modulo/${modulo.id}`} className="button primary">Ver recursos</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- PDF VIEWER ----------
function PdfViewer({ archivo, email }) {
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('Cargando PDF...')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false, loadingTask = null, pdfDocument = null
    async function loadPdf() {
      try {
        setPages([])
        setStatus('Descargando documento...')
        const { data: fileBlob, error } = await supabase.storage.from(BUCKET_NAME).download(archivo)
        if (error) throw new Error(error.message)
        if (!fileBlob) throw new Error('No se pudo obtener el archivo')
        const arrayBuffer = await fileBlob.arrayBuffer()
        if (cancelled) return
        if (arrayBuffer.byteLength === 0) throw new Error('Archivo vacío')
        setStatus('Procesando...')
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), isEvalSupported: false })
        pdfDocument = await loadingTask.promise
        if (cancelled || !pdfDocument) return
        const loadedPages = []
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          if (cancelled) return
          const page = await pdfDocument.getPage(i)
          loadedPages.push(page)
        }
        if (!cancelled) { setPages(loadedPages); setStatus('') }
      } catch (err) {
        if (!cancelled) { setError(err.message); setStatus('') }
      }
    }
    loadPdf()
    return () => { cancelled = true; if (loadingTask) loadingTask.destroy(); if (pdfDocument) pdfDocument.destroy() }
  }, [archivo])

  if (error) return <div className="error">Error al cargar PDF: {error}</div>
  if (status) return <div className="loading">{status}</div>

  return (
    <div className="pdf-viewer-container protected-content" onContextMenu={(e) => e.preventDefault()}>
      {pages.map((page, index) => <PdfPage key={index} page={page} pageNumber={index+1} totalPages={pages.length} email={email} />)}
    </div>
  )
}

function PdfPage({ page, pageNumber, totalPages, email }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    let renderTask = null, cancelled = false
    async function renderPage() {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const containerWidth = Math.min(window.innerWidth - 40, 900)
      const originalViewport = page.getViewport({ scale: 1 })
      const scale = containerWidth / originalViewport.width
      const viewport = page.getViewport({ scale })
      const outputScale = window.devicePixelRatio || 1
      const context = canvas.getContext('2d', { alpha: false })
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      renderTask = page.render({ canvasContext: context, viewport, transform: outputScale !== 1 ? [outputScale,0,0,outputScale,0,0] : null })
      await renderTask.promise
    }
    renderPage().catch((err) => { if (err?.name !== 'RenderingCancelledException') console.error(err) })
    return () => { cancelled = true; if (renderTask) renderTask.cancel() }
  }, [page])

  return (
    <article className="pdf-page" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} aria-label={`Página ${pageNumber} de ${totalPages}`} />
      <div className="watermark-layer">
        <span className="watermark corner top-left">USO PERSONAL · {email}</span>
        <span className="watermark corner top-right">USO PERSONAL · {email}</span>
        <span className="watermark corner bottom-left">USO PERSONAL · {email}</span>
        <span className="watermark corner bottom-right">USO PERSONAL · {email}</span>
        <span className="watermark center">@dr.cotonieto</span>
      </div>
      <span className="page-label">Página {pageNumber} de {totalPages}</span>
    </article>
  )
}

// ---------- VIDEO PLAYER ----------
function VideoPlayer({ url, email }) {
  const [showOverlay, setShowOverlay] = useState(true)
  useEffect(() => { const t = setTimeout(() => setShowOverlay(false), 3000); return () => clearTimeout(t) }, [])
  return (
    <div className="video-wrapper protected-content" onContextMenu={(e) => e.preventDefault()}>
      <iframe src={url} className="video-iframe" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video del curso" />
      {showOverlay && (
        <div className="video-overlay watermark-layer">
          <span className="watermark center">@dr.cotonieto</span>
          <span className="watermark corner bottom-right">USO PERSONAL · {email}</span>
        </div>
      )}
    </div>
  )
}

// ---------- ENLACE (videollamada / recurso externo) ----------
function EnlaceRecurso({ url }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="button primary enlace-btn">
      Entrar a la videollamada →
    </a>
  )
}

// ---------- AUTOEVALUACION ----------
function Autoevaluacion({ url, recursoId, userId, onComplete }) {
  const [intentos, setIntentos] = useState(0)
  const [completado, setCompletado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function loadProgreso() {
      const { data, error } = await supabase.from('progreso_usuario').select('intentos, completado').eq('usuario_id', userId).eq('recurso_id', recursoId).single()
      if (!error && data) { setIntentos(data.intentos || 0); setCompletado(data.completado || false) }
      setCargando(false)
    }
    loadProgreso()
  }, [recursoId, userId])

  const handleMarcarCompletado = async () => {
    const nuevosIntentos = intentos + 1
    const { error } = await supabase.from('progreso_usuario').upsert({ usuario_id: userId, recurso_id: recursoId, intentos: nuevosIntentos, completado: true, ultimo_acceso: new Date().toISOString() }, { onConflict: 'usuario_id, recurso_id' })
    if (!error) { setIntentos(nuevosIntentos); setCompletado(true); onComplete() }
  }

  if (cargando) return <div className="loading">Cargando autoevaluación...</div>
  if (completado) return <div className="success">✔ Autoevaluación completada.</div>
  if (intentos >= 3) return <div className="error">Has alcanzado el límite de 3 intentos.</div>

  return (
    <div className="autoevaluacion-wrapper">
      <p>Realiza la autoevaluación (máximo 3 intentos).</p>
      <iframe src={url} className="forms-iframe" title="Autoevaluación" />
      <button className="button primary" onClick={handleMarcarCompletado}>Marcar como completada</button>
    </div>
  )
}

// ---------- DESCARGA WORD ----------
function DescargaWord({ archivo, titulo }) {
  const [descargando, setDescargando] = useState(false)
  const handleDownload = async () => {
    setDescargando(true)
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(archivo)
      if (error) throw error
      const link = document.createElement('a')
      link.href = URL.createObjectURL(data)
      link.download = archivo.split('/').pop()
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (err) { alert('Error: ' + err.message) }
    setDescargando(false)
  }
  return <button className="button secondary" onClick={handleDownload} disabled={descargando}>{descargando ? 'Descargando...' : `Descargar ${titulo}`}</button>
}

// ---------- CONSTANCIA ----------
function Constancia({ user }) {
  const { cursoId } = useParams()
  const [perfil, setPerfil] = useState({ nombre: '', profesion: '' })
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [curso, setCurso] = useState(null)
  const [puedeObtener, setPuedeObtener] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadData() {
      const { data: perfilData } = await supabase.from('perfiles').select('nombre_completo, profesion').eq('id', user.id).single()
      if (perfilData) setPerfil({ nombre: perfilData.nombre_completo || '', profesion: perfilData.profesion || '' })
      const { data: cursoData } = await supabase.from('cursos').select('titulo').eq('id', cursoId).single()
      if (cursoData) setCurso(cursoData)
      const { data: modulos } = await supabase.from('modulos').select('id').eq('curso_id', cursoId)
      if (modulos && modulos.length > 0) {
        const moduloIds = modulos.map(m => m.id)
        const { data: recursos } = await supabase.from('recursos').select('id').in('modulo_id', moduloIds)
        if (recursos && recursos.length > 0) {
          const recursoIds = recursos.map(r => r.id)
          const { data: completados } = await supabase.from('progreso_usuario').select('recurso_id').eq('usuario_id', user.id).in('recurso_id', recursoIds).eq('completado', true)
          setPuedeObtener(completados && completados.length === recursoIds.length)
        }
      }
      setCargando(false)
    }
    loadData()
  }, [cursoId, user])

  const handleGuardarPerfil = async () => {
    const { error } = await supabase.from('perfiles').upsert({ id: user.id, nombre_completo: perfil.nombre, profesion: perfil.profesion }, { onConflict: 'id' })
    if (error) alert('Error: ' + error.message)
    else alert('Datos guardados.')
  }

  const handleGenerarConstancia = async () => {
    if (!puedeObtener) return alert('Completa todos los recursos primero.')
    if (!perfil.nombre || !perfil.profesion) return alert('Completa tus datos personales.')
    setGenerando(true)
    try {
      const doc = new jsPDF()
      doc.setFontSize(22)
      doc.text('CONSTANCIA DE PARTICIPACIÓN', 105, 60, { align: 'center' })
      doc.setFontSize(14)
      doc.text(`Otorgada a: ${perfil.nombre}`, 20, 90)
      doc.text(`Profesión: ${perfil.profesion}`, 20, 110)
      doc.text(`Correo: ${user.email}`, 20, 130)
      doc.text(`Curso: ${curso?.titulo || ''}`, 20, 150)
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 170)
      doc.text('Firma: _____________________', 20, 200)
      doc.save('constancia.pdf')
    } catch (err) { alert('Error: ' + err.message) }
    setGenerando(false)
  }

  if (cargando) return <div className="loading">Cargando...</div>

  return (
    <section className="constancia-wrapper">
      <h1>Constancia de participación</h1>
      <p>Completa tus datos y asegúrate de haber marcado todos los recursos como vistos.</p>
      <div className="formulario-datos">
        <label>Nombre completo</label>
        <input type="text" value={perfil.nombre} onChange={(e) => setPerfil({...perfil, nombre: e.target.value})} placeholder="Tu nombre completo" />
        <label>Profesión / Especialidad</label>
        <input type="text" value={perfil.profesion} onChange={(e) => setPerfil({...perfil, profesion: e.target.value})} placeholder="Tu profesión" />
        <button className="button secondary" onClick={handleGuardarPerfil}>Guardar datos</button>
      </div>
      <div className="constancia-estado">
        {puedeObtener ? (
          <>
            <p className="success">✔ Has completado todos los recursos. ¡Felicidades!</p>
            <button className="button primary" onClick={handleGenerarConstancia} disabled={generando}>{generando ? 'Generando...' : 'Descargar constancia'}</button>
          </>
        ) : (
          <p className="error">❌ Aún no has completado todos los recursos.</p>
        )}
      </div>
      <button className="button secondary" onClick={() => navigate(`/curso/${cursoId}`)}>Volver al curso</button>
    </section>
  )
}

// ---------- MODULO VIEW ----------
function ModuloView({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [modulo, setModulo] = useState(null)
  const [recursos, setRecursos] = useState([])
  const [modulosCurso, setModulosCurso] = useState([])
  const [progresoRecursos, setProgresoRecursos] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: moduloData, error: modError } = await supabase.from('modulos').select('*, curso_id').eq('id', id).single()
        if (modError) throw modError
        setModulo(moduloData)

        const { data: recursosData, error: recError } = await supabase.from('recursos').select('*').eq('modulo_id', id).order('orden')
        if (recError) throw recError
        setRecursos(recursosData)

        if (moduloData) {
          const { data: mods } = await supabase.from('modulos').select('id, titulo, orden').eq('curso_id', moduloData.curso_id).eq('activo', true).order('orden')
          setModulosCurso(mods || [])
        }

        if (recursosData && recursosData.length > 0) {
          const ids = recursosData.map(r => r.id)
          const { data: progreso } = await supabase.from('progreso_usuario').select('recurso_id, completado').eq('usuario_id', user.id).in('recurso_id', ids)
          const map = {}
          progreso?.forEach(p => { map[p.recurso_id] = p.completado })
          setProgresoRecursos(map)
        }
      } catch (error) {
        console.error('Error loading modulo:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id, user])

  const handleMarcarVisto = async (recursoId) => {
    const { error } = await supabase.from('progreso_usuario').upsert({ usuario_id: user.id, recurso_id: recursoId, completado: true, ultimo_acceso: new Date().toISOString() }, { onConflict: 'usuario_id, recurso_id' })
    if (!error) setProgresoRecursos(prev => ({ ...prev, [recursoId]: true }))
  }

  const currentIndex = modulosCurso.findIndex(m => m.id === parseInt(id))
  const prevModulo = currentIndex > 0 ? modulosCurso[currentIndex - 1] : null
  const nextModulo = currentIndex < modulosCurso.length - 1 ? modulosCurso[currentIndex + 1] : null
  const esUltimo = currentIndex === modulosCurso.length - 1

  if (loading) return <div className="loading">Cargando recursos...</div>
  if (!modulo) return <div className="error">Módulo no encontrado</div>

  return (
    <section className="modulo-view">
      <div className="modulo-header"><h1>{modulo.titulo}</h1><p>{modulo.descripcion}</p></div>
      <div className="recursos-list">
        {recursos.map((recurso) => {
          const visto = progresoRecursos[recurso.id] || false
          const sinBotonVisto = ['autoevaluacion', 'word', 'enlace'].includes(recurso.tipo)
          return (
            <div key={recurso.id} className="recurso-item">
              <div className="recurso-header"><h3>{recurso.titulo}</h3>{visto && <span className="badge visto">✔ Visto</span>}</div>
              <p>{recurso.descripcion}</p>
              <div className="recurso-content">
                {recurso.tipo === 'pdf' && <PdfViewer archivo={recurso.archivo} email={user.email} />}
                {recurso.tipo === 'video' && <VideoPlayer url={recurso.url} email={user.email} />}
                {recurso.tipo === 'autoevaluacion' && <Autoevaluacion url={recurso.url} recursoId={recurso.id} userId={user.id} onComplete={() => handleMarcarVisto(recurso.id)} />}
                {recurso.tipo === 'word' && <DescargaWord archivo={recurso.archivo} titulo={recurso.titulo} />}
                {recurso.tipo === 'enlace' && <EnlaceRecurso url={recurso.url} />}
              </div>
              {!visto && !sinBotonVisto && (
                <button className="button secondary marcar-visto" onClick={() => handleMarcarVisto(recurso.id)}>Marcar como visto</button>
              )}
            </div>
          )
        })}
      </div>
      <div className="navegacion-modulos">
        <button className="button secondary" onClick={() => navigate('/')}>Inicio</button>
        {prevModulo && <button className="button primary" onClick={() => navigate(`/modulo/${prevModulo.id}`)}>← Anterior: {prevModulo.titulo}</button>}
        {nextModulo && <button className="button primary" onClick={() => navigate(`/modulo/${nextModulo.id}`)}>Siguiente: {nextModulo.titulo} →</button>}
        {esUltimo && <Link to={`/constancia/${modulo.curso_id}`} className="button primary constancia-btn">Obtener constancia</Link>}
      </div>
    </section>
  )
}

// ---------- APP ----------
function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      const currentSession = data?.session || null
      if (currentSession) {
        const loginTime = localStorage.getItem('login_time')
        if (loginTime) {
          const elapsed = Date.now() - parseInt(loginTime, 10)
          if (elapsed > 30 * 24 * 60 * 60 * 1000) {
            await supabase.auth.signOut()
            localStorage.removeItem('login_time')
            setSession(null)
            setMessage('El acceso ha expirado (30 días).')
            setLoading(false)
            return
          }
        } else localStorage.setItem('login_time', String(Date.now()))
      }
      setSession(currentSession || null)
      setLoading(false)
    }
    loadSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) { localStorage.removeItem('login_time'); navigate('/') }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    const blockShortcuts = (e) => {
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['p','s','u'].includes(key)) { e.preventDefault(); setMessage('Acción deshabilitada.') }
      if (e.key === 'PrintScreen') setMessage('Material identificado.')
    }
    window.addEventListener('keydown', blockShortcuts)
    return () => window.removeEventListener('keydown', blockShortcuts)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      const content = document.querySelector('.protected-content')
      if (content) {
        if (document.hidden) content.classList.add('hidden')
        else content.classList.remove('hidden')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handleLogin = () => setMessage('')
  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.removeItem('login_time'); setSession(null); navigate('/') }

  if (loading) return <div className="loading">Cargando...</div>
  if (!session) return <Login onLogin={handleLogin} message={message} />

  return (
    <>
      <Header user={session.user} onLogout={handleLogout} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard user={session.user} />} />
          <Route path="/perfil" element={<Perfil user={session.user} />} />
          <Route path="/curso/:id" element={<CursoView user={session.user} />} />
          <Route path="/modulo/:id" element={<ModuloView user={session.user} />} />
          <Route path="/constancia/:cursoId" element={<Constancia user={session.user} />} />
        </Routes>
      </main>
    </>
  )
}

// ---------- ENVOLTORIO ----------
export default function Root() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
