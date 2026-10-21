/* ============================================================
   VISOR DE ARCHIVOS DE UN BOTÓN
   ------------------------------------------------------------
   «Ver aquí» según el tipo:
     · PDF            → visor de la plataforma (PdfViewer)
     · Word/Excel/PPT → visor en línea de Office, con una dirección
                        firmada que caduca en una hora
     · Imagen, TXT/CSV → se muestran directamente
     · Otros (ZIP…)   → solo descarga
   ============================================================ */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BOTONES_PDF_BUCKET } from '../config'
import { tipoDeArchivo, nombreDeArchivo } from '../lib/botonesPdf'
import { PdfViewer } from './RecursosModulo'

export const sePuedeVer = (archivo) => tipoDeArchivo(archivo) !== 'descarga'

export async function descargarArchivo(archivo) {
  const { data, error } = await supabase.storage.from(BOTONES_PDF_BUCKET).download(archivo)
  if (error) throw error
  const a = document.createElement('a')
  a.href = URL.createObjectURL(data)
  a.download = nombreDeArchivo(archivo)
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

export default function VisorArchivo({ archivo }) {
  const tipo = tipoDeArchivo(archivo)
  const [url, setUrl] = useState(null)
  const [texto, setTexto] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tipo === 'pdf' || tipo === 'descarga') return
    let vivo = true
    ;(async () => {
      try {
        if (tipo === 'texto') {
          const { data, error: e } = await supabase.storage.from(BOTONES_PDF_BUCKET).download(archivo)
          if (e) throw e
          const t = await data.text()
          if (vivo) setTexto(t)
        } else {
          const { data, error: e } = await supabase.storage.from(BOTONES_PDF_BUCKET).createSignedUrl(archivo, 3600)
          if (e || !data?.signedUrl) throw e || new Error('permiso denegado')
          if (vivo) setUrl(data.signedUrl)
        }
      } catch (e) { if (vivo) setError(e.message || 'No se pudo abrir el archivo') }
    })()
    return () => { vivo = false }
  }, [archivo, tipo])

  if (tipo === 'pdf') return <PdfViewer archivo={archivo} bucket={BOTONES_PDF_BUCKET} />
  if (tipo === 'descarga') return <p className="aviso-info">Este tipo de archivo no se puede ver aquí; usa «Descargar».</p>
  if (error) return <div className="aviso-error">No se pudo cargar el archivo: {error}</div>
  if (tipo === 'texto') {
    return texto == null ? <div className="loading">Cargando…</div>
      : <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '70vh', overflow: 'auto' }}>{texto}</pre>
  }
  if (!url) return <div className="loading">Cargando…</div>
  if (tipo === 'imagen') return <img src={url} alt={nombreDeArchivo(archivo)} style={{ maxWidth: '100%', height: 'auto' }} />
  return (
    <iframe title={nombreDeArchivo(archivo)} style={{ width: '100%', height: '75vh', border: '1px solid #D6DCE3', borderRadius: 10 }}
      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} />
  )
}
