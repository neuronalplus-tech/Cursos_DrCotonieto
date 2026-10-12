/* ============================================================
   AJUSTES DEL REGISTRO PÚBLICO
   ------------------------------------------------------------
   Desde aquí el admin cambia los textos y decide qué campos se
   piden en la pantalla /registro (la de "Crear mi cuenta" de los
   talleres gratuitos), sin depender de nadie del equipo técnico.

   POR QUÉ TODO ARRANCA VACÍO
   El valor por defecto de verdad vive en el código (REGISTRO_DEFECTO,
   en src/config.js), no en esta tabla. Aquí se guarda SOLO lo que el
   admin escribió. Un campo en blanco NO significa "déjalo vacío en la
   pantalla": significa "usa el de por defecto". Así el admin puede
   cambiar una sola frase y dejar el resto intacto, y no hay dos sitios
   con el mismo texto que se desincronicen.

   CÓMO SE MEZCLA
   Se lee la fila de la organización (si existe) y se superpone encima
   de REGISTRO_DEFECTO. Lo guardado pisa el default; lo no guardado
   hereda el default. Al guardar se envían los textos (null si van
   vacíos) pero los interruptores booleanos van SIEMPRE con su valor,
   porque "pedir repetición de correo" necesita poder guardarse en
   false y no hay un default alternativo al que volver.
   ============================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrganizacion } from '../lib/organizacion'
import { REGISTRO_DEFECTO } from '../config'

/* Los campos booleanos. Se leen del default al abrir (para que el
   formulario muestre el estado real de la pantalla) y se guardan
   siempre. */
const INTERRUPTORES = [
  ['pedir_nombre', 'Pedir el nombre completo (para la constancia)'],
  ['pedir_repeticion_email', 'Pedir que repitan el correo electrónico'],
  ['pedir_repeticion_contrasena', 'Pedir que repitan la contraseña'],
]

/* Los campos de texto con su rótulo en el panel, agrupados como se
   leen de REGISTRO_DEFECTO. Un par [clave, rotulo]. */
const TEXTOS = [
  ['titulo', 'Título de la pantalla'],
  ['descripcion', 'Descripción (bajo el título)'],
  ['texto_boton', 'Texto del botón de enviar'],
  ['texto_cargando', 'Texto del botón mientras se envía'],
  ['etiqueta_nombre', 'Etiqueta del nombre'],
  ['etiqueta_email', 'Etiqueta del correo'],
  ['etiqueta_email2', 'Etiqueta de «repite tu correo»'],
  ['etiqueta_contrasena', 'Etiqueta de la contraseña'],
  ['etiqueta_contrasena2', 'Etiqueta de «repite tu contraseña»'],
  ['confirmacion_intro', 'Confirmación: primera línea'],
  ['confirmacion_cierre', 'Confirmación: texto de cierre'],
  ['confirmacion_nota', 'Confirmación: nota final'],
]

/* Lo que ocupa el formulario: todos los booleanos + los textos.
   Los textos arrancan en '' (vacío = "usa el default"). */
const estadoInicial = () => {
  const f = {}
  for (const [k] of INTERRUPTORES) f[k] = REGISTRO_DEFECTO[k]
  for (const [k] of TEXTOS) f[k] = ''
  return f
}

const fechaCorta = (d) => d
  ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

/* ------------------------------------------------------------
   QUIÉN SE HA REGISTRADO
   Hasta ahora el alta pública no se veía por ningún lado: la tanda
   se calculaba al registrarse, pero la única pantalla que la leía
   era Comunicados. Quien quería comprobar que el enlace funciona
   tenía que buscar correo por correo en Gestión de usuarios, donde
   un autoinscrito parece una cuenta suelta más.

   Esta tabla es la comprobación: cuántos van, en qué tanda quedó
   cada uno y si confirmaron el correo (sin confirmar no reciben
   nada, ni la constancia).
   ------------------------------------------------------------ */
