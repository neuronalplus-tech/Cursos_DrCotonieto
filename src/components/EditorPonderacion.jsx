import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  COMPONENTES, esEvaluacionJerarquica, revisarPonderacion,
} from '../lib/calificacion'

const ETIQUETAS = Object.fromEntries(COMPONENTES)
const nuevaId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)

function actividadRef(a) {
  return { tipo: a.tipo, id: a.id }
}

function actividadesDe(grupo, actividades) {
  return actividades.filter(a => grupo.moduloId == null
    ? a.moduloId == null
    : String(a.moduloId) === String(grupo.moduloId))
}

function grupoAutomatico(rama, peso = 0, tiposDisponibles = null) {
  const predeterminados = rama.moduloId == null
    ? ['tareas', 'examenes', 'foro', ...(tiposDisponibles?.includes('avance') ? ['avance'] : [])]
    : ['tareas', 'examenes']
  const tipos = tiposDisponibles
    ? predeterminados.filter(t => tiposDisponibles.includes(t))
    : predeterminados
  return {
    ...rama, peso, modo: 'rubrica',
    criterios: [{
      id: nuevaId(), nombre: 'Evaluación', peso: 100,
      fuente: 'tipos', tipos, distribucion: 'igual', actividades: [],
    }],
  }
}

function crearConfiguracion(modulos, actividades, anterior) {
  const ramas = [
    ...modulos.map(m => ({
      id: `modulo:${m.id}`, moduloId: m.id, nombre: m.titulo,
    })),
    { id: 'curso', moduloId: null, nombre: 'Evaluación general del curso' },
  ]
  // Los módulos cuentan desde la configuración aunque sus tareas aún
  // estén por crearse; las actividades generales solo reciben peso si existen.
  const conPeso = ramas.filter(r => r.moduloId != null || actividadesDe(r, actividades).length ||
    (r.moduloId == null && Number(anterior?.avance) > 0))
  if (!conPeso.length) conPeso.push(...ramas)
  const peso = conPeso.length ? 100 / conPeso.length : 100
  const tiposAnteriores = ['tareas', 'examenes', 'foro', 'avance']
    .filter(tipo => Number(anterior?.[tipo]) > 0)
  const preservarTipos = tiposAnteriores.length ? tiposAnteriores : null
  return {
    version: 2,
    escala: 10,
    minima10: anterior?.minima != null ? Number(anterior.minima) / 10 : 7,
    grupos: ramas.map(rama => {
      const indiceConPeso = conPeso.findIndex(g => g.id === rama.id)
      const asignado = indiceConPeso < 0 ? 0
        : (indiceConPeso === conPeso.length - 1 ? 100 - peso * indiceConPeso : peso)
      return grupoAutomatico(rama, Math.round(asignado * 100) / 100, preservarTipos)
    }),
  }
}

function cambiarGrupo(config, id, fn) {
  return {
    ...config,
    grupos: config.grupos.map(g => g.id === id ? fn(g) : g),
  }
}

function ListaActividades({ grupo, criterio, disponibles, config, onChange }) {
  const ocupadasEnOtras = useMemo(() => new Set(config.grupos
    .filter(g => g.id === grupo.id)
    .flatMap(g => g.criterios || [])
    .filter(c => c.id !== criterio.id && c.fuente === 'lista')
    .flatMap(c => c.actividades || [])
    .map(a => `${a.tipo}:${a.id}`)), [config.grupos, grupo.id, criterio.id])

  const refs = criterio.actividades || []
  const refsSet = new Set(refs.map(a => `${a.tipo}:${a.id}`))
  const alternar = (actividad, marcada) => {
    const key = `${actividad.tipo}:${actividad.id}`
    let siguientes = refs.filter(a => `${a.tipo}:${a.id}` !== key)
    if (marcada) siguientes = [...siguientes, { ...actividadRef(actividad), peso: 1 }]
    onChange({ ...criterio, actividades: siguientes })
  }
  const cambiarPeso = (actividad, peso) => onChange({
    ...criterio,
    actividades: refs.map(a => a.tipo === actividad.tipo && String(a.id) === String(actividad.id)
      ? { ...a, peso: Number(peso) || 0 }
      : a),
  })

  if (!disponibles.length) return <p className="nota">No hay actividades evaluables en esta rama.</p>
  return (
    <div className="eval-actividades">
      {disponibles.map(a => {
        const key = `${a.tipo}:${a.id}`
        const bloqueada = ocupadasEnOtras.has(key)
        const ref = refs.find(x => x.tipo === a.tipo && String(x.id) === String(a.id))
        return (
          <label key={key} className="eval-actividad">
            <input type="checkbox" checked={refsSet.has(key)} disabled={bloqueada}
              onChange={e => alternar(a, e.target.checked)} />
            <span>{ETIQUETAS[a.tipo]} · {a.titulo}{bloqueada ? ' (asignada a otro criterio)' : ''}</span>
            {ref && criterio.distribucion === 'manual' && (
              <input className="input eval-peso-actividad" type="number" min="0" step="0.1"
                aria-label={`Peso de ${a.titulo}`}
                value={ref.peso ?? 0}
                onChange={e => cambiarPeso(a, e.target.value)} />
            )}
          </label>
        )
      })}
    </div>
  )
}

