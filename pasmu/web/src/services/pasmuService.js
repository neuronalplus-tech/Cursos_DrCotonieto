import {
  dashboardMetrics as demoDashboardMetrics,
  casos as demoCasos,
  agenda as demoAgenda,
  expediente as demoExpediente,
  reportesTablas as demoReportesTablas,
  seguridadEventos as demoSeguridadEventos
} from '../data/mockData'
import { supabase } from '../lib/supabase'
import { isExperienciaDemo, isDemoSessionActive } from '../lib/permissions'

const REPORT_QUERY_LIMIT = 200

function requireSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  return supabase
}

function throwIfError(error) {
  if (error) throw error
}

function isDemoUser(user) {
  // Modo local (sin authUserId): disponibilidad de datos ficticios siempre.
  if (!user?.authUserId) return true
  // Usuario autenticado con rol de solo lectura demo: datos de simulación,
  // sin escribir ni sincronizar. La sesión expira después de 15 minutos.
  if (isExperienciaDemo(user) && isDemoSessionActive(user)) return true
  return false
}

function scopeToActiveContext(query, user, { includeProgram = true } = {}) {
  if (!user?.unitId) {
    throw new Error('Tu perfil no tiene una unidad activa seleccionada.')
  }

  let scopedQuery = query.eq('unidad_id', user.unitId)
  if (includeProgram && user.programId !== null && user.programId !== undefined) {
    scopedQuery = scopedQuery.eq('programa_id', user.programId)
  }
  return scopedQuery
}

async function countRows(query) {
  const { count, error } = await query
  throwIfError(error)
  return count || 0
}

export async function getDashboardMetrics(user) {
  if (isDemoUser(user)) {
    return {
      metrics: demoDashboardMetrics,
      scope: [user?.unit, user?.program].filter(Boolean).join(' · ') || 'Contexto de demostración',
      generatedAt: null,
      demo: true
    }
  }
  const client = requireSupabase()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [activeCases, appointmentsToday, indicatorMeasurements] = await Promise.all([
    countRows(scopeToActiveContext(
      client.from('casos').select('id', { count: 'exact', head: true }).neq('estado', 'cerrado'),
      user
    )),
    countRows(scopeToActiveContext(
      client.from('agenda').select('id', { count: 'exact', head: true })
        .gte('fecha_inicio', todayStart).lt('fecha_inicio', tomorrow),
      user,
      { includeProgram: false }
    )),
    countRows(scopeToActiveContext(
      client.from('mediciones_indicadores').select('id', { count: 'exact', head: true }).eq('periodo', month),
      user
    ))
  ])

  return {
    metrics: [
      {
        label: 'Casos activos',
        value: String(activeCases),
        detail: 'Casos no cerrados visibles; no representa prioridad ni resultado clínico.'
      },
      {
        label: 'Registros de agenda hoy',
        value: String(appointmentsToday),
        detail: 'Unidad completa y todos los estados de agenda; no equivale a citas confirmadas.'
      },
      {
        label: 'Mediciones registradas del mes',
        value: String(indicatorMeasurements),
        detail: 'Filas del periodo YYYY-MM visibles; no mide cobertura sin frecuencia esperada.'
      }
    ],
    scope: [user.unit, user.program].filter(Boolean).join(' · '),
    generatedAt: new Date().toISOString(),
    demo: false
  }
}

export async function getCasos(user) {
  if (isDemoUser(user)) return demoCasos
  const client = requireSupabase()
  const { data, error } = await scopeToActiveContext(
    client.from('casos')
      .select('id, unidad_id, estado, fecha_apertura, unidades(codigo)')
      .order('fecha_apertura', { ascending: false })
      .limit(100),
    user
  )

  throwIfError(error)
  return (data || []).map((item) => ({
    id: item.id,
    paciente: `Expediente ${item.id}`,
    unidad: item.unidades?.codigo || String(item.unidad_id),
    estado: item.estado,
    responsable: 'No asignado',
    prioridad: '—'
  }))
}

