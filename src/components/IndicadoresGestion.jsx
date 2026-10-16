/* ============================================================
   INDICADORES (pestaña del Centro de gestión)
   ------------------------------------------------------------
   Lo global que antes solo estaba en el panel clásico —y solo para
   quien administra—, ahora para cada perfil y acotado a lo que
   tiene a su cargo (kpi_mis_cursos en la base):
     · Dirección: toda su organización (o su ámbito) y lo económico.
     · Coordinación: sus cursos y su equipo.
     · Docente: sus cursos y su propio desempeño.
   Mismas cifras para todos; cambia qué se destaca arriba.

   Con «Ver como», las cifras siguen siendo las tuyas (la base solo
   contesta por quien pregunta): lo que cambia es qué indicadores
   se destacan, para ver el tablero como lo leería ese perfil.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useContenido, resolver, guardarCapa } from '../lib/contenido'
import { PERFILES } from '../lib/estructura'
import { KPIS, GRUPOS_KPI, sumar, semaforo, destacadosDe, formato, externosPorArea } from '../lib/indicadores'

const PERIODOS = [[30, 'Últimos 30 días'], [90, 'Últimos 3 meses'], [365, 'Último año']]

/** Perfil con el que se lee el tablero si no se está «viendo como». */
export function perfilDe(g) {
  if (g.perfilComo) return g.perfilComo.clave
  if (g.esPlataforma) return 'plataforma'
  if (g.esAdminOrg) return 'direccion'
  const p = g.ctx.permisos
  if (p?.has('grupos.gestionar') || p?.has('alumnos.inscribir')) return 'coordinacion'
  if (p?.has('indicadores.ver')) return 'direccion'
  return 'docente'
}

const faltaSql = (e) => e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message || ''))

function cuando(fecha) {
  if (!fecha) return 'Sin movimiento'
  const d = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  return d <= 0 ? 'Hoy' : d === 1 ? 'Ayer' : d < 30 ? `Hace ${d} días` : `Hace ${Math.floor(d / 30)} mes(es)`
}

