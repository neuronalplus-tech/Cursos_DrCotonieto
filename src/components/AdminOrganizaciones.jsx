/* ============================================================
   ORGANIZACIONES · dar de alta clientes
   ------------------------------------------------------------
   Solo para quien administra la plataforma. Un cliente no da de
   alta a otros clientes: eso es decidir el negocio.

   Cada organización tiene su dirección y su marca. La dirección
   puede ser un subdominio nuestro (por `slug`) o un dominio suyo
   (por `dominio`); las dos conviven, y lo normal es arrancar con
   la primera y migrar a la segunda cuando lo pidan.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ExportarDatos from './ExportarDatos'
import Sedes from './Sedes'

const VACIA = {
  slug: '', nombre: '', dominio: '', logo_url: '',
  color_primario: '', color_acento: '', contacto_email: '', activa: true,
}

const BASE = import.meta.env.VITE_DOMINIO_BASE || ''

export default function AdminOrganizaciones() {
  const [orgs, setOrgs] = useState([])
  const [cursosPorOrg, setCursosPorOrg] = useState({})
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VACIA)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  // Una institución que no puede llevarse lo suyo está atrapada, y eso
  // se pregunta ANTES de firmar, no al irse.
  const [exportando, setExportando] = useState(null)
  const [sedesDe, setSedesDe] = useState(null)

  const recargar = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('organizaciones').select('*').order('id')
    if (error) setMsg({ tipo: 'error', texto: 'No se pudieron cargar: ' + error.message })
    else setOrgs(data || [])

    const { data: cs } = await supabase.from('cursos').select('organizacion_id')
    const c = {}
    for (const x of cs || []) {
      if (x.organizacion_id) c[x.organizacion_id] = (c[x.organizacion_id] || 0) + 1
    }
    setCursosPorOrg(c)
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const abrirNueva = () => { setForm(VACIA); setEditando('nueva'); setMsg(null) }

  const abrirEdicion = (o) => {
    const f = { ...VACIA }
    for (const k of Object.keys(VACIA)) f[k] = o[k] ?? VACIA[k]
    setForm(f)
    setEditando(o.id)
    setMsg(null)
  }

  const guardar = async () => {
    const slug = form.slug.trim().toLowerCase()
    if (!slug || !form.nombre.trim()) {
      return setMsg({ tipo: 'error', texto: 'El identificador y el nombre son obligatorios.' })
    }
    // El slug viaja en la dirección: si admite mayúsculas o espacios,
    // la misma organización tendría dos URL distintas.
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return setMsg({ tipo: 'error', texto: 'El identificador solo admite minúsculas, números y guiones.' })
    }
    setGuardando(true)
    const payload = {
      slug,
      nombre: form.nombre.trim(),
      dominio: form.dominio.trim().toLowerCase() || null,
      logo_url: form.logo_url.trim() || null,
      color_primario: form.color_primario.trim() || null,
      color_acento: form.color_acento.trim() || null,
      contacto_email: form.contacto_email.trim().toLowerCase() || null,
      activa: !!form.activa,
    }
    const { error } = editando === 'nueva'
      ? await supabase.from('organizaciones').insert(payload)
      : await supabase.from('organizaciones').update(payload).eq('id', editando)
    setGuardando(false)
    if (error) {
      return setMsg({
        tipo: 'error',
        texto: /duplicate|unique/i.test(error.message)
          ? 'Ya existe una organización con ese identificador o dominio.'
          : 'No se pudo guardar: ' + error.message,
      })
    }
    await recargar()
    setEditando(null)
    setMsg({ tipo: 'ok', texto: 'Organización guardada.' })
  }

  const direccion = (o) => o.dominio
    ? `https://${o.dominio}`
    : BASE ? `https://${o.slug}.${BASE}` : `(falta configurar el dominio base)`

  return (
    <div className="orgs">
      <p className="seccion-intro">
        Cada institución a la que le hospedas su aula. Lo que crees aquí no se
        mezcla con lo tuyo: su catálogo, sus alumnos y sus reportes viven aparte.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {!BASE && (
        <p className="aviso-error">
          Falta definir <code>VITE_DOMINIO_BASE</code> en la compilación. Sin eso
          los subdominios no resuelven y cada organización necesita su propio
          dominio para funcionar.
        </p>
      )}

      {editando === null && (
        <button type="button" className="button primary" onClick={abrirNueva}>
          ➕ Nueva organización
        </button>
      )}

      {editando !== null && (
        <div className="org-editor">
          <h3>{editando === 'nueva' ? 'Nueva organización' : 'Editar organización'}</h3>

          <label>Nombre</label>
          <input className="input" value={form.nombre} autoFocus
                 onChange={e => campo('nombre', e.target.value)}
                 placeholder="Federación Mexicana de Psicología" />

          <label>Identificador para la dirección</label>
          <input className="input" value={form.slug}
                 onChange={e => campo('slug', e.target.value)}
                 placeholder="fmp" />
          <p className="nota">
            Su aula quedará en <strong>{form.slug ? `${form.slug}.${BASE || '…'}` : `….${BASE || '…'}`}</strong>.
            Solo minúsculas, números y guiones.
          </p>

          <label>Dominio propio (opcional)</label>
          <input className="input" value={form.dominio}
                 onChange={e => campo('dominio', e.target.value)}
                 placeholder="aula.fmp.org.mx" />
          <p className="nota">
            Si lo pones, hay que apuntar ese nombre a la plataforma y darlo de
            alta en Cloudflare. Mientras tanto el subdominio sigue funcionando.
          </p>

          <label>Logo (URL)</label>
          <input className="input" value={form.logo_url}
                 onChange={e => campo('logo_url', e.target.value)}
                 placeholder="https://…/logo.png" />

          <div className="org-editor-fila">
            <div>
              <label>Color principal</label>
              <input className="input" value={form.color_primario}
                     onChange={e => campo('color_primario', e.target.value)}
                     placeholder="#1f4e5f" />
            </div>
            <div>
              <label>Color de acento</label>
              <input className="input" value={form.color_acento}
                     onChange={e => campo('color_acento', e.target.value)}
                     placeholder="#c17a5e" />
            </div>
          </div>

          <label>Correo de contacto</label>
          <input className="input" type="email" value={form.contacto_email}
                 onChange={e => campo('contacto_email', e.target.value)} />

          <label className="gen-activa">
            <input type="checkbox" checked={form.activa}
                   onChange={e => campo('activa', e.target.checked)} />
            <span>Activa <em className="nota">(su aula responde)</em></span>
          </label>

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary"
                    onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</button>
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {cargando ? <p className="nota">Cargando…</p> : (
        <div className="org-lista">
          {orgs.map(o => (
            <div key={o.id} className={`org-fila ${o.activa ? '' : 'inactiva'}`}>
              <div className="org-fila-datos">
                <strong>{o.nombre}</strong>
                <span className="celda-sub">{direccion(o)}</span>
              </div>
              <span className="badge neutro">{cursosPorOrg[o.id] || 0} curso(s)</span>
              {!o.activa && <span className="badge inactivo">Inactiva</span>}
              <button type="button" className="button texto"
                      onClick={() => abrirEdicion(o)}>✏️ Editar</button>
              <button type="button" className="button texto"
                      title="Descargar todos sus datos en CSV"
                      onClick={() => setExportando(o)}>⬇️ Datos</button>
              <button type="button" className="button texto"
                      title="Sus sedes o planteles"
                      onClick={() => setSedesDe(sedesDe?.id === o.id ? null : o)}>
                {sedesDe?.id === o.id ? '▲ Sedes' : '🏫 Sedes'}
              </button>
            </div>
          ))}
        </div>
      )}

      {sedesDe && (
        <div className="org-editor" style={{ marginTop: 16 }}>
          <Sedes organizacion={sedesDe} />
          <button type="button" className="button texto"
                  onClick={() => setSedesDe(null)}>Cerrar</button>
        </div>
      )}

      {exportando && (
        <div className="org-editor" style={{ marginTop: 16 }}>
          <ExportarDatos organizacion={exportando} />
          <button type="button" className="button texto"
                  onClick={() => setExportando(null)}>Cerrar</button>
        </div>
      )}

      <p className="nota" style={{ marginTop: 18 }}>
        Para que alguien administre su organización, añade su correo a la tabla
        <code> admins</code> con el <code>organizacion_id</code> correspondiente.
        Sin ese dato sería administrador de toda la plataforma.
      </p>
    </div>
  )
}
