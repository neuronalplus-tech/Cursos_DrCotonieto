/* ============================================================
   FORO DEL CURSO — vista del alumno
   ------------------------------------------------------------
   · Solo lectura de hilos: el admin es el único que los abre.
   · Cualquier inscrito responde sin pedir permiso.
   · Las respuestas nuevas aparecen solas (Supabase Realtime).
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanear, resumen, esTextoPlano, aTextoPlano } from '../lib/foro'
import { rutaAcceso, WHATSAPP, wa, FOTO_PERFIL } from '../config'
import { Breadcrumb, BandaRedes, NavegacionFlotante } from './ui'
import EditorForo from './EditorForo'
import AdminForoModal from './AdminForoModal'

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

// Nombre de canal de Realtime único por suscripción.
//
// `supabase.channel(tema)` reutiliza el canal existente con ese tema y
// `.on(...)` lanza si ya está suscrito. Con un contador, cada montaje pide
// un canal distinto y no puede chocar con el anterior mientras el suyo se
// está cerrando (removeChannel es asíncrono).
let CANAL_FORO = 0

/* ------------------------------------------------------------
   TARJETA DE RESPUESTA
   ------------------------------------------------------------ */
function Respuesta({ r, propio, esAdmin, onBorrar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(r.cuerpo || '')
  const [guardando, setGuardando] = useState(false)
  // `sanear()` recorre el DOM: se memoriza por respuesta para no repetirlo
  // en cada tecla que se escribe en el editor de abajo. Sin esto, con un
  // tema pesado cada pulsación re-saneaba TODAS las respuestas y la vista
  // del hilo se sentía congelada.
  const cuerpoSano = useMemo(() => sanear(r.cuerpo), [r.cuerpo])

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
          <div className="foro-texto" dangerouslySetInnerHTML={{ __html: cuerpoSano }} />
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
  // Los resúmenes se memorizan por lista: `resumen()` sanea cada cuerpo,
  // y sin esto cada tecla del editor re-saneaba TODOS los temas.
  const items = useMemo(
    () => hilos.map((h) => ({ h, txt: h.cuerpo ? resumen(h.cuerpo) : '' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hilos.map((h) => `${h.id}:${(h.cuerpo || '').length}`).join('|')],
  )
  if (!items.length) {
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
      {items.map(({ h, txt }) => (
        <button key={h.id} type="button" className={`foro-hilo${h.fijado ? ' fijado' : ''}`}
                onClick={() => abrir(h.id)}>
          <div className="foro-hilo-cab">
            {h.fijado && <span className="foro-insignia" title="Fijado">📌 Fijado</span>}
            {h.cerrado && <span className="foro-insignia cerrado" title="Cerrado">🔒 Cerrado</span>}
            <strong className="foro-hilo-titulo">{h.titulo}</strong>
          </div>
          {txt ? <p className="foro-hilo-resumen">{txt}</p> : null}
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

  // `user` es un objeto NUEVO en cada refresco de sesión aunque sea la misma
  // persona. Si los efectos dependieran de `user`, se repetirían sin necesidad
  // (recargas + re-suscripciones a Realtime). Se depende del id, que es estable.
  const uid = user?.id
  const uemail = user?.email

  const [curso, setCurso] = useState(null)
  const [hilos, setHilos] = useState([])
  const [respuestas, setRespuestas] = useState([])
  const [hiloId, setHiloId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [perfil, setPerfil] = useState({ nombre: '', email: '', foto: null })
  const [adminForoAbierto, setAdminForoAbierto] = useState(false)
  const [borrando, setBorrando] = useState(false)

  const [nuevo, setNuevo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const finRef = useRef(null)

  /* --- Identidad: el nombre sale del perfil, y si no, del correo. --- */
  useEffect(() => {
    if (!uid) return
    const id = uid
    const correo = uemail
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from('perfiles')
        .select('nombre_completo, avatar_url')
        .eq('id', id)
        .maybeSingle()
      if (!vivo) return
      setPerfil({
        nombre: data?.nombre_completo || correo || 'Participante',
        email: correo || '',
        foto: data?.avatar_url || null,
      })
    })()
    return () => { vivo = false }
  }, [uid, uemail])

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
    if (!uid) { navigate(rutaAcceso(`/foro/${cursoId}`)); return }
    let vivo = true
    setCargando(true)
    cargar().catch(() => { if (vivo) setError('No se pudo cargar el foro.') })
    return () => { vivo = false }
    // cargar() se redefine en cada render, pero NO es dependencia: meterla
    // aquí repetiría la carga en cada render (cargar → setHilos → render →
    // cargar → …) y congelaría la vista del hilo. Solo curso/usuario recargan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId, uid])

  /* ------------------------------------------------------------
     Tiempo real: las respuestas nuevas aparecen solas.

     POR QUÉ ESTÁ ESCRITO ASÍ (fue la causa de la pantalla en blanco):

     1. `supabase.channel(tema)` REUTILIZA el canal si ya existe uno con
        ese tema, y `.on(...)` LANZA una excepción si el canal ya está
        suscrito:
            "cannot add postgres_changes callbacks for ... after subscribe()"
        Como la limpieza (`supabase.removeChannel`) es ASÍNCRONA, al
        repetirse el efecto (cambia el usuario, cambia la lista de temas,
        se vuelve a entrar al foro…) `channel('foro-' + cursoId)` devolvía
        el canal anterior todavía vivo y `.on()` explotaba. Un error
        lanzado dentro de un useEffect no se puede recuperar: React
        desmonta la página ENTERA y queda en blanco.

        Solución: un nombre de canal único por suscripción, así cada
        efecto tiene su canal y su propia limpieza.

     2. El callback usa `cargarRef`, no `cargar` directo: así el canal
        (creado una sola vez) llama siempre a la versión fresca de
        `cargar`, sin obligar a re-suscribir cuando cambian los temas.

     3. El filtro anterior `hilo_id=in.` + ids.join(',') estaba mal
        formado: el cliente exige `in.(1,2,3)`. Se quita el filtro de
        respuestas: la RLS decide qué filas puede ver este usuario, y el
        foro solo muestra las de ESTE curso, así que no se filtra por
        hilo. Además, filtrar por ids obligaría a re-suscribir cada vez
        que se abre un tema nuevo (justo el camino que rompía).
     ------------------------------------------------------------ */
  const cargarRef = useRef(cargar)
  useEffect(() => { cargarRef.current = cargar })

  useEffect(() => {
    if (!uid || !cursoId) return
    let vivo = true
    const avisar = () => { if (vivo) cargarRef.current() }

    // Tema único por suscripción (usa el contador CANAL_FORO): el cliente
    // reutiliza el canal con el mismo tema y `.on()` lanza si ya está
    // suscrito. Con tema fijo, repetir el efecto (p. ej. objeto `user` nuevo
    // con el mismo id tras refrescar el token) encontraba el canal viejo aún
    // vivo y explotaba dentro del useEffect → React desmontaba todo (pantalla
    // blanca). Con tema único cada efecto tiene su canal y su limpieza, y al
    // depender de `uid` (string estable) ni siquiera se repite sin necesidad.
    const canal = supabase
      .channel(`foro-${cursoId}-${++CANAL_FORO}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'foro_hilos',
        filter: 'curso_id=eq.' + cursoId,
      }, avisar)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'foro_respuestas',
      }, avisar)
      .subscribe()

    return () => {
      vivo = false
      if (canal) {
        try { supabase.removeChannel(canal) } catch { /* ya estaba cerrado */ }
      }
    }
  }, [uid, cursoId])

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
      hilo_id: hiloId,
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
  // El hilo abierto y sus respuestas se derivan del estado. NUNCA pasar
  // por setState dentro de un efecto/lectura: antes `abierto` era un
  // objeto `{ id }` nuevo en cada clic y un efecto lo reescribía, lo que
  // en la vista del hilo provocaba re-renders en cadena (congelamiento).
  // Ahora `hiloId` es un primitivo (número|null) y esta lectura es pura.
  const hiloActual = hiloId != null ? hilos.find((h) => h.id === hiloId) : null
  const delHilo = hiloId != null ? respuestas.filter((r) => r.hilo_id === hiloId) : []
  // El cuerpo del tema se sanea UNA vez por tema abierto, no en cada
  // render: con HTML pesado, sanear en el JSX congelaba la vista al
  // escribir cada letra en el editor de respuesta.
  const cuerpoDelHilo = hiloActual?.cuerpo
  const cuerpoHiloSano = useMemo(
    () => (cuerpoDelHilo ? sanear(cuerpoDelHilo) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiloId, cuerpoDelHilo],
  )
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1>Foro · {curso?.titulo || 'Curso'}</h1>
            {esAdmin && (
              <button type="button" className="button primary" onClick={() => setAdminForoAbierto(true)}>
                🔧 Administrar foro
              </button>
            )}
          </div>
          <p className="seccion-intro">
            Espacio de duda y reflexión del grupo. Solo tú y las personas inscritas
            en este curso pueden leerlo.
          </p>
          <ListaHilos hilos={hilos} abrir={(id) => setHiloId(id)} totalRespuestas={conteo} />
        </>
      ) : (
        <>
          <button type="button" className="enlace-texto" style={{ marginBottom: 14 }}
                  onClick={() => { setHiloId(null); setAviso(null) }}>
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
                 dangerouslySetInnerHTML={{ __html: cuerpoHiloSano }} />
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

      {adminForoAbierto && (
        <AdminForoModal
          cursoId={cursoId}
          user={user}
          onClose={() => setAdminForoAbierto(false)}
        />
      )}

      <BandaRedes />
    </section>
  )
}

export default ForoCurso