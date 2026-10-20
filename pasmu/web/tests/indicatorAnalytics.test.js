import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPreviousMonthComparison,
  getTargetProgress,
  summarizeMeasurements
} from '../src/lib/indicatorAnalytics.js'

test('target progress distinguishes missing, non-computable and calculable targets', () => {
  assert.deepEqual(getTargetProgress({ total: 8, meta: null }), {
    status: 'sin-meta',
    percentage: null
  })
  assert.deepEqual(getTargetProgress({ total: 8, meta: 0 }), {
    status: 'meta-no-positiva',
    percentage: null
  })
  assert.deepEqual(getTargetProgress({ total: 8, meta: 10 }), {
    status: 'calculable',
    percentage: 80
  })
})

test('month-over-month comparison requires exactly one measurement per month', () => {
  const rows = [
    { indicadorId: 4, unidadId: 2, programaId: 9, periodo: '2026-01', total: 12 },
    { indicadorId: 4, unidadId: 2, programaId: 9, periodo: '2026-02', total: 15 }
  ]
  assert.deepEqual(getPreviousMonthComparison(rows, rows[1]), {
    previousPeriod: '2026-01',
    difference: 3
  })
})

test('comparison avoids crossing context, gaps, malformed periods or duplicate captures', () => {
  const current = { indicadorId: 4, unidadId: 2, programaId: 9, periodo: '2026-02', total: 15 }
  assert.equal(getPreviousMonthComparison([
    { ...current, unidadId: 3, periodo: '2026-01', total: 12 }
  ], current), null)
  assert.equal(getPreviousMonthComparison([
    { ...current, periodo: '2025-12', total: 12 }
  ], current), null)
  assert.equal(getPreviousMonthComparison([
    { ...current, periodo: 'febrero 2026', total: 12 }
  ], { ...current, periodo: 'febrero 2026' }), null)
  assert.equal(getPreviousMonthComparison([
    { ...current, periodo: '2026-01', total: 12 },
    { ...current, periodo: '2026-01', total: 13 },
    current
  ], current), null)
})

test('summary identifies missing targets and repeated indicator-period captures', () => {
  const rows = [
    { indicadorId: 1, unidadId: 2, programaId: null, periodo: '2026-01', total: 2, meta: null },
    { indicadorId: 1, unidadId: 2, programaId: null, periodo: '2026-01', total: 3, meta: 4 },
    { indicadorId: 2, unidadId: 2, programaId: null, periodo: '2026-01', total: 1, meta: 0 }
  ]
  assert.deepEqual(summarizeMeasurements(rows), {
    indicators: 2,
    measurements: 3,
    withoutTarget: 1,
    nonComputableTargets: 1,
    duplicateGroups: 1,
    duplicateDetails: [{
      key: '1:2::2026-01',
      indicator: 'Indicador 1',
      period: '2026-01',
      count: 2
    }]
  })
})
