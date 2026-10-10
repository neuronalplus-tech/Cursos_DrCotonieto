/* ============================================================
   MIS CALIFICACIONES
   ------------------------------------------------------------
   Todo lo del alumno en un solo sitio: su avance, sus exámenes,
   sus entregas con la retroalimentación, su participación en los
   foros evaluables y sus constancias.

   Hasta aquí cada nota vivía donde se generó —una en el módulo,
   otra dentro del foro, otra en la pantalla de la tarea— y para
   saber cómo iba había que recorrer el curso entero. Es la queja
   mas comun en cualquier plataforma, y los datos ya estaban: solo
   faltaba juntarlos.

   Todo lo que se lee aquí está acotado por RLS a esta persona. No
   hay un solo filtro de seguridad en este archivo porque no hace
   falta: la base no devuelve lo ajeno.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rutaAcceso } from '../config'
import { Breadcrumb, BandaRedes } from './ui'
import { calcular } from '../lib/calificacion'

function pct(hechos, total) {
  return total ? Math.round((hechos / total) * 100) : 0
}

/* ------------------------------------------------------------
   LA CALIFICACIÓN DEL CURSO
   ------------------------------------------------------------
   El cálculo NO vive aquí: vive en src/lib/calificacion.js, que es
   el mismo módulo que usa la rejilla del facilitador.

   Antes estaba escrito en este archivo, y en cuanto el facilitador
   tuvo su propia columna de calificación hubo que elegir: o dos
   implementaciones del mismo número, o una sola. Dos implementaciones
   siempre acaban discrepando, y el día que un alumno reclame su
   constancia no podrías defender ninguna de las dos.

   Aquí solo se traduce lo que cargó esta pantalla a la forma que
   espera el módulo.
   ------------------------------------------------------------ */
function calificacionDelCurso(c) {
  return calcular({
    examenes: c.examenes
      .map(e => ({
        id: e.id, titulo: e.titulo, moduloId: e.modulo_id,
        valor: e.mejor?.calificacion ?? null, maximo: 100,
        incluida: e.activo !== false,
      })),
    tareas: c.tareas
      .map(t => ({
        id: t.id, titulo: t.titulo, moduloId: t.modulo_id,
        valor: t.entrega?.calificado_en ? t.entrega.calificacion : null,
        maximo: t.puntos_max || 100,
      })),
    foro: c.foros
      .map(h => ({
        id: h.id, titulo: h.titulo, valor: h.media, maximo: h.puntos_max || 10,
      })),
    avance: { hechos: c.hechosRec, total: c.totalRec },
  }, c.ponderacion)
}

