import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { supabase } from '../lib/supabase'
import { analizarUrl } from '../lib/helpers'
import { BUCKET_TALLERES, ENLACE_DIAPOSITIVAS_PRESENTAR_CASO, ENLACE_ENTREGABLES, ICONO_TIPO, NOMBRE_TIPO } from '../config'
import { ModalPortal, Breadcrumb, VideoPlayer, EmbedFrame, EditorBotonesExtra } from './ui'
import { enviarCorreo, obtenerEmailsInscritos, notificarInscritos } from '../lib/correo'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export function PdfViewer({ archivo, bucket }) {
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('Cargando documento...')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false, loadingTask = null, pdfDocument = null
    async function loadPdf() {
      try {
        setPages([]); setStatus('Descargando documento...')
        const { data: blob, error } = await supabase.storage.from(bucket).download(archivo)
        if (error) throw new Error(error.message)
        const buf = await blob.arrayBuffer()
        if (cancelled) return
        if (buf.byteLength === 0) throw new Error('El archivo está vacío')
        setStatus('Procesando...')
        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false })
        pdfDocument = await loadingTask.promise
        if (cancelled) return
        const cargadas = []
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          if (cancelled) return
          cargadas.push(await pdfDocument.getPage(i))
        }
        if (!cancelled) { setPages(cargadas); setStatus('') }
      } catch (err) { if (!cancelled) { setError(err.message); setStatus('') } }
    }
    loadPdf()
    return () => { cancelled = true; if (loadingTask) loadingTask.destroy(); if (pdfDocument) pdfDocument.destroy() }
  }, [archivo, bucket])

  if (error) return <div className="aviso-error">No se pudo cargar el documento: {error}</div>
  if (status) return <div className="loading">{status}</div>
  return <div className="pdf-viewer">{pages.map((p, i) => <PdfPage key={i} page={p} n={i + 1} total={pages.length} />)}</div>
}

function PdfPage({ page, n, total }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    let renderTask = null, cancelled = false
    async function render() {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const ancho = Math.min(window.innerWidth - 60, 860)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: ancho / base.width })
      const dpr = window.devicePixelRatio || 1
      const ctx = canvas.getContext('2d', { alpha: false })
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      renderTask = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null })
      await renderTask.promise
    }
    render().catch((e) => { if (e?.name !== 'RenderingCancelledException') console.error(e) })
    return () => { cancelled = true; if (renderTask) renderTask.cancel() }
  }, [page])

  return (
    <figure className="pdf-page">
      <canvas ref={canvasRef} aria-label={`Página ${n} de ${total}`} />
      <figcaption className="pdf-num">{n} / {total}</figcaption>
    </figure>
  )
}

/* ============================================================
   RECURSOS
   ============================================================ */
/* (VideoPlayer y EmbedFrame se movieron a src/components/ui.jsx) */

export function Autoevaluacion({ url, recursoId, userId, onComplete }) {
  const [intentos, setIntentos] = useState(0)
  const [completado, setCompletado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('progreso_usuario')
        .select('intentos, completado').eq('usuario_id', userId).eq('recurso_id', recursoId).maybeSingle()
      if (data) { setIntentos(data.intentos || 0); setCompletado(data.completado || false) }
      setCargando(false)
    }
    load()
  }, [recursoId, userId])

  const marcar = async () => {
    const n = intentos + 1
    const { error } = await supabase.from('progreso_usuario').upsert(
      { usuario_id: userId, recurso_id: recursoId, intentos: n, completado: true, ultimo_acceso: new Date().toISOString() },
      { onConflict: 'usuario_id, recurso_id' })
    if (!error) { setIntentos(n); setCompletado(true); onComplete() }
  }

  if (cargando) return <div className="loading">Cargando...</div>
  if (completado) return <div className="aviso-ok">✔ Autoevaluación completada.</div>
  if (intentos >= 3) return <div className="aviso-error">Alcanzaste el límite de 3 intentos.</div>
  return (
    <div>
      <p className="sutil">Máximo 3 intentos. Llevas {intentos}.</p>
      <iframe src={url} className="forms-iframe" title="Autoevaluación" />
      <button className="button primary" onClick={marcar}>Marcar como completada</button>
    </div>
  )
}

