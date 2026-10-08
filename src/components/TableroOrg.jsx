/* ============================================================
   TABLERO DE LA ORGANIZACIÓN
   ------------------------------------------------------------
   Lo que necesita un director, que no es lo mismo que necesita
   quien da clase. El panel de progreso contesta "cómo va este
   curso"; esto contesta "cómo va lo mío".

   Es, francamente, la pantalla que justifica el precio: las
   funciones de aula las tiene cualquiera, incluido Moodle gratis.
   Saber de un vistazo que el diplomado de enero se atoró en el
   módulo 3 y que hay 40 entregas sin calificar, no.

   LAS CIFRAS VIENEN DE LA BASE, NO DE AQUÍ
   `tablero_organizacion()` y `tablero_cursos()` las calculan donde
   están los datos. Traerse el progreso de toda la institución al
   navegador para sumarlo serían cientos de miles de filas por la
   red para enseñar un número de dos dígitos.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import ExportarDatos from './ExportarDatos'

function cuando(fecha) {
  if (!fecha) return 'Sin movimiento'
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} mes(es)`
  return `Hace ${Math.floor(dias / 365)} año(s)`
}

/* Un curso sin movimiento en dos meses está parado, por muy alto que
   tenga el avance medio: ese promedio es de gente que ya se fue. */
const PARADO_DIAS = 60
const estaParado = (fecha) =>
  !fecha || (Date.now() - new Date(fecha).getTime()) / 86400000 > PARADO_DIAS

function Dato({ valor, etiqueta, ayuda, tono }) {
  return (
    <div className={`tablero-dato ${tono ? `tablero-${tono}` : ''}`}>
      <strong>{valor}</strong>
      <span>{etiqueta}</span>
      {ayuda && <em>{ayuda}</em>}
    </div>
  )
}

