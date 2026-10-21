/* ============================================================
   BOTONES EXTRA DE UNA RUTA O DE UN MÓDULO
   ------------------------------------------------------------
   Enlace normal → se abre en pestaña aparte. Botón con archivo
   (`archivo`: PDF, Word, Excel…) → dos botones: «Ver aquí» (se
   despliega debajo, dentro de la plataforma) y «Descargar».
   ============================================================ */
import { useState } from 'react'
import VisorArchivo, { sePuedeVer, descargarArchivo } from './VisorArchivo'

export default function BotonesExtra({ botones, clase, logueado = true }) {
  const [abierto, setAbierto] = useState(null)
  if (!botones?.length) return null
  const descargar = (archivo) => descargarArchivo(archivo).catch((e) => alert('No se pudo descargar: ' + e.message))
  return (
    <>
      <div className={clase}>
        {botones.map((b, i) => {
          const oculto = b.activo === false ? ' (oculto)' : ''
          if (!b.archivo) return (
            <a key={i} className={`button ${b.estilo || 'azul'}`} target="_blank" rel="noopener noreferrer" href={b.url}>
              {b.texto}{oculto}
            </a>
          )
          return (
            <span key={i} style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {sePuedeVer(b.archivo) && (
                <button type="button" className={`button ${b.estilo || 'azul'}`}
                        aria-expanded={abierto === i} onClick={() => setAbierto(abierto === i ? null : i)}>
                  {abierto === i ? 'Ocultar' : 'Ver aquí'} · {b.texto}{oculto}
                </button>
              )}
              {logueado && (
                <button type="button" className="button secondary" onClick={() => descargar(b.archivo)}>
                  ⬇ Descargar{sePuedeVer(b.archivo) ? '' : ` · ${b.texto}`}
                </button>
              )}
            </span>
          )
        })}
      </div>
      {abierto != null && botones[abierto]?.archivo && (
        logueado
          ? <div className="recurso-contenido" style={{ marginTop: 12 }}><VisorArchivo archivo={botones[abierto].archivo} /></div>
          : <p className="aviso-info">Inicia sesión para ver este documento.</p>
      )}
    </>
  )
}
