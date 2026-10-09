/* ============================================================
   PASE DE LISTA
   ------------------------------------------------------------
   Pensado para usarse de pie, en el salón, con una mano y sin
   sentarse. De ahí casi todas las decisiones de esta pantalla:

   · TODOS ARRANCAN EN «PRESENTE». En una clase normal falta poca
     gente; marcar a los veinte presentes para señalar dos ausencias
     es trabajo inverso. Se marcan las excepciones.

   · SE GUARDA SOLO AL FINAL, de una vez. Guardar en cada toque
     significa veinte peticiones con la señal del salón, y una que
     falle deja la lista a medias sin que nadie lo note.

   · UN SOLO TOQUE CAMBIA DE ESTADO, ciclando entre los cuatro. Un
     desplegable por alumno es imposible de usar de pie.

   Si el grupo no es presencial ni mixto, esta pantalla no aparece:
   un pase de lista vacío en un curso en línea solo estorba.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ESTADOS, ETIQUETA_ESTADO, resumen, tonoAsistencia,
  fechaSesion, horaCorta, porRiesgo, llevaAsistencia,
} from '../lib/asistencia'

const SIGUIENTE = { presente: 'ausente', ausente: 'retardo', retardo: 'permiso', permiso: 'presente' }
const SIMBOLO = Object.fromEntries(ESTADOS.map(([k, , s]) => [k, s]))

export default function PaseDeLista({ generacion, cursoId }) {
  const [sesiones, setSesiones] = useState([])
  const [modulos, setModulos] = useState([])
  const [alumnos, setAlumnos] = useState([])
  const [marcasPorSesion, setMarcasPorSesion] = useState({})
  const [sesionAbierta, setSesionAbierta] = useState(null)
  const [borrador, setBorrador] = useState({})       // usuario_id -> estado
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [nueva, setNueva] = useState(null)

  const cargar = async () => {
    setCargando(true)
    const [{ data: ses }, { data: mods }, { data: acc }] = await Promise.all([
      supabase.from('sesiones').select('*')
        .eq('generacion_id', generacion.id).order('fecha', { ascending: false }),
      supabase.from('modulos').select('id, titulo').eq('curso_id', cursoId).order('orden'),
      supabase.from('acceso').select('usuario_id').eq('generacion_id', generacion.id),
    ])
    const ids = [...new Set((acc || []).map(a => a.usuario_id))]
    const { data: perfs } = ids.length
      ? await supabase.from('perfiles').select('id, nombre_completo').in('id', ids)
      : { data: [] }

    const idsSesion = (ses || []).map(s => s.id)
    const { data: marcas } = idsSesion.length
      ? await supabase.from('asistencia').select('*').in('sesion_id', idsSesion)
      : { data: [] }

    const porSesion = {}
    for (const m of marcas || []) {
      (porSesion[m.sesion_id] ||= {})[m.usuario_id] = m
    }

    setSesiones(ses || [])
    setModulos(mods || [])
    setAlumnos((perfs || []).sort((a, b) =>
      String(a.nombre_completo || '').localeCompare(String(b.nombre_completo || ''), 'es')))
    setMarcasPorSesion(porSesion)
    setCargando(false)
  }

  useEffect(() => {
    if (!generacion?.id) { setCargando(false); return }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generacion?.id, cursoId])

  const sesionesValidas = useMemo(
    () => sesiones.filter(s => !s.cancelada), [sesiones])

  // El resumen del grupo: quién va peor, que es lo que se mira.
  const resumenPorAlumno = useMemo(() => {
    const total = sesionesValidas.length
    return porRiesgo(alumnos.map(a => {
      const marcas = sesionesValidas
        .map(s => marcasPorSesion[s.id]?.[a.id])
        .filter(Boolean)
      return { ...a, ...resumen(marcas, total) }
    }))
  }, [alumnos, sesionesValidas, marcasPorSesion])

  const abrir = (sesion) => {
    const previas = marcasPorSesion[sesion.id] || {}
    const b = {}
    // Quien no tenga marca arranca presente: se marcan las excepciones.
    for (const a of alumnos) b[a.id] = previas[a.id]?.estado || 'presente'
    setBorrador(b)
    setSesionAbierta(sesion)
    setMsg(null)
  }

  const alternar = (usuarioId) =>
    setBorrador(b => ({ ...b, [usuarioId]: SIGUIENTE[b[usuarioId] || 'presente'] }))

  const todos = (estado) =>
    setBorrador(Object.fromEntries(alumnos.map(a => [a.id, estado])))

  const guardar = async () => {
    setGuardando(true)
    const { data: u } = await supabase.auth.getUser()
    const filas = alumnos.map(a => ({
      sesion_id: sesionAbierta.id,
      usuario_id: a.id,
      estado: borrador[a.id] || 'presente',
      registrado_por: u?.user?.email?.toLowerCase() || null,
      registrado_en: new Date().toISOString(),
    }))
    // Un índice único por sesión y persona hace que repetir el pase de
    // lista corrija en vez de duplicar.
    const { error } = await supabase.from('asistencia')
      .upsert(filas, { onConflict: 'sesion_id,usuario_id' })
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
    setSesionAbierta(null)
    await cargar()
    setMsg({ tipo: 'ok', texto: `Lista guardada: ${filas.length} alumno(s).` })
  }

  const crearSesion = async () => {
    if (!nueva?.fecha) return setMsg({ tipo: 'error', texto: 'Falta la fecha.' })
    const { error } = await supabase.from('sesiones').insert({
      generacion_id: generacion.id,
      modulo_id: nueva.modulo_id ? Number(nueva.modulo_id) : null,
      titulo: nueva.titulo?.trim() || null,
      fecha: nueva.fecha,
      hora_inicio: nueva.hora_inicio || null,
      hora_fin: nueva.hora_fin || null,
      lugar: nueva.lugar?.trim() || null,
    })
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo crear: ' + error.message })
    setNueva(null)
    await cargar()
    setMsg({ tipo: 'ok', texto: 'Sesión creada.' })
  }

  const cancelarSesion = async (s) => {
    const { error } = await supabase.from('sesiones')
      .update({ cancelada: !s.cancelada }).eq('id', s.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    await cargar()
  }

  if (!llevaAsistencia(generacion?.modalidad)) {
    return (
      <p className="nota">
        Este grupo está marcado como <strong>en línea</strong>, así que no lleva
        pase de lista. Si tiene sesiones en vivo, cambia su modalidad a
        «mixta» al editar el grupo.
      </p>
    )
  }

  if (cargando) return <p className="nota">Cargando…</p>

  return (
    <div className="pase-lista">
      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {/* ---------- Pasar lista de una sesión ---------- */}
      {sesionAbierta ? (
        <div className="pase-activo">
          <div className="pase-cab">
            <div>
              <h4>{sesionAbierta.titulo || 'Sesión'}</h4>
              <span className="celda-sub">
                {fechaSesion(sesionAbierta.fecha)}
                {sesionAbierta.hora_inicio ? ` · ${horaCorta(sesionAbierta.hora_inicio)}` : ''}
              </span>
            </div>
            <button type="button" className="button texto"
                    onClick={() => setSesionAbierta(null)}>Cancelar</button>
          </div>

          <p className="nota">
            Todos arrancan en <strong>presente</strong>: toca solo a quien falte.
            Cada toque cambia de estado.
          </p>
          <div className="pase-atajos">
            {ESTADOS.map(([k, t]) => (
              <button key={k} type="button" className="button texto"
                      onClick={() => todos(k)}>Todos {t.toLowerCase()}</button>
            ))}
          </div>

          <ul className="pase-alumnos">
            {alumnos.map(a => {
              const estado = borrador[a.id] || 'presente'
              return (
                <li key={a.id}>
                  <button type="button" className={`pase-alumno estado-${estado}`}
                          onClick={() => alternar(a.id)}>
                    <span className="pase-simbolo">{SIMBOLO[estado]}</span>
                    <span className="pase-nombre">{a.nombre_completo || '(sin nombre)'}</span>
                    <span className="pase-estado">{ETIQUETA_ESTADO[estado]}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {!alumnos.length && (
            <p className="nota">
              Este grupo no tiene alumnos inscritos. Asígnalos desde Inscripciones.
            </p>
          )}

          <div className="modal-botones" style={{ marginTop: 14 }}>
            <button type="button" className="button primary"
                    onClick={guardar} disabled={guardando || !alumnos.length}>
              {guardando ? 'Guardando…' : `Guardar lista (${alumnos.length})`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ---------- Sesiones ---------- */}
          <div className="pase-encabezado">
            <h4>Sesiones ({sesionesValidas.length})</h4>
            <button type="button" className="button secondary"
                    onClick={() => setNueva({ fecha: new Date().toISOString().slice(0, 10) })}>
              ➕ Nueva sesión
            </button>
          </div>

          {nueva && (
            <div className="sesion-alta">
              <div>
                <label>Fecha</label>
                <input className="input" type="date" value={nueva.fecha || ''}
                       onChange={e => setNueva({ ...nueva, fecha: e.target.value })} />
              </div>
              <div>
                <label>Módulo</label>
                <select className="input" value={nueva.modulo_id || ''}
                        onChange={e => setNueva({ ...nueva, modulo_id: e.target.value })}>
                  <option value="">Sin módulo</option>
                  {modulos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                </select>
              </div>
              <div>
                <label>Tema (opcional)</label>
                <input className="input" value={nueva.titulo || ''}
                       onChange={e => setNueva({ ...nueva, titulo: e.target.value })} />
              </div>
              <div>
                <label>Hora</label>
                <input className="input" type="time" value={nueva.hora_inicio || ''}
                       onChange={e => setNueva({ ...nueva, hora_inicio: e.target.value })} />
              </div>
              <div className="sesion-alta-botones">
                <button type="button" className="button texto"
                        onClick={() => setNueva(null)}>Cancelar</button>
                <button type="button" className="button primary" onClick={crearSesion}>
                  Crear
                </button>
              </div>
            </div>
          )}

          {!sesiones.length ? (
            <p className="nota">
              Todavía no hay sesiones. Crea la primera y podrás pasar lista.
            </p>
          ) : (
            <ul className="sesion-lista">
              {sesiones.map(s => {
                const marcadas = Object.keys(marcasPorSesion[s.id] || {}).length
                return (
                  <li key={s.id} className={s.cancelada ? 'cancelada' : ''}>
                    <div className="sesion-datos">
                      <strong>{s.titulo || fechaSesion(s.fecha)}</strong>
                      <span className="celda-sub">
                        {fechaSesion(s.fecha)}
                        {s.hora_inicio ? ` · ${horaCorta(s.hora_inicio)}` : ''}
                        {s.cancelada ? ' · cancelada' : ''}
                      </span>
                    </div>
                    {/* «Sin pasar» y «0 presentes» no son lo mismo, y
                        confundirlos acusa a un grupo entero de faltar. */}
                    <span className="celda-sub">
                      {marcadas ? `${marcadas} registrada(s)` : 'Sin pasar'}
                    </span>
                    <button type="button" className="button texto"
                            onClick={() => cancelarSesion(s)}>
                      {s.cancelada ? 'Reactivar' : 'Cancelar'}
                    </button>
                    {!s.cancelada && (
                      <button type="button" className="button secondary"
                              onClick={() => abrir(s)}>
                        {marcadas ? 'Revisar' : 'Pasar lista'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* ---------- Cómo va cada quien ---------- */}
          {sesionesValidas.length > 0 && alumnos.length > 0 && (
            <>
              <h4 style={{ marginTop: 24 }}>Asistencia del grupo</h4>
              <div className="gestion-tabla-scroll">
                <table className="gestion-tabla">
                  <thead>
                    <tr>
                      <th>Alumno</th><th>Asistencia</th><th>Presente</th>
                      <th>Retardos</th><th>Faltas</th><th>Sin pasar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorAlumno.map(a => (
                      <tr key={a.id}>
                        <td>{a.nombre_completo || '(sin nombre)'}</td>
                        <td>
                          <span className={`badge plazo-${tonoAsistencia(a.porcentaje)}`}>
                            {a.porcentaje == null ? '—' : `${a.porcentaje}%`}
                          </span>
                        </td>
                        <td>{a.presentes}</td>
                        <td>{a.retardos || <span className="sutil">—</span>}</td>
                        <td>{a.ausencias || <span className="sutil">—</span>}</td>
                        <td>{a.sinRegistro || <span className="sutil">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota">
                Un <strong>retardo cuenta como asistencia</strong>; si no, el
                porcentaje castigaría igual a quien llegó tarde que a quien no
                vino. «Sin pasar» son sesiones donde no se registró a nadie: no
                son faltas de esa persona.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
