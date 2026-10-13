/* ============================================================
   MIS CURSOS — el «aula» del alumno
   ------------------------------------------------------------
   Antes el alumno no tenía un punto de partida: su lista de cursos
   vivía escondida en el menú de su foto de perfil, y solo mostraba
   lo que había en `acceso`. Esta pantalla es ese punto de partida.

   Incluye, además de los cursos inscritos, los talleres GRATUITOS
   con los que ya interactuó (tiene constancia): así el autoinscrito
   ve su taller aunque no tenga fila en `acceso`, que es el hueco que
   más alumnos perdía. Todo es de solo lectura: no inscribe a nadie.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rutaAcceso } from '../config'
import { emiteConstancia } from '../lib/helpers'
import { Breadcrumb } from './ui'

function MisCursos({ user }) {
  const navigate = useNavigate()
  const [cursos, setCursos] = useState([])
  const [asistencia, setAsistencia] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/mis-cursos')); return }
    let vivo = true
    ;(async () => {
      try {
        // Inscripción formal (`acceso`) + talleres gratuitos con constancia
        // propia. Las constancias las puede leer su dueño, así que esto
        // funciona para el autoinscrito sin tocar RLS ni inscribir nada.
        const [{ data: acc }, { data: cons }] = await Promise.all([
          supabase.from('acceso').select('curso_id').eq('usuario_id', user.id),
          supabase.from('constancias').select('curso_id').eq('usuario_id', user.id),
        ])
        const ids = [...new Set([
          ...(acc || []).map(a => a.curso_id),
          ...(cons || []).map(c => c.curso_id),
        ])].filter(x => x != null)

        if (!ids.length) { if (vivo) { setCursos([]); setCargando(false) } return }

        const { data: cs } = await supabase.from('cursos')
          .select('id, titulo, descripcion, gratuito, constancia, constancia_gratuita_activa')
          .in('id', ids).eq('activo', true).order('orden')

        // Avance por curso en una sola pasada (nada de una consulta por
        // módulo): módulos -> recursos -> progreso completado.
        const { data: mods } = await supabase.from('modulos')
          .select('id, curso_id').in('curso_id', ids).eq('activo', true)
        const cursoDeMod = Object.fromEntries((mods || []).map(m => [m.id, m.curso_id]))
        const idsMod = (mods || []).map(m => m.id)

        const { data: recs } = idsMod.length
          ? await supabase.from('recursos').select('id, modulo_id').in('modulo_id', idsMod)
          : { data: [] }
        const cursoDeRec = {}
        for (const r of recs || []) {
          const cid = cursoDeMod[r.modulo_id]
          if (cid != null) cursoDeRec[r.id] = cid
        }
        const idsRec = (recs || []).map(r => r.id)

        const { data: prog } = idsRec.length
          ? await supabase.from('progreso_usuario').select('recurso_id')
              .eq('usuario_id', user.id).in('recurso_id', idsRec).eq('completado', true)
          : { data: [] }

        const total = {}; const hechos = {}
        for (const r of recs || []) {
          const cid = cursoDeRec[r.id]; if (cid != null) total[cid] = (total[cid] || 0) + 1
        }
        for (const p of prog || []) {
          const cid = cursoDeRec[p.recurso_id]; if (cid != null) hechos[cid] = (hechos[cid] || 0) + 1
        }

        const lista = (cs || []).map(c => {
          const t = total[c.id] || 0; const h = hechos[c.id] || 0
          return { ...c, pct: t > 0 ? Math.round((h / t) * 100) : null, total: t, hechos: h }
        })
        if (vivo) { setCursos(lista); setCargando(false) }

        // Asistencia por curso (ASISTENCIA_ALUMNO.sql). Va aparte y no
        // bloquea el pintado: si la RPC no existe aún, se ignora. Solo se
        // mostrará en los cursos que tengan sesiones.
        const asis = await Promise.all(lista.map(c =>
          supabase.rpc('mi_asistencia', { p_curso: c.id })
            .then(({ data, error }) => ({ id: c.id, fila: error ? null : (data?.[0] || null) }))
        ))
        if (vivo) {
          const mapa = {}
          for (const a of asis) if (a.fila && a.fila.sesiones > 0) mapa[a.id] = a.fila
          setAsistencia(mapa)
        }
      } catch {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [user, navigate])

  if (!user) return null
  if (cargando) return <div className="loading">Cargando tus cursos…</div>

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mis cursos' }]} />
      <h1>Mis cursos</h1>

      {cursos.length === 0 ? (
        <p className="sutil" style={{ marginTop: 8 }}>
          Todavía no tienes cursos. Explora el <Link className="enlace-texto" to="/">catálogo</Link> o,
          si llegaste por un taller, abre el enlace que te compartieron para registrarte.
        </p>
      ) : (
        <div className="mis-cursos-grid">
          {cursos.map(c => (
            <article key={c.id} className="mis-curso-card">
              <div className="mis-curso-cuerpo">
                <h2 className="mis-curso-titulo">{c.titulo}</h2>
                {c.descripcion && <p className="sutil mis-curso-desc">{c.descripcion}</p>}

                {c.pct != null ? (
                  <div className="mis-curso-avance">
                    <div className="progreso-label"><span>Tu avance</span><span>{c.pct}%</span></div>
                    <div className="progreso-bar"><div className="progreso-lleno" style={{ width: `${c.pct}%` }} /></div>
                    <span className="sutil">{c.hechos} de {c.total} recursos</span>
                  </div>
                ) : (
                  <p className="sutil mis-curso-avance">Sin recursos con avance todavía.</p>
                )}

                {asistencia[c.id] && (
                  <p className="sutil" style={{ marginTop: 8 }}>
                    📅 Asistencia: {asistencia[c.id].presentes + asistencia[c.id].retardos}/{asistencia[c.id].sesiones} sesiones
                    {asistencia[c.id].porcentaje != null && ` · ${asistencia[c.id].porcentaje}%`}
                    {asistencia[c.id].justificadas > 0 && ` · ${asistencia[c.id].justificadas} justificada(s)`}
                  </p>
                )}
              </div>

              <div className="mis-curso-acciones">
                <Link className="button primary" to={`/curso/${c.id}`}>Continuar</Link>
                {emiteConstancia(c) && (
                  <Link className="button secondary" to={`/constancia/${c.id}`}>Constancia</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="nota" style={{ marginTop: 20 }}>
        ¿Buscas tus notas y lo que te falta por entregar?{' '}
        <Link className="enlace-texto" to="/mis-calificaciones">Ver mis calificaciones</Link>.
      </p>
    </section>
  )
}

export default MisCursos
