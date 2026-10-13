import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ModalPortal, EditorBotonesExtra } from './ui'
import { aCampoLocal, deCampoLocal } from '../lib/plazos'

/**
 * Modales de administración del curso: botones de ruta, alta de módulo y
 * botones extra de un módulo. Los tres comparten el mismo esqueleto de
 * guardado: validar → supabase → onGuardado → cerrar.
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
        <h3>🔗 Botones de "{grupo}"</h3>
        <p className="nota" style={{ marginTop: 0 }}>
          Se muestran arriba de los módulos de esta ruta/subgrupo, para todos. Bórralos cuando ya no apliquen.
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
/* Alta de un módulo dentro del curso. */
export function ModalNuevoModulo({ cursoId, orden, onClose, onCreado }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [grupo, setGrupo] = useState('')
  const [ordenVal, setOrdenVal] = useState(orden ?? 100)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const crear = async () => {
    if (!titulo.trim()) { setMsg('El título es obligatorio'); return }
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
        <h3>➕ Nuevo módulo</h3>

        <label>Título</label>
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
               placeholder="Ej. Grabación del taller" />

        <label>Descripción</label>
        <textarea rows="3" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Texto que aparece debajo del título" />

        <label>Subgrupo (grupo)</label>
        <input type="text" value={grupo} onChange={e => setGrupo(e.target.value)}
               placeholder="Vacío = visible para todo el curso" />

        <label>Orden</label>
        <input type="number" value={ordenVal} onChange={e => setOrdenVal(e.target.value)} />

        {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={crear} disabled={guardando}>
            {guardando ? 'Creando...' : 'Crear módulo'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

/* Edición de un módulo ya creado. Antes esto no existía: título,
   descripción, orden y subgrupo solo se escribían al crear o al duplicar,
   así que corregir una errata obligaba a entrar a Supabase.

   `oculto` y `disponible` son DOS interruptores distintos a propósito:
     · oculto = el alumno no lo ve ni en la lista lateral.
     · disponible = visible pero cerrado ("próximamente").
   (La casilla `oculto` necesita la columna que crea MODULOS_VISIBILIDAD.sql;
   el alta de módulos ya la escribe, así que la dependencia es la misma.) */
export function ModalEditarModulo({ modulo, modulos = [], onClose, onGuardado }) {
  const [titulo, setTitulo] = useState(modulo.titulo || '')
  const [descripcion, setDescripcion] = useState(modulo.descripcion || '')
  const [grupo, setGrupo] = useState(modulo.grupo || '')
  const [ordenVal, setOrdenVal] = useState(modulo.orden ?? 100)
  const [oculto, setOculto] = useState(modulo.oculto === true)
  const [disponible, setDisponible] = useState(modulo.disponible !== false)
  const [abreEl, setAbreEl] = useState(aCampoLocal(modulo.abre_el))
  const [cierraEl, setCierraEl] = useState(aCampoLocal(modulo.cierra_el))
  const [requiere, setRequiere] = useState(modulo.requiere_modulo_id || '')
  // Los demás módulos del curso, para el prerrequisito (no puede requerirse
  // a sí mismo).
  const otrosModulos = (modulos || []).filter(x => x.id !== modulo.id)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const guardar = async () => {
    if (!titulo.trim()) { setMsg('El título es obligatorio'); return }
    setGuardando(true); setMsg('')
    const base = {
      titulo:      titulo.trim(),
      descripcion: descripcion.trim() || null,
      orden:       parseInt(ordenVal, 10) || 100,
      grupo:       grupo.trim() || null,
      disponible,
    }
    // Columnas que dependen de un SQL que podría no estar corrido:
    // `oculto` (MODULOS_VISIBILIDAD.sql) y las fechas (MODULOS_FECHAS.sql).
    // Si faltan, el update entero fallaría con "column does not exist" y
    // no se podría ni corregir un título. Por eso: se intenta con todo y,
    // si la base dice que una columna no existe, se reintenta sin ellas.
    const completo = {
      ...base, oculto,
      abre_el: deCampoLocal(abreEl), cierra_el: deCampoLocal(cierraEl),
      requiere_modulo_id: requiere ? Number(requiere) : null,
    }
    let degradado = false
    try {
      let { data, error } = await supabase.from('modulos')
        .update(completo).eq('id', modulo.id).select().single()
      if (error && (error.code === '42703' || /column .* does not exist|could not find/i.test(error.message || ''))) {
        const r = await supabase.from('modulos').update(base).eq('id', modulo.id).select().single()
        data = r.data; error = r.error; degradado = true
      }
      if (error) throw error
      onGuardado(data)
      if (degradado) {
        setMsg('Guardado. Las fechas, «oculto» y el prerrequisito necesitan correr MODULOS_VISIBILIDAD.sql, MODULOS_FECHAS.sql y MODULOS_PRERREQUISITO.sql en Supabase.')
      } else {
        onClose()
      }
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalPortal onClose={() => !guardando && onClose()} label="Editar módulo">
    <div className="modal-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal-box modal-recurso" onClick={e => e.stopPropagation()}>
        <h3>✏️ Editar módulo</h3>

        <label htmlFor="em-titulo">Título</label>
        <input id="em-titulo" type="text" value={titulo} onChange={e => setTitulo(e.target.value)} />

        <label htmlFor="em-desc">Descripción</label>
        <textarea id="em-desc" rows="3" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Texto que aparece debajo del título" />

        <label htmlFor="em-grupo">Subgrupo (grupo)</label>
        <input id="em-grupo" type="text" value={grupo} onChange={e => setGrupo(e.target.value)}
               placeholder="Vacío = visible para todo el curso" />

        <label htmlFor="em-orden">Orden</label>
        <input id="em-orden" type="number" value={ordenVal} onChange={e => setOrdenVal(e.target.value)} />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="em-abre">Se abre el <span className="sutil">(opcional)</span></label>
            <input id="em-abre" type="datetime-local" value={abreEl} onChange={e => setAbreEl(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="em-cierra">Se cierra el <span className="sutil">(opcional)</span></label>
            <input id="em-cierra" type="datetime-local" value={cierraEl} onChange={e => setCierraEl(e.target.value)} />
          </div>
        </div>
        <p className="nota">Vacío = lo decide «Disponible». Con fecha de apertura, el alumno no entra hasta ese momento (tú sí).</p>

        {otrosModulos.length > 0 && (
          <>
            <label htmlFor="em-req">Requiere completar antes <span className="sutil">(opcional)</span></label>
            <select id="em-req" className="gestion-select" value={requiere}
                    onChange={e => setRequiere(e.target.value)} style={{ width: '100%' }}>
              <option value="">— Sin prerrequisito —</option>
              {otrosModulos.map(x => <option key={x.id} value={x.id}>{x.titulo}</option>)}
            </select>
            <p className="nota">El alumno no entra a este módulo hasta marcar como vistos todos los recursos del elegido.</p>
          </>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14 }}>
          <input type="checkbox" checked={disponible} onChange={e => setDisponible(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Disponible para alumnos <span className="sutil">(desmárcalo para dejarlo como «próximamente»)</span></span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={oculto} onChange={e => setOculto(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Oculto <span className="sutil">(no aparece en la lista; ni siquiera como «próximamente»)</span></span>
        </label>

        {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

/* Botones extra de un módulo concreto. */
export function ModalEditarBotonesModulo({ modulo, onClose, onGuardado, incluirEntregables = false }) {
  const [botones, setBotones] = useState(() => {
    const actuales = modulo.botones_extra || []
    return !incluirEntregables || actuales.some(b => b.tipo === 'entregables') ? actuales : [
      ...actuales,
      { tipo: 'entregables', texto: '📤 Subir mi entregable a OneDrive', url: 'https://1drv.ms/f/c/a43668d1cdc6e346/IgCxnJ6u1wjqSYKpW0N7eSgzAWc1XQw02u1GwWpkduAL9EI?e=h9CAvA', estilo: 'whatsapp', activo: true },
    ]
  })
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
        <h3>🔗 Botones de "{modulo.titulo}"</h3>
        <p className="nota" style={{ marginTop: 0 }}>
          Se muestran arriba del módulo, para todos. Útil para un registro puntual, una liga de examen, etc.
          Bórralos cuando ya no apliquen.
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
