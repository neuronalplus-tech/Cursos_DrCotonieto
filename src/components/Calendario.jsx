/* ============================================================
   CALENDARIO
   ------------------------------------------------------------
   Lo que vence y cuándo: entregas con fecha límite y el cierre de
   las generaciones en curso.

   POR QUÉ UNA AGENDA Y NO UNA REJILLA MENSUAL
   La rejilla es bonita y responde mal a la única pregunta que se
   hace quien la abre: "¿qué tengo pendiente?". Obliga a buscar los
   días marcados uno por uno, y en un teléfono cada casilla cabe
   una palabra. Una lista ordenada por cercanía contesta eso de un
   vistazo, y además distingue lo vencido de lo que viene, que es
   lo que de verdad cambia la conducta.

   Lo ya entregado se tacha pero no se esconde: ver lo hecho es
   parte de saber cómo vas.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rutaAcceso } from '../config'
import { Breadcrumb, BandaRedes } from './ui'

const DIA = 86400000

function cuando(fechaISO) {
  const d = new Date(fechaISO)
  const dias = Math.ceil((d.getTime() - Date.now()) / DIA)
  if (dias < 0) return { texto: `Hace ${Math.abs(dias)} día(s)`, grupo: 'vencido' }
  if (dias === 0) return { texto: 'Hoy', grupo: 'urgente' }
  if (dias === 1) return { texto: 'Mañana', grupo: 'urgente' }
  if (dias <= 7) return { texto: `En ${dias} días`, grupo: 'semana' }
  return { texto: `En ${dias} días`, grupo: 'despues' }
}

const GRUPOS = [
  ['vencido', 'Vencido'],
  ['urgente', 'Hoy y mañana'],
  ['semana', 'Esta semana'],
  ['despues', 'Más adelante'],
]

export default function Calendario({ user }) {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/calendario')); return }
    let vivo = true
    ;(async () => {
      try {
        const { data: acc } = await supabase
          .from('acceso').select('curso_id').eq('usuario_id', user.id)
        const ids = [...new Set((acc || []).map(a => a.curso_id))]
        if (!ids.length) {
          if (vivo) { setEventos([]); setCargando(false) }
          return
        }

        const { data: cs } = await supabase
          .from('cursos').select('id, titulo').in('id', ids)
        const titulo = Object.fromEntries((cs || []).map(c => [c.id, c.titulo]))

        const { data: mods } = await supabase
          .from('modulos').select('id, curso_id').in('curso_id', ids)
        const idsMod = (mods || []).map(m => m.id)
        const cursoDeModulo = Object.fromEntries((mods || []).map(m => [m.id, m.curso_id]))

        // --- Entregas con fecha ---
        const { data: tareas } = await supabase
          .from('tareas')
          .select('id, titulo, fecha_limite, curso_id, modulo_id')
          .eq('activo', true).not('fecha_limite', 'is', null)
          .or(`curso_id.in.(${ids.join(',')})` +
              (idsMod.length ? `,modulo_id.in.(${idsMod.join(',')})` : ''))

        const { data: ents } = (tareas || []).length
          ? await supabase.from('entregas').select('tarea_id, calificado_en')
              .eq('usuario_id', user.id).in('tarea_id', tareas.map(t => t.id))
          : { data: [] }
        const entregado = new Set((ents || []).map(e => e.tarea_id))

        const deTareas = (tareas || []).map(t => {
          const curso = t.curso_id || cursoDeModulo[t.modulo_id]
          return {
            clave: `t${t.id}`,
            tipo: 'Entrega',
            titulo: t.titulo,
            curso, cursoTitulo: titulo[curso] || '',
            fecha: t.fecha_limite,
            hecho: entregado.has(t.id),
            enlace: t.modulo_id ? `/modulo/${t.modulo_id}` : `/curso/${curso}`,
          }
        })

        // --- Cierre de las generaciones en las que está ---
        const { data: accGen } = await supabase
          .from('acceso').select('generacion_id')
          .eq('usuario_id', user.id).not('generacion_id', 'is', null)
        const idsGen = [...new Set((accGen || []).map(a => a.generacion_id))]
        const { data: gens } = idsGen.length
          ? await supabase.from('generaciones')
              .select('id, nombre, fecha_fin, curso_id').in('id', idsGen)
              .not('fecha_fin', 'is', null)
          : { data: [] }

        const deGens = (gens || []).map(g => ({
          clave: `g${g.id}`,
          tipo: 'Cierre',
          titulo: `Termina ${g.nombre}`,
          curso: g.curso_id, cursoTitulo: titulo[g.curso_id] || '',
          fecha: g.fecha_fin,
          hecho: false,
          enlace: `/curso/${g.curso_id}`,
        }))

        if (vivo) {
          setEventos([...deTareas, ...deGens]
            .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))))
        }
      } catch (e) {
        if (vivo) setError(e.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [user, navigate])

  if (!user) return null

  // Lo vencido que ya se entregó no es una alarma: baja con lo demás.
  const porGrupo = {}
  for (const ev of eventos) {
    const c = cuando(ev.fecha)
    const g = ev.hecho && c.grupo === 'vencido' ? 'despues' : c.grupo
    if (!porGrupo[g]) porGrupo[g] = []
    porGrupo[g].push({ ...ev, cuando: c.texto })
  }

  return (
    <section className="contenedor">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Calendario' }]} />
      <h1>Calendario</h1>
      <p className="seccion-intro">
        Lo que tienes pendiente, ordenado por cercanía.
      </p>

      {cargando && <p className="nota">Cargando…</p>}
      {error && <p className="aviso-error">No se pudo cargar: {error}</p>}

      {!cargando && !error && !eventos.length && (
        <p className="nota">
          No tienes nada con fecha por ahora. Aquí aparecerán las entregas con
          fecha límite y el cierre de tus generaciones.
        </p>
      )}

      {GRUPOS.map(([clave, nombre]) => {
        const lista = porGrupo[clave]
        if (!lista?.length) return null
        return (
          <div key={clave} className={`cal-grupo cal-${clave}`}>
            <h2>{nombre}</h2>
            <ul className="cal-lista">
              {lista.map(ev => (
                <li key={ev.clave} className={ev.hecho ? 'hecho' : ''}>
                  <span className="cal-tipo">{ev.tipo}</span>
                  <div className="cal-datos">
                    <Link to={ev.enlace}>{ev.titulo}</Link>
                    <span className="celda-sub">{ev.cursoTitulo}</span>
                  </div>
                  <span className="cal-cuando">
                    {ev.hecho ? '✔ Entregado' : ev.cuando}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <BandaRedes />
    </section>
  )
}
