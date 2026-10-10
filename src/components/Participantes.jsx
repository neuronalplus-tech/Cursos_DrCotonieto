/* ============================================================
   PARTICIPANTES DEL CURSO  (estilo Moodle)
   ------------------------------------------------------------
   Quien gestiona un curso necesita ver a su gente: quién está
   inscrito, cómo se llama, a qué se dedica y cuándo entró por
   última vez. Moodle lo llama "Participantes" y vive dentro del
   curso, no en un panel aparte, así que aquí es igual: se abre
   desde el propio curso.

   Lo que se ve lo decide RLS (ROLES_4_ALUMNOS.sql): el admin ve
   todo y el facilitador solo a los inscritos de sus cursos. No
   hace falta pedir más permisos en el front; si la base no deja
   leer un perfil, simplemente no aparece.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcular } from '../lib/calificacion'
import { mejorCalificacion } from '../lib/examenes'

// Repetido a propósito (también está en ForoCurso/Header): son tres
// líneas y compartirlo obligaría a un import cruzado entre pantallas
// que no tienen otra relación.
function iniciales(nombre) {
  const p = String(nombre || '?').trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
}

function cuando(fecha) {
  if (!fecha) return 'Nunca ha entrado'
  const d = new Date(fecha)
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Avatar({ url, nombre, grande }) {
  const clase = `part-avatar${grande ? ' part-avatar-grande' : ''}`
  if (url) return <img className={clase} src={url} alt="" />
  return <span className={`${clase} part-avatar-inicial`} aria-hidden="true">{iniciales(nombre)}</span>
}

/* ---------------------------------------------------------------
   CALIFICACIONES DEL PARTICIPANTE (para la ficha individual)
   --------------------------------------------------------------- */
