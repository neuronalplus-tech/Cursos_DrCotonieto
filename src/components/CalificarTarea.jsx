/* ============================================================
   CALIFICAR UNA TAREA
   ------------------------------------------------------------
   Alumno por alumno, con la rúbrica al lado, como en un aula
   virtual. La lista de la izquierda muestra a TODOS los inscritos,
   no solo a quienes entregaron: quien no entregó es justo a quien
   hay que escribirle, y si no aparece no existe.

   Con rúbrica, la nota se calcula sola sumando los criterios y
   queda bloqueada; sin rúbrica, se escribe a mano.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CalificarTarea({ tarea, onCerrar }) {
  const [criterios, setCriterios] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [activo, setActivo] = useState(null)      // usuario_id
  const [puntos, setPuntos] = useState({})        // criterio_id -> puntos
  const [nota, setNota] = useState('')
  const [retro, setRetro] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      try {
        const { data: cs } = await supabase
          .from('rubrica_criterios').select('*').eq('tarea_id', tarea.id).order('orden')

        // El curso de la tarea: puede venir de ella o de su módulo.
        let curso = tarea.curso_id
        if (!curso && tarea.modulo_id) {
          const { data: m } = await supabase
            .from('modulos').select('curso_id').eq('id', tarea.modulo_id).maybeSingle()
          curso = m?.curso_id
        }

        const { data: insc } = await supabase
          .from('acceso').select('usuario_id, grupo').eq('curso_id', curso)
        const ids = [...new Set((insc || []).map(a => a.usuario_id))]

        const { data: perfs } = ids.length
          ? await supabase.from('perfiles').select('id, nombre_completo').in('id', ids)
          : { data: [] }
        const nombre = Object.fromEntries((perfs || []).map(p => [p.id, p.nombre_completo]))

        const { data: ents } = await supabase
          .from('entregas').select('*').eq('tarea_id', tarea.id)
        const porAlumno = Object.fromEntries((ents || []).map(e => [e.usuario_id, e]))

        // Si la tarea es de una ruta, solo cuentan los de esa ruta.
        const lista = (insc || [])
          .filter(a => !tarea.grupo || a.grupo === tarea.grupo)
          .map(a => ({
            id: a.usuario_id,
            nombre: nombre[a.usuario_id] || '(sin nombre)',
            entrega: porAlumno[a.usuario_id] || null,
          }))
          .sort((x, y) => {
            // Primero quien entregó y no está calificado: es lo que hay
            // pendiente de hacer.
            const peso = (p) => (!p.entrega ? 2 : p.entrega.calificado_en ? 1 : 0)
            return peso(x) - peso(y) || x.nombre.localeCompare(y.nombre)
          })

        if (!vivo) return
        setCriterios(cs || [])
        setAlumnos(lista)
        if (lista.length) elegir(lista[0], cs || [])
      } catch (e) {
        if (vivo) setError(e.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarea.id])

  const elegir = (a, cs = criterios) => {
    setActivo(a.id)
    setMsg(null)
    const detalle = a.entrega?.rubrica_detalle || {}
    const p = {}
    for (const c of cs) p[c.id] = detalle[c.id] ?? ''
    setPuntos(p)
    setNota(a.entrega?.calificacion ?? '')
    setRetro(a.entrega?.retroalimentacion || '')
  }

  const alumno = alumnos.find(a => a.id === activo)

  const suma = useMemo(
    () => Object.values(puntos).reduce((s, v) => s + (Number(v) || 0), 0),
    [puntos])

  const notaFinal = criterios.length ? suma : Number(nota) || 0

  const abrirArchivo = async () => {
    if (!alumno?.entrega?.archivo_path) return
    const { data, error: e } = await supabase.storage
      .from('entregas').createSignedUrl(alumno.entrega.archivo_path, 300)
    if (e) return setMsg({ tipo: 'error', texto: 'No se pudo abrir: ' + e.message })
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const guardar = async () => {
    if (!alumno?.entrega) {
      return setMsg({ tipo: 'error', texto: 'Esta persona todavía no ha entregado nada.' })
    }
    setGuardando(true)
    const detalle = {}
    for (const c of criterios) {
      if (puntos[c.id] !== '' && puntos[c.id] != null) detalle[c.id] = Number(puntos[c.id])
    }
    const { data, error: e } = await supabase.from('entregas').update({
      calificacion: notaFinal,
      retroalimentacion: retro.trim() || null,
      rubrica_detalle: criterios.length ? detalle : null,
      calificado_en: new Date().toISOString(),
    }).eq('id', alumno.entrega.id).select().single()
    setGuardando(false)
    if (e) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + e.message })

    setAlumnos(prev => prev.map(a => (a.id === alumno.id ? { ...a, entrega: data } : a)))
    setMsg({ tipo: 'ok', texto: '✓ Calificación guardada' })
  }

  const siguiente = () => {
    const i = alumnos.findIndex(a => a.id === activo)
    const sig = alumnos[i + 1]
    if (sig) elegir(sig)
  }

  if (cargando) return <p className="nota">Cargando entregas…</p>
  if (error) return <p className="aviso-error">No se pudo cargar: {error}</p>
  if (!alumnos.length) return <p className="nota">No hay nadie inscrito en este curso todavía.</p>

  const entregadas = alumnos.filter(a => a.entrega).length
  const calificadas = alumnos.filter(a => a.entrega?.calificado_en).length

  return (
    <div className="calificar">
      <p className="nota">
        {entregadas} de {alumnos.length} entregaron · {calificadas} calificadas
      </p>

      <div className="calificar-cuerpo">
        <aside className="calificar-lista">
          {alumnos.map(a => (
            <button key={a.id} type="button"
                    className={`calificar-alumno ${a.id === activo ? 'activo' : ''}`}
                    onClick={() => elegir(a)}>
              <span className="calificar-nombre">{a.nombre}</span>
              {!a.entrega
                ? <span className="badge inactivo">Sin entrega</span>
                : a.entrega.calificado_en
                  ? <span className="badge ok">{a.entrega.calificacion}</span>
                  : <span className="badge rol-alumno">Pendiente</span>}
            </button>
          ))}
        </aside>

        <div className="calificar-detalle">
          {!alumno ? <p className="nota">Elige a alguien de la lista.</p> : (
            <>
              <h3>{alumno.nombre}</h3>

              {!alumno.entrega ? (
                <p className="aviso-error">Todavía no ha entregado nada.</p>
              ) : (
                <div className="calificar-archivo">
                  <span>📎 {alumno.entrega.archivo_nombre}</span>
                  <button type="button" className="button secondary" onClick={abrirArchivo}>
                    Abrir entrega
                  </button>
                  {alumno.entrega.comentario && (
                    <p className="nota">“{alumno.entrega.comentario}”</p>
                  )}
                </div>
              )}

              {criterios.length > 0 ? (
                <div className="calificar-rubrica">
                  {criterios.map(c => (
                    <div key={c.id} className="calificar-criterio">
                      <div>
                        <strong>{c.titulo}</strong>
                        <span className="nota"> · hasta {c.peso} pts</span>
                        {c.descripcion && <div className="nota">{c.descripcion}</div>}

                        {/* Con niveles se elige; sin ellos se teclea. Elegir
                            es mas rapido y, sobre todo, mide a todos con la
                            misma vara: el descriptor esta a la vista. */}
                        {(c.niveles || []).length > 0 && (
                          <div className="calificar-niveles">
                            {c.niveles.map((n, j) => {
                              const elegido = String(puntos[c.id]) === String(n.puntos)
                              return (
                                <button key={j} type="button"
                                        className={`calificar-nivel ${elegido ? 'activo' : ''}`}
                                        title={n.descripcion || undefined}
                                        onClick={() => setPuntos(p => ({ ...p, [c.id]: n.puntos }))}>
                                  <span>{n.etiqueta}</span>
                                  <span className="nota">{n.puntos} pts</span>
                                  {n.descripcion && (
                                    <span className="calificar-nivel-desc">{n.descripcion}</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <input className="input" type="number" min="0" max={c.peso}
                             value={puntos[c.id] ?? ''}
                             onChange={e => setPuntos(p => ({ ...p, [c.id]: e.target.value }))} />
                    </div>
                  ))}
                  {/* Con rúbrica la nota no se escribe: se deriva. Dejar
                      ambas editables permitiría que no coincidieran. */}
                  <p className="calificar-total">
                    Total: <strong>{suma}</strong> de {tarea.puntos_max}
                  </p>
                </div>
              ) : (
                <>
                  <label>Calificación (sobre {tarea.puntos_max})</label>
                  <input className="input" type="number" value={nota}
                         onChange={e => setNota(e.target.value)} />
                </>
              )}

              <label>Retroalimentación</label>
              <textarea className="input" rows="4" value={retro}
                        onChange={e => setRetro(e.target.value)}
                        placeholder="Lo que quieres que lea sobre su trabajo" />

              {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

              <div className="modal-botones" style={{ marginTop: 14 }}>
                {onCerrar && (
                  <button type="button" className="button secondary" onClick={onCerrar}>Cerrar</button>
                )}
                <button type="button" className="button secondary" onClick={siguiente}>
                  Siguiente alumno →
                </button>
                <button type="button" className="button primary" onClick={guardar}
                        disabled={guardando || !alumno.entrega}>
                  {guardando ? 'Guardando…' : 'Guardar calificación'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
