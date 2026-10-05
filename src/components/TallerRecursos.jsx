import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ModalPortal, EmbedFrame, VideoPlayer, EditorBotonesExtra } from './ui'
import { analizarUrl } from '../lib/helpers'
import { enviarCorreo } from '../lib/correo'
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
    link_grabacion:  curso.link_grabacion || '',
    grabacion_texto: curso.grabacion_texto || '',
    link_materiales: curso.link_materiales || '',
    botones_extra:   curso.botones_extra?.length ? curso.botones_extra : [],
  })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    setGuardando(true); setMsg('')
    try {
      const botonesValidos = form.botones_extra.filter(b => (b.texto || '').trim() && (b.url || '').trim())
      const payload = {
        fecha_sesion:    form.fecha_sesion.trim() || null,
        link_registro:   form.link_registro.trim() || null,
        registro_texto:  form.registro_texto.trim() || null,
        link_grabacion:  form.link_grabacion.trim() || null,
        grabacion_texto: form.grabacion_texto.trim() || null,
        link_materiales: form.link_materiales.trim() || null,
        botones_extra:   botonesValidos,
      }
      let data = null
      let parcial = false
      try {
        const res = await supabase.from('cursos').update(payload).eq('id', curso.id).select().single()
        if (res.error) throw res.error
        data = res.data
      } catch (eColumna) {
        // Si la columna botones_extra aún no existe en Supabase, guardamos el resto
        // y avisamos cómo crearla (el botón extra queda visible solo en esta sesión).
        const sinBotones = { ...payload }
        delete sinBotones.botones_extra
        const res2 = await supabase.from('cursos').update(sinBotones).eq('id', curso.id).select().single()
        if (res2.error) throw res2.error
        data = { ...res2.data, botones_extra: botonesValidos }
        parcial = true
        console.warn('Columna botones_extra ausente en Supabase, se guardó el resto:', eColumna?.message)
        setMsg('Guardado parcial: falta crear la columna botones_extra (jsonb, default []) en la tabla cursos de Supabase. El botón extra se ve ahora, pero se perderá al recargar hasta crearla.')
      }
      onGuardado(data)
      // Solo cerramos automáticamente si fue guardado completo.
      // Si hubo guardado parcial (falta columna), dejamos el modal abierto
      // para que leas el aviso en rojo.
      if (!parcial) onClose()
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

        <label>Botones adicionales (ej. liga de Teams en vivo)</label>
        <p className="nota" style={{ marginTop: 0 }}>
          Para sesión en vivo pega aquí la liga de <strong>Teams</strong> (abre en pestaña aparte ↗, sin límite). Agrégalos cuando programes algo y bórralos cuando ya pasó — no se quedan mostrando un "próximamente" viejo.
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
    </div>
    </ModalPortal>
  )
}

