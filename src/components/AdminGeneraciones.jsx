/* ============================================================
   GENERACIONES DE UN CURSO
   ------------------------------------------------------------
   Una institución no da "un curso": da "Diplomado 2026-1", con
   fechas y cupo. El mismo curso se imparte varias veces y cada
   edición tiene su grupo y sus resultados.

   No confundir con la RUTA (`acceso.grupo`), que son dos caminos
   en paralelo dentro de la misma edición. La generación es cuándo
   lo cursaste; la ruta, por dónde. Se combinan.
   ============================================================ */

import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import { MODALIDADES, llevaAsistencia } from '../lib/asistencia'
import PaseDeLista from './PaseDeLista'

const VACIA = {
  nombre: '', fecha_inicio: '', fecha_fin: '', cupo: '', activa: true,
  // En línea por omisión: es lo que son casi todos, y así nadie
  // ve un pase de lista que no va a usar.
  modalidad: 'linea', sede_id: '',
}

export default function AdminGeneraciones({ cursoId }) {
  const [gens, setGens] = useState([])
  const [conteo, setConteo] = useState({})
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)   // id | 'nueva' | null
  const [form, setForm] = useState(VACIA)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const { organizacion } = useOrganizacion()
  const [sedes, setSedes] = useState([])
  const [listaAbierta, setListaAbierta] = useState(null)

  useEffect(() => {
    if (!organizacion?.id) return
    let vivo = true
    supabase.from('sedes').select('id, nombre')
      .eq('organizacion_id', organizacion.id).eq('activa', true).order('nombre')
      .then(({ data }) => { if (vivo) setSedes(data || []) })
    return () => { vivo = false }
  }, [organizacion?.id])

  const recargar = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('generaciones').select('*')
      .eq('curso_id', Number(cursoId))
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .order('nombre')
    if (error) setMsg({ tipo: 'error', texto: 'No se pudieron cargar: ' + error.message })
    else setGens(data || [])

    // Cuántos hay en cada una, en una sola consulta.
    const { data: acc } = await supabase
      .from('acceso').select('generacion_id').eq('curso_id', Number(cursoId))
    const c = {}
    for (const a of acc || []) {
      if (a.generacion_id) c[a.generacion_id] = (c[a.generacion_id] || 0) + 1
    }
    setConteo(c)
    setCargando(false)
  }

  useEffect(() => { if (cursoId) recargar() }, [cursoId])

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const abrirNueva = () => {
    // Propone la siguiente del año: "2026-1", "2026-2"…
    const anio = new Date().getFullYear()
    const delAnio = gens.filter(g => (g.nombre || '').startsWith(String(anio))).length
    setForm({ ...VACIA, nombre: `${anio}-${delAnio + 1}` })
    setEditando('nueva')
    setMsg(null)
  }

  const abrirEdicion = (g) => {
    setForm({
      nombre: g.nombre || '',
      fecha_inicio: g.fecha_inicio || '',
      fecha_fin: g.fecha_fin || '',
      cupo: g.cupo ?? '',
      activa: !!g.activa,
      modalidad: g.modalidad || 'linea',
      sede_id: g.sede_id ?? '',
    })
    setEditando(g.id)
    setMsg(null)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return setMsg({ tipo: 'error', texto: 'Ponle un nombre.' })
    setGuardando(true)
    const payload = {
      curso_id: Number(cursoId),
      nombre: form.nombre.trim(),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      // Vacío = sin límite. Obligar a un número inventado solo
      // llenaría la base de cupos que nadie respeta.
      cupo: form.cupo === '' ? null : Number(form.cupo),
      activa: !!form.activa,
      modalidad: form.modalidad || 'linea',
      sede_id: form.sede_id === '' ? null : Number(form.sede_id),
    }
    const { error } = editando === 'nueva'
      ? await supabase.from('generaciones').insert(payload)
      : await supabase.from('generaciones').update(payload).eq('id', editando)
    setGuardando(false)
    if (error) {
      return setMsg({
        tipo: 'error',
        texto: /duplicate|unique/i.test(error.message)
          ? 'Ya hay una generación con ese nombre en este curso.'
          : 'No se pudo guardar: ' + error.message,
      })
    }
    await recargar()
    setEditando(null)
    setMsg({ tipo: 'ok', texto: 'Generación guardada.' })
  }

  const borrar = async (g) => {
    const n = conteo[g.id] || 0
    const aviso = n
      ? `"${g.nombre}" tiene ${n} inscrito(s). No se desinscribe a nadie: solo pierden la etiqueta de generación.\n\n¿Continuar?`
      : `¿Eliminar la generación "${g.nombre}"?`
    if (!window.confirm(aviso)) return
    const { error } = await supabase.from('generaciones').delete().eq('id', g.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Generación eliminada.' })
  }

  const fecha = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX',
    { day: 'numeric', month: 'short', year: 'numeric' }) : null

  return (
    <div className="generaciones">
      <p className="nota">
        Cada edición del curso con sus fechas y su grupo. Los reportes se pueden
        filtrar por generación, que es como se mide de verdad: no «cómo va el
        curso», sino «cómo salió la generación de marzo».
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {editando === null && (
        <button type="button" className="button primary" onClick={abrirNueva}>
          ➕ Nueva generación
        </button>
      )}

      {editando !== null && (
        <div className="gen-editor">
          <h4>{editando === 'nueva' ? 'Nueva generación' : 'Editar generación'}</h4>

          <label>Nombre</label>
          <input className="input" value={form.nombre} autoFocus
                 onChange={e => campo('nombre', e.target.value)}
                 placeholder="Ej. 2026-1 · Marzo 2026" />

          <div className="gen-editor-fila">
            <div>
              <label>Inicio</label>
              <input className="input" type="date" value={form.fecha_inicio}
                     onChange={e => campo('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <label>Fin</label>
              <input className="input" type="date" value={form.fecha_fin}
                     onChange={e => campo('fecha_fin', e.target.value)} />
            </div>
            <div>
              <label>Cupo</label>
              <input className="input" type="number" min="1" value={form.cupo}
                     onChange={e => campo('cupo', e.target.value)}
                     placeholder="Sin límite" />
            </div>
          </div>

          <div className="gen-editor-fila">
            <div>
              <label>Modalidad</label>
              <select className="input" value={form.modalidad}
                      onChange={e => campo('modalidad', e.target.value)}>
                {MODALIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <p className="nota">
                {llevaAsistencia(form.modalidad)
                  ? 'Este grupo tendrá pase de lista.'
                  : 'Sin pase de lista. Cámbialo a mixta si hay sesiones en vivo.'}
              </p>
            </div>
            <div>
              <label>Sede</label>
              <select className="input" value={form.sede_id}
                      onChange={e => campo('sede_id', e.target.value)}>
                <option value="">Sin sede</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              {!sedes.length && (
                <p className="nota">Aún no hay sedes. Se dan de alta en Organizaciones.</p>
              )}
            </div>
          </div>

          <label className="gen-activa">
            <input type="checkbox" checked={form.activa}
                   onChange={e => campo('activa', e.target.checked)} />
            <span>Abierta <em className="nota">(se puede inscribir gente)</em></span>
          </label>

          <div className="modal-botones" style={{ marginTop: 14 }}>
            <button type="button" className="button secondary"
                    onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</button>
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {cargando ? <p className="nota">Cargando…</p> : (
        <div className="gen-lista">
          {gens.map(g => {
            const n = conteo[g.id] || 0
            const lleno = g.cupo && n >= g.cupo
            return (
              <Fragment key={g.id}>
              <div className={`gen-fila ${g.activa ? '' : 'cerrada'}`}>
                <div className="gen-fila-datos">
                  <strong>{g.nombre}</strong>
                  <span className="celda-sub">
                    {fecha(g.fecha_inicio) && `${fecha(g.fecha_inicio)}`}
                    {fecha(g.fecha_fin) && ` — ${fecha(g.fecha_fin)}`}
                    {!g.fecha_inicio && !g.fecha_fin && 'Sin fechas'}
                  </span>
                </div>
                <span className={`badge ${lleno ? 'inactivo' : 'ok'}`}>
                  {n}{g.cupo ? ` / ${g.cupo}` : ''}
                </span>
                {!g.activa && <span className="badge neutro">Cerrada</span>}
                <button type="button" className="button texto"
                        onClick={() => abrirEdicion(g)}>✏️</button>
                {llevaAsistencia(g.modalidad) && (
                  <button type="button" className="button secondary"
                          onClick={() => setListaAbierta(listaAbierta?.id === g.id ? null : g)}>
                    {listaAbierta?.id === g.id ? '▲ Cerrar lista' : '🗓️ Pase de lista'}
                  </button>
                )}
                <button type="button" className="button texto peligro"
                        onClick={() => borrar(g)}>🗑️</button>
              </div>

              {/* El pase de lista se abre DEBAJO del grupo y no en
                  otra pantalla: quien lo usa está de pie en el salón
                  y no quiere navegar. */}
              {listaAbierta?.id === g.id && (
                <div className="gen-lista-panel">
                  <PaseDeLista generacion={g} cursoId={cursoId} />
                </div>
              )}
              </Fragment>
            )
          })}
          {!gens.length && (
            <p className="nota">
              Todavía no hay generaciones. Mientras no crees ninguna, los inscritos
              se cuentan todos juntos, como hasta ahora.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
