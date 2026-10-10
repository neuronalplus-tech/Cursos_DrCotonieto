import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { rutaAcceso, FOTO_PERFIL, MARCA, WA_CONSULTA,
  SERVICIOS, CASOS, ENFOQUES, REDES,
  ICONO_TIPO, NOMBRE_TIPO, LOGO_BLANCO, LOGO_CLARO,
  ENLACE_DIAPOSITIVAS_PRESENTAR_CASO, ENLACE_ENTREGABLES,
  CONTACTO_EMAIL,
} from '../config'
import { esTallerIndividual } from '../lib/helpers'
import { useOrganizacion, aplicarMarca } from '../lib/organizacion'
import { WhatsAppFlotante, BandaRedes } from './ui'
import PortadaCurso, { motivoDe } from './PortadaCurso'
import CarruselCursos from './CarruselCursos'
import CursoCard from './CursoCard'
import { CATALOGO_PLANTILLAS, descargarPlantilla } from '../lib/plantillasCarga'

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
          <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="mini-foto" />
          <div className="mini-perfil-texto">
            <h1>{MARCA.nombre}</h1>
            <p className="mini-credencial">{MARCA.credencial}</p>
            <p className="mini-slogan">"{MARCA.slogan}"</p>
            <p className="mini-sub">{MARCA.subtitulo}</p>
            <a className="button whatsapp" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer">
              Agenda tu llamada sin costo
            </a>
          </div>
        </div>
        {!loading && <CarruselCursos lineas={lineas} cursos={cursos} onSelect={irACurso} copia={copiaLineas} />}
      </section>

      <section className="seccion" id="plantillas-carga">
        <h2>Plantillas para llenar</h2>
        <p className="seccion-intro">Descarga formatos listos para Excel o Google Sheets y completa la información antes de importarla.</p>
        <div className="course-grid">
          {CATALOGO_PLANTILLAS.map(p => (
            <article className="servicio-card" key={p.archivo}>
              <h3>{p.nombre}</h3><p>{p.detalle}</p>
              {p.imagen && <img className="plantilla-carga-ejemplo" src={p.imagen} alt={`Ejemplo de columnas para ${p.nombre}`} />}
              <button type="button" className="button secondary" onClick={() => descargarPlantilla(p)}>
                ⬇️ Descargar {p.archivo}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="seccion" id="cursos">
        <h2>Cursos y talleres</h2>
        <p className="seccion-intro">
          Formación clínica aplicada, agrupada por línea temática. Los talleres gratuitos son de acceso
          libre; los cursos requieren inscripción. Toca "Saber más" para ver de qué trata cada uno.
        </p>

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
          <h2>Próximamente</h2>
          <p className="seccion-intro">
            Estos cursos están en preparación. Toca "Me interesa" y te aviso en cuanto abra su inscripción —
            así también sé qué producir primero.
          </p>
          <div className="course-grid">
            {proximos.map((c) => <CursoCard key={c.id} curso={c} user={user} tieneAcceso={false} />)}
          </div>
        </section>
      )}

      <section className="seccion">
        <h2>Servicios</h2>
        <div className="servicios-grid">
          {SERVICIOS.map((s, i) => (
            <div key={i} className="servicio-card"><h3>{s.titulo}</h3><p>{s.detalle}</p></div>
          ))}
        </div>
      </section>

      <section className="seccion">
        <h2>Casos que atiendo</h2>
        <div className="lista-chips">{CASOS.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>
        <p className="enfoques"><strong>Enfoques:</strong> {ENFOQUES.join(' · ')}</p>
      </section>

      <section className="seccion sobre-mi">
        <h2>Sobre mí</h2>
        <img src={FOTO_PERFIL} alt="Dr. Ernesto Cotonieto" className="sobre-mi-foto" />
        <p className="hero-bio">{MARCA.bio}</p>
        <div className="redes">
          {REDES.map((r) => (
            <a key={r.nombre} className="red-btn" href={r.url} target="_blank" rel="noopener noreferrer" title={r.nombre}>
              <span aria-hidden="true">{r.icono}</span><span>{r.corto}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="seccion cierre">
        <h2>¿Empezamos?</h2>
        <p>Escríbeme y resolvemos dudas sobre terapia, cursos o supervisión clínica.</p>
        <a className="button whatsapp grande" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer">
          Escríbeme por WhatsApp
        </a>
      </section>

      <BandaRedes />
    </div>
  )
}

export default Home