export async function getAgenda(user) {
  if (isDemoUser(user)) return demoAgenda
  const client = requireSupabase()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const { data, error } = await scopeToActiveContext(
    client.from('agenda')
      .select('id, fecha_inicio, fecha_fin, tipo, estado')
      .gte('fecha_inicio', start.toISOString())
      .lt('fecha_inicio', end.toISOString())
      .order('fecha_inicio', { ascending: true })
      .limit(100),
    user,
    { includeProgram: false }
  )

  throwIfError(error)
  return (data || []).map((item) => ({
    id: item.id,
    hora: new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' })
      .format(new Date(item.fecha_inicio)),
    titulo: item.tipo,
    responsable: item.estado,
    tipo: 'Cita'
  }))
}

export async function getExpediente(user, caseId) {
  if (isDemoUser(user)) {
    const selectedCase = demoCasos.find((item) => item.id === caseId)
    if (!selectedCase) return null
    if (caseId === 'demo-1') {
      return { ...demoExpediente, paciente: selectedCase.paciente }
    }

    return {
      paciente: selectedCase.paciente,
      motivo: 'Registro de demostración sin notas clínicas.',
      ultimaNota: 'No hay notas simuladas para este caso.',
      datos: [
        { etiqueta: 'Unidad', valor: selectedCase.unidad },
        { etiqueta: 'Estado', valor: selectedCase.estado },
        { etiqueta: 'Prioridad', valor: selectedCase.prioridad }
      ],
      historial: []
    }
  }
  if (!caseId) return null

  const client = requireSupabase()
  const { data: currentCase, error: caseError } = await scopeToActiveContext(
    client.from('casos')
      .select('id, unidad_id, programa_id, estado, fecha_apertura, unidades(codigo)')
      .eq('id', caseId)
      .maybeSingle(),
    user
  )

  throwIfError(caseError)
  if (!currentCase) {
    throw new Error('El caso no existe o tu perfil no tiene acceso a él.')
  }

  const { data: notes, error: notesError } = await client
    .from('notas_clinicas')
    .select('id, caso_id, tipo, contenido, created_at')
    .eq('caso_id', caseId)
    .order('created_at', { ascending: false })
    .limit(100)

  throwIfError(notesError)
  const latest = notes?.[0]

  return {
    paciente: `Caso ${currentCase.id}`,
    motivo: 'Motivo de referencia no incluido en la vista general.',
    ultimaNota: latest
      ? `${new Date(latest.created_at).toLocaleString('es-MX')} — ${latest.tipo}`
      : 'Este caso todavía no tiene notas clínicas visibles.',
    datos: [
      { etiqueta: 'Unidad', valor: currentCase?.unidades?.codigo || '—' },
      { etiqueta: 'Estado', valor: currentCase?.estado || '—' }
    ],
    historial: (notes || []).map((note) => `${new Date(note.created_at).toLocaleString('es-MX')} · ${note.contenido}`)
  }
}

