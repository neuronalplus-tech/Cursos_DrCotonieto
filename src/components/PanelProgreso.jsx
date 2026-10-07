/* ============================================================
   PROGRESO DEL GRUPO
   ------------------------------------------------------------
   Las métricas del panel son globales: cuántos alumnos hay, cuánta
   finalización en total. Eso sirve para mirar el negocio, no para
   dar clase. Quien acompaña a un grupo necesita otra cosa: quién
   va atrasado, quién no ha entrado, quién reprobó un examen.

   Vive dentro del curso y no en el panel central a propósito: es
   información de ESE grupo, y un facilitador no entra al panel.

   Lo que se ve aquí lo decide RLS (ROLES_4_ALUMNOS.sql): el admin
   ve todo, el facilitador solo los inscritos de sus cursos.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcular, tienePonderacion } from '../lib/calificacion'

function cuando(fecha) {
  if (!fecha) return 'Nunca'
  const d = new Date(fecha)
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ------------------------------------------------------------
   EXPORTAR A CSV
   ------------------------------------------------------------
   CSV y no xlsx a proposito: Excel lo abre igual, y generar un
   xlsx de verdad costaria otra libreria en el paquete para no
   ganar nada que esta gente vaya a usar.

   El BOM del principio NO es decorativo. Sin el, Excel en Windows
   lee el archivo como ANSI y "Martínez" aparece como "MartÃ­nez".
   Es el fallo numero uno de los CSV en español.
   ------------------------------------------------------------ */
function aCSV(cabeceras, filas) {
  const celda = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    // Comillas, comas y saltos obligan a entrecomillar; las comillas
    // internas se duplican, que es como lo espera el formato.
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lineas = [cabeceras, ...filas].map(f => f.map(celda).join(';'))
  // El BOM se genera con fromCharCode y no se escribe pegado: uno
  // literal es invisible, se pierde al copiar y pegar, y entonces
  // vuelven los acentos rotos sin que nadie entienda por qué.
  return String.fromCharCode(0xFEFF) + lineas.join('\r\n')
}

