/* ============================================================
   CURSOS · alta y edición desde el panel
   ------------------------------------------------------------
   Hasta aquí, crear un curso o cambiarle el título obligaba a
   entrar a Supabase: `cursos` no tenía política de INSERT y el
   panel solo editaba tres interruptores. Todo lo estructural
   dependía de una sesión de trabajo en vez de ser una tarea de
   dos minutos.

   RETIRAR NO ES BORRAR
   No hay botón de eliminar a propósito. De un curso cuelgan
   módulos, recursos, exámenes, intentos, foro, inscripciones y
   progreso: borrarlo se llevaría el historial académico de quien
   lo cursó. "Archivar" lo saca del catálogo y conserva todo.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VACIO = {
  titulo: '', descripcion: '', linea: '', orden: 100,
  activo: true, gratuito: false, proximamente: false,
  caratula: '', info_curso: '',
  fecha_sesion: '', link_registro: '', registro_texto: '',
  link_grabacion: '', grabacion_texto: '', link_materiales: '',
}

/** Los campos de taller solo estorban en un curso normal. */
const CAMPOS_TALLER = [
  ['fecha_sesion', 'Fecha de la sesión', 'Ej. 12 de marzo, 19:00'],
  ['link_registro', 'Enlace de registro', 'https://…'],
  ['registro_texto', 'Texto del botón de registro', 'Ej. Apartar mi lugar'],
  ['link_grabacion', 'Enlace de la grabación', 'https://…'],
  ['grabacion_texto', 'Texto del botón de grabación', 'Ej. Ver la grabación'],
  ['link_materiales', 'Enlace de materiales', 'https://…'],
]

