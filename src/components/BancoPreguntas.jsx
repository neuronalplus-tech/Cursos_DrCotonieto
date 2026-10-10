/* ============================================================
   BANCO DE PREGUNTAS
   ------------------------------------------------------------
   Dos piezas en un archivo porque comparten los mismos filtros y
   la misma lista:

     · BancoPreguntas  — la pestaña del panel: escribir, importar,
                         editar y borrar preguntas.
     · SelectorBanco   — el modal que se abre DESDE un examen para
                         traer preguntas al examen que estás
                         armando.

   Las preguntas se copian al examen, no se enlazan: corregir una
   pregunta del banco no debe cambiar un examen que ya respondieron
   (ver el comentario largo en src/lib/banco.js).
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import {
  TIPOS_EXAMEN, ETIQUETA_TIPO, tipoDe,
  parseTabla, filasAPreguntas, preguntasATSV, descargarTSV, PLANTILLA_TSV,
} from '../lib/examenes'
import {
  DIFICULTADES, ETIQUETA_DIFICULTAD,
  aPregunta, aFila, filtrar, temasDe, tomarAlAzar,
} from '../lib/banco'
import { ModalPortal } from './ui'
import EditorPregunta from './EditorPregunta'

/* ------------------------------------------------------------
   Lo que se ve de una pregunta sin abrirla: el enunciado y, para
   poder distinguir dos parecidas, la respuesta correcta.
   ------------------------------------------------------------ */
function Resumen({ fila }) {
  const tipo = fila.tipo
  const c = fila.contenido || {}
  if (tipo === 'opcion' || tipo === 'vf') {
    const correcta = (c.opciones || []).find(o => o.correcta)
    return <span className="celda-sub">Correcta: {correcta?.texto || '—'}</span>
  }
  if (tipo === 'corta') {
    return <span className="celda-sub">Respuesta: {c.respuesta || '—'}</span>
  }
  return <span className="celda-sub">{(c.pares || []).length} par(es)</span>
}

