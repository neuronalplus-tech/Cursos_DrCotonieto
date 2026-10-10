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
import { useOrganizacion } from '../lib/organizacion'
import { tienePonderacion } from '../lib/calificacion'
import EditorPonderacion from './EditorPonderacion'

const VACIO = {
  titulo: '', descripcion: '', linea: '', categoria_id: '', orden: 100,
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
  /* La ponderación va aparte de `form` a propósito: `form` se guarda
     con un bucle que convierte las cadenas vacías en null, y un objeto
     con números no pasa por esa regla. Mezclarlos obligaría a meter
     excepciones en el bucle, que es justo lo que lo haría frágil. */
  const [pond, setPond] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [verTaller, setVerTaller] = useState(false)
  const [duplicando, setDuplicando] = useState(null)
  const { organizacion } = useOrganizacion()
  const [categorias, setCategorias] = useState([])
  const [catAbierto, setCatAbierto] = useState(false)
  const [catNueva, setCatNueva] = useState('')
  const [catEditando, setCatEditando] = useState(null)

  const recargar = async () => {
    setCargando(true)
    // Sin filtrar por `activo`: aquí se gestionan también los archivados.
    let q = supabase.from('cursos').select('*').order('orden').order('titulo')
    if (organizacion?.id) q = q.eq('organizacion_id', organizacion.id)
    const { data, error } = await q
    if (error) setMsg({ tipo: 'error', texto: 'No se pudieron cargar: ' + error.message })
    else setCursos(data || [])

    const { data: cats } = await supabase.from('categorias')
      .select('*').order('orden').order('nombre')
    setCategorias(cats || [])
    setCargando(false)
  }

  useEffect(() => { recargar() }, [organizacion])

  const abrirNuevo = () => {
    const siguiente = cursos.length ? Math.max(...cursos.map(c => c.orden || 0)) + 10 : 100
    setForm({ ...VACIO, orden: siguiente })
    setPond(null)
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
    setPond(c.ponderacion || null)
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
    // `linea` sigue siendo lo que la portada usa para agrupar, asi que
    // se mantiene sincronizada con la categoria elegida. Una sola
    // decision en la interfaz, dos columnas coherentes en la base.
    const cat = categorias.find(k => String(k.id) === String(form.categoria_id))
    payload.categoria_id = cat ? cat.id : null
    payload.linea = cat ? cat.nombre : null
    if (editando === 'nueva' && organizacion?.id) {
      payload.organizacion_id = organizacion.id
    }
    // null = promedio simple. Guardar un objeto con todo en cero
    // significaría lo mismo pero obligaría a comprobarlo en cada
    // lectura; null lo dice una vez.
    payload.ponderacion = tienePonderacion(pond) ? pond : null

    const { error } = editando === 'nuevo'
      ? await supabase.from('cursos').insert(payload)
      : await supabase.from('cursos').update(payload).eq('id', editando)

    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })

    await recargar()
    setEditando(null)
    setMsg({ tipo: 'ok', texto: editando === 'nuevo' ? 'Curso creado.' : 'Cambios guardados.' })
  }

  /* La copia la arma una funcion de Postgres, no este componente:
     son decenas de inserciones encadenadas y asi ocurren todas
     dentro de una transaccion. Un fallo a mitad no deja un curso
     copiado por la mitad. */
  const duplicar = async (c) => {
    const titulo = window.prompt(
      `Titulo de la copia de "${c.titulo}":`,
      `${c.titulo} (copia)`)
    if (titulo === null) return
    setDuplicando(c.id)
    setMsg(null)
    const { data, error } = await supabase.rpc('duplicar_curso', {
      p_curso: c.id, p_titulo: titulo,
    })
    setDuplicando(null)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo duplicar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: `Copia creada y archivada. Revisala y activala cuando este lista.` })
    // Se abre la copia para editarla: casi siempre lo primero que se
    // quiere es cambiarle algo antes de activarla.
    const { data: creado } = await supabase.from('cursos')
      .select('*').eq('id', data).maybeSingle()
    if (creado) abrirEdicion(creado)
  }

  const crearCategoria = async () => {
    const nombre = catNueva.trim()
    if (!nombre) return setMsg({ tipo: 'error', texto: 'Escribe un nombre.' })
    const { error } = await supabase.from('categorias').insert({ nombre })
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo crear: ' + error.message })
    setCatNueva('')
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Categoría creada.' })
  }

  const guardarCategoria = async () => {
    if (!catEditando) return
    const { error } = await supabase.from('categorias')
      .update({
        nombre: catEditando.nombre.trim(),
        descripcion: catEditando.descripcion?.trim() || null,
      })
      .eq('id', catEditando.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
    setCatEditando(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Categoría actualizada.' })
  }

  /* Borrar una categoria NO borra sus cursos: la columna es
     `on delete set null`, asi que quedan sin clasificar. Se avisa
     con el numero exacto para que la decision sea informada. */
  const borrarCategoria = async (k, nCursos) => {
    const aviso = nCursos
      ? `"${k.nombre}" tiene ${nCursos} curso(s). No se borran, pero quedan sin categoría.

¿Continuar?`
      : `¿Eliminar la categoría "${k.nombre}"?`
    if (!window.confirm(aviso)) return
    const { error } = await supabase.from('categorias').delete().eq('id', k.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Categoría eliminada.' })
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
              <label>Categoría</label>
              {/* Desplegable y no texto libre: escribirla a mano acababa
                  creando "Duelo y perdida" y "Duelo y pérdida" como dos. */}
              <select className="input" value={form.categoria_id || ''}
                      onChange={e => campo('categoria_id', e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map(k => (
                  <option key={k.id} value={k.id}>{k.nombre}</option>
                ))}
              </select>
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

          <EditorPonderacion
            cursoId={editando}
            value={pond}
            onChange={setPond}
          />

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

      {/* Las categorías viven aquí y no en su propia pestaña porque
          solo se tocan al reorganizar el catálogo, que es algo que
          se hace mientras se editan los cursos. */}
      <div className="cat-seccion">
        <button type="button" className="enlace-texto"
                onClick={() => setCatAbierto(v => !v)}>
          {catAbierto ? '▲ Ocultar categorías' : `▼ Categorías (${categorias.length})`}
        </button>

        {catAbierto && (
          <div className="cat-cuerpo">
            <p className="nota">
              Agrupan los cursos en la portada y permiten asignar un facilitador
              a toda una línea de golpe: los cursos que entren después quedan
              cubiertos sin tener que acordarse.
            </p>

            <div className="cat-alta">
              <input className="input" value={catNueva}
                     onChange={e => setCatNueva(e.target.value)}
                     placeholder="Nombre de la categoría" />
              <button type="button" className="button secondary" onClick={crearCategoria}>
                Añadir
              </button>
            </div>

            <div className="cat-lista">
              {categorias.map(k => {
                const nCursos = cursos.filter(c => c.categoria_id === k.id).length
                const enEdicion = catEditando?.id === k.id
                return (
                  <div key={k.id} className="cat-fila">
                    {enEdicion ? (
                      <>
                        <input className="input" value={catEditando.nombre}
                               onChange={e => setCatEditando({ ...catEditando, nombre: e.target.value })} />
                        <input className="input" value={catEditando.descripcion || ''}
                               onChange={e => setCatEditando({ ...catEditando, descripcion: e.target.value })}
                               placeholder="Descripción que se ve en la portada" />
                        <button type="button" className="button texto" onClick={guardarCategoria}>
                          Guardar
                        </button>
                        <button type="button" className="button texto" onClick={() => setCatEditando(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="cat-fila-datos">
                          <strong>{k.nombre}</strong>
                          {k.descripcion && <span className="celda-sub">{k.descripcion}</span>}
                        </div>
                        <span className="badge neutro">{nCursos} curso(s)</span>
                        <button type="button" className="button texto"
                                onClick={() => setCatEditando({ ...k })}>✏️ Editar</button>
                        <button type="button" className="button texto peligro"
                                onClick={() => borrarCategoria(k, nCursos)}>🗑️</button>
                      </>
                    )}
                  </div>
                )
              })}
              {!categorias.length && <p className="nota">Todavía no hay categorías.</p>}
            </div>
          </div>
        )}
      </div>

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
                <button type="button" className="button texto"
                        onClick={() => duplicar(c)} disabled={duplicando === c.id}
                        title="Crea una copia con sus modulos, recursos y examenes">
                  {duplicando === c.id ? 'Duplicando…' : '📄 Duplicar'}
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
