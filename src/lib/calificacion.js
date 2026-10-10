/*
 * Cálculo único de la nota del curso. Todas las pantallas reciben todas
 * las actividades evaluables, incluidas las pendientes. Una actividad sin
 * calificación aporta cero a la nota acumulada y conserva su peso pendiente.
 */

export const COMPONENTES = [
  ['examenes', 'Exámenes'],
  ['tareas', 'Tareas'],
  ['foro', 'Foro'],
  ['avance', 'Avance del material'],
]

export const ETIQUETA_COMPONENTE = Object.fromEntries(COMPONENTES)

export const PONDERACION_SUGERIDA = {
  examenes: 40, tareas: 40, foro: 20, avance: 0, minima: 70,
}

const redondear = (n) => Math.round((Number(n) || 0) * 10) / 10
const redondearDos = (n) => Math.round((Number(n) || 0) * 100) / 100
const claveActividad = (tipo, id) => `${tipo}:${id}`

export function aBase100(valor, maximo) {
  if (valor == null || valor === '') return null
  const m = Number(maximo)
  const tope = Number.isFinite(m) && m > 0 ? m : 100
  const v = Number(valor)
  if (!Number.isFinite(v)) return null
  return (v / tope) * 100
}

export function esEvaluacionJerarquica(config) {
  return Number(config?.version) === 2 && Array.isArray(config?.grupos)
}

export function tienePonderacion(config) {
  if (esEvaluacionJerarquica(config)) return config.grupos.length > 0
  if (!config) return false
  return COMPONENTES.some(([k]) => Number(config[k]) > 0)
}

function normalizarActividades(entradas) {
  const actividades = []
  for (const [tipo] of COMPONENTES) {
    if (tipo === 'avance') continue
    for (const [indice, item] of (entradas?.[tipo] || []).entries()) {
      if (item?.incluida === false) continue
      const id = item?.id ?? `${tipo}-${indice}`
      const valor = item?.valor
      actividades.push({
        clave: claveActividad(tipo, id), tipo, id,
        moduloId: item?.moduloId ?? item?.modulo_id ?? null,
        valor: aBase100(valor, item?.maximo),
        titulo: item?.titulo || ETIQUETA_COMPONENTE[tipo],
        evaluada: valor != null && valor !== '',
      })
    }
  }

  const avance = entradas?.avance
  if (avance && Number(avance.total) > 0) {
    actividades.push({
      clave: 'avance:curso', tipo: 'avance', id: 'curso', moduloId: null,
      valor: (Number(avance.hechos) / Number(avance.total)) * 100,
      titulo: ETIQUETA_COMPONENTE.avance, evaluada: true,
    })
  }
  return actividades
}

function pesoNormalizado(items, obtenerPeso, pesoTotal) {
  const suma = items.reduce((s, item) => s + Math.max(0, Number(obtenerPeso(item)) || 0), 0)
  if (!suma) return items.map(() => 0)
  return items.map(item => (Math.max(0, Number(obtenerPeso(item)) || 0) / suma) * pesoTotal)
}

function resolverActividadesCriterio(criterio, grupo, todas) {
  if (criterio.fuente === 'tipos') {
    const tipos = new Set(criterio.tipos || [])
    return todas.filter(a => tipos.has(a.tipo) &&
      (grupo.moduloId == null ? a.moduloId == null : String(a.moduloId) === String(grupo.moduloId)))
  }
  const refs = criterio.actividades || []
  return refs.map(ref => todas.find(a => a.tipo === ref.tipo && String(a.id) === String(ref.id)))
    .filter(Boolean)
}

