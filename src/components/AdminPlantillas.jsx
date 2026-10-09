/* ============================================================
   PLANTILLAS DE DOCUMENTOS
   ------------------------------------------------------------
   El editor de los formatos de cada institución: actas,
   constancias, listas de asistencia.

   POR QUÉ SE EDITA HTML Y NO UN EDITOR VISUAL
   Porque un documento oficial tiene un formato que la institución
   ya tiene definido —márgenes, tipografía, dónde va el folio— y un
   editor visual obliga a reconstruirlo a ojo. Con HTML se pega lo
   que ya existe. A cambio, el panel enseña la lista de marcadores y
   avisa de los que no existen, que es donde de verdad se falla.

   LA VISTA PREVIA ES CON DATOS DE MENTIRA
   Y se dice. Una vista previa con el nombre de un alumno real
   invita a darla por buena sin comprobar que los datos salen de
   donde deben.
   ============================================================ */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import {
  MARCADORES, BLOQUES, EJEMPLOS, rellenar,
  marcadoresDesconocidos, bloquesSinCerrar, conLetra, fechaConLetra,
} from '../lib/plantillas'

const TIPOS = [
  ['constancia', 'Constancia'],
  ['acta', 'Acta de calificaciones'],
  ['lista', 'Lista de asistencia'],
  ['boleta', 'Boleta'],
  ['informe', 'Informe'],
  ['libre', 'Otro'],
]

const VACIA = {
  tipo: 'constancia', nombre: '', descripcion: '', contenido: '',
  membrete_url: '', firma_url: '', firma_nombre: '', firma_cargo: '',
  firma_x: 50, firma_y: 80, firma_ancho: 25,
  orientacion: 'vertical', activa: true,
}

/* Datos de ejemplo para la vista previa. Deliberadamente obvios:
   nadie debe confundirlos con los de un alumno de verdad. */
const MUESTRA = {
  institucion: { nombre: 'NOMBRE DE LA INSTITUCIÓN', contacto: 'contacto@ejemplo.mx' },
  curso: { titulo: 'NOMBRE DEL PROGRAMA' },
  grupo: { nombre: 'GRUPO-EJEMPLO', modalidad: 'Presencial', inicio: '1 de enero de 2026', fin: '30 de junio de 2026' },
  sede: { nombre: 'SEDE DE EJEMPLO' },
  alumno: { nombre: 'NOMBRE DEL ALUMNO', profesion: 'Profesión' },
  calificacion: { final: 90, letra: conLetra(90), tipo: 'Ponderada' },
  asistencia: { porcentaje: 95, sesiones: 20, faltas: 1 },
  docente: { nombre: 'NOMBRE DE QUIEN IMPARTE' },
  fecha: { hoy: fechaConLetra(), lugar: 'Ciudad' },
  alumnos: [
    { nombre: 'PRIMER ALUMNO', calificacion: 95, asistencia: 100, faltas: 0 },
    { nombre: 'SEGUNDO ALUMNO', calificacion: 82, asistencia: 90, faltas: 2 },
  ],
  modulos: [
    { titulo: 'PRIMER MÓDULO', calificacion: 93 },
    { titulo: 'SEGUNDO MÓDULO', calificacion: 87 },
  ],
  sesiones: [
    { fecha: '12 de enero', titulo: 'PRIMERA SESIÓN' },
    { fecha: '19 de enero', titulo: 'SEGUNDA SESIÓN' },
  ],
}

