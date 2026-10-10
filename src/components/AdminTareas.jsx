/* ============================================================
   TAREAS · crear el apartado de entrega y su rúbrica
   ------------------------------------------------------------
   Convive con la forma que ya tenías de pedir entregables: un
   botón con enlace público (OneDrive, Forms…). Esa sigue ahí y no
   se toca. Esta es la otra opción, para cuando quieras que el
   archivo viva en la plataforma y se califique dentro.

   Tú decides cuál usar en cada módulo; el facilitador, en los
   cursos que tenga asignados.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Prorrogas from './Prorrogas'
import CalificarTarea from './CalificarTarea'
import { ModalPortal } from './ui'
import { descargarPlantilla, CATALOGO_PLANTILLAS } from '../lib/plantillasCarga'
import { separarLinea } from '../lib/examenes'

const VACIA = {
  titulo: '', instrucciones: '', fecha_limite: '', cierra_al_vencer: true,
  puntos_max: 100, permite_reentrega: true, grupo: '', activo: true,
}

/* Una fila de rúbrica recién creada. */
/* Cuatro niveles repartiendo el peso del criterio. Son un punto de
   partida para editar, no una propuesta pedagogica: casi nadie
   quiere escribir la escala entera desde cero. */
function nivelesPorDefecto(peso) {
  const p = Number(peso) || 0
  const r = (x) => Math.round(x * 100) / 100
  return [
    { etiqueta: 'Excelente',     puntos: r(p),        descripcion: '' },
    { etiqueta: 'Satisfactorio', puntos: r(p * 0.75), descripcion: '' },
    { etiqueta: 'Suficiente',    puntos: r(p * 0.5),  descripcion: '' },
    { etiqueta: 'Insuficiente',  puntos: 0,           descripcion: '' },
  ]
}

const criterioVacio = () => ({
  _nuevo: Math.random().toString(36).slice(2),
  titulo: '', descripcion: '', peso: 0,
})

/* ------------------------------------------------------------
   LECTURA DE LA RÚBRICA DESDE EXCEL
   ------------------------------------------------------------
   Se buscan las columnas por su encabezado en vez de exigir un
   orden fijo: tus rúbricas no tienen por qué estar hechas para
   esta plataforma. Si ningún encabezado coincide, se cae a la
   suposición razonable (A: criterio, B: peso, C: descripción).

   En ningún caso se guarda directo: siempre se enseña lo leído
   para corregirlo antes de aceptar.
   ------------------------------------------------------------ */
