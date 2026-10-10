import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import {
  TIPOS_EXAMEN, ETIQUETA_TIPO, tipoDe,
  parseTabla, filasAPreguntas, preguntasATSV, descargarTSV, PLANTILLA_TSV,
} from '../lib/examenes'
import { agregarPreguntas } from '../lib/banco'
import EditorPregunta from './EditorPregunta'
import { SelectorBanco, GuardarEnBanco } from './BancoPreguntas'
import Prorrogas, { CamposPlazo } from './Prorrogas'

function ModalPortal({ children }) {
  return createPortal(children, document.body)
}

/**
 * Editor / creador de exámenes (solo admin).
 *
 * destino = { tipo: 'modulo' | 'curso', id: number, etiqueta: string }
 *   · tipo 'modulo' → guarda en examenes.modulo_id  (se ve en la página del módulo)
 *   · tipo 'curso'  → guarda en examenes.curso_id   (se ve en la página del curso/taller)
 *
 *examén existente = null → se crea uno nuevo.
 */
export default function EditorExamen({ examen, destino, onClose, onGuardado }) {
  const esNuevo = !examen?.id
  const [titulo, setTitulo] = useState(examen?.titulo || '')
  const [descripcion, setDescripcion] = useState(examen?.descripcion || '')
  const [umbral, setUmbral] = useState(examen?.umbral_aprobacion ?? 70)
  const [maxIntentos, setMaxIntentos] = useState(examen?.max_intentos ?? 3)
  const [limiteMinutos, setLimiteMinutos] = useState(examen?.limite_minutos ?? '')
  // Cuántas preguntas servir por intento (nulo = todas) y si se revuelve
  // el orden de las opciones. Lo usa servir_examen() en la base.
  const [aleatorioN, setAleatorioN] = useState(examen?.aleatorio_n ?? '')
  const [mezclar, setMezclar] = useState(examen?.mezclar_opciones === true)
  const [activo, setActivo] = useState(examen?.activo !== false)
  const [fechaLimite, setFechaLimite] = useState(examen?.fecha_limite || null)
  const [cierraAlVencer, setCierraAlVencer] = useState(examen?.cierra_al_vencer !== false)
  const [preguntas, setPreguntas] = useState(examen?.preguntas || [])
  const [editandoPregunta, setEditandoPregunta] = useState(null) // {indice, pregunta} | {indice:null}
  const [bancoAbierto, setBancoAbierto] = useState(false)
  const [guardarBanco, setGuardarBanco] = useState(false)
  const [pegado, setPegado] = useState('')
  const [errores, setErrores] = useState([])
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  const fileRef = useRef(null)

  const abrirNueva = () => setEditandoPregunta({ indice: null, pregunta: null })
  const abrirExisting = (i) => setEditandoPregunta({ indice: i, pregunta: preguntas[i] })

  const cerrarEditor = (resultado) => {
    if (resultado) {
      setPreguntas(prev => {
        // Al EDITAR se conserva el id: las respuestas de los alumnos se
        // guardan indexadas por él, y cambiarlo dejaría huérfanos los
        // intentos ya hechos.
        if (editandoPregunta.indice != null) {
          return prev.map((q, i) => (i === editandoPregunta.indice ? resultado : q))
        }
        // Al AGREGAR hay que buscarle un id libre: el editor siempre
        // propone "p1", y en un examen que ya tiene p1 eso hacía que dos
        // preguntas compartieran identificador. La respuesta de una se
        // leía entonces como la de la otra al calificar.
        return agregarPreguntas(prev, [resultado])
      })
    }
    setEditandoPregunta(null)
  }

  const mover = (i, delta) =>
    setPreguntas(prev => {
      const j = i + delta
      if (j < 0 || j >= prev.length) return prev
      const copia = [...prev]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })

  const convert = () => {
    const filas = parseTabla(pegado)
    const { preguntas: nuevas, errores: errs } = filasAPreguntas(filas)
    if (!nuevas.length) {
      setErrores(errs.length ? errs : ['No encontré preguntas. Pega una tabla con columna "pregunta".'])
      return
    }
    // `filasAPreguntas` numera siempre desde p1, así que una segunda
    // tanda chocaba con la primera. Ver el comentario en cerrarEditor.
    setPreguntas(prev => agregarPreguntas(prev, nuevas))
    setErrores(errs)
    setPegado('')
    setMsg(`✓ ${nuevas.length} pregunta(s) agregada(s)${errs.length ? ` · ${errs.length} fila(s) con problemas` : ''}.`)
  }

  const leerArchivo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const lector = new FileReader()
    lector.onload = () => setPegado(String(lector.result || ''))
    lector.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const guardar = async () => {
    if (!titulo.trim()) { setMsg('El título es obligatorio.'); return }
    if (!preguntas.length) { setMsg('Agrega al menos una pregunta.'); return }

    const payload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      umbral_aprobacion: Math.max(0, Math.min(100, parseInt(umbral, 10) || 0)),
      max_intentos: Math.max(0, parseInt(maxIntentos, 10) || 0),
      ...(limiteMinutos === ''
        ? (Object.prototype.hasOwnProperty.call(examen || {}, 'limite_minutos') ? { limite_minutos: null } : {})
        : { limite_minutos: Math.min(600, Math.max(1, parseInt(limiteMinutos, 10) || 1)) }),
      // Vacío = todas (lo mismo que hoy). Solo se manda si la base ya
      // tiene las columnas; si el SQL aún no se corrió, PostgREST
      // rechaza la columna y se reintenta sin ella.
      ...(aleatorioN === '' || aleatorioN == null ? {} : { aleatorio_n: Math.max(0, parseInt(aleatorioN, 10) || 0) }),
      ...(mezclar ? { mezclar_opciones: true } : {}),
      activo,
      fecha_limite: fechaLimite,
      cierra_al_vencer: cierraAlVencer,
      preguntas,
      [destino.tipo === 'modulo' ? 'modulo_id' : 'curso_id']: destino.id,
    }

    setGuardando(true); setMsg('')
    // Guarda con reintento: si la base aún no tiene las columnas
    // nuevas (SQL sin correr), PostgREST rechaza aleatorio_n y se
    // reintenta sin ellas en vez de dejar el examen sin guardar.
    const guardarUna = async (cuerpo) => {
      const q = supabase.from('examenes')
      return esNuevo
        ? await q.insert(cuerpo).select().single()
        : await q.update(cuerpo).eq('id', examen.id).select().single()
    }
    try {
      let { data, error } = await guardarUna(payload)
      if (error && /aleatorio_n|mezclar_opciones/.test(error.message || '')) {
        const { aleatorio_n, mezclar_opciones, ...viejo } = payload
        ;({ data, error } = await guardarUna(viejo))
      }
      if (error) throw error
      onGuardado(data)
      onClose()
    } catch (e) {
      setMsg('Error al guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = () => {
    if (!confirm('¿Eliminar este examen y todos los intentos de los alumnos? No se puede deshacer.')) return
    supabase.from('intentos_examen').delete().eq('examen_id', examen.id)
      .then(({ error }) => {
        if (error) { setMsg('Error al borrar intentos: ' + error.message); return }
        return supabase.from('examenes').delete().eq('id', examen.id)
      })
      .then(({ error }) => {
        if (error) { setMsg('Error al borrar examen: ' + error.message); return }
        onGuardado(null)
        onClose()
      })
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => !guardando && onClose()}>
        <div className="modal-box modal-recurso modal-examen" onClick={e => e.stopPropagation()}>
          <h3>{esNuevo ? '➕ Nuevo examen' : '✏️ Editar examen'}</h3>
          <p className="nota" style={{ marginTop: 0 }}>
            Se guarda en <strong>{destino.etiqueta}</strong>
            {destino.tipo === 'modulo'
              ? ' y aparecerá al final de la página del módulo.'
              : ' y aparecerá en la página del curso/taller.'}
          </p>

          <label>Título del examen</label>
          <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
                 placeholder="Ej. Examen — Módulo 1: evaluación diferencial" />

          <label>Descripción (opcional)</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                 placeholder="Ej. 10 preguntas, sin límite de intentos" />

          <label>Porcentaje mínimo para aprobar</label>
          <input type="number" min="0" max="100" value={umbral}
                 onChange={e => setUmbral(e.target.value)} />
          <p className="nota">Con 70 el alumno aprueba con el 70% de aciertos.</p>

          <label>Intentos permitidos por alumno</label>
          <input type="number" min="0" max="20" value={maxIntentos}
                 onChange={e => setMaxIntentos(e.target.value)} />
          <p className="nota">
            Al agotarlos se muestra <strong>solo la mejor calificación</strong>.
            Escribe <strong>0</strong> para dejar intentos ilimitados.
          </p>

          <label>Límite de tiempo por intento (minutos)</label>
          <input type="number" min="1" max="600" value={limiteMinutos}
                 onChange={e => setLimiteMinutos(e.target.value)} placeholder="Sin límite" />
          <p className="nota">Al terminar el tiempo, las respuestas se envían automáticamente.</p>

          <label>Preguntas por intento (aleatorio)</label>
          <input type="number" min="0" value={aleatorioN}
                 onChange={e => setAleatorioN(e.target.value)}
                 placeholder="Vacío = todas" />
          <p className="nota">
            Si pones <strong>2</strong> en un examen de 5, a cada alumno le tocan
            2 distintas. Vacío es lo mismo que hoy: todos ven todas.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={mezclar} onChange={e => setMezclar(e.target.checked)} />
            Revolver el orden de las opciones en cada pregunta
          </label>

          <CamposPlazo fecha={fechaLimite} cierra={cierraAlVencer}
                       onFecha={setFechaLimite} onCierra={setCierraAlVencer} />

          {!esNuevo && (
            <Prorrogas tipo="examen" actividadId={examen.id}
                       cursoId={destino.tipo === 'curso' ? destino.id : examen.curso_id}
                       fechaOriginal={fechaLimite} />
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
            Examen activo (visible para los alumnos)
          </label>

          {/* ---------- CARGA MASIVA ---------- */}
          <div className="examen-import">
            <h4>📋 Cargar preguntas desde Excel / Sheets</h4>
            <p className="nota" style={{ marginTop: 0 }}>
              Pega aquí la tabla copiada de Excel o Google Sheets (o sube un <code>.csv</code>/<code>.tsv</code>).
              Se reconoce el tabulador automáticamente.
            </p>
            <div className="examen-import-botones">
              <button type="button" className="button texto"
                      onClick={() => descargarTSV(PLANTILLA_TSV, 'plantilla-examen.tsv')}>
                ⬇️ Descargar plantilla
              </button>
              <button type="button" className="button texto" onClick={() => fileRef.current?.click()}>
                📁 Subir archivo
              </button>
              <button type="button" className="button texto" onClick={() => setPegado(PLANTILLA_TSV)}>
                🧪 Pegar ejemplo
              </button>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                     style={{ display: 'none' }} onChange={leerArchivo} />
            </div>
            <img className="plantilla-carga-ejemplo" src="/plantillas/ejemplo-preguntas.svg" alt="Ejemplo de columnas TSV para cargar preguntas al examen" />
            <textarea className="examen-textarea" rows={6} value={pegado}
                      onChange={e => setPegado(e.target.value)}
                      placeholder={'tipo\tpregunta\top1\top2\top3\top4\top5\tcorrecta\trespuesta\tpares\n' +
                                   'opcion\t¿Cuál es...?\tA\tB\tC\t\t2\t\t\n' +
                                   'vf\tEl duelo normativo dura menos de un año.\t\t\t\t\t\t1\t\t\n' +
                                   'corta\t¿Qué siglas tiene TEPT?\t\t\t\t\t\t\tTEPT|trastorno de estrés postraumático\t\n' +
                                   'emparejar\tRelaciona\t\t\t\t\t\t\t\tACT=Aceptar; DBT=Regular'} />
            <div className="examen-import-botones">
              <button type="button" className="button secondary" onClick={convert}
                      disabled={!pegado.trim()}>
                ➕ Convertir y agregar
              </button>
              <button type="button" className="button texto" onClick={() => setPegado('')} disabled={!pegado}>
                Limpiar
              </button>
            </div>

            <details className="examen-ayuda">
              <summary>¿Cómo lleno cada columna?</summary>
              <ul>
                <li><code>tipo</code> — <code>opcion</code>, <code>vf</code>, <code>corta</code> o <code>emparejar</code>. Vacío = <code>opcion</code>.</li>
                <li><code>pregunta</code> — el enunciado (obligatorio).</li>
                <li><code>op1</code>…<code>op5</code> — opciones en orden. No se usan en <code>vf</code> ni <code>corta</code>.</li>
                <li><code>correcta</code> — en <code>opcion</code>: el <strong>número</strong> (1 = primera) o el texto exacto. En <code>vf</code>: <code>1</code>=Verdadero, <code>0</code>=Falso.</li>
                <li><code>respuesta</code> — solo <code>corta</code>. Variantes con <code>|</code>.</li>
                <li><code>pares</code> — solo <code>emparejar</code>: <code>ACT=Aceptar; DBT=Regular</code>.</li>
              </ul>
            </details>

            {errores.length > 0 && (
              <div className="aviso-error" style={{ marginTop: 10 }}>
                <strong>{errores.length} fila(s) se saltaron:</strong>
                <ul>{errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
          </div>

          {/* ---------- PREGUNTAS ---------- */}
          <h4>Preguntas ({preguntas.length})</h4>

          <div className="examen-import-botones">
            <button type="button" className="button primary" onClick={abrirNueva}>
              ✍️ Escribir pregunta a mano
            </button>
            <button type="button" className="button secondary" onClick={() => setBancoAbierto(true)}>
              📚 Traer del banco
            </button>
            {preguntas.length > 0 && (
              <button type="button" className="button texto" onClick={() => setGuardarBanco(true)}>
                📥 Guardar estas en el banco
              </button>
            )}
          </div>

          {bancoAbierto && (
            <SelectorBanco
              yaEnExamen={preguntas}
              onAgregar={(nuevas) => setPreguntas(prev => agregarPreguntas(prev, nuevas))}
              onCerrar={() => setBancoAbierto(false)}
            />
          )}

          {guardarBanco && (
            <GuardarEnBanco preguntas={preguntas} onCerrar={() => setGuardarBanco(false)} />
          )}

          {editandoPregunta && (
            <EditorPregunta
              inicial={editandoPregunta.pregunta}
              indice={editandoPregunta.indice}
              onGuardar={cerrarEditor}
              onCancelar={cerrarEditor}
            />
          )}

          {preguntas.length === 0 ? (
            <p className="sutil">Todavía no hay preguntas. Pega una tabla arriba y presiona "Convertir y agregar".</p>
          ) : (
            <ol className="examen-lista-admin">
              {preguntas.map((p, i) => (
                <li key={p.id || i}>
                  <div className="examen-lista-cab">
                    <span className="badge">{ETIQUETA_TIPO[tipoDe(p)] || tipoDe(p)}</span>
                    <span className="examen-lista-acciones">
                      <button type="button" className="button texto" title="Subir"
                              onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
                      <button type="button" className="button texto" title="Bajar"
                              onClick={() => mover(i, 1)} disabled={i === preguntas.length - 1}>↓</button>
                      <button type="button" className="button texto"
                              onClick={() => abrirExisting(i)}>✏️ Editar</button>
                      <button type="button" className="button texto"
                              onClick={() => setPreguntas(prev => prev.filter((_, j) => j !== i))}>
                        🗑️ Quitar
                      </button>
                    </span>
                  </div>
                  <p className="examen-pregunta">{p.pregunta}</p>
                  {tipoDe(p) === 'opcion' && (
                    <ul className="examen-lista-ops">
                      {(p.opciones || []).map((o, j) => (
                        <li key={j}>{o.correcta ? '✅' : '⬜'} {o.texto}</li>
                      ))}
                    </ul>
                  )}
                  {tipoDe(p) === 'vf' && (
                    <p className="sutil">Correcta: {(p.opciones || []).find(o => o.correcta)?.texto || 'Verdadero'}</p>
                  )}
                  {tipoDe(p) === 'corta' && <p className="sutil">Respuesta: {p.respuesta}</p>}
                  {tipoDe(p) === 'emparejar' && (
                    <ul className="examen-lista-ops">
                      {(p.pares || []).map((x, j) => <li key={j}>{x.premisa} → {x.respuesta}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}

          {preguntas.length > 0 && (
            <button type="button" className="button texto" style={{ marginTop: 8 }}
                    onClick={() => descargarTSV(preguntasATSV(preguntas), 'examen-editar.tsv')}>
              ⬇️ Descargar estas preguntas para editarlas en Excel
            </button>
          )}

          {msg && <p className={msg.startsWith('✓') ? 'aviso-ok' : 'aviso-error'} style={{ marginTop: 12 }}>{msg}</p>}

          <div className="modal-botones" style={{ marginTop: 18 }}>
            {!esNuevo && (
              <button type="button" className="button texto" onClick={eliminar} disabled={guardando}
                      style={{ marginRight: 'auto', color: '#9B2C20' }}>
                🗑️ Eliminar examen
              </button>
            )}
            <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : esNuevo ? 'Crear examen' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

export { TIPOS_EXAMEN }

