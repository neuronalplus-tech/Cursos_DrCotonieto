import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { rutaAcceso, FOTO_PERFIL, MARCA, WA_CONSULTA, WA_MENSAJE_CONSULTA,
  SERVICIOS, CASOS, ENFOQUES, REDES,
  ICONO_TIPO, NOMBRE_TIPO, LOGO_BLANCO, LOGO_CLARO,
  ENLACE_DIAPOSITIVAS_PRESENTAR_CASO, ENLACE_ENTREGABLES,
  CONTACTO_EMAIL,
} from '../config'
import { TextoEditable, ImagenEditable, ListaEditable, BotonEditable } from './Editable'
import { esTallerIndividual } from '../lib/helpers'
import { useOrganizacion, aplicarMarca } from '../lib/organizacion'
import { WhatsAppFlotante, BandaRedes } from './ui'
import PortadaCurso, { motivoDe } from './PortadaCurso'
import CarruselCursos from './CarruselCursos'
import CursoCard from './CursoCard'

function Home({ user }) {
  const [cursos, setCursos] = useState([])
  const [accesos, setAccesos] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lineaActiva, setLineaActiva] = useState('todas')
  const [copiaLineas, setCopiaLineas] = useState({})
  const { organizacion, cargado: orgCargada } = useOrganizacion()

  // La marca del cliente se aplica en cuanto se sabe cuál es.
  useEffect(() => { aplicarMarca(organizacion) }, [organizacion])

  useEffect(() => {
    let vivo = true
    supabase.from('categorias').select('nombre, descripcion, motivo')
      .then(({ data }) => {
        if (!vivo || !data) return
        const mapa = {}
        for (const k of data) mapa[k.nombre] = { texto: k.descripcion, motivo: k.motivo }
        setCopiaLineas(mapa)
      })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        let q = supabase.from('cursos').select('*').eq('activo', true).order('orden')
        if (organizacion?.id) q = q.eq('organizacion_id', organizacion.id)
        const { data, error } = await q
        if (error) throw error
        const cursosHome = (data || []).filter(c => !esTallerIndividual(c))
        setCursos(cursosHome)
        if (user) {
          const { data: acc } = await supabase.from('acceso').select('curso_id').eq('usuario_id', user.id)
          setAccesos(new Set((acc || []).map(a => a.curso_id)))
        }
      } catch (e) {
        console.error('Error cargando cursos:', e); setError(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [user, organizacion])

  const lineas = []
  cursos.forEach(c => { if (c.linea && !lineas.includes(c.linea)) lineas.push(c.linea) })

  const cursosVisibles = lineaActiva === 'todas' ? cursos : cursos.filter(c => c.linea === lineaActiva)
  const disponibles = cursosVisibles.filter(c => !c.proximamente)
  const proximos = cursosVisibles.filter(c => c.proximamente)

  const irACurso = (linea) => {
    setLineaActiva(linea)
    document.getElementById('cursos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing">
      <section className="franja-superior">
        <div className="mini-perfil">
          <ImagenEditable clave="perfil.foto" defecto={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="mini-foto" />
          <div className="mini-perfil-texto">
            <TextoEditable as="h1" clave="perfil.nombre" defecto={MARCA.nombre} />
            <TextoEditable as="p" className="mini-credencial" clave="perfil.credencial" defecto={MARCA.credencial} />
            <TextoEditable as="p" className="mini-slogan" clave="perfil.slogan" defecto={MARCA.slogan} comillas />
            <TextoEditable as="p" className="mini-sub" clave="perfil.subtitulo" defecto={MARCA.subtitulo} />
            <BotonEditable clave="portada.agendar" clase="button"
              defecto={{ texto: 'Agenda tu llamada sin costo', mensaje: WA_MENSAJE_CONSULTA, estilo: 'whatsapp' }} />
          </div>
        </div>
        {!loading && <CarruselCursos lineas={lineas} cursos={cursos} onSelect={irACurso} copia={copiaLineas} />}
      </section>

      <section className="seccion" id="cursos">
        <TextoEditable as="h2" clave="portada.cursos.titulo" defecto="Cursos y talleres" />
        <TextoEditable as="p" className="seccion-intro" clave="portada.cursos.intro"
          defecto={'Formación clínica aplicada, agrupada por línea temática. Los talleres gratuitos son de acceso libre; los cursos requieren inscripción. Toca "Saber más" para ver de qué trata cada uno.'} />

        {lineas.length > 0 && (
          <div className="menu-lineas">
            <button type="button" className={`linea-pill${lineaActiva === 'todas' ? ' activa' : ''}`}
              onClick={() => setLineaActiva('todas')}>Todas</button>
            {lineas.map((l) => (
              <button type="button" key={l}
                className={`linea-pill${lineaActiva === l ? ' activa' : ''}`}
                onClick={() => setLineaActiva(l)}>{l}</button>
            ))}
          </div>
        )}

        {loading && <div className="loading">Cargando cursos...</div>}
        {error && <p className="aviso-error">No se pudo cargar el catálogo: {error}</p>}
        {!loading && !error && cursos.length === 0 &&
          <p className="aviso-error">El catálogo está vacío. Si acabas de publicar, recarga en un momento.</p>}
        {!loading && disponibles.length > 0 && (
          <div className="course-grid">
            {disponibles.map((c) => <CursoCard key={c.id} curso={c} user={user} tieneAcceso={accesos.has(c.id)} />)}
          </div>
        )}
        {!loading && !error && cursos.length > 0 && lineaActiva !== 'todas' && disponibles.length === 0 && proximos.length === 0 && (
          <p className="aviso-error">Todavía no hay cursos publicados en esta línea.</p>
        )}
      </section>

      {!loading && proximos.length > 0 && (
        <section className="seccion" id="proximos">
          <TextoEditable as="h2" clave="portada.proximos.titulo" defecto="Próximamente" />
          <TextoEditable as="p" className="seccion-intro" clave="portada.proximos.intro"
            defecto={'Estos cursos están en preparación. Toca "Me interesa" y te aviso en cuanto abra su inscripción — así también sé qué producir primero.'} />
          <div className="course-grid">
            {proximos.map((c) => <CursoCard key={c.id} curso={c} user={user} tieneAcceso={false} />)}
          </div>
        </section>
      )}

      <section className="seccion">
        <TextoEditable as="h2" clave="portada.servicios.titulo" defecto="Servicios" />
        <ListaEditable clave="portada.servicios" defecto={SERVICIOS} etiqueta="Servicios"
          campos={[{ k: 'titulo', etiqueta: 'Título' }, { k: 'detalle', etiqueta: 'Detalle' }]}>
          {(items) => (
            <div className="servicios-grid">
              {items.map((s, i) => (
                <div key={i} className="servicio-card"><h3>{s.titulo}</h3><p>{s.detalle}</p></div>
              ))}
            </div>
          )}
        </ListaEditable>
      </section>

      <section className="seccion">
        <TextoEditable as="h2" clave="portada.casos.titulo" defecto="Casos que atiendo" />
        <ListaEditable clave="portada.casos" defecto={CASOS} etiqueta="Casos que atiendo"
          campos={[{ k: 'texto', etiqueta: 'Caso' }]}>
          {(items) => <div className="lista-chips">{items.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>}
        </ListaEditable>
        <ListaEditable clave="portada.enfoques" defecto={ENFOQUES} etiqueta="Enfoques"
          campos={[{ k: 'texto', etiqueta: 'Enfoque' }]}>
          {(items) => <p className="enfoques"><strong>Enfoques:</strong> {items.join(' · ')}</p>}
        </ListaEditable>
      </section>

      <section className="seccion sobre-mi">
        <TextoEditable as="h2" clave="portada.sobremi.titulo" defecto="Sobre mí" />
        <ImagenEditable clave="perfil.foto" defecto={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="sobre-mi-foto" />
        <TextoEditable as="p" className="hero-bio" clave="perfil.bio" defecto={MARCA.bio} />
        <ListaEditable clave="sitio.redes" defecto={REDES} etiqueta="Redes sociales"
          campos={[{ k: 'nombre', etiqueta: 'Nombre' }, { k: 'corto', etiqueta: 'Texto corto' },
            { k: 'url', etiqueta: 'Enlace' }, { k: 'icono', etiqueta: 'Icono' }]}>
          {(items) => (
            <div className="redes">
              {items.map((r, i) => (
                <a key={i} className="red-btn" href={r.url} target="_blank" rel="noopener noreferrer" title={r.nombre}>
                  <span aria-hidden="true">{r.icono}</span><span>{r.corto}</span>
                </a>
              ))}
            </div>
          )}
        </ListaEditable>
      </section>

      <section className="seccion cierre">
        <TextoEditable as="h2" clave="portada.cierre.titulo" defecto="¿Empezamos?" />
        <TextoEditable as="p" clave="portada.cierre.texto" defecto="Escríbeme y resolvemos dudas sobre terapia, cursos o supervisión clínica." />
        <BotonEditable clave="portada.cierre.boton" clase="button grande"
          defecto={{ texto: 'Escríbeme por WhatsApp', mensaje: WA_MENSAJE_CONSULTA, estilo: 'whatsapp' }} />
      </section>

      <BandaRedes />
    </div>
  )
}

export default Home