/* ============================================================
   MODAL: EDITAR / CREAR RECURSO (solo admin)
   ============================================================ */
export function ModalEditarRecurso({ recurso, moduloId, curso, modulo, onClose, onGuardado }) {
  const esNuevo = !recurso?.id
  const [form, setForm] = useState({
    tipo:        recurso?.tipo        || 'enlace',
    titulo:      recurso?.titulo      || '',
    descripcion: recurso?.descripcion || '',
    url:         (recurso?.url && recurso.url !== 'PENDIENTE') ? recurso.url : '',
    archivo:     recurso?.archivo     || '',
    contenido:   recurso?.contenido   || '',
    orden:       recurso?.orden       ?? 100,
  })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  // Opt-in: nada se envía solo. Si marcas, avisar es parte del guardado.
  const [notificar, setNotificar] = useState(false)
  // Tras crear (con aviso) el modal sigue abierto: evita un doble clic que
  // volvería a insertar el mismo recurso.
  const [creado, setCreado] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!form.titulo.trim()) { setMsg('El título es obligatorio'); return }
    setGuardando(true); setMsg('')
    try {
      const payload = {
        modulo_id:   moduloId,
        tipo:        form.tipo,
        titulo:      form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        url:         form.url.trim() || null,
        archivo:     form.archivo.trim() || null,
        contenido:   form.contenido.trim() || null,
        orden:       parseInt(form.orden, 10) || 100,
      }
      if (esNuevo) {
        const { data, error } = await supabase.from('recursos').insert(payload).select().single()
        if (error) throw error
        setCreado(true)
        onGuardado(data, 'creado')

        // Aviso opcional a los inscritos, ya con el recurso guardado en la BD.
        if (notificar) {
          const link = `${window.location.origin}/modulo/${moduloId}#r-${data.id}`
          const r = await notificarInscritos(curso?.id, {
            tipo: 'recurso-nuevo',
            curso: { titulo: curso?.titulo || modulo?.titulo, url: link },
            recurso: { titulo: data.titulo, descripcion: data.descripcion || '' },
          })
          // El recurso YA quedó guardado: si el aviso falla solo se pierde el correo.
          setMsg(r.ok
            ? `✓ Recurso creado y notificado a ${r.enviados} inscrito(s).`
            : `⚠️ Recurso creado, pero el aviso NO salió: ${r.motivo || 'error desconocido'}`)
          return // deja el modal abierto para que leas el resultado
        }
      } else {
        const { data, error } = await supabase.from('recursos').update(payload).eq('id', recurso.id).select().single()
        if (error) throw error
        onGuardado(data, 'actualizado')
      }
      onClose()
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar "${recurso.titulo}"? Esta acción no se puede deshacer.`)) return
    setGuardando(true)
    try {
      const { error } = await supabase.from('recursos').delete().eq('id', recurso.id)
      if (error) throw error
      onGuardado(recurso, 'eliminado')
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
        <h3>{esNuevo ? '➕ Nuevo recurso' : '✏️ Editar recurso'}</h3>

        <label>Tipo</label>
        <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          <option value="pdf">📄 PDF</option>
          <option value="video">🎬 Video</option>
          <option value="word">📝 Word / Descargable</option>
          <option value="enlace">🔗 Enlace</option>
          <option value="autoevaluacion">✍️ Autoevaluación</option>
        </select>

        <label>Título</label>
        <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)}
               placeholder="Ej. Lectura 1: Conceptos básicos" />

        <label>Descripción</label>
        <textarea rows="3" value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                  placeholder="Texto que aparece debajo del título" />

        {['video', 'enlace', 'autoevaluacion'].includes(form.tipo) && (
          <>
            <label>
              URL {form.tipo === 'autoevaluacion' ? '(Google Forms)' : ''}
            </label>
            <input type="url" value={form.url} onChange={e => set('url', e.target.value)}
                   placeholder="https://..." />
            {form.tipo === 'video' && (
              <p className="nota">Pega el link tal cual (YouTube o Google Drive). Se convierte a reproductor automáticamente.</p>
            )}
            {form.tipo === 'enlace' && (
              <p className="nota">Si es de YouTube, Google Drive o OneDrive, se mostrará dentro de la plataforma además del botón para abrirlo aparte.</p>
            )}
          </>
        )}

        {['pdf', 'word'].includes(form.tipo) && (
          <>
            <label>Archivo (ruta en Storage)</label>
            <input type="text" value={form.archivo} onChange={e => set('archivo', e.target.value)}
                   placeholder="Ej. PDF_M1_1.pdf o supervision/caso1.pdf" />
            <p className="nota">Ruta relativa dentro del bucket del curso.</p>
          </>
        )}

        <label>Orden</label>
        <input type="number" value={form.orden} onChange={e => set('orden', e.target.value)} />

        {esNuevo && (
          <div className="notificar-check">
            <label className="check-fila">
              <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)} />
              <span>
                <strong>📧 Notificar a los inscritos</strong><br />
                <span className="nota">
                  Al crear el recurso, manda el correo a todos los inscritos del curso
                  {curso?.titulo ? ` (${curso.titulo})` : ''}. Si lo dejas sin marcar, no se envía nada.
                </span>
              </span>
            </label>
          </div>
        )}

        {msg && (
          <p className={msg.startsWith('⚠️') || msg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'}
             style={{ marginTop: 12 }}>{msg}</p>
        )}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          {!esNuevo && (
            <button type="button" className="button texto" onClick={eliminar} disabled={guardando}
                    style={{ color: '#9B2C20', marginRight: 'auto' }}>
              🗑 Eliminar
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={guardar}
                  disabled={guardando || (esNuevo && creado)}>
            {guardando ? 'Guardando...'
              : (esNuevo && creado) ? '✓ Creado'
              : (esNuevo ? 'Crear' : 'Guardar')}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

export function ModalDuplicarModulo({ modulo, recursos, onClose }) {
  const navigate = useNavigate()
  const [cursosLista, setCursosLista] = useState([])
  const [cursoDestino, setCursoDestino] = useState('')
  const [titulo, setTitulo] = useState(modulo.titulo)
  const [grupo, setGrupo] = useState(modulo.grupo || '')
  const [orden, setOrden] = useState(modulo.orden ?? 100)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    supabase.from('cursos').select('id, titulo').eq('activo', true).order('orden')
      .then(({ data }) => {
        setCursosLista(data || [])
        if (data?.length) setCursoDestino(String(modulo.curso_id))
      })
  }, [modulo.curso_id])

  const duplicar = async () => {
    if (!cursoDestino) { setMsg('Elige un curso destino'); return }
    if (!titulo.trim()) { setMsg('El título es obligatorio'); return }
    setGuardando(true); setMsg('')
    try {
      const { data: nuevoModulo, error: eM } = await supabase.from('modulos').insert({
        curso_id:    parseInt(cursoDestino, 10),
        titulo:      titulo.trim(),
        descripcion: modulo.descripcion || null,
        orden:       parseInt(orden, 10) || 100,
        grupo:       grupo.trim() || null,
        oculto:      modulo.oculto ?? false,
        disponible:  modulo.disponible ?? true,
        activo:      true,
      }).select().single()
      if (eM) throw eM

      if (recursos.length) {
        const payload = recursos.map(r => ({
          modulo_id:   nuevoModulo.id,
          tipo:        r.tipo,
          titulo:      r.titulo,
          descripcion: r.descripcion,
          url:         r.url,
          archivo:     r.archivo,
          contenido:   r.contenido,
          orden:       r.orden,
        }))
        const { error: eR } = await supabase.from('recursos').insert(payload)
        if (eR) throw eR
      }

      setResultado(nuevoModulo)
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
        <h3>📋 Duplicar módulo</h3>

        {resultado ? (
          <>
            <p className="aviso-ok">
              "{resultado.titulo}" se creó con {recursos.length} recurso(s) copiado(s).
            </p>
            <div className="modal-botones" style={{ marginTop: 18 }}>
              <button type="button" className="button secondary" onClick={onClose}>Cerrar</button>
              <button type="button" className="button primary" onClick={() => navigate(`/modulo/${resultado.id}`)}>
                Ir al módulo nuevo →
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="nota" style={{ marginTop: 0 }}>
              Copia el título, la descripción y los {recursos.length} recurso(s) de "{modulo.titulo}" a un módulo nuevo,
              en el curso y subgrupo que elijas. Los archivos y enlaces se comparten, no se duplican en Storage.
            </p>

            <label>Curso destino</label>
            <select value={cursoDestino} onChange={e => setCursoDestino(e.target.value)}>
              <option value="">— Elige un curso —</option>
              {cursosLista.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>

            <label>Título del módulo nuevo</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} />

            <label>Subgrupo (grupo)</label>
            <input type="text" value={grupo} onChange={e => setGrupo(e.target.value)}
                   placeholder="Ej. Clínica — vacío = visible para todo el curso" />

            <label>Orden</label>
            <input type="number" value={orden} onChange={e => setOrden(e.target.value)} />

            {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

            <div className="modal-botones" style={{ marginTop: 18 }}>
              <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="button" className="button primary" onClick={duplicar} disabled={guardando}>
                {guardando ? 'Duplicando...' : `Duplicar con ${recursos.length} recurso(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </ModalPortal>
  )
}

