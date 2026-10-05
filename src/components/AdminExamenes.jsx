import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { tipoDe, ETIQUETA_TIPO } from '../lib/examenes'
import EditorExamen from './EditorExamen'

/**
 * Vista de administración de exámenes.
 * Permite crear/editar un examen a nivel CURSO o a nivel MÓDULO,
 * sin necesidad de entrar a Supabase.
 */
export default function AdminExamenes({ cursoFijo = null }) {
  const [cursos, setCursos] = useState([])
  const [cursoId, setCursoId] = useState(cursoFijo ? String(cursoFijo) : '')
  const [modulos, setModulos] = useState([])
  const [examenes, setExamenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)

  const cargar = async (cid) => {
    try {
      const { data, error: e } = await supabase
        .from('examenes').select('*')
        .or(`curso_id.eq.${cid},modulo_id.not.is.null`)
        .order('id')
      if (e) throw e
      setExamenes(data || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data, error: e } = await supabase
          .from('cursos').select('id, titulo').eq('activo', true).order('orden')
        if (!vivo) return
        if (e) throw e
        setCursos(data || [])
        if (!cursoFijo && data?.length) setCursoId(String(data[0].id))
      } catch (err) {
        if (vivo) setError(err.message)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
    // cursoFijo no cambia mientras el componente vive: lo fija quien
    // lo monta. Meterlo aqui no aporta y relanzaria la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!cursoId) return
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from('modulos').select('id, titulo, orden, activo')
        .eq('curso_id', parseInt(cursoId, 10)).order('orden')
      if (!vivo) return
      setModulos(data || [])
      await cargar(cursoId)
    })()
    return () => { vivo = false }
  }, [cursoId])

  if (cargando) return <div className="loading">Cargando exámenes...</div>
  if (error) return <p className="aviso-error">Error: {error}</p>

  const examenDeModulo = (mid) => examenes.find(e => e.modulo_id === mid && !e.curso_id)
  const examenDeCurso = examenes.find(e => e.curso_id && String(e.curso_id) === String(cursoId))
  const nombreCurso = cursos.find(c => String(c.id) === cursoId)?.titulo || ''

  const resumen = (ex) => {
    if (!ex) return null
    const ps = ex.preguntas || []
    const porTipo = {}
    ps.forEach(p => { const t = tipoDe(p); porTipo[t] = (porTipo[t] || 0) + 1 })
    const detalle = Object.entries(porTipo)
      .map(([t, n]) => `${n} ${ETIQUETA_TIPO[t]?.toLowerCase() || t}`).join(' · ')
    return { total: ps.length, detalle }
  }

  return (
    <>
      <p className="seccion-intro">
        Crea exámenes <strong>autocalificables</strong> en cualquier curso o módulo.
        Puedes escribirlos a mano o pegarlos desde Excel (opción múltiple, verdadero/falso,
        respuesta corta y emparejar). Los alumnos los resuelven y se califican solos.
      </p>

      {/* Dentro de un curso el selector sobra: ya sabes donde estas. */}
      {!cursoFijo && (
      <div className="admin-bloque-nuevo">
        <label>Curso</label>
        <select value={cursoId} onChange={e => setCursoId(e.target.value)}>
          {cursos.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </select>
      </div>
      )}

      {/* Examen a nivel CURSO */}
      <section className="admin-seccion">
        <h3>📗 Examen del curso completo</h3>
        <p className="nota" style={{ marginTop: 0 }}>
          Aparece al final de la página del curso (y de los talleres). Ideal para una evaluación final.
        </p>
        {(() => {
          const r = resumen(examenDeCurso)
          return examenDeCurso ? (
            <div className="examen-fila">
              <div>
                <strong>{examenDeCurso.titulo}</strong>
                <p className="nota" style={{ marginTop: 2 }}>
                  Aprobación {examenDeCurso.umbral_aprobacion}% · {r?.total} preguntas
                  {r?.detalle ? ` · ${r.detalle}` : ''} · {examenDeCurso.activo ? 'activo' : 'inactivo'}
                </p>
              </div>
              <button type="button" className="button secondary"
                      onClick={() => setEditando({ examen: examenDeCurso, destino: { tipo: 'curso', id: parseInt(cursoId, 10), etiqueta: `el curso "${nombreCurso}"` } })}>
                ✏️ Editar
              </button>
            </div>
          ) : (
            <button type="button" className="button primary"
                    onClick={() => setEditando({ examen: null, destino: { tipo: 'curso', id: parseInt(cursoId, 10), etiqueta: `el curso "${nombreCurso}"` } })}>
              ➕ Crear examen del curso
            </button>
          )
        })()}
      </section>

      {/* Exámenes por MÓDULO */}
      <section className="admin-seccion">
        <h3>📘 Exámenes por módulo</h3>
        {modulos.length === 0 ? (
          <p className="sutil">Este curso todavía no tiene módulos.</p>
        ) : (
          <div className="examen-modulos">
            {modulos.map(m => {
              const ex = examenDeModulo(m.id)
              const r = resumen(ex)
              return (
                <div key={m.id} className="examen-fila">
                  <div>
                    <strong>{m.orden}. {m.titulo}</strong>
                    <p className="nota" style={{ marginTop: 2 }}>
                      {ex
                        ? <>Aprobación {ex.umbral_aprobacion}% · {r?.total} preguntas
                            {r?.detalle ? ` · ${r.detalle}` : ''} · {ex.activo ? 'activo' : 'inactivo'}</>
                        : 'Sin examen'}
                    </p>
                  </div>
                  <button type="button" className="button secondary"
                          onClick={() => setEditando({
                            examen: ex,
                            destino: { tipo: 'modulo', id: m.id, etiqueta: `el módulo "${m.titulo}"` },
                          })}>
                    {ex ? '✏️ Editar' : '➕ Crear'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {editando && (
        <EditorExamen
          examen={editando.examen}
          destino={editando.destino}
          onClose={() => setEditando(null)}
          onGuardado={() => cargar(cursoId)}
        />
      )}
    </>
  )
}
