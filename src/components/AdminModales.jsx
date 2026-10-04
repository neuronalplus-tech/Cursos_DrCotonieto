import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ModalPortal, EditorBotonesExtra } from './ui'

/**
 * Modales de administraciÃ³n del curso: botones de ruta, alta de mÃ³dulo y
 * botones extra de un mÃ³dulo. Los tres comparten el mismo esqueleto de
 * guardado: validar â†’ supabase â†’ onGuardado â†’ cerrar.
 */

/* Botones de una ruta/subgrupo dentro de un curso. */
export function ModalEditarBotonesRuta({ curso, grupo, onClose, onGuardado }) {
  const [botones, setBotones] = useState(curso.rutas_botones?.[grupo]?.length ? curso.rutas_botones[grupo] : [])
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      const botonesValidos = botones.filter(b => b.texto.trim() && b.url.trim())
      const nuevoMapa = { ...(curso.rutas_botones || {}), [grupo]: botonesValidos }
      const { data, error } = await supabase.from('cursos')
        .update({ rutas_botones: nuevoMapa }).eq('id', curso.id).select().single()
      if (error) throw error
      onGuardado(data)
      onClose()
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal-box modal-recurso" onClick={e => e.stopPropagation()}>
        <h3>ðŸ”— Botones de "{grupo}"</h3>
        <p className="nota" style={{ marginTop: 0 }}>
          Se muestran arriba de los mÃ³dulos de esta ruta/subgrupo, para todos. BÃ³rralos cuando ya no apliquen.
        </p>
        <EditorBotonesExtra botones={botones} onChange={setBotones} />

{msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
/* Alta de un mÃ³dulo dentro del curso. */
export function ModalNuevoModulo({ cursoId, orden, onClose, onCreado }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [grupo, setGrupo] = useState('')
  const [ordenVal, setOrdenVal] = useState(orden ?? 100)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const crear = async () => {
    if (!titulo.trim()) { setMsg('El tÃ­tulo es obligatorio'); return }
    setGuardando(true); setMsg('')
    try {
      const { data, error } = await supabase.from('modulos').insert({
        curso_id:    cursoId,
        titulo:      titulo.trim(),
        descripcion: descripcion.trim() || null,
        orden:       parseInt(ordenVal, 10) || 100,
        grupo:       grupo.trim() || null,
        oculto:      false,
        disponible:  true,
        activo:      true,
      }).select().single()
      if (error) throw error
      onCreado(data)
      onClose()
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal-box modal-recurso" onClick={e => e.stopPropagation()}>
        <h3>âž• Nuevo mÃ³dulo</h3>

        <label>TÃ­tulo</label>
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
               placeholder="Ej. GrabaciÃ³n del taller" />

        <label>DescripciÃ³n</label>
        <textarea rows="3" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Texto que aparece debajo del tÃ­tulo" />

        <label>Subgrupo (grupo)</label>
        <input type="text" value={grupo} onChange={e => setGrupo(e.target.value)}
               placeholder="VacÃ­o = visible para todo el curso" />

        <label>Orden</label>
        <input type="number" value={ordenVal} onChange={e => setOrdenVal(e.target.value)} />

        {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={crear} disabled={guardando}>
            {guardando ? 'Creando...' : 'Crear mÃ³dulo'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

/* Botones extra de un mÃ³dulo concreto. */
export function ModalEditarBotonesModulo({ modulo, onClose, onGuardado }) {
  const [botones, setBotones] = useState(modulo.botones_extra?.length ? modulo.botones_extra : [])
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      const botonesValidos = botones.filter(b => b.texto.trim() && b.url.trim())
      const { data, error } = await supabase.from('modulos')
        .update({ botones_extra: botonesValidos }).eq('id', modulo.id).select().single()
      if (error) throw error
      onGuardado(data)
      onClose()
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal-box modal-recurso" onClick={e => e.stopPropagation()}>
        <h3>ðŸ”— Botones de "{modulo.titulo}"</h3>
        <p className="nota" style={{ marginTop: 0 }}>
          Se muestran arriba del mÃ³dulo, para todos. Ãštil para un registro puntual, una liga de examen, etc.
          BÃ³rralos cuando ya no apliquen.
        </p>
        <EditorBotonesExtra botones={botones} onChange={setBotones} />

        {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
