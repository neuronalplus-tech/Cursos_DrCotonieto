import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  esTallerIndividual, moduloVisible, moduloBloqueadoParaAlumno,
  emiteConstancia, analizarUrl, esCursoProblemasContemporaneos,
  moduloAbiertoPorFecha,
} from '../lib/helpers'
import { BUCKET_PAGO, BUCKET_TALLERES, CONTACTO_EMAIL, AVATAR_BUCKET, ICONO_TIPO, NOMBRE_TIPO, rutaAcceso, FOTO_PERFIL, MARCA } from '../config'
import { TextoEditable, ImagenEditable, BotonEditable } from './Editable'
import { agruparPorCategoria } from '../lib/estructura'
import { usePermisos } from '../lib/permisos'
import { ModalPortal, Breadcrumb, BandaRedes, NavegacionFlotante } from './ui'
import TallerRecursos from './TallerRecursos'
import ExamenModulo from './ExamenModulo'
import AdminTareas from './AdminTareas'
import TareasAlumno from './TareasAlumno'
import MisApuntes from './MisApuntes'
import { ModalEditarBotonesModulo, ModalEditarModulo } from './AdminModales'
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
  const [constanciaDisponible, setConstanciaDisponible] = useState(false)
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
  const [editandoModulo, setEditandoModulo] = useState(false)
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
        // Fecha de apertura/cierre (MODULOS_FECHAS.sql). Sin fechas no
        // cambia nada; el gestor entra siempre.
        if (!gestionaCurso && !moduloAbiertoPorFecha(m)) {
          const abre = m.abre_el ? new Date(m.abre_el) : null
          setError(abre && abre.getTime() > Date.now()
            ? `Este módulo se abre el ${abre.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}.`
            : 'Este módulo ya no está disponible.')
          return
        }

        setModulo(m)
        const { data: c } = await supabase.from('cursos').select('id, titulo, gratuito, constancia, constancia_gratuita_activa').eq('id', m.curso_id).maybeSingle()
        setCurso(c)
        setConstanciaDisponible(false)
        if (user && c && emiteConstancia(c)) {
          const { data: estado } = await supabase.rpc('estado_constancia', { p_curso: Number(c.id) })
          setConstanciaDisponible(!!estado?.disponible)
        }
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

  // Abre el módulo desde la propia pantalla, en vez de pedirle al docente
  // que copie una sentencia SQL (que además dejaba ver la estructura de la
  // base a cualquier facilitador).
  const [abriendoModulo, setAbriendoModulo] = useState(false)
  const abrirModuloParaAlumnos = async () => {
    if (!modulo) return
    setAbriendoModulo(true)
    const { error: e } = await supabase.from('modulos').update({ disponible: true }).eq('id', modulo.id)
    setAbriendoModulo(false)
    if (e) { alert('No se pudo abrir el módulo: ' + e.message); return }
    setModulo(m => ({ ...m, disponible: true }))
  }

  // Reordenar recursos con ↑/↓ (igual que los módulos en CursoView).
  // `lista` es la sección donde está (lecturas, grabaciones…): subir un
  // recurso lo cambia con su vecino de sección, no con uno de otra.
  const moverRecurso = async (r, dir, lista = recursos) => {
    const j = lista.findIndex(x => x.id === r.id)
    const k = j + dir
    if (k < 0 || k >= lista.length) return
    const otro = lista[k]
    const ordenR = r.orden ?? j
    const ordenO = otro.orden ?? k
    const nuevoR = ordenO === ordenR ? k : ordenO
    const nuevoO = ordenO === ordenR ? j : ordenR
    setRecursos(prev => prev
      .map(x => x.id === r.id ? { ...x, orden: nuevoR } : x.id === otro.id ? { ...x, orden: nuevoO } : x)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0)))
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('recursos').update({ orden: nuevoR }).eq('id', r.id),
      supabase.from('recursos').update({ orden: nuevoO }).eq('id', otro.id),
    ])
    if (e1 || e2) window.alert('No se pudo reordenar: ' + (e1 || e2).message)
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
        {!user && (
          <BotonEditable clave="modulo.error.iniciar-sesion" clase="button" defecto={{ texto: 'Iniciar sesión', estilo: 'primary' }}
            onClick={() => navigate(rutaAcceso(`/modulo/${id}`))} />
        )}
        <BotonEditable clave="modulo.error.volver-inicio" clase="button" defecto={{ texto: 'Volver al inicio', estilo: 'secondary' }}
          onClick={() => navigate('/')} />
      </div>
      <BandaRedes />
    </div>
  )
  if (!modulo) return <div className="contenedor"><p className="aviso-error">Módulo no encontrado.</p></div>

  const idx = modulosCurso.findIndex(m => m.id === parseInt(id))
  const prev = idx > 0 ? modulosCurso[idx - 1] : null
  const next = idx >= 0 && idx < modulosCurso.length - 1 ? modulosCurso[idx + 1] : null
  // Lo cerrado no se le enseña al alumno («si no hay, no se despliega»);
  // quien gestiona lo ve con su candado para poder abrirlo.
  const recursosVisibles = gestiona ? recursos : recursos.filter(r => r.disponible !== false)
  const secciones = agruparPorCategoria(recursosVisibles)
  const vistos = recursosVisibles.filter(r => progresoRecursos[r.id]).length
  const bloqueadoParaAlumno = moduloBloqueadoParaAlumno(modulo)
  const mostrarConstancia = emiteConstancia(curso) && constanciaDisponible
  const mostrarDiapositivas = modulo.grupo === 'Acompañamiento' || modulo.grupo === 'Clínica'
  const mostrarEntregables = curso && esCursoProblemasContemporaneos(curso)
  const mostrarJuegoS4 = mostrarEntregables && /sesi[oó]n\s*4/i.test(modulo.titulo || '')
  // Como en la página del curso: el cambio vale para todos los cursos o
  // solo para el de este módulo.
  const deCurso = curso ? {
    ambito: `curso:${curso.id}`,
    etiquetaAmbito: { general: 'todos los cursos', unico: `solo «${curso.titulo}»` },
    datos: { titulo: curso.titulo, modulo: modulo.titulo },
  } : { datos: { modulo: modulo.titulo } }

  return (
    <div className="contenedor">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/' },
        { label: curso?.titulo || 'Curso', to: curso ? `/curso/${curso.id}` : '/' },
        { label: modulo.titulo }
      ]} />

      {gestiona && bloqueadoParaAlumno && (
        <div className="admin-banner">
          <strong>Vista de administrador.</strong> Este módulo aún no está visible para los alumnos.
          {' '}
          <button type="button" className="button secondary" style={{ marginLeft: 8 }}
                  disabled={abriendoModulo}
                  onClick={abrirModuloParaAlumnos}>
            {abriendoModulo ? 'Abriendo…' : 'Abrir para alumnos'}
          </button>
        </div>
      )}

      <div className="modulo-layout">
        <aside className="modulo-sidebar">
          <div className="side-bloque">
            <TextoEditable as="h4" clave="modulo.lateral.modulos" defecto="Módulos del curso" />
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
          {recursosVisibles.length > 0 && (
            <div className="side-bloque">
              <TextoEditable as="h4" clave="modulo.lateral.recursos" defecto="En este módulo" />
              {secciones.map(({ categoria, recursos: lista }) => (
                <div key={categoria.clave}>
                  {secciones.length > 1 && <p className="side-grupo">{categoria.nombre}</p>}
                  <ul className="side-lista compacta">
                    {lista.map((r) => (
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
              ))}
            </div>
          )}
          <div className="side-bloque contacto-bloque">
            {/* Foto y nombre: las mismas claves que el perfil de la portada. */}
            <ImagenEditable clave="perfil.foto" defecto={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="contacto-foto" />
            <TextoEditable as="h4" className="contacto-titulo" clave="modulo.contacto.titulo" {...deCurso}
              defecto="¿Dudas con el material?" />
            <TextoEditable as="p" className="contacto-nombre" clave="perfil.nombre" defecto={MARCA.nombre} />
            <TextoEditable as="p" className="contacto-credencial" clave="modulo.contacto.credencial"
              defecto="Cédula profesional 10521804" />
            <BotonEditable clave="modulo.contacto.whatsapp" clase="button ancho" {...deCurso}
              defecto={{ texto: '💬 Escríbeme', estilo: 'whatsapp', mensaje: 'Hola, tengo una duda sobre el material del aula.' }} />
            <BotonEditable clave="modulo.contacto.correo" clase="button ancho" nuevaPestana={false}
              defecto={{ texto: '✉️ Por correo', estilo: 'secondary', url: `mailto:${CONTACTO_EMAIL}` }} />
          </div>
          <div className="side-bloque atajos">
            <TextoEditable as="h4" clave="modulo.atajos.titulo" defecto="Atajos" />
            <BotonEditable clave="modulo.atajos.inicio" clase="side-atajo" defecto={{ texto: '🏠 Inicio' }} to="/" />
            {curso && (
              <BotonEditable clave="modulo.atajos.curso" clase="side-atajo" defecto={{ texto: '📚 Todo el curso' }}
                to={`/curso/${curso.id}`} />
            )}
            {user && <BotonEditable clave="modulo.atajos.perfil" clase="side-atajo" defecto={{ texto: '👤 Mi perfil' }} to="/perfil" />}
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
            {user && recursosVisibles.length > 0 && (
              <TextoEditable as="p" className="modulo-avance" clave="modulo.avance"
                datos={{ vistos, total: recursosVisibles.length }} defecto="{vistos} de {total} recursos revisados" />
            )}
            {mostrarJuegoS4 && (
              <div className="modulo-botones-extra">
                <BotonEditable clave="modulo.juego-s4" clase="button" {...deCurso}
                  defecto={{ texto: '🎮 Abrir juego de la sesión 4', estilo: 'primary', url: '/juegos/juego-s4.html' }} />
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
              <button type="button" className="button secondary" onClick={() => setEditandoModulo(true)}>
                ✏️ Editar módulo
              </button>
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
            {/* Secciones fijas, en el orden de estructura.js. Una sección
                sin recursos no se pinta: su sitio lo toma la siguiente. */}
            {secciones.map(({ categoria, recursos: lista }) => (
              <section key={categoria.clave} className="material-seccion" aria-label={categoria.nombre}>
                <h2 className="material-seccion-titulo">
                  <span aria-hidden="true">{categoria.icono}</span>
                  <TextoEditable clave={`material.${categoria.clave}.titulo`} defecto={categoria.nombre} />
                  <span className="material-seccion-n">{lista.length}</span>
                </h2>
                {lista.map((r, i) => (
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
                    onMover={(rec, dir) => moverRecurso(rec, dir, lista)}
                    esPrimero={i === 0}
                    esUltimo={i === lista.length - 1}
                  />
                ))}
              </section>
            ))}
            {recursosVisibles.length === 0 && (
              <TextoEditable as="p" className="sutil" clave="modulo.sin-recursos" {...deCurso}
                defecto="Este módulo aún no tiene recursos." />
            )}
          </div>
          <ExamenModulo moduloId={modulo.id} user={user} gestiona={gestiona} etiquetaDestino={`el módulo "${modulo.titulo}"`} />

          <TareasAlumno moduloId={modulo.id} user={user} miGrupo={miGrupo} />

          {/* Bloc de notas privado del alumno (se oculta solo si falta
              correr APUNTES.sql). */}
          {user && <MisApuntes moduloId={modulo.id} user={user} />}

          <nav className="navegacion-modulos">
            {prev
              ? <button className="button secondary" onClick={() => navigate(`/modulo/${prev.id}`)}>← {prev.titulo}</button>
              : <span />}
            {next && <button className="button primary" onClick={() => navigate(`/modulo/${next.id}`)}>{next.titulo} →</button>}
            {!next && user && mostrarConstancia &&
              <BotonEditable clave="modulo.constancia" clase="button constancia-btn" {...deCurso}
                defecto={{ texto: 'Obtener constancia' }} to={`/constancia/${curso.id}`} />}
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

      {editandoModulo && (
        <ModalEditarModulo
          modulo={modulo}
          modulos={modulosCurso}
          onClose={() => setEditandoModulo(false)}
          onGuardado={(m) => setModulo(prev => ({ ...prev, ...m }))}
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
