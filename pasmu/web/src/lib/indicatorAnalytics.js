function indicatorKey(item) {
  return item.indicadorId ?? item.categoria ?? 'sin-indicador'
}

function contextKey(item) {
  return `${indicatorKey(item)}:${item.unidadId ?? ''}:${item.programaId ?? ''}`
}

function measurementKey(item) {
  return `${contextKey(item)}:${item.periodo ?? 'sin-periodo'}`
}

export function getTargetProgress(item) {
  if (item.meta === null || item.meta === undefined || item.meta === '') {
    return { status: 'sin-meta', percentage: null }
  }

  const value = Number(item.total)
  const target = Number(item.meta)
  if (!Number.isFinite(value) || !Number.isFinite(target)) {
    return { status: 'dato-no-numerico', percentage: null }
  }
  if (target <= 0) {
    return { status: 'meta-no-positiva', percentage: null }
  }

  return {
    status: 'calculable',
    percentage: (value / target) * 100
  }
}

export function getPreviousMonthComparison(rows, item) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(item.periodo || '')
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const previousPeriod = month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`
  const sameSeries = rows.filter((row) =>
    contextKey(row) === contextKey(item) &&
    (row.periodo === item.periodo || row.periodo === previousPeriod)
  )
  const currentRows = sameSeries.filter((row) => row.periodo === item.periodo)
  const previousRows = sameSeries.filter((row) => row.periodo === previousPeriod)

  if (currentRows.length !== 1 || previousRows.length !== 1) return null

  const currentValue = Number(currentRows[0].total)
  const previousValue = Number(previousRows[0].total)
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null

  return {
    previousPeriod,
    difference: currentValue - previousValue
  }
}

export function summarizeMeasurements(rows) {
  const indicators = new Set(rows.map(indicatorKey))
  const withoutTarget = rows.filter((row) => getTargetProgress(row).status === 'sin-meta').length
  const nonComputableTargets = rows.filter((row) =>
    getTargetProgress(row).status === 'meta-no-positiva'
  ).length
  const duplicateCounts = new Map()

  for (const row of rows) {
    const key = measurementKey(row)
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1)
  }

  const duplicateDetails = [...duplicateCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const item = rows.find((row) => measurementKey(row) === key)
      return {
        key,
        indicator: item.categoria || `Indicador ${item.indicadorId}`,
        period: item.periodo || 'Sin periodo',
        count
      }
    })

  return {
    indicators: indicators.size,
    measurements: rows.length,
    withoutTarget,
    nonComputableTargets,
    duplicateGroups: duplicateDetails.length,
    duplicateDetails
  }
}