function filasACriterios(filas) {
  if (!filas?.length) return []

  const encabezado = (filas[0] || []).map(c => String(c ?? '').toLowerCase().trim())
  const buscar = (re) => encabezado.findIndex(h => re.test(h))

  let iTitulo = buscar(/criterio|rubro|aspecto|indicador/)
  let iPeso = buscar(/peso|porcentaje|punt|valor|%/)
  let iDesc = buscar(/descrip|detalle|evidencia|desempe/)
  const hayColumnasRubrica = iTitulo >= 0 || iPeso >= 0
  if (hayColumnasRubrica && (iTitulo < 0 || iPeso < 0)) {
    const faltan = [iTitulo < 0 && 'criterio', iPeso < 0 && 'peso'].filter(Boolean)
    throw new Error(`Falta la columna «${faltan.join('» y «')}». Encabezados reconocidos: ${encabezado.filter(Boolean).join(', ') || 'ninguno'}.`)
  }
  if (!hayColumnasRubrica && filas[0]?.length > 1) {
    const pesoPrimeraFila = String(filas[0][1] ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.')
    if (String(filas[0][1] ?? '').trim() && !Number.isFinite(Number(pesoPrimeraFila))) {
      throw new Error(`No reconocí los encabezados «${encabezado.filter(Boolean).join(', ')}». Usa criterio, peso y descripcion; también puedes quitar la fila de encabezados y dejar los datos en ese orden.`)
    }
  }

  // Sin encabezados reconocibles se asume el orden más común y se
  // leen TODAS las filas, porque la primera ya no es un título.
  const hayEncabezado = iTitulo >= 0 || iPeso >= 0
  if (!hayEncabezado) { iTitulo = 0; iPeso = 1; iDesc = 2 }

  const cuerpo = hayEncabezado ? filas.slice(1) : filas

  return cuerpo
    .map(f => ({
      _nuevo: Math.random().toString(36).slice(2),
      titulo: String(f[iTitulo] ?? '').trim(),
      descripcion: iDesc >= 0 ? String(f[iDesc] ?? '').trim() : '',
      // "20%" y "20" valen igual; se queda solo con el número.
      peso: Number(String(f[iPeso] ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
    }))
    .filter(c => c.titulo)
}

export default function AdminTareas({ cursoId = null, moduloId = null }) {
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  const [editando, setEditando] = useState(null)   // id | 'nueva' | null
  // Las prórrogas listan a los inscritos del CURSO. Cuando esta
  // pantalla se abre desde un módulo, hay que subir a buscarlo.
  const [cursoDelModulo, setCursoDelModulo] = useState(null)
  const [form, setForm] = useState(VACIA)
  const [criterios, setCriterios] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [leyendoExcel, setLeyendoExcel] = useState(false)
  const [estadoImportacion, setEstadoImportacion] = useState(null)
  const [calificando, setCalificando] = useState(null)
  // tarea_id -> { entregadas, pendientes }. Se cuenta aquí y no en cada
  // fila para no disparar una consulta por tarea.
  const [recuento, setRecuento] = useState({})

  const columna = cursoId ? 'curso_id' : 'modulo_id'
  const valor = cursoId || moduloId

  useEffect(() => {
    if (cursoId || !moduloId) return
    let vivo = true
    supabase.from('modulos').select('curso_id').eq('id', moduloId).maybeSingle()
      .then(({ data }) => { if (vivo) setCursoDelModulo(data?.curso_id ?? null) })
    return () => { vivo = false }
  }, [cursoId, moduloId])

  const recargar = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('tareas').select('*').eq(columna, valor).order('creado_en')
    if (error) setMsg({ tipo: 'error', texto: 'No se pudieron cargar: ' + error.message })
    else setTareas(data || [])

    const ids = (data || []).map(t => t.id)
    if (ids.length) {
      const { data: ents } = await supabase.from('entregas')
        .select('tarea_id, calificado_en').in('tarea_id', ids)
      const r = {}
      for (const e of ents || []) {
        if (!r[e.tarea_id]) r[e.tarea_id] = { entregadas: 0, pendientes: 0 }
        r[e.tarea_id].entregadas++
        if (!e.calificado_en) r[e.tarea_id].pendientes++
      }
      setRecuento(r)
    } else {
      setRecuento({})
    }
    setCargando(false)
  }

  useEffect(() => { if (valor) recargar() }, [valor])

  const abrirNueva = () => {
    setForm(VACIA)
    setCriterios([])
    setEstadoImportacion(null)
    setEditando('nueva')
    setMsg(null)
  }

  const abrirEdicion = async (t) => {
    setForm({
      titulo: t.titulo || '',
      instrucciones: t.instrucciones || '',
      // datetime-local no entiende el formato con zona que da Postgres.
      fecha_limite: t.fecha_limite ? t.fecha_limite.slice(0, 16) : '',
      cierra_al_vencer: t.cierra_al_vencer !== false,
      puntos_max: t.puntos_max ?? 100,
      permite_reentrega: !!t.permite_reentrega,
      grupo: t.grupo || '',
      activo: !!t.activo,
    })
    const { data } = await supabase
      .from('rubrica_criterios').select('*').eq('tarea_id', t.id).order('orden')
    setCriterios((data || []).map(c => ({ ...c })))
    setEstadoImportacion(null)
    setEditando(t.id)
    setMsg(null)
  }

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const campoCriterio = (idx, k, v) =>
    setCriterios(cs => cs.map((c, i) => (i === idx ? { ...c, [k]: v } : c)))

  const campoNivel = (idx, nivelIdx, k, v) =>
    setCriterios(cs => cs.map((c, i) => (i !== idx ? c : {
      ...c,
      niveles: (c.niveles || []).map((n, j) => (j === nivelIdx ? { ...n, [k]: v } : n)),
    })))

  const importarExcel = async (archivo) => {
    if (!archivo) return
    setLeyendoExcel(true)
    setEstadoImportacion({ tipo: 'pendiente', texto: `Leyendo «${archivo.name}»…` })
    if (!archivo.size) {
      setLeyendoExcel(false)
      setEstadoImportacion({ tipo: 'error', texto: `«${archivo.name}» está vacío (0 bytes). Descarga otra vez la plantilla o guarda el archivo con datos.` })
      return
    }
    try {
      let filas
      if (/\.(csv|tsv|txt)$/i.test(archivo.name)) {
        const texto = (await archivo.text()).replace(/^\uFEFF/, '')
        const muestra = texto.split(/\r?\n/).slice(0, 5).join('\n')
        const sep = archivo.name.toLowerCase().endsWith('.csv')
          ? ((muestra.match(/;/g) || []).length > (muestra.match(/,/g) || []).length ? ';' : ',')
          : '\t'
        filas = texto.split(/\r?\n/).filter(f => f.trim()).map(f => separarLinea(f, sep))
      } else if (/\.xls$/i.test(archivo.name)) {
        throw new Error('El formato .xls antiguo no es compatible. Guarda el libro como .xlsx o usa la plantilla .tsv descargable.')
      } else {
        const { default: leerExcel } = await import('read-excel-file/browser')
        filas = await leerExcel(archivo)
      }

      if (!filas?.length) throw new Error('El archivo no contiene filas legibles. Revisa que tenga datos en la primera hoja.')
      const leidos = filasACriterios(filas)
      if (!leidos.length) throw new Error('No encontré criterios. Usa las columnas criterio, peso y descripcion, y agrega al menos una fila debajo.')
      if (criterios.length && !window.confirm(`El archivo contiene ${leidos.length} criterios y reemplazará los ${criterios.length} que ya están en el formulario. ¿Continuar?`)) {
        setEstadoImportacion({ tipo: 'cancelado', texto: 'Importación cancelada; conservé los criterios actuales.' })
        return
      }
      setCriterios(leidos)
      setEstadoImportacion({ tipo: 'ok', texto: `✓ «${archivo.name}»: leí ${leidos.length} criterio(s). Revísalos en el formulario; guarda la tarea para conservar la rúbrica.` })
    } catch (e) {
      const detalle = e?.message || String(e)
      const recomendacion = /\.xlsx$/i.test(archivo.name)
        ? ' Comprueba que sea un libro .xlsx válido y que la primera hoja tenga las columnas criterio, peso y descripcion.'
        : ''
      setEstadoImportacion({ tipo: 'error', texto: `No pude importar «${archivo.name}». ${detalle}${recomendacion}` })
    } finally {
      setLeyendoExcel(false)
    }
  }
  const sumaPesos = criterios.reduce((s, c) => s + (Number(c.peso) || 0), 0)

  const guardar = async () => {
    if (!form.titulo.trim()) return setMsg({ tipo: 'error', texto: 'El título es obligatorio.' })
    setGuardando(true)

    const payload = {
      [columna]: valor,
      titulo: form.titulo.trim(),
      instrucciones: form.instrucciones.trim() || null,
      fecha_limite: form.fecha_limite || null,
      cierra_al_vencer: !!form.cierra_al_vencer,
      puntos_max: Number(form.puntos_max) || 100,
      permite_reentrega: !!form.permite_reentrega,
      grupo: form.grupo.trim() || null,
      activo: !!form.activo,
    }

    let tareaId = editando
    if (editando === 'nueva') {
      const { data, error } = await supabase.from('tareas').insert(payload).select('id').single()
      if (error) { setGuardando(false); return setMsg({ tipo: 'error', texto: 'No se pudo crear: ' + error.message }) }
      tareaId = data.id
    } else {
      const { error } = await supabase.from('tareas').update(payload).eq('id', editando)
      if (error) { setGuardando(false); return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message }) }
    }

    // La rúbrica se reemplaza entera en vez de ir calculando altas y
    // bajas: son pocas filas y así no hay forma de dejarla a medias.
    await supabase.from('rubrica_criterios').delete().eq('tarea_id', tareaId)
    const limpios = criterios.filter(c => c.titulo.trim())
    if (limpios.length) {
      const { error } = await supabase.from('rubrica_criterios').insert(
        limpios.map((c, i) => ({
          tarea_id: tareaId,
          titulo: c.titulo.trim(),
          descripcion: c.descripcion?.trim() || null,
          peso: Number(c.peso) || 0,
          niveles: (c.niveles || [])
            .filter(n => (n.etiqueta || "").trim())
            .map(n => ({
              etiqueta: n.etiqueta.trim(),
              puntos: Number(n.puntos) || 0,
              descripcion: (n.descripcion || "").trim() || null,
            })),
          orden: (i + 1) * 10,
        })))
      if (error) { setGuardando(false); return setMsg({ tipo: 'error', texto: 'La tarea se guardó, pero la rúbrica no: ' + error.message }) }
    }

    setGuardando(false)
    await recargar()
    setEditando(null)
    setMsg({ tipo: 'ok', texto: form.activo ? 'Tarea guardada y publicada para alumnos.' : 'Tarea guardada como borrador; solo tú puedes verla.' })
  }

  const cambiarPublicacion = async (t) => {
    const activo = !t.activo
    const { error } = await supabase.from('tareas').update({ activo }).eq('id', t.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo cambiar la publicación: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: activo ? `«${t.titulo}» está publicada para alumnos.` : `«${t.titulo}» quedó como borrador.` })
  }

  const borrar = async (t) => {
    if (!window.confirm(`¿Eliminar "${t.titulo}"? Se borran también las entregas y calificaciones de esta tarea.`)) return
    const { error } = await supabase.from('tareas').delete().eq('id', t.id)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo eliminar: ' + error.message })
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Tarea eliminada.' })
  }

  return (
    <div className="tareas-admin">
      <p className="nota">
        Un apartado donde el alumno sube su documento y tú lo calificas dentro de
        la plataforma. Si prefieres pedir el entregable con un enlace externo,
        sigue estando el botón de siempre: esto no lo sustituye.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {calificando && (
        <ModalPortal>
          <section className="calificar-pantalla-completa" role="dialog" aria-modal="true" aria-label={`Calificar ${calificando.titulo}`}>
            <header className="calificar-pantalla-cabecera">
              <div><span className="nota">Calificación de tarea</span><h2>{calificando.titulo}</h2></div>
              <button type="button" className="button secondary" onClick={() => setCalificando(null)}>Cerrar calificación</button>
            </header>
            <CalificarTarea tarea={calificando} />
          </section>
        </ModalPortal>
      )}

      {editando === null && !calificando && (
        <>
          <button type="button" className="button primary" onClick={abrirNueva}>
            ➕ Nueva tarea
          </button>

          {cargando ? <p className="nota">Cargando…</p> : (
            <div className="tareas-lista">
              {tareas.map(t => (
                <div key={t.id} className={`tarea-fila ${t.activo ? '' : 'archivada'}`}>
                  <div className="tarea-fila-datos">
                    <strong>{t.titulo}</strong>
                    <span className="celda-sub">
                      {t.puntos_max} puntos
                      {t.fecha_limite && ` · entrega hasta ${new Date(t.fecha_limite).toLocaleDateString('es-MX')}`}
                      {t.grupo && ` · ruta ${t.grupo}`}
                      {t.activo ? ' · publicada' : ' · borrador, solo tú'}
                    </span>
                    {recuento[t.id]?.entregadas > 0 && (
                      <span className="tarea-recuento">
                        {recuento[t.id].entregadas} entrega(s)
                        {recuento[t.id].pendientes > 0 && (
                          <span className="badge rol-alumno">
                            {recuento[t.id].pendientes} por calificar
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <button type="button" className="button texto"
                          onClick={() => setCalificando(t)}>📊 Calificar</button>
                  <button type="button" className={`button ${t.activo ? 'secondary' : 'primary'}`}
                          onClick={() => cambiarPublicacion(t)}>
                    {t.activo ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button type="button" className="button texto" onClick={() => abrirEdicion(t)}>✏️ Editar</button>
                  <button type="button" className="button texto peligro" onClick={() => borrar(t)}>🗑️</button>
                </div>
              ))}
              {!tareas.length && <p className="nota">Todavía no hay tareas en este apartado.</p>}
            </div>
          )}
        </>
      )}

      {editando !== null && (
        <div className="tarea-editor">
          <h3>{editando === 'nueva' ? 'Nueva tarea' : 'Editar tarea'}</h3>

          <label>Título</label>
          <input className="input" value={form.titulo} autoFocus
                 onChange={e => campo('titulo', e.target.value)}
                 placeholder="Ej. Análisis de caso · Semana 4" />

          <label>Instrucciones</label>
          <textarea className="input" rows="4" value={form.instrucciones}
                    onChange={e => campo('instrucciones', e.target.value)}
                    placeholder="Qué tiene que entregar y bajo qué criterios se evalúa" />

          <div className="tarea-editor-fila">
            <div>
              <label>Fecha límite</label>
              <input className="input" type="datetime-local" value={form.fecha_limite}
                     onChange={e => campo('fecha_limite', e.target.value)} />
              {/* Vencer y cerrar son cosas distintas: hay trabajos donde
                  llegar tarde resta y otros donde llegar tarde no existe. */}
              <label className="gen-activa" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={form.cierra_al_vencer !== false}
                       disabled={!form.fecha_limite}
                       onChange={e => campo('cierra_al_vencer', e.target.checked)} />
                <span>Cerrar al vencer
                  <em className="nota">
                    {form.cierra_al_vencer !== false
                      ? 'Al pasar la fecha ya no se podrá entregar.'
                      : 'Se seguirá admitiendo, marcado como tardío.'}
                  </em>
                </span>
              </label>
            </div>
            <div>
              <label>Puntos</label>
              <input className="input" type="number" value={form.puntos_max}
                     onChange={e => campo('puntos_max', e.target.value)} />
            </div>
            <div>
              <label>Ruta (opcional)</label>
              <input className="input" value={form.grupo}
                     onChange={e => campo('grupo', e.target.value)}
                     placeholder="Vacío = todo el curso" />
            </div>
          </div>

          <div className="curso-editor-casillas">
            <label>
              <input type="checkbox" checked={form.permite_reentrega}
                     onChange={e => campo('permite_reentrega', e.target.checked)} />
              <span>Permitir reentrega <em className="nota">(puede reemplazar su archivo)</em></span>
            </label>
            <label>
              <input type="checkbox" checked={form.activo}
                     onChange={e => campo('activo', e.target.checked)} />
              <span>Publicar para alumnos <em className="nota">(desactívala para guardar como borrador)</em></span>
            </label>
          </div>

          {/* ---- Rúbrica ---- */}
          <div className="rubrica-bloque">
            <div className="rubrica-cab">
              <h4>Rúbrica</h4>
              <span className="nota">
                Opcional. Sin criterios, la tarea se califica con una nota simple.
              </span>
            </div>

            <div className="rubrica-acciones">
              <button type="button" className="button secondary"
                      onClick={() => setCriterios(cs => [...cs, criterioVacio()])}>
                ➕ Añadir criterio
              </button>
              <label className="button secondary rubrica-excel">
                {leyendoExcel ? 'Leyendo archivo…' : '📊 Importar archivo'}
                <input type="file" accept=".xlsx,.xls,.tsv,.csv" hidden disabled={leyendoExcel}
                       onChange={e => { importarExcel(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <button type="button" className="button texto" onClick={() => descargarPlantilla(CATALOGO_PLANTILLAS[0])}>
                ⬇️ Descargar plantilla de rúbrica
              </button>
            </div>
            <p className="nota" style={{ margin: '6px 0' }}>Formatos: .xlsx, .csv y .tsv. La importación llena los criterios aquí; no guarda la tarea todavía.</p>
            {estadoImportacion && <p className={estadoImportacion.tipo === 'error' ? 'aviso-error' : estadoImportacion.tipo === 'ok' ? 'aviso-ok' : 'nota'} role="status" aria-live="polite">{estadoImportacion.texto}</p>}
            <img className="plantilla-carga-ejemplo" src="/plantillas/ejemplo-rubrica.svg" alt="Ejemplo de las columnas criterio, peso y descripción para llenar la rúbrica" />

            {criterios.length > 0 && (
              <>
                <div className="rubrica-criterios">
                  {criterios.map((c, i) => (
                    <div key={c.id || c._nuevo} className="rubrica-criterio-caja">
                      <div className="rubrica-criterio">
                        <input className="input" value={c.titulo}
                               onChange={e => campoCriterio(i, 'titulo', e.target.value)}
                               placeholder="Criterio" />
                        <input className="input rubrica-peso" type="number" value={c.peso}
                               onChange={e => campoCriterio(i, 'peso', e.target.value)}
                               placeholder="Peso" />
                        <input className="input" value={c.descripcion || ''}
                               onChange={e => campoCriterio(i, 'descripcion', e.target.value)}
                               placeholder="Qué se espera para obtener el puntaje" />
                        <button type="button" className="button texto peligro"
                                onClick={() => setCriterios(cs => cs.filter((_, j) => j !== i))}>🗑️</button>
                      </div>

                      {/* Los niveles son opcionales. Sin ellos se califica
                          escribiendo el puntaje; con ellos se elige de una
                          lista, que es mas rapido y mas consistente entre
                          alumnos porque todos se miden con la misma vara. */}
                      <div className="rubrica-niveles-pie">
                        {!(c.niveles || []).length ? (
                          <button type="button" className="enlace-texto"
                                  onClick={() => campoCriterio(i, 'niveles', nivelesPorDefecto(c.peso))}>
                            + Añadir niveles de desempeño
                          </button>
                        ) : (
                          <>
                            <div className="rubrica-niveles">
                              {(c.niveles || []).map((n, j) => (
                                <div key={j} className="rubrica-nivel">
                                  <input className="input" value={n.etiqueta || ''}
                                         onChange={e => campoNivel(i, j, 'etiqueta', e.target.value)}
                                         placeholder="Nivel" />
                                  <input className="input rubrica-peso" type="number" value={n.puntos ?? ''}
                                         onChange={e => campoNivel(i, j, 'puntos', e.target.value)}
                                         placeholder="Pts" />
                                  <input className="input" value={n.descripcion || ''}
                                         onChange={e => campoNivel(i, j, 'descripcion', e.target.value)}
                                         placeholder="Qué tiene que hacer para quedar en este nivel" />
                                  <button type="button" className="button texto peligro"
                                          onClick={() => campoCriterio(i, 'niveles',
                                            (c.niveles || []).filter((_, k) => k !== j))}>✕</button>
                                </div>
                              ))}
                            </div>
                            <div className="rubrica-niveles-acciones">
                              <button type="button" className="enlace-texto"
                                      onClick={() => campoCriterio(i, 'niveles',
                                        [...(c.niveles || []), { etiqueta: '', puntos: 0, descripcion: '' }])}>
                                + Otro nivel
                              </button>
                              <button type="button" className="enlace-texto"
                                      onClick={() => campoCriterio(i, 'niveles', [])}>
                                Quitar los niveles
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* El aviso solo aparece si no cuadra: no hay que obligar a
                    que sume exacto, pero sí avisar cuando no lo hace. */}
                <p className={sumaPesos === Number(form.puntos_max) ? 'nota' : 'aviso-error'}>
                  Los criterios suman <strong>{sumaPesos}</strong> de {form.puntos_max} puntos.
                  {sumaPesos !== Number(form.puntos_max) && ' Revisa los pesos si querías que cuadrara.'}
                </p>
              </>
            )}
          </div>

          {editando !== 'nueva' && (
            <Prorrogas tipo="tarea" actividadId={editando}
                       cursoId={cursoId || cursoDelModulo}
                       fechaOriginal={form.fecha_limite || null} />
          )}

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary"
                    onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</button>
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : form.activo ? 'Guardar y publicar' : 'Guardar como borrador'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