function calcularJerarquico(actividades, config) {
  const grupos = config.grupos || []
  const pesosGrupo = pesoNormalizado(grupos, g => g.peso, 100)
  const resumenGrupos = []
  let pesoEvaluado = 0
  let puntos = 0
  let evaluadas = 0

  grupos.forEach((grupo, indexGrupo) => {
    const pesoGrupo = pesosGrupo[indexGrupo]
    let puntosGrupo = 0
    let pesoEvaluadoGrupo = 0
    const detalleGrupo = {
      clave: grupo.id || `grupo-${indexGrupo}`,
      etiqueta: grupo.nombre || 'Evaluación general',
      peso: redondear(pesoGrupo), n: 0, pesoFinal: redondear(pesoGrupo),
      pesoCalificadoFinal: 0, aporteFinal: 0, media: null, criterios: [],
    }
    const aplicar = (actividad, pesoRelativo) => {
      if (!actividad || pesoRelativo <= 0) return null
      const pesoCurso = pesoGrupo * pesoRelativo / 100
      if (actividad.evaluada) {
        detalleGrupo.n++
        evaluadas++
        pesoEvaluado += pesoCurso
        pesoEvaluadoGrupo += pesoCurso
        puntos += (actividad.valor || 0) * pesoCurso / 100
        const aporte = (actividad.valor || 0) * pesoCurso / 100
        puntosGrupo += aporte
        detalleGrupo.aporteFinal += aporte
        return { aporte, pesoCurso, nota: actividad.valor || 0 }
      }
      return null
    }

    if (grupo.modo === 'entregable') {
      const ref = grupo.entregable
      const actividad = ref && actividades.find(a => a.tipo === ref.tipo && String(a.id) === String(ref.id))
      aplicar(actividad, 100)
    } else {
      const criterios = grupo.criterios || []
      const pesosCriterio = pesoNormalizado(criterios, c => c.peso, 100)
      criterios.forEach((criterio, indexCriterio) => {
        const candidatas = resolverActividadesCriterio(criterio, grupo, actividades)
        let pesosActividad
        if (criterio.distribucion === 'manual' && criterio.fuente !== 'tipos') {
          const porClave = new Map((criterio.actividades || []).map(a => [
            claveActividad(a.tipo, a.id), Number(a.peso) || 0,
          ]))
          pesosActividad = pesoNormalizado(candidatas, a => porClave.get(a.clave), 100)
        } else {
          pesosActividad = candidatas.map(() => candidatas.length ? 100 / candidatas.length : 0)
        }
        const pesoCriterio = pesosCriterio[indexCriterio]
        const detalleCriterio = {
          id: criterio.id,
          etiqueta: criterio.nombre || 'Criterio', peso: redondear(pesoCriterio),
          actividades: candidatas.length, n: 0, media: null,
          pesoCalificadoFinal: 0, aporteFinal: 0,
        }
        candidatas.forEach((actividad, i) => {
          const pesoDentroGrupo = pesoCriterio * pesosActividad[i] / 100
          const aplicado = aplicar(actividad, pesoDentroGrupo)
          if (aplicado) {
            detalleCriterio.n++
            detalleCriterio.pesoCalificadoFinal += aplicado.pesoCurso
            detalleCriterio.aporteFinal += aplicado.aporte
          }
        })
        detalleCriterio.media = detalleCriterio.pesoCalificadoFinal > 0
          ? redondear(detalleCriterio.aporteFinal * 100 / detalleCriterio.pesoCalificadoFinal)
          : null
        detalleCriterio.pesoCalificadoFinal = redondear(detalleCriterio.pesoCalificadoFinal)
        detalleCriterio.aporteFinal = redondear(detalleCriterio.aporteFinal)
        detalleGrupo.criterios.push(detalleCriterio)
      })
    }
    detalleGrupo.media = pesoEvaluadoGrupo > 0
      ? redondear(puntosGrupo * 100 / pesoEvaluadoGrupo) : null
    detalleGrupo.pesoCalificadoFinal = redondear(pesoEvaluadoGrupo)
    resumenGrupos.push(detalleGrupo)
  })

  // El promedio refleja el desempeño en lo ya calificado; el acumulado
  // conserva el denominador completo y deja las actividades pendientes en cero.
  const valor = pesoEvaluado > 0 ? redondear(puntos * 100 / pesoEvaluado) : null
  const acumulado = redondear(puntos)
  const pesoConNota = redondear(pesoEvaluado)
  if (!evaluadas) return null
  const minima10 = config.minima10 == null ? null : Number(config.minima10)
  return {
    valor, acumulado, equivalente10: redondearDos(acumulado / 10),
    pesoEvaluado: pesoConNota, ponderada: true,
    minima: minima10, aprobado: minima10 != null && pesoConNota >= 99.95
      ? acumulado / 10 >= minima10 : null,
    de: evaluadas, detalle: resumenGrupos,
  }
}

