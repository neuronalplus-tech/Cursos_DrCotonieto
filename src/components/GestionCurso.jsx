/* ============================================================
   CENTRO DE GESTIÓN · UN CURSO
   ------------------------------------------------------------
   Todo lo de un curso, en tarjetas que se abren (SECCIONES_CURSO,
   lib/gestion.js). Cada tarjeta usa el MISMO editor que ya existía
   dentro del curso o en el panel (AdminExamenes, AdminForo,
   ModalEditarRecurso…): no hay dos maneras de editar lo mismo, solo
   un sitio nuevo desde donde llegar.

   Una tarjeta pesada (foro, exámenes, avance) solo se monta al
   abrirla: abrir el Centro no descarga ni consulta nada que no se
   vaya a mirar.

   A la derecha, «Así se ve la página»: las secciones fijas de la
   página pública y cuáles están vacías (y por tanto no se muestran
   al alumno). Lo que se añada aquí cae en su sección exacta.
   ============================================================ */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { esTallerIndividual, esCursoProblemasContemporaneos, cursoEspecial } from '../lib/helpers'
import { useContenido, tieneDetalles } from '../lib/contenido'
import {
  ESTADOS, estadoCurso, estadoModulo, estadoRecurso, agruparPorCategoria, claseFormato, FORMATOS, PERFILES,
} from '../lib/estructura'
import { SECCIONES_CURSO, elementosDeSeccion, llenadoPagina, resumenMateriales } from '../lib/gestion'
import { useGestion, BarraVerComo, Insignia } from './CentroGestion'
import { Breadcrumb } from './ui'
import { ModalEditarBotonesRuta, ModalNuevoModulo, ModalEditarModulo, ModalEditarBotonesModulo } from './AdminModales'
import { ModalEditarRecurso } from './RecursosModulo'

const AdminExamenes = lazy(() => import('./AdminExamenes'))
const AdminTareas = lazy(() => import('./AdminTareas'))
const AdminForo = lazy(() => import('./AdminForo'))
const AdminGeneraciones = lazy(() => import('./AdminGeneraciones'))
const Participantes = lazy(() => import('./Participantes'))
const PanelProgreso = lazy(() => import('./PanelProgreso'))
const GestionConstancia = lazy(() => import('./GestionConstancia'))
const ModalEditarTaller = lazy(() => import('./TallerRecursos').then((m) => ({ default: m.ModalEditarTaller })))

