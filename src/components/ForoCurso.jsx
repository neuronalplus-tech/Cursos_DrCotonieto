/* ============================================================
   FORO DEL CURSO — vista del alumno
   ------------------------------------------------------------
   · Solo lectura de hilos: el admin es el único que los abre.
   · Cualquier inscrito responde sin pedir permiso.
   · Las respuestas nuevas aparecen solas (Supabase Realtime).
   ============================================================ */

import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanear, resumen, esTextoPlano } from '../lib/foro'
import { rutaAcceso, FOTO_PERFIL } from '../config'
import { Breadcrumb, BandaRedes, NavegacionFlotante } from './ui'
import EditorForo from './EditorForo'

/** "hace 5 min", "ayer", "12 de marzo": sin librerías de fechas. */
function haceCuanto(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha)
  const seg = (Date.now() - d.getTime()) / 1000
  if (seg < 60) return 'hace un momento'
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`
  if (seg < 172800) return 'ayer'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

function iniciales(nombre) {
  const p = String(nombre || '?').trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
}

/* ------------------------------------------------------------
   TARJETA DE RESPUESTA
   ------------------------------------------------------------ */
function Respuesta({ r, propio, esAdmin, onBorrar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(r.cuerpo || '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    const { error } = await supabase
      .from('foro_respuestas')
      .update({ cuerpo: sanear(texto), editado: true })
      .eq('id', r.id)
    setGuardando(false)
    if (error) return window.alert('No se pudo guardar: ' + error.message)
    setEditando(false)
  }

  return (
    <article className="foro-respuesta">
      <header className="foro-respuesta-cab">
        {r.autor_foto
          ? <img className="foro-avatar" src={r.autor_foto} alt="" />
          : <span className="foro-avatar foro-inicial" aria-hidden="true">{iniciales(r.autor_nombre)}</span>}
        <div className="foro-respuesta-quien">
          <strong>{r.autor_nombre}</strong>
          {propio && <span className="foro-badge">tú</span>}
          <span className="nota">{haceCuanto(r.creado_en)}</span>
        </div>
      </header>

      {r.borrada ? (
        <p className="nota foro-borrada">Esta respuesta se eliminó.</p>
      ) : editando ? (
        <>
          <EditorForo valor={texto} onChange={setTexto} minAlto={100} />
          <div className="fila-botones">
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="button secondary"
                    onClick={() => { setTexto(r.cuerpo || ''); setEditando(false) }}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <div className="foro-texto" dangerouslySetInnerHTML={{ __html: sanear(r.cuerpo) }} />
          <div className="foro-respuesta-pie">
            {r.editado && <span className="nota">editado</span>}
            {!esTextoPlano(r.cuerpo) && <span className="nota">con formato</span>}
            {(propio || esAdmin) && (
              <span className="foro-acciones">
                {propio && (
                  <button type="button" className="enlace-texto" onClick={() => setEditando(true)}>Editar</button>
                )}
                <button type="button" className="enlace-texto peligro" onClick={() => onBorrar(r)}>Eliminar</button>
              </span>
            )}
          </div>
        </>
      )}
    </article>
  )
}

/* ------------------------------------------------------------
   LISTA DE HILOS
   ------------------------------------------------------------ */
function ListaHilos({ hilos, abrir, totalRespuestas }) {
  if (!hilos.length) {
    return (
      <div className="foro-vacio">
        <p className="bloque-icono">🗨️</p>
        <h3>Todavía no hay temas</h3>
        <p>
          Cuando abras un tema desde el panel de administración aparecerá aquí,
          y los inscritos podrán responder.
        </p>
      </div>
    )
  }

  return (
    <div className="foro-lista">
      {hilos.map((h) => (
        <button key={h.id} type="button" className={`foro-hilo${h.fijado ? ' fijado' : ''}`}
                onClick={() => abrir(h.id)}>
          <div className="foro-hilo-cab">
            {h.fijado && <span className="foro-insignia" title="Fijado">📌 Fijado</span>}
            {h.cerrado && <span className="foro-insignia cerrado" title="Cerrado">🔒 Cerrado</span>}
            <strong className="foro-hilo-titulo">{h.titulo}</strong>
          </div>
          {h.cuerpo ? <p className="foro-hilo-resumen">{resumen(h.cuerpo)}</p> : null}
          <div className="foro-hilo-pie">
            <span className="nota">{h.autor_nombre}</span>
            <span className="nota">·</span>
            <span className="nota">{haceCuanto(h.actualizado_en || h.creado_en)}</span>
            <span className="nota">·</span>
            <span className="nota">{totalRespuestas[h.id] || 0} respuesta(s)</span>
          </div>
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   FORO DEL CURSO — vista del alumno
   ------------------------------------------------------------
   Reglas que.mkimplementa (según el Dr. Ernesto):
   · Con nombre real: cada respuesta guarda nombre y correo del autor.
   · Privado por curso: solo los inscritos entran.
   · Solo el ADMIN abre hilos; cualquier inscrito responde.
   · Texto libre con formato, y también HTML a mano.
   ============================================================ */

export function ForoCurso({ user, esAdmin }) {
  const { cursoId } = useParams()
  const navigate = useNavigate()

  const [curso, setCurso] = useState(null)
  const [hilos, setHilos] = useState([])
  const [respuestas, setRespuestas] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [perfil, setPerfil] = useState({ nombre: '', email: '', foto: null })
  const [borrando, setBorrando] = useState(false)

  const [nuevo, setNuevo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const finRef = useRef(null)

  /* --- Identidad: el nombre sale del perfil, y si no, del correo. --- */
  useEffect(() => {
    if (!user) return
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from('perfiles')
        .select('nombre_completo, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      if (!vivo) return
      setPerfil({
        nombre: data?.nombre_completo || user.email || 'Participante',
        email: user.email || '',
        foto: data?.avatar_url || null,
      })
    })()
    return () => { vivo = false }
  }, [user])

  /* --- Datos del curso, hilos y respuestas --- */
  const cargar = async () => {
    const { data: c } = await supabase
      .from('cursos').select('id, titulo').eq('id', cursoId).maybeSingle()
    setCurso(c)

    const { data: hs } = await supabase
      .from('foro_hilos')
      .select('*')
      .eq('curso_id', cursoId)
      .order('fijado', { ascending: false })
      .order('actualizado_en', { ascending: false })

    const lista = hs || []
    setHilos(lista)

    // RLS ya impide ver hilos de otros cursos, pero se filtra igual por
    // si el script se corrió a medias.
    const ids = lista.map((h) => h.id)
    if (ids.length) {
      const { data: rs } = await supabase
        .from('foro_respuestas')
        .select('*')
        .in('hilo_id', ids)
        .order('creado_en')
      setRespuestas(rs || [])
    } else {
      setRespuestas([])
    }
    setCargando(false)
  }

  useEffect(() => {
    if (!user) { navigate(rutaAcceso(`/foro/${cursoId}`)); return }
    setCargando(true)
    cargar()
  }, [cursoId, user])

  /* --- Tiempo real: las respuestas nuevas aparecen solas --- */
  useEffect(() => {
    if (!user || !hilos.length) return
    const ids = hilos.map((h) => h.id)
    const canal = supabase
      .channel('foro-' + cursoId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'foro_respuestas',
        filter: 'hilo_id=in.' + ids.join(','),
      }, () => { cargar() })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'foro_hilos',
        filter: 'curso_id=eq.' + cursoId,
      }, () => { cargar() })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [user, cursoId, hilos.map((h) => h.id).join(',')])

  /* --- Responder: cualquier inscrito, sin pedir autorización --- */
  const responder = async () => {
    const limpio = sanear(nuevo)
    if (!aTextoPlano(limpio)) {
      setAviso({ tipo: 'error', texto: 'Escribe algo antes de enviar.' })
      return
    }
    setEnviando(true)
    setAviso(null)
    const { error } = await supabase.from('foro_respuestas').insert({
      hilo_id: abierto.id,
      autor_id: user.id,
      autor_nombre: perfil.nombre,
      autor_email: perfil.email,
      cuerpo: limpio,
    })
    setEnviando(false)
    if (error) {
      setAviso({ tipo: 'error', texto: 'No se pudo publicar: ' + error.message })
      return
    }
    setNuevo('')
    setAviso({ tipo: 'ok', texto: 'Respuesta publicada.' })
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const borrarRespuesta = async (r) => {
    if (!window.confirm('¿Eliminar esta respuesta? No se puede deshacer.')) return
    setBorrando(true)
    const { error } = await supabase.from('foro_respuestas').delete().eq('id', r.id)
    setBorrando(false)
    if (error) setAviso({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
  }

  /* --- Derivados --- */
  const hiloActual = abierto ? hilos.find((h) => h.id === abierto.id) : null
  const delHilo = abierto ? respuestas.filter((r) => r.hilo_id === abierto.id) : []
  const conteo = {}
  for (const r of respuestas) {
    if (r.borrada) continue
    conteo[r.hilo_id] = (conteo[r.hilo_id] || 0) + 1
  }

  if (!user) return null
  if (cargando) return <div className="loading">Cargando…</div>

  return (
    <section className="contenedor">
      <Breadcrumb items={[
        { label: 'Inicio', to: '/' },
        ...(curso ? [{ label: curso.titulo, to: `/curso/${cursoId}` }] : []),
        { label: 'Foro' },
      ]} />

      {!hiloActual ? (
        <>
          <h1>Foro · {curso?.titulo || 'Curso'}</h1>
          <p className="seccion-intro">
            Espacio de duda y reflexión del grupo. Solo tú y las personas inscritas
            en este curso pueden leerlo.
          </p>
          <ListaHilos hilos={hilos} abrir={(id) => setAbierto({ id })} totalRespuestas={conteo} />
        </>
      ) : (
        <>
          <button type="button" className="enlace-texto" style={{ marginBottom: 14 }}
                  onClick={() => { setAbierto(null); setAviso(null) }}>
            ← Volver a todos los temas
          </button>

          <article className="foro-hilo-principal">
            <header className="foro-hilo-cab">
              {hiloActual.fijado && <span className="foro-insignia">📌 Fijado</span>}
              {hiloActual.cerrado && <span className="foro-insignia cerrado">🔒 Cerrado</span>}
              <h1>{hiloActual.titulo}</h1>
            </header>
            <div className="foro-respuesta-cab" style={{ marginTop: 14 }}>
              {perfil.foto
                ? <img className="foro-avatar" src={perfil.foto} alt="" />
                : <span className="foro-avatar foro-inicial" aria-hidden="true">{iniciales(hiloActual.autor_nombre)}</span>}
              <div className="foro-respuesta-quien">
                <strong>{hiloActual.autor_nombre}</strong>
                {hiloActual.autor_id === user.id && <span className="foro-badge">tú</span>}
                <span className="nota">{haceCuanto(hiloActual.creado_en)}</span>
              </div>
            </div>
            <div className="foro-texto" style={{ marginTop: 12 }}
                 dangerouslySetInnerHTML={{ __html: sanear(hiloActual.cuerpo) }} />
          </article>

          <h2 className="foro-sub">{delHilo.filter((r) => !r.borrada).length} respuesta(s)</h2>

          <div className="foro-respuestas">
            {delHilo.map((r) => (
              <Respuesta
                key={r.id}
                r={{ ...r, autor_foto: r.autor_id === user.id ? perfil.foto : null }}
                propio={r.autor_id === user.id}
                esAdmin={esAdmin}
                onBorrar={borrarRespuesta}
              />
            ))}
            {!delHilo.length && <p className="nota">Aún no hay respuestas. Sé el primero.</p>}
          </div>
          <div ref={finRef} />

          <div className="foro-responder">
            <h3>{hiloActual.cerrado ? 'Este tema está cerrado' : 'Responder'}</h3>
            {hiloActual.cerrado ? (
              <p className="nota">No se pueden agregar respuestas a un tema cerrado.</p>
            ) : (
              <>
                <p className="nota" style={{ marginBottom: 10 }}>
                  Publicas como <strong>{perfil.nombre}</strong>
                  {perfil.email ? <> · {perfil.email}</> : null}
                </p>
                <EditorForo valor={nuevo} onChange={setNuevo} minAlto={120}
                            placeholder="Escribe tu respuesta…" />
                {aviso && (
                  <p className={aviso.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} style={{ marginTop: 10 }}>
                    {aviso.texto}
                  </p>
                )}
                <button type="button" className="button primary" style={{ marginTop: 12 }}
                        onClick={responder} disabled={enviando || borrando}>
                  {enviando ? 'Publicando…' : 'Publicar respuesta'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      <BandaRedes />
    </section>
  )
}

export default ForoCurso