function fecha(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX',
    { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MisCalificaciones({ user }) {
  const navigate = useNavigate()
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/mis-calificaciones')); return }
    let vivo = true
    ;(async () => {
      try {
        const { data: acc } = await supabase
          .from('acceso').select('curso_id').eq('usuario_id', user.id)
        const ids = [...new Set((acc || []).map(a => a.curso_id))]
        if (!ids.length) {
          if (vivo) { setCursos([]); setCargando(false) }
          return
        }

        const { data: cs } = await supabase
          .from('cursos').select('id, titulo, ponderacion').in('id', ids).order('orden')
        const { data: mods } = await supabase
          .from('modulos').select('id, curso_id').in('curso_id', ids)
        const idsMod = (mods || []).map(m => m.id)
        const cursoDeModulo = Object.fromEntries((mods || []).map(m => [m.id, m.curso_id]))

        const { data: recs } = idsMod.length
          ? await supabase.from('recursos').select('id, modulo_id').in('modulo_id', idsMod)
          : { data: [] }
        const idsRec = (recs || []).map(r => r.id)

        const { data: prog } = idsRec.length
          ? await supabase.from('progreso_usuario').select('recurso_id')
              .eq('usuario_id', user.id).in('recurso_id', idsRec).eq('completado', true)
          : { data: [] }
        const hechos = new Set((prog || []).map(p => p.recurso_id))

        // --- Exámenes ---
        const { data: exs } = await supabase
          .from('examenes')
          // `examenes` NO tiene puntos_max: pedirla hacia que PostgREST
          // devolviera error y `exs` llegara nulo, asi que los examenes no
          // aparecian en esta pantalla. Se califican sobre 100.
          .select('id, titulo, curso_id, modulo_id, activo')
          .or(`curso_id.in.(${ids.join(',')})` +
              (idsMod.length ? `,modulo_id.in.(${idsMod.join(',')})` : ''))
        const { data: intentos } = (exs || []).length
          ? await supabase.from('intentos_examen')
              .select('examen_id, calificacion, aprobado')
              .eq('usuario_id', user.id).in('examen_id', exs.map(e => e.id))
          : { data: [] }

        // --- Tareas ---
        const { data: tas } = await supabase
          .from('tareas').select('id, titulo, curso_id, modulo_id, puntos_max')
          .eq('activo', true)
          .or(`curso_id.in.(${ids.join(',')})` +
              (idsMod.length ? `,modulo_id.in.(${idsMod.join(',')})` : ''))
        const { data: ents } = (tas || []).length
          ? await supabase.from('entregas')
              .select('tarea_id, calificacion, retroalimentacion, calificado_en, entregado_en')
              .eq('usuario_id', user.id).in('tarea_id', tas.map(t => t.id))
          : { data: [] }

        // --- Foros evaluables: cuenta el promedio de lo propio ---
        const { data: hilos } = await supabase
          .from('foro_hilos').select('id, titulo, curso_id, puntos_max')
          .in('curso_id', ids).eq('califica', true)
        const { data: aport } = (hilos || []).length
          ? await supabase.from('foro_respuestas')
              .select('hilo_id, calificacion')
              .eq('autor_id', user.id).eq('borrada', false)
              .in('hilo_id', hilos.map(h => h.id))
          : { data: [] }

        const { data: consts } = await supabase
          .from('constancias').select('curso_id, folio, fecha_emision')
          .eq('usuario_id', user.id)

        // --- Se arma un bloque por curso ---
        const porCurso = (cs || []).map(c => {
          const modsDelCurso = (mods || []).filter(m => m.curso_id === c.id).map(m => m.id)
          const recsDelCurso = (recs || []).filter(r => modsDelCurso.includes(r.modulo_id))
          const deEsteCurso = (x) =>
            x.curso_id === c.id || (x.modulo_id && cursoDeModulo[x.modulo_id] === c.id)

          // Un examen apagado no cuenta como pendiente: el alumno no
          // puede presentarlo aunque quiera.
          const examenes = (exs || []).filter(e => e.activo !== false)
            .filter(deEsteCurso).map(e => {
            const mios = (intentos || []).filter(i => i.examen_id === e.id)
            const mejor = mios.reduce((m, i) =>
              !m || (i.calificacion ?? 0) > (m.calificacion ?? 0) ? i : m, null)
            return { ...e, mejor }
          })

          const tareas = (tas || []).filter(deEsteCurso).map(t => ({
            ...t, entrega: (ents || []).find(e => e.tarea_id === t.id) || null,
          }))

          const foros = (hilos || []).filter(h => h.curso_id === c.id).map(h => {
            // Todas mis aportaciones, calificadas o no: es lo que
            // distingue «no participé» de «participé y falta la nota».
            const mias = (aport || []).filter(a => a.hilo_id === h.id)
            const notas = (aport || [])
              .filter(a => a.hilo_id === h.id && a.calificacion != null)
              .map(a => Number(a.calificacion))
            return {
              ...h,
              media: notas.length
                ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100
                : null,
              n: notas.length,
              aportaciones: mias.length,
            }
          })

          return {
            ...c,
            totalRec: recsDelCurso.length,
            hechosRec: recsDelCurso.filter(r => hechos.has(r.id)).length,
            examenes, tareas, foros,
            constancia: (consts || []).find(k => k.curso_id === c.id) || null,
          }
        })

        if (vivo) setCursos(porCurso)
      } catch (e) {
        if (vivo) setError(e.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [user, navigate])

  if (!user) return null

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mis calificaciones' }]} />
      <h1>Mis calificaciones</h1>
      <p className="seccion-intro">
        Todo tu avance y tus notas en un solo lugar, curso por curso.
      </p>

      {cargando && <p className="nota">Cargando…</p>}
      {error && <p className="aviso-error">No se pudo cargar: {error}</p>}

      {!cargando && !error && !cursos.length && (
        <p className="nota">
          Todavía no estás inscrito en ningún curso. Cuando lo estés, aquí verás
          cómo vas.
        </p>
      )}

      {cursos.map(c => {
        const avance = pct(c.hechosRec, c.totalRec)
        const nota = calificacionDelCurso(c)
        return (
          <article key={c.id} className="mis-curso">
            <header className="mis-curso-cab">
              <div>
                <h2><Link to={`/curso/${c.id}`}>{c.titulo}</Link></h2>
                {c.totalRec > 0 && (
                  <span className="celda-sub">
                    {avance}% del material · {c.hechosRec} de {c.totalRec}
                  </span>
                )}
              </div>
              <div className="mis-nota">
                {nota ? (
                  <>
                    <strong>{nota.equivalente10}/10</strong>
                    <span className="nota">
                      {nota.acumulado}/100 puntos acumulados · {nota.pesoEvaluado}% de la evaluación calificada
                    </span>
                    {nota.valor != null && (
                      <span className="nota">
                        Rendimiento en lo calificado: {nota.valor}/100 · {nota.de} actividad(es)
                      </span>
                    )}
                    <div className="mis-nota-desglose">
                      {nota.detalle.filter(d => d.n && d.pesoFinal > 0).map((d, i) => (
                        <span key={d.clave}>
                          {i > 0 && ' · '}{d.etiqueta}: {d.media}/100
                          {' · '}{d.pesoCalificadoFinal}% del curso ya calificado
                          {' · aporta '}{d.aporteFinal} puntos
                          {d.criterios?.filter(k => k.n).map(k => (
                            <small key={k.id}>
                              {k.etiqueta}: {k.media}/100 · aporta {k.aporteFinal} puntos
                            </small>
                          ))}
                        </span>
                      ))}
                    </div>
                    {nota.aprobado === false && (
                      <span className="nota">mínima para aprobar: {nota.minima}/10</span>
                    )}
                  </>
                ) : (
                  <span className="sutil">Sin calificaciones aún</span>
                )}
              </div>
              {c.constancia && (
                <span className="badge rol-facil" title={`Folio ${c.constancia.folio}`}>
                  Constancia · {c.constancia.folio}
                </span>
              )}
            </header>

            {c.totalRec > 0 && (
              <div className="progreso-barra" style={{ width: '100%' }}>
                <span style={{ width: `${avance}%` }} />
              </div>
            )}

            {/* Todas las actividades evaluables del curso, hechas o no.
                Lo pendiente se marca en ámbar y con enlace para ir a
                hacerlo: esta pantalla contesta «cómo voy», y parte de
                eso es «qué me falta». Esconder lo no hecho dejaba al
                alumno sin saber qué le faltaba hasta que era tarde. */}
            {c.examenes.length > 0 && (
              <div className="mis-bloque">
                <h3>Exámenes</h3>
                <ul className="mis-lista">
                  {c.examenes.map(e => (
                    <li key={e.id} className={!e.mejor ? 'mis-pendiente' : ''}>
                      <span>
                        <Link to={e.modulo_id ? `/modulo/${e.modulo_id}` : `/curso/${c.id}`}>
                          {e.titulo}
                        </Link>
                      </span>
                      {!e.mejor
                        ? <span className="badge pendiente">Pendiente</span>
                        : <span className={e.mejor.aprobado ? 'badge ok' : 'badge no-aprobado'}>
                            {e.mejor.calificacion}
                          </span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c.tareas.length > 0 && (
              <div className="mis-bloque">
                <h3>Entregas</h3>
                <ul className="mis-lista">
                  {c.tareas.map(t => (
                    <li key={t.id} className={`mis-tarea ${!t.entrega ? 'mis-pendiente' : ''}`}>
                      <span>
                        <Link to={t.modulo_id ? `/modulo/${t.modulo_id}` : `/curso/${c.id}`}>
                          {t.titulo}
                        </Link>
                      </span>
                      {!t.entrega
                        ? <span className="badge pendiente">Pendiente</span>
                        : !t.entrega.calificado_en
                          ? <span className="badge rol-alumno">En revisión</span>
                          : <span className="badge ok">
                              {t.entrega.calificacion} / {t.puntos_max}
                            </span>}
                      {/* La retroalimentación es lo que más se busca y lo que
                          peor se encontraba: iba dentro de la pantalla de la
                          tarea, a tres clics. */}
                      {t.entrega?.retroalimentacion && (
                        <p className="mis-retro">{t.entrega.retroalimentacion}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c.foros.length > 0 && (
              <div className="mis-bloque">
                <h3>Participación en el foro</h3>
                <ul className="mis-lista">
                  {c.foros.map(h => (
                    <li key={h.id} className={h.aportaciones === 0 ? 'mis-pendiente' : ''}>
                      <span><Link to={`/foro/${c.id}`}>{h.titulo}</Link></span>
                      {/* Tres estados y no dos: no participar es cosa del
                          alumno; participar y esperar nota es cosa del
                          docente. Decirle «sin calificar» a quien no ha
                          escrito nada le hace creer que ya cumplió. */}
                      {h.aportaciones === 0
                        ? <span className="badge pendiente">Pendiente</span>
                        : h.media == null
                          ? <span className="badge rol-alumno">En revisión</span>
                          : <span className="badge ok" title={`${h.n} aportación(es)`}>
                              {h.media} / {h.puntos_max ?? 10}
                            </span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c.constancia && (
              <p className="nota">
                Constancia emitida el {fecha(c.constancia.fecha_emision)}.{' '}
                <Link to={`/verificar/${c.constancia.folio}`}>Verificarla</Link>
                {' · '}
                <Link to={`/constancia/${c.id}`}>Descargarla</Link>
              </p>
            )}
          </article>
        )
      })}

      <BandaRedes />
    </section>
  )
}
