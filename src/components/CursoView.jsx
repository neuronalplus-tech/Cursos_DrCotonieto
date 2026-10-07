import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  esContenedorTalleres, esTallerIndividual,
  cursoEspecial, normalizarTexto,
} from '../lib/helpers'
import { rutaAcceso, wa } from '../config'
import { usePermisos } from '../lib/permisos'
import AdminExamenes from './AdminExamenes'
import PanelProgreso from './PanelProgreso'
import AdminTareas from './AdminTareas'
import AdminGeneraciones from './AdminGeneraciones'
import TareasAlumno from './TareasAlumno'
import { enviarCorreo } from '../lib/correo'
import { ModalPortal, Breadcrumb, BandaRedes } from './ui'
import TallerRecursos from './TallerRecursos'
import ExamenModulo from './ExamenModulo'
import { ModalEditarBotonesRuta, ModalNuevoModulo } from './AdminModales'
import CursoCard from './CursoCard'
import PortadaCurso from './PortadaCurso'

function CursoView({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  // El id viene de la URL, asi que el permiso esta resuelto desde el
  // primer render, sin esperar a que cargue el curso.
  const gestiona = usePermisos(user).puedeGestionar(id)
  const [examenesAbierto, setExamenesAbierto] = useState(false)
  const [progresoAbierto, setProgresoAbierto] = useState(false)
  const [tareasAbierto, setTareasAbierto] = useState(false)
  const [generacionesAbierto, setGeneracionesAbierto] = useState(false)
  const [borrandoModulo, setBorrandoModulo] = useState(null)
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [talleres, setTalleres] = useState([])
  const [miGrupo, setMiGrupo] = useState(null)
  // Tener fila en `acceso` da acceso al curso, diga o no diga grupo.
  // `miGrupo` a secas no servía para decidir esto: un alumno con acceso y
  // sin ruta asignada tiene miGrupo === null y se le ocultaba el foro.
  const [tieneAcceso, setTieneAcceso] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [estado, setEstado] = useState('cargando')
  const [error, setError] = useState(null)

  const [notificando, setNotificando] = useState(null)
  const [msgNotificacion, setMsgNotificacion] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)
  const [nuevoModuloAbierto, setNuevoModuloAbierto] = useState(false)
  const [editandoBotonesRuta, setEditandoBotonesRuta] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: c, error: eC } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
        if (eC) throw eC
        setCurso(c)
        if (!c) { setEstado('ok'); return }
        if (c.proximamente && !gestiona) { setEstado('proximo'); return }

        if (esContenedorTalleres(c)) {
          const { data: hermanos, error: eH } = await supabase.from('cursos')
            .select('*').eq('gratuito', true).eq('activo', true).neq('id', c.id).order('orden')
          if (eH) throw eH
          setTalleres(hermanos || [])
          setEstado('talleres')
          return
        }

        let grupo = null
        let acceso = false
        if (!gestiona && user) {
          const { data: acc } = await supabase.from('acceso')
            .select('id, grupo').eq('usuario_id', user.id).eq('curso_id', id).maybeSingle()
          if (acc) { grupo = acc.grupo || null; acceso = true }
        }
        setMiGrupo(grupo)
        // Un curso gratuito se puede abrir sin fila en `acceso`.
        setTieneAcceso(acceso || !!c.gratuito)

        const { data: mods, error: eM } = await supabase.from('modulos')
          .select('*').eq('curso_id', id).eq('activo', true).order('orden')
        if (eM) throw eM

        const visibles = (mods || []).filter(m => gestiona || !m.oculto || !!user)
        setModulos(visibles)

        if (user && visibles.length) {
          const modsConAcceso = visibles.filter(m => {
            if (gestiona) return true
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
  }, [id, user, gestiona])

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
               href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me avisas cuándo abre?`)}>Me interesa · avísame</a>
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
    if (gestiona) return true
    if (!user) return false
    if (!g) return true
    return miGrupo === g
  }

  const esModuloBloqueado = (m) => {
    if (gestiona) return false
    if (m.disponible === false) return true
    if (!user) return true
    if (m.grupo && miGrupo !== m.grupo) return true
    return false
  }

  const toggleCursoProximamente = async () => {
    if (!gestiona) return
    const nuevo = !curso.proximamente
    if (nuevo === true) {
      const ok = window.confirm(
        '¿Seguro que quieres marcar este curso como "Próximamente"?\n\n' +
        'Se oculta de inmediato para todo el público (incluida esta misma tarjeta en los listados) ' +
        'y solo queda visible el botón de WhatsApp "Me interesa · avísame". ' +
        'Puedes volver a abrirlo en cualquier momento desde aquí o desde la tarjeta del curso.'
      )
      if (!ok) return
    }
    const { error } = await supabase.from('cursos').update({ proximamente: nuevo }).eq('id', curso.id)
    if (error) { alert('Error al cambiar disponibilidad del curso: ' + error.message); return }
    setCurso(prev => ({ ...prev, proximamente: nuevo }))
  }

  const toggleDisponible = async (m) => {
    if (!gestiona) return
    const nuevo = !m.disponible

    let notificar = false
    if (nuevo === true && !curso.gratuito) {
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

    if (notificar) notificarModuloAbierto(m)
  }

  const notificarModuloAbierto = async (m) => {
    try {
      setNotificando(m.id)
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

      if (alumnos.length === 0) {
        setMsgNotificacion('No hay alumnos inscritos todavía')
        setNotificando(null)
        return
      }

      const urlModulo = `${window.location.origin}/modulo/${m.id}`
      const payload = {
        tipo: 'modulo-abierto',
        curso: { titulo: curso.titulo, url: urlModulo },
        modulo: { titulo: m.titulo, descripcion: m.descripcion },
        alumnos
      }

      const res = await enviarCorreo(payload)

      setMsgNotificacion(res.ok
        ? `✓ Enviado y confirmado (${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'})`
        : `⚠️ ${res.motivo || 'No se pudo enviar.'}`)
    } catch (e) {
      console.error('Error notificando:', e)
      setMsgNotificacion('Error: ' + e.message)
    } finally {
      setNotificando(null)
    }
  }

  /* Borrar un modulo es menos grave que borrar un curso: es una unidad
     de trabajo y equivocarse creando uno es comun. La red de seguridad
     es la bitacora, que guarda la fila completa al borrarla. */
  const borrarModulo = async (m) => {
    const { count } = await supabase.from('recursos')
      .select('id', { count: 'exact', head: true }).eq('modulo_id', m.id)
    const aviso = count
      ? `El modulo "${m.titulo}" tiene ${count} recurso(s). Al borrarlo se van tambien.

¿Seguro?`
      : `¿Eliminar el modulo "${m.titulo}"?`
    if (!window.confirm(aviso)) return

    setBorrandoModulo(m.id)
    const { error } = await supabase.from('modulos').delete().eq('id', m.id)
    setBorrandoModulo(null)
    if (error) { window.alert('No se pudo eliminar: ' + error.message); return }
    setModulos(prev => prev.filter(x => x.id !== m.id))
  }

  const renderModulo = (m, i) => {
    const bloqueado = esModuloBloqueado(m)
    const bloqueadoPorRuta = bloqueado && user && m.grupo && miGrupo !== m.grupo && !gestiona
    const bloqueadoPorDisponibilidad = bloqueado && m.disponible === false && !gestiona
    const bloqueadoPorLogin = bloqueado && !user && !gestiona

    const contenido = (
      <>
        <span className="modulo-num">{i + 1}</span>
        <div>
          <h3>
            {m.titulo}
            {bloqueadoPorLogin && <span className="etiqueta-grupo">🔒 Requiere acceso</span>}
            {bloqueadoPorRuta && <span className="etiqueta-grupo">🔒 Otra ruta</span>}
            {bloqueadoPorDisponibilidad && <span className="etiqueta-grupo">🔒 Próximamente</span>}
            {gestiona && m.disponible === false && <span className="etiqueta-grupo">🔒 Oculto para alumnos</span>}
            {gestiona && m.grupo && <span className="etiqueta-grupo">{m.grupo}</span>}
          </h3>
          <p>{m.descripcion}</p>
        </div>
        <span className="modulo-flecha">{bloqueado ? '🔒' : '→'}</span>
      </>
    )

    if (bloqueado) return <div key={m.id} className="modulo-card bloqueado">{contenido}</div>
    if (!gestiona) return <Link key={m.id} to={`/modulo/${m.id}`} className="modulo-card">{contenido}</Link>

    return (
      <div key={m.id} className="modulo-row">
        <Link to={`/modulo/${m.id}`} className="modulo-card">{contenido}</Link>
        <button type="button"
          className={`candado-toggle ${m.disponible ? 'abierto' : 'cerrado'}`}
          onClick={() => toggleDisponible(m)}
          disabled={notificando === m.id}
          title={m.disponible ? 'Cerrar módulo' : 'Abrir módulo'}>
          {notificando === m.id ? '⏳' : (m.disponible ? '🔓' : '🔒')}
        </button>
        <button type="button" className="modulo-borrar"
          onClick={() => borrarModulo(m)}
          disabled={borrandoModulo === m.id}
          title="Eliminar este módulo">
          {borrandoModulo === m.id ? '⏳' : '🗑️'}
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

      {esTallerIndividual(curso) && (
        <div className="taller-institucion-cta">
          <p>¿Quieres que imparta este taller en vivo para tu institución?</p>
          <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
             href={wa(`Hola, me interesa que impartas el taller "${curso.titulo}" en vivo para mi institución. Entiendo que tiene una cuota de recuperación, ¿me compartes más información?`)}>
            💬 Quiero este taller para mi institución
          </a>
        </div>
      )}

      {gestiona && (
        <div className="admin-banner">
          <strong>Vista de gestión.</strong> Ves todas las rutas y módulos. Los módulos con <em>🔒 Oculto para alumnos</em> no están abiertos todavía para alumnos.
          <div style={{ marginTop: 10 }}>
            <button type="button" className={`candado-toggle ${curso.proximamente ? 'cerrado' : 'abierto'}`}
                    onClick={toggleCursoProximamente}>
              {curso.proximamente ? '🔒 Curso marcado como "Próximamente" — clic para abrirlo' : '🔓 Curso abierto al público — clic para marcarlo "Próximamente"'}
            </button>
          </div>
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

      {esTallerIndividual(curso) ? (
        <TallerRecursos curso={curso} user={user} gestiona={gestiona} onActualizado={(c) => setCurso(c)} />
      ) : (
      <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 className="titulo-seccion">Contenido del curso</h2>
        {gestiona && (
          <button type="button" className="button secondary" onClick={() => setNuevoModuloAbierto(true)}>
            ➕ Nuevo módulo
          </button>
        )}
      </div>

      {grupos.length > 0 ? (
        grupos.map(g => {
          const modsRuta = modulos.filter(m => m.grupo === g).sort((a, b) => (a.orden || 0) - (b.orden || 0))
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
                {(curso.rutas_botones?.[g] || []).length > 0 && (
                  <div className="ruta-botones-extra">
                    {curso.rutas_botones[g].map((b, i) => (
                      <a key={i} className={`button ${b.estilo || 'azul'}`} target="_blank" rel="noopener noreferrer" href={b.url}>
                        {b.texto}
                      </a>
                    ))}
                  </div>
                )}
                {gestiona && (
                  <button type="button" className="button texto" style={{ marginTop: 10 }}
                          onClick={() => setEditandoBotonesRuta(g)}>
                    🔗 Botones de esta ruta
                  </button>
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
                  if (gestiona || tieneAcceso) {
                    if (primerModulo) navigate(`/modulo/${primerModulo.id}`)
                    else alert('Esta ruta aún no tiene módulos abiertos.')
                  } else if (!user) {
                    navigate(rutaAcceso(`/curso/${id}`))
                  } else {
                    alert('Tu cuenta aún no tiene acceso a esta ruta. Escríbeme por WhatsApp y lo vemos.')
                  }
                }}>
                  {gestiona || tieneAcceso ? 'Ir al contenido →' : 'Ya estoy inscrito'}
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
          <div className="modulo-grid">{modsSinGrupo.map((m, i) => renderModulo(m, i))}</div>
        </section>
      )}
      </>
      )}

      {/* Foro del curso: solo quien tiene acceso al curso (o el admin).
          El RLS es lo que de verdad protege los datos; ocultar la puerta
          de entrada evita el susto de entrar y no ver nada. */}
      {(gestiona || (user && tieneAcceso)) && (
        <section className="foro-acceso">
          <div>
            <h2 className="titulo-seccion" style={{ marginBottom: 4 }}>Foro del curso</h2>
            <p className="nota" style={{ margin: 0 }}>
              Dudas, comentarios y conversación con el resto del grupo.
            </p>
          </div>
          <Link to={`/foro/${curso.id}`} className="button secondary">💬 Entrar al foro</Link>
        </section>
      )}

      {user && tieneAcceso && (
        <TareasAlumno cursoId={curso.id} user={user} miGrupo={miGrupo} />
      )}

      {/* Mismo patron que el foro: la gestion vive donde esta el
          contenido, no en un panel aparte. El panel central sigue
          existiendo para cuando quieras verlo todo junto. */}
      {gestiona && (
        <section className="bloque-foro">
          <div>
            <h2 className="titulo-seccion" style={{ marginBottom: 4 }}>Exámenes del curso</h2>
            <p className="nota" style={{ margin: 0 }}>
              Crea o edita el examen del curso y los de cada módulo.
            </p>
          </div>
          <button type="button" className="button secondary"
                  onClick={() => setExamenesAbierto(true)}>
            📝 Administrar exámenes
          </button>
        </section>
      )}

      {/* El avance del grupo vive dentro del curso y no en el panel:
          es informacion de ESTE grupo, y un facilitador no entra al
          panel central. */}
      {gestiona && (
        <section className="bloque-foro">
          <div>
            <h2 className="titulo-seccion" style={{ marginBottom: 4 }}>Avance del grupo</h2>
            <p className="nota" style={{ margin: 0 }}>
              Quién va atrasado, quién no ha entrado y cómo salieron en los exámenes.
            </p>
          </div>
          <button type="button" className="button secondary"
                  onClick={() => setProgresoAbierto(true)}>
            📊 Ver avance
          </button>
        </section>
      )}

      {gestiona && (
        <section className="bloque-foro">
          <div>
            <h2 className="titulo-seccion" style={{ marginBottom: 4 }}>Tareas del curso</h2>
            <p className="nota" style={{ margin: 0 }}>
              Entregas que el alumno sube aquí y tú calificas, con rúbrica o sin ella.
            </p>
          </div>
          <button type="button" className="button secondary"
                  onClick={() => setTareasAbierto(true)}>
            📥 Administrar tareas
          </button>
        </section>
      )}

      {gestiona && (
        <section className="bloque-foro">
          <div>
            <h2 className="titulo-seccion" style={{ marginBottom: 4 }}>Generaciones</h2>
            <p className="nota" style={{ margin: 0 }}>
              Cada edición del curso con sus fechas y su cupo, para medir por grupo.
            </p>
          </div>
          <button type="button" className="button secondary"
                  onClick={() => setGeneracionesAbierto(true)}>
            🗓️ Administrar generaciones
          </button>
        </section>
      )}

      {generacionesAbierto && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setGeneracionesAbierto(false)}>
            <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
                 style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <h2>Generaciones · {curso.titulo}</h2>
              <AdminGeneraciones cursoId={curso.id} />
              <div className="modal-botones">
                <button type="button" className="button secondary"
                        onClick={() => setGeneracionesAbierto(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {tareasAbierto && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setTareasAbierto(false)}>
            <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
                 style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <h2>Tareas · {curso.titulo}</h2>
              <AdminTareas cursoId={curso.id} />
              <div className="modal-botones">
                <button type="button" className="button secondary"
                        onClick={() => setTareasAbierto(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {progresoAbierto && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setProgresoAbierto(false)}>
            <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
                 style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <h2>Avance · {curso.titulo}</h2>
              <PanelProgreso cursoId={id} />
              <div className="modal-botones">
                <button type="button" className="button secondary"
                        onClick={() => setProgresoAbierto(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {examenesAbierto && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setExamenesAbierto(false)}>
            <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
                 style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <AdminExamenes cursoFijo={curso.id} />
              <div className="modal-botones">
                <button type="button" className="button secondary"
                        onClick={() => setExamenesAbierto(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {confirmacion && (
        <ModalPortal>
        <div className="modal-overlay">
          <div className="modal-box modal-confirm">
            <h3>Confirmar</h3>
            <p>{confirmacion.mensaje}</p>
            <div className="modal-botones">
              <button type="button" className="button secondary" onClick={confirmacion.onCancel}>
                {confirmacion.botonCancelar || 'Cancelar'}
              </button>
              <button type="button" className="button primary" onClick={confirmacion.onConfirm}>
                {confirmacion.botonConfirmar || 'Sí, continuar'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {msgNotificacion && (
        <div className="notificacion-toast">
          {msgNotificacion}
          <button type="button" onClick={() => setMsgNotificacion('')}>×</button>
        </div>
      )}

      {nuevoModuloAbierto && (
        <ModalNuevoModulo
          cursoId={curso.id}
          orden={modulos.length ? Math.max(...modulos.map(m => m.orden || 0)) + 10 : 100}
          onClose={() => setNuevoModuloAbierto(false)}
          onCreado={(m) => { setModulos(prev => [...prev, m]); navigate(`/modulo/${m.id}`) }}
        />
      )}

      {editandoBotonesRuta && (
        <ModalEditarBotonesRuta
          curso={curso}
          grupo={editandoBotonesRuta}
          onClose={() => setEditandoBotonesRuta(null)}
          onGuardado={(c) => setCurso(c)}
        />
      )}

      <BandaRedes />
    </section>
  )
}

export default CursoView