export default function EditorPonderacion({ cursoId, value, onChange }) {
  const [ramas, setRamas] = useState([])
  const [actividades, setActividades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cursoId || cursoId === 'nuevo') {
      setRamas([]); setActividades([]); setCargando(false)
      return
    }
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError(null)
      try {
        const { data: modulos, error: eMod } = await supabase
          .from('modulos').select('id, titulo, orden').eq('curso_id', cursoId).order('orden')
        if (eMod) throw eMod
        const listaModulos = modulos || []
        const idsMod = listaModulos.map(m => m.id)
        const filtro = `curso_id.eq.${cursoId}` +
          (idsMod.length ? `,modulo_id.in.(${idsMod.join(',')})` : '')
        const [ex, ta, fo] = await Promise.all([
          supabase.from('examenes').select('id, titulo, curso_id, modulo_id, activo')
            .or(filtro).eq('activo', true),
          supabase.from('tareas').select('id, titulo, curso_id, modulo_id, activo')
            .or(filtro).eq('activo', true),
          supabase.from('foro_hilos').select('id, titulo, curso_id')
            .eq('curso_id', cursoId).eq('califica', true),
        ])
        const errorConsulta = ex.error || ta.error || fo.error
        if (errorConsulta) throw errorConsulta
        const items = [
          ...(ex.data || []).map(a => ({ ...a, tipo: 'examenes' })),
          ...(ta.data || []).map(a => ({ ...a, tipo: 'tareas' })),
          ...(fo.data || []).map(a => ({ ...a, tipo: 'foro', modulo_id: null })),
        ].map(a => ({
          id: a.id, tipo: a.tipo, titulo: a.titulo,
          moduloId: a.modulo_id ?? null,
        }))
        if (vivo) { setRamas(listaModulos); setActividades(items) }
      } catch (e) {
        if (vivo) setError(e.message || String(e))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [cursoId])

  if (cursoId === 'nuevo') return (
    <div className="pond-bloque">
      <h4>Evaluación del curso</h4>
      <p className="nota">Guarda el curso y crea sus módulos y actividades; después podrás asignar los pesos aquí.</p>
    </div>
  )

  const jerarquica = esEvaluacionJerarquica(value)
  const aviso = jerarquica ? revisarPonderacion(value) : null
  const iniciar = () => onChange(crearConfiguracion(ramas, actividades, value))
  const grupos = jerarquica ? value.grupos : []
  const tiposDisponibles = ['tareas', 'examenes', 'foro', 'avance']
  const sumaGrupos = grupos.reduce((s, g) => s + (Number(g.peso) || 0), 0)
  const modulosFaltantes = ramas.filter(m =>
    !grupos.some(g => String(g.moduloId) === String(m.id)))
  const faltaGeneral = !grupos.some(g => g.moduloId == null)

  const cambiarCriterio = (grupoId, criterioId, cambios) => onChange(cambiarGrupo(value, grupoId, g => ({
    ...g,
    criterios: (g.criterios || []).map(c => c.id === criterioId
      ? (typeof cambios === 'function' ? cambios(c) : cambios) : c),
  })))

  return (
    <div className="pond-bloque eval-editor">
      <h4>Calificación final · escala de 0 a 10</h4>
      <p className="nota">
        La nota se arma por niveles: peso de cada módulo en el curso, criterios dentro del módulo
        y actividades dentro del criterio. Lo pendiente aporta cero por ahora y conserva su peso;
        por eso 66 en una de dos tareas iguales equivale a 3.3/10.
      </p>
      {cargando && <p className="nota">Cargando módulos y actividades…</p>}
      {error && <p className="aviso-error">No pude cargar la estructura: {error}</p>}
      {!cargando && !error && ramas.length === 0 && actividades.length === 0 && (
        <p className="nota">Este curso aún no tiene módulos ni actividades evaluables.</p>
      )}

      {!jerarquica && !cargando && (
        <>
          {value && <p className="nota pond-aviso">
            El curso conserva su ponderación anterior hasta que guardes la nueva estructura.
            Al inicializarla se repartirán los módulos por igual; las actividades generales tendrán
            una rama propia si existen. Las actividades por tipo se distribuirán automáticamente.
          </p>}
          {!value && <p className="nota">
            Al iniciar, los módulos recibirán el mismo peso y se crearán criterios automáticos para
            tareas y exámenes; podrás ajustar cada porcentaje antes de guardar.
          </p>}
          <button type="button" className="button secondary" onClick={iniciar}
            disabled={cargando || !!error || (!ramas.length && !actividades.length)}>
            Configurar evaluación por módulos
          </button>
        </>
      )}

      {jerarquica && (
        <>
          <div className="eval-cabecera-pesos">
            <span>Peso asignado a módulos: <strong>{Math.round(sumaGrupos * 10) / 10}%</strong></span>
            <label>Mínima aprobatoria /10
              <input className="input" type="number" min="0" max="10" step="0.1"
                value={value.minima10 ?? ''}
                onChange={e => onChange({ ...value, minima10: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
          </div>
          {aviso && <p className="nota pond-aviso">{aviso}</p>}
          {grupos.map(grupo => {
            const candidatas = actividadesDe(grupo, actividades)
            const sumaCriterios = (grupo.criterios || []).reduce((s, c) => s + (Number(c.peso) || 0), 0)
            const avisoCriterios = grupo.modo !== 'entregable' &&
              Math.abs(sumaCriterios - 100) >= 0.01
              ? `Los criterios suman ${Math.round(sumaCriterios * 10) / 10}%; deben sumar 100%.`
              : null
            const cambiar = cambios => onChange(cambiarGrupo(value, grupo.id, g => ({ ...g, ...cambios })))
            return (
              <section className="eval-grupo" key={grupo.id}>
                <div className="eval-grupo-cabecera">
                  <h5>{grupo.nombre}</h5>
                  <label>Peso del curso (%)
                    <input className="input" type="number" min="0" max="100" step="0.1"
                      value={grupo.peso ?? 0} onChange={e => cambiar({ peso: Number(e.target.value) || 0 })} />
                  </label>
                </div>
                <label>Cómo se evalúa este módulo
                  <select className="input" value={grupo.modo || 'rubrica'}
                    onChange={e => cambiar({ modo: e.target.value })}>
                    <option value="rubrica">Criterios y actividades</option>
                    <option value="entregable">Un entregable representa el módulo</option>
                  </select>
                </label>

                {grupo.modo === 'entregable' ? (
                  <>
                    <label>Entregable único
                      <select className="input" value={grupo.entregable
                        ? `${grupo.entregable.tipo}:${grupo.entregable.id}` : ''}
                        onChange={e => {
                          const elegido = candidatas.find(a => `${a.tipo}:${a.id}` === e.target.value)
                          cambiar({ entregable: elegido ? actividadRef(elegido) : null })
                        }}>
                        <option value="">Selecciona una actividad</option>
                        {candidatas.map(a => <option key={`${a.tipo}:${a.id}`} value={`${a.tipo}:${a.id}`}>
                          {ETIQUETAS[a.tipo]} · {a.titulo}
                        </option>)}
                      </select>
                    </label>
                    {!grupo.entregable && <p className="nota pond-aviso">Selecciona el entregable que determinará la calificación del módulo.</p>}
                  </>
                ) : (
                  <>
                    <div className="eval-criterios-cab">
                      <strong>Criterios · {Math.round(sumaCriterios * 10) / 10}%</strong>
                      <button type="button" className="button texto" onClick={() => cambiar({
                        criterios: [...(grupo.criterios || []), {
                          id: nuevaId(), nombre: '', peso: 0, fuente: 'tipos',
                          tipos: [], distribucion: 'igual', actividades: [],
                        }],
                      })}>＋ Agregar criterio</button>
                    </div>
                    {avisoCriterios && <p className="nota pond-aviso">{avisoCriterios}</p>}
                    {(grupo.criterios || []).map((criterio, i) => (
                      <div className="eval-criterio" key={criterio.id}>
                        <div className="eval-criterio-cab">
                          <label>Criterio
                            <input className="input" value={criterio.nombre || ''}
                              onChange={e => cambiarCriterio(grupo.id, criterio.id, {
                                ...criterio, nombre: e.target.value,
                              })} placeholder={`Criterio ${i + 1}`} />
                          </label>
                          <label>Peso (%)
                            <input className="input" type="number" min="0" max="100" step="0.1"
                              value={criterio.peso ?? 0}
                              onChange={e => cambiarCriterio(grupo.id, criterio.id, {
                                ...criterio, peso: Number(e.target.value) || 0,
                              })} />
                          </label>
                          <button type="button" className="button texto" aria-label="Eliminar criterio"
                            onClick={() => cambiar({ criterios: grupo.criterios.filter(c => c.id !== criterio.id) })}>Eliminar</button>
                        </div>
                        <label>Cómo se agregan las actividades
                          <select className="input" value={criterio.fuente || 'lista'}
                            onChange={e => cambiarCriterio(grupo.id, criterio.id, c => ({
                              ...c, fuente: e.target.value,
                              distribucion: e.target.value === 'tipos' ? 'igual' : c.distribucion || 'igual',
                            }))}>
                            <option value="tipos">Automático por tipo · incluye actividades nuevas</option>
                            <option value="lista">Seleccionar actividades específicas</option>
                          </select>
                        </label>
                        {((criterio.fuente === 'tipos' && !(criterio.tipos || []).length) ||
                          (criterio.fuente !== 'tipos' && !(criterio.actividades || []).length)) && (
                          <p className="nota pond-aviso">Asigna actividades a este criterio para que su peso se evalúe.</p>
                        )}
                        {criterio.fuente === 'tipos' ? (
                          <div className="eval-tipos">
                            {tiposDisponibles.filter(t => grupo.moduloId == null || !['foro', 'avance'].includes(t)).map(tipo => {
                              const activo = (criterio.tipos || []).includes(tipo)
                              const usado = (grupo.criterios || []).some(c => c.id !== criterio.id &&
                                c.fuente === 'tipos' && (c.tipos || []).includes(tipo))
                              return <label key={tipo}>
                                <input type="checkbox" checked={activo} disabled={usado}
                                  onChange={e => cambiarCriterio(grupo.id, criterio.id, {
                                    ...criterio,
                                    tipos: e.target.checked
                                      ? [...(criterio.tipos || []), tipo]
                                      : (criterio.tipos || []).filter(t => t !== tipo),
                                  })} />
                                <span>{ETIQUETAS[tipo]}{usado ? ' (asignado a otro criterio)' : ''}</span>
                              </label>
                            })}
                            <small>
                              Las actividades nuevas de esos tipos se incorporan y comparten este peso por igual.
                              {' '}{(criterio.tipos || []).includes('avance')
                                ? 'El avance se calcula con los recursos marcados como vistos.'
                                : `${candidatas.filter(a => (criterio.tipos || []).includes(a.tipo)).length} registradas ahora.`}
                            </small>
                          </div>
                        ) : (
                          <>
                            <label>Distribución del peso entre actividades
                              <select className="input" value={criterio.distribucion || 'igual'}
                                onChange={e => cambiarCriterio(grupo.id, criterio.id, c => ({
                                  ...c, distribucion: e.target.value,
                                  actividades: (c.actividades || []).map(a => ({ ...a, peso: a.peso ?? 1 })),
                                }))}>
                                <option value="igual">Igual para todas</option>
                                <option value="manual">Peso manual</option>
                              </select>
                            </label>
                            {criterio.distribucion === 'manual' && (() => {
                              const suma = (criterio.actividades || []).reduce((s, a) => s + (Number(a.peso) || 0), 0)
                              return Math.abs(suma - 100) >= 0.01
                                ? <p className="nota pond-aviso">Los pesos de actividad suman {Math.round(suma * 10) / 10}%; se normalizarán a 100%.</p>
                                : null
                            })()}
                            <ListaActividades grupo={grupo} criterio={criterio} disponibles={candidatas}
                              config={value}
                              onChange={c => cambiarCriterio(grupo.id, criterio.id, c)} />
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </section>
            )
          })}
          {(modulosFaltantes.length > 0 || faltaGeneral) && <button type="button" className="button texto"
            onClick={() => {
              const nuevos = modulosFaltantes.map(m => grupoAutomatico({
                id: `modulo:${m.id}`, moduloId: m.id, nombre: m.titulo,
              }))
              if (faltaGeneral) nuevos.push(grupoAutomatico({
                id: 'curso', moduloId: null, nombre: 'Evaluación general del curso',
              }))
              onChange({ ...value, grupos: [...value.grupos, ...nuevos] })
            }}>
            ＋ Agregar módulos o actividades generales creados después
          </button>}
          {(modulosFaltantes.length > 0 || faltaGeneral) && (
            <p className="nota">Las ramas nuevas empiezan con 0%; ajusta sus pesos para que el total siga en 100%.</p>
          )}
          <p className="nota pond-aviso-fuerte">
            Guardar cambia el cálculo para todos los alumnos, incluidas sus constancias.
            Verifica que los pesos de módulos y criterios sumen 100% antes de publicar el curso.
          </p>
          <button type="button" className="button texto" onClick={() => onChange(null)}>
            Quitar este esquema y dar el mismo peso a cada actividad
          </button>
        </>
      )}
    </div>
  )
}