export default function TableroOrg() {
  const { organizacion, cargado } = useOrganizacion()
  const [tot, setTot] = useState(null)
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [orden, setOrden] = useState('atencion')

  const orgId = organizacion?.id

  useEffect(() => {
    if (!cargado) return
    if (!orgId) { setCargando(false); return }
    let vivo = true
    ;(async () => {
      setCargando(true)
      const [{ data: t, error: eT }, { data: c, error: eC }] = await Promise.all([
        supabase.rpc('tablero_organizacion', { p_org: orgId }),
        supabase.rpc('tablero_cursos', { p_org: orgId }),
      ])
      if (!vivo) return
      // Se dice CUAL de las dos falló. Juntarlas en un solo mensaje
      // obligaba a adivinar dónde mirar, y las dos consultan cosas
      // distintas.
      if (eT || eC) {
        setError([
          eT && `tablero_organizacion: ${eT.message}`,
          eC && `tablero_cursos: ${eC.message}`,
        ].filter(Boolean).join(' · '))
      } else {
        // La función devuelve una tabla de una sola fila.
        setTot(Array.isArray(t) ? t[0] : t)
        setCursos(c || [])
        setError(null)
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [orgId, cargado])

  if (cargando) return <p className="nota">Cargando el tablero…</p>
  if (error) {
    return (
      <p className="aviso-error">
        No se pudo cargar. {error}
        <br />
        Si dice que <strong>no existe</strong>, falta correr <code>TABLERO_ORG.sql</code>.
        Si dice <strong>«structure of query does not match»</strong>, es una columna
        con un tipo distinto al declarado: vuelve a correr ese mismo script,
        que ya lleva la conversión explícita.
      </p>
    )
  }
  if (!tot) return <p className="nota">Todavía no hay datos que mostrar.</p>

  const inactivos = Math.max(0, (tot.alumnos || 0) - (tot.alumnos_activos || 0))

  const ordenados = [...cursos].sort((a, b) => {
    if (orden === 'avance') return (a.avance_medio || 0) - (b.avance_medio || 0)
    if (orden === 'alumnos') return (b.alumnos || 0) - (a.alumnos || 0)
    if (orden === 'nombre') return String(a.titulo).localeCompare(String(b.titulo), 'es')
    // Por omisión: primero lo que pide atención.
    const pa = (estaParado(a.ultima_actividad) ? 1000 : 0) + (a.por_calificar || 0)
    const pb = (estaParado(b.ultima_actividad) ? 1000 : 0) + (b.por_calificar || 0)
    return pb - pa
  })

  return (
    <div className="tablero">
      <p className="seccion-intro">
        Cómo va <strong>{organizacion?.nombre}</strong> en conjunto. Para el
        detalle de un grupo, entra al curso y abre su panel de progreso.
      </p>

      <div className="tablero-datos">
        <Dato valor={tot.alumnos ?? 0} etiqueta="alumnos"
              ayuda="personas distintas, no inscripciones" />
        <Dato valor={tot.alumnos_activos ?? 0} etiqueta="activos"
              ayuda="tocaron algo en 30 días"
              tono={tot.alumnos && tot.alumnos_activos / tot.alumnos < 0.4 ? 'alerta' : 'ok'} />
        <Dato valor={inactivos} etiqueta="sin entrar"
              ayuda="más de 30 días"
              tono={inactivos > 0 ? 'aviso' : null} />
        <Dato valor={`${tot.avance_medio ?? 0}%`} etiqueta="avance medio"
              ayuda="del material de sus cursos" />
        <Dato valor={tot.cursos ?? 0} etiqueta="cursos" />
        <Dato valor={tot.inscripciones ?? 0} etiqueta="inscripciones" />
        <Dato valor={tot.facilitadores ?? 0} etiqueta="facilitadores" />
        <Dato valor={tot.por_calificar ?? 0} etiqueta="por calificar"
              ayuda="entregas esperando"
              tono={tot.por_calificar > 0 ? 'aviso' : 'ok'} />
        <Dato valor={tot.constancias ?? 0} etiqueta="constancias emitidas" />
        <Dato valor={tot.generaciones ?? 0} etiqueta="generaciones" />
      </div>

      <p className="nota">
        «Activo» significa haber marcado algún recurso como visto en los
        últimos 30 días. Quien lee todo sin marcar nada aparece inactivo: es
        la misma medida que usa el panel de progreso, pero no es tiempo de
        conexión y conviene no presentarla como tal.
      </p>

      <div className="tablero-cab">
        <h3>Por curso</h3>
        <div className="progreso-orden">
          <label>Ordenar por</label>
          <select className="input" value={orden} onChange={e => setOrden(e.target.value)}>
            <option value="atencion">Lo que pide atención</option>
            <option value="avance">Menor avance</option>
            <option value="alumnos">Más alumnos</option>
            <option value="nombre">Nombre</option>
          </select>
        </div>
      </div>

      {!cursos.length ? (
        <p className="nota">Esta organización todavía no tiene cursos.</p>
      ) : (
        <div className="gestion-tabla-scroll">
          <table className="gestion-tabla">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Alumnos</th>
                <th>Avance medio</th>
                <th>Terminaron</th>
                <th>Por calificar</th>
                <th>Constancias</th>
                <th>Último movimiento</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map(c => {
                const parado = estaParado(c.ultima_actividad)
                return (
                  <tr key={c.curso_id} className={parado ? 'tablero-fila-parada' : ''}>
                    <td>
                      <Link to={`/curso/${c.curso_id}`}>{c.titulo}</Link>
                      {parado && <span className="celda-sub">sin movimiento</span>}
                    </td>
                    <td>{c.alumnos}</td>
                    <td>
                      <div className="progreso-barra" title={`${c.avance_medio}%`}>
                        <span style={{ width: `${Math.min(100, c.avance_medio || 0)}%` }} />
                      </div>
                      <span className="celda-sub">{c.avance_medio}%</span>
                    </td>
                    <td>
                      {c.terminados}
                      {c.alumnos > 0 && (
                        <span className="celda-sub">
                          {Math.round((c.terminados / c.alumnos) * 100)}%
                        </span>
                      )}
                    </td>
                    <td>
                      {c.por_calificar > 0
                        ? <span className="badge rol-alumno">{c.por_calificar}</span>
                        : <span className="sutil">—</span>}
                    </td>
                    <td>{c.constancias || <span className="sutil">—</span>}</td>
                    <td className={parado ? 'progreso-nunca' : ''}>
                      {cuando(c.ultima_actividad)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* También aquí, y no solo en el panel de la plataforma: quien
          administra una organización debe poder sacar lo suyo sin
          pedírselo a nadie. Un dato que hay que solicitar no es
          portable, es un favor. */}
      <div className="tablero-exportar">
        <ExportarDatos organizacion={organizacion} />
      </div>

      <p className="nota" style={{ marginTop: 14 }}>
        Un curso marcado «sin movimiento» lleva más de {PARADO_DIAS} días sin
        que nadie avance en él. Mirar solo el avance medio engaña: un curso al
        40% con gente entrando ayer está vivo; uno al 40% y parado tres meses,
        no, y su promedio es de alumnos que ya se fueron.
      </p>
    </div>
  )
}
