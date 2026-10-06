/* ============================================================
   TAREAS · lo que ve y hace el alumno
   ------------------------------------------------------------
   Lista las tareas visibles del apartado, deja subir el archivo y
   muestra la calificación cuando llega.

   El archivo vive en un bucket PRIVADO: para verlo se pide una URL
   firmada que caduca. No hay enlace permanente que se pueda pasar
   a nadie más.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/* El nombre original se conserva aparte; en la ruta se limpia para
   que no haya acentos ni espacios que compliquen la descarga. */
function nombreSeguro(nombre) {
  return String(nombre || 'archivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]/g, '_')
    .slice(-80)
}

function venceEn(fecha) {
  if (!fecha) return null
  const faltan = new Date(fecha).getTime() - Date.now()
  if (faltan < 0) return { texto: 'Fecha de entrega vencida', tarde: true }
  const dias = Math.floor(faltan / 86400000)
  if (dias === 0) return { texto: 'Vence hoy', tarde: false }
  return { texto: `Faltan ${dias} día(s)`, tarde: false }
}

function UnaTarea({ tarea, user }) {
  const [entrega, setEntrega] = useState(null)
  const [criterios, setCriterios] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState(null)
  const [comentario, setComentario] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: e } = await supabase
        .from('entregas').select('*')
        .eq('tarea_id', tarea.id).eq('usuario_id', user.id).maybeSingle()
      const { data: cs } = await supabase
        .from('rubrica_criterios').select('*').eq('tarea_id', tarea.id).order('orden')
      if (!vivo) return
      setEntrega(e || null)
      setComentario(e?.comentario || '')
      setCriterios(cs || [])
    })()
    return () => { vivo = false }
  }, [tarea.id, user.id])

  const subir = async (archivo) => {
    if (!archivo) return
    setSubiendo(true)
    setMsg(null)
    try {
      // La ruta la exigen las políticas del bucket: el segundo tramo
      // tiene que ser el id de quien sube.
      const path = `${tarea.id}/${user.id}/${Date.now()}_${nombreSeguro(archivo.name)}`
      const { error: eSubida } = await supabase.storage
        .from('entregas').upload(path, archivo, { upsert: false })
      if (eSubida) throw eSubida

      const fila = {
        tarea_id: tarea.id,
        usuario_id: user.id,
        archivo_path: path,
        archivo_nombre: archivo.name,
        comentario: comentario.trim() || null,
        entregado_en: new Date().toISOString(),
      }

      // Al reentregar se sobrescribe la fila y se borra el archivo
      // anterior: dejarlo solo ocuparía espacio y confundiría.
      const anterior = entrega?.archivo_path
      const { data, error } = entrega
        ? await supabase.from('entregas').update(fila).eq('id', entrega.id).select().single()
        : await supabase.from('entregas').insert(fila).select().single()
      if (error) throw error

      if (anterior && anterior !== path) {
        await supabase.storage.from('entregas').remove([anterior])
      }

      setEntrega(data)
      setMsg({ tipo: 'ok', texto: '✓ Entregado' })
    } catch (e) {
      setMsg({ tipo: 'error', texto: 'No se pudo subir: ' + (e.message || e) })
    } finally {
      setSubiendo(false)
    }
  }

  const descargar = async () => {
    if (!entrega?.archivo_path) return
    const { data, error } = await supabase.storage
      .from('entregas').createSignedUrl(entrega.archivo_path, 60)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo abrir: ' + error.message })
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const plazo = venceEn(tarea.fecha_limite)
  const calificada = entrega?.calificado_en != null
  const puedeEntregar = !entrega || tarea.permite_reentrega

  return (
    <article className="tarea-alumno">
      <header>
        <h3>{tarea.titulo}</h3>
        <div className="tarea-alumno-meta">
          <span className="nota">{tarea.puntos_max} puntos</span>
          {plazo && (
            <span className={plazo.tarde ? 'badge inactivo' : 'nota'}>{plazo.texto}</span>
          )}
          {entrega && !calificada && <span className="badge ok">Entregado</span>}
          {calificada && (
            <span className="badge rol-facil">
              Calificado · {entrega.calificacion} / {tarea.puntos_max}
            </span>
          )}
        </div>
      </header>

      {tarea.instrucciones && <p className="tarea-instrucciones">{tarea.instrucciones}</p>}

      {criterios.length > 0 && (
        <details className="tarea-rubrica">
          <summary>Cómo se califica ({criterios.length} criterios)</summary>
          <ul>
            {criterios.map(c => (
              <li key={c.id}>
                <strong>{c.titulo}</strong> <span className="nota">({c.peso} pts)</span>
                {c.descripcion && <div className="nota">{c.descripcion}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {entrega && (
        <div className="tarea-entregado">
          <span>📎 {entrega.archivo_nombre}</span>
          <button type="button" className="button texto" onClick={descargar}>Ver mi entrega</button>
          <span className="nota">
            {new Date(entrega.entregado_en).toLocaleString('es-MX', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
            })}
          </span>
        </div>
      )}

      {calificada && entrega.retroalimentacion && (
        <div className="tarea-retro">
          <strong>Retroalimentación</strong>
          <p>{entrega.retroalimentacion}</p>
        </div>
      )}

      {puedeEntregar ? (
        <>
          <label className="tarea-comentario-lbl">Comentario para tu profesor (opcional)</label>
          <textarea className="input" rows="2" value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    placeholder="Algo que quieras aclarar sobre tu entrega" />
          <label className="button primary tarea-subir">
            {subiendo ? 'Subiendo…' : entrega ? '📎 Reemplazar archivo' : '📎 Subir archivo'}
            <input type="file" hidden disabled={subiendo}
                   onChange={e => { subir(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </>
      ) : (
        <p className="nota">Esta tarea no admite reentrega.</p>
      )}
    </article>
  )
}

export default function TareasAlumno({ cursoId = null, moduloId = null, user, miGrupo = null }) {
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const valor = cursoId || moduloId
    if (!valor || !user) { setCargando(false); return }
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from('tareas').select('*')
        .eq(cursoId ? 'curso_id' : 'modulo_id', valor)
        .eq('activo', true)
        .order('creado_en')
      if (!vivo) return
      // Una tarea con `grupo` es de una ruta concreta, igual que los
      // módulos: solo la ve quien está en esa ruta.
      setTareas((data || []).filter(t => !t.grupo || t.grupo === miGrupo))
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [cursoId, moduloId, user, miGrupo])

  if (cargando || !tareas.length) return null

  return (
    <section className="tareas-alumno">
      <h2 className="titulo-seccion">Entregas</h2>
      {tareas.map(t => <UnaTarea key={t.id} tarea={t} user={user} />)}
    </section>
  )
}