export default function TallerRecursos({ curso, user, gestiona, onActualizado }) {
  const [editando, setEditando] = useState(false)
  const [emailLead, setEmailLead] = useState('')
  const [solicitando, setSolicitando] = useState(false)
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [msgLead, setMsgLead] = useState('')
  const [verGrabacion, setVerGrabacion] = useState(false)
  const [verMateriales, setVerMateriales] = useState(false)
  const [verRegistro, setVerRegistro] = useState(false)

  const grabacionEmbebible = analizarUrl(curso.link_grabacion).embeddable
  const materialesEmbebible = analizarUrl(curso.link_materiales).embeddable
  const registroEmbebible = analizarUrl(curso.link_registro).embeddable
  const grabacionAbierta = !!curso.link_grabacion && curso.grabacion_activo !== false
  const registroAbierto = !!curso.link_registro && curso.registro_activo !== false
  const botonesExtra = curso.botones_extra || []
  const [verBotonesExtra, setVerBotonesExtra] = useState({})

  const toggleGrabacionActivo = async () => {
    const nuevo = curso.grabacion_activo === false
    const { error } = await supabase.from('cursos').update({ grabacion_activo: nuevo }).eq('id', curso.id)
    if (error) { alert('Error: ' + error.message); return }
    onActualizado({ ...curso, grabacion_activo: nuevo })
  }

  const toggleRegistroActivo = async () => {
    const nuevo = curso.registro_activo === false
    const { error } = await supabase.from('cursos').update({ registro_activo: nuevo }).eq('id', curso.id)
    if (error) { alert('Error: ' + error.message); return }
    onActualizado({ ...curso, registro_activo: nuevo })
  }

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

      <article className="recurso-item">
        <div className="recurso-cabecera">
          <div className="recurso-titulo">
            <span className="recurso-icono" aria-hidden="true">📝</span>
            <div><h3>Registro a la sesión en vivo</h3></div>
          </div>
          {gestiona && curso.link_registro && (
            <button type="button" className={`candado-toggle ${curso.registro_activo === false ? 'cerrado' : 'abierto'}`}
                    onClick={toggleRegistroActivo}
                    title={curso.registro_activo === false ? 'Activar botón' : 'Desactivar botón'}>
              {curso.registro_activo === false ? '🔒' : '🔓'}
            </button>
          )}
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
              {curso.link_registro ? '🔒 Registro cerrado (la sesión ya se dio o aún no abre)' : '📝 Registro aún no disponible'}
            </button>
          </div>
        )}
      </article>

      <article className="recurso-item">
        <div className="recurso-cabecera">
          <div className="recurso-titulo">
            <span className="recurso-icono" aria-hidden="true">🎬</span>
            <div><h3>Grabación de la sesión</h3></div>
          </div>
          {gestiona && curso.link_grabacion && (
            <button type="button" className={`candado-toggle ${curso.grabacion_activo === false ? 'cerrado' : 'abierto'}`}
                    onClick={toggleGrabacionActivo}
                    title={curso.grabacion_activo === false ? 'Activar botón' : 'Desactivar botón'}>
              {curso.grabacion_activo === false ? '🔒' : '🔓'}
            </button>
          )}
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
          </>
        ) : (
          <div className="recurso-acciones">
            <button className="button secondary" disabled>
              {curso.link_grabacion ? '🔒 Grabación cargada, aún cerrada' : '🎬 Grabación en proceso'}
            </button>
          </div>
        )}
      </article>

      <article className="recurso-item">
        <div className="recurso-cabecera">
          <div className="recurso-titulo">
            <span className="recurso-icono" aria-hidden="true">📄</span>
            <div><h3>Materiales del taller</h3></div>
          </div>
        </div>

        {!curso.link_materiales ? (
          <div className="recurso-acciones">
            <button className="button secondary" disabled>📄 Materiales en preparación</button>
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

      {botonesExtra.length > 0 && (
        <article className="recurso-item">
          <div className="recurso-cabecera">
            <div className="recurso-titulo">
              <span className="recurso-icono" aria-hidden="true">🔗</span>
              <div><h3>Sesiones y enlaces extra</h3></div>
            </div>
          </div>
          <div className="recurso-acciones" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {botonesExtra.map((b, i) => {
              const info = analizarUrl(b.url)
              const verlo = !!verBotonesExtra[i]
              return (
                <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {info.embeddable && (
                    <button type="button" className={`button ${verlo ? 'secondary' : 'primary'}`}
                            onClick={() => setVerBotonesExtra(v => ({ ...v, [i]: !v[i] }))}>
                      {verlo ? 'Ocultar' : 'Ver aquí'} · {b.texto}
                    </button>
                  )}
                  <a className={`button ${info.embeddable ? 'secondary' : 'primary'}`} target="_blank" rel="noopener noreferrer" href={b.url}>
                    {b.texto} ↗
                  </a>
                  {info.embeddable && verlo && (
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
      <ExamenModulo cursoId={curso.id} user={user} />
    </section>
  )
}