export async function getReportData(user, options = {}) {
  if (isDemoUser(user)) {
    return {
      tables: demoReportesTablas,
      indicators: null,
      page: { offset: 0, limit: demoReportesTablas.length, hasMore: false }
    }
  }

  const client = requireSupabase()
  const requestedOffset = Number.isInteger(options.offset) ? options.offset : 0
  const offset = Math.max(0, requestedOffset)
  const [measurementsResult, indicatorsResult] = await Promise.all([
    scopeToActiveContext(
      client.from('mediciones_indicadores')
        .select('indicador_id, unidad_id, programa_id, periodo, valor, indicadores(nombre, unidad_medida)')
        .order('periodo', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + REPORT_QUERY_LIMIT - 1),
      user
    ),
    offset === 0
      ? client.from('indicadores')
        .select('id, codigo, nombre, descripcion, tipo, unidad_medida')
        .eq('activo', true)
        .order('nombre', { ascending: true })
        .limit(REPORT_QUERY_LIMIT)
      : Promise.resolve({ data: null, error: null })
  ])

  throwIfError(measurementsResult.error)
  throwIfError(indicatorsResult.error)

  const measurements = measurementsResult.data || []
  const indicatorIds = [...new Set(measurements.map((item) => item.indicador_id))]
  const unitIds = [...new Set(measurements.map((item) => item.unidad_id))]
  const periods = [...new Set(measurements.map((item) => item.periodo))]
  const programIds = [...new Set(measurements.map((item) => item.programa_id).filter((id) => id !== null))]
  let targets = []
  let targetResultsReachedLimit = false

  if (indicatorIds.length && unitIds.length && periods.length) {
    const baseTargetsQuery = () => scopeToActiveContext(
      client.from('metas_indicadores')
        .select('indicador_id, unidad_id, programa_id, periodo, meta')
        .in('indicador_id', indicatorIds)
        .in('unidad_id', unitIds)
        .in('periodo', periods),
      user,
      { includeProgram: false }
    )

    const targetQueries = [
      baseTargetsQuery().is('programa_id', null).limit(REPORT_QUERY_LIMIT)
    ]
    if (programIds.length) {
      targetQueries.push(baseTargetsQuery().in('programa_id', programIds).limit(REPORT_QUERY_LIMIT))
    }
    const targetResults = await Promise.all(targetQueries)
    for (const result of targetResults) throwIfError(result.error)
    targets = targetResults.flatMap((result) => result.data || [])
    targetResultsReachedLimit = targetResults.some((result) => (result.data || []).length === REPORT_QUERY_LIMIT)
  }

  const targetKey = (item) =>
    `${item.unidad_id}:${item.programa_id ?? 'unidad'}:${item.indicador_id}:${item.periodo}`
  const targetsByKey = new Map(targets.map((item) => [targetKey(item), item.meta]))
  const tables = measurements.map((item) => ({
    indicadorId: item.indicador_id,
    categoria: item.indicadores?.nombre || `Indicador ${item.indicador_id}`,
    total: Number(item.valor),
    unidadMedida: item.indicadores?.unidad_medida || '',
    meta: targetsByKey.get(targetKey(item))
      ?? targetsByKey.get(targetKey({ ...item, programa_id: null }))
      ?? null,
    periodo: item.periodo
  }))

  return {
    tables,
    limits: {
      maxRows: REPORT_QUERY_LIMIT,
      measurementsReached: measurements.length === REPORT_QUERY_LIMIT,
      targetsReached: targetResultsReachedLimit,
      indicatorsReached: (indicatorsResult.data || []).length === REPORT_QUERY_LIMIT
    },
    page: {
      offset,
      limit: REPORT_QUERY_LIMIT,
      hasMore: measurements.length === REPORT_QUERY_LIMIT
    },
    indicators: (indicatorsResult.data || []).map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion,
      tipo: item.tipo,
      unidadMedida: item.unidad_medida
    }))
  }
}

export async function getSeguridadEventos(user) {
  if (isDemoUser(user)) return demoSeguridadEventos
  return []
}

export async function crearCasoControlado(user, motivo) {
  if (!user?.authUserId) throw new Error('Se requiere sesión autenticada.')
  if (!user.unitId) throw new Error('Selecciona una unidad activa.')
  const client = requireSupabase()
  const { data, error } = await client.rpc('pasmu_caso_crear', {
    _unidad_id: user.unitId,
    _programa_id: user.programId ?? null,
    _motivo: motivo
  })
  throwIfError(error)
  return data
}

export async function programarAgendaControlada(casoId, inicio, fin, tipo = 'cita') {
  const client = requireSupabase()
  const { data, error } = await client.rpc('pasmu_agenda_programar', {
    _caso_id: casoId,
    _inicio: inicio,
    _fin: fin,
    _tipo: tipo
  })
  throwIfError(error)
  return data
}

export async function crearNotaControlada(casoId, contenido, tipo = 'general') {
  const client = requireSupabase()
  const { data, error } = await client.rpc('pasmu_nota_crear', {
    _caso_id: casoId,
    _tipo: tipo,
    _contenido: contenido
  })
  throwIfError(error)
  return data
}

