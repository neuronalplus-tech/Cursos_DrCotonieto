/* ============================================================
   GESTIÓN · CONSTANCIA DE UN CURSO O TALLER
   ------------------------------------------------------------
   Todo lo de la constancia en un solo sitio: si los participantes
   la ven (y la pueden descargar), qué dice, si lleva horas y su
   vista previa. La vista previa usa el MISMO htmlConstancia que
   imprime el participante, así que solo el equipo ve la constancia
   mientras no se active la visibilidad.
   ============================================================ */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fechaConLetra } from '../lib/plantillas'
import {
  htmlConstancia, FIRMA_URL, LOGO_URL, PRESETS_CONSTANCIA, TITULO_CONSTANCIA, TEXTO_CONSTANCIA,
} from '../lib/constancia-html'

export default function GestionConstancia({ curso, onGuardado }) {
  const gratuito = curso.gratuito === true
  const [f, setF] = useState({
    visible: gratuito ? curso.constancia_gratuita_activa === true : curso.constancia !== false,
    titulo: curso.constancia_titulo || TITULO_CONSTANCIA,
    texto: curso.constancia_texto || TEXTO_CONSTANCIA,
    incluirHoras: curso.constancia_incluir_horas !== false,
    horas: curso.constancia_horas || null,
    mostrarNota: curso.constancia_mostrar_nota !== false,
  })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [verPrevia, setVerPrevia] = useState(true)
  const campo = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const origen = typeof window === 'undefined' ? '' : window.location.origin

  const guardar = async () => {
    if (!f.texto.trim() || !f.titulo.trim()) { setMsg({ tipo: 'error', texto: 'El título y el texto no pueden quedar vacíos.' }); return }
    setGuardando(true); setMsg(null)
    const upd = {
      constancia_titulo: f.titulo.trim(),
      constancia_texto: f.texto.trim(),
      constancia_incluir_horas: f.incluirHoras,
      constancia_horas: f.horas || null,
      constancia_mostrar_nota: f.mostrarNota,
      ...(gratuito ? { constancia_gratuita_activa: f.visible } : { constancia: f.visible }),
    }
    const { data, error } = await supabase.from('cursos').update(upd).eq('id', curso.id).select().maybeSingle()
    setGuardando(false)
    if (error || !data) {
      setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + (error?.message || 'la base no lo permitió (permisos).') +
        ' Si dice que falta una columna, corre supabase/CONSTANCIAS_7_TEXTO_EDITABLE.sql en el SQL Editor.' })
      return
    }
    onGuardado(data)
    setMsg({ tipo: 'ok', texto: f.visible ? 'Guardado. Los participantes ya ven la constancia.' : 'Guardado. Los participantes todavía no la ven.' })
  }

  return (
    <div className="gestion-form">
      <label>
        <input type="checkbox" checked={f.visible} onChange={(e) => campo('visible', e.target.checked)} />
        {' '}Visible para los participantes (pueden descargarla)
      </label>
      <p className="nota">
        {gratuito
          ? 'Apagada: nadie ve ni descarga la constancia; solo tú la ves aquí en la vista previa. Enciéndela cuando el taller haya terminado.'
          : 'Apagada: este curso no emite constancia. Encendida, se habilita al alcanzar la calificación mínima.'}
      </p>

      <label>Plantillas de texto (atajos; después puedes editarlo)</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS_CONSTANCIA.map((p) => (
          <button key={p.nombre} type="button" className="button secondary"
                  onClick={() => setF((x) => ({ ...x, titulo: p.titulo, texto: p.texto }))}>
            {p.nombre}
          </button>
        ))}
      </div>

      <label htmlFor="gc-titulo">Título del documento</label>
      <input id="gc-titulo" className="input" maxLength={60} value={f.titulo} onChange={(e) => campo('titulo', e.target.value)}
             placeholder={TITULO_CONSTANCIA} />

      <label htmlFor="gc-texto">Texto antes del nombre del curso</label>
      <input id="gc-texto" className="input" maxLength={140} value={f.texto} onChange={(e) => campo('texto', e.target.value)}
             placeholder={TEXTO_CONSTANCIA} />
      <p className="nota">Se lee así: «Se otorga a <em>nombre</em> … <em>{f.texto || '…'}</em> «{curso.titulo}»».</p>

      <label>
        <input type="checkbox" checked={f.incluirHoras} onChange={(e) => campo('incluirHoras', e.target.checked)} />
        {' '}Incluir número de horas
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.9rem', color: '#666' }}>Horas:</span>
        <input className="input" type="number" min="1" max="999" style={{ maxWidth: 120 }}
               value={f.horas == null ? '' : f.horas}
               onChange={(e) => campo('horas', e.target.value === '' ? null : Number(e.target.value))}
               placeholder="Ej. 4" />
      </label>

      <label>
        <input type="checkbox" checked={f.mostrarNota} onChange={(e) => campo('mostrarNota', e.target.checked)} />
        {' '}Mostrar la calificación final (si el curso tiene)
      </label>
      <p className="nota">Quítala en constancias de asistencia. Los talleres gratuitos nunca la muestran.</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="button secondary" onClick={() => setVerPrevia((v) => !v)}>
          {verPrevia ? 'Ocultar vista previa' : '👁️ Vista previa'}
        </button>
      </div>
      {msg && <p className={msg.tipo === 'error' ? 'aviso-error' : 'aviso-ok'}>{msg.texto}</p>}

      {verPrevia && (
        <>
          <p className="nota">Vista previa con lo escrito arriba (aunque no lo hayas guardado). Nombre y folio son de ejemplo.</p>
          <iframe
            title="Vista previa de la constancia"
            style={{ width: '100%', height: '72vh', border: '1px solid #D6DCE3', borderRadius: 10, background: '#e8e5df' }}
            srcDoc={htmlConstancia({
              nombre: 'María Fernanda López Hernández',
              curso: curso.titulo || '',
              nota10: gratuito ? null : 9.5,
              folio: 'EJEMPLO-2026-VISTAPREVIA',
              fecha: fechaConLetra(new Date()),
              firmaUrl: origen + FIRMA_URL,
              logoUrl: origen + LOGO_URL,
              incluirHoras: f.incluirHoras,
              horas: f.horas,
              titulo: f.titulo,
              texto: f.texto,
              mostrarNota: f.mostrarNota,
            })}
          />
        </>
      )}
    </div>
  )
}
