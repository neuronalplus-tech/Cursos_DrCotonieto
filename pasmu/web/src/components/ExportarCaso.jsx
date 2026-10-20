import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getExpediente } from '../services/pasmuService'
import useServiceData from '../hooks/useServiceData'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

function formatFecha(valor) {
  if (!valor) return 'â€”'
  try { return new Date(valor).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) } catch { return valor }
}

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

async function downloadPdf(html, filename) {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.srcdoc = html
  document.body.appendChild(iframe)
  await new Promise((resolve) => { iframe.onload = resolve })
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (doc) { try { doc.execCommand('print', false, null) } catch { /* omit */ } }
  document.body.removeChild(iframe)
  setTimeout(() => URL.revokeObjectURL(iframe.srcdoc), 0)
}

export default function ExportarCaso({ user }) {
  const esDemo = isExperienciaDemo(user)
  if (esDemo) {
    return (
      <section>
        <h1>Exportar expediente (PDF)</h1>
        <p className="form-hint\" role="note\">
          ExploraciÃ³n DEMO: la exportaciÃ³n de expedientes no estÃ¡ disponible en modo de solo lectura.
        </p>
      </section>
    )
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const caseId = searchParams.get('casoId')
  const { data: expediente, loading, error } = useServiceData(getExpediente, user, caseId)

  const generarPdf = () => {
    if (!expediente) return
    const historialItems = expediente.historial?.map((h) => `- ${h}`).join('\n') || 'Sin historial.'
    const datosHtml = expediente.datos
      ? expediente.datos.map((d) => `<tr><td><strong>${escapeHtml(d.etiqueta)}</strong></td><td>${escapeHtml(d.valor)}</td></tr>`).join('')
      : ''
    const historialHtml = historialItems.split('\n').map((h) => `<li>${escapeHtml(h)}</li>`).join('')

    const tablaExpediente = expediente.caso_profesionales
      ? expediente.caso_profesionales.map((cp) => `<tr><td>${escapeHtml(cp.persona?.nombre || cp.persona_id || cp.profesional || '')}</td><td>${escapeHtml(cp.rol_en_caso || '')}</td></tr>`).join('')
      : ''

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 20px; }
      .portada { text-align: center; margin-bottom: 20px; }
      h2 { color: #1a3a5c; margin-bottom: 2px; }
      .subtitulo { color: #5f6c7b; font-size: 12px; }
      .data-grid { width: 100%; border-collapse: collapse; margin: 10px 0; }
      .data-grid td { padding: 6px 8px; border: 1px solid #e4edf7; vertical-align: top; }
      .data-grid td:first-child { background: #f7fbff; width: 35%; }
      .section-title { background: #1a3a5c; color: white; padding: 6px 10px; font-weight: 600; font-size: 12px; margin-top: 20px; }
      ul { margin: 4px 0 14px 18px; padding: 0; }
      li { margin-bottom: 3px; }
      .pista { color: #5f6c7b; font-size: 10px; margin-top: 10px; }
      table.tbody { width: 100%; border-collapse: collapse; }
      table.tbody td { padding: 4px 8px; border: 1px solid #e4edf7; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      button { cursor: pointer; }
    </style></head><body>
      <div class="portada">
        <h2>Expediente clÃ­nico â€” NOM-004</h2>
        <p class="subtitulo">GestiÃ³n PASMU Â· Registro pdf escrito</p>
        <p>Folio: ${escapeHtml(expediente.folio || 'â€”')}</p>
        <p>Paciente: ${escapeHtml(expediente.paciente || 'â€”')}</p>
        <p>Motivo: ${escapeHtml(expediente.motivo || 'â€”')}</p>
        <p>Unidad: ${escapeHtml(expediente.unidad || 'â€”')}</p>
        <p>Programa: ${escapeHtml(expediente.programa || 'â€”')}</p>
        <p>Apertura: ${formatFecha(expediente.fecha_apertura)}</p>
      </div>
      ${expediente.caso_profesionales && expediente.caso_profesionales.length > 0 ? `
        <h3 class="section-title">Equipo del caso</h3>
        <table class="tbody"><tbody>${tablaExpediente}</tbody></table>
      ` : ''}
      <h3 class="section-title">Datos del caso</h3>
      <table class="data-grid"><tbody>${datosHtml}</tbody></table>
      <h3 class="section-title">Historial relevante</h3>
      <ul>${historialHtml}</ul>
      <p class="pista">Generado el ${new Date().toLocaleString('es-MX')}. VersiÃ³n impresa del expediente electrÃ³nico.</p>
    </body></html>`

    downloadPdf(html, `expediente-${expediente.folio || new Date().toISOString().slice(0,10)}.pdf`)
  }

  return (
    <section>
      <h1>Exportar expediente (PDF)</h1>
      {loading && <p role="status">Cargando expedienteâ€¦</p>}
      {error && <p className="form-error" role="alert">No se pudo cargar el expediente: {error}</p>}
      {expediente && hasPermission(user, 'expediente.ver') && (
        <div className="panel">
          <div className="toolbar">
            <h2>Ficha para exportaciÃ³n</h2>
            <button type="button" className="primary-btn" onClick={generarPdf}>Descargar PDF</button>
          </div>
          <div className="data-grid">
            <table><tbody>
              <tr><td><strong>Folio:</strong></td><td>{expediente.folio || 'â€”'}</td></tr>
              <tr><td><strong>Paciente:</strong></td><td>{expediente.paciente || 'â€”'}</td></tr>
              <tr><td><strong>Motivo:</strong></td><td>{expediente.motivo || 'â€”'}</td></tr>
              <tr><td><strong>Unidad:</strong></td><td>{expediente.unidad || 'â€”'}</td></tr>
              <tr><td><strong>Programa:</strong></td><td>{expediente.programa || 'â€”'}</td></tr>
              <tr><td><strong>Apertura:</strong></td><td>{formatFecha(expediente.fecha_apertura)}</td></tr>
            </tbody></table>
          </div>
          {expediente.historial && expediente.historial.length > 0 && (
            <div className="panel" style={{ marginTop: '16px' }}>
              <h3 className="section-title">Historial</h3>
              <ul>
                {expediente.historial.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {!expediente && !loading && <p className="form-hint">Selecciona un caso para exportar a PDF.</p>}
    </section>
  )
}
