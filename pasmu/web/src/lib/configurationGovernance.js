export const CONFIGURATION_DOMAINS = [
  { id: 'institutional_scope', label: 'Estructura institucional de la unidad', approval: 'Dirección y responsables institucionales' },
  { id: 'service_flow', label: 'Flujos y estados operativos', approval: 'Coordinación y responsables del proceso' },
  { id: 'catalogs', label: 'Catálogos y terminología', approval: 'Responsable del catálogo' },
  { id: 'indicator_definitions', label: 'Definiciones y metas de indicadores', approval: 'Dueño metodológico y autoridad de metas' },
  { id: 'public_content', label: 'Textos informativos y experiencia usuaria', approval: 'Dirección, privacidad y accesibilidad' },
  { id: 'roles_permissions', label: 'Roles y permisos', approval: 'Dirección y seguridad; segregación de funciones' },
  { id: 'clinical_protocols', label: 'Protocolos y contenido clínico', approval: 'Responsable clínico y autoridad institucional' },
  { id: 'privacy_retention', label: 'Privacidad, derechos y conservación', approval: 'Privacidad/jurídico y autoridad institucional' },
  { id: 'security_platform', label: 'Seguridad, infraestructura y esquema', approval: 'Tecnología y seguridad; liberación controlada' }
]

const DOMAIN_IDS = new Set(CONFIGURATION_DOMAINS.map(({ id }) => id))
const VALID_STATUSES = new Set(['draft', 'in_review'])

const FORBIDDEN_PAYLOAD_PATTERN = /(curp|rfc|nss|teléfono|telefono|domicilio|diagnóstico|diagnostico|nota clínica|nota clinica|expediente clínico|<script|select\s+\*|insert\s+into|service_role|https?:\/\/)/i

export function containsForbiddenPayloadContent(value) {
  if (typeof value !== 'string') return false
  return FORBIDDEN_PAYLOAD_PATTERN.test(value)
}

export function validateConfigurationDraft(input) {
  const errors = {}
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  const domain = typeof input?.domain === 'string' ? input.domain : ''
  const scope = typeof input?.scope === 'string' ? input.scope.trim() : ''
  const rationale = typeof input?.rationale === 'string' ? input.rationale.trim() : ''
  const proposal = typeof input?.proposal === 'string' ? input.proposal.trim() : ''
  const impact = typeof input?.impact === 'string' ? input.impact.trim() : ''
  const rollbackPlan = typeof input?.rollbackPlan === 'string' ? input.rollbackPlan.trim() : ''
  const validationEvidence = typeof input?.validationEvidence === 'string'
    ? input.validationEvidence.trim()
    : ''

  if (title.length < 3 || title.length > 120) errors.title = 'Usa entre 3 y 120 caracteres.'
  if (!DOMAIN_IDS.has(domain)) errors.domain = 'Selecciona un ámbito de cambio válido.'
  if (scope.length < 2 || scope.length > 120) errors.scope = 'Usa entre 2 y 120 caracteres.'
  if (rationale.length < 10 || rationale.length > 1000) errors.rationale = 'Usa entre 10 y 1000 caracteres.'
  if (proposal.length < 10 || proposal.length > 3000) errors.proposal = 'Usa entre 10 y 3000 caracteres.'
  if (impact.length < 10 || impact.length > 2000) errors.impact = 'Usa entre 10 y 2000 caracteres.'
  if (rollbackPlan.length < 10 || rollbackPlan.length > 2000) {
    errors.rollbackPlan = 'Usa entre 10 y 2000 caracteres.'
  }
  if (validationEvidence.length < 10 || validationEvidence.length > 2000) {
    errors.validationEvidence = 'Usa entre 10 y 2000 caracteres.'
  }
  if (input?.confirmNoSensitiveData !== true) {
    errors.confirmNoSensitiveData = 'Confirma que la propuesta no incluye información personal o clínica.'
  }
  const sensitiveFields = { rationale, proposal, impact, rollbackPlan, validationEvidence }
  for (const [field, value] of Object.entries(sensitiveFields)) {
    if (containsForbiddenPayloadContent(value)) {
      errors[field] = 'Retira datos personales, clínicos, código o enlaces antes de proponer.'
    }
  }

  return errors
}

