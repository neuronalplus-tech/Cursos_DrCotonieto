import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { emitsConstancia, cursoEspecial } from '../lib/helpers'
import { Breadcrumb, BandaRedes } from './ui'

function CursoDetalle({ user, esAdmin }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(null)
  const [modulos, setModulos] = useState([])
  const [miGrupo, setMiGrupo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('cursos').select('*').eq('id', id).maybeSingle()
      setCurso(c)

      let grupo = null
      if (!esAdmin && user) {
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
  }, [id, user, esAdmin])

  if (loading) return <div className="loading">Cargando detalles...</div>
  if (!curso) return <div className="contenedor"><p className="aviso-error">Curso no encontrado.</p></div>

  const especial = cursoEspecial(curso)
  if (!especial || especial.detallesKey !== 'duelo') {
    return (
      <section className="contenedor">
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo, to: `/curso/${id}` }, { label: 'Detalles' }]} />
        <h1>{curso.titulo}</h1>
        <p className="curso-desc">{curso.descripcion}</p>
        <button className="button secondary" onClick={() => navigate(`/curso/${id}`)}>← Volver al curso</button>
        <BandaRedes />
      </section>
    )
  }

  const { acompanamiento, clinica } = DETALLES_DUELO.rutas

  const tieneAccesoAlGrupo = (g) => {
    if (esAdmin) return true
    if (!user) return false
    if (!g) return true
    return miGrupo === g
  }

  const RutaCol = ({ ruta }) => {
    const tieneAcceso = tieneAccesoAlGrupo(ruta.grupo)
    const modsRuta = modulos.filter(m => m.grupo === ruta.grupo).sort((a, b) => (a.orden || 0) - (b.orden || 0))
    const primerModulo = modsRuta.find(m => esAdmin || (m.disponible !== false && tieneAcceso))

    return (
      <article className="ruta-col">
        <header className="ruta-header">
          <h2>{ruta.nombre}</h2>
          <p className="ruta-dirigida">{ruta.dirigida}</p>
        </header>

        <div className="ruta-para-ti">
          <p className="ruta-para-ti-titulo">Esta ruta es para ti si…</p>
          <p>{ruta.paraTiSi}</p>
          <p className="ruta-publicos">{ruta.publicos}</p>
          <p className="ruta-nota">{ruta.notaFinal}</p>
        </div>

        <h3 className="ruta-subtitulo">Los cuatro módulos</h3>
        <ol className="ruta-modulos">
          {ruta.modulos.map(m => (
            <li key={m.num}>
              <div className="ruta-mod-num">Módulo {m.num}</div>
              <h4>{m.titulo}</h4>
              <p>{m.descripcion}</p>
            </li>
          ))}
        </ol>

        <div className="ruta-info">
          <h4>Metodología</h4>
          <p>{ruta.metodologia}</p>
          <h4>Materiales</h4>
          <p>{ruta.materiales}</p>
        </div>

        {!tieneAcceso && (
          <p className="ruta-section-lock" style={{ marginTop: 18 }}>
            {!user
              ? '🔒 Esta ruta requiere inscripción. Solicita información o inicia sesión si ya tienes acceso.'
              : '🔒 Aún no tienes acceso a esta ruta. Solicita información o usa la cuenta correcta.'}
          </p>
        )}

        <div className="ruta-cta">
          <a className="button whatsapp ancho" target="_blank" rel="noopener noreferrer"
             href={wa(`Hola, me interesa la ${ruta.nombre} del curso "${curso.titulo}". ¿Me compartes información e inscripción?`)}>
            💬 Solicitar información
          </a>
          <button className="button secondary ancho" onClick={() => {
            if (esAdmin || tieneAcceso) {
              if (primerModulo) navigate(`/modulo/${primerModulo.id}`)
              else navigate(`/curso/${id}`)
            } else if (!user) {
              navigate(rutaAcceso(`/curso/${id}/detalles`))
            } else {
              alert('Tu cuenta aún no tiene acceso a esta ruta. Escríbeme por WhatsApp y lo vemos.')
            }
          }}>
            {esAdmin || tieneAcceso ? 'Ir al contenido →' : 'Ya estoy inscrito'}
          </button>
        </div>
      </article>
    )
  }

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: curso.titulo, to: `/curso/${id}` }, { label: 'Detalles' }]} />

      <header className="detalle-header">
        <h1>{DETALLES_DUELO.intro}</h1>
        <p className="detalle-sub">{DETALLES_DUELO.subtitulo}</p>
        <p className="curso-disponible">
          <span className="curso-disponible-label">Disponible a partir del</span>
          <span className="curso-disponible-fecha">{especial.disponibleDesde}</span>
        </p>
      </header>

      {!user && (
        <div className="admin-banner" style={{ background: '#EEF2F4', borderLeftColor: '#1B3A4B', color: '#1B3A4B', marginBottom: 28 }}>
          Estás viendo los detalles de las dos rutas. Para acceder a los materiales, <strong>inicia sesión</strong> con tus datos o escríbeme para inscribirte en la ruta que te corresponde.
        </div>
      )}

      <div className="rutas-grid">
        <RutaCol ruta={acompanamiento} />
        <RutaCol ruta={clinica} />
      </div>

      <div className="detalle-cta">
        <a className="button whatsapp grande" target="_blank" rel="noopener noreferrer"
           href={wa(`Hola, me interesa el curso "${curso.titulo}". ¿Me compartes más información?`)}>
          Quiero información e inscripción
        </a>
        <button className="button secondary" onClick={() => navigate(`/curso/${id}`)}>← Volver al curso</button>
      </div>

      <BandaRedes />
    </section>
  )
}

export default CursoDetalle
