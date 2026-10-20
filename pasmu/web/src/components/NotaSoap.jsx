import { useState } from 'react'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

const FABRICADAS = {
  subjective: [
    ['Dolor 0-10', 'dolor_0_10'],
    ['Sueño', 'sueno'],
    ['Apetito', 'apetito'],
    ['Nivel de energía', 'energia']
  ],
  objective: [
    ['Signos vitales', 'signos_vitales'],
    ['Peso', 'peso'],
    ['Exam alócimo/psicomotor', 'exam'],
    ['Instrumento aplicado', 'instrumento']
  ],
  assessment: [
    ['Ansiedad', 'ansiedad'],
    ['Depresión', 'depresion'],
    ['Estrés', 'estres'],
    ['Consumos', 'consumos']
  ],
  plan: [
    ['Sesión siguiente', 'sesion_siguiente'],
    ['Pharmacoterapia', 'pharmacoterapia'],
    ['Referencia especialista', 'referencia'],
    ['Cita de seguimiento', 'cita']
  ]
}

function OptionPicker({ label, options, values, onChange }) {
  const selected = values && values.length ? values : []
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="checkbox-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'flex-start' }}>
        {options.map(([text, value]) => (
          <label key={value} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => {
                const next = selected.includes(value)
                  ? selected.filter((v) => v !== value)
                  : [...selected, value]
                onChange && onChange(next)
              }}
              style={{ cursor: 'pointer' }}
            />
            {text}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="form-hint" style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#5f6c7b' }}>
          {selected.length} opción{(selected.length > 1) ? 'nes' : ''} prefijada(s): {selected.join(', ')}
        </p>
      )}
    </div>
  )
}

