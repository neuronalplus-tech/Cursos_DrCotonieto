/* ============================================================
   PRÓRROGAS
   ------------------------------------------------------------
   Ampliar el plazo a una persona o a una generación entera. Sirve
   igual para una tarea, un examen o un tema del foro: cambia el
   `tipo`, no la pantalla.

   POR QUÉ NO HAY «PRÓRROGA PARA TODOS»
   Porque eso es cambiar la fecha de la actividad, y está ahí arriba
   en el mismo editor. Tener dos maneras de hacer lo mismo obliga a
   mirar en dos sitios para saber cuándo cierra algo, que es
   exactamente el tipo de duda que no se quiere a mitad de un
   diplomado.

   UNA PRÓRROGA SOLO AMPLÍA
   Si se teclea una fecha anterior a la original, no acorta nada: la
   base toma siempre la más tardía. Aquí se avisa para que no
   parezca que se guardó algo que no va a tener efecto.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aCampoLocal, deCampoLocal, fechaLarga, masTarde } from '../lib/plazos'

const ETIQUETA_TIPO = { tarea: 'tarea', examen: 'examen', foro: 'tema del foro' }

export default function Prorrogas({ tipo, actividadId, cursoId, fechaOriginal }) {
  const [lista, setLista] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [generaciones, setGeneraciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [destino, setDestino] = useState('')     // 'u:<uuid>' o 'g:<id>'
  const [cuando, setCuando] = useState('')
  const [motivo, setMotivo] = useState('')

  const recargar = async () => {
    if (!actividadId) return
    setCargando(true)
    const { data } = await supabase
      .from('prorrogas').select('*')
      .eq('tipo', tipo).eq('actividad_id', actividadId)
      .order('nueva_fecha')
    setLista(data || [])
    setCargando(false)
  }

  useEffect(() => {
    if (!actividadId || !cursoId) { setCargando(false); return }
    let vivo = true
    ;(async () => {
      // Solo los inscritos en ESTE curso: dar una prórroga a quien no
      // está en el curso no significa nada, y una lista con todos los
      // alumnos de la plataforma es imposible de usar.
      const { data: acc } = await supabase
        .from('acceso').select('usuario_id').eq('curso_id', cursoId)
      const ids = [...new Set((acc || []).map(a => a.usuario_id))]
      const { data: perfs } = ids.length
        ? await supabase.from('perfiles').select('id, nombre_completo').in('id', ids)
        : { data: [] }
      const { data: gens } = await supabase
        .from('generaciones').select('id, nombre').eq('curso_id', cursoId)
      if (!vivo) return
      setAlumnos((perfs || []).sort((a, b) =>
        String(a.nombre_completo || '').localeCompare(String(b.nombre_completo || ''), 'es')))
      setGeneraciones(gens || [])
      await recargar()
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividadId, cursoId, tipo])

  const nombreDe = (p) => {
    if (p.usuario_id) {
      return alumnos.find(a => a.id === p.usuario_id)?.nombre_completo || '(sin nombre)'
    }
    return 'Generación ' +
      (generaciones.find(g => g.id === p.generacion_id)?.nombre || p.generacion_id)
  }

  const guardar = async () => {
    const fecha = deCampoLocal(cuando)
    if (!destino) return setMsg({ tipo: 'error', texto: 'Elige a quién se la das.' })
    if (!fecha) return setMsg({ tipo: 'error', texto: 'Falta la fecha nueva.' })

    setGuardando(true)
    const { data: u } = await supabase.auth.getUser()
    const fila = {
      tipo, actividad_id: actividadId,
      usuario_id: destino.startsWith('u:') ? destino.slice(2) : null,
      generacion_id: destino.startsWith('g:') ? Number(destino.slice(2)) : null,
      nueva_fecha: fecha,
      motivo: motivo.trim() || null,
      creado_por: u?.user?.email?.toLowerCase() || null,
    }
    // Si ya tenía una, se reemplaza: hay un índice único por persona
    // y actividad, así que insertar a secas fallaría.
    const { error } = await supabase.from('prorrogas')
      .upsert(fila, {
        onConflict: fila.usuario_id
          ? 'tipo,actividad_id,usuario_id'
          : 'tipo,actividad_id,generacion_id',
      })
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })

    setDestino(''); setCuando(''); setMotivo('')
    await recargar()
    const inutil = fechaOriginal && masTarde(fechaOriginal, fecha) === fechaOriginal
    setMsg({
      tipo: inutil ? 'error' : 'ok',
      texto: inutil
        ? 'Guardada, pero es ANTERIOR a la fecha de la actividad, así que no cambia nada: ' +
          'una prórroga solo amplía. Ponle una fecha posterior.'
        : 'Prórroga guardada.',
    })
  }

  const quitar = async (p) => {
    const { error } = await supabase.from('prorrogas').delete().eq('id', p.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo quitar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Prórroga retirada.' })
  }

  if (!actividadId) {
    return (
      <p className="nota">
        Guarda primero la {ETIQUETA_TIPO[tipo]} y vuelve a abrirla para poder dar prórrogas.
      </p>
    )
  }

  return (
    <div className="prorrogas">
      <h4>Prórrogas</h4>
      <p className="nota" style={{ marginTop: 0 }}>
        Para ampliar el plazo a <strong>todos</strong>, cambia la fecha de arriba.
        Esto es para casos concretos.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      <div className="prorroga-alta">
        <div>
          <label>¿A quién?</label>
          <select className="input" value={destino} onChange={e => setDestino(e.target.value)}>
            <option value="">Elige…</option>
            {generaciones.length > 0 && (
              <optgroup label="Generaciones">
                {generaciones.map(g => (
                  <option key={`g${g.id}`} value={`g:${g.id}`}>{g.nombre}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Alumnos">
              {alumnos.map(a => (
                <option key={a.id} value={`u:${a.id}`}>
                  {a.nombre_completo || '(sin nombre)'}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label>Nuevo plazo</label>
          <input className="input" type="datetime-local" value={cuando}
                 onChange={e => setCuando(e.target.value)} />
        </div>
        <div>
          <label>Motivo (opcional)</label>
          <input className="input" value={motivo}
                 onChange={e => setMotivo(e.target.value)}
                 placeholder="Ej. incapacidad médica" />
        </div>
        <button type="button" className="button secondary"
                onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : '➕ Dar prórroga'}
        </button>
      </div>

      {cargando ? <p className="nota">Cargando…</p> : !lista.length ? (
        <p className="nota">Nadie tiene prórroga en esta {ETIQUETA_TIPO[tipo]}.</p>
      ) : (
        <ul className="prorroga-lista">
          {lista.map(p => (
            <li key={p.id}>
              <span>
                <strong>{nombreDe(p)}</strong>
                <span className="celda-sub">
                  hasta el {fechaLarga(p.nueva_fecha)}
                  {p.motivo ? ` · ${p.motivo}` : ''}
                </span>
              </span>
              <button type="button" className="button texto"
                      onClick={() => quitar(p)}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   LOS DOS CAMPOS DE PLAZO, QUE SE REPITEN EN LOS TRES EDITORES
   ------------------------------------------------------------
   Escritos una vez para que digan lo mismo en los tres sitios. Que
   el texto que explica «cerrar al vencer» cambie según dónde lo
   leas es la forma más fácil de que alguien entienda mal qué pasa
   al vencer el plazo.
   ------------------------------------------------------------ */
export function CamposPlazo({ fecha, cierra, onFecha, onCierra }) {
  return (
    <div className="plazo-campos">
      <div>
        <label>Fecha límite (opcional)</label>
        <input className="input" type="datetime-local"
               value={aCampoLocal(fecha)}
               onChange={e => onFecha(deCampoLocal(e.target.value))} />
        <p className="nota">Sin fecha, queda abierto indefinidamente.</p>
      </div>
      <label className="gen-activa plazo-cierra">
        <input type="checkbox" checked={cierra !== false}
               onChange={e => onCierra(e.target.checked)}
               disabled={!fecha} />
        <span>
          Cerrar al vencer
          <em className="nota">
            {cierra !== false
              ? 'Al pasar la fecha ya no se podrá entregar.'
              : 'Se seguirá admitiendo, marcado como entrega tardía.'}
          </em>
        </span>
      </label>
    </div>
  )
}