function PerfilCalificaciones({ notasExamen = {}, calificacionesTarea = {}, cursoConfig = null, enComun = [] }) {
  const examenes = Object.entries(notasExamen)
  const tareas = Object.entries(calificacionesTarea)
  const final = calcular(
    {
      examenes: examenes.map(([id, it]) => ({
        id,
        titulo: enComun.find(c => c.id === Number(id))?.titulo || `Examen ${id}`,
        moduloId: null,
        valor: it?.calificacion ?? null,
        maximo: 100,
        incluida: true,
      })),
      tareas: tareas.map(([id, en]) => ({
        id,
        titulo: enComun.find(c => c.id === Number(id))?.titulo || `Tarea ${id}`,
        moduloId: null,
        valor: en?.calificacion ?? null,
        maximo: en?.puntos_max ?? 100,
      })),
      foro: [],
      avance: { hechos: 0, total: 0 },
    },
    cursoConfig || {}
  )

  const tieneCalif = examenes.length > 0 || tareas.length > 0 || cursoConfig?.ponderacion

  if (!tieneCalif) return null

  return (
    <div className="part-calificaciones">
      <div className="part-calif-header">
        <h3>📊 Calificaciones</h3>
        <span className="sutil" style={{ fontSize: 12 }}>
          Nota del curso: {final?.equivalente10 != null ? `${final.equivalente10} / 10` : '—'}
        </span>
      </div>

      {examenes.map(([examenId, it]) => (
        <div className="part-calif-item" key={examenId}>
          <div className="part-calif-row">
            <span className="part-calif-label">Examen</span>
            <span className="part-calif-field">{enComun.find(c => c.id === Number(examenId))?.titulo || `Examen ${examenId}`}</span>
            <span className="part-calif-valor">
              {it?.calificacion != null ? it.calificacion : 'Sin calificar'}
            </span>
            {it?.aprobado === true && <span className="part-calif-aprobado">✅ Aprobado</span>}
            {it?.aprobado === false && <span className="part-calif-desaprobado">❌ Reprobado</span>}
          </div>
        </div>
      ))}

      {tareas.map(([tareaId, en]) => (
        <div className="part-calif-item" key={tareaId}>
          <div className="part-calif-row">
            <span className="part-calif-label">Tarea</span>
            <span className="part-calif-field">{enComun.find(c => c.id === Number(tareaId))?.titulo || `Tarea ${tareaId}`}</span>
            <span className="part-calif-valor">
              {en?.calificacion != null ? en.calificacion : 'Sin calificar'}
            </span>
          </div>
        </div>
      ))}

      {final?.equivalente10 != null && (
        <div className="part-calif-final">
          <div className="part-calif-final-row">
            <div className="part-calif-final-evalue">
              <span className="sutil">Nota acumulada /10</span>
              <span className="part-calif-final-valor">{final.equivalente10}</span>
            </div>
            <div className="part-calif-final-texto">
              {final.aprobado ? '✅ Aprobado' : '❌ Reprobado'} · {final.evaluadas} actividades calificadas
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
  const [personas, setPersonas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null) // perfil desplegado
  const [tituloCurso, setTituloCurso] = useState({}) // curso_id -> título
  const [misCursos, setMisCursos] = useState(new Set()) // para "cursos en común"
  const [notasExamen, setNotasExamen] = useState({}) // examen_id -> mejor calificación
  const [calificacionesTarea, setCalificacionesTarea] = useState({}) // tarea_id -> calificacion
  const [cursosPorConfig, setCursosPorConfig] = useState({}) // curso_id -> ponderación
  const [enComun, setEnComun] = useState({}) // curso_id -> título para el perfil


  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true); setError(null); setAbierto(null)
      try {
        const curso = Number(cursoId)

        // --- Mis cursos, para calcular "en común" ---
        const { data: miAcc } = await supabase.from('acceso')
          .select('curso_id').eq('usuario_id', user.id)
        if (vivo) setMisCursos(new Set((miAcc || []).map(a => a.curso_id)))

        // --- Quién está inscrito en ESTE curso ---
        const { data: insc, error: eA } = await supabase
          .from('acceso').select('usuario_id, grupo, created_at').eq('curso_id', curso)
        if (eA) throw eA
        const ids = [...new Set((insc || []).map(a => a.usuario_id))]
        if (!ids.length) { if (vivo) { setPersonas([]); setCargando(false) } ; return }

        // --- Sus perfiles (RLS decide cuáles puedo ver) ---
        const { data: perfs, error: eP } = await supabase
          .from('perfiles')
          .select('id, nombre_completo, profesion, descripcion, ubicacion, avatar_url')
          .in('id', ids)
        if (eP) throw eP

        // --- Cursos y su ponderación para la calificación ---
        const { data: cs } = await supabase
          .from('cursos')
          .select('id, titulo, ponderacion')
          .in('id', idsCursoAjenos)
        if (vivo) {
          setTituloCurso(Object.fromEntries((cs || []).map(c => [c.id, c.titulo])))
          setCursosPorConfig(Object.fromEntries((cs || []).map(c => [c.id, c.ponderacion])))
        }

        // --- Última vez que entraron a un recurso del curso ---
        const { data: mods } = await supabase
          .from('modulos').select('id').eq('curso_id', curso).eq('activo', true)
        const idsMod = (mods || []).map(m => m.id)
        const { data: recs } = idsMod.length
          ? await supabase.from('recursos').select('id').in('modulo_id', idsMod)
          : { data: [] }
        const idsRec = (recs || []).map(r => r.id)
        const { data: prog } = idsRec.length
          ? await supabase.from('progreso_usuario')
              .select('usuario_id, ultimo_acceso').in('recurso_id', idsRec)
          : { data: [] }
        const ultimo = {}
        for (const p of prog || []) {
          if (!ultimo[p.usuario_id] || p.ultimo_acceso > ultimo[p.usuario_id]) {
            ultimo[p.usuario_id] = p.ultimo_acceso
          }
        }

        // --- Calificaciones: exámenes (la MEJOR nota) ---
        const { data: exs } = await supabase
          .from('examenes')
          .select('id, titulo, curso_id, modulo_id, activo')
          .eq('curso_id', curso)
        const idsEx = (exs || []).map(e => e.id)
        const { data: intentosEx } = idsEx.length
          ? await supabase
              .from('intentos_examen')
              .select('examen_id, calificacion, aprobado')
              .in('examen_id', idsEx)
          : { data: [] }
        const notasEx = {}
        for (const it of intentosEx || []) {
          if (!notasEx[it.examen_id]) notasEx[it.examen_id] = it
          else if ((it.calificacion ?? 0) > (notasEx[it.examen_id].calificacion ?? 0)) {
            notasEx[it.examen_id] = it
          }
        }
        setNotasExamen(notasEx)

        // --- Calificaciones: tareas (la última calificación válida) ---
        const { data: ts } = await supabase
          .from('tareas')
          .select('id, titulo, curso_id, modulo_id, activo, puntos_max')
          .eq('curso_id', curso)
        const idsT = (ts || []).map(t => t.id)
        const { data: entregas } = idsT.length
          ? await supabase
              .from('entregas')
              .select('tarea_id, calificacion, calificado_en')
              .in('tarea_id', idsT)
          : { data: [] }
        const notasT = {}
        for (const en of entregas || []) {
          if (!notasT[en.tarea_id]) notasT[en.tarea_id] = en
          else if (en.calificado_en && (!notasT[en.tarea_id].calificado_en || en.calificado_en > notasT[en.tarea_id].calificado_en)) {
            notasT[en.tarea_id] = en
          }
        }
        setCalificacionesTarea(notasT)

        // --- Todos sus accesos, para "cursos en común" ---
        const { data: todosAcc } = await supabase
          .from('acceso').select('usuario_id, curso_id').in('usuario_id', ids)
        const cursosDe = {}
        for (const a of todosAcc || []) (cursosDe[a.usuario_id] ||= new Set()).add(a.curso_id)
        const idsCursoAjenos = [...new Set((todosAcc || []).map(a => a.curso_id))]
        if (idsCursoAjenos.length) {
          const { data: cs } = await supabase.from('cursos')
            .select('id, titulo').in('id', idsCursoAjenos)
          if (vivo) {
            setTituloCurso(Object.fromEntries((cs || []).map(c => [c.id, c.titulo])))
            setEnComun(prev => {
              const next = { ...prev }
              for (const id of ids) {
                const pCursos = cursosDe[id] || new Set()
                next[id] = [...pCursos].filter(c => misCursos.has(c)).map(c => tituloCurso[c] || `Curso ${c}`)
              }
              return next
            })
          }
        }

        const grupoDe = Object.fromEntries((insc || []).map(a => [a.usuario_id, a.grupo]))
        const inscritoEl = Object.fromEntries((insc || []).map(a => [a.usuario_id, a.created_at]))

        const lista = (perfs || []).map(p => ({
          id: p.id,
          nombre: p.nombre_completo || 'Sin nombre',
          profesion: p.profesion || '',
          descripcion: p.descripcion || '',
          ubicacion: p.ubicacion || '',
          avatar: p.avatar_url || '',
          grupo: grupoDe[p.id] || '',
          inscritoEl: inscritoEl[p.id] || null,
          ultimo: ultimo[p.id] || null,
          cursos: [...(cursosDe[p.id] || [])].map(c => ({ id: c, titulo: tituloCurso[c] || `Curso ${c}` })),
          notasExamen,
          calificacionesTarea,
          cursoConfig: cursosPorConfig[p.id] || null,
          enComun: enComun[p.id] || [],
        }))
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        if (vivo) { setPersonas(lista); setCargando(false) }
      } catch (e) {
        if (vivo) { setError(e.message || 'No se pudieron cargar los participantes.'); setCargando(false) }
      }
    })()
    return () => { vivo = false }
  }, [cursoId, user.id])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return personas
    return personas.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.profesion.toLowerCase().includes(q) ||
      p.ubicacion.toLowerCase().includes(q))
  }, [personas, busqueda])

  if (cargando) return <p className="sutil">Cargando participantes…</p>
  if (error) return <p className="aviso-error">{error}</p>

  // --- Ficha de una persona (vista tipo perfil de Moodle) ---
  if (abierto) {
    const p = abierto
    // `cursos` es ahora [{id, titulo}], filtrar por los que el usuario
    // gestiona también (admin/facilitador).
    const enComun = p.cursos.filter(c => misCursos.has(c.id))
    return (
      <div className="part-perfil">
        <button type="button" className="button texto" onClick={() => setAbierto(null)}>
          ← Volver a la lista
        </button>
        <div className="part-perfil-cab">
          <Avatar url={p.avatar} nombre={p.nombre} grande />
          <div>
            <h3 style={{ margin: '0 0 2px' }}>{p.nombre}</h3>
            {p.profesion && <p className="sutil" style={{ margin: 0 }}>{p.profesion}</p>}
            {p.ubicacion && <p className="sutil" style={{ margin: '2px 0 0' }}>📍 {p.ubicacion}</p>}
            {p.grupo && <span className="etiqueta-grupo" style={{ marginTop: 8, display: 'inline-block' }}>{p.grupo}</span>}
          </div>
        </div>

        {p.descripcion && (
          <div className="part-perfil-bloque">
            <strong>Sobre mí</strong>
            <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{p.descripcion}</p>
          </div>
        )}

        <div className="part-perfil-bloque">
          <strong>Actividad</strong>
          <p className="sutil" style={{ margin: '4px 0 0' }}>
            Última vez en el curso: {cuando(p.ultimo)}
            {p.inscritoEl && <> · Inscrito el {new Date(p.inscritoEl).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
          </p>
        </div>

        {/* Calificaciones del curso actual */}
        <PerfilCalificaciones
          notasExamen={p.notasExamen}
          calificacionesTarea={p.calificacionesTarea}
          cursoConfig={p.cursoConfig}
          enComun={enComun}
        />

        {enComun.length > 0 && (
          <div className="part-perfil-bloque">
            <strong>Cursos que compartimos ({enComun.length})</strong>
            <ul className="lista-cursos" style={{ marginTop: 6 }}>
              {enComun.map(c => <li key={c.id}>{c.titulo || `Curso ${c.id}`}</li>)}
            </ul>
          </div>
        )}

        <div className="part-perfil-acciones">
          <Link className="button secondary" to="/mensajes">✉️ Enviar mensaje</Link>
        </div>
        <p className="nota">
          El perfil lo escribe cada persona. Solo ves a quienes comparten un curso contigo.
        </p>
      </div>
    )
  }

  // --- Lista de participantes ---
  return (
    <div className="participantes">
      <p className="nota" style={{ marginTop: 0 }}>
        {personas.length} {personas.length === 1 ? 'persona inscrita' : 'personas inscritas'} en este curso.
      </p>

      {personas.length > 3 && (
        <input
          type="search"
          className="part-buscador"
          placeholder="Buscar por nombre, profesión o lugar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      )}

      {filtrados.length === 0 ? (
        <p className="sutil">Nadie coincide con “{busqueda}”.</p>
      ) : (
        <ul className="part-lista">
          {filtrados.map(p => (
            <li key={p.id}>
              <button type="button" className="part-tarjeta" onClick={() => setAbierto(p)}>
                <Avatar url={p.avatar} nombre={p.nombre} />
                <span className="part-tarjeta-info">
                  <strong>{p.nombre}</strong>
                  <span className="sutil">
                    {[p.profesion, p.ubicacion].filter(Boolean).join(' · ') || 'Sin datos todavía'}
                  </span>
                  <span className="sutil part-tarjeta-cuando">{cuando(p.ultimo)}</span>
                </span>
                <span className="part-tarjeta-flecha" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

