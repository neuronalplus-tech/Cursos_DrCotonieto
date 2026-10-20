import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessRoute, hasPermission, ROLES, USERS } from '../src/lib/permissions.js'

test('unauthenticated and malformed permissions are denied', () => {
  assert.equal(hasPermission(null, 'reportes.ver'), false)
  assert.equal(hasPermission(USERS.coord, ''), false)
  assert.equal(hasPermission(USERS.coord, undefined), false)
})

test('authenticated users fail closed until permissions are loaded', () => {
  assert.equal(hasPermission({ authUserId: 'user-1', role: 'coordinador_pasu' }, 'reportes.ver'), false)
  assert.equal(hasPermission({
    authUserId: 'user-1',
    permissions: ['reportes.ver']
  }, 'reportes.ver'), true)
})

test('demo role permissions remain available without Supabase auth', () => {
  assert.equal(hasPermission(USERS.coord, 'reportes.ver'), true)
  assert.equal(hasPermission(USERS.psicologo, 'reportes.ver'), false)
})

test('unknown routes deny access and known routes use their required permission', () => {
  assert.equal(canAccessRoute(USERS.coord, 'unknown'), false)
  assert.equal(canAccessRoute(USERS.coord, 'dashboard'), true)
  assert.equal(canAccessRoute(USERS.psicologo, 'reportes'), false)
})

test('demo role access to every route matches the reviewed least-privilege matrix', () => {
  const routesByRole = {
    coordinador_pasu: ['dashboard', 'casos', 'caso', 'agenda', 'expediente', 'reportes', 'admin'],
    psicologo: ['casos', 'caso', 'agenda', 'expediente'],
    supervisor: ['casos', 'caso', 'agenda', 'expediente', 'reportes'],
    practicante: ['casos', 'caso', 'agenda', 'expediente'],
    administrativo: ['casos', 'caso', 'agenda'],
    analista_indicadores: ['reportes'],
    direccion: ['dashboard', 'reportes'],
    seguridad: ['seguridad']
  }
  const allRoutes = ['dashboard', 'casos', 'caso', 'agenda', 'expediente', 'reportes', 'admin', 'seguridad']

  for (const [role, expectedRoutes] of Object.entries(routesByRole)) {
    assert.ok(ROLES[role], `expected role ${role} to be defined`)
    for (const route of allRoutes) {
      assert.equal(
        canAccessRoute({ role }, route),
        expectedRoutes.includes(route),
        `${role} access to ${route}`
      )
    }
  }
})

test('authenticated permissions are authoritative and do not fall back to demo role grants', () => {
  const user = {
    authUserId: 'auth-user-1',
    role: 'coordinador_pasu',
    permissions: ['agenda.ver']
  }

  assert.equal(canAccessRoute(user, 'agenda'), true)
  assert.equal(canAccessRoute(user, 'dashboard'), false)
  assert.equal(canAccessRoute(user, 'admin'), false)
})

test('explicit empty permissions fail closed instead of inheriting role permissions', () => {
  const user = { role: 'coordinador_pasu', permissions: [] }

  assert.equal(hasPermission(user, 'dashboard.ver'), false)
  assert.equal(canAccessRoute(user, 'dashboard'), false)
})

test('all demo identities reference a defined role', () => {
  for (const user of Object.values(USERS)) {
    assert.ok(ROLES[user.role], `expected ${user.role} to be defined`)
  }
})

test('authenticated administration route requires the dedicated configuration permission', () => {
  assert.equal(canAccessRoute({
    authUserId: 'auth-user-1',
    permissions: ['admin.roles']
  }, 'admin'), false)
  assert.equal(canAccessRoute({
    authUserId: 'auth-user-2',
    permissions: ['configuracion.ver']
  }, 'admin'), true)
})

test('experiencia_demo es solo lectura: navega, no edita ni exporta', () => {
  const demo = { role: 'experiencia_demo' }
  assert.equal(hasPermission(demo, 'dashboard.ver'), true)
  assert.equal(hasPermission(demo, 'casos.ver'), true)
  assert.equal(hasPermission(demo, 'agenda.ver'), true)
  assert.equal(hasPermission(demo, 'expediente.ver'), true)
  assert.equal(hasPermission(demo, 'reportes.ver'), true)
  assert.equal(hasPermission(demo, 'perfil.editar'), true)
  for (const denied of ['casos.crear', 'casos.editar', 'agenda.programar', 'expediente.editar', 'reportes.exportar', 'admin.roles', 'configuracion.ver', 'seguridad.ver']) {
    assert.equal(hasPermission(demo, denied), false, `demo no debe tener ${denied}`)
  }
  assert.equal(canAccessRoute(demo, 'dashboard'), true)
  assert.equal(canAccessRoute(demo, 'casos'), true)
  assert.equal(canAccessRoute(demo, 'agenda'), true)
  assert.equal(canAccessRoute(demo, 'expediente'), true)
  assert.equal(canAccessRoute(demo, 'reportes'), true)
  assert.equal(canAccessRoute(demo, 'perfil'), true)
  assert.equal(canAccessRoute(demo, 'exportar'), false)
  assert.equal(canAccessRoute(demo, 'admin'), false)
  assert.equal(canAccessRoute(demo, 'seguridad'), false)
  assert.equal(canAccessRoute(demo, 'revisiones'), false)
  assert.equal(canAccessRoute(demo, 'chat'), false)
})
