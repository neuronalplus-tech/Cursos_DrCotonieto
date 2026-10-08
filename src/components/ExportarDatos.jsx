/* ============================================================
   EXPORTAR · llevarse los datos de la organización
   ------------------------------------------------------------
   Vive dentro de la pestaña de organizaciones y también se le
   ofrece al administrador de un cliente sobre lo suyo. Las dos
   cosas usan el mismo camino: lo que sale es exactamente lo que
   las políticas de la base dejan leer a quien pulsa.

   POR QUÉ IMPORTA MÁS DE LO QUE PARECE
   Un cliente que no puede llevarse sus datos está atrapado, y eso
   se nota en la negociación: las instituciones preguntan por la
   salida antes de firmar la entrada. Tener el botón es un
   argumento de venta, no solo una obligación legal.
   ============================================================ */

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  recolectar, descargar, leeme, nombreSeguro, CONJUNTOS,
} from '../lib/exportar'

export default function ExportarDatos({ organizacion, compacto = false }) {
  const [trabajando, setTrabajando] = useState(false)
  const [paso, setPaso] = useState(null)
  const [msg, setMsg] = useState(null)

  const exportar = async () => {
    if (!organizacion?.id) return
    setTrabajando(true)
    setMsg(null)
    try {
      const partes = await recolectar(
        supabase, organizacion.id,
        (texto, hechos, total) => setPaso({ texto, hechos, total }),
      )
      const fecha = new Date().toISOString().slice(0, 10)
      const base = `${nombreSeguro(organizacion.nombre)}-${fecha}`

      // Se descarga archivo por archivo, con una pausa mínima entre
      // ellos: los navegadores bloquean una ráfaga de descargas
      // seguidas tomándola por un anuncio.
      descargar(`${base}-LEEME.txt`, leeme(organizacion, partes, fecha),
        'text/plain;charset=utf-8;')
      for (const p of partes) {
        await new Promise(r => setTimeout(r, 250))
        descargar(`${base}-${p.nombre}.csv`, p.csv)
      }

      const total = partes.reduce((s, p) => s + p.filas, 0)
      setMsg({
        tipo: 'ok',
        texto: `Listo: ${partes.length + 1} archivos con ${total} registro(s) en total. ` +
          'Si el navegador te pidió permiso para varias descargas, acéptalo.',
      })
    } catch (e) {
      setMsg({ tipo: 'error', texto: 'No se pudo exportar: ' + (e.message || String(e)) })
    } finally {
      setTrabajando(false)
      setPaso(null)
    }
  }

  if (compacto) {
    return (
      <div className="exportar-compacto">
        <button type="button" className="button secondary"
                onClick={exportar} disabled={trabajando}>
          {trabajando ? `Preparando… ${paso?.hechos ?? 0}/${paso?.total ?? ''}` : '⬇️ Descargar mis datos'}
        </button>
        {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}
      </div>
    )
  }

  return (
    <div className="exportar">
      <h4>Llevarse los datos</h4>
      <p className="nota" style={{ marginTop: 0 }}>
        Un paquete de archivos CSV con todo lo de <strong>{organizacion?.nombre}</strong>:
        cursos, módulos, recursos, inscripciones, progreso, exámenes, tareas,
        calificaciones, foro y constancias. Incluye un <code>LEEME.txt</code> que
        explica qué es cada archivo y cómo se relacionan entre sí.
      </p>

      <details className="exportar-detalle">
        <summary>Qué incluye, y qué no</summary>
        <ul>
          {CONJUNTOS.map(c => <li key={c.clave}>{c.titulo}</li>)}
        </ul>
        <p className="nota">
          <strong>No incluye</strong> contraseñas —están cifradas con un algoritmo
          que no se puede revertir, así que no existen en claro en ningún sitio—,
          ni los archivos que subieron los alumnos en sus entregas (sí viene la
          ruta de cada uno y su calificación), ni la bitácora ni la información
          de cobro, que son de la plataforma y no de la organización.
        </p>
      </details>

      <button type="button" className="button primary"
              onClick={exportar} disabled={trabajando || !organizacion?.id}>
        {trabajando ? 'Preparando…' : '⬇️ Exportar todo'}
      </button>

      {paso && (
        <p className="nota">
          {paso.texto}… ({paso.hechos} de {paso.total})
        </p>
      )}
      {msg && (
        <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}
           style={{ marginTop: 10 }}>{msg.texto}</p>
      )}

      <p className="nota" style={{ marginTop: 12 }}>
        Se descarga un archivo por conjunto, con una pausa entre ellos. El
        navegador puede pedirte permiso para descargar varios a la vez: es
        normal, acéptalo.
      </p>
    </div>
  )
}
