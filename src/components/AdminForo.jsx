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

export default function AdminForo({ user }) {
  const [cursos, setCursos] = useState([])
  const [cursoId, setCursoId] = useState('')
  const [hilos, setHilos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  /* Estos dos faltaban aquí y sí estaban en el editor de dentro del
     curso, así que un tema creado desde el panel central nunca podía
     calificarse y no había forma de notarlo salvo echándolo en falta.
     Mismos nombres y mismos valores por omisión que allá: si vuelven a
     separarse, vuelve el mismo problema. */
  const [califica, setCalifica] = useState(false)
  const [puntosMax, setPuntosMax] = useState(10)
  const [guardando, setGuardando] = useState(false)
  // Nombre real del admin, para la firma del tema. Sin esto el INSERT
  // guardaba autor_id = null y el NOT NULL de la tabla lo rechazaba.
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
      await recargar()
      setCargando(false)
    })()
  }, [cursoId])

  const abrirNuevo = () => {
    setEditando(null)
    setTitulo('')
    setCalifica(false)
    setPuntosMax(10)
    setCuerpo('')
    setMsg(null)
    setFormAbierto(true)
  }

  const abrirEdicion = (h) => {
    setEditando(h)
    setTitulo(h.titulo || '')
    setCalifica(!!h.califica)
    setPuntosMax(h.puntos_max ?? 10)
    setCuerpo(h.cuerpo || '')
    setMsg(null)
    setFormAbierto(true)
  }

  const guardar = async (cuerpoFinal) => {
    // Permite que el editor HTML pase el contenido ya saneado: al pulsar
    // "Aplicar y guardar" se guarda exactamente eso, sin un segundo paso.
    const contenido = cuerpoFinal !== undefined ? cuerpoFinal : cuerpo
    if (!titulo.trim()) return setMsg({ tipo: 'error', texto: 'El título es obligatorio.' })
    if (!cursoId) return setMsg({ tipo: 'error', texto: 'Elige un curso.' })
    if (!user?.id) return setMsg({ tipo: 'error', texto: 'Tu sesión expiró. Vuelve a entrar.' })
    setGuardando(true)
    const payload = {
      curso_id: Number(cursoId),
      titulo: titulo.trim(),
      cuerpo: sanear(contenido),
      califica,
      puntos_max: Number(puntosMax) || 10,
      actualizado_en: new Date().toISOString(),
    }
    // Al editar solo se manda el cuerpo; al crear, también la firma. Y la
    // firma SIEMPRE es la del admin que pulsa, nunca la de un tema anterior.
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
    // Se recarga la lista: si no, el tema nuevo no aparece hasta que se
    // cambia de curso, y parece que el guardado no funcionó.
    const { data: frescos } = await supabase
      .from('foro_hilos').select('*')
      .eq('curso_id', cursoId)
      .order('fijado', { ascending: false })
      .order('actualizado_en', { ascending: false })
    setHilos(frescos || [])
    setFormAbierto(false)
    setMsg({ tipo: 'ok', texto: editando ? 'Tema actualizado.' : 'Tema publicado. Ya lo ven los inscritos.' })
  }

  const recargar = async (id = cursoId) => {
    if (!id) return
    // El id se manda como número a propósito: curso_id es un entero y el
    // <select> da texto. Enviar "1" obliga a Postgres a coercir y hacia que
    // las consultas no coincidan con la columna.
    const { data } = await supabase
      .from('foro_hilos').select('*')
      .eq('curso_id', Number(id))
      .order('fijado', { ascending: false })
      .order('actualizado_en', { ascending: false })
    setHilos(data || [])
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

              {/* Sin rúbrica desplegable a propósito: lo que se espera se
                  escribe en el cuerpo del tema, que es donde el alumno ya
                  está mirando cuando va a responder. */}
              <label className="foro-evaluable">
                <input type="checkbox" checked={califica}
                       onChange={(e) => setCalifica(e.target.checked)} />
                <span>
                  <strong>Calificar las aportaciones</strong>
                  <em className="nota">
                    La nota de cada quien será el promedio de sus aportaciones.
                  </em>
                </span>
              </label>
              {califica && (
                <>
                  <label style={{ marginTop: 10 }}>Puntaje máximo por aportación</label>
                  <input className="input" type="number" min="1" value={puntosMax}
                         onChange={(e) => setPuntosMax(e.target.value)} />
                </>
              )}
              <label style={{ marginTop: 14 }}>Contenido</label>
              <EditorForo valor={cuerpo} onChange={setCuerpo} minAlto={160} onGuardar={guardar} />

              {msg && (
                <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'} style={{ marginTop: 10 }}>
                  {msg.texto}
                </p>
              )}

              <div className="modal-botones">
                <button type="button" className="button secondary" onClick={() => setFormAbierto(false)}>
                  Cancelar
                </button>
                <button type="button" className="button primary" onClick={() => guardar()} disabled={guardando}>
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