export default function AdminPlantillas() {
  const { organizacion } = useOrganizacion()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VACIA)
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const recargar = async () => {
    if (!organizacion?.id) return
    setCargando(true)
    const { data, error } = await supabase
      .from('plantillas_documento').select('*')
      .eq('organizacion_id', organizacion.id).order('tipo').order('nombre')
    if (error) setMsg({ tipo: 'error', texto: 'No se pudo cargar: ' + error.message })
    setLista(data || [])
    setCargando(false)
  }

  useEffect(() => {
    if (organizacion?.id) recargar()
    else setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacion?.id])

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const problemas = useMemo(() => {
    const desconocidos = marcadoresDesconocidos(form.contenido)
    const sinCerrar = bloquesSinCerrar(form.contenido)
    return { desconocidos, sinCerrar }
  }, [form.contenido])

  const previa = useMemo(() => {
    try { return rellenar(form.contenido, MUESTRA, { escaparHtml: false }) }
    catch { return '' }
  }, [form.contenido])

  const abrirNueva = () => { setForm(VACIA); setEditando('nueva'); setMsg(null) }

  const abrirEdicion = (p) => {
    const f = { ...VACIA }
    for (const k of Object.keys(VACIA)) f[k] = p[k] ?? VACIA[k]
    setForm(f)
    setEditando(p.id)
    setMsg(null)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return setMsg({ tipo: 'error', texto: 'Ponle un nombre.' })
    if (!form.contenido.trim()) return setMsg({ tipo: 'error', texto: 'La plantilla está vacía.' })
    if (problemas.sinCerrar.length) {
      return setMsg({
        tipo: 'error',
        texto: `Falta cerrar el bloque {{/${problemas.sinCerrar[0]}}}. Sin eso, el documento sale incompleto.`,
      })
    }
    setGuardando(true)
    const payload = {
      organizacion_id: organizacion.id,
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      contenido: form.contenido,
      membrete_url: form.membrete_url.trim() || null,
      firma_url: form.firma_url.trim() || null,
      firma_nombre: form.firma_nombre.trim() || null,
      firma_cargo: form.firma_cargo.trim() || null,
      firma_x: Number(form.firma_x) || 50,
      firma_y: Number(form.firma_y) || 80,
      firma_ancho: Number(form.firma_ancho) || 25,
      orientacion: form.orientacion,
      activa: !!form.activa,
    }
    const { error } = editando === 'nueva'
      ? await supabase.from('plantillas_documento').insert(payload)
      : await supabase.from('plantillas_documento').update(payload).eq('id', editando)
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
    setEditando(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Plantilla guardada.' })
  }

  const borrar = async (p) => {
    if (!confirm(`¿Borrar la plantilla «${p.nombre}»?\n\nLos documentos ya descargados no se tocan.`)) return
    const { error } = await supabase.from('plantillas_documento').delete().eq('id', p.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    await recargar()
  }

  if (!organizacion?.id && !cargando) {
    return <p className="aviso-error">No pude saber de qué organización es este sitio.</p>
  }

  return (
    <div className="plantillas">
      <p className="seccion-intro">
        Los formatos de <strong>{organizacion?.nombre}</strong>: actas,
        constancias y listas. Se escriben una vez y se rellenan solas con los
        datos del grupo y del alumno.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {editando === null ? (
        <>
          <button type="button" className="button primary" onClick={abrirNueva}>
            ➕ Nueva plantilla
          </button>

          {cargando ? <p className="nota">Cargando…</p> : !lista.length ? (
            <p className="nota" style={{ marginTop: 14 }}>
              Todavía no hay plantillas. Crea una partiendo de un ejemplo y
              ajústala al formato que pide la institución.
            </p>
          ) : (
            <div className="org-lista" style={{ marginTop: 14 }}>
              {lista.map(p => (
                <div key={p.id} className={`org-fila ${p.activa ? '' : 'inactiva'}`}>
                  <div className="org-fila-datos">
                    <strong>{p.nombre}</strong>
                    <span className="celda-sub">
                      {TIPOS.find(([v]) => v === p.tipo)?.[1] || p.tipo}
                      {p.descripcion ? ` · ${p.descripcion}` : ''}
                    </span>
                  </div>
                  {p.firma_url && <span className="badge neutro">Con firma</span>}
                  {!p.activa && <span className="badge inactivo">Inactiva</span>}
                  <button type="button" className="button texto"
                          onClick={() => abrirEdicion(p)}>✏️ Editar</button>
                  <button type="button" className="button texto peligro"
                          onClick={() => borrar(p)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="plantilla-editor">
          <div className="org-editor-fila">
            <div>
              <label>Nombre</label>
              <input className="input" value={form.nombre} autoFocus
                     onChange={e => campo('nombre', e.target.value)}
                     placeholder="Ej. Acta de calificaciones 2026" />
            </div>
            <div>
              <label>Tipo</label>
              <select className="input" value={form.tipo}
                      onChange={e => campo('tipo', e.target.value)}>
                {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          </div>

          <label>Descripción (opcional)</label>
          <input className="input" value={form.descripcion}
                 onChange={e => campo('descripcion', e.target.value)}
                 placeholder="Cuándo se usa este formato" />

          <div className="plantilla-ejemplos">
            <span className="nota">Partir de un ejemplo:</span>
            {Object.entries(EJEMPLOS).map(([clave, texto]) => (
              <button key={clave} type="button" className="button texto"
                      onClick={() => campo('contenido', texto)}>
                {clave}
              </button>
            ))}
          </div>

          <label>Contenido</label>
          <textarea className="input plantilla-texto" rows={14}
                    value={form.contenido} spellCheck={false}
                    onChange={e => campo('contenido', e.target.value)} />

          {problemas.sinCerrar.length > 0 && (
            <p className="aviso-error">
              Falta cerrar: {problemas.sinCerrar.map(b => `{{/${b}}}`).join(', ')}.
              Sin eso, esa parte del documento no sale.
            </p>
          )}
          {problemas.desconocidos.length > 0 && (
            <p className="nota pond-aviso">
              Estos marcadores no existen y saldrán como «⟨sin dato⟩»:{' '}
              <strong>{problemas.desconocidos.join(', ')}</strong>
            </p>
          )}

          <details className="plantilla-ayuda">
            <summary>Marcadores disponibles</summary>
            <table className="gestion-tabla">
              <tbody>
                {MARCADORES.map(([k, d]) => (
                  <tr key={k}>
                    <td><code>{`{{${k}}}`}</code></td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="nota">
              Bloques que se repiten (una vez por fila). Dentro de uno,{' '}
              <code>{'{{indice}}'}</code> es el número de renglón:
            </p>
            <table className="gestion-tabla">
              <tbody>
                {BLOQUES.map(([k, d]) => (
                  <tr key={k}>
                    <td><code>{`{{#${k}}} … {{/${k}}}`}</code></td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <h4 className="susc-sub">Membrete y firma</h4>
          <div className="org-editor-fila">
            <div>
              <label>Membrete (URL de imagen)</label>
              <input className="input" value={form.membrete_url}
                     onChange={e => campo('membrete_url', e.target.value)}
                     placeholder="https://…/membrete.png" />
            </div>
            <div>
              <label>Firma (URL de imagen)</label>
              <input className="input" value={form.firma_url}
                     onChange={e => campo('firma_url', e.target.value)}
                     placeholder="https://…/firma.png" />
            </div>
          </div>
          <div className="org-editor-fila">
            <div>
              <label>Nombre de quien firma</label>
              <input className="input" value={form.firma_nombre}
                     onChange={e => campo('firma_nombre', e.target.value)} />
            </div>
            <div>
              <label>Cargo</label>
              <input className="input" value={form.firma_cargo}
                     onChange={e => campo('firma_cargo', e.target.value)} />
            </div>
          </div>

          <p className="nota">
            La posición va en <strong>porcentaje de la hoja</strong>, no en
            centímetros: así la misma plantilla sirve en carta y en A4, que es
            donde estas cosas se descuadran.
          </p>
          <div className="susc-topes">
            <div>
              <label>Firma: horizontal (%)</label>
              <input className="input" type="number" min="0" max="100"
                     value={form.firma_x}
                     onChange={e => campo('firma_x', e.target.value)} />
            </div>
            <div>
              <label>Firma: vertical (%)</label>
              <input className="input" type="number" min="0" max="100"
                     value={form.firma_y}
                     onChange={e => campo('firma_y', e.target.value)} />
            </div>
            <div>
              <label>Ancho de la firma (%)</label>
              <input className="input" type="number" min="1" max="100"
                     value={form.firma_ancho}
                     onChange={e => campo('firma_ancho', e.target.value)} />
            </div>
            <div>
              <label>Orientación</label>
              <select className="input" value={form.orientacion}
                      onChange={e => campo('orientacion', e.target.value)}>
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
          </div>

          <label className="gen-activa">
            <input type="checkbox" checked={form.activa}
                   onChange={e => campo('activa', e.target.checked)} />
            <span>Activa <em className="nota">(se puede elegir al generar)</em></span>
          </label>

          <h4 className="susc-sub">Vista previa</h4>
          <p className="nota" style={{ marginTop: 0 }}>
            Con datos <strong>de ejemplo</strong>, no de un alumno real. Sirve
            para ver el formato, no para revisar los datos.
          </p>
          <div className={`plantilla-previa ${form.orientacion}`}>
            {form.membrete_url && (
              <img src={form.membrete_url} alt="" className="previa-membrete" />
            )}
            <div dangerouslySetInnerHTML={{ __html: previa }} />
            {form.firma_url && (
              <img src={form.firma_url} alt="Firma" className="previa-firma"
                   style={{
                     left: `${form.firma_x}%`,
                     top: `${form.firma_y}%`,
                     width: `${form.firma_ancho}%`,
                   }} />
            )}
          </div>

          <div className="modal-botones" style={{ marginTop: 16 }}>
            <button type="button" className="button secondary"
                    onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</button>
            <button type="button" className="button primary"
                    onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
