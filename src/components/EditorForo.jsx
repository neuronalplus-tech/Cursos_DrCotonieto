/* ============================================================
   EDITOR DE TEXTO DEL FORO
   ------------------------------------------------------------
   Dos modos, como en los comunicados:
   · RICO → barra de formato (negrita, cursiva, listas, cita, enlace)
   · HTML → pegar y editar el HTML a mano

   Todo lo que sale pasa por `sanear()`, así que ni lo que escribe el
   admin ni lo que escribe un alumno puede inyectar algo.
   ============================================================ */

import { useEffect, useRef, useState } from 'react'
import { ModalPortal } from './ui'
import { sanear } from '../lib/foro'

// onMouseDown con preventDefault es lo que mantiene el foco dentro del
// contenteditable: si el botón lo pierde, el navegador deshace la selección
// y execCommand no aplica nada.
const BOTONES = [
  { titulo: 'Negrita', cmd: 'bold', etiqueta: 'B', estilo: { fontWeight: '700' } },
  { titulo: 'Cursiva', cmd: 'italic', etiqueta: 'I', estilo: { fontStyle: 'italic' } },
  { titulo: 'Subrayado', cmd: 'underline', etiqueta: 'U', estilo: { textDecoration: 'underline' } },
  { sep: true },
  { titulo: 'Lista', cmd: 'insertUnorderedList', etiqueta: '• Lista' },
  { titulo: 'Lista numerada', cmd: 'insertOrderedList', etiqueta: '1. Lista' },
  { titulo: 'Cita', cmd: 'formatBlock', arg: '<blockquote>', etiqueta: '❝ Cita' },
  { sep: true },
  { titulo: 'Quitar formato', cmd: 'removeFormat', etiqueta: '✕ Formato', peligro: true },
]

export default function EditorForo({ valor, onChange, placeholder, minAlto = 140, onGuardar }) {
  const [htmlAbierto, setHtmlAbierto] = useState(false)
  const [htmlTexto, setHtmlTexto] = useState('')
  const areaRef = useRef(null)

  // El contenidoEditable se inicializa una sola vez: si se re-renderiza
  // en cada pulsación, React reescribe el innerHTML y se pierde el cursor.
  const montado = useRef(false)
  useEffect(() => {
    if (!montado.current && areaRef.current) {
      if (valor) areaRef.current.innerHTML = valor
      montado.current = true
    }
  }, [valor])

  useEffect(() => {
    if (htmlAbierto && areaRef.current) areaRef.current.focus()
  }, [htmlAbierto])

  const ejecutar = (cmd, arg = null) => {
    areaRef.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(sanear(areaRef.current?.innerHTML || ''))
  }

  const insertaEnlace = () => {
    const url = window.prompt('Escribe la liga (https://…)')
    if (!url) return
    if (!/^(https?:|mailto:|tel:)/i.test(url.trim())) {
      window.alert('Esa liga no es válida. Debe empezar con https://')
      return
    }
    ejecutar('createLink', url.trim())
  }

  const abrirHtml = () => {
    setHtmlTexto(areaRef.current?.innerHTML || valor || '')
    setHtmlAbierto(true)
  }

  const aplicarHtml = () => {
    const limpio = sanear(htmlTexto)
    if (areaRef.current) areaRef.current.innerHTML = limpio
    onChange(limpio)
    setHtmlAbierto(false)
    // Si quien usa el editor tiene un botón de guardar (el tema, la
    // respuesta), se guarda de una vez: entrar al HTML a retocar no
    // debe dejar el trabajo a medias sin avisar.
    if (onGuardar) onGuardar(limpio)
  }

  const limpiar = () => {
    if (areaRef.current) areaRef.current.innerHTML = ''
    onChange('')
  }

  return (
    <div className="editor-foro">
      <div className="editor-toolbar">
        {BOTONES.map((b, i) =>
          b.sep ? (
            <span className="editor-sep" key={'sep' + i} />
          ) : (
            <button
              key={b.cmd}
              type="button"
              className={`editor-btn${b.peligro ? ' editor-btn-peligro' : ''}`}
              title={b.titulo}
              style={b.estilo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ejecutar(b.cmd, b.arg)}
            >
              {b.etiqueta}
            </button>
          )
        )}
        <span className="editor-sep" />
        <button type="button" className="editor-btn" title="Insertar liga"
                onMouseDown={(e) => e.preventDefault()} onClick={insertaEnlace}>🔗 Enlace</button>
        <button type="button" className="editor-btn editor-btn-html" title="Editar el HTML a mano"
                onMouseDown={(e) => e.preventDefault()} onClick={abrirHtml}>&lt;/&gt; HTML</button>
      </div>

      <div
        ref={areaRef}
        className="editor-foro-cuerpo"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Escribe aquí…'}
        style={{ minHeight: minAlto }}
        onInput={(e) => onChange(sanear(e.currentTarget.innerHTML))}
      />

      <p className="nota" style={{ marginTop: 6 }}>
        Puedes usar <strong>formato</strong> o pegar <strong>HTML</strong> directo.
        Se permiten negrita, cursiva, listas, citas y links; el resto se limpia por seguridad.
      </p>

      {htmlAbierto && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setHtmlAbierto(false)}>
            <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
              <h3>Editar HTML</h3>
              <p className="sutil" style={{ marginBottom: 14 }}>
                Pega o edita el HTML. Al aplicar se limpia lo que no esté permitido.
                {onGuardar && ' El tema se guarda en cuanto apliques.'}
              </p>
              <textarea className="modal-textarea modal-textarea-html"
                        value={htmlTexto} onChange={(e) => setHtmlTexto(e.target.value)}
                        spellCheck={false} autoFocus />
              <div className="modal-botones">
                <button type="button" className="button secondary"
                        onClick={() => setHtmlAbierto(false)}>Cancelar</button>
                <button type="button" className="button primary" onClick={aplicarHtml}>
                  {onGuardar ? 'Aplicar y guardar' : 'Aplicar al mensaje'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}