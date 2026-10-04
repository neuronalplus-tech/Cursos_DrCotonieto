import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rutaAcceso, MARCA, wa } from '../config'
import { usePermisos } from '../lib/permisos'
import { ModalEditarTaller } from './TallerRecursos'
import PortadaCurso, { motivoDe } from './PortadaCurso'
import { esContenedorTalleres, cursoEspecial } from '../lib/helpers'

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

  const grabacionAbierta = !!curso.link_grabacion && curso.grabacion_activo !== false
  const registroAbierto = !!curso.link_registro && curso.registro_activo !== false
  const botonesExtra = curso.botones_extra || []

  const toggleGrabacion = async () => {
    const nuevo = curso.grabacion_activo === false
    const { error } = await supabase.from('cursos').update({ grabacion_activo: nuevo }).eq('id', curso.id)
    if (error) { alert('Error: ' + error.message); return }
    setCurso(c => ({ ...c, grabacion_activo: nuevo }))
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

  if (esContenedor) {
    return (
      <article className="course-card gratis contenedor">
        <div className="course-portada">
          <PortadaCurso motivo={motivoDe(curso)} uid={curso.id} />
        </div>
        <div className="course-info">
          <span className="badge verde">Sección</span>
          <h3>{curso.titulo}</h3>
          <p className="contenedor-desc">{curso.descripcion}</p>
          <div className="course-acciones">
            <Link to={`/curso/${curso.id}`} className="button primary ancho">Ver todos los talleres →</Link>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`course-card ${gratis ? 'gratis' : ''} ${prox ? 'proximo' : ''}`}>
      <div className="course-portada">
        <PortadaCurso motivo={motivoDe(curso)} uid={curso.id} />
        {prox && <span className="cinta-prox">Próximamente</span>}
      </div>

      <div className="course-info">
        {prox ? <span className="badge proximo">En preparación</span>
          : gratis ? <span className="badge verde">Acceso libre</span>
            : tieneAcceso ? <span className="badge ok">✔ Estás inscrito</span>
              : <span className="badge neutro">Requiere inscripción</span>}

        <h3>{curso.titulo}</h3>

        {especial && (
          <p className="curso-disponible-card">
            <span className="curso-disponible-label">Disponible a partir del</span>
            <span className="curso-disponible-fecha">{especial.disponibleDesde}</span>
          </p>
        )}

        {curso.fecha_sesion && (
          <p className="fecha-sesion">📅 {curso.fecha_sesion}</p>
        )}

        <button className="saber-mas" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}>
          {abierto ? 'Ocultar detalles ▲' : 'Saber más ▼'}
        </button>

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
            <button className="saber-mas" onClick={() => setAbiertoCustom(v => !v)} aria-expanded={abiertoCustom}>
              {abiertoCustom ? 'Ocultar información ▲' : '¿Quieres un curso a la medida? ▼'}
            </button>

            {abiertoCustom && (
              <div className="course-detalle">
                <p>
                  Diseño cursos y talleres <strong>personalizados</strong> para instituciones educativas,
                  hospitales, equipos clínicos y organizaciones. Si quieres capacitar a tu equipo en un tema
                  específico, armamos juntos el programa, los materiales y la logística.
                </p>
                <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
                   href={wa(`Hola, me interesa un curso personalizado para mí o mi institución. Me gustó la línea del curso "${curso.titulo}" y quiero algo a la medida.`)}>
                  💬 Quiero mi curso personalizado
                </a>
              </div>
            )}
          </>
        )}

        <div className="course-acciones">
          {tieneDetalles && (
            <Link to={`/curso/${curso.id}/detalles`} className="button secondary ancho">
              📋 Ver detalles y rutas
            </Link>
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
              <a className="button primary ancho" target="_blank" rel="noopener noreferrer"
                 href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me avisas cuándo abre?`)}>
                Me interesa · avísame
              </a>
            )
          ) : gratis ? (
            <>
              <Link to={`/curso/${curso.id}`} className="button secondary ancho">Entrar al taller</Link>

              {curso.link_registro && (
                <div className="card-boton-admin">
                  {registroAbierto ? (
                    <a className="button azul ancho" target="_blank" rel="noopener noreferrer" href={curso.link_registro}>
                      {curso.registro_texto || '📅 Registrarme a la sesión en vivo'}
                    </a>
                  ) : (
                    <button className="button secondary ancho" disabled>🔒 Registro cerrado</button>
                  )}
                  {gestiona && (
                    <button type="button" className={`candado-toggle ${curso.registro_activo === false ? 'cerrado' : 'abierto'}`}
                            onClick={toggleRegistro}
                            title={curso.registro_activo === false ? 'Activar botón' : 'Desactivar botón'}>
                      {curso.registro_activo === false ? '🔒' : '🔓'}
                    </button>
                  )}
                </div>
              )}

              {botonesExtra.map((b, i) => (
                <a key={i} className={`button ${b.estilo || 'azul'} ancho`} target="_blank" rel="noopener noreferrer" href={b.url}>
                  {b.texto}
                </a>
              ))}

              <div className="card-boton-admin">
                {grabacionAbierta ? (
                  <a className="button secondary ancho" target="_blank" rel="noopener noreferrer" href={curso.link_grabacion}>
                    {curso.grabacion_texto || '🎬 Ver grabación'}
                  </a>
                ) : (
                  <button className="button secondary ancho" disabled>
                    🎬 Grabación en proceso
                  </button>
                )}
                {gestiona && curso.link_grabacion && (
                  <button type="button" className={`candado-toggle ${curso.grabacion_activo === false ? 'cerrado' : 'abierto'}`}
                          onClick={toggleGrabacion}
                          title={curso.grabacion_activo === false ? 'Activar botón' : 'Desactivar botón'}>
                    {curso.grabacion_activo === false ? '🔒' : '🔓'}
                  </button>
                )}
              </div>

              {gestiona && (
                <button type="button" className="button texto ancho" onClick={() => setEditandoTaller(true)}>
                  ✏️ Editar links y textos
                </button>
              )}
            </>
          ) : tieneAcceso ? (
            <Link to={`/curso/${curso.id}`} className="button primary ancho">Continuar curso</Link>
          ) : (
            <>
              <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
                 href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me compartes el costo y cómo apartar mi lugar?`)}>
                Quiero inscribirme
              </a>
              <button className="button secondary ancho"
                      onClick={() => navigate(user ? `/curso/${curso.id}` : rutaAcceso(`/curso/${curso.id}`))}>
                Ya tengo acceso
              </button>
            </>
          )}
        </div>
      </div>

      {editandoTaller && (
        <ModalEditarTaller curso={curso} onClose={() => setEditandoTaller(false)}
                            onGuardado={(c) => setCurso(c)} />
      )}
    </article>
  )
}

export default CursoCard
