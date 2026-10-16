import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cursoEspecial } from '../lib/helpers'
import { rutaAcceso, DETALLES_DUELO } from '../config'
import { usePermisos } from '../lib/permisos'
import { useOrganizacion } from '../lib/organizacion'
import { useContenido, resolver, prefijoDetalles, tieneDetalles } from '../lib/contenido'
import { Breadcrumb, BandaRedes } from './ui'
import { TextoEditable, ListaEditable, BotonEditable } from './Editable'

function CursoDetalle({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  // El id de la URL es el del curso, asi que el permiso esta resuelto
  // desde el primer render.
  const gestiona = usePermisos(user).puedeGestionar(id)
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [miGrupo, setMiGrupo] = useState(null)
  const [loading, setLoading] = useState(true)
  // Se suscribe a las ediciones: el nombre editado de cada ruta entra en
  // el mensaje de WhatsApp ({ruta}) y en la etiqueta de su lista.
  const capas = useContenido(useOrganizacion().organizacion?.id)

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
      setCurso(c)

      let grupo = null
      if (!gestiona && user) {
        const { data: acc } = await supabase.from('acceso')
          .select('grupo').eq('usuario_id', user.id).eq('curso_id', id).maybeSingle()
        if (acc) grupo = acc.grupo || null
      }
      setMiGrupo(grupo)

      const { data: mods } = await supabase.from('modulos')
        .select('id, titulo, orden, grupo, disponible, activo')
        .eq('curso_id', id).eq('activo', true).order('orden')
      setModulos(mods || [])
      setLoading(false)
    }
    load()
  }, [id, user, gestiona])

  if (loading) return <div className="loading">Cargando detalles...</div>
  if (!curso) return <div className="contenedor"><p className="aviso-error">Curso no encontrado.</p></div>

  const especial = cursoEspecial(curso)
  if (!especial || especial.detallesKey !== 'duelo') {
    // PÁGINA DE DETALLES DE CUALQUIER CURSO. Sus textos llevan el id del
    // curso en la clave (contenido.js, prefijoDetalles): editar los de un
    // curso no toca los de otro. Las secciones son una lista que se
    // añade, quita y reordena con el lápiz; vacía, el curso no enseña
    // «Ver detalles» (tieneDetalles).
    const P = prefijoDetalles(curso, especial)
    const datos = { titulo: curso.titulo }
    return (
      <section className="contenedor">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo, to: `/curso/${id}` }, { label: 'Detalles' }]} />
        <header className="detalle-header">
          <TextoEditable as="h1" clave={`${P}.titulo`} defecto={curso.titulo} />
          <TextoEditable as="p" className="detalle-sub" clave={`${P}.subtitulo`} defecto={curso.descripcion || ''} />
        </header>
        {capas.puedeEditar && !tieneDetalles(curso, especial) && (
          <p className="aviso-info">
            Esta página aún no tiene secciones, así que el curso no muestra «Ver detalles».
            {capas.editando ? ' Usa el lápiz de «Secciones» para añadir la primera.' : ' Activa «✏️ Editar página» (abajo a la izquierda) para añadirlas.'}
          </p>
        )}
        <ListaEditable clave={`${P}.secciones`} defecto={[]} etiqueta="Secciones de la página de detalles"
          campos={[{ k: 'titulo', etiqueta: 'Título (p. ej. «A quién va dirigido»)' }, { k: 'texto', etiqueta: 'Texto' }]}>
          {(items) => (
            <div className="detalle-secciones">
              {items.map((s, i) => (
                <article key={i} className="ruta-info">
                  {s.titulo && <h2>{s.titulo}</h2>}
                  {String(s.texto || '').split('\n').filter(Boolean).map((p, j) => <p key={j}>{p}</p>)}
                </article>
              ))}
            </div>
          )}
        </ListaEditable>
        <div className="detalle-cta">
          <BotonEditable clave={`${P}.informacion`} clase="button grande" datos={datos}
            defecto={{
              texto: 'Quiero información e inscripción', estilo: 'whatsapp',
              mensaje: 'Hola, me interesa el curso "{titulo}". ¿Me compartes más información?',
            }} />
          <BotonEditable clave="detalles.volver" clase="button" defecto={{ texto: '← Volver al curso', estilo: 'secondary' }}
            onClick={() => navigate(`/curso/${id}`)} />
        </div>
        <BandaRedes />
      </section>
    )
  }

  const { acompanamiento, clinica } = DETALLES_DUELO.rutas

  const tieneAccesoAlGrupo = (g) => {
    if (gestiona) return true
    if (!user) return false
    if (!g) return true
    return miGrupo === g
  }

  // Una función y no un componente: un componente definido aquí dentro
  // se volvería a montar en cada render y cerraría el diálogo de edición.
  const renderRuta = (ruta) => {
    const tieneAcceso = tieneAccesoAlGrupo(ruta.grupo)
    const modsRuta = modulos.filter(m => m.grupo === ruta.grupo).sort((a, b) => (a.orden || 0) - (b.orden || 0))
    const primerModulo = modsRuta.find(m => gestiona || (m.disponible !== false && tieneAcceso))
    // Claves por ruta («detalles.Clínica.nombre»): cada columna se edita aparte.
    const k = (campo) => `detalles.${ruta.grupo}.${campo}`
    const nombre = resolver(k('nombre'), { texto: ruta.nombre }).texto
    const datos = { titulo: curso.titulo, ruta: nombre }

    return (
      <article key={ruta.grupo} className="ruta-col">
        <header className="ruta-header">
          <TextoEditable as="h2" clave={k('nombre')} defecto={ruta.nombre} />
          <TextoEditable as="p" className="ruta-dirigida" clave={k('dirigida')} defecto={ruta.dirigida} />
        </header>

        <div className="ruta-para-ti">
          <TextoEditable as="p" className="ruta-para-ti-titulo" clave="detalles.para-ti-titulo" defecto="Esta ruta es para ti si…" />
          <TextoEditable as="p" clave={k('para-ti')} defecto={ruta.paraTiSi} />
          <TextoEditable as="p" className="ruta-publicos" clave={k('publicos')} defecto={ruta.publicos} />
          <TextoEditable as="p" className="ruta-nota" clave={k('nota')} defecto={ruta.notaFinal} />
        </div>

        <TextoEditable as="h3" className="ruta-subtitulo" clave={k('modulos-titulo')} defecto="Los cuatro módulos" />
        <ListaEditable clave={k('modulos')} defecto={ruta.modulos} etiqueta={`Módulos de la ${nombre}`}
          campos={[{ k: 'num', etiqueta: 'Número' }, { k: 'titulo', etiqueta: 'Título' }, { k: 'descripcion', etiqueta: 'Descripción' }]}>
          {(items) => (
            <ol className="ruta-modulos">
              {items.map((m, i) => (
                <li key={i}>
                  <div className="ruta-mod-num">Módulo {m.num}</div>
                  <h4>{m.titulo}</h4>
                  <p>{m.descripcion}</p>
                </li>
              ))}
            </ol>
          )}
        </ListaEditable>

        <div className="ruta-info">
          <TextoEditable as="h4" clave="detalles.metodologia-titulo" defecto="Metodología" />
          <TextoEditable as="p" clave={k('metodologia')} defecto={ruta.metodologia} />
          <TextoEditable as="h4" clave="detalles.materiales-titulo" defecto="Materiales" />
          <TextoEditable as="p" clave={k('materiales')} defecto={ruta.materiales} />
        </div>

        {!tieneAcceso && (!user
          ? <TextoEditable as="p" className="ruta-section-lock" style={{ marginTop: 18 }} clave="detalles.candado-sin-sesion"
              defecto="🔒 Esta ruta requiere inscripción. Solicita información o inicia sesión si ya tienes acceso." />
          : <TextoEditable as="p" className="ruta-section-lock" style={{ marginTop: 18 }} clave="detalles.candado-sin-acceso"
              defecto="🔒 Aún no tienes acceso a esta ruta. Solicita información o usa la cuenta correcta." />
        )}

        <div className="ruta-cta">
          <BotonEditable clave={k('informacion')} clase="button ancho" datos={datos}
            defecto={{
              texto: '💬 Solicitar información', estilo: 'whatsapp',
              mensaje: 'Hola, me interesa la {ruta} del curso "{titulo}". ¿Me compartes información e inscripción?',
            }} />
          <BotonEditable key={gestiona || tieneAcceso ? 'ir' : 'inscrito'}
            clave={gestiona || tieneAcceso ? 'detalles.ir' : 'detalles.ya-inscrito'} clase="button ancho"
            defecto={{ texto: gestiona || tieneAcceso ? 'Ir al contenido →' : 'Ya estoy inscrito', estilo: 'secondary' }}
            onClick={() => {
              if (gestiona || tieneAcceso) {
                if (primerModulo) navigate(`/modulo/${primerModulo.id}`)
                else navigate(`/curso/${id}`)
              } else if (!user) {
                navigate(rutaAcceso(`/curso/${id}/detalles`))
              } else {
                alert('Tu cuenta aún no tiene acceso a esta ruta. Escríbeme por WhatsApp y lo vemos.')
              }
            }} />
        </div>
      </article>
    )
  }

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo, to: `/curso/${id}` }, { label: 'Detalles' }]} />

      <header className="detalle-header">
        <TextoEditable as="h1" clave="detalles.titulo" defecto={DETALLES_DUELO.intro} />
        <TextoEditable as="p" className="detalle-sub" clave="detalles.subtitulo" defecto={DETALLES_DUELO.subtitulo} />
        <p className="curso-disponible">
          {/* Mismas claves que la tarjeta y la página del curso. */}
          <TextoEditable className="curso-disponible-label" clave="curso.disponible.etiqueta" defecto="Disponible a partir del" />
          <TextoEditable className="curso-disponible-fecha" clave="curso.disponible.fecha"
            ambito={`curso:${curso.id}`} defecto={especial.disponibleDesde} />
        </p>
      </header>

      {!user && (
        <TextoEditable as="div" className="admin-banner" clave="detalles.aviso-sin-sesion" negritas
          style={{ background: '#EEF2F4', borderLeftColor: '#1B3A4B', color: '#1B3A4B', marginBottom: 28 }}
          defecto="Estás viendo los detalles de las dos rutas. Para acceder a los materiales, **inicia sesión** con tus datos o escríbeme para inscribirte en la ruta que te corresponde." />
      )}

      <div className="rutas-grid">
        {renderRuta(acompanamiento)}
        {renderRuta(clinica)}
      </div>

      <div className="detalle-cta">
        <BotonEditable clave="detalles.informacion" clase="button grande" datos={{ titulo: curso.titulo }}
          defecto={{
            texto: 'Quiero información e inscripción', estilo: 'whatsapp',
            mensaje: 'Hola, me interesa el curso "{titulo}". ¿Me compartes más información?',
          }} />
        <BotonEditable clave="detalles.volver" clase="button" defecto={{ texto: '← Volver al curso', estilo: 'secondary' }}
          onClick={() => navigate(`/curso/${id}`)} />
      </div>

      <BandaRedes />
    </section>
  )
}

export default CursoDetalle