export default function GestionCurso({ user }) {
  const { id } = useParams()
  const g = useGestion(user)
  // Para saber si el curso tiene página de detalles (sus textos viven
  // en contenido_sitio).
  useContenido(g.orgId)
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [recursos, setRecursos] = useState([])
  const [temasForo, setTemasForo] = useState(0)
  const [tareas, setTareas] = useState(0)
  const [estado, setEstado] = useState('cargando')
  const [abiertas, setAbiertas] = useState(() => new Set())

  useEffect(() => {
    if (!g.cargado || !g.puedeEntrar) return
    let vivo = true
    ;(async () => {
      const { data: c, error } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
      if (!vivo) return
      if (error) { setEstado('error:' + error.message); return }
      if (!c) { setEstado('no-existe'); return }
      setCurso(c)
      const { data: mods } = await supabase.from('modulos').select('*').eq('curso_id', id).eq('activo', true).order('orden')
      const idsMod = (mods || []).map((m) => m.id)
      const [{ data: rs }, { count: nTemas }, { count: nTareas }] = await Promise.all([
        idsMod.length ? supabase.from('recursos').select('*').in('modulo_id', idsMod).order('orden') : { data: [] },
        supabase.from('foro_hilos').select('id', { count: 'exact', head: true }).eq('curso_id', id),
        supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('curso_id', id),
      ])
      if (!vivo) return
      setModulos(mods || []); setRecursos(rs || [])
      setTemasForo(nTemas || 0); setTareas(nTareas || 0)
      setEstado('ok')
    })()
    return () => { vivo = false }
  }, [id, g.cargado, g.puedeEntrar])

  if (!user) return <div className="contenedor"><p className="aviso-error">Inicia sesión para gestionar.</p></div>
  if (!g.cargado || estado === 'cargando') return <div className="loading">Cargando…</div>
  if (!g.puedeEntrar) return <div className="contenedor"><p className="aviso-error">Tu cuenta no puede gestionar cursos.</p></div>
  if (estado === 'no-existe') return <div className="contenedor"><p className="aviso-error">Ese curso no existe o no lo puedes ver.</p></div>
  if (estado.startsWith('error:')) return <div className="contenedor"><p className="aviso-error">No se pudo cargar: {estado.slice(6)}</p></div>

  // Misma regla que CursoView: solo el taller individual usa la página de taller.
  const taller = esTallerIndividual(curso)
  const alternar = (clave) => setAbiertas((s) => { const n = new Set(s); n.has(clave) ? n.delete(clave) : n.add(clave); return n })
  const conDetalles = tieneDetalles(curso, cursoEspecial(curso))
  const pagina = llenadoPagina({ curso, modulos, recursos, temasForo, tareas, tieneDetalles: conDetalles })
  const quien = g.perfilComo?.nombre

  const resumenDe = {
    info: ESTADOS[estadoCurso(curso)].etiqueta,
    modulos: taller ? 'Registro, grabación, materiales y enlaces del taller' : `${modulos.length} módulos · ${recursos.length} materiales`,
    botones: taller ? 'Se editan con los enlaces del taller' : `${Object.values(curso.rutas_botones || {}).flat().length + modulos.reduce((n, m) => n + (m.botones_extra || []).length, 0)} botones`,
    constancia: (taller ? curso.constancia_gratuita_activa === true : curso.constancia !== false)
      ? 'Visible para los participantes' : 'Oculta para los participantes',
    tareas: `${tareas} tareas del curso`,
    foro: temasForo ? `${temasForo} temas` : 'Sin temas: el alumno no ve el foro',
  }
  const vacia = { modulos: !taller && modulos.length === 0, tareas: tareas === 0, foro: temasForo === 0 }

  const contenidoDe = (clave) => {
    switch (clave) {
      case 'info': return <FormInfo curso={curso} onGuardado={setCurso} />
      case 'modulos': return taller
        ? <TallerAqui curso={curso} onGuardado={(c) => setCurso((x) => ({ ...x, ...c }))} />
        : <ListaModulos curso={curso} modulos={modulos} setModulos={setModulos} recursos={recursos} setRecursos={setRecursos} />
      case 'botones': return taller
        ? <TallerAqui curso={curso} onGuardado={(c) => setCurso((x) => ({ ...x, ...c }))} />
        : <Botones curso={curso} setCurso={setCurso} modulos={modulos} setModulos={setModulos} />
      case 'constancia': return <GestionConstancia curso={curso} onGuardado={(c) => setCurso((x) => ({ ...x, ...c }))} />
      case 'examenes': return <AdminExamenes cursoFijo={curso.id} />
      case 'tareas': return <AdminTareas cursoId={curso.id} />
      case 'foro': return <AdminForo user={user} cursoFijo={curso.id} />
      case 'generaciones': return <AdminGeneraciones cursoId={curso.id} />
      case 'participantes': return <Participantes cursoId={curso.id} user={user} />
      case 'avance': return <PanelProgreso cursoId={curso.id} />
      default: return null
    }
  }

  return (
    <section className="contenedor gestion">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Centro de gestión', to: `/gestion${g.sufijo}` }, { label: curso.titulo }]} />
      <div className="gestion-cabecera">
        <div>
          <p className="gestion-tipo">{taller ? '🎟️ Taller' : '📘 Curso'}{curso.linea ? ` · ${curso.linea}` : ''}</p>
          <h1>{curso.titulo} <Insignia estado={estadoCurso(curso)} /></h1>
        </div>
        <div className="gestion-acciones">
          <Link className="button secondary" to={`/curso/${curso.id}`}>Ver la página ↗</Link>
          {/* La página de detalles la edita quien administra, con el lápiz ✏️. */}
          {g.esAdminOrg && (
            <Link className="button secondary" to={`/curso/${curso.id}/detalles`}>
              {conDetalles ? 'Página de detalles ↗' : '➕ Crear página de detalles'}
            </Link>
          )}
        </div>
      </div>

      <BarraVerComo g={g} />

      <div className="gestion-curso">
        <div className="gestion-secciones">
          {SECCIONES_CURSO.map((s) => {
            const permitida = g.secciones.has(s.clave)
            // Fuera de «ver como», lo que no puedes editar no se enseña.
            if (!permitida && !g.perfilComo) return null
            const abierta = permitida && abiertas.has(s.clave)
            const elementos = elementosDeSeccion(s.clave, g.ctx)
            return (
              <article key={s.clave} className={`gestion-seccion${permitida ? '' : ' bloqueada'}${abierta ? ' abierta' : ''}`}>
                <button type="button" className="gestion-seccion-cabeza" aria-expanded={abierta}
                  disabled={!permitida} onClick={() => alternar(s.clave)}>
                  <span className="gestion-seccion-icono" aria-hidden="true">{permitida ? s.icono : '🔒'}</span>
                  <span className="gestion-seccion-textos">
                    <span className="gestion-seccion-nombre">{s.nombre}</span>
                    <span className="gestion-seccion-resumen">
                      {permitida ? (resumenDe[s.clave] || s.ayuda) : `${quien} no puede editar esto`}
                    </span>
                  </span>
                  {permitida && vacia[s.clave] && <span className="badge neutro">Vacía</span>}
                  {permitida && <span className="gestion-seccion-flecha" aria-hidden="true">{abierta ? '▲' : '▼'}</span>}
                </button>
                {g.perfilComo && (
                  <ul className="gestion-seccion-permisos">
                    {elementos.map((e) => (
                      <li key={e.clave} className={e.permitido ? 'si' : 'no'}>{e.permitido ? '✓' : '✗'} {e.nombre}</li>
                    ))}
                  </ul>
                )}
                {abierta && (
                  <div className="gestion-seccion-cuerpo">
                    <p className="nota">{s.ayuda}</p>
                    {/* Tarjeta abierta a medias (p. ej. Docente en Generaciones:
                        pasa lista, pero no crea generaciones): se dice. */}
                    {elementos.some((e) => !e.permitido) && (
                      <p className="aviso-info">
                        Aquí {quien ? `${quien} puede` : 'puedes'}: {elementos.filter((e) => e.permitido).map((e) => e.nombre.toLowerCase()).join(' · ')}.
                        {' '}No: {elementos.filter((e) => !e.permitido).map((e) => e.nombre.toLowerCase()).join(' · ')}.
                      </p>
                    )}
                    <Suspense fallback={<div className="loading">Cargando…</div>}>{contenidoDe(s.clave)}</Suspense>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <aside className="gestion-mapa" aria-label="Así se ve la página">
          <h2>Así se ve la página</h2>
          <p className="nota">Secciones fijas, en este orden. Las vacías no se muestran al alumno; lo que añadas cae en su lugar.</p>
          <h3>Página del curso</h3>
          <ol>
            {pagina.curso.map((s) => (
              <li key={s.clave} className={s.lleno ? 'lleno' : 'vacio'}>
                <span aria-hidden="true">{s.lleno ? '●' : '○'}</span> {s.nombre}
                <span className="gestion-mapa-nota">{s.lleno ? s.contiene : 'Vacía · no se muestra'}</span>
              </li>
            ))}
          </ol>
          {!taller && (
            <>
              <h3>Cada módulo</h3>
              <ol>
                {pagina.modulo.map((s) => (
                  <li key={s.clave} className={s.lleno === false ? 'vacio' : 'lleno'}>
                    <span aria-hidden="true">{s.lleno === false ? '○' : '●'}</span> {s.nombre}
                    <span className="gestion-mapa-nota">{s.lleno === false ? 'Ningún módulo la usa' : s.contiene}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {g.esAdminOrg && !g.perfilComo && (
            <p className="nota">¿Quién más puede editar este curso? <Link to="/gestion?ver=permisos">Permisos por perfil</Link> ·{' '}
              {PERFILES.slice(1).map((p, i) => (
                <span key={p.clave}>{i > 0 && ' · '}<Link to={`?como=${p.clave}`}>ver como {p.nombre}</Link></span>
              ))}
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------
   INFORMACIÓN Y ESTADO
   ------------------------------------------------------------ */
function FormInfo({ curso, onGuardado }) {
  const [f, setF] = useState({
    titulo: curso.titulo || '', descripcion: curso.descripcion || '', info_curso: curso.info_curso || '',
    estado: estadoCurso(curso),
  })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const campo = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const guardar = async () => {
    if (!f.titulo.trim()) { setMsg({ tipo: 'error', texto: 'El título es obligatorio.' }); return }
    setGuardando(true); setMsg(null)
    const upd = {
      titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, info_curso: f.info_curso.trim() || null,
      activo: f.estado !== 'archivado', proximamente: f.estado === 'proximamente',
    }
    const { data, error } = await supabase.from('cursos').update(upd).eq('id', curso.id).select().maybeSingle()
    setGuardando(false)
    if (error || !data) { setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + (error?.message || 'la base no lo permitió (permisos).') }); return }
    onGuardado(data)
    setMsg({ tipo: 'ok', texto: 'Guardado. Ya se ve así en la página.' })
  }

  return (
    <div className="gestion-form">
      <label htmlFor="gi-titulo">Título</label>
      <input id="gi-titulo" className="input" value={f.titulo} onChange={(e) => campo('titulo', e.target.value)} />
      <label htmlFor="gi-desc">Descripción (sale bajo el título)</label>
      <textarea id="gi-desc" className="modal-textarea" rows={3} value={f.descripcion} onChange={(e) => campo('descripcion', e.target.value)} />
      <label htmlFor="gi-info">Información adicional (un párrafo por línea)</label>
      <textarea id="gi-info" className="modal-textarea" rows={4} value={f.info_curso} onChange={(e) => campo('info_curso', e.target.value)} />
      <fieldset className="gestion-estado">
        <legend>Estado</legend>
        {['publicado', 'proximamente', 'archivado'].map((k) => (
          <label key={k}><input type="radio" name="gi-estado" checked={f.estado === k} onChange={() => campo('estado', k)} /> {ESTADOS[k].etiqueta}
            <span className="nota"> — {k === 'publicado' ? 'visible y abierto' : k === 'proximamente' ? 'visible, solo con «Me interesa»' : 'fuera del catálogo; se conserva todo'}</span>
          </label>
        ))}
      </fieldset>
      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} role="status">{msg.texto}</p>}
      <button type="button" className="button primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
    </div>
  )
}

/* ------------------------------------------------------------
   TALLER: su material vive en curso_material (protegido)
   ------------------------------------------------------------ */
function TallerAqui({ curso, onGuardado }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div>
      <p>Registro, grabación, materiales y enlaces extra del taller se editan en un solo formulario.
        En la página, cada botón tiene además su 🔒 candado y su 🗑️ papelera.</p>
      <button type="button" className="button primary" onClick={() => setAbierto(true)}>✏️ Editar links y textos del taller</button>
      {abierto && (
        <ModalEditarTaller curso={curso} onClose={() => setAbierto(false)} onGuardado={(c) => { onGuardado(c); setAbierto(false) }} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   MÓDULOS Y MATERIALES
   ------------------------------------------------------------ */
function ListaModulos({ curso, modulos, setModulos, recursos, setRecursos }) {
  const [abiertos, setAbiertos] = useState(() => new Set())
  const [nuevo, setNuevo] = useState(false)
  const [editModulo, setEditModulo] = useState(null)
  const [editRecurso, setEditRecurso] = useState(null) // { recurso, modulo }
  const [ocupado, setOcupado] = useState(null)

  const ordenados = [...modulos].sort((a, b) => (a.orden || 0) - (b.orden || 0))

  const abrirCerrarModulo = async (m) => {
    setOcupado(`m${m.id}`)
    const nuevoValor = m.disponible === false
    const { error } = await supabase.from('modulos').update({ disponible: nuevoValor }).eq('id', m.id)
    setOcupado(null)
    if (error) { alert('No se pudo cambiar: ' + error.message); return }
    setModulos((ms) => ms.map((x) => (x.id === m.id ? { ...x, disponible: nuevoValor } : x)))
  }

  const mover = async (m, dir) => {
    const j = ordenados.findIndex((x) => x.id === m.id)
    const otro = ordenados[j + dir]
    if (!otro) return
    const a = m.orden ?? j, b = otro.orden ?? j + dir
    const [na, nb] = a === b ? [j + dir, j] : [b, a]
    setModulos((ms) => ms.map((x) => (x.id === m.id ? { ...x, orden: na } : x.id === otro.id ? { ...x, orden: nb } : x)))
    const r = await Promise.all([
      supabase.from('modulos').update({ orden: na }).eq('id', m.id),
      supabase.from('modulos').update({ orden: nb }).eq('id', otro.id),
    ])
    const e = r.find((x) => x.error)?.error
    if (e) alert('No se pudo reordenar: ' + e.message)
  }

  const abrirCerrarRecurso = async (r) => {
    const v = r.disponible === false
    const { error } = await supabase.from('recursos').update({ disponible: v }).eq('id', r.id)
    if (error) { alert('No se pudo cambiar: ' + error.message); return }
    setRecursos((rs) => rs.map((x) => (x.id === r.id ? { ...x, disponible: v } : x)))
  }

  const alGuardarRecurso = (data, accion) => setRecursos((rs) =>
    accion === 'creado' ? [...rs, data] : accion === 'eliminado' ? rs.filter((x) => x.id !== data.id) : rs.map((x) => (x.id === data.id ? data : x)))

  return (
    <div className="gestion-modulos">
      <div className="gestion-barra">
        <button type="button" className="button primary" onClick={() => setNuevo(true)}>➕ Nuevo módulo</button>
      </div>
      {ordenados.length === 0 && <p className="sutil">Este curso aún no tiene módulos. Crea el primero.</p>}
      <ol className="gestion-lista">
        {ordenados.map((m, i) => {
          const suyos = recursos.filter((r) => r.modulo_id === m.id).sort((a, b) => (a.orden || 0) - (b.orden || 0))
          const abierto = abiertos.has(m.id)
          return (
            <li key={m.id} className="gestion-modulo">
              <div className="gestion-fila">
                <button type="button" className="gestion-fila-titulo" aria-expanded={abierto}
                  onClick={() => setAbiertos((s) => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}>
                  <span className="modulo-num">{i + 1}</span>
                  <span>
                    <strong>{m.titulo}</strong>{m.grupo && <span className="etiqueta-grupo">{m.grupo}</span>}
                    <span className="gestion-chips">
                      {resumenMateriales(suyos).map((c) => <span key={c.clave} className="gestion-chip">{c.icono} {c.n}</span>)}
                      {!suyos.length && <span className="gestion-chip vacio">Sin materiales</span>}
                    </span>
                  </span>
                </button>
                <Insignia estado={estadoModulo(m)} />
                <div className="gestion-fila-acciones">
                  <button type="button" className="modulo-orden-btn" aria-label={`Subir ${m.titulo}`} disabled={i === 0} onClick={() => mover(m, -1)}>↑</button>
                  <button type="button" className="modulo-orden-btn" aria-label={`Bajar ${m.titulo}`} disabled={i === ordenados.length - 1} onClick={() => mover(m, 1)}>↓</button>
                  <button type="button" className={`candado-toggle ${m.disponible === false ? 'cerrado' : 'abierto'}`} disabled={ocupado === `m${m.id}`}
                    title={m.disponible === false ? 'Abrir a los alumnos' : 'Ocultar a los alumnos'} onClick={() => abrirCerrarModulo(m)}>
                    {m.disponible === false ? '🔒' : '🔓'}
                  </button>
                  <button type="button" className="recurso-edit-btn" onClick={() => setEditModulo(m)}>✏️ Editar</button>
                  <button type="button" className="recurso-edit-btn" onClick={() => setEditRecurso({ recurso: {}, modulo: m })}>➕ Material</button>
                  <Link className="recurso-edit-btn" to={`/modulo/${m.id}`}>Ver ↗</Link>
                </div>
              </div>
              {abierto && (
                <div className="gestion-materiales">
                  {suyos.length === 0 && <p className="sutil">Sin materiales. Usa «➕ Material».</p>}
                  {agruparPorCategoria(suyos).map(({ categoria, recursos: lista }) => (
                    <div key={categoria.clave}>
                      <h4 className="gestion-cat">{categoria.icono} {categoria.nombre}</h4>
                      <ul>
                        {lista.map((r) => (
                          <li key={r.id} className={`gestion-material ${claseFormato(r.tipo)}`}>
                            <span className="gestion-formato" title={FORMATOS[r.tipo]?.nombre}>{FORMATOS[r.tipo]?.icono || '📌'}</span>
                            <span className="gestion-material-titulo">{r.titulo}</span>
                            {estadoRecurso(r) === 'oculto' && <Insignia estado="oculto" />}
                            <button type="button" className={`candado-toggle ${r.disponible === false ? 'cerrado' : 'abierto'}`}
                              title={r.disponible === false ? 'Abrir a los alumnos' : 'Ocultar a los alumnos'} onClick={() => abrirCerrarRecurso(r)}>
                              {r.disponible === false ? '🔒' : '🔓'}
                            </button>
                            <button type="button" className="recurso-edit-btn" onClick={() => setEditRecurso({ recurso: r, modulo: m })}>✏️ Editar</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {nuevo && (
        <ModalNuevoModulo cursoId={curso.id}
          orden={modulos.length ? Math.max(...modulos.map((m) => m.orden || 0)) + 10 : 100}
          onClose={() => setNuevo(false)} onCreado={(m) => { setModulos((ms) => [...ms, m]); setNuevo(false) }} />
      )}
      {editModulo && (
        <ModalEditarModulo modulo={editModulo} modulos={modulos} onClose={() => setEditModulo(null)}
          onGuardado={(m) => setModulos((ms) => ms.map((x) => (x.id === m.id ? { ...x, ...m } : x)))} />
      )}
      {editRecurso && (
        <ModalEditarRecurso recurso={editRecurso.recurso} moduloId={editRecurso.modulo.id} curso={curso} modulo={editRecurso.modulo}
          onClose={() => setEditRecurso(null)} onGuardado={alGuardarRecurso} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   BOTONES: de cada ruta y de cada módulo
   ------------------------------------------------------------ */
function Botones({ curso, setCurso, modulos, setModulos }) {
  const [ruta, setRuta] = useState(null)
  const [modulo, setModulo] = useState(null)
  const grupos = [...new Set(modulos.map((m) => m.grupo).filter(Boolean))]
  const activos = (lista) => (lista || []).filter((b) => b.activo !== false).length

  return (
    <div className="gestion-botones">
      {grupos.length > 0 && (
        <>
          <h4 className="gestion-cat">Botones de cada ruta</h4>
          <ul className="gestion-lista-simple">
            {grupos.map((gr) => {
              const lista = curso.rutas_botones?.[gr] || []
              return (
                <li key={gr}>
                  <span><strong>Ruta {gr}</strong> · {lista.length} botones ({activos(lista)} visibles)</span>
                  <button type="button" className="recurso-edit-btn" onClick={() => setRuta(gr)}>✏️ Editar</button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <h4 className="gestion-cat">Botones de cada módulo</h4>
      {modulos.length === 0 && <p className="sutil">Sin módulos todavía.</p>}
      <ul className="gestion-lista-simple">
        {[...modulos].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((m) => {
          const lista = (m.botones_extra || []).filter((b) => b.tipo !== 'entregables')
          return (
            <li key={m.id}>
              <span><strong>{m.titulo}</strong> · {lista.length ? `${lista.length} botones (${activos(lista)} visibles)` : 'sin botones'}</span>
              <button type="button" className="recurso-edit-btn" onClick={() => setModulo(m)}>✏️ Editar</button>
            </li>
          )
        })}
      </ul>
      {ruta && (
        <ModalEditarBotonesRuta curso={curso} grupo={ruta} onClose={() => setRuta(null)} onGuardado={(c) => setCurso(c)} />
      )}
      {modulo && (
        <ModalEditarBotonesModulo modulo={modulo} incluirEntregables={esCursoProblemasContemporaneos(curso)}
          onClose={() => setModulo(null)} onGuardado={(m) => setModulos((ms) => ms.map((x) => (x.id === m.id ? m : x)))} />
      )}
    </div>
  )
}
