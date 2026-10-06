/* ============================================================
   BITÁCORA · quién cambió qué
   ------------------------------------------------------------
   La escriben disparadores en Postgres, no la app: así queda
   registro aunque el cambio venga de un script o del SQL Editor,
   y nadie puede omitirlo "no llamando" a nada.

   Aquí solo se lee. La tabla no tiene políticas de escritura, así
   que ni siquiera el admin puede retocarla desde el navegador:
   una bitácora que su autor puede editar no sirve de nada.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const NOMBRE_TABLA = {
  cursos: 'Curso',
  modulos: 'Módulo',
  recursos: 'Recurso',
  examenes: 'Examen',
  foro_hilos: 'Tema del foro',
  facilitadores: 'Facilitador',
  acceso: 'Inscripción',
}

const VERBO = {
  INSERT: { texto: 'creó', clase: 'op-alta' },
  UPDATE: { texto: 'editó', clase: 'op-cambio' },
  DELETE: { texto: 'eliminó', clase: 'op-baja' },
}

/** Campos que no aportan nada al leer un cambio. */
const RUIDO = new Set(['actualizado_en', 'updated_at', 'creado_en', 'created_at'])

function cuando(fecha) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** Un valor de jsonb en una línea legible. */
function resumirValor(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  const s = String(v)
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

export default function AdminBitacora() {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroTabla, setFiltroTabla] = useState('todas')
  const [abierta, setAbierta] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      let q = supabase
        .from('auditoria')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(200)
      if (filtroTabla !== 'todas') q = q.eq('tabla', filtroTabla)

      const { data, error: e } = await q
      if (!vivo) return
      if (e) setError(e.message)
      else { setFilas(data || []); setError(null) }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [filtroTabla])

  const etiqueta = (f) => {
    // El título es lo que identifica la fila para un humano; el id
    // solo sirve si no hay nada mejor.
    const d = f.despues || f.antes || {}
    return d.titulo || d.nombre || d.email || `#${f.registro_id}`
  }

  return (
    <div className="bitacora">
      <p className="seccion-intro">
        Todo cambio en cursos, módulos, recursos, exámenes, foro, inscripciones y
        facilitadores queda registrado aquí, con quién lo hizo y qué decía antes.
        Lo escribe la base de datos, no la aplicación: también registra lo que se
        cambie desde fuera del panel.
      </p>

      <div className="bitacora-barra">
        <label>Mostrar</label>
        <select className="input" value={filtroTabla} onChange={e => setFiltroTabla(e.target.value)}>
          <option value="todas">Todo</option>
          {Object.entries(NOMBRE_TABLA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="aviso-error">
          No se pudo leer la bitácora: {error}
          <br />
          <span className="nota">
            Si dice que la tabla no existe, falta correr <code>supabase/BITACORA.sql</code>.
          </span>
        </p>
      )}

      {cargando ? (
        <p className="nota">Cargando…</p>
      ) : !filas.length ? (
        <p className="nota">
          Todavía no hay movimientos registrados. La bitácora empieza a llenarse
          desde el momento en que se instala.
        </p>
      ) : (
        <div className="bitacora-lista">
          {filas.map(f => {
            const v = VERBO[f.operacion] || { texto: f.operacion, clase: '' }
            const campos = (f.cambios || []).filter(c => !RUIDO.has(c))
            const expandida = abierta === f.id
            return (
              <div key={f.id} className="bitacora-fila">
                <div className="bitacora-cab">
                  <span className={`bitacora-op ${v.clase}`}>{v.texto}</span>
                  <span className="bitacora-que">
                    {NOMBRE_TABLA[f.tabla] || f.tabla} · <strong>{etiqueta(f)}</strong>
                  </span>
                  <span className="nota">{f.autor_email || 'sistema'}</span>
                  <span className="nota">{cuando(f.creado_en)}</span>
                </div>

                {campos.length > 0 && (
                  <div className="bitacora-campos">
                    {campos.slice(0, 6).join(', ')}
                    {campos.length > 6 && ` y ${campos.length - 6} más`}
                  </div>
                )}

                {f.operacion === 'UPDATE' && campos.length > 0 && (
                  <>
                    <button type="button" className="enlace-texto"
                            onClick={() => setAbierta(expandida ? null : f.id)}>
                      {expandida ? '▲ Ocultar detalle' : '▼ Ver qué decía antes'}
                    </button>
                    {expandida && (
                      <table className="bitacora-detalle">
                        <thead>
                          <tr><th>Campo</th><th>Antes</th><th>Después</th></tr>
                        </thead>
                        <tbody>
                          {campos.map(c => (
                            <tr key={c}>
                              <td>{c}</td>
                              <td>{resumirValor(f.antes?.[c])}</td>
                              <td>{resumirValor(f.despues?.[c])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