export default function AdminCursos() {
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)   // id, o 'nuevo'
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [verTaller, setVerTaller] = useState(false)

  const recargar = async () => {
    setCargando(true)
    // Sin filtrar por `activo`: aquí se gestionan también los archivados.
    const { data, error } = await supabase
      .from('cursos').select('*').order('orden').order('titulo')
    if (error) setMsg({ tipo: 'error', texto: 'No se pudieron cargar: ' + error.message })
    else setCursos(data || [])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  const abrirNuevo = () => {
    const siguiente = cursos.length ? Math.max(...cursos.map(c => c.orden || 0)) + 10 : 100
    setForm({ ...VACIO, orden: siguiente })
    setEditando('nuevo')
    setVerTaller(false)
    setMsg(null)
  }

  const abrirEdicion = (c) => {
    // Los null de la base se vuelven '' para que los inputs sean
    // controlados; al guardar se revierte.
    const limpio = { ...VACIO }
    for (const k of Object.keys(VACIO)) {
      limpio[k] = c[k] === null || c[k] === undefined ? VACIO[k] : c[k]
    }
    setForm(limpio)
    setEditando(c.id)
    setVerTaller(CAMPOS_TALLER.some(([k]) => c[k]))
    setMsg(null)
  }

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!form.titulo.trim()) return setMsg({ tipo: 'error', texto: 'El título es obligatorio.' })
    setGuardando(true)

    // Los textos vacíos se guardan como null: así la app puede
    // distinguir "sin dato" de "cadena vacía" al pintar.
    const payload = {}
    for (const [k, v] of Object.entries(form)) {
      payload[k] = typeof v === 'string' && v.trim() === '' ? null : v
    }
    payload.titulo = form.titulo.trim()
    payload.orden = parseInt(form.orden, 10) || 100

    const { error } = editando === 'nuevo'
      ? await supabase.from('cursos').insert(payload)
      : await supabase.from('cursos').update(payload).eq('id', editando)

    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })

    await recargar()
    setEditando(null)
    setMsg({ tipo: 'ok', texto: editando === 'nuevo' ? 'Curso creado.' : 'Cambios guardados.' })
  }

  const alternarArchivo = async (c) => {
    const { error } = await supabase
      .from('cursos').update({ activo: !c.activo }).eq('id', c.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo cambiar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: c.activo ? 'Curso archivado.' : 'Curso reactivado.' })
  }

  return (
    <div className="admin-cursos">
      <p className="seccion-intro">
        Crea y edita tus cursos sin salir del panel. Archivar saca un curso del
        catálogo y de la portada, pero conserva sus módulos, inscripciones y
        calificaciones: se puede reactivar cuando quieras.
      </p>

      {msg && (
        <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>
      )}

      {editando === null && (
        <button type="button" className="button primary" onClick={abrirNuevo}>
          ➕ Nuevo curso
        </button>
      )}

      {editando !== null && (
        <div className="curso-editor">
          <h3>{editando === 'nuevo' ? 'Nuevo curso' : 'Editar curso'}</h3>

          <label>Título</label>
          <input className="input" value={form.titulo} autoFocus
                 onChange={e => campo('titulo', e.target.value)}
                 placeholder="Ej. Evaluación del duelo prolongado" />

          <label>Descripción</label>
          <textarea className="input" rows="3" value={form.descripcion}
                    onChange={e => campo('descripcion', e.target.value)}
                    placeholder="La frase que acompaña al título en la portada" />

          <div className="curso-editor-fila">
            <div>
              <label>Línea temática</label>
              <input className="input" value={form.linea}
                     onChange={e => campo('linea', e.target.value)}
                     list="lineas-existentes"
                     placeholder="Ej. Duelo y pérdida" />
              {/* Se ofrecen las que ya usas para no acabar con
                  "Duelo y perdida" y "Duelo y pérdida" como dos. */}
              <datalist id="lineas-existentes">
                {[...new Set(cursos.map(c => c.linea).filter(Boolean))].map(l => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Orden</label>
              <input className="input" type="number" value={form.orden}
                     onChange={e => campo('orden', e.target.value)} />
            </div>
          </div>

          <label>Imagen de portada (URL)</label>
          <input className="input" value={form.caratula}
                 onChange={e => campo('caratula', e.target.value)}
                 placeholder="Vacío = se dibuja una portada automática" />

          <label>Información del curso</label>
          <textarea className="input" rows="4" value={form.info_curso}
                    onChange={e => campo('info_curso', e.target.value)}
                    placeholder="Texto largo que se muestra dentro del curso" />

          <div className="curso-editor-casillas">
            <label>
              <input type="checkbox" checked={!!form.activo}
                     onChange={e => campo('activo', e.target.checked)} />
              <span>Activo <em className="nota">(visible en el catálogo)</em></span>
            </label>
            <label>
              <input type="checkbox" checked={!!form.gratuito}
                     onChange={e => campo('gratuito', e.target.checked)} />
              <span>Gratuito <em className="nota">(sin pago previo)</em></span>
            </label>
            <label>
              <input type="checkbox" checked={!!form.proximamente}
                     onChange={e => campo('proximamente', e.target.checked)} />
              <span>Próximamente <em className="nota">(anuncio, aún no abre)</em></span>
            </label>
          </div>

          <button type="button" className="enlace-texto" style={{ marginTop: 10 }}
                  onClick={() => setVerTaller(v => !v)}>
            {verTaller ? '▲ Ocultar campos de taller' : '▼ Campos de taller en vivo (registro, grabación)'}
          </button>

          {verTaller && (
            <div className="curso-editor-taller">
              {CAMPOS_TALLER.map(([k, etiqueta, ayuda]) => (
                <div key={k}>
                  <label>{etiqueta}</label>
                  <input className="input" value={form[k]}
                         onChange={e => campo(k, e.target.value)} placeholder={ayuda} />
                </div>
              ))}
            </div>
          )}

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary"
                    onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</button>
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : editando === 'nuevo' ? 'Crear curso' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="nota">Cargando cursos…</p>
      ) : (
        <div className="curso-lista">
          {cursos.map(c => (
            <div key={c.id} className={`curso-fila ${c.activo ? '' : 'archivado'}`}>
              <div className="curso-fila-datos">
                <strong>{c.titulo}</strong>
                <span className="celda-sub">
                  {c.linea || 'Sin línea'} · orden {c.orden ?? '—'}
                </span>
              </div>
              <div className="curso-fila-marcas">
                {!c.activo && <span className="badge neutro">Archivado</span>}
                {c.gratuito && <span className="badge ok">Gratuito</span>}
                {c.proximamente && <span className="badge rol-alumno">Próximamente</span>}
              </div>
              <div className="curso-fila-acciones">
                <button type="button" className="button texto" onClick={() => abrirEdicion(c)}>
                  ✏️ Editar
                </button>
                <button type="button" className="button texto" onClick={() => alternarArchivo(c)}>
                  {c.activo ? '📦 Archivar' : '↩️ Reactivar'}
                </button>
              </div>
            </div>
          ))}
          {!cursos.length && <p className="nota">Todavía no hay cursos.</p>}
        </div>
      )}
    </div>
  )
}
