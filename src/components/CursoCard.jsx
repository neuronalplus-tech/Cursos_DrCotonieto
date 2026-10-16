import { useState, lazy, Suspense, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { materialDeTaller, guardarMaterialTaller } from '../lib/material'
import { rutaAcceso } from '../config'
import { usePermisos } from '../lib/permisos'
import PortadaCurso, { motivoDe } from './PortadaCurso'
import { esContenedorTalleres, cursoEspecial } from '../lib/helpers'
import { TextoEditable, BotonEditable } from './Editable'

/* C4: CursoCard vive en el bundle inicial (Home). El modal trae
   TallerRecursos → ExamenModulo, así que se carga solo al editar. */
const ModalEditarTaller = lazy(() => import('./TallerRecursos').then(m => ({ default: m.ModalEditarTaller })))

/* Textos y botones de la tarjeta: todos pasan por los editables
   (ver Editable.jsx). Las claves sin «@curso:N» valen para todas las
   tarjetas; el diálogo deja elegir «solo este curso». */

/** Mensaje claro cuando la base rechaza un cambio en `cursos` o en
    `curso_material` (los dos sitios donde ya vivían estos botones). */
function errorDeCurso(error, donde) {
  const m = error?.message || String(error || '')
  if (error?.code === '42501' || /row-level security|permission denied|no autorizado|not allowed/i.test(m)) {
    return `La base rechazó el cambio en «${donde}»: solo puede editarlo un administrador ` +
      'o quien gestiona este curso (puede_gestionar_curso). Tu cuenta no tiene ese permiso.'
  }
  return `No se pudo guardar en «${donde}»: ${m}`
}

function CursoCard({ curso: cursoProp, user, tieneAcceso }) {
  const [curso, setCurso] = useState(cursoProp)
  const [abierto, setAbierto] = useState(false)
  const [abiertoCustom, setAbiertoCustom] = useState(false)
  const [editandoTaller, setEditandoTaller] = useState(false)
  const navigate = useNavigate()
  // Cada tarjeta resuelve el permiso de SU curso: en una parrilla puede
  // haber cursos que gestionas y otros que no.
  const gestiona = usePermisos(user).puedeGestionar(curso?.id)
  const gratis = !!curso.gratuito
  const prox = !!curso.proximamente
  const esContenedor = esContenedorTalleres(curso)
  const mostrarCustom = !gratis && !prox && !esContenedor
  const especial = cursoEspecial(curso)
  const tieneDetalles = !!especial

  // Lo que comparten casi todos los editables de la tarjeta.
  const deCurso = {
    ambito: `curso:${curso.id}`,
    etiquetaAmbito: { general: 'todas las tarjetas de curso', unico: `solo «${curso.titulo}»` },
    datos: { titulo: curso.titulo },
  }

  // El material sensible (grabación, cuadernillos, botones extra) ya no
  // viaja en el objeto curso: se pide por RPC. Quien no tiene permiso
  // (visitante sin cuenta, o curso de pago sin inscripción) recibe null y
  // esos enlaces sencillamente no se pintan en la portada. El candado del
  // admin necesita el material, por eso se pide siempre que haya curso.
  const [material, setMaterial] = useState(null)
  useEffect(() => {
    if (!curso?.id) return
    let vivo = true
    materialDeTaller(curso.id).then(m => { if (vivo) setMaterial(m || {}) })
    return () => { vivo = false }
  }, [curso?.id])

  // El candado de cada botón ahora controla si se MUESTRA al público o se
  // oculta. Apagarlo ya no deja un botón tachado: lo quita de la vista. El
  // admin siempre ve el candado, tenga o no link, para poder manejarlo.
  const grabacionVisible = material?.grabacion_activo !== false
  const registroVisible = curso.registro_activo !== false
  const grabacionAbierta = grabacionVisible && !!material?.link_grabacion
  const registroAbierto = registroVisible && !!curso.link_registro
  const botonesExtra = material?.botones_extra || []

  const toggleGrabacion = async () => {
    const nuevo = material?.grabacion_activo === false
    try {
      await guardarMaterialTaller(curso.id, { grabacion_activo: nuevo })
    } catch (e) { alert('Error: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), grabacion_activo: nuevo }))
  }

  const toggleRegistro = async () => {
    const nuevo = curso.registro_activo === false
    const { error } = await supabase.from('cursos').update({ registro_activo: nuevo }).eq('id', curso.id)
    if (error) { alert('Error: ' + error.message); return }
    setCurso(c => ({ ...c, registro_activo: nuevo }))
  }

  const toggleProximamente = async () => {
    const nuevo = !curso.proximamente
    if (nuevo === true) {
      const ok = window.confirm(
        '¿Seguro que quieres marcar este curso como "Próximamente"?\n\n' +
        'Se oculta de inmediato para todo el público y solo queda visible el botón de WhatsApp. ' +
        'Puedes reabrirlo cuando quieras desde este mismo candado.'
      )
      if (!ok) return
    }
    const { error } = await supabase.from('cursos').update({ proximamente: nuevo }).eq('id', curso.id)
    if (error) { alert('Error: ' + error.message); return }
    setCurso(c => ({ ...c, proximamente: nuevo }))
  }

  // ← NUEVO: candado individual para los botones extra
  const toggleBotonExtra = async (idx) => {
    const nuevos = botonesExtra.map((b, i) =>
      i === idx ? { ...b, activo: b.activo === false ? true : false } : b
    )
    try {
      await guardarMaterialTaller(curso.id, { botones_extra: nuevos })
    } catch (e) { alert('Error: ' + e.message); return }
    setMaterial(m => ({ ...(m || {}), botones_extra: nuevos }))
  }

  /* --- Fuentes: el diálogo único guarda texto/enlace/visible donde
     ya vivían estos tres botones, no en contenido_sitio. --- */
  const fuenteRegistro = {
    texto: curso.registro_texto || '📅 Registrarme a la sesión en vivo',
    url: curso.link_registro || '',
    visible: registroVisible,
    guardar: async (c) => {
      const upd = {}
      if ('texto' in c) upd.registro_texto = c.texto || null
      if ('url' in c) upd.link_registro = c.url || null
      if ('visible' in c) upd.registro_activo = c.visible
      const { data, error } = await supabase.from('cursos').update(upd).eq('id', curso.id).select('id')
      if (error) throw new Error(errorDeCurso(error, 'cursos'))
      if (!data?.length) throw new Error(errorDeCurso({ code: '42501' }, 'cursos'))
      setCurso(x => ({ ...x, ...upd }))
    },
  }

  const guardarMaterial = async (datos) => {
    try { await guardarMaterialTaller(curso.id, datos) } catch (e) { throw new Error(errorDeCurso(e, 'curso_material'), { cause: e }) }
    setMaterial(m => ({ ...(m || {}), ...datos }))
  }

  const fuenteGrabacion = {
    texto: material?.grabacion_texto || '🎬 Ver grabación',
    url: material?.link_grabacion || '',
    visible: grabacionVisible,
    guardar: async (c) => {
      const datos = {}
      if ('texto' in c) datos.grabacion_texto = c.texto || null
      if ('url' in c) datos.link_grabacion = c.url || null
      if ('visible' in c) datos.grabacion_activo = c.visible
      await guardarMaterial(datos)
    },
  }

  const fuenteExtra = (b, i) => ({
    texto: b.texto || '',
    url: b.url || '',
    visible: b.activo !== false,
    guardar: async (c) => {
      const nuevos = botonesExtra.map((x, j) => (j !== i ? x : {
        ...x,
        ...('texto' in c ? { texto: c.texto } : {}),
        ...('url' in c ? { url: c.url } : {}),
        ...('visible' in c ? { activo: c.visible } : {}),
      }))
      await guardarMaterial({ botones_extra: nuevos })
    },
    // Estos sí se borran de verdad: son filas de una lista, no huecos fijos.
    eliminar: async () => {
      await guardarMaterial({ botones_extra: botonesExtra.filter((_, j) => j !== i) })
    },
  })

  /* ELIMINAR DE VERDAD, sin modo edición y sin contenido_sitio.
     Registro y grabación son huecos fijos del taller: «eliminar» vacía
     su enlace y su texto en la base, y un hueco sin enlace ya no se
     pinta para nadie (tampoco para ti). Para recuperarlo: «Editar
     links y textos» y pegar el enlace otra vez. */
  const eliminarRegistro = async () => {
    if (!window.confirm('¿Eliminar el botón de registro? Se borran su enlace y su texto. Para volver a tenerlo, pega el enlace en «Editar links y textos».')) return
    const upd = { link_registro: null, registro_texto: null, registro_activo: true }
    const { error } = await supabase.from('cursos').update(upd).eq('id', curso.id)
    if (error) { alert('No se pudo eliminar: ' + errorDeCurso(error, 'cursos')); return }
    setCurso(c => ({ ...c, ...upd }))
  }
  const eliminarGrabacion = async () => {
    if (!window.confirm('¿Eliminar el botón de la grabación? Se borran su enlace y su texto. Para volver a tenerlo, pega el enlace en «Editar links y textos».')) return
    try { await guardarMaterial({ link_grabacion: '', grabacion_texto: '', grabacion_activo: true }) } catch (e) { alert('No se pudo eliminar: ' + e.message) }
  }
  const eliminarExtra = async (i) => {
    if (!window.confirm(`¿Eliminar el botón «${botonesExtra[i]?.texto || 'extra'}»? No se puede deshacer.`)) return
    try { await guardarMaterial({ botones_extra: botonesExtra.filter((_, j) => j !== i) }) } catch (e) { alert('No se pudo eliminar: ' + e.message) }
  }

  const candado = (visible, alternar, eliminar) => gestiona && (
    <>
      <button type="button" className={`candado-toggle ${visible ? 'abierto' : 'cerrado'}`}
              onClick={alternar}
              title={visible ? 'Ocultar botón al público' : 'Mostrar botón al público'}>
        {visible ? '🔓' : '🔒'}
      </button>
      {eliminar && (
        <button type="button" className="candado-toggle borrar" onClick={eliminar}
                title="Eliminar este botón" aria-label="Eliminar este botón">
          🗑️
        </button>
      )}
    </>
  )

  if (esContenedor) {
    return (
      <article className="course-card gratis contenedor">
        <div className="course-portada">
          <PortadaCurso motivo={motivoDe(curso)} uid={curso.id} />
        </div>
        <div className="course-info">
          <TextoEditable as="span" className="badge verde" clave="curso.insignia.seccion" defecto="Sección" />
          <h3>{curso.titulo}</h3>
          <p className="contenedor-desc">{curso.descripcion}</p>
          <div className="course-acciones">
            <BotonEditable clave="curso.ver-talleres" clase="button ancho" {...deCurso}
              defecto={{ texto: 'Ver todos los talleres →', estilo: 'primary' }} to={`/curso/${curso.id}`} />
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`course-card ${gratis ? 'gratis' : ''} ${prox ? 'proximo' : ''}`}>
      <div className="course-portada">
        <PortadaCurso motivo={motivoDe(curso)} uid={curso.id} />
        {prox && <TextoEditable as="span" className="cinta-prox" clave="curso.cinta.proximamente" defecto="Próximamente" />}
      </div>

      <div className="course-info">
        {prox ? <TextoEditable as="span" className="badge proximo" clave="curso.insignia.preparacion" defecto="En preparación" />
          : gratis ? <TextoEditable as="span" className="badge verde" clave="curso.insignia.libre" defecto="Acceso libre" />
            : tieneAcceso ? <TextoEditable as="span" className="badge ok" clave="curso.insignia.inscrito" defecto="✔ Estás inscrito" />
              : <TextoEditable as="span" className="badge neutro" clave="curso.insignia.requiere" defecto="Requiere inscripción" />}

        <h3>{curso.titulo}</h3>

        {especial && (
          <p className="curso-disponible-card">
            <TextoEditable as="span" className="curso-disponible-label" clave="curso.disponible.etiqueta" defecto="Disponible a partir del" />
            <TextoEditable as="span" className="curso-disponible-fecha" clave="curso.disponible.fecha"
              ambito={deCurso.ambito} defecto={especial.disponibleDesde} />
          </p>
        )}

        {curso.fecha_sesion && (
          <p className="fecha-sesion">📅 {curso.fecha_sesion}</p>
        )}

        <BotonEditable clave="curso.saber-mas" clase="saber-mas" {...deCurso}
          defecto={{ texto: 'Saber más ▼', textoAbierto: 'Ocultar detalles ▲' }}
          abierto={abierto} ariaExpanded={abierto} onClick={() => setAbierto(v => !v)} />

        {abierto && (
          <div className="course-detalle">
            <p>{curso.descripcion}</p>
            {curso.info_curso && (
              <div className="course-detalle-extra">
                {curso.info_curso.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
          </div>
        )}

        {mostrarCustom && (
          <>
            <BotonEditable clave="curso.a-la-medida" clase="saber-mas" {...deCurso}
              defecto={{ texto: '¿Quieres un curso a la medida? ▼', textoAbierto: 'Ocultar información ▲' }}
              abierto={abiertoCustom} ariaExpanded={abiertoCustom} onClick={() => setAbiertoCustom(v => !v)} />

            {abiertoCustom && (
              <div className="course-detalle">
                <TextoEditable as="p" clave="curso.a-la-medida.texto" ambito={deCurso.ambito}
                  defecto="Diseño cursos y talleres personalizados para instituciones educativas, hospitales, equipos clínicos y organizaciones. Si quieres capacitar a tu equipo en un tema específico, armamos juntos el programa, los materiales y la logística." />
                <BotonEditable clave="curso.a-la-medida.boton" clase="button ancho" {...deCurso}
                  defecto={{
                    texto: '💬 Quiero mi curso personalizado', estilo: 'whatsapp',
                    mensaje: 'Hola, me interesa un curso personalizado para mí o mi institución. Me gustó la línea del curso "{titulo}" y quiero algo a la medida.',
                  }} />
              </div>
            )}
          </>
        )}

        <div className="course-acciones">
          {tieneDetalles && (
            <BotonEditable clave="curso.ver-detalles" clase="button ancho" {...deCurso}
              defecto={{ texto: '📋 Ver detalles y rutas', estilo: 'secondary' }} to={`/curso/${curso.id}/detalles`} />
          )}
          {prox ? (
            gestiona ? (
              <>
                <p className="nota" style={{ marginTop: 0 }}>🔒 Marcado como "Próximamente" — el público solo ve el botón de WhatsApp.</p>
                <div className="card-boton-admin">
                  <Link to={`/curso/${curso.id}`} className="button secondary ancho">Entrar (vista admin) →</Link>
                  <button type="button" className="candado-toggle cerrado" onClick={toggleProximamente} title="Abrir al público">
                    🔒
                  </button>
                </div>
                {gratis && (
                  <button type="button" className="button texto ancho" onClick={() => setEditandoTaller(true)}>
                    ✏️ Editar links y textos
                  </button>
                )}
              </>
            ) : (
              <BotonEditable clave="curso.me-interesa" clase="button ancho" {...deCurso}
                defecto={{
                  texto: 'Me interesa · avísame', estilo: 'primary',
                  mensaje: 'Hola, me interesa el curso "{titulo}". ¿Me avisas cuándo abre?',
                }} />
            )
          ) : gratis ? (
            <>
              <BotonEditable clave="curso.entrar-taller" clase="button ancho" {...deCurso}
                defecto={{ texto: 'Entrar al taller', estilo: 'secondary' }} to={`/curso/${curso.id}`} />

              {/* Sin enlace no hay botón, para nadie: el público lo ve si
                  hay enlace y está abierto; tú, si hay enlace (abierto u
                  oculto), con su candado y su papelera. */}
              {(registroAbierto || (gestiona && curso.link_registro)) && (
                <BotonEditable clave={`curso.registro@curso:${curso.id}`} clase="button ancho"
                  defecto={{ estilo: 'azul' }} fuente={fuenteRegistro} siempreVisible={gestiona}
                  extra={candado(registroVisible, toggleRegistro, eliminarRegistro)} />
              )}

              {/* Botones extra: candado, edición y ELIMINAR de verdad. */}
              {botonesExtra.map((b, i) => {
                if (!gestiona && b.activo === false) return null
                return (
                  <BotonEditable key={i} clave={`curso.extra.${i}@curso:${curso.id}`} clase="button ancho"
                    defecto={{ estilo: b.estilo || 'azul' }} fuente={fuenteExtra(b, i)} siempreVisible={gestiona}
                    extra={candado(b.activo !== false, () => toggleBotonExtra(i), () => eliminarExtra(i))} />
                )
              })}

              {(grabacionAbierta || (gestiona && material?.link_grabacion)) && (
                <BotonEditable clave={`curso.grabacion@curso:${curso.id}`} clase="button ancho"
                  defecto={{ estilo: 'secondary' }} fuente={fuenteGrabacion} siempreVisible={gestiona}
                  extra={candado(grabacionVisible, toggleGrabacion, eliminarGrabacion)} />
              )}

              {gestiona && (
                <button type="button" className="button texto ancho" onClick={() => setEditandoTaller(true)}>
                  ✏️ Editar links y textos
                </button>
              )}
            </>
          ) : tieneAcceso ? (
            <BotonEditable clave="curso.continuar" clase="button ancho" {...deCurso}
              defecto={{ texto: 'Continuar curso', estilo: 'primary' }} to={`/curso/${curso.id}`} />
          ) : (
            <>
              <BotonEditable clave="curso.inscribirme" clase="button ancho" {...deCurso}
                defecto={{
                  texto: 'Quiero inscribirme', estilo: 'whatsapp',
                  mensaje: 'Hola, me interesa el curso "{titulo}". ¿Me compartes el costo y cómo apartar mi lugar?',
                }} />
              <BotonEditable clave="curso.ya-tengo-acceso" clase="button ancho" {...deCurso}
                defecto={{ texto: 'Ya tengo acceso', estilo: 'secondary' }}
                onClick={() => navigate(user ? `/curso/${curso.id}` : rutaAcceso(`/curso/${curso.id}`))} />
            </>
          )}
        </div>
      </div>

      {editandoTaller && (
        <Suspense fallback={<p className="nota">Cargando editor…</p>}>
          <ModalEditarTaller curso={curso} onClose={() => setEditandoTaller(false)}
                            onGuardado={(c) => { setCurso(c); materialDeTaller(c.id).then(m => setMaterial(m || {})) }} />
        </Suspense>
      )}
    </article>
  )
}

export default CursoCard
