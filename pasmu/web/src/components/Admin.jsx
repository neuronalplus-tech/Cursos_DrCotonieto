import { useEffect, useState } from 'react'
import {
  CONFIGURATION_DOMAINS,
  createConfigurationDraft,
  parseConfigurationProposals,
  submitConfigurationDraft,
  validateConfigurationDraft
} from '../lib/configurationGovernance.js'
import { hasPermission } from '../lib/permissions.js'
import {
  createConfigurationChange,
  decideConfigurationChange,
  getConfigurationChanges,
  submitConfigurationChange
} from '../services/pasmuService.js'

const STORAGE_KEY = 'pasmu:configuration-proposals:v1'

const emptyForm = {
  title: '',
  domain: '',
  scope: '',
  rationale: '',
  proposal: '',
  impact: '',
  rollbackPlan: '',
  validationEvidence: '',
  confirmNoSensitiveData: false
}

const statusLabels = {
  draft: 'Borrador local',
  in_review: 'En revisión',
  approved: 'Aprobada; no publicada',
  rejected: 'Rechazada'
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export default function Admin({ user }) {
  const isDemo = !user?.authUserId
  const [proposals, setProposals] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [revisionSource, setRevisionSource] = useState(null)
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [reviewComments, setReviewComments] = useState({})

  useEffect(() => {
    let active = true
    const loadChanges = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const loaded = isDemo
          ? parseConfigurationProposals(window.localStorage.getItem(STORAGE_KEY))
          : await getConfigurationChanges(user)
        if (active) setProposals(loaded)
      } catch (error) {
        if (active) setLoadError(`No se pudieron cargar las propuestas: ${error.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadChanges()
    return () => {
      active = false
    }
  }, [isDemo, user?.authUserId, user?.id, user?.membershipId, user?.unitId])

  const persistProposals = (nextProposals) => {
    if (!isDemo) {
      setLoadError('La gestión persistente de cambios requiere el servicio institucional gobernado.')
      return false
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProposals))
      setProposals(nextProposals)
      setLoadError('')
      return true
    } catch (error) {
      setLoadError(`No se guardaron los cambios locales: ${error.message}`)
      return false
    }
  }

  const handleSaveDraft = async (event) => {
    event.preventDefault()
    const nextErrors = validateConfigurationDraft(form)
    setErrors(nextErrors)
    setMessage('')
    setLoadError('')
    if (Object.keys(nextErrors).length) return

    try {
      if (isDemo) {
        const proposal = createConfigurationDraft(form, {
          id: window.crypto.randomUUID(),
          actor: user?.name || user?.roleName || 'Usuario de demostración',
          createdAt: new Date().toISOString(),
          previousVersion: revisionSource
        })
        if (!persistProposals([...proposals, proposal])) return
        setMessage(`Se guardó la versión ${proposal.version} como borrador local. No está publicada ni modifica la operación.`)
      } else {
        await createConfigurationChange(user, form, revisionSource?.id || null)
        setProposals(await getConfigurationChanges(user))
        setMessage('El borrador quedó registrado en el servicio PASMU. Todavía no modifica la configuración activa.')
      }
      {
        setForm(emptyForm)
        setRevisionSource(null)
        setErrors({})
      }
    } catch (error) {
      setLoadError(`No se pudo crear el borrador: ${error.message}`)
    }
  }

  const handleSubmitForReview = async (proposalId) => {
    try {
      const proposal = proposals.find(({ id }) => id === proposalId)
      if (!proposal) throw new Error('No se encontró el borrador seleccionado.')
      setLoadError('')
      if (isDemo) {
        const submitted = submitConfigurationDraft(proposal, {
          actor: user?.name || user?.roleName || 'Usuario de demostración',
          submittedAt: new Date().toISOString()
        })
        if (!persistProposals(proposals.map((item) => item.id === proposalId ? submitted : item))) return
        setMessage('Se envió a revisión simulada. No se notificó a responsables ni se aplicó la propuesta.')
      } else {
        await submitConfigurationChange(proposalId)
        setProposals(await getConfigurationChanges(user))
        setMessage('La propuesta fue enviada a revisión. Aún requiere una decisión autorizada y no cambia la configuración activa.')
      }
    } catch (error) {
      setLoadError(`No se pudo enviar la propuesta a revisión: ${error.message}`)
    }
  }

  const handleReviewDecision = async (proposal, decision) => {
    try {
      setLoadError('')
      const comment = reviewComments[proposal.id] || ''
      await decideConfigurationChange(proposal.id, decision, comment)
      setProposals(await getConfigurationChanges(user))
      setReviewComments((current) => ({ ...current, [proposal.id]: '' }))
      setMessage(
        decision === 'approved'
          ? 'La propuesta fue aprobada, pero no publicada ni aplicada.'
          : 'La propuesta fue rechazada. El motivo quedó registrado.'
      )
    } catch (error) {
      setLoadError(`No se pudo registrar la decisión: ${error.message}`)
    }
  }

  const handleNewVersion = (proposal) => {
    setRevisionSource(proposal)
    setForm({
      title: proposal.title,
      domain: proposal.domain,
      scope: proposal.scope,
      rationale: proposal.rationale,
      proposal: proposal.proposal,
      impact: proposal.impact,
      rollbackPlan: proposal.rollbackPlan,
      validationEvidence: proposal.validationEvidence,
      confirmNoSensitiveData: true
    })
    setErrors({})
    setMessage(`Preparando una nueva versión de la propuesta ${proposal.changeId}. La versión anterior se conservará.`)
  }

  const canPropose = isDemo || hasPermission(user, 'configuracion.proponer')
  const canReview = !isDemo && hasPermission(user, 'configuracion.revisar')
  const canReviewHighImpact = hasPermission(user, 'configuracion.aprobar_alto_riesgo')
  const domainsById = new Map(CONFIGURATION_DOMAINS.map((domain) => [domain.id, domain]))
  const orderedProposals = [...proposals].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )

  return (
    <section>
      <h1>Administración institucional</h1>
      <p className="admin-intro">
        PASMU está diseñado para adaptarse al contexto. Las configuraciones de negocio
        deben poder evolucionar con responsables, vigencia y trazabilidad; el historial
        clínico y los controles de seguridad no se sobrescriben como simples preferencias.
      </p>

      {!isDemo ? (
        <div className="governance-notice" role="status">
          <strong>Registro institucional versionado</strong>
          <p>
            Las propuestas y revisiones se consultan mediante permisos y RLS. Una aprobación
            no publica ni activa el cambio. Si la migración o los permisos aún no están
            instalados, el sistema mostrará el error y no usará almacenamiento local.
          </p>
        </div>
      ) : (
        <div className="governance-notice demo" role="status">
          <strong>Demostración local, no registro institucional</strong>
          <p>
            Los borradores se guardan únicamente en este navegador. No los compartas
            entre personas ni incluyas nombres, datos de contacto, notas clínicas,
            identificadores o detalles de casos. El envío a revisión es una simulación.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="toolbar">
          <div>
            <h2>Ámbitos que podrán configurarse</h2>
            <p className="form-hint">
              Cada ámbito requiere una ruta de aprobación adecuada; proponer no significa publicar.
            </p>
          </div>
          <span className="tag">Configuración versionada</span>
        </div>
        <div className="module-grid">
          {CONFIGURATION_DOMAINS.map((domain) => (
            <article key={domain.id} className="mini-panel">
              <h3>{domain.label}</h3>
              <p><strong>Validación prevista:</strong> {domain.approval}.</p>
              <span className={`status-pill ${['roles_permissions', 'clinical_protocols', 'privacy_retention', 'security_platform'].includes(domain.id) ? 'restricted' : ''}`}>
                {['roles_permissions', 'clinical_protocols', 'privacy_retention', 'security_platform'].includes(domain.id)
                  ? 'Cambio de riesgo elevado'
                  : 'Cambio gobernado'}
              </span>
            </article>
          ))}
        </div>
      </div>

      <div className="panel governance-workspace">
        <h2>{revisionSource ? `Nueva versión · ${revisionSource.changeId}` : 'Proponer una modificación'}</h2>
        <p>
          Una propuesta documenta el motivo y el alcance del cambio. En la versión de
          producción, la activación deberá incluir aprobación autorizada, fecha de vigencia,
          controles de impacto y mecanismo de reversión.
        </p>

        {canPropose ? (
          <form className="governance-form" onSubmit={handleSaveDraft} noValidate>
            <label>
              Nombre del cambio
              <input
                value={form.title}
                maxLength={120}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'config-title-error' : undefined}
              />
              {errors.title && <span id="config-title-error" className="form-error">{errors.title}</span>}
            </label>
            <label>
              Ámbito de configuración
              <select
                value={form.domain}
                onChange={(event) => setForm({ ...form, domain: event.target.value })}
                aria-invalid={Boolean(errors.domain)}
                aria-describedby={errors.domain ? 'config-domain-error' : undefined}
              >
                <option value="">Selecciona un ámbito</option>
                {CONFIGURATION_DOMAINS.map((domain) => (
                  <option key={domain.id} value={domain.id}>{domain.label}</option>
                ))}
              </select>
              {errors.domain && <span id="config-domain-error" className="form-error">{errors.domain}</span>}
              {form.domain && (
                <span className="form-hint">
                  Revisión prevista: {domainsById.get(form.domain)?.approval}.
                </span>
              )}
            </label>
            <label>
              Ámbito organizacional (sin identificar personas)
              <input
                value={form.scope}
                maxLength={120}
                onChange={(event) => setForm({ ...form, scope: event.target.value })}
                aria-invalid={Boolean(errors.scope)}
              />
              {errors.scope && <span className="form-error">{errors.scope}</span>}
            </label>
            <label>
              Motivo y necesidad observada
              <textarea
                value={form.rationale}
                maxLength={1000}
                rows={3}
                onChange={(event) => setForm({ ...form, rationale: event.target.value })}
                aria-invalid={Boolean(errors.rationale)}
              />
              {errors.rationale && <span className="form-error">{errors.rationale}</span>}
            </label>
            <label>
              Cambio propuesto y efecto esperado
              <textarea
                value={form.proposal}
                maxLength={3000}
                rows={4}
                onChange={(event) => setForm({ ...form, proposal: event.target.value })}
                aria-invalid={Boolean(errors.proposal)}
              />
              {errors.proposal && <span className="form-error">{errors.proposal}</span>}
            </label>
            <label>
              Impacto previsto y personas/procesos afectados
              <textarea
                value={form.impact}
                maxLength={2000}
                rows={3}
                onChange={(event) => setForm({ ...form, impact: event.target.value })}
                aria-invalid={Boolean(errors.impact)}
              />
              {errors.impact && <span className="form-error">{errors.impact}</span>}
            </label>
            <label>
              Plan de reversión si el cambio produce efectos no deseados
              <textarea
                value={form.rollbackPlan}
                maxLength={2000}
                rows={3}
                onChange={(event) => setForm({ ...form, rollbackPlan: event.target.value })}
                aria-invalid={Boolean(errors.rollbackPlan)}
              />
              {errors.rollbackPlan && <span className="form-error">{errors.rollbackPlan}</span>}
            </label>
            <label>
              Pruebas o evidencia de validación prevista/realizada
              <textarea
                value={form.validationEvidence}
                maxLength={2000}
                rows={3}
                onChange={(event) => setForm({ ...form, validationEvidence: event.target.value })}
                aria-invalid={Boolean(errors.validationEvidence)}
              />
              {errors.validationEvidence && <span className="form-error">{errors.validationEvidence}</span>}
            </label>
            <label className="governance-confirmation">
              <input
                type="checkbox"
                checked={form.confirmNoSensitiveData}
                onChange={(event) => setForm({ ...form, confirmNoSensitiveData: event.target.checked })}
                aria-invalid={Boolean(errors.confirmNoSensitiveData)}
              />
              Confirmo que esta propuesta no incluye datos personales, identificadores,
              información clínica ni detalles que permitan reconocer un caso.
              {errors.confirmNoSensitiveData && <span className="form-error">{errors.confirmNoSensitiveData}</span>}
            </label>
            <div className="toolbar">
              {revisionSource && (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => {
                    setForm(emptyForm)
                    setRevisionSource(null)
                    setErrors({})
                    setMessage('')
                  }}
                >
                  Cancelar nueva versión
                </button>
              )}
              <button className="primary-btn" type="submit" disabled={Boolean(loadError)}>
                {isDemo ? 'Guardar borrador local' : 'Guardar borrador institucional'}
              </button>
            </div>
          </form>
        ) : (
          <p className="empty-state">
            Tu sesión puede consultar propuestas, pero no tiene el permiso
            `configuracion.proponer` para iniciar una modificación.
          </p>
        )}

        {loadError && <p className="form-error" role="alert">{loadError}</p>}
        {message && <p className="connection-status" role="status">{message}</p>}
      </div>

      <div className="panel">
        <div className="toolbar">
          <h2>Historial de propuestas</h2>
          <span className="tag">
            {isDemo
              ? 'Almacenamiento local de demostración'
              : 'Servicio institucional · máximo 100 versiones recientes'}
          </span>
        </div>
        {!isDemo && orderedProposals.length === 100 && (
          <p className="form-hint" role="status">
            Se muestran las 100 versiones más recientes; pueden existir más registros en otros periodos.
          </p>
        )}
        {loading ? (
          <p className="empty-state" role="status">Cargando propuestas y revisiones…</p>
        ) : loadError && orderedProposals.length === 0 ? (
          <p className="empty-state">No se pudo verificar el historial; revisa el mensaje de error anterior.</p>
        ) : orderedProposals.length === 0 ? (
          <p className="empty-state">
            {isDemo
              ? 'Aún no hay propuestas guardadas en este navegador.'
              : 'No hay propuestas visibles en el ámbito permitido, o todavía no se ha creado ninguna.'}
          </p>
        ) : (
          <div className="governance-list">
            {orderedProposals.map((proposal) => (
              <article key={proposal.id} className="mini-panel governance-proposal">
                <div className="toolbar">
                  <div>
                    <h3>{proposal.title}</h3>
                    <p>{domainsById.get(proposal.domain)?.label} · {proposal.scope}</p>
                  </div>
                  <span className={`status-pill ${proposal.status === 'rejected' ? 'restricted' : ''}`}>
                    {statusLabels[proposal.status] || proposal.status}
                  </span>
                </div>
                <p><strong>Versión:</strong> {proposal.version} · <strong>Propuesta por:</strong> {proposal.createdBy}</p>
                <p><strong>Motivo:</strong> {proposal.rationale}</p>
                <p><strong>Propuesta:</strong> {proposal.proposal}</p>
                <p><strong>Impacto previsto:</strong> {proposal.impact}</p>
                <p><strong>Reversión:</strong> {proposal.rollbackPlan}</p>
                <p><strong>Validación:</strong> {proposal.validationEvidence}</p>
                {proposal.legacyFormat && (
                  <p className="form-hint">
                    Borrador local de formato anterior. Sus datos se conservaron; crea una nueva versión
                    y completa impacto, reversión y evidencia antes de enviarlo a revisión.
                  </p>
                )}
                <small>Creada {formatDate(proposal.createdAt)}</small>
                {proposal.submittedAt && <small> · Enviada {formatDate(proposal.submittedAt)}</small>}
                {proposal.reviewedAt && (
                  <p>
                    <strong>Decisión:</strong> {proposal.reviewDecision === 'approved' ? 'Aprobada (no publicada)' : 'Rechazada'}
                    {' · '}{formatDate(proposal.reviewedAt)}
                    {proposal.reviewComment && <><br /><strong>Comentario:</strong> {proposal.reviewComment}</>}
                  </p>
                )}
                {isDemo && (
                  <div className="governance-actions">
                    {proposal.status === 'draft' && (
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => handleSubmitForReview(proposal.id)}
                      >
                        Enviar a revisión (simulación)
                      </button>
                    )}
                    {proposal.status !== 'in_review' && (
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => handleNewVersion(proposal)}
                      >
                        Crear nueva versión
                      </button>
                    )}
                  </div>
                )}
                {!isDemo && (
                  <div className="governance-actions">
                    {canPropose
                      && proposal.status === 'draft'
                      && proposal.createdById === user?.id
                      && (
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => handleSubmitForReview(proposal.id)}
                        >
                          Enviar a revisión
                        </button>
                      )}
                    {canPropose
                      && proposal.status !== 'in_review'
                      && (
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => handleNewVersion(proposal)}
                        >
                          Crear nueva versión
                        </button>
                      )}
                    {canReview
                      && proposal.status === 'in_review'
                      && proposal.createdById !== user?.id
                      && (
                        <div className="governance-review">
                          <label>
                            Comentario de revisión
                            <textarea
                              rows={2}
                              maxLength={1000}
                              value={reviewComments[proposal.id] || ''}
                              onChange={(event) => setReviewComments((current) => ({
                                ...current,
                                [proposal.id]: event.target.value
                              }))}
                            />
                          </label>
                          <div className="governance-actions">
                            <button
                              className="primary-btn"
                              type="button"
                              onClick={() => handleReviewDecision(proposal, 'approved')}
                              disabled={
                                ['roles_permissions', 'clinical_protocols', 'privacy_retention', 'security_platform'].includes(proposal.domain)
                                && !canReviewHighImpact
                              }
                            >
                              Aprobar (no publicar)
                            </button>
                            <button
                              className="secondary-btn"
                              type="button"
                              onClick={() => handleReviewDecision(proposal, 'rejected')}
                              disabled={
                                ['roles_permissions', 'clinical_protocols', 'privacy_retention', 'security_platform'].includes(proposal.domain)
                                && !canReviewHighImpact
                              }
                            >
                              Rechazar con motivo
                            </button>
                          </div>
                          {['roles_permissions', 'clinical_protocols', 'privacy_retention', 'security_platform'].includes(proposal.domain)
                            && !canReviewHighImpact
                            && <small>Este dominio requiere `configuracion.aprobar_alto_riesgo`.</small>}
                        </div>
                      )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
