/* ============================================================
   ENCUESTA NPS — el alumno que terminó el curso
   ------------------------------------------------------------
   Aparece solo con progreso al 100% y sin responder. Una
   pregunta (0-10) + comentario opcional. Responder no es
   requisito de nada: chantajear con la constancia ensucia el
   dato. Si falta ENCUESTAS_1_NPS.sql, no se muestra y el
   resto del curso funciona igual.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EncuestaNps({ user, cursoId }) {
  const [encuesta, setEncuesta] = useState(null)
  const [respondida, setRespondida] = useState(false)
  const [puntaje, setPuntaje] = useState(null)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [gracias, setGracias] = useState(false)
  const [falta, setFalta] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || !cursoId) return
    let vivo = true
    ;(async () => {
      // La RPC crea la encuesta si no existe. Si la función no
      // existe (SQL no corrido), no se muestra nada.
      const { data: e, error: eE } = await supabase
        .rpc('encuesta_del_curso', { p_curso: Number(cursoId) })
      if (!vivo) return
      if (eE) {
        if (eE.code === '42883' || eE.code === 'PGRST202' || /does not exist|no existe/i.test(eE.message || '')) setFalta(true)
        return
      }
      const fila = Array.isArray(e) ? e[0] : e
      if (!fila?.activa) return
      setEncuesta(fila)
      const { data: mia } = await supabase
        .from('respuestas_encuesta')
        .select('id').eq('encuesta_id', fila.id).eq('usuario_id', user.id)
        .maybeSingle()
      if (vivo && mia) setRespondida(true)
    })()
    return () => { vivo = false }
  }, [user, cursoId])

  if (!user || falta || respondida || (!gracias && !encuesta)) return null

  const enviar = async () => {
    if (puntaje === null) return
    setEnviando(true)
    setError(null)
    // Upsert: si ya había respondido antes, se actualiza en vez
    // de duplicar. El índice único lo garantiza también abajo.
    const { error: eG } = await supabase
      .from('respuestas_encuesta')
      .upsert({
        encuesta_id: encuesta.id,
        usuario_id: user.id,
        puntaje,
        comentario: comentario.trim() || null,
      }, { onConflict: 'encuesta_id,usuario_id' })
    setEnviando(false)
    if (eG) return setError('No se pudo guardar: ' + eG.message)
    setGracias(true)
  }

  return (
    <section className="nps-bloque">
      {gracias ? (
        <p className="aviso-ok">¡Gracias! Tu respuesta quedó registrada.</p>
      ) : (
        <>
          <h3>¿Recomendarías este curso a un colega?</h3>
          <p className="nota">
            0 = para nada · 10 = sin duda. Tu respuesta es anónima para tus
            compañeros; el promotor del curso sí la ve agregada.
          </p>
          <div className="nps-escala">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button"
                      className={`nps-boton ${puntaje === i ? 'nps-boton-activo' : ''}`}
                      onClick={() => setPuntaje(i)}>{i}</button>
            ))}
          </div>
          {puntaje !== null && (
            <>
              <textarea className="input" rows={2} value={comentario}
                        onChange={e => setComentario(e.target.value)}
                        placeholder="Comentario opcional (se lee mejor con detalle)" />
              <button type="button" className="button primary"
                      onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar respuesta'}
              </button>
            </>
          )}
          {error && <p className="aviso-error">{error}</p>}
        </>
      )}
    </section>
  )
}
