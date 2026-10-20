import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ModalPortal, EmbedFrame, VideoPlayer, EditorBotonesExtra } from './ui'
import { analizarUrl, emiteConstancia } from '../lib/helpers'
import { enviarCorreo } from '../lib/correo'
import { materialDeTaller, guardarMaterialTaller } from '../lib/material'
import { rutaAcceso, rutaRegistro } from '../config'
import { fechaConLetra } from '../lib/plantillas'
import { htmlConstancia, FIRMA_URL, LOGO_URL } from '../lib/constancia-html'
import ExamenModulo from './ExamenModulo'

/* ============================================================
   TALLERES - modal de edicion + material del taller
   Extraido de App.jsx en el refactor (etapa 2c).
   ============================================================ */

// Se exporta porque App.jsx lo usa en CursoCard (botón "Editar taller").
// Antes solo quedaba local aquí y App.jsx lo renderizaba sin importarlo:
// ReferenceError en runtime al pulsar ese botón.
export function ModalEditarTaller({ curso, onClose, onGuardado }) {
  const [form, setForm] = useState({
    fecha_sesion:    curso.fecha_sesion || '',
    link_registro:   curso.link_registro || '',
    registro_texto:  curso.registro_texto || '',
    registro_activo: curso.registro_activo !== false,
    link_grabacion:  '',
    grabacion_texto: '',
    grabacion_activo: true,
    link_materiales: '',
    materiales_activo: false,
    botones_extra:   [],
    constancia_gratuita_activa: curso.constancia_gratuita_activa === true,
    constancia_incluir_horas: curso.constancia_incluir_horas !== false,
    constancia_horas: curso.constancia_horas || null,
  })
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // El material sensible ya no vive en `cursos`: se pide por RPC y rellena
  // el formulario. Quien no tenga permiso recibe null y los campos quedan
  // vacíos (aquí solo entra admin/gestor, así que normalmente sí llega).
  useEffect(() => {
    let vivo = true
    materialDeTaller(curso.id).then(m => {
      if (!vivo || !m) return
      setForm(f => ({
        ...f,
        link_grabacion:  m.link_grabacion || '',
        grabacion_texto: m.grabacion_texto || '',
        grabacion_activo: m.grabacion_activo !== false,
        link_materiales: m.link_materiales || '',
        materiales_activo: m.materiales_activo === true,
        botones_extra:   Array.isArray(m.botones_extra) && m.botones_extra.length ? m.botones_extra : [],
      }))
    })
    return () => { vivo = false }
  }, [curso.id])

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      const botonesValidos = form.botones_extra.filter(b => (b.texto || '').trim() && (b.url || '').trim())

      // Lo público (fecha, registro, constancia) sigue en `cursos`.
      const publico = {
        fecha_sesion:    form.fecha_sesion.trim() || null,
        link_registro:   form.link_registro.trim() || null,
        registro_texto:  form.registro_texto.trim() || null,
        registro_activo: !!form.registro_activo,
        constancia_gratuita_activa: !!form.constancia_gratuita_activa,
        constancia_incluir_horas: !!form.constancia_incluir_horas,
        constancia_horas: form.constancia_horas || null,
      }
      const res = await supabase.from('cursos').update(publico).eq('id', curso.id).select().single()
      if (res.error) throw res.error

      // Lo sensible (grabación, materiales, botones extra) va por RPC a
      // `curso_material`, que no expone esos datos salvo a quien debe.
      await guardarMaterialTaller(curso.id, {
        link_grabacion:  form.link_grabacion.trim() || null,
        grabacion_texto: form.grabacion_texto.trim() || null,
        grabacion_activo: !!form.grabacion_activo,
        link_materiales: form.link_materiales.trim() || null,
        materiales_activo: !!form.materiales_activo,
        botones_extra:   botonesValidos,
      })

      // Devolvemos el curso público ya con el material encima, para que la
      // tarjeta lo pinte sin recargar. El RPC es la fuente de verdad.
      onGuardado({
        ...res.data,
        link_grabacion:  form.link_grabacion.trim() || null,
        grabacion_texto: form.grabacion_texto.trim() || null,
        link_materiales: form.link_materiales.trim() || null,
        botones_extra:   botonesValidos,
      })
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
        <h3>✏️ Editar taller</h3>

        <label>Fecha y hora de la sesión (texto libre)</label>
        <input type="text" value={form.fecha_sesion} onChange={e => set('fecha_sesion', e.target.value)}
               placeholder="Ej. 13 de septiembre de 2026 · 7:30 – 9:00 pm (CST)" />

        <label>Link de registro a la sesión en vivo</label>
        <input type="url" value={form.link_registro} onChange={e => set('link_registro', e.target.value)}
               placeholder="https://forms.office.com/..." />
        <p className="nota">
          Si es de Microsoft Forms o Google Forms (usa el link de "Insertar código/Embed"), se puede mostrar
          incrustado en la página. Cualquier otro link solo abre aparte.
        </p>

        <label>Texto del botón (cuando está activo)</label>
        <input type="text" value={form.registro_texto} onChange={e => set('registro_texto', e.target.value)}
               placeholder="📅 Registrarme a la sesión en vivo" />
        <p className="nota">
          El candado 🔓/🔒 lo prende o apaga sin borrar el link — ciérralo en cuanto la sesión ya se haya dado.
        </p>

        <label>Link de la grabación</label>
        <input type="url" value={form.link_grabacion} onChange={e => set('link_grabacion', e.target.value)}
               placeholder="https://youtube.com/watch?v=... (no listado)" />
        <p className="nota">Pega el link de YouTube <strong>no listado</strong> — se incrusta solo. Para Zoom/Teams/Jitsi/Meet usa abajo "Botones adicionales" (abren en pestaña aparte, sin límite de 5 min).</p>

        <label>Texto del botón (cuando está activo)</label>
        <input type="text" value={form.grabacion_texto} onChange={e => set('grabacion_texto', e.target.value)}
               placeholder="🎬 Ver grabación" />
        <p className="nota">
          El candado 🔓/🔒 junto a este botón en la tarjeta del curso lo prende o apaga sin borrar el link.
        </p>

        <label>Link de materiales</label>
        <input type="url" value={form.link_materiales} onChange={e => set('link_materiales', e.target.value)}
               placeholder="https://onedrive.live.com/embed?... (Insertar)" />
        <p className="nota">A los visitantes sin cuenta se les pide su correo antes de mostrarles este link. Tip OneDrive: usa <strong>Compartir → Insertar / Embed</strong> (<code>onedrive.live.com/embed</code>) en vez del <code>1drv.ms</code> corto para que salga "Ver aquí".</p>

        {curso.gratuito && (
          <>
            <label>
              <input type="checkbox" checked={form.constancia_gratuita_activa}
                     onChange={(e) => set('constancia_gratuita_activa', e.target.checked)} />
              {' '}Constancia habilitada para quienes tienen cuenta
            </label>
            <p className="nota">
              Mientras esté apagada no se promete constancia a nadie. Enciéndela cuando el
              taller haya terminado: se emitirá con el nombre que cada quien dio al registrarse.
              (Si la casilla no guarda, falta correr supabase/ALTA_PUBLICA.sql en el SQL Editor.)
            </p>
            {form.constancia_gratuita_activa && (
              <>
                <label style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={form.constancia_incluir_horas}
                         onChange={(e) => set('constancia_incluir_horas', e.target.checked)} />
                  {' '}Incluir número de horas en la constancia
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>Horas del taller:</span>
                  <input className="input" type="number" min="1" max="999"
                         value={form.constancia_horas == null ? '' : form.constancia_horas}
                         onChange={(e) => set('constancia_horas', e.target.value === '' ? null : Number(e.target.value))}
                         placeholder="Ej. 4" />
                </label>
                <p className="nota" style={{ marginTop: 6 }}>
                  Si marcas «Incluir número de horas», la constancia del taller
                  mostrará la duración en el documento descargable.
                </p>
                <button type="button" className="button texto" style={{ marginTop: 8 }}
                        onClick={() => setVistaPreviaAbierta(true)}>
                  👁️ Vista previa de la constancia
                </button>
              </>
            )}
          </>
        )}

        <label>Botones adicionales (ej. liga de Teams en vivo)</label>
        <p className="nota" style={{ marginTop: 0 }}>
          Para sesión en vivo pega aquí la liga de <strong>Teams</strong> (abre en pestaña aparte ↗, sin límite).
          Cada botón tiene su propio candado 🔓/🔒 en la tarjeta del curso: úsalo para ocultarlo cuando ya pasó,
          sin borrar el link — así lo reabres la próxima vez sin volver a pegar todo.
        </p>
        <EditorBotonesExtra botones={form.botones_extra} onChange={(b) => set('botones_extra', b)} />

        {msg && <p className="aviso-error" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="modal-botones" style={{ marginTop: 18 }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Vista previa con los valores ACTUALES del formulario (sin guardar):
          el docente marca/desmarca «incluir horas», cambia el número y ve
          el efecto al instante antes de activar la constancia. Usa el
          MISMO htmlConstancia que imprime el alumno (lib/constancia-html). */}
      {vistaPreviaAbierta && (
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setVistaPreviaAbierta(false) }}
             style={{ position: 'fixed', inset: 0, background: '#0009', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}
               style={{ maxHeight: '94vh', width: 'min(960px, 96vw)', overflowY: 'auto' }}>
            <h2>Vista previa de la constancia</h2>
            <p className="nota" style={{ marginTop: 0 }}>
              Así se verá la constancia que descargarán tus alumnos. El nombre y el folio
              son de ejemplo; el curso, el diseño y{' '}
              {form.constancia_incluir_horas && form.constancia_horas
                ? <strong>las {form.constancia_horas} hora(s) del taller</strong>
                : <strong>la omisión de horas</strong>}{' '}
              son los valores reales que acabas de configurar.
            </p>
            <iframe
              title="Vista previa de la constancia"
              style={{ width: '100%', height: '72vh', border: '1px solid #D6DCE3', borderRadius: 10, background: '#e8e5df' }}
              srcDoc={htmlConstancia({
                nombre: 'María Fernanda López Hernández',
                curso: curso.titulo || '',
                nota10: null,
                folio: 'EJEMPLO-2026-VISTAPREVIA',
                fecha: fechaConLetra(new Date()),
                firmaUrl: typeof window === 'undefined' ? FIRMA_URL : new URL(FIRMA_URL, window.location.origin).href,
                logoUrl: typeof window === 'undefined' ? LOGO_URL : new URL(LOGO_URL, window.location.origin).href,
                incluirHoras: form.constancia_incluir_horas,
                horas: form.constancia_horas,
              })}
            />
            <div className="modal-botones">
              <button type="button" className="button primary" onClick={() => setVistaPreviaAbierta(false)}>
                Cerrar vista previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ModalPortal>
  )
}

export default function TallerRecursos({ curso: cursoProp, user, gestiona, onActualizado }) {
  const [editando, setEditando] = useState(false)
  const [emailLead, setEmailLead] = useState('')
  const [solicitando, setSolicitando] = useState(false)
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [msgLead, setMsgLead] = useState('')
  const [verGrabacion, setVerGrabacion] = useState(false)
  const [verMateriales, setVerMateriales] = useState(false)
  const [verRegistro, setVerRegistro] = useState(false)
  const [verBotonesExtra, setVerBotonesExtra] = useState({})

  // El material sensible se pide por RPC y se fusiona sobre el curso. Sin
  // permiso el RPC da null → `material` queda {} → no hay enlaces que
  // pintar: la pantalla muestra "grabación en proceso" en lugar de un link
  // que no debía estar. Es el seguro por defecto.
  const [material, setMaterial] = useState(null)
  useEffect(() => {
    let vivo = true
    materialDeTaller(cursoProp.id).then(m => { if (vivo) setMaterial(m || {}) })
    return () => { vivo = false }
  }, [cursoProp.id])
  const curso = { ...cursoProp, ...(material || {}) }

  // El candado controla "visible al público / oculto". Apagarlo quita el
  // botón de la vista del público; el admin siempre ve el candado y un
  // estado "(oculto)" para poder reactivarlo.
  const grabacionVisible = material?.grabacion_activo !== false
  const registroVisible = cursoProp.registro_activo !== false
  const grabacionAbierta = grabacionVisible && !!curso.link_grabacion
  const registroAbierto = registroVisible && !!curso.link_registro
  const materialesVisible = material?.materiales_activo === true
  const botonesExtra = curso.botones_extra || []

  const grabacionEmbebible = analizarUrl(curso.link_grabacion).embeddable
  const materialesEmbebible = analizarUrl(curso.link_materiales).embeddable
  const registroEmbebible = analizarUrl(curso.link_registro).embeddable

  const toggleGrabacionActivo = async () => {
    const nuevo = material?.grabacion_activo === false
    try {
      await guardarMaterialTaller(curso.id, { grabacion_activo: nuevo })
    } catch (e) { alert('Error: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), grabacion_activo: nuevo }))
  }

  const toggleMaterialesActivo = async () => {
    const nuevo = material?.materiales_activo !== true
    try {
      await guardarMaterialTaller(curso.id, { materiales_activo: nuevo })
    } catch (e) { alert('Error: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), materiales_activo: nuevo }))
  }

  const toggleRegistroActivo = async () => {
    const nuevo = curso.registro_activo === false
    const { error } = await supabase.from('cursos').update({ registro_activo: nuevo }).eq('id', curso.id)
    if (error) { alert('Error: ' + error.message); return }
    onActualizado({ ...cursoProp, registro_activo: nuevo })
  }

  // Candado individual para botones extra
  const toggleBotonExtraActivo = async (idx) => {
    const nuevos = botonesExtra.map((b, i) =>
      i === idx ? { ...b, activo: b.activo === false ? true : false } : b
    )
    try {
      await guardarMaterialTaller(curso.id, { botones_extra: nuevos })
    } catch (e) { alert('Error: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), botones_extra: nuevos }))
  }

  /* ELIMINAR DE VERDAD: un hueco fijo (registro, grabación, materiales)
     se elimina vaciando su enlace y su texto; sin enlace el bloque ya no
     se pinta para nadie. Se recupera pegando el enlace en «Editar
     taller». Los botones extra se quitan de la lista. */
  const eliminarRegistro = async () => {
    if (!window.confirm('¿Eliminar el registro a la sesión en vivo? Se borran su enlace y su texto. Para volver a tenerlo, pega el enlace en «Editar taller».')) return
    const upd = { link_registro: null, registro_texto: null, registro_activo: true }
    const { error } = await supabase.from('cursos').update(upd).eq('id', curso.id)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    onActualizado({ ...cursoProp, ...upd })
  }
  const vaciarMaterial = async (datos, que) => {
    if (!window.confirm(`¿Eliminar ${que}? Se borran su enlace y su texto. Para volver a tenerlo, pega el enlace en «Editar taller».`)) return
    try { await guardarMaterialTaller(curso.id, datos) } catch (e) { alert('No se pudo eliminar: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), ...datos }))
  }
  const eliminarGrabacion = () => vaciarMaterial({ link_grabacion: '', grabacion_texto: '', grabacion_activo: true }, 'la grabación')
  const eliminarMateriales = () => vaciarMaterial({ link_materiales: '', materiales_texto: '' }, 'los materiales')
  const eliminarBotonExtra = async (idx) => {
    if (!window.confirm(`¿Eliminar el botón «${botonesExtra[idx]?.texto || 'extra'}»? No se puede deshacer.`)) return
    const nuevos = botonesExtra.filter((_, i) => i !== idx)
    try { await guardarMaterialTaller(curso.id, { botones_extra: nuevos }) } catch (e) { alert('No se pudo eliminar: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), botones_extra: nuevos }))
  }

  // Candado + papelera, iguales en todos los bloques.
  const controles = (visible, alternar, eliminar) => gestiona && (
    <div className="controles-gestion">
      <button type="button" className={`candado-toggle ${visible ? 'abierto' : 'cerrado'}`}
              onClick={alternar} title={visible ? 'Ocultar al público' : 'Mostrar al público'}>
        {visible ? '🔓' : '🔒'}
      </button>
      <button type="button" className="candado-toggle borrar" onClick={eliminar}
              title="Eliminar" aria-label="Eliminar">🗑️</button>
    </div>
  )

  const solicitarMateriales = async () => {
    const email = emailLead.trim().toLowerCase()
    if (!email.includes('@') || !email.includes('.')) { setMsgLead('Escribe un correo válido'); return }
    setSolicitando(true); setMsgLead('')
    try {
      await supabase.from('leads_talleres').insert({ curso_id: curso.id, email })
      // El correo es "best effort": si falla, el lead ya quedó guardado.
      enviarCorreo({ tipo: 'solicitud-materiales', curso: { titulo: curso.titulo }, email }).catch(() => {})
      setDesbloqueado(true)
    } catch (e) {
      setMsgLead('Error: ' + e.message)
    } finally {
      setSolicitando(false)
    }
  }

  return (
    <section className="taller-recursos">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 className="titulo-seccion">Material del taller</h2>
        {gestiona && (
          <button type="button" className="button secondary" onClick={() => setEditando(true)}>✏️ Editar taller</button>
        )}
      </div>

      {/* Sin enlace no hay bloque, para nadie. Con enlace: el público lo
          ve abierto; quien gestiona, también oculto, con candado y papelera. */}
      {(registroAbierto || (gestiona && curso.link_registro)) && (
        <article className="recurso-item">
          <div className="recurso-cabecera">
            <div className="recurso-titulo">
              <span className="recurso-icono" aria-hidden="true">📝</span>
              <div><h3>Registro a la sesión en vivo</h3></div>
            </div>
            {controles(registroVisible, toggleRegistroActivo, eliminarRegistro)}
          </div>
          {registroAbierto ? (
            <>
              <div className="recurso-acciones">
                {registroEmbebible && (
                  <button className={`button ${verRegistro ? 'secondary' : 'primary'}`} onClick={() => setVerRegistro(v => !v)}>
                    {verRegistro ? 'Ocultar formulario' : 'Registrarme aquí'}
                  </button>
                )}
                <a className={`button ${registroEmbebible ? 'secondary' : 'primary'}`} target="_blank" rel="noopener noreferrer" href={curso.link_registro}>
                  {curso.registro_texto || 'Registrarme ↗'}
                </a>
              </div>
              {registroEmbebible && verRegistro && (
                <div className="recurso-contenido">
                  <EmbedFrame url={curso.link_registro} />
                </div>
              )}
            </>
          ) : (
            <div className="recurso-acciones">
              <button className="button secondary" disabled>
                🔒 Registro (oculto)
              </button>
            </div>
          )}
        </article>
      )}

      {(grabacionAbierta || (gestiona && curso.link_grabacion)) && (
        <article className="recurso-item">
          <div className="recurso-cabecera">
            <div className="recurso-titulo">
              <span className="recurso-icono" aria-hidden="true">🎬</span>
              <div><h3>Grabación de la sesión</h3></div>
            </div>
            {controles(grabacionVisible, toggleGrabacionActivo, eliminarGrabacion)}
          </div>
          {grabacionAbierta ? (
            <>
              <div className="recurso-acciones">
                {grabacionEmbebible && (
                  <button className={`button ${verGrabacion ? 'secondary' : 'primary'}`} onClick={() => setVerGrabacion(v => !v)}>
                    {verGrabacion ? 'Ocultar grabación' : 'Ver aquí'}
                  </button>
                )}
                <a className={`button ${grabacionEmbebible ? 'secondary' : 'primary'}`} target="_blank" rel="noopener noreferrer" href={curso.link_grabacion}>
                  {curso.grabacion_texto || 'Ver grabación ↗'}
                </a>
              </div>
              {grabacionEmbebible && verGrabacion && (
                <div className="recurso-contenido">
                  <VideoPlayer url={curso.link_grabacion} />
                </div>
              )}
              {/* CTA del taller gratuito para quien llega sin sesión.
                 La grabación se queda abierta a todos: es el mejor imán
                 de descubrimiento y ya era así. Lo que pide cuenta es la
                 constancia y el foro, que es lo que ofrece este botón. */}
              {curso.gratuito && !user && (
                <div className="recurso-acciones">
                  <Link className="button primary" to={rutaRegistro(`/curso/${curso.id}`)}>
                    Crea tu cuenta: tu constancia y el foro con el docente
                  </Link>
                  <Link className="button secondary" to={rutaAcceso(`/curso/${curso.id}`)}>
                    Ya tengo cuenta
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="recurso-acciones">
              <button className="button secondary" disabled>
                🔒 Grabación (oculta)
              </button>
            </div>
          )}
        </article>
      )}

      {curso.gratuito && (
        <article className="recurso-item">
          <div className="recurso-cabecera">
            <div className="recurso-titulo">
              <span className="recurso-icono" aria-hidden="true">📜</span>
              <div><h3>Constancia del taller</h3></div>
            </div>
          </div>
          {user ? (
            emiteConstancia(curso) ? (
              <div className="recurso-acciones">
                <Link className="button primary" to={`/constancia/${curso.id}`}>
                  Descargar mi constancia
                </Link>
                <p className="nota" style={{ margin: 0 }}>
                  Se emite con el nombre con el que te registraste. Cada constancia admite 2 descargas.
                </p>
              </div>
            ) : (
              <p className="nota" style={{ margin: 0 }}>
                La constancia se habilita al terminar el taller; el botón de descarga aparecerá aquí.
              </p>
            )
          ) : (
            <div className="recurso-acciones">
              <Link className="button secondary" to={rutaRegistro(`/curso/${curso.id}`)}>
                Crea tu cuenta para descargar tu constancia
              </Link>
            </div>
          )}
        </article>
      )}

      {curso.link_materiales && (gestiona || materialesVisible) && (
        <article className="recurso-item">
          <div className="recurso-cabecera">
            <div className="recurso-titulo">
              <span className="recurso-icono" aria-hidden="true">📄</span>
              <div><h3>Materiales del taller</h3></div>
            </div>
            {controles(materialesVisible, toggleMaterialesActivo, eliminarMateriales)}
          </div>

          {!materialesVisible ? (
            <div className="recurso-acciones">
              <button className="button secondary" disabled>🔒 Materiales (ocultos)</button>
            </div>
          ) : (user || desbloqueado) ? (
            <>
              <div className="recurso-acciones">
                {materialesEmbebible && (
                  <button className={`button ${verMateriales ? 'secondary' : 'primary'}`} onClick={() => setVerMateriales(v => !v)}>
                    {verMateriales ? 'Ocultar materiales' : 'Ver aquí'}
                  </button>
                )}
                <a className={`button ${materialesEmbebible ? 'secondary' : 'primary'}`} target="_blank" rel="noopener noreferrer" href={curso.link_materiales}>
                  Descargar materiales ↗
                </a>
              </div>
              {materialesEmbebible && verMateriales && (
                <div className="recurso-contenido">
                  <EmbedFrame url={curso.link_materiales} />
                </div>
              )}
            </>
          ) : (
            <div className="taller-lead-form">
              <p className="nota" style={{ marginTop: 0 }}>Déjanos tu correo para enviarte los materiales y avisarte de futuros talleres.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="email" value={emailLead} onChange={e => setEmailLead(e.target.value)} placeholder="tu@correo.com" />
                <button type="button" className="button primary" onClick={solicitarMateriales} disabled={solicitando}>
                  {solicitando ? 'Enviando...' : 'Quiero los materiales'}
                </button>
              </div>
              {msgLead && <p className="aviso-error" style={{ marginTop: 8 }}>{msgLead}</p>}
            </div>
          )}
        </article>
      )}

      {/* El público solo ve los botones con activo !== false; el admin ve
          todos y cada uno con su candado. La sección se oculta si no hay
          nada que mostrar. */}
      {botonesExtra.some(b => gestiona || b.activo !== false) && (
        <article className="recurso-item">
          <div className="recurso-cabecera">
            <div className="recurso-titulo">
              <span className="recurso-icono" aria-hidden="true">🔗</span>
              <div><h3>Sesiones y enlaces extra</h3></div>
            </div>
          </div>
          <div className="recurso-acciones" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {botonesExtra.map((b, i) => {
              const visible = b.activo !== false
              if (!gestiona && !visible) return null
              const info = analizarUrl(b.url)
              const verlo = !!verBotonesExtra[i]
              return (
                <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!visible ? (
                    <button className="button secondary" disabled>{b.texto} (oculto)</button>
                  ) : (
                    <>
                      {info.embeddable && (
                        <button type="button" className={`button ${verlo ? 'secondary' : 'primary'}`}
                                onClick={() => setVerBotonesExtra(v => ({ ...v, [i]: !v[i] }))}>
                          {verlo ? 'Ocultar' : 'Ver aquí'} · {b.texto}
                        </button>
                      )}
                      <a className={`button ${info.embeddable ? 'secondary' : 'primary'}`} target="_blank" rel="noopener noreferrer" href={b.url}>
                        {b.texto} ↗
                      </a>
                    </>
                  )}
                  {controles(visible, () => toggleBotonExtraActivo(i), () => eliminarBotonExtra(i))}
                  {visible && info.embeddable && verlo && (
                    <div className="recurso-contenido" style={{ flexBasis: '100%' }}>
                      <EmbedFrame url={b.url} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </article>
      )}

      {editando && (
        <ModalEditarTaller curso={curso} onClose={() => setEditando(false)} onGuardado={onActualizado} />
      )}

      {/* Examen del curso completo (nivel curso). Los talleres no tienen módulos,
          así que aquí es donde vive su evaluación. */}
      <ExamenModulo cursoId={curso.id} user={user} gestiona={gestiona} etiquetaDestino={`el curso "${curso.titulo}"`} />
    </section>
  )
}