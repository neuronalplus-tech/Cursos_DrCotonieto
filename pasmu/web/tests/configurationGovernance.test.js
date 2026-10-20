import test from 'node:test'
import assert from 'node:assert/strict'
import {
  containsForbiddenPayloadContent,
  createConfigurationDraft,
  parseConfigurationProposals,
  submitConfigurationDraft,
  validateConfigurationDraft
} from '../src/lib/configurationGovernance.js'

const validInput = {
  title: 'Actualizar estados de agenda',
  domain: 'service_flow',
  scope: 'Unidad de atención',
  rationale: 'El flujo actual requiere revisión operativa con sus responsables.',
  proposal: 'Proponer etiquetas editables después de validar el proceso real.',
  impact: 'Puede cambiar cómo Coordinación y profesionales clasifican las citas.',
  rollbackPlan: 'Retirar la versión nueva y volver a la configuración previa aprobada.',
  validationEvidence: 'Probar transiciones con identidades sintéticas antes de solicitar aprobación.',
  confirmNoSensitiveData: true
}

function makeDraft(overrides = {}) {
  return createConfigurationDraft(
    { ...validInput, ...overrides },
    { id: 'version-1', actor: 'Coordinación demo', createdAt: '2026-10-17T10:00:00Z' }
  )
}

test('draft validation requires complete change context and no-sensitive-data confirmation', () => {
  assert.deepEqual(validateConfigurationDraft(validInput), {})
  assert.ok(validateConfigurationDraft({ ...validInput, title: 'a' }).title)
  assert.ok(validateConfigurationDraft({ ...validInput, domain: 'unknown' }).domain)
  assert.ok(validateConfigurationDraft({ ...validInput, impact: 'afecta' }).impact)
  assert.ok(validateConfigurationDraft({ ...validInput, rollbackPlan: '' }).rollbackPlan)
  assert.ok(validateConfigurationDraft({ ...validInput, validationEvidence: '' }).validationEvidence)
  assert.ok(validateConfigurationDraft({ ...validInput, confirmNoSensitiveData: false }).confirmNoSensitiveData)
})

test('new proposals start at version one and revisions preserve their chain without changing the prior version', () => {
  const first = makeDraft()
  const second = createConfigurationDraft(
    { ...validInput, proposal: 'Una revisión posterior mantiene trazabilidad de cambios.' },
    {
      id: 'version-2',
      actor: 'Coordinación demo',
      createdAt: '2026-10-18T10:00:00Z',
      previousVersion: first
    }
  )

  assert.equal(first.version, 1)
  assert.equal(first.supersedesId, null)
  assert.equal(second.version, 2)
  assert.equal(second.changeId, first.changeId)
  assert.equal(second.supersedesId, first.id)
  assert.notEqual(second.proposal, first.proposal)
  assert.equal(first.proposal, validInput.proposal)
})

test('submitting a proposal adds a review event and prevents resubmission', () => {
  const submitted = submitConfigurationDraft(makeDraft(), {
    actor: 'Coordinación demo',
    submittedAt: '2026-10-17T11:00:00Z'
  })

  assert.equal(submitted.status, 'in_review')
  assert.equal(submitted.events.at(-1).type, 'submitted_for_review')
  assert.throws(
    () => submitConfigurationDraft(submitted, {
      actor: 'Coordinación demo',
      submittedAt: '2026-10-17T12:00:00Z'
    }),
    /Solo se puede enviar a revisión/
  )
})

test('legacy local proposals are preserved but require impact, rollback and evidence before submission', () => {
  const legacy = makeDraft()
  delete legacy.impact
  delete legacy.rollbackPlan
  delete legacy.validationEvidence
  const [migrated] = parseConfigurationProposals(JSON.stringify([legacy]))

  assert.equal(migrated.legacyFormat, true)
  assert.equal(migrated.impact, '')
  assert.throws(
    () => submitConfigurationDraft(migrated, {
      actor: 'Coordinación demo',
      submittedAt: '2026-10-17T11:00:00Z'
    }),
    /Completa impacto, reversión y evidencia/
  )
})

test('proposal storage parsing fails explicitly on malformed or incompatible content', () => {
  assert.deepEqual(parseConfigurationProposals(null), [])
  assert.throws(() => parseConfigurationProposals('{bad json'), SyntaxError)
  assert.throws(() => parseConfigurationProposals('[{"id":"unknown"}]'), /formato incompatible/)
  assert.throws(
    () => parseConfigurationProposals(JSON.stringify([{ ...makeDraft(), createdAt: 'invalid' }])),
    /formato incompatible/
  )
})

test('forbidden personal, clinical and code content is rejected before drafting', () => {
  assert.equal(containsForbiddenPayloadContent('Flujo operativo normal'), false)
  assert.equal(containsForbiddenPayloadContent('Incluye CURP ABCD1234'), true)
  assert.equal(containsForbiddenPayloadContent('nota clínica de ejemplo'), true)
  assert.equal(containsForbiddenPayloadContent('<script>alert(1)</script>'), true)
  assert.equal(containsForbiddenPayloadContent('usa service_role en frontend'), true)
  assert.ok(validateConfigurationDraft({ ...validInput, proposal: 'Ver https://ejemplo.mx/doc' }).proposal)
})