export async function getConfigurationChanges(user) {
  if (!user?.authUserId) {
    throw new Error('La consulta institucional requiere una sesión autenticada.')
  }

  const client = requireSupabase()
  const { data: requests, error: requestError } = await client
    .from('solicitudes_cambio_configuracion')
    .select('id, cambio_id, version, sustituye_id, dominio, unidad_id, titulo, motivo, propuesta, estado, creada_por, enviada_en, creada_en, unidades(codigo,nombre)')
    .order('creada_en', { ascending: false })
    .limit(100)

  throwIfError(requestError)
  if (!requests?.length) return []

  const requestIds = requests.map(({ id }) => id)
  const [reviewsResult, eventsResult] = await Promise.all([
    client.from('revisiones_cambio_configuracion')
      .select('id, solicitud_id, decision, comentario, revisada_por, revisada_en')
      .in('solicitud_id', requestIds)
      .order('revisada_en', { ascending: true }),
    client.from('eventos_cambio_configuracion')
      .select('id, solicitud_id, evento, actor_id, detalle, creado_en')
      .in('solicitud_id', requestIds)
      .order('creado_en', { ascending: true })
  ])
  throwIfError(reviewsResult.error)
  throwIfError(eventsResult.error)

  const reviewsByRequest = new Map()
  for (const review of reviewsResult.data || []) {
    const items = reviewsByRequest.get(review.solicitud_id) || []
    items.push(review)
    reviewsByRequest.set(review.solicitud_id, items)
  }
  const eventsByRequest = new Map()
  for (const event of eventsResult.data || []) {
    const items = eventsByRequest.get(event.solicitud_id) || []
    items.push(event)
    eventsByRequest.set(event.solicitud_id, items)
  }

  return requests.map((request) => {
    const reviews = reviewsByRequest.get(request.id) || []
    const latestReview = reviews.at(-1)
    const change = request.propuesta && typeof request.propuesta === 'object'
      ? request.propuesta
      : {}

    return {
      id: request.id,
      changeId: request.cambio_id,
      version: request.version,
      supersedesId: request.sustituye_id,
      domain: request.dominio,
      scope: request.unidad_id
        ? (typeof change.scope === 'string' && change.scope.trim()
            ? change.scope
            : `${request.unidades?.codigo || request.unidades?.nombre || 'Unidad'} · ${request.unidad_id}`)
        : 'Institucional',
      title: request.titulo,
      rationale: request.motivo,
      proposal: typeof change.description === 'string'
        ? change.description
        : JSON.stringify(change),
      impact: typeof change.impact === 'string' ? change.impact : '',
      rollbackPlan: typeof change.rollbackPlan === 'string' ? change.rollbackPlan : '',
      validationEvidence: typeof change.validationEvidence === 'string'
        ? change.validationEvidence
        : '',
      status: request.estado,
      createdBy: 'Personal institucional autorizado',
      createdById: request.creada_por,
      createdAt: request.creada_en,
      submittedAt: request.enviada_en,
      reviewDecision: latestReview?.decision || null,
      reviewComment: latestReview?.comentario || '',
      reviewedAt: latestReview?.revisada_en || null,
      events: eventsByRequest.get(request.id) || []
    }
  })
}

export async function createConfigurationChange(user, input, previousRequestId = null) {
  if (!user?.authUserId) throw new Error('Se requiere una sesión institucional autenticada.')
  if (!user.unitId) throw new Error('Tu perfil no tiene una unidad activa seleccionada.')
  const client = requireSupabase()
  const { data, error } = await client.rpc('pasmu_configuration_create_draft', {
    _dominio: input.domain,
    _unidad_id: user.unitId,
    _titulo: input.title.trim(),
    _motivo: input.rationale.trim(),
    _propuesta: {
      description: input.proposal.trim(),
      scope: input.scope.trim(),
      impact: input.impact.trim(),
      rollbackPlan: input.rollbackPlan.trim(),
      validationEvidence: input.validationEvidence.trim()
    },
    _sustituye_id: previousRequestId
  })
  throwIfError(error)
  if (typeof data !== 'string' || !data) {
    throw new Error('El servicio no devolvió el identificador de la propuesta.')
  }
  return data
}

export async function submitConfigurationChange(requestId) {
  const client = requireSupabase()
  const { error } = await client.rpc('pasmu_configuration_submit_review', {
    _solicitud_id: requestId
  })
  throwIfError(error)
}

export async function decideConfigurationChange(requestId, decision, comment = null) {
  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error('La decisión de revisión no es válida.')
  }
  if (decision === 'rejected' && (typeof comment !== 'string' || comment.trim().length < 5)) {
    throw new Error('Explica el motivo del rechazo en al menos 5 caracteres.')
  }

  const client = requireSupabase()
  const { error } = await client.rpc('pasmu_configuration_review', {
    _solicitud_id: requestId,
    _decision: decision,
    _comentario: comment?.trim() || null
  })
  throwIfError(error)
}