function Filtros({ f, setF, temas, children }) {
  return (
    <div className="banco-filtros">
      <input className="input" type="search" value={f.busca}
             onChange={e => setF({ ...f, busca: e.target.value })}
             placeholder="Buscar en el enunciado…" />
      <select className="input" value={f.tema} onChange={e => setF({ ...f, tema: e.target.value })}>
        <option value="">Todos los temas</option>
        {temas.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>
        <option value="">Todos los tipos</option>
        {TIPOS_EXAMEN.map(t => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
      </select>
      <select className="input" value={f.dificultad}
              onChange={e => setF({ ...f, dificultad: e.target.value })}>
        <option value="">Toda dificultad</option>
        {DIFICULTADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {children}
    </div>
  )
}

const FILTROS_VACIOS = { busca: '', tema: '', tipo: '', dificultad: '' }

/** Carga el banco de la organización actual. Devuelve también cómo recargarlo. */
function useBanco() {
  const { organizacion } = useOrganizacion()
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const orgId = organizacion?.id

  const recargar = async () => {
    if (!orgId) return
    setCargando(true)
    const { data, error: e } = await supabase
      .from('banco_preguntas').select('*')
      .eq('organizacion_id', orgId)
      .eq('activa', true)
      .order('creado_en', { ascending: false })
    if (e) setError(e.message)
    else { setFilas(data || []); setError(null) }
    setCargando(false)
  }

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    recargar()
    // Solo depende de la organización: `recargar` se redefine en cada
    // render y ponerla aquí relanzaría la consulta sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  return { filas, cargando, error, recargar, orgId }
}

/* ============================================================
   LA PESTAÑA DEL PANEL
   ============================================================ */
export default function BancoPreguntas() {
  const { filas, cargando, error, recargar, orgId } = useBanco()
  const [f, setF] = useState(FILTROS_VACIOS)
  const [msg, setMsg] = useState(null)
  const [editando, setEditando] = useState(null)   // { fila | null }
  const [importando, setImportando] = useState(false)
  const [pegado, setPegado] = useState('')
  const [errores, setErrores] = useState([])
  const [temaImport, setTemaImport] = useState('')
  const [guardando, setGuardando] = useState(false)

  const temas = useMemo(() => temasDe(filas), [filas])
  const visibles = useMemo(() => filtrar(filas, f), [filas, f])

  const correoActual = async () => {
    const { data } = await supabase.auth.getUser()
    return data?.user?.email?.toLowerCase() || null
  }

  /* --- Escribir o editar una --- */
  const guardarUna = async (pregunta, meta) => {
    if (!pregunta) { setEditando(null); return }
    setGuardando(true)
    const fila = aFila(pregunta, {
      organizacionId: orgId,
      tema: meta.tema,
      dificultad: meta.dificultad,
    })
    const { error: e } = editando?.fila
      ? await supabase.from('banco_preguntas').update(fila).eq('id', editando.fila.id)
      : await supabase.from('banco_preguntas')
          .insert({ ...fila, creado_por: await correoActual() })
    setGuardando(false)
    if (e) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + e.message })
    setEditando(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Pregunta guardada en el banco.' })
  }

  /* --- Importar una tanda desde Excel --- */
  const importar = async () => {
    const { preguntas, errores: errs } = filasAPreguntas(parseTabla(pegado))
    if (!preguntas.length) {
      setErrores(errs.length ? errs : ['No encontré preguntas. Pega una tabla con columna "pregunta".'])
      return
    }
    setGuardando(true)
    const correo = await correoActual()
    const payload = preguntas.map(p => ({
      ...aFila(p, { organizacionId: orgId, tema: temaImport, dificultad: null }),
      creado_por: correo,
    }))
    const { error: e } = await supabase.from('banco_preguntas').insert(payload)
    setGuardando(false)
    if (e) return setMsg({ tipo: 'error', texto: 'No se pudo importar: ' + e.message })
    setErrores(errs)
    setPegado('')
    setImportando(false)
    await recargar()
    setMsg({
      tipo: 'ok',
      texto: `${preguntas.length} pregunta(s) al banco` +
        (errs.length ? ` · ${errs.length} fila(s) con problemas, revísalas abajo.` : '.'),
    })
  }

  const borrar = async (fila) => {
    if (!confirm(`¿Quitar del banco "${fila.pregunta.slice(0, 60)}…"?\n\nLos exámenes que ya la usan NO se tocan: tienen su propia copia.`)) return
    const { error: e } = await supabase.from('banco_preguntas').delete().eq('id', fila.id)
    if (e) return setMsg({ tipo: 'error', texto: 'No se pudo quitar: ' + e.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Pregunta quitada del banco.' })
  }

  const exportar = () => {
    descargarTSV(preguntasATSV(visibles.map(aPregunta)), 'banco-preguntas.tsv')
  }

  if (!orgId && !cargando) {
    return (
      <p className="aviso-error">
        No pude saber de qué organización es este sitio, así que no sé en qué
        banco guardar. Corre <code>ORGANIZACIONES_1_BASE.sql</code> si no lo has
        hecho.
      </p>
    )
  }

  return (
    <div className="banco">
      <p className="seccion-intro">
        Preguntas que puedes reutilizar en cualquier examen de tus cursos. Al
        traerlas a un examen se copian, así que corregir una aquí no cambia un
        examen que ya respondieron tus alumnos.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}
      {error && <p className="aviso-error">No se pudo cargar el banco: {error}</p>}

      <div className="examen-import-botones">
        <button type="button" className="button primary"
                onClick={() => { setEditando({ fila: null }); setMsg(null) }}>
          ✍️ Escribir una pregunta
        </button>
        <button type="button" className="button secondary"
                onClick={() => { setImportando(v => !v); setMsg(null) }}>
          📋 Importar desde Excel
        </button>
        {visibles.length > 0 && (
          <button type="button" className="button texto" onClick={exportar}>
            ⬇️ Descargar {visibles.length === filas.length ? 'el banco' : 'lo filtrado'}
          </button>
        )}
      </div>

      {importando && (
        <div className="examen-import">
          <h4>📋 Importar una tanda</h4>
          <p className="nota" style={{ marginTop: 0 }}>
            Misma plantilla que los exámenes. Lo que pegues entra al banco, no a
            un examen.
          </p>
          <label>Tema para toda la tanda (opcional)</label>
          <input className="input" value={temaImport} list="banco-temas"
                 onChange={e => setTemaImport(e.target.value)}
                 placeholder="Ej. Duelo prolongado" />
          <datalist id="banco-temas">
            {temas.map(t => <option key={t} value={t} />)}
          </datalist>

          <div className="examen-import-botones" style={{ marginTop: 10 }}>
            <button type="button" className="button texto"
                    onClick={() => descargarTSV(PLANTILLA_TSV, 'plantilla-banco.tsv')}>
              ⬇️ Descargar plantilla
            </button>
            <button type="button" className="button texto"
                    onClick={() => setPegado(PLANTILLA_TSV)}>🧪 Pegar ejemplo</button>
          </div>
          <img className="plantilla-carga-ejemplo" src="/plantillas/ejemplo-preguntas.svg" alt="Ejemplo de columnas TSV para cargar preguntas al banco" />
          <textarea className="examen-textarea" rows={6} value={pegado}
                    onChange={e => setPegado(e.target.value)}
                    placeholder="Pega aquí la tabla copiada de Excel o Google Sheets." />
          <div className="examen-import-botones">
            <button type="button" className="button secondary" onClick={importar}
                    disabled={!pegado.trim() || guardando}>
              {guardando ? 'Guardando…' : '➕ Importar al banco'}
            </button>
            <button type="button" className="button texto"
                    onClick={() => { setImportando(false); setPegado(''); setErrores([]) }}>
              Cerrar
            </button>
          </div>
          {errores.length > 0 && (
            <div className="aviso-error" style={{ marginTop: 10 }}>
              <strong>{errores.length} fila(s) se saltaron:</strong>
              <ul>{errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {cargando ? <p className="nota">Cargando el banco…</p> : (
        <>
          <Filtros f={f} setF={setF} temas={temas}>
            <span className="banco-cuenta">
              {visibles.length} de {filas.length}
            </span>
          </Filtros>

          {!filas.length ? (
            <p className="nota">
              El banco está vacío. Escribe una pregunta o importa una tanda; a
              partir de ahí las tendrás disponibles en todos tus exámenes.
            </p>
          ) : !visibles.length ? (
            <p className="nota">Ninguna pregunta coincide con el filtro.</p>
          ) : (
            <div className="gestion-tabla-scroll">
              <table className="gestion-tabla">
                <thead>
                  <tr>
                    <th>Pregunta</th><th>Tema</th><th>Tipo</th>
                    <th>Dificultad</th><th className="col-acciones"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(fila => (
                    <tr key={fila.id}>
                      <td>
                        <strong>{fila.pregunta}</strong>
                        <Resumen fila={fila} />
                      </td>
                      <td>{fila.tema || <span className="sutil">—</span>}</td>
                      <td><span className="badge neutro">{ETIQUETA_TIPO[fila.tipo] || fila.tipo}</span></td>
                      <td>
                        {fila.dificultad
                          ? ETIQUETA_DIFICULTAD[fila.dificultad]
                          : <span className="sutil">—</span>}
                      </td>
                      <td className="col-acciones">
                        <button type="button" className="button texto"
                                onClick={() => { setEditando({ fila }); setMsg(null) }}>✏️ Editar</button>
                        <button type="button" className="button texto"
                                onClick={() => borrar(fila)}>🗑️ Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editando && (
        <EditorDeFila fila={editando.fila} temas={temas}
                      guardando={guardando}
                      onGuardar={guardarUna}
                      onCancelar={() => setEditando(null)} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   Escribir una pregunta del banco: el mismo editor de siempre más
   el tema y la dificultad, que solo existen en el banco.
   ------------------------------------------------------------ */
function EditorDeFila({ fila, temas, guardando, onGuardar, onCancelar }) {
  const [tema, setTema] = useState(fila?.tema || '')
  const [dificultad, setDificultad] = useState(fila?.dificultad || '')

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => !guardando && onCancelar()}>
        <div className="modal-box modal-recurso modal-examen" onClick={e => e.stopPropagation()}>
          <h3>{fila ? '✏️ Editar pregunta del banco' : '✍️ Nueva pregunta del banco'}</h3>

          <div className="org-editor-fila">
            <div>
              <label>Tema</label>
              <input className="input" value={tema} list="banco-temas-editor"
                     onChange={e => setTema(e.target.value)}
                     placeholder="Ej. Duelo prolongado" />
              <datalist id="banco-temas-editor">
                {temas.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label>Dificultad</label>
              <select className="input" value={dificultad}
                      onChange={e => setDificultad(e.target.value)}>
                <option value="">Sin clasificar</option>
                {DIFICULTADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          </div>
          <p className="nota">
            El tema es para encontrarla después. Si dejas todo sin tema, dentro
            de cien preguntas no vas a poder armar un examen sin leerlas todas.
          </p>

          <EditorPregunta
            inicial={fila ? aPregunta(fila) : null}
            indice={null}
            textoGuardar={fila ? 'Guardar cambios' : 'Guardar en el banco'}
            onGuardar={(p) => onGuardar(p, { tema, dificultad })}
            onCancelar={() => onCancelar()}
          />
        </div>
      </div>
    </ModalPortal>
  )
}

/* ============================================================
   EL SELECTOR, QUE SE ABRE DESDE UN EXAMEN
   ------------------------------------------------------------
   `onAgregar(preguntas)` recibe las preguntas ya en formato de
   examen. Quien lo llama es responsable de darles ids libres, que
   es lo que hace `agregarPreguntas`.
   ============================================================ */
export function SelectorBanco({ yaEnExamen = [], onAgregar, onCerrar }) {
  const { filas, cargando, error } = useBanco()
  const [f, setF] = useState(FILTROS_VACIOS)
  const [marcadas, setMarcadas] = useState(new Set())
  const [cuantas, setCuantas] = useState('10')

  const temas = useMemo(() => temasDe(filas), [filas])
  const visibles = useMemo(() => filtrar(filas, f), [filas, f])

  // Lo que ya está en el examen se muestra pero no se puede marcar:
  // agregarla dos veces haría que contara doble en la calificación.
  const usadas = useMemo(
    () => new Set((yaEnExamen || []).map(p => p.banco_id).filter(v => v != null)),
    [yaEnExamen])

  const alternar = (id) => setMarcadas(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const disponibles = visibles.filter(x => !usadas.has(x.id))

  const marcarTodas = () => setMarcadas(new Set(disponibles.map(x => x.id)))
  const desmarcar = () => setMarcadas(new Set())

  const sortear = () => {
    const n = parseInt(cuantas, 10)
    if (!n || n < 1) return
    setMarcadas(new Set(tomarAlAzar(disponibles, n).map(x => x.id)))
  }

  const agregar = () => {
    const elegidas = filas.filter(x => marcadas.has(x.id)).map(aPregunta)
    if (elegidas.length) onAgregar(elegidas)
    onCerrar()
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onCerrar}>
        <div className="modal-box modal-recurso modal-examen" onClick={e => e.stopPropagation()}>
          <h3>📚 Traer preguntas del banco</h3>
          <p className="nota" style={{ marginTop: 0 }}>
            Se copian al examen. Lo que edites después aquí no cambia el banco,
            ni al revés.
          </p>

          {error && <p className="aviso-error">No se pudo cargar el banco: {error}</p>}
          {cargando ? <p className="nota">Cargando…</p> : !filas.length ? (
            <p className="nota">
              El banco está vacío todavía. Llénalo desde el panel de
              administración, pestaña «Banco de preguntas».
            </p>
          ) : (
            <>
              <Filtros f={f} setF={setF} temas={temas} />

              <div className="banco-sorteo">
                <span>Tomar al azar</span>
                <input className="input" type="number" min="1" max="100" value={cuantas}
                       onChange={e => setCuantas(e.target.value)} />
                <button type="button" className="button secondary" onClick={sortear}
                        disabled={!disponibles.length}>🎲 Sortear</button>
                <button type="button" className="button texto" onClick={marcarTodas}
                        disabled={!disponibles.length}>Marcar todas</button>
                <button type="button" className="button texto" onClick={desmarcar}
                        disabled={!marcadas.size}>Ninguna</button>
              </div>
              <p className="nota">
                El sorteo es sobre lo filtrado y ocurre <strong>ahora</strong>, al
                armar el examen: todos tus alumnos verán las mismas preguntas. Que
                a cada uno le toque un sorteo distinto es otra cosa y todavía no
                está hecha.
              </p>

              <ul className="banco-seleccion">
                {disponibles.map(x => (
                  <li key={x.id} className={marcadas.has(x.id) ? 'marcada' : ''}>
                    <label>
                      <input type="checkbox" checked={marcadas.has(x.id)}
                             onChange={() => alternar(x.id)} />
                      <span className="banco-sel-texto">
                        <strong>{x.pregunta}</strong>
                        <span className="celda-sub">
                          {ETIQUETA_TIPO[x.tipo] || x.tipo}
                          {x.tema ? ` · ${x.tema}` : ''}
                          {x.dificultad ? ` · ${ETIQUETA_DIFICULTAD[x.dificultad]}` : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              {visibles.length > disponibles.length && (
                <p className="nota">
                  {visibles.length - disponibles.length} pregunta(s) del filtro ya
                  están en este examen y no se listan.
                </p>
              )}
              {!disponibles.length && visibles.length > 0 && (
                <p className="nota">Todas las del filtro ya están en el examen.</p>
              )}
            </>
          )}

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary" onClick={onCerrar}>Cancelar</button>
            <button type="button" className="button primary" onClick={agregar}
                    disabled={!marcadas.size}>
              Agregar {marcadas.size || ''} al examen
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

/* ============================================================
   MANDAR AL BANCO LAS PREGUNTAS DE UN EXAMEN
   ------------------------------------------------------------
   El camino inverso, y el que más se usa al principio: ya tienes
   exámenes escritos y quieres cosechar esas preguntas sin volver a
   teclearlas.
   ============================================================ */
export function GuardarEnBanco({ preguntas, onCerrar }) {
  const { filas, orgId, recargar } = useBanco()
  const [tema, setTema] = useState('')
  const [dificultad, setDificultad] = useState('')
  const [marcadas, setMarcadas] = useState(new Set((preguntas || []).map((_, i) => i)))
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const temas = useMemo(() => temasDe(filas), [filas])

  // Si ya salió del banco, volver a guardarla crea un duplicado.
  const yaDelBanco = (p) => p.banco_id != null

  const alternar = (i) => setMarcadas(prev => {
    const n = new Set(prev)
    if (n.has(i)) n.delete(i); else n.add(i)
    return n
  })

  const guardar = async () => {
    const elegidas = (preguntas || []).filter((_, i) => marcadas.has(i))
    if (!elegidas.length) return
    setGuardando(true)
    const { data: u } = await supabase.auth.getUser()
    const correo = u?.user?.email?.toLowerCase() || null
    const payload = elegidas.map(p => ({
      ...aFila(p, { organizacionId: orgId, tema, dificultad }),
      creado_por: correo,
    }))
    const { error } = await supabase.from('banco_preguntas').insert(payload)
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: `${elegidas.length} pregunta(s) guardada(s) en el banco.` })
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => !guardando && onCerrar()}>
        <div className="modal-box modal-recurso modal-examen" onClick={e => e.stopPropagation()}>
          <h3>📥 Guardar estas preguntas en el banco</h3>
          <p className="nota" style={{ marginTop: 0 }}>
            Quedan disponibles para cualquier otro examen. El examen actual no
            cambia.
          </p>

          {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

          <div className="org-editor-fila">
            <div>
              <label>Tema</label>
              <input className="input" value={tema} list="banco-temas-guardar"
                     onChange={e => setTema(e.target.value)}
                     placeholder="Ej. Duelo prolongado" />
              <datalist id="banco-temas-guardar">
                {temas.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label>Dificultad</label>
              <select className="input" value={dificultad}
                      onChange={e => setDificultad(e.target.value)}>
                <option value="">Sin clasificar</option>
                {DIFICULTADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          </div>
          <p className="nota">Se aplican a todas las que marques.</p>

          <ul className="banco-seleccion">
            {(preguntas || []).map((p, i) => (
              <li key={p.id || i} className={marcadas.has(i) ? 'marcada' : ''}>
                <label>
                  <input type="checkbox" checked={marcadas.has(i)}
                         onChange={() => alternar(i)} />
                  <span className="banco-sel-texto">
                    <strong>{p.pregunta}</strong>
                    <span className="celda-sub">
                      {ETIQUETA_TIPO[tipoDe(p)] || tipoDe(p)}
                      {yaDelBanco(p) && ' · ya venía del banco'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary"
                    onClick={onCerrar} disabled={guardando}>Cerrar</button>
            <button type="button" className="button primary" onClick={guardar}
                    disabled={guardando || !marcadas.size}>
              {guardando ? 'Guardando…' : `Guardar ${marcadas.size || ''} en el banco`}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
