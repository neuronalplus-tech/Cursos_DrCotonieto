/* ============================================================
   ADMINISTRACIÓN DEL FORO
   ------------------------------------------------------------
   Solo el admin entra aquí (la pestaña existe únicamente dentro del
   panel). Desde aquí:
   · abre hilos (la regla: solo él puede abrirlos)
   · fija, cierra, borra y edita
   · ve el detalle de cada tema
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sanear, resumen, aTextoPlano, esTextoPlano } from '../lib/foro'
import { ModalPortal } from './ui'
import EditorForo from './EditorForo'

export default function AdminForo() {
  const [cursos, setCursos] = useState([])
  const [cursoId, setCursoId] = useState('')
  const [hilos, setHilos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('cursos').select('id, titulo').order('titulo')
      setCursos(data || [])
      if (data?.length) setCursoId(String(data[0].id))
    })()
  }, [])

  useEffect(() => {
    if (!cursoId) return
    setCargando(true)
    ;(async () => {
      const { data } = await supabase
        .from('foro_hilos').select('*')
        .eq('curso_id', cursoId)
        .order('fijado', { ascending: false })
        .order('actualizado_en', { ascending: false })
      setHilos(data || [])
      setCargando(false)
    })()
  }, [cursoId])

  const abrirNuevo = () => {
    setEditando(null)
    setTitulo('')
    setCuerpo('')
    setMsg(null)
    setFormAbierto(true)
  }

  const abrirEdicion = (h) => {
    setEditando(h)
    setTitulo(h.titulo || '')
    setCuerpo(h.cuerpo || '')
    setMsg(null)
    setFormAbierto(true)
  }

  const guardar = async () => {
    if (!titulo.trim()) return setMsg({ tipo: 'error', texto: 'El título es obligatorio.' })
    if (!cursoId) return setMsg({ tipo: 'error', texto: 'Elige un curso.' })
    setGuardando(true)
    const payload = {
      curso_id: Number(cursoId),
      titulo: titulo.trim(),
      cuerpo: sanear(cuerpo),
      actualizado_en: new Date().toISOString(),
    }
    const { error } = editando
      ? await supabase.from('foro_hilos').update(payload).eq('id', editando.id)
      : await supabase.from('foro_hilos').insert({
          ...payload,
          autor_id: editando?.autor_id || null,
          autor_nombre: editando?.autor_nombre || 'Dr. Ernesto Cotonieto',
          autor_email: editando?.autor_email || '',
        })
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
    setFormAbierto(false)
    setMsg({ tipo: 'ok', texto: editando ? 'Tema actualizado.' : 'Tema publicado. Ya lo ven los inscritos.' })
  }

  const alternar = async (h, campo) => {
    const { error } = await supabase
      .from('foro_hilos')
      .update({ [campo]: !h[campo] })
      .eq('id', h.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo cambiar: ' + error.message })
  }

  const borrar = async (h) => {
    if (!window.confirm(`¿Eliminar el tema "${h.titulo}" y todas sus respuestas?`)) return
    const { error } = await supabase.from('foro_hilos').delete().eq('id', h.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
    setMsg({ tipo: 'ok', texto: 'Tema eliminado.' })
  }
return (
    <div className="admin-foro">
      <p className="seccion-intro">
        Abre los temas del foro. Los alumnos registrados en el curso los leen y
        responden sin necesidad de autorización.
      </p>

      <div className="admin-foro-barra">
        <label>Curso</label>
        <select className="input" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
          {cursos.length === 0 && <option value="">No hay cursos</option>}
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </select>
        <button type="button" className="button primary" onClick={abrirNuevo}
                disabled={!cursoId || cursos.length === 0}>
          ➕ Nuevo tema
        </button>
      </div>

      {msg && (
        <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} style={{ marginBottom: 14 }}>
          {msg.texto}
        </p>
      )}

      {cargando ? (
        <p className="nota">Cargando…</p>
      ) : !hilos.length ? (
        <p className="nota">
          Este curso aún no tiene temas. Pulsa <strong>Nuevo tema</strong> para abrir el primero.
        </p>
      ) : (
        <div className="admin-foro-lista">
          {hilos.map((h) => (
            <article key={h.id} className={`admin-foro-item${h.fijado ? ' fijado' : ''}`}>
              <div className="admin-foro-item-cab">
                {h.fijado && <span className="foro-insignia">📌 Fijado</span>}
                {h.cerrado && <span className="foro-insignia cerrado">🔒 Cerrado</span>}
                <strong>{h.titulo}</strong>
              </div>
              {h.cuerpo && <p className="admin-foro-resumen">{resumen(h.cuerpo, 200)}</p>}
              <div className="admin-foro-acciones">
                <button type="button" className="button texto" onClick={() => alternar(h, 'fijado')}>
                  {h.fijado ? '📌 Quitar fijado' : '📌 Fijar'}
                </button>
                <button type="button" className="button texto" onClick={() => alternar(h, 'cerrado')}>
                  {h.cerrado ? '🔓 Reabrir' : '🔒 Cerrar'}
                </button>
                <button type="button" className="button texto" onClick={() => abrirEdicion(h)}>✏️ Editar</button>
                <button type="button" className="button texto peligro" onClick={() => borrar(h)}>🗑️ Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {formAbierto && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setFormAbierto(false)}>
            <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
              <h3>{editando ? 'Editar tema' : 'Nuevo tema'}</h3>

              <label>Título</label>
              <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)}
                     placeholder="Ej. Duda sobre el caso del módulo 2" autoFocus />

              <label style={{ marginTop: 14 }}>Contenido</label>
              <EditorForo valor={cuerpo} onChange={setCuerpo} minAlto={160} />

              {msg && (
                <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} style={{ marginTop: 10 }}>
                  {msg.texto}
                </p>
              )}

              <div className="modal-botones">
                <button type="button" className="button secondary" onClick={() => setFormAbierto(false)}>
                  Cancelar
                </button>
                <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar tema'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}