function descargar(nombre, contenido) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function PanelProgreso({ cursoId }) {
  const [filas, setFilas] = useState([])
  const [examenes, setExamenes] = useState([])
  const [tareas, setTareas] = useState([])
  const [totalRecursos, setTotalRecursos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [orden, setOrden] = useState('avance')
  const [generaciones, setGeneraciones] = useState([])
  const [filtroGen, setFiltroGen] = useState('todas')
  // Los foros evaluables y la ponderación del curso: sin ellos la
  // columna de calificación final diría algo distinto de lo que ve el
  // alumno en "Mis calificaciones".
  const [foros, setForos] = useState([])
  const [ponderacion, setPonderacion] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError(null)
      try {
        const curso = Number(cursoId)

        // --- Qué hay que completar en este curso ---
        const { data: mods } = await supabase
          .from('modulos').select('id').eq('curso_id', curso).eq('activo', true)
        const idsMod = (mods || []).map(m => m.id)

        // `.in()` con una lista vacía genera un filtro mal formado que
        // Postgres rechaza. Se comprueba antes en cada consulta.
        const { data: recs } = idsMod.length
          ? await supabase.from('recursos').select('id').in('modulo_id', idsMod)
          : { data: [] }
        const idsRec = (recs || []).map(r => r.id)

        // --- Quién está inscrito ---
        const { data: insc } = await supabase
          .from('acceso').select('usuario_id, generacion_id').eq('curso_id', curso)
        const idsAlumno = [...new Set((insc || []).map(a => a.usuario_id))]

        const { data: gens } = await supabase.from('generaciones')
          .select('id, nombre').eq('curso_id', curso)
          .order('fecha_inicio', { ascending: false, nullsFirst: false })
        const genDe = Object.fromEntries(
          (insc || []).map(a => [a.usuario_id, a.generacion_id]))

        if (!idsAlumno.length) {
          if (vivo) { setFilas([]); setTotalRecursos(idsRec.length); setCargando(false) }
          return
        }

        const { data: perfs } = await supabase
          .from('perfiles').select('id, nombre_completo').in('id', idsAlumno)
        const nombre = Object.fromEntries((perfs || []).map(p => [p.id, p.nombre_completo]))

        // --- Qué ha completado cada quien ---
        const { data: prog } = idsRec.length
          ? await supabase.from('progreso_usuario')
              .select('usuario_id, recurso_id, ultimo_acceso')
              .in('recurso_id', idsRec).eq('completado', true)
          : { data: [] }

        // --- Exámenes del curso y de sus módulos ---
        const { data: exCurso } = await supabase
          .from('examenes').select('id, titulo').eq('curso_id', curso)
        const { data: exMod } = idsMod.length
          ? await supabase.from('examenes').select('id, titulo').in('modulo_id', idsMod)
          : { data: [] }
        const exs = [...(exCurso || []), ...(exMod || [])]
        const idsEx = exs.map(e => e.id)

        const { data: intentos } = idsEx.length
          ? await supabase.from('intentos_examen')
              .select('usuario_id, examen_id, calificacion, aprobado')
              .in('examen_id', idsEx)
          : { data: [] }

        // --- Tareas: las del curso y las de sus módulos ---
        const { data: tCurso } = await supabase
          .from('tareas').select('id, titulo, puntos_max').eq('curso_id', curso)
        const { data: tMod } = idsMod.length
          ? await supabase.from('tareas').select('id, titulo, puntos_max').in('modulo_id', idsMod)
          : { data: [] }
        const tds = [...(tCurso || []), ...(tMod || [])]
        const idsTarea = tds.map(t => t.id)

        const { data: entregas } = idsTarea.length
          ? await supabase.from('entregas')
              .select('usuario_id, tarea_id, calificacion, calificado_en')
              .in('tarea_id', idsTarea)
          : { data: [] }

        // --- Constancias emitidas ---
        const { data: consts } = await supabase
          .from('constancias').select('usuario_id, folio, fecha_emision')
          .eq('curso_id', curso)
        const folioDe = Object.fromEntries(
          (consts || []).map(c => [c.usuario_id, c]))

        // --- Cómo pondera este curso ---
        const { data: cursoCfg } = await supabase
          .from('cursos').select('ponderacion').eq('id', curso).maybeSingle()

        // --- Foros que califican ---
        const { data: hilos } = await supabase
          .from('foro_hilos').select('id, titulo, puntos_max')
          .eq('curso_id', curso).eq('califica', true)
        const idsHilo = (hilos || []).map(h => h.id)
        const { data: aport } = idsHilo.length
          ? await supabase.from('foro_respuestas')
              .select('hilo_id, autor_id, calificacion')
              .in('hilo_id', idsHilo).eq('borrada', false)
              .not('calificacion', 'is', null)
          : { data: [] }

        // --- Se cruza todo por alumno ---
        const porAlumno = {}
        for (const id of idsAlumno) {
          porAlumno[id] = {
            id,
            nombre: nombre[id] || '(sin nombre)',
            hechos: 0,
            ultimo: null,
            // Del examen interesa el MEJOR intento: es el que cuenta
            // para la constancia y el que refleja lo que acabó sabiendo.
            mejor: {},
            // tarea_id -> { calificacion, calificado_en } | ausente si no entregó
            entregas: {},
            // hilo_id -> [notas]. Se promedian por hilo antes de entrar
            // en la nota del curso: quien escribió diez veces en un hilo
            // no debe pesar diez veces más que quien escribió una.
            foro: {},
            constancia: null,
            generacion: genDe[id] ?? null,
          }
        }
        for (const p of prog || []) {
          const a = porAlumno[p.usuario_id]
          if (!a) continue
          a.hechos++
          if (!a.ultimo || (p.ultimo_acceso && p.ultimo_acceso > a.ultimo)) a.ultimo = p.ultimo_acceso
        }
        for (const [uid, c] of Object.entries(folioDe)) {
          if (porAlumno[uid]) porAlumno[uid].constancia = c
        }
        for (const en of entregas || []) {
          const a = porAlumno[en.usuario_id]
          if (a) a.entregas[en.tarea_id] = en
        }
        for (const a of aport || []) {
          const al = porAlumno[a.autor_id]
          if (!al) continue
          if (!al.foro[a.hilo_id]) al.foro[a.hilo_id] = []
          al.foro[a.hilo_id].push(Number(a.calificacion))
        }
        for (const it of intentos || []) {
          const a = porAlumno[it.usuario_id]
          if (!a) continue
          const previo = a.mejor[it.examen_id]
          if (!previo || (it.calificacion ?? 0) > (previo.calificacion ?? 0)) {
            a.mejor[it.examen_id] = it
          }
        }

        if (!vivo) return
        setTotalRecursos(idsRec.length)
        setExamenes(exs)
        setTareas(tds)
        setGeneraciones(gens || [])
        setForos(hilos || [])
        setPonderacion(cursoCfg?.ponderacion || null)
        setFilas(Object.values(porAlumno))
      } catch (e) {
        if (vivo) setError(e.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [cursoId])

  const pct = (f) => (totalRecursos ? Math.round((f.hechos / totalRecursos) * 100) : 0)

  /* La calificación final sale de src/lib/calificacion.js, el MISMO
     módulo que usa "Mis calificaciones". Si algún día hay que cambiar
     cómo se promedia, se cambia en un solo sitio y las dos pantallas
     siguen diciendo lo mismo. Que no coincidan es justo lo que no
     puedes defender cuando alguien reclama su constancia. */
  const notaDe = (f) => calcular({
    examenes: examenes
      .map(e => f.mejor[e.id])
      .filter(it => it && it.calificacion != null)
      .map(it => ({ valor: it.calificacion, maximo: 100 })),
    tareas: tareas
      .map(t => ({ t, en: f.entregas[t.id] }))
      .filter(x => x.en?.calificado_en && x.en.calificacion != null)
      .map(x => ({ valor: x.en.calificacion, maximo: x.t.puntos_max || 100 })),
    // Se promedia DENTRO de cada hilo primero: quien escribió diez
    // veces en el mismo hilo no debe pesar diez veces más.
    foro: foros
      .map(h => ({ h, notas: f.foro[h.id] || [] }))
      .filter(x => x.notas.length)
      .map(x => ({
        valor: x.notas.reduce((s2, v) => s2 + v, 0) / x.notas.length,
        maximo: x.h.puntos_max || 10,
      })),
    avance: { hechos: f.hechos, total: totalRecursos },
  }, ponderacion)

  // El filtro se aplica antes de ordenar y antes del resumen: si no,
  // los totales seguirían contando a todo el curso y dirían una cosa
  // distinta de la tabla que tienes delante.
  const visibles = filtroGen === 'todas'
    ? filas
    : filas.filter(f => String(f.generacion ?? '') === String(filtroGen))

  const ordenadas = [...visibles].sort((a, b) => {
    if (orden === 'nombre') return a.nombre.localeCompare(b.nombre)
    if (orden === 'inactivo') return (a.ultimo || '').localeCompare(b.ultimo || '')
    return pct(a) - pct(b)   // por defecto: los más atrasados primero
  })

  // Entregas esperando calificación. Es el unico numero del resumen
  // que señala trabajo TUYO, no de ellos, por eso va aparte.
  const porCalificar = visibles.reduce(
    (n, f) => n + Object.values(f.entregas || {}).filter(e => !e.calificado_en).length, 0)
  /* Una fila por persona con todo lo que se evalúa. Sale del mismo
     estado que pinta la tabla, así que el Excel y la pantalla no
     pueden discrepar. */
  const exportar = () => {
    const cabeceras = [
      'Alumno', 'Generación', 'Avance %', 'Recursos vistos', 'Recursos totales', 'Última actividad',
      'Calificación final', 'Tipo de cálculo', 'Notas que la forman',
      ...examenes.map(e => `Examen: ${e.titulo}`),
      ...tareas.map(t => `Tarea: ${t.titulo}`),
      ...foros.map(h => `Foro: ${h.titulo}`),
      'Constancia', 'Folio', 'Fecha de constancia',
    ]
    const cuerpo = ordenadas.map(f => [
      f.nombre,
      generaciones.find(g => String(g.id) === String(f.generacion))?.nombre || 'Sin generación',
      pct(f),
      f.hechos,
      totalRecursos,
      f.ultimo ? new Date(f.ultimo).toLocaleDateString('es-MX') : 'Nunca',
      // Mismo origen que la columna de la pantalla, para que el Excel
      // que mandes y lo que ves no puedan discrepar.
      notaDe(f)?.valor ?? '',
      tienePonderacion(ponderacion) ? 'Ponderada' : 'Promedio simple',
      notaDe(f)?.de ?? 0,
      ...examenes.map(e => f.mejor[e.id]?.calificacion ?? ''),
      ...tareas.map(t => {
        const en = f.entregas[t.id]
        if (!en) return 'Sin entregar'
        return en.calificado_en ? (en.calificacion ?? '') : 'Por calificar'
      }),
      ...foros.map(h => {
        const notas = f.foro[h.id] || []
        if (!notas.length) return ''
        return Math.round((notas.reduce((s2, v) => s2 + v, 0) / notas.length) * 10) / 10
      }),
      f.constancia ? 'Sí' : 'No',
      f.constancia?.folio || '',
      f.constancia ? new Date(f.constancia.fecha_emision).toLocaleDateString('es-MX') : '',
    ])
    const fecha = new Date().toISOString().slice(0, 10)
    const gen = filtroGen === 'todas' ? '' :
      '-' + (generaciones.find(g => String(g.id) === String(filtroGen))?.nombre || 'sin-generacion')
        .replace(/[^w-]/g, '')
    descargar(`avance${gen}-${fecha}.csv`, aCSV(cabeceras, cuerpo))
  }

  const sinEmpezar = visibles.filter(f => f.hechos === 0).length
  const terminados = visibles.filter(f => totalRecursos && f.hechos >= totalRecursos).length
  const promedio = visibles.length
    ? Math.round(visibles.reduce((s, f) => s + pct(f), 0) / visibles.length)
    : 0

  if (cargando) return <p className="nota">Cargando el avance del grupo…</p>
  if (error) return <p className="aviso-error">No se pudo cargar: {error}</p>
  if (!filas.length) return <p className="nota">Todavía no hay nadie inscrito en este curso.</p>

  return (
    <div className="progreso-panel">
      <div className="progreso-resumen">
        <div><strong>{visibles.length}</strong><span>inscritos</span></div>
        <div><strong>{promedio}%</strong><span>avance medio</span></div>
        <div><strong>{sinEmpezar}</strong><span>sin empezar</span></div>
        <div><strong>{terminados}</strong><span>completaron</span></div>
        {tareas.length > 0 && (
          <div className={porCalificar ? 'progreso-pendiente' : ''}>
            <strong>{porCalificar}</strong><span>por calificar</span>
          </div>
        )}
        <div><strong>{visibles.filter(f => f.constancia).length}</strong><span>constancias</span></div>
      </div>

      <div className="progreso-acciones">
        <button type="button" className="button secondary" onClick={exportar}>
          ⬇️ Exportar a Excel
        </button>
      </div>
      {generaciones.length > 0 && (
        <div className="progreso-orden">
          <label>Generación</label>
          <select className="input" value={filtroGen}
                  onChange={e => setFiltroGen(e.target.value)}>
            <option value="todas">Todas</option>
            {generaciones.map(g => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
            <option value="">Sin generación asignada</option>
          </select>
        </div>
      )}
      <div className="progreso-orden">
        <label>Ordenar por</label>
        <select className="input" value={orden} onChange={e => setOrden(e.target.value)}>
          <option value="avance">Menor avance primero</option>
          <option value="inactivo">Hace más que no entran</option>
          <option value="nombre">Nombre</option>
        </select>
      </div>

      <div className="progreso-tabla-scroll">
        <table className="progreso-tabla">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Avance</th>
              <th>Última actividad</th>
              <th className="progreso-col-nota">
                Calificación
                <span className="celda-sub">
                  {tienePonderacion(ponderacion) ? 'ponderada' : 'promedio simple'}
                </span>
              </th>
              {examenes.map(e => <th key={e.id}>{e.titulo}</th>)}
              {tareas.map(t => <th key={`t${t.id}`}>📥 {t.titulo}</th>)}
              {foros.map(h => <th key={`f${h.id}`}>💬 {h.titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(f => {
              const p = pct(f)
              return (
                <tr key={f.id}>
                  <td>{f.nombre}</td>
                  <td>
                    <div className="progreso-barra" title={`${f.hechos} de ${totalRecursos}`}>
                      <span style={{ width: `${p}%` }} />
                    </div>
                    <span className="celda-sub">{p}% · {f.hechos}/{totalRecursos}</span>
                  </td>
                  <td className={!f.ultimo ? 'progreso-nunca' : ''}>{cuando(f.ultimo)}</td>

                  {/* Un guion y no un cero cuando no hay nada calificado:
                      a mitad de curso un 0 asusta sin significar nada. */}
                  <td className="progreso-col-nota">
                    {(() => {
                      const nota = notaDe(f)
                      if (!nota) return <span className="sutil">—</span>
                      const clase = nota.aprobado === false ? 'badge no-aprobado' : 'badge ok'
                      return (
                        <>
                          <span className={clase}>{nota.valor}</span>
                          <span className="celda-sub">
                            {nota.de} calificación(es)
                          </span>
                        </>
                      )
                    })()}
                  </td>

                  {examenes.map(e => {
                    const it = f.mejor[e.id]
                    return (
                      <td key={e.id}>
                        {!it ? <span className="sutil">—</span> : (
                          <span className={it.aprobado ? 'badge ok' : 'badge no-aprobado'}>
                            {it.calificacion ?? '?'}
                          </span>
                        )}
                      </td>
                    )
                  })}

                  {/* Tres estados distintos y no dos: "no entregó" y
                      "entregó y está sin calificar" piden cosas opuestas
                      (escribirle a él, o sentarte tú a calificar). */}
                  {tareas.map(t => {
                    const en = f.entregas[t.id]
                    return (
                      <td key={`t${t.id}`}>
                        {!en ? <span className="sutil">—</span>
                          : !en.calificado_en
                            ? <span className="badge rol-alumno">Por calificar</span>
                            : <span className="badge ok">{en.calificacion}</span>}
                      </td>
                    )
                  })}

                  {foros.map(h => {
                    const notas = f.foro[h.id] || []
                    if (!notas.length) return <td key={`f${h.id}`}><span className="sutil">—</span></td>
                    const media = Math.round(
                      (notas.reduce((s2, v) => s2 + v, 0) / notas.length) * 10) / 10
                    return (
                      <td key={`f${h.id}`}>
                        <span className="badge ok">{media}</span>
                        <span className="celda-sub">de {h.puntos_max || 10}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!totalRecursos && (
        <p className="nota">
          Este curso todavía no tiene recursos, así que el avance no se puede
          calcular. Agrega material a sus módulos y aparecerá aquí.
        </p>
      )}
    </div>
  )
}
