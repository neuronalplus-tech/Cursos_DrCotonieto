import { useState } from 'react'
import { TIPOS_EXAMEN, ETIQUETA_TIPO, tipoDe, validarPregunta, crearPreguntaVacia } from '../lib/examenes'

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * Formulario para escribir UNA pregunta a mano (sin Excel).
 * onCancelar(null) = cerrar · onGuardar(pregunta) = aceptar
 */
export default function EditorPregunta({ inicial, indice, onGuardar, onCancelar }) {
  const [p, setP] = useState(inicial || crearPreguntaVacia('opcion', (indice || 0) + 1))
  const [error, setError] = useState(null)

  const set = (campo, valor) => setP(prev => ({ ...prev, [campo]: valor }))

  const cambiarTipo = (tipo) => {
    const base = crearPreguntaVacia(tipo, (indice || 0) + 1)
    setP(prev => ({ ...base, id: prev.id, pregunta: prev.pregunta }))
  }

  const setOpcion = (i, texto) =>
    setP(prev => ({ ...prev, opciones: prev.opciones.map((o, j) => j === i ? { ...o, texto } : o) }))

  const marcarCorrecta = (i) =>
    setP(prev => ({ ...prev, opciones: prev.opciones.map((o, j) => ({ ...o, correcta: j === i })) }))

  const agregarOpcion = () =>
    setP(prev => prev.opciones.length >= 6
      ? prev
      : { ...prev, opciones: [...prev.opciones, { texto: '', correcta: false }] })

  const quitarOpcion = (i) =>
    setP(prev => ({ ...prev, opciones: prev.opciones.filter((_, j) => j !== i) }))

  const setPar = (i, campo, valor) =>
    setP(prev => ({ ...prev, pares: prev.pares.map((x, j) => j === i ? { ...x, [campo]: valor } : x) }))

  const agregarPar = () =>
    setP(prev => ({ ...prev, pares: [...prev.pares, { id: `${prev.id}z${prev.pares.length}`, premisa: '', respuesta: '' }] }))

  const quitarPar = (i) =>
    setP(prev => ({ ...prev, pares: prev.pares.filter((_, j) => j !== i) }))

  const aceptar = () => {
    const err = validarPregunta(p)
    if (err) { setError(err); return }
    onGuardar(p)
  }

  const tipo = tipoDe(p)

  return (
    <div className="pregunta-editor">
      <h4>{indice != null ? `Pregunta ${indice + 1}` : 'Nueva pregunta'}</h4>

      <label>Tipo de pregunta</label>
      <div className="pregunta-tipos">
        {TIPOS_EXAMEN.map(t => (
          <button key={t} type="button"
                  className={`button ${tipo === t ? 'primary' : 'secondary'}`}
                  onClick={() => cambiarTipo(t)}>
            {ETIQUETA_TIPO[t]}
          </button>
        ))}
      </div>

      <label>Pregunta</label>
      <textarea rows={2} value={p.pregunta} autoFocus
                onChange={e => set('pregunta', e.target.value)}
                placeholder="Escribe el enunciado…" />

      {tipo === 'opcion' && (
        <>
          <label>Opciones de respuesta <span className="nota">(marca la correcta con el radio)</span></label>
          <div className="pregunta-opciones">
            {p.opciones.map((o, i) => (
              <div key={i} className="pregunta-opcion-fila">
                <input type="radio" name={`correcta-${p.id}`} checked={!!o.correcta}
                       onChange={() => marcarCorrecta(i)}
                       title="Marcar como respuesta correcta" />
                <span className="pregunta-letra">{LETRAS[i]}</span>
                <input type="text" value={o.texto}
                       onChange={e => setOpcion(i, e.target.value)}
                       placeholder={`Opción ${LETRAS[i]}`} />
                {p.opciones.length > 2 && (
                  <button type="button" className="boton-extra-quitar"
                          onClick={() => quitarOpcion(i)} title="Quitar opción">✕</button>
                )}
              </div>
            ))}
          </div>
          {p.opciones.length < 6 && (
            <button type="button" className="button texto" onClick={agregarOpcion}>➕ Agregar opción</button>
          )}
        </>
      )}

      {tipo === 'vf' && (
        <>
          <label>¿Cuál es la respuesta correcta?</label>
          <div className="pregunta-tipos">
            {p.opciones.map((o, i) => (
              <button key={i} type="button"
                      className={`button ${o.correcta ? 'primary' : 'secondary'}`}
                      onClick={() => setP(prev => ({
                        ...prev,
                        opciones: prev.opciones.map((x, j) => ({ ...x, correcta: j === i })),
                      }))}>
                    {o.texto}
              </button>
            ))}
          </div>
        </>
      )}

      {tipo === 'corta' && (
        <>
          <label>Respuesta esperada</label>
          <input type="text" value={p.respuesta} onChange={e => set('respuesta', e.target.value)}
                 placeholder="Ej. TEPT" />
          <p className="nota">
            No importa si escriben mayúsculas o acentos. Para varias respuestas válidas,
            sepáralas con <code>|</code> — Ej. <code>TEPT|trastorno de estrés postraumático</code>
          </p>
        </>
      )}

      {tipo === 'emparejar' && (
        <>
          <label>Pares (premisa → respuesta)</label>
          <div className="pregunta-pares">
            {p.pares.map((par, i) => (
              <div key={par.id || i} className="pregunta-par-fila">
                <input type="text" value={par.premisa}
                       onChange={e => setPar(i, 'premisa', e.target.value)}
                       placeholder="Premisa (p. ej. ACT)" />
                <span className="pregunta-flecha">→</span>
                <input type="text" value={par.respuesta}
                       onChange={e => setPar(i, 'respuesta', e.target.value)}
                       placeholder="Respuesta (p. ej. Aceptar)" />
                {p.pares.length > 2 && (
                  <button type="button" className="boton-extra-quitar"
                          onClick={() => quitarPar(i)} title="Quitar par">✕</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="button texto" onClick={agregarPar}>➕ Agregar par</button>
        </>
      )}

      {error && <p className="aviso-error" style={{ marginTop: 10 }}>{error}</p>}

      <div className="modal-botones" style={{ marginTop: 16 }}>
        <button type="button" className="button secondary" onClick={() => onCancelar(null)}>Cancelar</button>
        <button type="button" className="button primary" onClick={aceptar}>Agregar pregunta</button>
      </div>
    </div>
  )
}

