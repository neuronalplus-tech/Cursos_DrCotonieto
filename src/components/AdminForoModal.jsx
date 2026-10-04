/* ============================================================
   ADMINISTRACIÓN DEL FORO (MODAL)
   ============================================================
   Interfaz integrada dentro del curso para que el admin
   gestione los temas del foro sin dejar la página del curso.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sanear, resumen } from '../lib/foro'
import { ModalPortal } from './ui'
import EditorForo from './EditorForo'

export default function AdminForoModal({ cursoId, user, onClose }) {
  const [hilos, setHilos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [autor, setAutor] = useState(null)

  useEffect(() => {
    if (!user) return
    let vivo = true
    ;(async () => {
      const { data } = await supabase
        .from('perfiles').select('nombre_completo').eq('id', user.id).maybeSingle()
      if (!vivo) return
      setAutor({
        nombre: data?.nombre_completo || user.email || 'Administración',
        email: user.email || '',
      })
    })()
    return () => { vivo = false }
  }, [user])

  useEffect(() => {
    recargar()
  }, [cursoId])

  const recargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('foro_hilos').select('*')
      .eq('curso_id', Number(cursoId))
      .order('fijado', { ascending: false })
      .order('actualizado_en', { ascending: false })
    if (data) setHilos(data)
    setCargando(false)
  }

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

  const guardar = async (cuerpoFinal) => {
    const contenido = cuerpoFinal !== undefined ? cuerpoFinal : cuerpo
    if (!titulo.trim()) return setMsg({ tipo: 'error', texto: 'El título es obligatorio.' })
    if (!user?.id) return setMsg({ tipo: 'error', texto: 'Tu sesión expiró. Vuelve a entrar.' })

    setGuardando(true)
    const payload = {
      curso_id: Number(cursoId),
      titulo: titulo.trim(),
      cuerpo: sanear(contenido),
      actualizado_en: new Date().toISOString(),
    }

    const { error } = editando
      ? await supabase.from('foro_hilos').update({
          ...payload,
          autor_id: user.id,
          autor_nombre: autor?.nombre || user.email || 'Administración',
          autor_email: autor?.email || user.email || '',
        }).eq('id', editando.id)
      : await supabase.from('foro_hilos').insert({
          ...payload,
          autor_id: user.id,
          autor_nombre: autor?.nombre || user.email || 'Administración',
          autor_email: autor?.email || user.email || '',
        })

    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })

    await recargar()
    setFormAbierto(false)
    setMsg({ tipo: 'ok', texto: editando ? 'Tema actualizado.' : 'Tema publicado.' })
  }

  const alternar = async (h, campo) => {
    const { error } = await supabase
      .from('foro_hilos')
      .update({ [campo]: !h[campo] })
      .eq('id', h.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo cambiar: ' + error.message })
    await recargar()
  }

  const borrar = async (h) => {
    if (!window.confirm(`¿Eliminar el tema "${h.titulo}" y todas sus respuestas?`)) return
    const { error } = await supabase.from('foro_hilos').delete().eq('id', h.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Tema eliminado.' })
  }

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
             style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <h2>🔧 Administración del foro</h2>

            <p className="nota" style={{ marginBottom: 14 }}>
              Aquí puedes crear, editar, fijar o cerrar los temas del foro.
            </p>

            {msg && (
              <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} style={{ marginBottom: 14 }}>
                {msg.texto}
              </p>
            )}

            <button type="button" className="button primary" onClick={abrirNuevo}
                    style={{ marginBottom: 16 }}>
              ➕ Nuevo tema
            </button>

            {cargando ? (
              <p className="nota">Cargando temas…</p>
            ) : !hilos.length ? (
              <p className="nota">
                No hay temas aún. Crea uno para que los estudiantes puedan ver y responder.
              </p>
            ) : (
              <div className="admin-foro-lista" style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16 }}>
                {hilos.map((h) => (
                  <article key={h.id} className={`admin-foro-item${h.fijado ? ' fijado' : ''}`}
                           style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #e0e0e0' }}>
                    <div className="admin-foro-item-cab">
                      {h.fijado && <span className="foro-insignia">📌 Fijado</span>}
                      {h.cerrado && <span className="foro-insignia cerrado">🔒 Cerrado</span>}
                      <strong style={{ flex: 1 }}>{h.titulo}</strong>
                    </div>
                    {h.cuerpo && (
                      <p className="admin-foro-resumen" style={{ margin: '8px 0', fontSize: '0.9em', color: '#666' }}>
                        {resumen(h.cuerpo, 160)}
                      </p>
                    )}
                    <div className="admin-foro-acciones" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <button type="button" className="button texto" onClick={() => alternar(h, 'fijado')}
                              style={{ fontSize: '0.85em' }}>
                        {h.fijado ? '📌 Quitar fijado' : '📌 Fijar'}
                      </button>
                      <button type="button" className="button texto" onClick={() => alternar(h, 'cerrado')}
                              style={{ fontSize: '0.85em' }}>
                        {h.cerrado ? '🔓 Reabrir' : '🔒 Cerrar'}
                      </button>
                      <button type="button" className="button texto" onClick={() => abrirEdicion(h)}
                              style={{ fontSize: '0.85em' }}>
                        ✏️ Editar
                      </button>
                      <button type="button" className="button texto peligro" onClick={() => borrar(h)}
                              style={{ fontSize: '0.85em' }}>
                        🗑️ Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {formAbierto && (
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, marginTop: 16 }}>
              <h3>{editando ? 'Editar tema' : 'Nuevo tema'}</h3>

              <label>Título</label>
              <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)}
                     placeholder="Ej. Duda sobre el caso del módulo 2" autoFocus />

              <label style={{ marginTop: 14 }}>Contenido</label>
              <EditorForo valor={cuerpo} onChange={setCuerpo} minAlto={120} onGuardar={guardar} />

              {msg && (
                <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} style={{ marginTop: 10 }}>
                  {msg.texto}
                </p>
              )}

              <div className="modal-botones" style={{ marginTop: 14 }}>
                <button type="button" className="button secondary" onClick={() => setFormAbierto(false)}>
                  Cancelar
                </button>
                <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar tema'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
