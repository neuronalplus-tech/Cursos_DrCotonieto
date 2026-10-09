/* ============================================================
   ROLES Y PERMISOS
   ------------------------------------------------------------
   Cada institución nombra sus propios roles —«Coordinación
   académica», «Jefatura de carrera», «Subdirección»— y decide qué
   puede hacer cada uno. Así no hace falta tocar código cada vez que
   aparece una figura nueva.

   EL ÁMBITO ES LA MITAD DEL ASUNTO
   Un rol se asigna a una persona y, opcionalmente, acotado a una
   sede o a una categoría. «Coordinación» y «coordinación de esta
   sede» no son dos roles: son el mismo rol con distinto alcance.

   LO QUE ESTA PANTALLA NO HACE
   Las políticas de la base siguen mirando `admins` y
   `facilitadores`. Un rol de aquí decide qué se ENSEÑA; llevarlo
   también a la base es tabla por tabla y con cuidado.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import { porGrupo, resumenRol, rolVacio, ambitoDe } from '../lib/roles'

export default function AdminRoles() {
  const { organizacion } = useOrganizacion()
  const [catalogo, setCatalogo] = useState([])
  const [roles, setRoles] = useState([])
  const [permisosPorRol, setPermisosPorRol] = useState({})
  const [asignaciones, setAsignaciones] = useState([])
  const [sedes, setSedes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [editando, setEditando] = useState(null)   // id | 'nuevo' | null
  const [form, setForm] = useState({ nombre: '', descripcion: '', activo: true })
  const [marcados, setMarcados] = useState(new Set())

  const [alta, setAlta] = useState({ email: '', rol_id: '', sede_id: '', categoria_id: '' })

  const orgId = organizacion?.id

  const recargar = async () => {
    if (!orgId) return
    setCargando(true)
    const [{ data: cat }, { data: rs }, { data: sd }, { data: ct }] = await Promise.all([
      supabase.from('permisos').select('*').order('orden'),
      supabase.from('roles').select('*').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('sedes').select('id, nombre').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('categorias').select('id, nombre').eq('organizacion_id', orgId).order('nombre'),
    ])
    const ids = (rs || []).map(r => r.id)
    const [{ data: rp }, { data: asg }] = await Promise.all([
      ids.length ? supabase.from('rol_permisos').select('*').in('rol_id', ids) : { data: [] },
      ids.length ? supabase.from('asignaciones_rol').select('*').in('rol_id', ids) : { data: [] },
    ])
    const m = {}
    for (const x of rp || []) (m[x.rol_id] ||= []).push(x.permiso)

    setCatalogo(cat || [])
    setRoles(rs || [])
    setPermisosPorRol(m)
    setAsignaciones(asg || [])
    setSedes(sd || [])
    setCategorias(ct || [])
    setCargando(false)
  }

  useEffect(() => {
    if (orgId) recargar()
    else setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const grupos = useMemo(() => porGrupo(catalogo), [catalogo])

  const sembrar = async () => {
    setGuardando(true)
    const { data, error } = await supabase.rpc('sembrar_roles_basicos', { p_org: orgId })
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: String(data) + ' Revisa sus permisos antes de asignar a nadie.' })
  }

  const abrirNuevo = () => {
    setForm({ nombre: '', descripcion: '', activo: true })
    setMarcados(new Set())
    setEditando('nuevo')
    setMsg(null)
  }

  const abrirEdicion = (r) => {
    setForm({ nombre: r.nombre, descripcion: r.descripcion || '', activo: !!r.activo })
    setMarcados(new Set(permisosPorRol[r.id] || []))
    setEditando(r.id)
    setMsg(null)
  }

  const alternar = (clave) => setMarcados(prev => {
    const n = new Set(prev)
    if (n.has(clave)) n.delete(clave); else n.add(clave)
    return n
  })

  const marcarGrupo = (lista, poner) => setMarcados(prev => {
    const n = new Set(prev)
    for (const p of lista) { if (poner) n.add(p.clave); else n.delete(p.clave) }
    return n
  })

  const guardarRol = async () => {
    if (!form.nombre.trim()) return setMsg({ tipo: 'error', texto: 'Ponle un nombre al rol.' })
    if (rolVacio([...marcados])) {
      return setMsg({
        tipo: 'error',
        texto: 'Un rol sin permisos no sirve de nada. Marca al menos uno.',
      })
    }
    setGuardando(true)
    let rolId = editando
    if (editando === 'nuevo') {
      const { data, error } = await supabase.from('roles')
        .insert({
          organizacion_id: orgId,
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          activo: form.activo,
        }).select('id').single()
      if (error) {
        setGuardando(false)
        return setMsg({
          tipo: 'error',
          texto: /duplicate|unique/i.test(error.message)
            ? 'Ya hay un rol con ese nombre.'
            : 'No se pudo crear: ' + error.message,
        })
      }
      rolId = data.id
    } else {
      const { error } = await supabase.from('roles').update({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        activo: form.activo,
      }).eq('id', editando)
      if (error) { setGuardando(false); return setMsg({ tipo: 'error', texto: error.message }) }
    }

    // Se reemplazan los permisos: borrar y volver a poner es lo único
    // que deja el estado final exactamente igual a lo marcado.
    await supabase.from('rol_permisos').delete().eq('rol_id', rolId)
    if (marcados.size) {
      const { error } = await supabase.from('rol_permisos')
        .insert([...marcados].map(p => ({ rol_id: rolId, permiso: p })))
      if (error) { setGuardando(false); return setMsg({ tipo: 'error', texto: error.message }) }
    }
    setGuardando(false)
    setEditando(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Rol guardado.' })
  }

  const borrarRol = async (r) => {
    const cuantas = asignaciones.filter(a => a.rol_id === r.id).length
    const aviso = cuantas
      ? `\n\n${cuantas} persona(s) tienen este rol y se quedarán sin él.`
      : ''
    if (!confirm(`¿Borrar el rol «${r.nombre}»?${aviso}`)) return
    const { error } = await supabase.from('roles').delete().eq('id', r.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Rol borrado.' })
  }

  const asignar = async () => {
    const correo = alta.email.trim().toLowerCase()
    if (!correo || !correo.includes('@')) {
      return setMsg({ tipo: 'error', texto: 'Escribe un correo válido.' })
    }
    if (!alta.rol_id) return setMsg({ tipo: 'error', texto: 'Elige el rol.' })
    setGuardando(true)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('asignaciones_rol').insert({
      rol_id: Number(alta.rol_id),
      email: correo,
      sede_id: alta.sede_id ? Number(alta.sede_id) : null,
      categoria_id: alta.categoria_id ? Number(alta.categoria_id) : null,
      asignado_por: u?.user?.email?.toLowerCase() || null,
    })
    setGuardando(false)
    if (error) {
      return setMsg({
        tipo: 'error',
        texto: /duplicate|unique/i.test(error.message)
          ? 'Esa persona ya tiene ese rol con ese mismo alcance.'
          : 'No se pudo asignar: ' + error.message,
      })
    }
    setAlta({ email: '', rol_id: '', sede_id: '', categoria_id: '' })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Rol asignado. Si esa persona aún no tiene cuenta, el rol la esperará.' })
  }

  const quitarAsignacion = async (a) => {
    const { error } = await supabase.from('asignaciones_rol').delete().eq('id', a.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    await recargar()
  }

  if (!orgId && !cargando) {
    return <p className="aviso-error">No pude saber de qué organización es este sitio.</p>
  }
  if (cargando) return <p className="nota">Cargando…</p>

  return (
    <div className="roles">
      <p className="seccion-intro">
        Los roles de <strong>{organizacion?.nombre}</strong>. Cada institución
        nombra los suyos y decide qué puede hacer cada uno, sin que haya que
        tocar el programa.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {editando === null ? (
        <>
          <div className="examen-import-botones">
            <button type="button" className="button primary" onClick={abrirNuevo}>
              ➕ Nuevo rol
            </button>
            {roles.length === 0 && (
              <button type="button" className="button secondary"
                      onClick={sembrar} disabled={guardando}>
                ⚡ Crear los tres roles básicos
              </button>
            )}
          </div>

          {!roles.length ? (
            <p className="nota" style={{ marginTop: 14 }}>
              Todavía no hay roles. Puedes partir de los tres básicos —Dirección,
              Coordinación y Docente— y ajustarlos, o crear el tuyo desde cero.
            </p>
          ) : (
            <div className="org-lista" style={{ marginTop: 14 }}>
              {roles.map(r => {
                const res = resumenRol(permisosPorRol[r.id], catalogo)
                const cuantas = asignaciones.filter(a => a.rol_id === r.id).length
                return (
                  <div key={r.id} className={`org-fila ${r.activo ? '' : 'inactiva'}`}>
                    <div className="org-fila-datos">
                      <strong>{r.nombre}</strong>
                      <span className="celda-sub">
                        {r.descripcion ? `${r.descripcion} · ` : ''}
                        {res.total} permiso(s) · {res.texto}
                      </span>
                    </div>
                    <span className="badge neutro">{cuantas} persona(s)</span>
                    {!r.activo && <span className="badge inactivo">Inactivo</span>}
                    <button type="button" className="button texto"
                            onClick={() => abrirEdicion(r)}>✏️ Editar</button>
                    <button type="button" className="button texto peligro"
                            onClick={() => borrarRol(r)}>🗑️</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ---------- Quién tiene qué ---------- */}
          {roles.length > 0 && (
            <>
              <h4 className="susc-sub">Asignar un rol</h4>
              <p className="nota" style={{ marginTop: 0 }}>
                Deja el alcance en blanco para toda la organización. Con una sede
                o una categoría, el rol vale <strong>solo ahí</strong>.
              </p>
              <div className="rol-alta">
                <div>
                  <label>Correo</label>
                  <input className="input" type="email" value={alta.email}
                         onChange={e => setAlta({ ...alta, email: e.target.value })}
                         placeholder="persona@ejemplo.mx" />
                </div>
                <div>
                  <label>Rol</label>
                  <select className="input" value={alta.rol_id}
                          onChange={e => setAlta({ ...alta, rol_id: e.target.value })}>
                    <option value="">Elige…</option>
                    {roles.filter(r => r.activo).map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Sede (opcional)</label>
                  <select className="input" value={alta.sede_id}
                          onChange={e => setAlta({ ...alta, sede_id: e.target.value })}>
                    <option value="">Todas</option>
                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label>Categoría (opcional)</label>
                  <select className="input" value={alta.categoria_id}
                          onChange={e => setAlta({ ...alta, categoria_id: e.target.value })}>
                    <option value="">Todas</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <button type="button" className="button secondary"
                        onClick={asignar} disabled={guardando}>
                  ➕ Asignar
                </button>
              </div>

              {!asignaciones.length ? (
                <p className="nota">Nadie tiene un rol asignado todavía.</p>
              ) : (
                <div className="gestion-tabla-scroll">
                  <table className="gestion-tabla">
                    <thead>
                      <tr><th>Persona</th><th>Rol</th><th>Alcance</th><th className="col-acciones"></th></tr>
                    </thead>
                    <tbody>
                      {asignaciones.map(a => (
                        <tr key={a.id}>
                          <td>{a.email}</td>
                          <td>{roles.find(r => r.id === a.rol_id)?.nombre || '—'}</td>
                          <td>{ambitoDe(a, sedes, categorias)}</td>
                          <td className="col-acciones">
                            <button type="button" className="button texto"
                                    onClick={() => quitarAsignacion(a)}>Quitar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <p className="nota" style={{ marginTop: 18 }}>
            Esto decide qué <strong>se enseña</strong> en el panel. Las reglas de
            la base de datos siguen apoyándose en quién administra la
            organización y en quién facilita cada curso; llevar los roles también
            ahí es el paso siguiente.
          </p>
        </>
      ) : (
        <div className="rol-editor">
          <h4>{editando === 'nuevo' ? 'Nuevo rol' : 'Editar rol'}</h4>

          <div className="org-editor-fila">
            <div>
              <label>Nombre</label>
              <input className="input" value={form.nombre} autoFocus
                     onChange={e => setForm({ ...form, nombre: e.target.value })}
                     placeholder="Ej. Coordinación académica" />
            </div>
            <div>
              <label>Descripción</label>
              <input className="input" value={form.descripcion}
                     onChange={e => setForm({ ...form, descripcion: e.target.value })}
                     placeholder="Qué hace esta figura" />
            </div>
          </div>

          <label className="gen-activa">
            <input type="checkbox" checked={form.activo}
                   onChange={e => setForm({ ...form, activo: e.target.checked })} />
            <span>Activo <em className="nota">(se puede asignar)</em></span>
          </label>

          <h4 className="susc-sub">Qué puede hacer ({marcados.size})</h4>
          {grupos.map(([grupo, lista]) => {
            const todos = lista.every(p => marcados.has(p.clave))
            return (
              <div key={grupo} className="permiso-grupo">
                <div className="permiso-grupo-cab">
                  <strong>{grupo}</strong>
                  <button type="button" className="button texto"
                          onClick={() => marcarGrupo(lista, !todos)}>
                    {todos ? 'Ninguno' : 'Todos'}
                  </button>
                </div>
                {lista.map(p => (
                  <label key={p.clave} className="permiso-fila">
                    <input type="checkbox" checked={marcados.has(p.clave)}
                           onChange={() => alternar(p.clave)} />
                    <span>
                      <strong>{p.nombre}</strong>
                      {p.descripcion && <em className="nota">{p.descripcion}</em>}
                    </span>
                  </label>
                ))}
              </div>
            )
          })}

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary"
                    onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</button>
            <button type="button" className="button primary"
                    onClick={guardarRol} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar rol'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
