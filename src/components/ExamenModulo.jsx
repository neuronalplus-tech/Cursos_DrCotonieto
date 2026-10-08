import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { tipoDe, puedeIntentar, resumenIntentos } from '../lib/examenes'
import { estadoPlazo, fechaLarga } from '../lib/plazos'

/* ============================================================
   EXAMEN autocalificable (modulo o curso completo)
   Extraido de App.jsx en el refactor (etapa 2c).
   ============================================================ */

/* ============================================================
   EXAMEN
   ============================================================ */
export default function ExamenModulo({ moduloId, cursoId, user }) {
  const [examen, setExamen] = useState(null)
  const [prorroga, setProrroga] = useState(null)
  const [intentos, setIntentos] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function load() {
      // El examen pertenece a un módulo (modulo_id) o al curso completo (curso_id).
      const columna = moduloId ? 'modulo_id' : 'curso_id'
      const valor = moduloId ?? cursoId
      // La prórroga propia: RLS solo devuelve las de quien pregunta,
      // así que no hace falta filtrar por usuario aquí.
      const { data: ex } = await supabase.from('examenes').select('*')
        .eq(columna, valor).eq('activo', true).maybeSingle()
      setExamen(ex)
      if (ex && user) {
        const { data: int } = await supabase.from('intentos_examen')
          .select('*').eq('usuario_id', user.id).eq('examen_id', ex.id)
          .order('fecha', { ascending: false })
        setIntentos(int || [])
      }
      setCargando(false)
    }
    if (moduloId || cursoId) load()
  }, [moduloId, cursoId, user])

  if (cargando) return null
  if (!examen) return null
  if (!user) return null

  // tipoDe viene de src/lib/examenes.js (misma lógica de antes, ahora compartida)

  const esCorrecta = (p) => {
    const r = respuestas[p.id]
    if (r == null || r === '') return false
    const tipo = tipoDe(p)
    if (tipo === 'vf' || tipo === 'opcion') {
      const idx = typeof r === 'number' ? r : parseInt(r, 10)
      return !!(p.opciones?.[idx]?.correcta)
    }
    if (tipo === 'corta') {
      const esperado = (p.respuesta || '').trim().toLowerCase()
      const dada = String(r).trim().toLowerCase()
      if (!esperado) return false
      if (dada === esperado) return true
      // Acepta variantes separadas por "|" o ";" (ej. "TEPT|trastorno de estrés postraumático")
      return esperado.split(/[|;]/).map(s => s.trim()).filter(Boolean).includes(dada)
    }
    if (tipo === 'emparejar') {
      const pares = p.pares || []
      if (!pares.length || typeof r !== 'object') return false
      return pares.every(par => String(r[par.id] ?? '').trim() === String(par.respuesta ?? '').trim())
    }
    return false
  }

  const calificar = () => {
    const preguntas = examen.preguntas || []
    let correctas = 0
    preguntas.forEach(p => { if (esCorrecta(p)) correctas++ })
    const calificacion = preguntas.length ? Math.round((correctas / preguntas.length) * 100) : 0
    return { calificacion, aprobado: calificacion >= examen.umbral_aprobacion }
  }

  const enviar = async () => {
    const preguntas = examen.preguntas || []
    if (Object.keys(respuestas).length < preguntas.length) {
      alert('Responde todas las preguntas antes de enviar.'); return
    }
    setEnviando(true)
    const { calificacion, aprobado } = calificar()
    const { error } = await supabase.from('intentos_examen').insert({
      usuario_id: user.id, examen_id: examen.id, respuestas, calificacion, aprobado
    })
    if (error) { alert('Error al guardar: ' + error.message); setEnviando(false); return }
    setResultado({ calificacion, aprobado })
    setIntentos(prev => [{ calificacion, aprobado, fecha: new Date().toISOString() }, ...prev])
    setEnviando(false)
  }

  const reintentar = () => { setRespuestas({}); setResultado(null) }
  const mejor = intentos.reduce((m, i) => Math.max(m, i.calificacion), 0)
  const resumen = resumenIntentos(intentos, examen.max_intentos)
  const quedanIntentos = puedeIntentar(intentos, examen.max_intentos)
  const plazo = estadoPlazo(examen, prorroga)

  return (
    <div className="examen-bloque">
      <header className="examen-header">
        <span className="recurso-icono">✍️</span>
        <div>
          <h3>{examen.titulo}</h3>
          {examen.descripcion && <p className="recurso-desc">{examen.descripcion}</p>}
          <p className="examen-meta">
            Aprobación con {examen.umbral_aprobacion}% ·
            {resumen.limite
              ? ` intentos ${resumen.usados}/${resumen.limite}`
              : ' intentos ilimitados'}
            {resumen.usados > 0 && ` · Mejor nota: ${resumen.mejor}%`}
          </p>
          {plazo.clave !== 'sin_plazo' && (
            <p className="examen-meta">
              <span className={`badge plazo-${plazo.tono}`} title={fechaLarga(plazo.fecha)}>
                {plazo.etiqueta}
              </span>
              {prorroga && (
                <span className="badge rol-facil" title={fechaLarga(prorroga)}>
                  Tienes prórroga
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      {/* El plazo se mira ANTES que los intentos: a quien se le cerró
          el examen no le sirve saber cuántos intentos le quedaban. */}
      {quedanIntentos && !plazo.abierto && (
        <div className="aviso-error">
          <strong>El plazo de este examen cerró</strong>
          <p style={{ margin: '6px 0 0' }}>
            {plazo.fecha ? `Cerró el ${fechaLarga(plazo.fecha)}. ` : ''}
            Si necesitas presentarlo, pídele una prórroga a quien imparte el curso.
          </p>
        </div>
      )}

      {!quedanIntentos ? (
        <div className={resumen.aprobado ? 'aviso-ok' : 'aviso-error'}>
          <strong>{resumen.aprobado ? '✅ Aprobado' : '❌ No aprobado'}</strong>
          <div style={{ fontSize: 26, fontWeight: 700, margin: '6px 0' }}>{resumen.mejor}%</div>
          <p style={{ margin: 0 }}>
            Usaste tus {resumen.limite} intentos. Esta es tu mejor calificación
            {resumen.aprobado ? ' y es la que cuenta.' : '.'}
          </p>
        </div>
      ) : resultado ? (
        <div className={resultado.aprobado ? 'aviso-ok' : 'aviso-error'}>
          <strong>{resultado.aprobado ? '✅ Aprobado' : '❌ No aprobado'}</strong> — {resultado.calificacion}%
          {intentos.length > 1 && (
            <p className="nota" style={{ margin: '6px 0 0' }}>
              Mejor nota hasta ahora: {resumen.mejor}%
              {resumen.restantes === 1
                ? ' · te queda 1 intento'
                : resumen.restantes > 1
                  ? ` · te quedan ${resumen.restantes} intentos`
                  : ''}
            </p>
          )}
          <div style={{ marginTop: 10 }}>
            {plazo.abierto && (
              <button className="button secondary" onClick={reintentar}>Volver a intentar</button>
            )}
          </div>
        </div>
      ) : plazo.abierto ? (
        <>
          <ol className="examen-preguntas">
            {(examen.preguntas || []).map((p) => {
              const tipo = tipoDe(p)
              return (
              <li key={p.id}>
                <p className="examen-pregunta">{p.pregunta}</p>
                {(tipo === 'opcion' || tipo === 'vf') && (
                <div className="examen-opciones">
                  {(p.opciones || []).map((o, j) => (
                    <label key={j} className={`examen-opcion ${String(respuestas[p.id]) === String(j) ? 'sel' : ''}`}>
                      <input type="radio" name={p.id} checked={String(respuestas[p.id]) === String(j)}
                             onChange={() => setRespuestas(r => ({ ...r, [p.id]: j }))} />
                      <span>{o.texto}</span>
                    </label>
                  ))}
                </div>
                )}
                {tipo === 'corta' && (
                  <input type="text" className="examen-corta" value={respuestas[p.id] || ''}
                         onChange={e => setRespuestas(r => ({ ...r, [p.id]: e.target.value }))}
                         placeholder="Escribe tu respuesta" style={{ width: '100%', marginTop: 10 }} />
                )}
                {tipo === 'emparejar' && (
                  <div className="examen-opciones">
                    {(p.pares || []).map((par) => (
                      <label key={par.id} className="examen-opcion">
                        <span style={{ minWidth: 120 }}>{par.premisa}</span>
                        <input type="text" value={respuestas[p.id]?.[par.id] || ''}
                               onChange={e => setRespuestas(r => ({ ...r, [p.id]: { ...(r[p.id] || {}), [par.id]: e.target.value } }))}
                               placeholder="Respuesta" style={{ flex: 1 }} />
                      </label>
                    ))}
                  </div>
                )}
              </li>
              )
            })}
          </ol>
          <button className="button primary" onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar respuestas'}
          </button>
        </>
      ) : null}

      {intentos.length > 0 && (
        <details className="examen-historial">
          <summary>Historial de intentos ({intentos.length})</summary>
          <ul>
            {intentos.map((it, i) => (
              <li key={i}>{new Date(it.fecha).toLocaleDateString('es-MX')} — {it.calificacion}% {it.aprobado ? '✅' : '❌'}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