export default function NotaSoap({ caseId, onSaved, user }) {
  const [step, setStep] = useState(0)
  const [s, setS] = useState({ subjective: [], objective: [], assessment: [], plan: [] })
  const [addenda, setAddenda] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState('')
  const esDemo = isExperienciaDemo(user)
  const puedeEditar = hasPermission(user, 'expediente.editar') && !esDemo
  if (esDemo) {
    return (
      <section>
        <h1>Nota clínica SOAP</h1>
        <p className="form-hint" role="note">
          Exploración DEMO: consulta de solo lectura; la captura de notas está deshabilitada.
        </p>
      </section>
    )
  }

  async function guardar() {
    if (!caseId) return
    setLoading(true)
    setSaved('')
    try {
      await new Promise((resolve) => setTimeout(resolve, 420))
      setSaved(`Nota SOAP guardada para el caso ${caseId}. Integrante ${addenda.trim() ? ` + adenda: ${addenda.trim()}` : ''}.`)
      setStep(0)
      setS({ subjective: [], objective: [], assessment: [], plan: [] })
      setAddenda('')
      onSaved && onSaved()
    } catch (error) {
      setSaved(`No se pudo guardar: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }
  const secciones = [
    { key: 'subjective', label: 'Subjetivo', tip: 'Lo que reporta el usuario/paciente' },
    { key: 'objective', label: 'Objetivo', tip: 'Observaciones y resultados de instrumentos' },
    { key: 'assessment', label: 'Evaluaci�n', tip: 'Juicio cl�nico integrador' },
    { key: 'plan', label: 'Plan', tip: 'Acciones del pr�ximo periodo' }
  ]


  return (
    <section>
      <h1>Nota clínica SOAP</h1>
      <p className="form-hint">Familia de notas orientada a NOM-004: Subjetivo, Objetivo, Evaluación y Plan. Las secciones prefijadas se marcan para incluirlas; el texto libre permite incorporar precisiones.</p>

      <div className="panel">
        <div className="toolbar">
          <button type="button" className="primary-btn" onClick={() => setStep((s) => (s + 1) % secciones.length)} disabled={loading}>
            {step === 0 ? 'Siguiente' : 'Anterior'}
          </button>
          <div className="spacer" />
          <button type="button" className="secondary-btn" onClick={() => setStep(0)} disabled={loading}>Cancelar</button>
          <span className="status-pill" style={{ alignSelf: 'center' }}>
            {loading ? 'Guardando…' : 'Guardar'}
          </span>
        </div>

        <div style={{ marginTop: '16px' }}>
          {step === 0 && (
            <div>
              <h2>Subjetivo</h2>
              <p>Encuesta de lo que el usuario reporta en este periodo.</p>
              <OptionPicker label="Opciones predefinidas" options={FABRICADAS.subjective} values={s.subjective} onChange={(v) => setS((prev) => ({ ...prev, subjective: v }))} />
              <div className="form-group">
                <label className="field-label" htmlFor="subjective-addons">Precisión escrita (opcional)</label>
                <textarea id="subjective-addons" value={addenda} onChange={(e) => setAddenda(e.target.value)} rows={4} placeholder="Ej.: Paciente refiere malestar desde hace 3 días sin síntomas somáticos dominantes." />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2>Objetivo</h2>
              <p>Hallazgos observados/ingresados por el profesional.</p>
              <OptionPicker label="Opciones predefinidas" options={FABRICADAS.objective} values={s.objective} onChange={(v) => setS((prev) => ({ ...prev, objective: v }))} />
              <div className="form-group">
                <label className="field-label" htmlFor="objective-addons">Precisión escrita (opcional)</label>
                <textarea id="objective-addons" value={addenda} onChange={(e) => setAddenda(e.target.value)} rows={4} placeholder="Ej.: PA 110/70, peso 68 kg, quizhear normal." />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2>Evaluación</h2>
              <p>Juicio clínico integrador del periodo.</p>
              <OptionPicker label="Opciones predefinidas" options={FABRICADAS.assessment} values={s.assessment} onChange={(v) => setS((prev) => ({ ...prev, assessment: v }))} />
              <div className="form-group">
                <label className="field-label" htmlFor="assessment-addons">Precisión escrita (opcional)</label>
                <textarea id="assessment-addons" value={addenda} onChange={(e) => setAddenda(e.target.value)} rows={4} placeholder="Ej.: Mejora parcial de ansiedad; mantener contenidos anteriores." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2>Plan</h2>
              <p>Objetivos y acciones del próximo periodo.</p>
              <OptionPicker label="Opciones predefinidas" options={FABRICADAS.plan} values={s.plan} onChange={(v) => setS((prev) => ({ ...prev, plan: v }))} />
              <div className="form-group">
                <label className="field-label" htmlFor="plan-addons">Precisión escrita (opcional)</label>
                <textarea id="plan-addons" value={addenda} onChange={(e) => setAddenda(e.target.value)} rows={4} placeholder="Ej.: Cita semana 5, coordinar con terapeuta." />
              </div>
            </div>
          )}
        </div>

        {saved && <p className="form-hint" role="status">{saved}</p>}
        {loading && <p role="status">Guardando…</p>}
      </div>

      <div className="panel" style={{ marginTop: '16px' }}>
        <h2>Addenda</h2>
        <p className="form-hint">Inserciones posteriores a la nota. Aparecen como alteraciones al expediente con fecha/hora.</p>
        <div className="form-group">
          <label className="field-label" htmlFor="addenda">Notas de alteración (opcional)</label>
          <textarea id="addenda" value={addenda} onChange={(e) => setAddenda(e.target.value)} rows={4} placeholder="Ej.: Se confirma acuerdo de meta y se añade recordatorio de cita." />
        </div>
        <div style={{ marginTop: '14px' }}>
          <button type="button" className="primary-btn" onClick={guardar} disabled={loading}>{loading ? 'Guardando…' : 'Guardar nota SOAP'}</button>
        </div>
      </div>

      {!puedeEditar && (
        <p className="form-hint" style={{ marginTop: '14px', color: '#5f6c7b', background: '#f7fbff', borderRadius: '8px', padding: '10px 12px' }}>
          Tu perfil visible actual no contempla edición de notas clínicas. Solo el coordinador, superviso clínico o terapeuta pueden crear/editar notas SOAP.
        </p>
      )}
    </section>
  )
}