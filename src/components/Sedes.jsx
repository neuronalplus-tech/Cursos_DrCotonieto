/* ============================================================
   SEDES DE UNA ORGANIZACIÓN
   ------------------------------------------------------------
   Planteles, campus o capítulos regionales. Una sede no tiene por
   qué ser un edificio: «En línea» es una sede perfectamente válida,
   y tenerla evita que la mitad de los grupos se queden sin asignar
   solo porque no hay un salón.

   De aquí cuelgan los grupos, y de los grupos la asistencia. Es lo
   que permite preguntar «¿cómo va la sede de Guadalajara?» sin
   recorrer curso por curso.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VACIA = { nombre: '', ciudad: '', direccion: '', responsable: '', activa: true }

export default function Sedes({ organizacion }) {
  const [lista, setLista] = useState([])
  const [grupos, setGrupos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VACIA)
  const [msg, setMsg] = useState(null)

  const recargar = async () => {
    setCargando(true)
    const { data } = await supabase.from('sedes').select('*')
      .eq('organizacion_id', organizacion.id).order('nombre')
    setLista(data || [])

    // Cuántos grupos cuelgan de cada una: borrar una sede con grupos
    // dentro los deja sueltos, y conviene verlo antes de intentarlo.
    const ids = (data || []).map(s => s.id)
    if (ids.length) {
      const { data: gs } = await supabase
        .from('generaciones').select('sede_id').in('sede_id', ids)
      const c = {}
      for (const g of gs || []) c[g.sede_id] = (c[g.sede_id] || 0) + 1
      setGrupos(c)
    }
    setCargando(false)
  }

  useEffect(() => {
    if (organizacion?.id) recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacion?.id])

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const abrirEdicion = (s) => {
    setForm({
      nombre: s.nombre || '',
      ciudad: s.ciudad || '',
      direccion: s.direccion || '',
      responsable: s.responsable || '',
      activa: !!s.activa,
    })
    setEditando(s.id)
    setMsg(null)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return setMsg({ tipo: 'error', texto: 'Ponle un nombre.' })
    const payload = {
      organizacion_id: organizacion.id,
      nombre: form.nombre.trim(),
      ciudad: form.ciudad.trim() || null,
      direccion: form.direccion.trim() || null,
      responsable: form.responsable.trim() || null,
      activa: !!form.activa,
    }
    const { error } = editando === 'nueva'
      ? await supabase.from('sedes').insert(payload)
      : await supabase.from('sedes').update(payload).eq('id', editando)
    if (error) {
      return setMsg({
        tipo: 'error',
        texto: /duplicate|unique/i.test(error.message)
          ? 'Ya hay una sede con ese nombre en esta organización.'
          : 'No se pudo guardar: ' + error.message,
      })
    }
    setEditando(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Sede guardada.' })
  }

  return (
    <div className="sedes">
      <h4>Sedes de {organizacion.nombre}</h4>
      <p className="nota" style={{ marginTop: 0 }}>
        Planteles o capítulos. De aquí cuelgan los grupos. Si todo es en línea,
        con una sede llamada «En línea» basta.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {editando === null ? (
        <button type="button" className="button secondary"
                onClick={() => { setForm(VACIA); setEditando('nueva'); setMsg(null) }}>
          ➕ Nueva sede
        </button>
      ) : (
        <div className="sede-editor">
          <div className="org-editor-fila">
            <div>
              <label>Nombre</label>
              <input className="input" value={form.nombre} autoFocus
                     onChange={e => campo('nombre', e.target.value)}
                     placeholder="Ej. Plantel Guadalajara" />
            </div>
            <div>
              <label>Ciudad</label>
              <input className="input" value={form.ciudad}
                     onChange={e => campo('ciudad', e.target.value)} />
            </div>
          </div>

          <label>Dirección</label>
          <input className="input" value={form.direccion}
                 onChange={e => campo('direccion', e.target.value)} />

          <label>Responsable</label>
          <input className="input" value={form.responsable}
                 onChange={e => campo('responsable', e.target.value)}
                 placeholder="Quien coordina esta sede" />

          <label className="gen-activa">
            <input type="checkbox" checked={form.activa}
                   onChange={e => campo('activa', e.target.checked)} />
            <span>Activa <em className="nota">(se le pueden asignar grupos)</em></span>
          </label>

          <div className="modal-botones" style={{ marginTop: 12 }}>
            <button type="button" className="button secondary"
                    onClick={() => setEditando(null)}>Cancelar</button>
            <button type="button" className="button primary" onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}

      {cargando ? <p className="nota">Cargando…</p> : !lista.length ? (
        <p className="nota">Todavía no hay sedes.</p>
      ) : (
        <div className="org-lista">
          {lista.map(s => (
            <div key={s.id} className={`org-fila ${s.activa ? '' : 'inactiva'}`}>
              <div className="org-fila-datos">
                <strong>{s.nombre}</strong>
                <span className="celda-sub">
                  {[s.ciudad, s.responsable].filter(Boolean).join(' · ') || 'Sin datos'}
                </span>
              </div>
              <span className="badge neutro">{grupos[s.id] || 0} grupo(s)</span>
              {!s.activa && <span className="badge inactivo">Inactiva</span>}
              <button type="button" className="button texto"
                      onClick={() => abrirEdicion(s)}>✏️ Editar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
