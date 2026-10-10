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
import { estadoPlazo, fechaLarga } from '../lib/plazos'

/* El nombre original se conserva aparte; en la ruta se limpia para
   que no haya acentos ni espacios que compliquen la descarga. */
function nombreSeguro(nombre) {
  return String(nombre || 'archivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]/g, '_')
    .slice(-80)
}

/* El cálculo del plazo vive en src/lib/plazos.js. Antes estaba aquí,
   con su propia idea de «vencido», y no sabía nada de prórrogas ni de
   la diferencia entre vencer y cerrar. */

function UnaTarea({ tarea, user }) {
  const [entrega, setEntrega] = useState(null)
  const [criterios, setCriterios] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [prorroga, setProrroga] = useState(null)
  const [msg, setMsg] = useState(null)
  const [comentario, setComentario] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      // La prórroga propia, si la hay: cambia la fecha que aplica a
      // ESTA persona, no a todo el grupo.
      const { data: pr } = await supabase
        .from('prorrogas').select('nueva_fecha')
        .eq('tipo', 'tarea').eq('actividad_id', tarea.id)
        .order('nueva_fecha', { ascending: false }).limit(1)
      setProrroga(pr?.[0]?.nueva_fecha || null)

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

  const plazo = estadoPlazo(tarea, prorroga)
  const calificada = entrega?.calificado_en != null
  // El cierre real lo impone la base (FECHAS_LIMITE.sql). Aquí solo
  // se evita ofrecer un botón que iba a fallar.
  const puedeEntregar = (!entrega || tarea.permite_reentrega) && plazo.abierto

  return (
    <article className="tarea-alumno">
      <header>
        <h3>{tarea.titulo}</h3>
        <div className="tarea-alumno-meta">
          <span className="nota">{tarea.puntos_max} puntos</span>
          {plazo.clave !== 'sin_plazo' && (
            <span className={`badge plazo-${plazo.tono}`}
                  title={fechaLarga(plazo.fecha)}>{plazo.etiqueta}</span>
          )}
          {prorroga && (
            <span className="badge rol-facil" title={fechaLarga(prorroga)}>
              Tienes prórroga
            </span>
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
          <summary>{calificada ? 'Desglose de tu calificación' : `Criterios de evaluación (${criterios.length})`}</summary>
          <div className="tarea-rubrica-tabla-scroll">
            <table className="tarea-rubrica-tabla">
              <thead><tr><th>Criterio</th><th>Qué se evalúa</th><th>Valor</th>{calificada && <th>Tu resultado</th>}</tr></thead>
              <tbody>{criterios.map(c => {
                const guardado = entrega?.rubrica_detalle?.[c.id]
                const puntos = guardado && typeof guardado === 'object' ? guardado.puntos : guardado
                const etiqueta = guardado && typeof guardado === 'object' ? guardado.nivel : null
                const nivel = (c.niveles || []).find(n => n.etiqueta === etiqueta)
                  || (puntos != null ? (c.niveles || []).find(n => Number(n.puntos) === Number(puntos)) : null)
                const etiquetaResultado = etiqueta || nivel?.etiqueta
                return <tr key={c.id}>
                  <th scope="row">{c.titulo}</th>
                  <td><div>{c.descripcion || '—'}</div>{!calificada && (c.niveles || []).length > 0 && <ul className="tarea-niveles">{c.niveles.map((n, j) => <li key={j}><strong>{n.etiqueta}</strong> · {n.puntos} pts{n.descripcion && <> — {n.descripcion}</>}</li>)}</ul>}</td>
                  <td>{c.peso} pts</td>
                  {calificada && <td>{puntos == null ? '—' : <><strong>{puntos} / {c.peso} pts</strong>{etiquetaResultado && <div><span className="badge ok">{etiquetaResultado}</span>{(guardado?.descripcion || nivel?.descripcion) && <p className="nota">{guardado?.descripcion || nivel?.descripcion}</p>}</div>}{!etiquetaResultado && <div className="nota">Calificación manual</div>}</>}</td>}
                </tr>
              })}</tbody>
            </table>
          </div>
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
        /* Se dice CUAL de las dos razones es. «No puedes entregar» a
           secas deja al alumno sin saber si pedir una prórroga o si
           simplemente ya entregó. */
        !plazo.abierto ? (
          <p className="aviso-error">
            El plazo cerró {plazo.fecha ? `el ${fechaLarga(plazo.fecha)}` : ''}.
            {' '}Si necesitas más tiempo, pídele una prórroga a quien imparte el curso.
          </p>
        ) : (
          <p className="nota">Esta tarea no admite reentrega.</p>
        )
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