export function createConfigurationDraft(input, {
  id,
  actor,
  createdAt,
  previousVersion = null
}) {
  const errors = validateConfigurationDraft(input)
  if (Object.keys(errors).length) {
    throw new Error('La propuesta no cumple los requisitos de validación.')
  }
  if (typeof id !== 'string' || !id) throw new Error('Se requiere un identificador de versión.')
  if (typeof actor !== 'string' || !actor.trim()) throw new Error('Se requiere identificar a quien propone el cambio.')
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new Error('La fecha de creación de la propuesta no es válida.')
  }
  if (previousVersion && !isConfigurationProposal(previousVersion)) {
    throw new Error('La versión de origen no es una propuesta válida.')
  }

  return {
    id,
    changeId: previousVersion?.changeId || id,
    version: previousVersion ? previousVersion.version + 1 : 1,
    supersedesId: previousVersion?.id || null,
    title: input.title.trim(),
    domain: input.domain,
    scope: input.scope.trim(),
    rationale: input.rationale.trim(),
    proposal: input.proposal.trim(),
    impact: input.impact.trim(),
    rollbackPlan: input.rollbackPlan.trim(),
    validationEvidence: input.validationEvidence.trim(),
    status: 'draft',
    createdBy: actor.trim(),
    createdAt,
    submittedAt: null,
    events: [{
      type: 'draft_created',
      actor: actor.trim(),
      at: createdAt
    }]
  }
}

export function submitConfigurationDraft(proposal, { actor, submittedAt }) {
  if (!isConfigurationProposal(proposal)) throw new Error('La propuesta no es válida.')
  if (proposal.status !== 'draft') throw new Error('Solo se puede enviar a revisión un borrador.')
  if ([proposal.impact, proposal.rollbackPlan, proposal.validationEvidence]
    .some((value) => value.trim().length < 10)) {
    throw new Error('Completa impacto, reversión y evidencia mediante una nueva versión antes de enviar.')
  }
  if (typeof actor !== 'string' || !actor.trim()) throw new Error('Se requiere identificar a quien envía la propuesta.')
  if (typeof submittedAt !== 'string' || Number.isNaN(Date.parse(submittedAt))) {
    throw new Error('La fecha de envío no es válida.')
  }

  return {
    ...proposal,
    status: 'in_review',
    submittedAt,
    events: [...proposal.events, {
      type: 'submitted_for_review',
      actor: actor.trim(),
      at: submittedAt
    }]
  }
}

export function isConfigurationProposal(value) {
  const validDate = (date) => typeof date === 'string' && !Number.isNaN(Date.parse(date))
  const validEvent = (event) =>
    event
    && ['draft_created', 'submitted_for_review'].includes(event.type)
    && typeof event.actor === 'string'
    && Boolean(event.actor.trim())
    && validDate(event.at)

  return Boolean(
    value
    && typeof value.id === 'string'
    && Boolean(value.id)
    && typeof value.changeId === 'string'
    && Boolean(value.changeId)
    && Number.isInteger(value.version)
    && value.version > 0
    && DOMAIN_IDS.has(value.domain)
    && VALID_STATUSES.has(value.status)
    && typeof value.title === 'string'
    && Boolean(value.title.trim())
    && typeof value.scope === 'string'
    && Boolean(value.scope.trim())
    && typeof value.rationale === 'string'
    && typeof value.proposal === 'string'
    && typeof value.impact === 'string'
    && typeof value.rollbackPlan === 'string'
    && typeof value.validationEvidence === 'string'
    && typeof value.createdBy === 'string'
    && Boolean(value.createdBy.trim())
    && validDate(value.createdAt)
    && (value.supersedesId === null || typeof value.supersedesId === 'string')
    && (value.submittedAt === null || validDate(value.submittedAt))
    && (value.status !== 'in_review' || validDate(value.submittedAt))
    && Array.isArray(value.events)
    && value.events.length > 0
    && value.events.every(validEvent)
  )
}

export function parseConfigurationProposals(serialized) {
  if (serialized === null) return []
  const parsed = JSON.parse(serialized)
  if (!Array.isArray(parsed)) {
    throw new Error('El registro local de propuestas está dañado o tiene un formato incompatible; no se sobrescribió.')
  }

  return parsed.map((proposal) => {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
      throw new Error('El registro local de propuestas está dañado o tiene un formato incompatible; no se sobrescribió.')
    }
    const needsGovernanceDetails = [
      proposal.impact,
      proposal.rollbackPlan,
      proposal.validationEvidence
    ].some((value) => typeof value !== 'string')
    const migrated = {
      ...proposal,
      impact: typeof proposal.impact === 'string' ? proposal.impact : '',
      rollbackPlan: typeof proposal.rollbackPlan === 'string' ? proposal.rollbackPlan : '',
      validationEvidence: typeof proposal.validationEvidence === 'string'
        ? proposal.validationEvidence
        : '',
      ...(needsGovernanceDetails ? { legacyFormat: true } : {})
    }
    if (!isConfigurationProposal(migrated)) {
      throw new Error('El registro local de propuestas está dañado o tiene un formato incompatible; no se sobrescribió.')
    }
    return migrated
  })
}