export default function IndicadoresGestion({ g }) {
  const [dias, setDias] = useState(30)
  const [filas, setFilas] = useState(null)
  const [personas, setPersonas] = useState([])
  const [externos, setExternos] = useState([])
  const [error, setError] = useState(null)
  const [orden, setOrden] = useState({ col: 'por_calificar', desc: true })
  const capas = useContenido(g.orgId)
  const perfil = perfilDe(g)
  const nombrePerfil = PERFILES.find((p) => p.clave === perfil)?.nombre || 'tu perfil'
  const veEquipo = perfil !== 'docente'
  const veEconomia = g.esAdminOrg || g.ctx.permisos === null || g.ctx.permisos?.has('indicadores.ver')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setFilas(null); setError(null)
      const [c, p, x] = await Promise.all([
        supabase.rpc('kpi_cursos', { p_org: g.orgId, p_dias: dias }),
        supabase.rpc('kpi_personas', { p_org: g.orgId, p_dias: dias }),
        g.orgId
          ? supabase.from('indicadores_externos').select('*').eq('organizacion_id', g.orgId).order('periodo', { ascending: false }).limit(200)
          : supabase.from('indicadores_externos').select('*').is('organizacion_id', null).order('periodo', { ascending: false }).limit(200),
      ])
      if (!vivo) return
      if (c.error) {
        setError(faltaSql(c.error)
          ? 'Para ver los indicadores falta correr supabase/INDICADORES_1_KPI.sql en Supabase → SQL Editor (una vez).'
          : 'No se pudieron calcular: ' + c.error.message)
        setFilas([])
        return
      }
      setFilas(c.data || [])
      setPersonas(p.error ? [] : p.data || [])
      setExternos(x.error ? [] : x.data || [])
    })()
    return () => { vivo = false }
  }, [g.orgId, dias])

  const total = useMemo(() => sumar(filas || []), [filas])
  const metaDe = (k) => resolver(`kpi.meta.${k.clave}`, { valor: k.meta }).valor
  const puedeMeta = g.esAdminOrg && !g.perfilComo

  const cambiarMeta = async (k) => {
    const actual = metaDe(k)
    const r = window.prompt(`Meta para «${k.nombre}» (${k.sentido === 'sube' ? 'mínimo deseado' : 'máximo aceptable'}, en ${k.unidad}).\nVacío = sin meta.`, actual ?? '')
    if (r === null) return
    const n = r.trim() === '' ? null : Number(r.replace(',', '.'))
    if (n !== null && !Number.isFinite(n)) { window.alert('Escribe un número.'); return }
    try { await guardarCapa(`kpi.meta.${k.clave}`, { valor: n }, g.orgId) } catch (e) { window.alert(e.message) }
  }

  const Tarjeta = ({ k, grande }) => {
    const valor = k.calcular(total)
    const meta = metaDe(k)
    const luz = semaforo(k, valor, meta)
    return (
      <article className={`kpi${grande ? ' grande' : ''}${luz ? ` kpi-${luz}` : ''}`}>
        <p className="kpi-nombre">{k.nombre} <span className="kpi-ayuda" title={k.como} aria-label={k.como}>ⓘ</span></p>
        <p className="kpi-valor">{formato(valor, k.unidad)}{k.unidad !== '%' && k.unidad !== 'h' && valor != null && <span className="kpi-unidad"> {k.unidad}</span>}</p>
        <p className="kpi-meta">
          {meta != null ? `Meta: ${k.sentido === 'sube' ? '≥' : '≤'} ${formato(meta, k.unidad)}` : 'Sin meta'}
          {puedeMeta && <button type="button" className="button texto" onClick={() => cambiarMeta(k)} disabled={capas.falta}>editar</button>}
        </p>
      </article>
    )
  }

  const columnas = [
    ['titulo', 'Curso'], ['alumnos', 'Alumnos'], ['activos', 'Activos'], ['avance_medio', 'Avance'],
    ['en_riesgo', 'En riesgo'], ['por_calificar', 'Por calificar'], ['horas_calificar', 'Tiempo calificar'],
    ['aprobacion', 'Aprobación'], ['asistencia', 'Asistencia'], ['ultima_actividad', 'Última actividad'],
  ]
  const valorCol = (f, col) => col === 'activos' ? (f.alumnos ? f.activos_periodo / f.alumnos : null)
    : col === 'aprobacion' ? (f.intentos ? f.aprobados / f.intentos : null)
      : col === 'asistencia' ? (f.asistencias ? f.presentes / f.asistencias : null)
        : col === 'ultima_actividad' ? (f.ultima_actividad ? new Date(f.ultima_actividad).getTime() : null)
          : f[col]
  const ordenadas = [...(filas || [])].sort((a, b) => {
    const va = valorCol(a, orden.col), vb = valorCol(b, orden.col)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    const c = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return orden.desc ? -c : c
  })
  const porc = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')

  return (
    <div className="indicadores">
      <div className="indicadores-barra">
        <p className="seccion-intro" style={{ margin: 0 }}>
          {filas ? <><strong>{total.cursos}</strong> curso(s) a tu cargo · leído como <strong>{nombrePerfil}</strong></> : 'Calculando…'}
          {g.perfilComo && ' (las cifras son las de tus cursos; el perfil cambia qué se destaca)'}
        </p>
        <select className="input" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Periodo">
          {PERIODOS.map(([d, t]) => <option key={d} value={d}>{t}</option>)}
        </select>
      </div>

      {error && <p className="aviso-error">{error}</p>}
      {filas === null && <div className="loading">Calculando indicadores…</div>}

      {filas && !error && (
        <>
          <h2 className="titulo-seccion">Lo más importante para {nombrePerfil}</h2>
          <div className="kpi-grid destacados">
            {destacadosDe(perfil).map((k) => <Tarjeta key={k.clave} k={k} grande />)}
          </div>

          <details className="kpi-todos">
            <summary>Todos los indicadores</summary>
            {GRUPOS_KPI.map((grupo) => (
              <section key={grupo}>
                <h3>{grupo}</h3>
                <div className="kpi-grid">{KPIS.filter((k) => k.grupo === grupo).map((k) => <Tarjeta key={k.clave} k={k} />)}</div>
              </section>
            ))}
          </details>

          <h2 className="titulo-seccion">Por curso</h2>
          <div className="matriz-scroll">
            <table className="matriz-tabla kpi-tabla">
              <thead>
                <tr>
                  {columnas.map(([col, t]) => (
                    <th key={col} scope="col" aria-sort={orden.col === col ? (orden.desc ? 'descending' : 'ascending') : 'none'}>
                      <button type="button" className="button texto"
                        onClick={() => setOrden((o) => ({ col, desc: o.col === col ? !o.desc : true }))}>
                        {t}{orden.col === col ? (orden.desc ? ' ▼' : ' ▲') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f) => (
                  <tr key={f.curso_id}>
                    <th scope="row"><Link to={`/gestion/curso/${f.curso_id}${g.sufijo}`}>{f.titulo}</Link></th>
                    <td>{f.alumnos}</td>
                    <td>{porc(f.activos_periodo, f.alumnos)}</td>
                    <td>{f.avance_medio != null ? `${f.avance_medio}%` : '—'}</td>
                    <td className={f.en_riesgo ? 'kpi-alerta' : ''}>{f.en_riesgo}</td>
                    <td className={f.por_calificar ? 'kpi-alerta' : ''}>{f.por_calificar}</td>
                    <td>{formato(f.horas_calificar, 'h')}</td>
                    <td>{porc(f.aprobados, f.intentos)}</td>
                    <td>{porc(f.presentes, f.asistencias)}</td>
                    <td>{cuando(f.ultima_actividad)}</td>
                  </tr>
                ))}
                {!ordenadas.length && <tr><td colSpan={columnas.length}>No hay cursos a tu cargo.</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 className="titulo-seccion">{veEquipo ? 'Equipo docente' : 'Tu desempeño'}</h2>
          <p className="nota">
            Sale de lo que cada quien hace en la plataforma: entregas calificadas y en cuánto tiempo, lo que tiene
            pendiente en sus cursos, sus respuestas en el foro y las listas que pasa. {!veEquipo && 'Solo te ves a ti.'}
          </p>
          <div className="matriz-scroll">
            <table className="matriz-tabla kpi-tabla">
              <thead>
                <tr>
                  <th scope="col">Persona</th><th scope="col">Cursos</th><th scope="col">Calificadas</th>
                  <th scope="col">Tiempo medio</th><th scope="col">Pendientes</th><th scope="col">Foro</th>
                  <th scope="col">Listas</th><th scope="col">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((p) => {
                  const luz = semaforo(KPIS.find((k) => k.clave === 'horas_calificar'), p.horas_calificar != null ? Number(p.horas_calificar) : null,
                    metaDe(KPIS.find((k) => k.clave === 'horas_calificar')))
                  return (
                    <tr key={p.email}>
                      <th scope="row">{p.nombre || p.email}{p.nombre && <span className="matriz-permiso">{p.email}</span>}</th>
                      <td>{p.cursos}</td>
                      <td>{p.calificadas}</td>
                      <td className={luz ? `kpi-celda-${luz}` : ''}>{formato(p.horas_calificar != null ? Number(p.horas_calificar) : null, 'h')}</td>
                      <td className={p.por_calificar ? 'kpi-alerta' : ''}>{p.por_calificar}</td>
                      <td>{p.respuestas_foro}</td>
                      <td>{p.asistencias}</td>
                      <td>{cuando(p.ultima_actividad)}</td>
                    </tr>
                  )
                })}
                {!personas.length && <tr><td colSpan={8}>Sin actividad del equipo en este periodo.</td></tr>}
              </tbody>
            </table>
          </div>

          {veEconomia && (
            <>
              <h2 className="titulo-seccion">Económicos y fuentes externas</h2>
              {externos.length === 0 ? (
                <p className="aviso-info">
                  Aquí aparecen los datos que la plataforma no genera —ingresos, costos, becas, horas contratadas— en
                  cuanto se carguen en la tabla <code>indicadores_externos</code> (por área, curso o persona, con su
                  periodo y su fuente). Ver docs/INDICADORES_KPI.md para conectarla con contabilidad o recursos humanos.
                </p>
              ) : (
                <div className="kpi-externos">
                  {externosPorArea(externos).map(({ area, filas: lista }) => (
                    <section key={area}>
                      <h3>{area}</h3>
                      <ul>
                        {lista.slice(0, 12).map((x) => (
                          <li key={x.id}>
                            <span>{x.etiqueta}{x.persona_email ? ` · ${x.persona_email}` : ''}</span>
                            <strong>{Number(x.valor).toLocaleString('es-MX')} {x.unidad || ''}</strong>
                            <span className="nota">{x.periodo} · {x.fuente}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
