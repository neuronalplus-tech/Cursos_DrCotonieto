import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { tipoDe, puedeIntentar, resumenIntentos } from '../lib/examenes'
import { limpiarPregunta } from '../lib/banco'
import { estadoPlazo, fechaLarga } from '../lib/plazos'
import EditorExamen from './EditorExamen'

/* ============================================================
   EXAMEN autocalificable (modulo o curso completo)
   Extraido de App.jsx en el refactor (etapa 2c).
   ============================================================ */

/* ============================================================
   EXAMEN
   ============================================================ */
export default function ExamenModulo({ moduloId, cursoId, user, gestiona = false, etiquetaDestino }) {
  const [examen, setExamen] = useState(null)
  const [juego, setJuego] = useState(null) // preguntas limpias del intento actual
  const [intentoId, setIntentoId] = useState(null) // pendiente abierto por servir_examen
  const [prorroga, setProrroga] = useState(null)
  const [intentos, setIntentos] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [ahora, setAhora] = useState(Date.now())
  const [inicioIntento, setInicioIntento] = useState(null)
  const enviarRef = useRef(null)

  useEffect(() => {
    async function load() {
      // El examen pertenece a un módulo (modulo_id) o al curso completo (curso_id).
      const columna = moduloId ? 'modulo_id' : 'curso_id'
      const valor = moduloId ?? cursoId
      // La prórroga propia: RLS solo devuelve las de quien pregunta,
      // así que no hace falta filtrar por usuario aquí.
      let consulta = supabase.from('examenes').select('*').eq(columna, valor)
      if (!gestiona) consulta = consulta.eq('activo', true)
      const { data: ex } = await consulta.maybeSingle()
      setExamen(ex)
      if (ex && user && ex.activo) {
        // Los pendientes son sorteos abiertos, no intentos: no cuentan
        // en el historial ni en el límite. Si la base aún no tiene la
        // columna (SQL sin correr), el filtro falla y se lee sin él.
        const leer = (conPendiente) => {
          let q = supabase.from('intentos_examen')
            .select('*').eq('usuario_id', user.id).eq('examen_id', ex.id)
          if (conPendiente) q = q.eq('pendiente', false)
          return q.order('fecha', { ascending: false })
        }
        const conFiltro = await leer(true)
        // ¿La columna `pendiente` no existe (SQL sin correr)? Entonces el
        // filtro falla: se lee sin él y se descarta lo pendiente aquí mismo.
        const sinColumna = conFiltro.error && /pendiente/.test(conFiltro.error.message || '')
        const ultimos = sinColumna ? await leer(false) : conFiltro
        setIntentos((ultimos.data || []).filter(i => !sinColumna || !i.pendiente))
      }
      setCargando(false)
    }
    if (moduloId || cursoId) load()
  }, [moduloId, cursoId, user, gestiona])

  useEffect(() => {
    if (!abierto || !inicioIntento || !examen?.limite_minutos) return undefined
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [abierto, inicioIntento, examen?.limite_minutos])

  useEffect(() => {
    if (abierto && inicioIntento && examen?.limite_minutos && ahora >= inicioIntento + examen.limite_minutos * 60000) {
      enviarRef.current?.(true)
    }
  }, [abierto, inicioIntento, examen?.limite_minutos, ahora])

  if (cargando) return null
  if (!examen) return gestiona ? (
    <div className="examen-admin-vacio">
      <button type="button" className="button secondary" onClick={() => setEditando(true)}>＋ Agregar examen</button>
      {editando && <EditorExamen examen={null} destino={{ tipo: moduloId ? 'modulo' : 'curso', id: moduloId || cursoId, etiqueta: etiquetaDestino || 'este apartado' }} onClose={() => setEditando(false)} onGuardado={setExamen} />}
    </div>
  ) : null
  if (!examen.activo && gestiona) return (
    <div className="examen-admin-vacio">
      <span>Examen oculto para el alumnado</span>
      <button type="button" className="button secondary" onClick={() => setEditando(true)}>Editar / publicar</button>
      {editando && <EditorExamen examen={examen} destino={{ tipo: moduloId ? 'modulo' : 'curso', id: moduloId || cursoId, etiqueta: etiquetaDestino || 'este apartado' }} onClose={() => setEditando(false)} onGuardado={setExamen} />}
    </div>
  )
  if (!user) return null

  const iniciar = async () => {
    if (!abierto) {
      setAbierto(true)
      if (juego) return
      try {
        const { data: servido, error: eServ } = await supabase.rpc('servir_examen', { p_examen: examen.id })
        if (eServ) throw eServ
        setJuego(servido?.preguntas || null)
        setIntentoId(servido?.intento_id || null)
        const { data: pendiente } = await supabase.from('intentos_examen').select('fecha')
          .eq('id', servido?.intento_id).maybeSingle()
        const inicio = pendiente?.fecha ? new Date(pendiente.fecha).getTime() : Date.now()
        setInicioIntento(inicio)
        setAhora(Date.now())
      } catch (e) {
        // Solo se cae al modo viejo si la base no tiene la migración de
        // exámenes (servir_examen no existe o faltan las columnas). Un
        // error real —plazo cerrado, sin acceso, intentos agotados— se
        // avisa y no se abre el examen: abrirlo igual dejaría al alumno
        // respondiendo algo que al enviar la base rechazaría.
        const sinMigrar = e?.code === 'PGRST202'
          || /column .*pendiente|column .*preguntas|relation .*intentos_examen/.test(e?.message || '')
        if (!sinMigrar) {
          setAbierto(false)
          alert('No se pudo abrir el examen: ' + (e?.message || e))
          return
        }
        setJuego((examen.preguntas || []).map(limpiarPregunta))
        setIntentoId(null)
        setInicioIntento(Date.now())
      }
    } else setAbierto(false)
  }

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

  const enviar = async (porTiempo = false) => {
    const preguntas = juego || examen.preguntas || []
    if (!porTiempo && Object.keys(respuestas).length < preguntas.length) {
      alert('Responde todas las preguntas antes de enviar.'); return
    }
    setEnviando(true)
    // La nota la pone la base contra el juego guardado, no el
    // navegador contra lo que ve. Sin intento pendiente (SQL aún
    // sin correr) se califica como hoy en el cliente.
    if (intentoId) {
      const { data, error } = await supabase
        .rpc('entregar_examen', { p_intento: intentoId, p_respuestas: respuestas })
      if (error) { alert('Error al guardar: ' + error.message); setEnviando(false); return }
      setResultado({ calificacion: data.calificacion, aprobado: data.aprobado })
      setIntentos(prev => [{ calificacion: data.calificacion, aprobado: data.aprobado, fecha: new Date().toISOString() }, ...prev])
      setEnviando(false)
      return
    }
    const { calificacion, aprobado } = calificar()
    // Se guarda el juego respondido: la revisión lee de ahí y no del
    // examen actual (que el editor pudo cambiar después). Si la base
    // aún no tiene las columnas, se reintenta como hoy.
    const intentoViejo = {
      usuario_id: user.id, examen_id: examen.id, respuestas, calificacion, aprobado,
      preguntas: examen.preguntas || [], pendiente: false,
    }
    let { error } = await supabase.from('intentos_examen').insert(intentoViejo)
    if (error && /preguntas|pendiente/.test(error.message || '')) {
      const { preguntas, pendiente, ...base } = intentoViejo
      ;({ error } = await supabase.from('intentos_examen').insert(base))
    }
    if (error) {
      // La RLS de intentos_examen veta el insert directo a propósito: la
      // nota la anota servir_examen/entregar_examen. Si llegamos aquí con
      // la base ya migrada es que el intento no se pudo abrir, así que se
      // dice qué hacer en vez de mostrar el mensaje crudo de la política.
      const vetado = /row-level security|new row violates/i.test(error.message || '')
      alert(vetado
        ? 'No se pudo registrar tu examen: vuelve a abrirlo e inténtalo de nuevo. Si sigue fallando, avisa a quien imparte el curso.'
        : 'Error al guardar: ' + error.message)
      setEnviando(false); return
    }
    setResultado({ calificacion, aprobado })
    setIntentos(prev => [{ calificacion, aprobado, fecha: new Date().toISOString() }, ...prev])
    setEnviando(false)
  }

  const segundosRestantes = examen.limite_minutos && inicioIntento
    ? Math.max(0, Math.ceil((inicioIntento + examen.limite_minutos * 60000 - ahora) / 1000)) : null
  enviarRef.current = (porTiempo) => {
    if (resultado || enviando) return
    enviar(porTiempo)
  }

  const reintentar = async () => {
    setRespuestas({}); setResultado(null)
    // Cada intento merece su propio sorteo: se pide un juego nuevo
    // en vez de reutilizar el ya respondido.
    if (examen && user) {
      try {
        const { data: servido, error: eServ } = await supabase
          .rpc('servir_examen', { p_examen: examen.id })
        if (eServ) throw eServ
        setJuego(servido?.preguntas || null)
        setIntentoId(servido?.intento_id || null)
        const { data: pendiente } = await supabase.from('intentos_examen').select('fecha').eq('id', servido?.intento_id).maybeSingle()
        setInicioIntento(pendiente?.fecha ? new Date(pendiente.fecha).getTime() : Date.now())
        return
      } catch { /* cae al juego completo de abajo */ }
    }
    setJuego((examen.preguntas || []).map(limpiarPregunta))
    setIntentoId(null)
  }
  const mejor = intentos.reduce((m, i) => Math.max(m, i.calificacion), 0)
  const resumen = resumenIntentos(intentos, examen.max_intentos)
  const quedanIntentos = puedeIntentar(intentos, examen.max_intentos)
  const plazo = estadoPlazo(examen, prorroga)

  return (
    <div className="examen-bloque">
      <div className="examen-plegable-cabecera">
        <button type="button" className="examen-plegable" aria-expanded={abierto} onClick={iniciar}>
          <span className="recurso-icono">✍️</span>
          <span className="examen-plegable-texto">
            <strong>{examen.titulo}</strong>
            <small>{examen.descripcion || `Aprobación con ${examen.umbral_aprobacion}% · ${resumen.limite ? `${resumen.usados}/${resumen.limite} intentos` : 'intentos ilimitados'}${examen.limite_minutos ? ` · ${examen.limite_minutos} min` : ''}`}</small>
          </span>
          {intentos.length > 0 && <span className="badge examen-nota-badge">Mejor: {resumen.mejor}%</span>}
          <span className="examen-flecha" aria-hidden="true">{abierto ? '⌃' : '⌄'}</span>
        </button>
        {gestiona && <button type="button" className="button texto examen-editar" onClick={() => setEditando(true)}>✏️ Editar</button>}
      </div>
      {editando && <EditorExamen examen={examen} destino={{ tipo: moduloId ? 'modulo' : 'curso', id: moduloId || cursoId, etiqueta: etiquetaDestino || 'este apartado' }} onClose={() => setEditando(false)} onGuardado={setExamen} />}
      {abierto && <div className="examen-desplegado">
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

      {segundosRestantes != null && !resultado && quedanIntentos && (
        <p className={`examen-temporizador ${segundosRestantes <= 60 ? 'urgente' : ''}`} role="timer">
          Tiempo restante: {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
        </p>
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
            {(juego || examen.preguntas || []).map((p) => {
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
                        {/* Con el juego servido ya no se adivina escribiendo:
                            la base manda respuestas_posibles solo con los
                            textos, sin decir cuál va con cuál. En el modo
                            viejo (sin SQL corrido) se escribe a mano. */}
                        {p.respuestas_posibles ? (
                          <select value={respuestas[p.id]?.[par.id] || ''}
                                  onChange={e => setRespuestas(r => ({ ...r, [p.id]: { ...(r[p.id] || {}), [par.id]: e.target.value } }))}
                                  style={{ flex: 1 }}>
                            <option value="">Elige…</option>
                            {p.respuestas_posibles.map((texto, k) => (
                              <option key={k} value={texto}>{texto}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={respuestas[p.id]?.[par.id] || ''}
                                 onChange={e => setRespuestas(r => ({ ...r, [p.id]: { ...(r[p.id] || {}), [par.id]: e.target.value } }))}
                                 placeholder="Respuesta" style={{ flex: 1 }} />
                        )}
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
      </div>}
    </div>
  )
}