function calcularPlano(actividades, config) {
  const configPonderada = tienePonderacion(config)
  const plana = actividades.filter(a => a.tipo !== 'avance' || (configPonderada && Number(config.avance) > 0))
  const activos = configPonderada
    ? plana.filter(a => Number(config[a.tipo]) > 0)
    : plana.filter(a => a.tipo !== 'avance')
  if (!activos.length) return null

  const pesosTipo = configPonderada
    ? COMPONENTES.reduce((s, [k]) => s + Math.max(0, Number(config[k]) || 0), 0)
    : 0
  const pesoActividad = new Map()
  const detalle = []
  const aportesPorTipo = new Map()
  const pesoEvaluadoPorTipo = new Map()
  for (const [tipo] of COMPONENTES) {
    const delTipo = activos.filter(a => a.tipo === tipo)
    if (!delTipo.length && (!configPonderada || Number(config[tipo]) <= 0)) continue
    const pesoTipo = configPonderada
      ? (Math.max(0, Number(config[tipo]) || 0) / (pesosTipo || 1)) * 100
      : 100 * delTipo.length / activos.length
    const cadaUna = delTipo.length ? pesoTipo / delTipo.length : 0
    let n = 0
    let nota = 0
    for (const actividad of delTipo) {
      pesoActividad.set(actividad.clave, cadaUna)
      if (actividad.evaluada) {
        n++
        nota += actividad.valor || 0
      }
    }
    detalle.push({
      clave: tipo, etiqueta: ETIQUETA_COMPONENTE[tipo], media: n ? redondear(nota / n) : null,
      n, peso: redondear(pesoTipo), pesoFinal: redondear(pesoTipo), aporteFinal: 0,
    })
  }

  let puntos = 0
  let pesoEvaluado = 0
  let evaluadas = 0
  for (const actividad of activos) {
    const peso = pesoActividad.get(actividad.clave) || 0
    if (actividad.evaluada) {
      puntos += (actividad.valor || 0) * peso / 100
      pesoEvaluado += peso
      evaluadas++
      aportesPorTipo.set(actividad.tipo,
        (aportesPorTipo.get(actividad.tipo) || 0) + (actividad.valor || 0) * peso / 100)
      pesoEvaluadoPorTipo.set(actividad.tipo,
        (pesoEvaluadoPorTipo.get(actividad.tipo) || 0) + peso)
    }
  }
  for (const parte of detalle) {
    parte.aporteFinal = redondear(aportesPorTipo.get(parte.clave) || 0)
    parte.pesoCalificadoFinal = redondear(pesoEvaluadoPorTipo.get(parte.clave) || 0)
  }
  if (!evaluadas) return null
  const acumulado = redondear(puntos)
  const valor = pesoEvaluado > 0 ? redondear(puntos * 100 / pesoEvaluado) : null
  const minima = configPonderada && config?.minima != null ? Number(config.minima) / 10 : null
  return {
    valor, acumulado, equivalente10: redondearDos(acumulado / 10),
    pesoEvaluado: redondear(pesoEvaluado), ponderada: configPonderada,
    minima, aprobado: minima != null && pesoEvaluado >= 99.95
      ? acumulado / 10 >= minima : null,
    de: evaluadas, detalle,
  }
}

export function calcular(entradas, config) {
  const actividades = normalizarActividades(entradas)
  if (!actividades.some(a => a.evaluada)) return null
  if (esEvaluacionJerarquica(config)) return calcularJerarquico(actividades, config)
  return calcularPlano(actividades, config)
}

export function calcularModulo(entradas, config, moduloId) {
  if (!esEvaluacionJerarquica(config)) return calcular(entradas, config)
  const grupo = config.grupos.find(g => String(g.moduloId) === String(moduloId))
  if (!grupo) return null
  return calcular(entradas, { ...config, grupos: [{ ...grupo, peso: 100 }] })
}

export function revisarPonderacion(config) {
  if (esEvaluacionJerarquica(config)) {
    const suma = config.grupos.reduce((s, g) => s + (Number(g.peso) || 0), 0)
    return Math.abs(suma - 100) < 0.01
      ? null
      : `Los pesos de módulo suman ${redondear(suma)}%. Deben sumar 100%.`
  }
  if (!tienePonderacion(config)) return null
  const suma = COMPONENTES.reduce((s, [k]) => s + (Number(config[k]) || 0), 0)
  if (Math.abs(suma - 100) < 0.01) return null
  return `Los pesos suman ${suma}, no 100. Se repartirán proporcionalmente.`
}

export const mostrar = (nota) => (nota == null ? '—' : String(nota.equivalente10))
