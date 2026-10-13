/* ============================================================
   MIS APUNTES — bloc privado del alumno, por módulo
   ------------------------------------------------------------
   Lo escribe el alumno, lo ve solo el alumno (la privacidad la
   garantiza la RLS de la tabla `apuntes`, no esta pantalla). Si la
   tabla todavía no existe —falta correr APUNTES.sql— el panel
   simplemente no aparece, en vez de romper la vista del módulo.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MisApuntes({ moduloId, user }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState('idle') // idle | guardando | guardado | error
  const [disponible, setDisponible] = useState(true)

  useEffect(() => {
    if (!user?.id || !moduloId) return
    let vivo = true
    supabase.from('apuntes').select('texto')
      .eq('usuario_id', user.id).eq('modulo_id', moduloId).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        if (error && (error.code === '42P01' || /does not exist|could not find/i.test(error.message || ''))) {
          setDisponible(false); return
        }
        setTexto(data?.texto || '')
      })
    return () => { vivo = false }
  }, [user?.id, moduloId])

  if (!user || !disponible) return null

  const guardar = async () => {
    setEstado('guardando')
    const { error } = await supabase.from('apuntes').upsert({
      usuario_id: user.id,
      modulo_id: moduloId,
      texto,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: 'usuario_id,modulo_id' })
    if (error && (error.code === '42P01' || /does not exist|could not find/i.test(error.message || ''))) {
      setDisponible(false); return
    }
    setEstado(error ? 'error' : 'guardado')
    if (!error) setTimeout(() => setEstado('idle'), 2000)
  }

  return (
    <section className="mis-apuntes">
      <button type="button" className="button texto" aria-expanded={abierto}
              onClick={() => setAbierto(a => !a)}>
        📝 Mis apuntes {abierto ? '▲' : '▼'}
      </button>
      {abierto && (
        <div style={{ marginTop: 8 }}>
          <p className="nota" style={{ marginTop: 0 }}>Privado: solo tú ves estas notas.</p>
          <textarea rows="5" className="input" value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Escribe aquí tus notas de este módulo…" />
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="button secondary" onClick={guardar}
                    disabled={estado === 'guardando'}>
              {estado === 'guardando' ? 'Guardando…' : 'Guardar apuntes'}
            </button>
            {estado === 'guardado' && <span className="aviso-ok" style={{ margin: 0 }}>Guardado ✓</span>}
            {estado === 'error' && <span className="aviso-error" style={{ margin: 0 }}>No se pudo guardar.</span>}
          </div>
        </div>
      )}
    </section>
  )
}