export function ModalDuplicarRecurso({ recurso, cursoActualId, onClose }) {
  const navigate = useNavigate()
  const [cursosLista, setCursosLista] = useState([])
  const [cursoDestino, setCursoDestino] = useState(cursoActualId ? String(cursoActualId) : '')
  const [modulosDestino, setModulosDestino] = useState([])
  const [moduloDestinoId, setModuloDestinoId] = useState('')
  const [cargandoModulos, setCargandoModulos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    supabase.from('cursos').select('id, titulo').eq('activo', true).order('orden')
      .then(({ data }) => setCursosLista(data || []))
  }, [])

  useEffect(() => {
    if (!cursoDestino) { setModulosDestino([]); setModuloDestinoId(''); return }
    setCargandoModulos(true)
    supabase.from('modulos').select('id, titulo, grupo').eq('curso_id', cursoDestino).eq('activo', true).order('orden')
      .then(({ data }) => { setModulosDestino(data || []); setModuloDestinoId(''); setCargandoModulos(false) })
  }, [cursoDestino])

  const duplicar = async () => {
    if (!moduloDestinoId) { setMsg('Elige un módulo destino'); return }
    setGuardando(true); setMsg('')
    try {
      const { data, error } = await supabase.from('recursos').insert({
        modulo_id:   parseInt(moduloDestinoId, 10),
        tipo:        recurso.tipo,
        titulo:      recurso.titulo,
        descripcion: recurso.descripcion,
        url:         recurso.url,
        archivo:     recurso.archivo,
        contenido:   recurso.contenido,
        orden:       recurso.orden,
      }).select().single()
      if (error) throw error
      setResultado(data)
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
        <h3>📋 Duplicar recurso</h3>

        {resultado ? (
          <>
            <p className="aviso-ok">"{recurso.titulo}" se copió al módulo destino.</p>
            <div className="modal-botones" style={{ marginTop: 18 }}>
              <button type="button" className="button secondary" onClick={onClose}>Cerrar</button>
              <button type="button" className="button primary" onClick={() => navigate(`/modulo/${resultado.modulo_id}`)}>
                Ir al módulo →
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="nota" style={{ marginTop: 0 }}>
              Copia "{recurso.titulo}" a otro módulo (de cualquier curso). El archivo o enlace se comparte, no se duplica.
            </p>

            <label>Curso destino</label>
            <select value={cursoDestino} onChange={e => setCursoDestino(e.target.value)}>
              <option value="">— Elige un curso —</option>
              {cursosLista.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>

            <label>Módulo destino</label>
            <select value={moduloDestinoId} onChange={e => setModuloDestinoId(e.target.value)} disabled={!cursoDestino || cargandoModulos}>
              <option value="">{cargandoModulos ? 'Cargando...' : '— Elige un módulo —'}</option>
              {modulosDestino.map(m => (
                <option key={m.id} value={m.id}>{m.titulo}{m.grupo ? ` (${m.grupo})` : ''}</option>
              ))}
            </select>

            {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

            <div className="modal-botones" style={{ marginTop: 18 }}>
              <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="button" className="button primary" onClick={duplicar} disabled={guardando}>
                {guardando ? 'Duplicando...' : 'Duplicar recurso'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </ModalPortal>
  )
}

export function ModalNotificarRecurso({ recurso, modulo, curso, onClose }) {
  const [emails, setEmails] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false)
  const [msg, setMsg] = useState('')

  // Trae solo a los inscritos del curso: los destinatarios ya no se teclean a mano.
  const traerInscritos = async () => {
    if (!curso?.id) { setMsg('Este recurso no pertenece a un curso con inscritos.'); return }
    setCargandoAlumnos(true); setMsg('')
    try {
      const lista = await obtenerEmailsInscritos(curso?.id)
      if (!lista.length) { setMsg('No hay alumnos inscritos en este curso.'); return }
      const yaPegados = emails.split(/[,;\n\t ]+/).map(e => e.trim()).filter(Boolean)
      setEmails([...new Set(yaPegados.concat(lista))].join(', '))
      setMsg(`✓ ${lista.length} inscrito(s) agregado(s) a la lista.`)
    } catch (e) {
      setMsg('Error al leer inscritos: ' + e.message)
    } finally {
      setCargandoAlumnos(false)
    }
  }

  const parsearEmailsLocal = (texto) => texto
    .split(/[,;\n\r\t ]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e && e.includes('@') && e.includes('.'))
    .filter((e, i, arr) => arr.indexOf(e) === i)

  const destinatarios = parsearEmailsLocal(emails)
  const link = `${window.location.origin}/modulo/${modulo.id}#r-${recurso.id}`

  const enviar = async () => {
    if (destinatarios.length === 0) { setMsg('Pega al menos un correo válido'); return }
    setEnviando(true); setMsg('')
    try {
      const res = await enviarCorreo({
        tipo: 'recurso-nuevo',
        curso: { titulo: curso?.titulo || modulo.titulo, url: link },
        recurso: { titulo: recurso.titulo, descripcion: recurso.descripcion || '' },
        alumnos: destinatarios.map(email => ({ email, nombre_completo: '' })),
      })
      setMsg(res.ok
        ? `✓ Enviado y confirmado por el script (${destinatarios.length} correo(s)).`
        : `⚠️ ${res.motivo || 'No se pudo enviar.'} Revisa "Enviados" en Gmail.`)
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={() => !enviando && onClose()}>
      <div className="modal-box modal-recurso" onClick={e => e.stopPropagation()}>
        <h3>📧 Notificar recurso nuevo</h3>
        <p className="nota" style={{ marginTop: 0 }}>
          Pega los correos de quienes deben enterarse de "{recurso.titulo}". Se les manda un correo con el link directo
          al recurso dentro de la plataforma. Úsalo para talleres gratuitos donde no hay inscripción formal.
        </p>

        <label>Correos (separados por coma, punto y coma o salto de línea)</label>
        <div className="examen-import-botones" style={{ marginTop: 0 }}>
          <button type="button" className="button secondary" onClick={traerInscritos} disabled={cargandoAlumnos}>
            {cargandoAlumnos ? 'Buscando…' : '👥 Traer a los inscritos del curso'}
          </button>
          <button type="button" className="button texto" onClick={() => setEmails('')} disabled={!emails}>
            Vaciar lista
          </button>
        </div>
        <textarea rows="5" value={emails} onChange={e => setEmails(e.target.value)}
                  placeholder="O presiona «Traer a los inscritos»"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
        <p className="nota" style={{ marginTop: 6 }}>{destinatarios.length} correo(s) válido(s) detectado(s)</p>
        <p className="nota" style={{ marginTop: 6 }}>Link que se incluirá: <code>{link}</code></p>

        {msg && <p className={msg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'} style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={enviando}>Cerrar</button>
          <button type="button" className="button whatsapp" onClick={enviar} disabled={enviando || destinatarios.length === 0}>
            {enviando ? 'Enviando...' : `Notificar a ${destinatarios.length} correo(s)`}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

export function RecursoCard({ recurso, bucket, user, visto, onMarcarVisto, gestiona, onEditar, onDuplicar, onNotificar, onToggleDisponible, esGratuito }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const enlaceEmbebible = recurso.tipo === 'enlace' && analizarUrl(recurso.url).embeddable
  const colapsable = ['pdf', 'video', 'autoevaluacion'].includes(recurso.tipo) || enlaceEmbebible
  const videoSinUrl = recurso.tipo === 'video' && (!recurso.url || recurso.url === 'PENDIENTE')
  const bloqueado = recurso.disponible === false && !gestiona

  const abrirNuevaPestana = async () => {
    setOcupado(true)
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(recurso.archivo, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      const { data } = supabase.storage.from(bucket).getPublicUrl(recurso.archivo)
      window.open(data.publicUrl, '_blank', 'noopener,noreferrer')
    }
    setOcupado(false)
  }

  const descargar = async () => {
    setOcupado(true)
    try {
      const { data, error } = await supabase.storage.from(bucket).download(recurso.archivo)
      if (error) throw error
      const a = document.createElement('a')
      a.href = URL.createObjectURL(data)
      a.download = recurso.archivo.split('/').pop()
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (err) { alert('Error al descargar: ' + err.message) }
    setOcupado(false)
  }

  return (
    <article className="recurso-item" id={`r-${recurso.id}`}>
      <div className="recurso-cabecera">
        <div className="recurso-titulo">
          <span className="recurso-icono" aria-hidden="true">{ICONO_TIPO[recurso.tipo] || '📌'}</span>
          <div>
            <h3>{recurso.titulo}</h3>
            <span className="recurso-tipo">{NOMBRE_TIPO[recurso.tipo] || 'Recurso'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {visto && <span className="badge ok">✔ Visto</span>}
          {gestiona && recurso.disponible === false && <span className="etiqueta-grupo">🔒 Oculto para alumnos</span>}
          {gestiona && onToggleDisponible && (
            <button type="button" className={`candado-toggle ${recurso.disponible === false ? 'cerrado' : 'abierto'}`}
                    onClick={() => onToggleDisponible(recurso)}
                    title={recurso.disponible === false ? 'Abrir recurso' : 'Cerrar recurso'}>
              {recurso.disponible === false ? '🔒' : '🔓'}
            </button>
          )}
          {gestiona && esGratuito && onNotificar && (
            <button type="button" className="recurso-edit-btn" onClick={() => onNotificar(recurso)} title="Notificar por correo">
              📧 Notificar
            </button>
          )}
          {gestiona && onDuplicar && (
            <button type="button" className="recurso-edit-btn" onClick={() => onDuplicar(recurso)} title="Duplicar recurso">
              📋 Duplicar
            </button>
          )}
          {gestiona && onEditar && (
            <button type="button" className="recurso-edit-btn"
                    onClick={() => onEditar(recurso)}
                    title="Editar recurso">
              ✏️ Editar
            </button>
          )}
        </div>
      </div>

      {recurso.descripcion && <p className="recurso-desc">{recurso.descripcion}</p>}

      {bloqueado ? (
        <div className="recurso-acciones">
          <button className="button secondary" disabled>🔒 Próximamente</button>
        </div>
      ) : (
        <>
          <div className="recurso-acciones">
            {colapsable && !videoSinUrl && (
              <button className={`button ${abierto ? 'secondary' : 'primary'}`} onClick={() => setAbierto(v => !v)} aria-expanded={abierto}>
                {abierto ? 'Ocultar material' : 'Ver material'}
              </button>
            )}
            {videoSinUrl && <button className="button secondary" disabled>🎬 Grabación en proceso</button>}
            {recurso.tipo === 'enlace' && (
              <a className="button primary" href={recurso.url} target="_blank" rel="noopener noreferrer">Abrir enlace →</a>
            )}
            {recurso.tipo === 'pdf' && (
              <button className="button secondary" onClick={abrirNuevaPestana} disabled={ocupado}>
                {ocupado ? 'Abriendo...' : 'Abrir en pestaña nueva ↗'}
              </button>
            )}
            {recurso.tipo === 'word' && (
              <button className="button primary" onClick={descargar} disabled={ocupado}>
                {ocupado ? 'Descargando...' : 'Descargar documento'}
              </button>
            )}
            {user && !visto && recurso.tipo !== 'autoevaluacion' && !videoSinUrl && (
              <button className="button texto" onClick={() => onMarcarVisto(recurso.id)}>Marcar como visto</button>
            )}
          </div>
        </>
      )}

      {!bloqueado && abierto && (
        <div className="recurso-contenido">
          {recurso.tipo === 'pdf' && <PdfViewer archivo={recurso.archivo} bucket={bucket} />}
          {recurso.tipo === 'video' && <VideoPlayer url={recurso.url} />}
          {enlaceEmbebible && <EmbedFrame url={recurso.url} />}
          {recurso.tipo === 'autoevaluacion' && user &&
            <Autoevaluacion url={recurso.url} recursoId={recurso.id} userId={user.id} onComplete={() => onMarcarVisto(recurso.id)} />}
        </div>
      )}
    </article>
  )
}

/* ============================================================
   DIAPOSITIVAS / ENTREGABLES
   ============================================================ */
export function DiapositivasPresentarCaso() {
  return (
    <section className="diapositivas-bloque">
      <header className="diapositivas-header">
        <span className="recurso-icono">📽️</span>
        <div>
          <h3>Diapositivas para presentar tu caso</h3>
          <p className="recurso-desc">
            Usa esta plantilla para estructurar la presentación de tu caso en la sesión de supervisión.
            Incluye los apartados que revisaremos juntos: motivo de consulta, análisis funcional, hipótesis y plan.
          </p>
        </div>
      </header>
      <div className="diapositivas-acciones">
        <a className="button primary ancho" target="_blank" rel="noopener noreferrer" href={ENLACE_DIAPOSITIVAS_PRESENTAR_CASO}>
          📽️ Abrir diapositivas en OneDrive
        </a>
        <p className="nota" style={{ marginTop: 8 }}>Se abre en una pestaña nueva. Puedes descargarla y editarla con tu propio caso.</p>
      </div>
    </section>
  )
}

export function Entregables() {
  return (
    <section className="entregables-bloque">
      <header className="entregables-header">
        <span className="recurso-icono">📤</span>
        <div>
          <h3>Entregables / productos</h3>
          <p className="recurso-desc">
            Las actividades de las <strong>sesiones 1 y 2</strong> se realizan <strong>en equipo durante la sesión</strong>
            {' '}y se suben como entregables al final de cada una. Nombren cada archivo haciendo referencia al{' '}
            <strong>nombre de su región</strong> (ej. <em>Región_Norte_S1_análisis.pdf</em>).
          </p>
        </div>
      </header>
      <div className="entregables-acciones">
        <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer" href={ENLACE_ENTREGABLES}>
          📤 Subir mi entregable a OneDrive
        </a>
        <p className="nota" style={{ marginTop: 8 }}>Se abre la carpeta compartida en una pestaña nueva. Sube tu archivo ahí con el nombre indicado.</p>
      </div>
    </section>
  )
}