function Autoinscritos() {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    supabase.rpc('listar_inscritos_gratuitos').then(({ data, error }) => {
      if (!vivo) return
      if (error) { setError(error.message); setFilas([]); return }
      setFilas(data || [])
    })
    return () => { vivo = false }
  }, [])

  if (filas === null) return <p className="nota">Cargando registros…</p>
  if (error) {
    return (
      <p className="aviso-error">
        No se pudo leer la lista: {error}
        {/^.*(does not exist|schema cache|function).*$/i.test(error) &&
          ' — falta correr supabase/ALTA_PUBLICA_2_TANDAS.sql en Supabase.'}
      </p>
    )
  }
  if (filas.length === 0) {
    return (
      <p className="nota">
        Todavía no se ha registrado nadie por el enlace público. Las cuentas que
        das de alta tú desde «Gestión de usuarios» no cuentan aquí: esta lista es
        solo de quien se registró solo.
      </p>
    )
  }

  const tandas = [...new Set(filas.map(f => f.tanda).filter(t => t != null))].sort((a, b) => a - b)
  const sinConfirmar = filas.filter(f => f.confirmado === false).length

  return (
    <>
      <p className="nota">
        <strong>{filas.length}</strong> persona{filas.length === 1 ? '' : 's'} registrada
        {filas.length === 1 ? '' : 's'} por el enlace, en {tandas.length || 1} tanda
        {tandas.length === 1 ? '' : 's'} de 50.
        {sinConfirmar > 0 && ` ${sinConfirmar} aún no confirma${sinConfirmar === 1 ? '' : 'n'} su correo.`}
      </p>

      <div className="gestion-tabla-scroll">
        <table className="gestion-tabla">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tanda</th>
              <th>Correo confirmado</th>
              <th>Se registró</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.usuario_id}>
                <td>
                  <strong>{f.nombre_completo || '(sin nombre)'}</strong>
                  <span className="celda-sub">{f.email}</span>
                </td>
                <td>
                  {f.tanda != null
                    ? <span className="badge ok">Tanda {f.tanda}</span>
                    : <span className="sutil">sin tanda</span>}
                </td>
                <td>
                  {f.confirmado
                    ? <span className="badge ok">Sí</span>
                    : <span className="badge inactivo">Pendiente</span>}
                </td>
                <td><span className="celda-sub">{fechaCorta(f.alta_el)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function AdminRegistro() {
  const { organizacion } = useOrganizacion()
  const [form, setForm] = useState(estadoInicial)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [existe, setExiste] = useState(false)

  useEffect(() => {
    if (!organizacion?.id) { setCargando(false); return }
    let vivo = true
    setCargando(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('config_registro')
        .select('*')
        .eq('organizacion_id', organizacion.id)
        .maybeSingle()
      if (!vivo) return
      if (error) {
        setMsg({ tipo: 'error', texto: 'No se pudo cargar la configuración: ' + error.message })
      } else if (data) {
        setExiste(true)
        // Los textos solo se rellenan si en la base hay algo; un null
        // o '' sigue significando "usa el default" y se deja en blanco.
        const f = estadoInicial()
        for (const [k] of INTERRUPTORES) f[k] = data[k] ?? REGISTRO_DEFECTO[k]
        for (const [k] of TEXTOS) f[k] = data[k] ?? ''
        setForm(f)
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [organizacion?.id])

  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!organizacion?.id) return
    setGuardando(true)
    setMsg(null)
    // Los textos van con null cuando están vacíos: en la base null
    // significa "sin override" y el front cae al default.
    const payload = { organizacion_id: organizacion.id }
    for (const [k] of INTERRUPTORES) payload[k] = !!form[k]
    for (const [k] of TEXTOS) payload[k] = (form[k] || '').trim() || null
    payload.actualizado_el = new Date().toISOString()

    const { error } = existe
      ? await supabase.from('config_registro').update(payload).eq('organizacion_id', organizacion.id)
      : await supabase.from('config_registro').insert(payload)
    setGuardando(false)
    if (error) {
      setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
      return
    }
    setExiste(true)
    setMsg({ tipo: 'ok', texto: 'Ajustes del registro guardados.' })
  }

  const volverADefecto = () => {
    // Solo limpia los textos: los booleanos vuelven al default del código.
    setForm(estadoInicial())
    setMsg({ tipo: 'ok', texto: 'Campos de texto vaciados. Pulsa «Guardar» para volver al texto por defecto en la pantalla.' })
  }

  if (!organizacion?.id && !cargando) {
    return <p className="aviso-error">No pude saber de qué organización es este sitio.</p>
  }

  return (
    <div className="config-registro">
      <p className="seccion-intro">
        Textos y campos de la pantalla <strong>«Crear mi cuenta»</strong> (el
        registro público de los talleres gratuitos). Lo que dejes en blanco usa
        el texto por defecto, así que puedes cambiar una sola frase sin tocar
        el resto.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      {cargando ? (
        <p className="nota">Cargando…</p>
      ) : (
        <>
          <fieldset className="campo-grupo">
            <legend>Textos de la pantalla</legend>
            {TEXTOS.map(([k, rotulo]) => (
              <label key={k} className="campo">
                <span className="campo-rotulo">{rotulo}</span>
                {k === 'descripcion' || k.startsWith('confirmacion_') ? (
                  <textarea
                    className="input"
                    rows={k === 'descripcion' ? 3 : 2}
                    value={form[k]}
                    onChange={e => campo(k, e.target.value)}
                    placeholder={REGISTRO_DEFECTO[k]}
                  />
                ) : (
                  <input
                    className="input"
                    type="text"
                    value={form[k]}
                    onChange={e => campo(k, e.target.value)}
                    placeholder={REGISTRO_DEFECTO[k]}
                  />
                )}
                <span className="campo-ayuda">
                  {form[k] ? 'Personalizado' : 'Por defecto: ' + REGISTRO_DEFECTO[k]}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="campo-grupo">
            <legend>Campos que se piden</legend>
            <p className="nota">
              Desactiva «Repite tu correo» o «Repite tu contraseña» si prefieres
              pedirlos una sola vez. El nombre es lo que aparecerá en la
              constancia, así que conviene dejarlo activo.
            </p>
            {INTERRUPTORES.map(([k, rotulo]) => (
              <label key={k} className="campo-interruptor">
                <input
                  type="checkbox"
                  checked={!!form[k]}
                  onChange={e => campo(k, e.target.checked)}
                />
                <span>{rotulo}</span>
              </label>
            ))}
          </fieldset>

          <div className="acciones-guardar">
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar ajustes'}
            </button>
            <button type="button" className="button texto" onClick={volverADefecto} disabled={guardando}>
              Volver al texto por defecto
            </button>
          </div>

          <fieldset className="campo-grupo">
            <legend>Quién se ha registrado</legend>
            <Autoinscritos />
          </fieldset>
        </>
      )}
    </div>
  )
}


