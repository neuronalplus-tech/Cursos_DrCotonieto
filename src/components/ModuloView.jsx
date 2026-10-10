import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  esTallerIndividual, moduloVisible, moduloBloqueadoParaAlumno,
  emiteConstancia, analizarUrl, esCursoProblemasContemporaneos,
} from '../lib/helpers'
import { BUCKET_PAGO, BUCKET_TALLERES, CONTACTO_EMAIL, AVATAR_BUCKET, ICONO_TIPO, NOMBRE_TIPO, rutaAcceso, FOTO_PERFIL, wa } from '../config'
import { usePermisos } from '../lib/permisos'
import { ModalPortal, Breadcrumb, BandaRedes, NavegacionFlotante } from './ui'
import TallerRecursos from './TallerRecursos'
import ExamenModulo from './ExamenModulo'
import AdminTareas from './AdminTareas'
import TareasAlumno from './TareasAlumno'
import { ModalEditarBotonesModulo } from './AdminModales'
import {
  Autoevaluacion, ModalEditarRecurso, ModalDuplicarModulo, ModalDuplicarRecurso,
  ModalNotificarRecurso, RecursoCard, DiapositivasPresentarCaso, Entregables,
} from './RecursosModulo'

function ModuloView({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [modulo, setModulo] = useState(null)
  const [curso, setCurso] = useState(null)
  const [recursos, setRecursos] = useState([])
  const [modulosCurso, setModulosCurso] = useState([])
  const [progresoRecursos, setProgresoRecursos] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // A diferencia de las pantallas de curso, aqui la URL trae el MODULO,
  // asi que el curso (y con el, el permiso) no se conoce hasta cargarlo.
  // `permisosCargados` entra en las dependencias del efecto para que la
  // carga se repita si los permisos llegan despues del primer render.
  const { puedeGestionar, cargado: permisosCargados } = usePermisos(user)
  const gestiona = puedeGestionar(modulo?.curso_id)

  // ✨ NUEVO: modal de edición de recurso
  const [editandoRecurso, setEditandoRecurso] = useState(null)
  const [duplicando, setDuplicando] = useState(false)
  const [tareasAbierto, setTareasAbierto] = useState(false)
  // La ruta del alumno se calculaba dentro del efecto y se perdia.
  // Las tareas la necesitan para filtrar las que son de una ruta.
  const [miGrupo, setMiGrupo] = useState(null)
  const [editandoBotonesModulo, setEditandoBotonesModulo] = useState(false)
  const [duplicandoRecurso, setDuplicandoRecurso] = useState(null)
  const [notificandoRecurso, setNotificandoRecurso] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        // El efecto se repite cuando llegan los permisos. Sin limpiar el
        // error, un admin que abriera un modulo no disponible se quedaria
        // atrapado en el aviso de la primera pasada, cuando todavia no se
        // sabia que podia verlo.
        setError(null)
        const { data: m, error: eM } = await supabase.from('modulos').select('*').eq('id', id).maybeSingle()
        if (eM) throw eM
        if (!m) { setError('Este módulo no existe o no tienes acceso a él.'); return }

        let miGrupo = null
        // El permiso real de esta pantalla: el curso al que pertenece
        // el modulo, no el modulo en si.
        const gestionaCurso = puedeGestionar(m.curso_id)

        if (user) {
          const { data: accG } = await supabase.from('acceso')
            .select('grupo').eq('usuario_id', user.id).eq('curso_id', m.curso_id).maybeSingle()
          miGrupo = accG?.grupo || null
          setMiGrupo(miGrupo)
        }

        if (!moduloVisible(m, { user, gestionaCurso, miGrupo })) {
          setError('Este módulo es privado. Inicia sesión con tu cuenta autorizada para verlo.')
          return
        }

        if (!gestionaCurso && m.disponible === false) {
          setError('Este módulo todavía no está abierto. Te avisaré por WhatsApp cuando esté disponible.')
          return
        }

        setModulo(m)
        const { data: c } = await supabase.from('cursos').select('id, titulo, gratuito, constancia').eq('id', m.curso_id).maybeSingle()
        setCurso(c)
        const { data: rs, error: eR } = await supabase.from('recursos').select('*').eq('modulo_id', id).order('orden')
        if (eR) throw eR
        setRecursos(rs || [])

        // `modulos` NO tiene columna `oculto`: pedirla hacia fallar la
        // consulta entera y la lista lateral de modulos salia vacia.
        const { data: mods } = await supabase.from('modulos')
          .select('id, titulo, orden, grupo, disponible')
          .eq('curso_id', m.curso_id).eq('activo', true).order('orden')
        const modsSidebar = (mods || [])
          .filter(x => moduloVisible(x, { user, gestionaCurso, miGrupo }))
          .filter(x => gestionaCurso || x.disponible !== false)
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
    // `puedeGestionar` se recrea en cada render: meterla aqui relanzaria
    // la carga sin motivo. `permisosCargados` ya cubre el unico cambio
    // que importa, que es la llegada de los permisos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, permisosCargados])

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

  const toggleRecursoDisponible = async (r) => {
    const nuevo = r.disponible === false
    const { error } = await supabase.from('recursos').update({ disponible: nuevo }).eq('id', r.id)
    if (error) { alert('Error al cambiar disponibilidad: ' + error.message); return }
    setRecursos(prev => prev.map(x => x.id === r.id ? { ...x, disponible: nuevo } : x))
  }

  // ✨ NUEVO: handler de guardado/borrado del modal
  const onGuardadoRecurso = (data, accion) => {
    if (accion === 'creado') {
      setRecursos(prev => [...prev, data].sort((a, b) => (a.orden || 0) - (b.orden || 0)))
    } else if (accion === 'actualizado') {
      setRecursos(prev => prev.map(r => r.id === data.id ? data : r)
                            .sort((a, b) => (a.orden || 0) - (b.orden || 0)))
    } else if (accion === 'eliminado') {
      setRecursos(prev => prev.filter(r => r.id !== data.id))
    }
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
  const mostrarJuegoS4 = mostrarEntregables && /sesi[oó]n\s*4/i.test(modulo.titulo || '')

  return (
    <div className="contenedor">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/' },
        { label: curso?.titulo || 'Curso', to: curso ? `/curso/${curso.id}` : '/' },
        { label: modulo.titulo }
      ]} />

      {gestiona && bloqueadoParaAlumno && (
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
              {bloqueadoParaAlumno && gestiona && <span className="etiqueta-grupo">🔒 Bloqueado (solo admin)</span>}
              {!bloqueadoParaAlumno && modulo.oculto && <span className="etiqueta-grupo">🔒 Privado</span>}
              {modulo.grupo && <span className="etiqueta-grupo">Grupo {modulo.grupo}</span>}
            </h1>
            {modulo.descripcion && <p className="curso-desc">{modulo.descripcion}</p>}
            {user && recursos.length > 0 && (
              <p className="modulo-avance">{vistos} de {recursos.length} recursos revisados</p>
            )}
            {mostrarJuegoS4 && (
              <div className="modulo-botones-extra">
                <a className="button primary" href="/juegos/juego-s4.html" target="_blank" rel="noopener noreferrer">
                  🎮 Abrir juego de la sesión 4
                </a>
              </div>
            )}
            {(modulo.botones_extra || []).length > 0 && (
              <div className="modulo-botones-extra">
                {modulo.botones_extra.filter(b => b.activo !== false && b.tipo !== 'entregables').map((b, i) => (
                  <a key={i} className={`button ${b.estilo || 'azul'}`} target="_blank" rel="noopener noreferrer" href={b.url}>
                    {b.texto}
                  </a>
                ))}
              </div>
            )}
          </header>

          {mostrarDiapositivas && <DiapositivasPresentarCaso />}
          {/* ✨ NUEVO: botón de "Nuevo recurso" solo para admin */}
          {gestiona && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <button type="button" className="button secondary" onClick={() => setEditandoBotonesModulo(true)}>
                🔗 Botones del módulo
              </button>
              <button type="button" className="button secondary" onClick={() => setDuplicando(true)}>
                📋 Duplicar módulo
              </button>
              <button type="button" className="button secondary" onClick={() => setTareasAbierto(true)}>
                📥 Tareas del módulo
              </button>
              <button type="button" className="button primary"
                      onClick={() => setEditandoRecurso({})}>
                ➕ Nuevo recurso
              </button>
            </div>
          )}

          {tareasAbierto && (
            <ModalPortal>
              <div className="modal-overlay" onClick={() => setTareasAbierto(false)}>
                <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
                     style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                  <h2>Tareas · {modulo.titulo}</h2>
                  <AdminTareas moduloId={modulo.id} />
                  <div className="modal-botones">
                    <button type="button" className="button secondary"
                            onClick={() => setTareasAbierto(false)}>Cerrar</button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

          <div className="recursos-list">
            {mostrarEntregables && <Entregables modulo={modulo} gestiona={gestiona} onGuardado={setModulo} />}
            {recursos.map((r) => (
              <RecursoCard
                key={r.id}
                recurso={r}
                bucket={bucket}
                user={user}
                visto={!!progresoRecursos[r.id]}
                onMarcarVisto={marcarVisto}
                gestiona={gestiona}
                onEditar={setEditandoRecurso}
                onDuplicar={setDuplicandoRecurso}
                onNotificar={setNotificandoRecurso}
                onToggleDisponible={toggleRecursoDisponible}
                esGratuito={!!curso?.gratuito}
              />
            ))}
            {recursos.length === 0 && <p className="sutil">Este módulo aún no tiene recursos.</p>}
          </div>
          <ExamenModulo moduloId={modulo.id} user={user} gestiona={gestiona} etiquetaDestino={`el módulo "${modulo.titulo}"`} />

          <TareasAlumno moduloId={modulo.id} user={user} miGrupo={miGrupo} />
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

      <NavegacionFlotante prev={prev} next={next} curso={curso} mostrarConstancia={mostrarConstancia} />

      {/* ✨ NUEVO: modal de edición */}
      {editandoRecurso !== null && (
        <ModalEditarRecurso
          recurso={editandoRecurso}
          moduloId={parseInt(id, 10)}
          curso={curso}
          modulo={modulo}
          onClose={() => setEditandoRecurso(null)}
          onGuardado={onGuardadoRecurso}
        />
      )}

      {duplicando && (
        <ModalDuplicarModulo
          modulo={modulo}
          recursos={recursos}
          onClose={() => setDuplicando(false)}
        />
      )}

      {editandoBotonesModulo && (
        <ModalEditarBotonesModulo
          modulo={modulo}
          incluirEntregables={!!mostrarEntregables}
          onClose={() => setEditandoBotonesModulo(false)}
          onGuardado={(m) => setModulo(m)}
        />
      )}

      {duplicandoRecurso && (
        <ModalDuplicarRecurso
          recurso={duplicandoRecurso}
          cursoActualId={curso?.id}
          onClose={() => setDuplicandoRecurso(null)}
        />
      )}

      {notificandoRecurso && (
        <ModalNotificarRecurso
          recurso={notificandoRecurso}
          modulo={modulo}
          curso={curso}
          onClose={() => setNotificandoRecurso(null)}
        />
      )}

      <BandaRedes />
    </div>
  )
}

export default ModuloView
