/* ============================================================
   BOTONES EXTRA DE UNA RUTA O DE UN MÓDULO
   ------------------------------------------------------------
   Enlace normal → se abre en pestaña aparte. Botón con PDF
   (`archivo`) → «Ver aquí»: el PDF se despliega debajo, dentro de
   la plataforma, igual que la grabación de un taller.
   ============================================================ */
import { useState } from 'react'
import { BOTONES_PDF_BUCKET } from '../config'
import { PdfViewer } from './RecursosModulo'

export default function BotonesExtra({ botones, clase, logueado = true }) {
  const [abierto, setAbierto] = useState(null)
  if (!botones?.length) return null
  return (
    <>
      <div className={clase}>
        {botones.map((b, i) => b.archivo ? (
          <button key={i} type="button" className={`button ${b.estilo || 'azul'}`}
                  aria-expanded={abierto === i} onClick={() => setAbierto(abierto === i ? null : i)}>
            {abierto === i ? 'Ocultar' : '📄'} {b.texto}{b.activo === false ? ' (oculto)' : ''}
          </button>
        ) : (
          <a key={i} className={`button ${b.estilo || 'azul'}`} target="_blank" rel="noopener noreferrer" href={b.url}>
            {b.texto}{b.activo === false ? ' (oculto)' : ''}
          </a>
        ))}
      </div>
      {abierto != null && botones[abierto]?.archivo && (
        logueado
          ? <div className="recurso-contenido" style={{ marginTop: 12 }}>
              <PdfViewer archivo={botones[abierto].archivo} bucket={BOTONES_PDF_BUCKET} />
            </div>
          : <p className="aviso-info">Inicia sesión para ver este documento.</p>
      )}
    </>
  )
}
