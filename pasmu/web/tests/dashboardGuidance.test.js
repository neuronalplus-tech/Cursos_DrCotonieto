import test from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardActions, getDashboardGuidance } from '../src/lib/dashboardGuidance.js'
import { USERS } from '../src/lib/permissions.js'

test('leadership and coordination receive different decision guidance', () => {
  assert.equal(getDashboardGuidance(USERS.direccion).title, 'Perspectiva de dirección')
  assert.equal(getDashboardGuidance(USERS.coord).title, 'Perspectiva de coordinación')
  assert.equal(
    getDashboardGuidance({ role: 'nuevo_rol' }).title,
    'Resumen de contexto'
  )
})

test('dashboard action links are limited to the current user permissions', () => {
  assert.deepEqual(
    getDashboardActions(USERS.direccion).map((action) => action.to),
    ['/reportes']
  )
  assert.deepEqual(
    getDashboardActions(USERS.coord).map((action) => action.to),
    ['/casos', '/agenda', '/reportes']
  )
  assert.deepEqual(
    getDashboardActions({ authUserId: 'user-1', permissions: ['agenda.ver'] })
      .map((action) => action.to),
    ['/agenda']
  )
})
