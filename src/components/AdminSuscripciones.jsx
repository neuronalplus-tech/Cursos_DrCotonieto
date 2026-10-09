/* ============================================================
   SUSCRIPCIONES · qué te paga cada cliente y cuánto consume
   ------------------------------------------------------------
   Dos vistas: la cartera (una fila por organización, con su
   contrato y su consumo frente al tope) y el catálogo de planes,
   para que puedas mover precios sin pedírmelo.

   POR QUÉ EL CONSUMO VIENE DE UNA SOLA LLAMADA
   Contar alumnos, cursos y facilitadores por organización desde el
   navegador serían tres consultas por cliente. `consumo_organizaciones()`
   lo devuelve todo de una vez y, siendo `security definer`, cuenta
   también lo que las políticas de lectura te esconderían.

   POR QUÉ EL PAGO NO SE ESCRIBE DESDE AQUÍ
   Anotar el pago y correr el vencimiento son una sola cosa. Si esta
   pantalla hiciera las dos por separado, un corte de red entre
   ambas deja un cliente que pagó marcado como vencido. Lo hace
   `registrar_pago()` en la base, en una transacción.
   ============================================================ */

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ModalPortal } from './ui'
import { planSinModulos } from '../lib/modulos'
import {
  situacion, requiereAtencion, limites, nivelUso,
  pesos, precioVigente, ingresoMensual, fechaCorta, diasPara,
} from '../lib/suscripcion'

const ESTADOS = [
  ['prueba', 'En prueba'],
  ['activa', 'Activa'],
  ['suspendida', 'Suspendida'],
  ['cancelada', 'Cancelada'],
]

/* ------------------------------------------------------------
   Una barra de consumo. El tope en null es "sin límite", que no
   es lo mismo que cero y no debe pintarse como barra llena.
   ------------------------------------------------------------ */
function Uso({ usado, tope }) {
  const nivel = nivelUso(usado, tope)
  if (nivel === 'libre') {
    return <span className="uso-libre">{usado} <em>/ sin tope</em></span>
  }
  const pct = Math.min(100, Math.round((usado / tope) * 100))
  return (
    <span className={`uso uso-${nivel}`} title={`${usado} de ${tope} (${pct}%)`}>
      <span className="uso-barra"><i style={{ width: `${pct}%` }} /></span>
      <span className="uso-cifra">{usado}/{tope}</span>
    </span>
  )
}

export default function AdminSuscripciones() {
  const [vista, setVista] = useState('cartera')
  const [orgs, setOrgs] = useState([])
  const [planes, setPlanes] = useState([])
  const [consumo, setConsumo] = useState({})
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  const [contrato, setContrato] = useState(null)   // org en edición
  const [pago, setPago] = useState(null)           // alta de pago
  const [planEdit, setPlanEdit] = useState(null)   // plan en edición
  // Qué módulos trae cada plan. Es lo que convierte la lista de
  // precios en algo que se puede explicar: el Semilla trae el aula,
  // el Institucional añade control escolar.
  const [catalogoModulos, setCatalogoModulos] = useState([])
  const [modulosPorPlan, setModulosPorPlan] = useState({})
  const [modulosEdit, setModulosEdit] = useState(new Set())
  const [guardando, setGuardando] = useState(false)

  const [historial, setHistorial] = useState({})   // org id -> pagos
  const [abierta, setAbierta] = useState(null)

  const planPorId = useMemo(
    () => Object.fromEntries(planes.map(p => [p.id, p])), [planes])

  const recargar = async () => {
    setCargando(true)
    const [{ data: o, error: eo }, { data: p }, { data: c }, { data: mods }, { data: pm }] =
      await Promise.all([
        supabase.from('organizaciones').select('*').order('nombre'),
        supabase.from('planes').select('*').order('orden'),
        supabase.rpc('consumo_organizaciones'),
        supabase.from('modulos_plataforma').select('*').order('orden'),
        supabase.from('plan_modulos').select('*'),
      ])
    const porPlan = {}
    for (const x of pm || []) (porPlan[x.plan_id] ||= []).push(x.modulo)
    setCatalogoModulos(mods || [])
    setModulosPorPlan(porPlan)
    setOrgs(o || [])
    setPlanes(p || [])
    setConsumo(Object.fromEntries(
      (c || []).map(f => [f.organizacion_id, f])))
    setCargando(false)
  }

  useEffect(() => { recargar() }, [])

  const mrr = useMemo(() => ingresoMensual(orgs, planPorId), [orgs, planPorId])

  const verHistorial = async (orgId) => {
    if (abierta === orgId) { setAbierta(null); return }
    setAbierta(orgId)
    if (historial[orgId]) return
    const { data } = await supabase
      .from('pagos_suscripcion').select('*')
      .eq('organizacion_id', orgId).order('pagado_en', { ascending: false })
    setHistorial(h => ({ ...h, [orgId]: data || [] }))
  }

  /* --- Guardar el contrato -------------------------------- */
  const abrirContrato = (o) => {
    setContrato({
      id: o.id,
      nombre: o.nombre,
      plan_id: o.plan_id ?? '',
      periodo: o.periodo || 'mensual',
      estado_suscripcion: o.estado_suscripcion || 'prueba',
      precio_acordado: o.precio_acordado ?? '',
      vence_en: o.vence_en || '',
      max_alumnos: o.max_alumnos ?? '',
      max_cursos: o.max_cursos ?? '',
      max_facilitadores: o.max_facilitadores ?? '',
      exenta_de_limites: !!o.exenta_de_limites,
      notas_comerciales: o.notas_comerciales || '',
    })
    setMsg(null)
  }

  // Un campo numérico vacío es "sin excepción" (null), no cero. Un
  // cero significaría "cero alumnos permitidos", que nadie quiere.
  const num = (v) => (v === '' || v === null ? null : Number(v))

  const guardarContrato = async () => {
    setGuardando(true)
    const { error } = await supabase.from('organizaciones').update({
      plan_id: contrato.plan_id === '' ? null : Number(contrato.plan_id),
      periodo: contrato.periodo,
      estado_suscripcion: contrato.estado_suscripcion,
      precio_acordado: num(contrato.precio_acordado),
      vence_en: contrato.vence_en || null,
      max_alumnos: num(contrato.max_alumnos),
      max_cursos: num(contrato.max_cursos),
      max_facilitadores: num(contrato.max_facilitadores),
      exenta_de_limites: contrato.exenta_de_limites,
      notas_comerciales: contrato.notas_comerciales.trim() || null,
    }).eq('id', contrato.id)
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message })
    setContrato(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Contrato actualizado.' })
  }

  /* --- Registrar un pago ---------------------------------- */
  const abrirPago = (o) => {
    const p = planPorId[o.plan_id]
    const importe = precioVigente(o, p)
    setPago({
      id: o.id,
      nombre: o.nombre,
      vence_en: o.vence_en,
      monto: importe != null ? String(importe) : '',
      meses: o.periodo === 'anual' ? '12' : '1',
      metodo: 'Transferencia',
      referencia: '',
      nota: '',
    })
    setMsg(null)
  }

  const guardarPago = async () => {
    const monto = Number(pago.monto)
    const meses = Number(pago.meses)
    if (!Number.isFinite(monto) || monto < 0) {
      return setMsg({ tipo: 'error', texto: 'El monto no es un número válido.' })
    }
    if (!Number.isInteger(meses) || meses < 1 || meses > 36) {
      return setMsg({ tipo: 'error', texto: 'Los meses tienen que ser un entero entre 1 y 36.' })
    }
    setGuardando(true)
    const { data, error } = await supabase.rpc('registrar_pago', {
      p_org: pago.id,
      p_monto: monto,
      p_meses: meses,
      p_metodo: pago.metodo.trim() || null,
      p_referencia: pago.referencia.trim() || null,
      p_nota: pago.nota.trim() || null,
    })
    setGuardando(false)
    if (error) return setMsg({ tipo: 'error', texto: 'No se pudo registrar: ' + error.message })
    const org = pago.id
    setPago(null)
    // El historial en memoria ya no coincide con la base.
    setHistorial(h => { const n = { ...h }; delete n[org]; return n })
    await recargar()
    setMsg({ tipo: 'ok', texto: `Pago registrado. Nuevo vencimiento: ${fechaCorta(data)}.` })
  }

  /* --- Catálogo de planes --------------------------------- */
  const abrirPlan = (p) => {
    setPlanEdit({
      id: p?.id ?? 'nuevo',
      clave: p?.clave || '',
      nombre: p?.nombre || '',
      descripcion: p?.descripcion || '',
      precio_mensual: p?.precio_mensual ?? '',
      precio_anual: p?.precio_anual ?? '',
      max_alumnos: p?.max_alumnos ?? '',
      max_cursos: p?.max_cursos ?? '',
      max_facilitadores: p?.max_facilitadores ?? '',
      max_almacenamiento_gb: p?.max_almacenamiento_gb ?? '',
      orden: p?.orden ?? 50,
      activo: p ? !!p.activo : true,
    })
    setModulosEdit(new Set(p ? (modulosPorPlan[p.id] || []) : []))
    setMsg(null)
  }

  const guardarPlan = async () => {
    const clave = planEdit.clave.trim().toLowerCase()
    if (!clave || !planEdit.nombre.trim()) {
      return setMsg({ tipo: 'error', texto: 'La clave y el nombre son obligatorios.' })
    }
    if (!/^[a-z0-9-]+$/.test(clave)) {
      return setMsg({ tipo: 'error', texto: 'La clave solo admite minúsculas, números y guiones.' })
    }
    setGuardando(true)
    const payload = {
      clave,
      nombre: planEdit.nombre.trim(),
      descripcion: planEdit.descripcion.trim() || null,
      precio_mensual: num(planEdit.precio_mensual),
      precio_anual: num(planEdit.precio_anual),
      max_alumnos: num(planEdit.max_alumnos),
      max_cursos: num(planEdit.max_cursos),
      max_facilitadores: num(planEdit.max_facilitadores),
      max_almacenamiento_gb: num(planEdit.max_almacenamiento_gb),
      orden: num(planEdit.orden) ?? 50,
      activo: planEdit.activo,
    }
    const { error } = planEdit.id === 'nuevo'
      ? await supabase.from('planes').insert(payload)
      : await supabase.from('planes').update(payload).eq('id', planEdit.id)
    setGuardando(false)
    if (error) {
      return setMsg({
        tipo: 'error',
        texto: /duplicate|unique/i.test(error.message)
          ? 'Ya existe un plan con esa clave.'
          : 'No se pudo guardar: ' + error.message,
      })
    }
    // Los módulos del plan se reemplazan enteros: borrar y volver a
    // poner es lo único que deja el estado final igual a lo marcado.
    const planId = planEdit.id === 'nuevo'
      ? (await supabase.from('planes').select('id').eq('clave', clave).maybeSingle()).data?.id
      : planEdit.id
    if (planId) {
      await supabase.from('plan_modulos').delete().eq('plan_id', planId)
      if (modulosEdit.size) {
        await supabase.from('plan_modulos')
          .insert([...modulosEdit].map(m => ({ plan_id: planId, modulo: m })))
      }
    }
    setPlanEdit(null)
    await recargar()
    setMsg({ tipo: 'ok', texto: 'Plan guardado.' })
  }

  const planActual = contrato ? planPorId[Number(contrato.plan_id)] : null

  return (
    <div className="susc">
      <p className="seccion-intro">
        Lo que cobras y lo que consume cada cliente. Los topes no son un
        adorno de esta pantalla: los impone la base de datos, así que una
        organización llena no puede inscribir de más ni desde la API.
      </p>

      {msg && <p className={msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}>{msg.texto}</p>}

      <div className="susc-subtabs">
        <button type="button" className={`admin-tab ${vista === 'cartera' ? 'activa' : ''}`}
                onClick={() => setVista('cartera')}>💼 Cartera</button>
        <button type="button" className={`admin-tab ${vista === 'planes' ? 'activa' : ''}`}
                onClick={() => setVista('planes')}>🏷️ Planes y precios</button>
      </div>

      {cargando && <p className="nota">Cargando…</p>}

      {!cargando && vista === 'cartera' && (
        <>
          <div className="susc-resumen">
            <div className="susc-dato">
              <strong>{pesos(mrr)}</strong>
              <span>al mes, recurrente</span>
            </div>
            <div className="susc-dato">
              <strong>{pesos(mrr * 12)}</strong>
              <span>al año, al ritmo de hoy</span>
            </div>
            <div className="susc-dato">
              <strong>{orgs.filter(o => !o.exenta_de_limites).length}</strong>
              <span>cliente(s)</span>
            </div>
            <div className="susc-dato">
              <strong>
                {orgs.filter(o => requiereAtencion(situacion(o).clave)).length}
              </strong>
              <span>por atender</span>
            </div>
          </div>
          <p className="nota" style={{ marginTop: -6, marginBottom: 18 }}>
            El recurrente suma solo a quien está al corriente o en gracia, y
            divide los contratos anuales entre doce para poder compararlos con
            los mensuales.
          </p>

          <div className="gestion-tabla-scroll">
            <table className="gestion-tabla susc-tabla">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Plan</th>
                  <th>Situación</th>
                  <th>Vence</th>
                  <th>Alumnos</th>
                  <th>Cursos</th>
                  <th>Facilit.</th>
                  <th>Cobro</th>
                  <th className="col-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => {
                  const s = situacion(o)
                  const plan = planPorId[o.plan_id]
                  const lim = limites(o, plan)
                  const con = consumo[o.id] || { alumnos: 0, cursos: 0, facilitadores: 0 }
                  const precio = precioVigente(o, plan)
                  const exenta = lim.exenta
                  const pagos = historial[o.id]
                  return (
                    <Fragment key={o.id}>
                    <tr className={s.tono === 'alerta' ? 'susc-fila-alerta' : ''}>
                      <td>
                        <strong>{o.nombre}</strong>
                        <span className="celda-sub">{o.slug}</span>
                      </td>
                      <td>
                        {plan ? plan.nombre : <span className="sutil">—</span>}
                        <span className="celda-sub">
                          {o.periodo === 'anual' ? 'anual' : 'mensual'}
                        </span>
                      </td>
                      <td><span className={`badge susc-${s.tono}`}>{s.etiqueta}</span></td>
                      <td>
                        <span className="celda-sub">{fechaCorta(o.vence_en)}</span>
                      </td>
                      <td>{exenta ? <span className="sutil">sin tope</span>
                        : <Uso usado={con.alumnos} tope={lim.alumnos} />}</td>
                      <td>{exenta ? <span className="sutil">—</span>
                        : <Uso usado={con.cursos} tope={lim.cursos} />}</td>
                      <td>{exenta ? <span className="sutil">—</span>
                        : <Uso usado={con.facilitadores} tope={lim.facilitadores} />}</td>
                      <td>
                        {exenta ? <span className="sutil">—</span> : (
                          <>
                            {pesos(precio)}
                            {o.precio_acordado != null &&
                              <span className="celda-sub">negociado</span>}
                          </>
                        )}
                      </td>
                      <td className="col-acciones">
                        <button type="button" className="button texto"
                                title="Plan, precio, vencimiento y excepciones"
                                onClick={() => abrirContrato(o)}>📄 Contrato</button>
                        {!o.exenta_de_limites && (
                          <button type="button" className="button texto"
                                  title="Anotar un pago y correr el vencimiento"
                                  onClick={() => abrirPago(o)}>💵 Pago</button>
                        )}
                        <button type="button" className="gestion-expandir-btn"
                                onClick={() => verHistorial(o.id)}>
                          {abierta === o.id ? '▲ Pagos' : '▼ Pagos'}
                        </button>
                      </td>
                    </tr>

                    {abierta === o.id && (
                      <tr className="gestion-fila-cursos">
                        <td colSpan={9}>
                          {!pagos ? <p className="nota">Cargando pagos…</p>
                            : !pagos.length
                              ? <p className="nota">Todavía no hay pagos registrados.</p>
                              : (
                                <table className="susc-pagos">
                                  <thead>
                                    <tr>
                                      <th>Pagado</th><th>Monto</th><th>Periodo cubierto</th>
                                      <th>Método</th><th>Referencia</th><th>Nota</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pagos.map(p => (
                                      <tr key={p.id}>
                                        <td>{fechaCorta(p.pagado_en)}</td>
                                        <td>{pesos(p.monto)}</td>
                                        <td>{fechaCorta(p.periodo_desde)} → {fechaCorta(p.periodo_hasta)}</td>
                                        <td>{p.metodo || '—'}</td>
                                        <td>{p.referencia || '—'}</td>
                                        <td>{p.nota || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="nota" style={{ marginTop: 16 }}>
            Vencer no le cierra la puerta a nadie: el cliente aparece en rojo
            aquí y ve el aviso en su panel, pero sus alumnos siguen entrando.
            Cortarle el acceso a cientos de personas por una transferencia que
            tardó tres días hace más daño que el que evita.
          </p>
        </>
      )}

      {!cargando && vista === 'planes' && (
        <>
          <p className="nota" style={{ marginBottom: 14 }}>
            Los precios que trae el sistema son un punto de partida, no una
            recomendación cerrada: ajústalos cuando cierres las primeras ventas.
            Un tope vacío significa <strong>sin límite</strong>.
          </p>
          <button type="button" className="button primary" onClick={() => abrirPlan(null)}>
            ➕ Nuevo plan
          </button>

          <div className="gestion-tabla-scroll" style={{ marginTop: 14 }}>
            <table className="gestion-tabla">
              <thead>
                <tr>
                  <th>Plan</th><th>Mensual</th><th>Anual</th>
                  <th>Alumnos</th><th>Cursos</th><th>Facilit.</th><th>Almac.</th>
                  <th>Clientes</th><th className="col-acciones"></th>
                </tr>
              </thead>
              <tbody>
                {planes.map(p => (
                  <tr key={p.id} className={p.activo ? '' : 'susc-fila-inactiva'}>
                    <td>
                      <strong>{p.nombre}</strong>
                      <span className="celda-sub">{p.descripcion || p.clave}</span>
                    </td>
                    <td>{pesos(p.precio_mensual)}</td>
                    <td>{pesos(p.precio_anual)}</td>
                    <td>{p.max_alumnos ?? '∞'}</td>
                    <td>{p.max_cursos ?? '∞'}</td>
                    <td>{p.max_facilitadores ?? '∞'}</td>
                    <td>{p.max_almacenamiento_gb != null ? `${p.max_almacenamiento_gb} GB` : '∞'}</td>
                    <td>{orgs.filter(o => o.plan_id === p.id).length}</td>
                    <td className="col-acciones">
                      {!p.activo && <span className="badge inactivo">Oculto</span>}
                      <button type="button" className="button texto"
                              onClick={() => abrirPlan(p)}>✏️ Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="nota" style={{ marginTop: 14 }}>
            El tope de almacenamiento se declara para la conversación comercial
            pero <strong>no se mide todavía</strong>: medirlo por cliente exige
            una convención de rutas en el almacén que hoy no existe. Dilo cuando
            empiece a importar y lo montamos.
          </p>
        </>
      )}

      {/* ---------- Contrato ---------- */}
      {contrato && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !guardando && setContrato(null)}>
          <div className="modal-box modal-ancho" onClick={e => e.stopPropagation()}>
            <h3>Contrato de {contrato.nombre}</h3>

            <div className="org-editor-fila">
              <div>
                <label>Plan</label>
                <select className="input" value={contrato.plan_id}
                        onChange={e => setContrato({ ...contrato, plan_id: e.target.value })}>
                  <option value="">— sin plan (sin topes) —</option>
                  {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label>Periodo</label>
                <select className="input" value={contrato.periodo}
                        onChange={e => setContrato({ ...contrato, periodo: e.target.value })}>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>

            <div className="org-editor-fila">
              <div>
                <label>Precio acordado (MXN)</label>
                <input className="input" type="number" min="0" step="1"
                       value={contrato.precio_acordado}
                       onChange={e => setContrato({ ...contrato, precio_acordado: e.target.value })}
                       placeholder={planActual
                         ? String((contrato.periodo === 'anual'
                             ? planActual.precio_anual : planActual.precio_mensual) ?? '')
                         : 'a convenir'} />
                <p className="nota">Vacío = el precio de lista del plan.</p>
              </div>
              <div>
                <label>Estado</label>
                <select className="input" value={contrato.estado_suscripcion}
                        onChange={e => setContrato({ ...contrato, estado_suscripcion: e.target.value })}>
                  {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </div>
            </div>

            <label>Vence el</label>
            <input className="input" type="date" value={contrato.vence_en}
                   onChange={e => setContrato({ ...contrato, vence_en: e.target.value })} />
            <p className="nota">
              Normalmente no lo tocas a mano: registrar un pago lo corre solo.
            </p>

            <label className="gen-activa">
              <input type="checkbox" checked={contrato.exenta_de_limites}
                     onChange={e => setContrato({ ...contrato, exenta_de_limites: e.target.checked })} />
              <span>Exenta de topes y de cobro <em className="nota">(tu propia aula)</em></span>
            </label>

            <h4 className="susc-sub">Excepciones de tope</h4>
            <p className="nota">
              Solo si le concediste algo distinto a su plan. En blanco manda el
              plan{planActual ? ` (${planActual.max_alumnos ?? '∞'} alumnos, ${planActual.max_cursos ?? '∞'} cursos, ${planActual.max_facilitadores ?? '∞'} facilitadores)` : ''}.
            </p>
            <div className="susc-topes">
              <div>
                <label>Alumnos</label>
                <input className="input" type="number" min="0" value={contrato.max_alumnos}
                       onChange={e => setContrato({ ...contrato, max_alumnos: e.target.value })}
                       placeholder={String(planActual?.max_alumnos ?? '∞')} />
              </div>
              <div>
                <label>Cursos</label>
                <input className="input" type="number" min="0" value={contrato.max_cursos}
                       onChange={e => setContrato({ ...contrato, max_cursos: e.target.value })}
                       placeholder={String(planActual?.max_cursos ?? '∞')} />
              </div>
              <div>
                <label>Facilitadores</label>
                <input className="input" type="number" min="0" value={contrato.max_facilitadores}
                       onChange={e => setContrato({ ...contrato, max_facilitadores: e.target.value })}
                       placeholder={String(planActual?.max_facilitadores ?? '∞')} />
              </div>
            </div>

            <label>Notas comerciales</label>
            <textarea rows="3" className="modal-textarea" value={contrato.notas_comerciales}
                      onChange={e => setContrato({ ...contrato, notas_comerciales: e.target.value })}
                      placeholder="Ej: pidió factura a nombre de la federación; renovación la revisa su consejo en enero." />
            <p className="nota">Solo tú las ves. El cliente no puede leerlas ni editarlas.</p>

            <div className="modal-botones">
              <button type="button" className="button secondary"
                      onClick={() => setContrato(null)} disabled={guardando}>Cancelar</button>
              <button type="button" className="button primary"
                      onClick={guardarContrato} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar contrato'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ---------- Pago ---------- */}
      {pago && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !guardando && setPago(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Registrar pago de {pago.nombre}</h3>
            <p className="sutil" style={{ marginBottom: 14 }}>
              {pago.vence_en && diasPara(pago.vence_en) > 0
                ? `Vence el ${fechaCorta(pago.vence_en)}: el periodo nuevo arranca ahí, no hoy, para no regalarle los días que le quedan.`
                : 'No tiene vencimiento vigente, así que el periodo arranca hoy.'}
            </p>

            <div className="org-editor-fila">
              <div>
                <label>Monto (MXN)</label>
                <input className="input" type="number" min="0" step="1" autoFocus
                       value={pago.monto}
                       onChange={e => setPago({ ...pago, monto: e.target.value })} />
              </div>
              <div>
                <label>Meses que cubre</label>
                <input className="input" type="number" min="1" max="36" step="1"
                       value={pago.meses}
                       onChange={e => setPago({ ...pago, meses: e.target.value })} />
              </div>
            </div>

            <label>Método</label>
            <input className="input" value={pago.metodo}
                   onChange={e => setPago({ ...pago, metodo: e.target.value })}
                   placeholder="Transferencia, depósito, efectivo…" />

            <label>Referencia</label>
            <input className="input" value={pago.referencia}
                   onChange={e => setPago({ ...pago, referencia: e.target.value })}
                   placeholder="Folio del SPEI, o de la factura que emitiste" />
            <p className="nota">
              Sirve para cruzarlo con tu contabilidad. Aquí no se emite factura.
            </p>

            <label>Nota</label>
            <textarea rows="2" className="modal-textarea" value={pago.nota}
                      onChange={e => setPago({ ...pago, nota: e.target.value })} />

            <div className="modal-botones">
              <button type="button" className="button secondary"
                      onClick={() => setPago(null)} disabled={guardando}>Cancelar</button>
              <button type="button" className="button primary"
                      onClick={guardarPago} disabled={guardando}>
                {guardando ? 'Registrando…' : 'Registrar y correr vencimiento'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ---------- Plan ---------- */}
      {planEdit && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !guardando && setPlanEdit(null)}>
          <div className="modal-box modal-ancho" onClick={e => e.stopPropagation()}>
            <h3>{planEdit.id === 'nuevo' ? 'Nuevo plan' : `Plan ${planEdit.nombre}`}</h3>

            <div className="org-editor-fila">
              <div>
                <label>Nombre</label>
                <input className="input" value={planEdit.nombre} autoFocus
                       onChange={e => setPlanEdit({ ...planEdit, nombre: e.target.value })} />
              </div>
              <div>
                <label>Clave</label>
                <input className="input" value={planEdit.clave}
                       onChange={e => setPlanEdit({ ...planEdit, clave: e.target.value })}
                       placeholder="institucional" />
              </div>
            </div>

            <label>Descripción</label>
            <input className="input" value={planEdit.descripcion}
                   onChange={e => setPlanEdit({ ...planEdit, descripcion: e.target.value })}
                   placeholder="A quién va dirigido, en una línea." />

            <div className="org-editor-fila">
              <div>
                <label>Precio mensual (MXN)</label>
                <input className="input" type="number" min="0" step="1"
                       value={planEdit.precio_mensual}
                       onChange={e => setPlanEdit({ ...planEdit, precio_mensual: e.target.value })} />
              </div>
              <div>
                <label>Precio anual (MXN)</label>
                <input className="input" type="number" min="0" step="1"
                       value={planEdit.precio_anual}
                       onChange={e => setPlanEdit({ ...planEdit, precio_anual: e.target.value })} />
              </div>
            </div>

            <h4 className="susc-sub">Topes del plan</h4>
            <p className="nota">En blanco = sin límite.</p>
            <div className="susc-topes">
              <div>
                <label>Alumnos</label>
                <input className="input" type="number" min="0" value={planEdit.max_alumnos}
                       onChange={e => setPlanEdit({ ...planEdit, max_alumnos: e.target.value })} />
              </div>
              <div>
                <label>Cursos</label>
                <input className="input" type="number" min="0" value={planEdit.max_cursos}
                       onChange={e => setPlanEdit({ ...planEdit, max_cursos: e.target.value })} />
              </div>
              <div>
                <label>Facilitadores</label>
                <input className="input" type="number" min="0" value={planEdit.max_facilitadores}
                       onChange={e => setPlanEdit({ ...planEdit, max_facilitadores: e.target.value })} />
              </div>
              <div>
                <label>Almacenamiento (GB)</label>
                <input className="input" type="number" min="0" value={planEdit.max_almacenamiento_gb}
                       onChange={e => setPlanEdit({ ...planEdit, max_almacenamiento_gb: e.target.value })} />
              </div>
            </div>

            <div className="org-editor-fila">
              <div>
                <label>Orden en la lista</label>
                <input className="input" type="number" value={planEdit.orden}
                       onChange={e => setPlanEdit({ ...planEdit, orden: e.target.value })} />
              </div>
              <div>
                <label className="gen-activa" style={{ marginTop: 28 }}>
                  <input type="checkbox" checked={planEdit.activo}
                         onChange={e => setPlanEdit({ ...planEdit, activo: e.target.checked })} />
                  <span>Activo <em className="nota">(lo sigues ofreciendo)</em></span>
                </label>
              </div>
            </div>

            <h4 className="susc-sub">Qué incluye este plan</h4>
            <p className="nota" style={{ marginTop: 0 }}>
              Lo que no esté marcado no se le enseña al cliente. El aula no
              se puede quitar: sin ella no hay plataforma.
            </p>
            {planSinModulos([...modulosEdit]) && (
              <p className="nota pond-aviso">
                Este plan no incluye nada más que el aula.
              </p>
            )}
            <div className="plan-modulos">
              {catalogoModulos.map(m => (
                <label key={m.clave} className="permiso-fila">
                  <input type="checkbox"
                         checked={m.esencial || modulosEdit.has(m.clave)}
                         disabled={m.esencial}
                         onChange={() => setModulosEdit(prev => {
                           const n = new Set(prev)
                           if (n.has(m.clave)) n.delete(m.clave); else n.add(m.clave)
                           return n
                         })} />
                  <span>
                    <strong>{m.nombre}</strong>
                    {m.descripcion && <em className="nota">{m.descripcion}</em>}
                  </span>
                </label>
              ))}
            </div>

            <div className="modal-botones">
              <button type="button" className="button secondary"
                      onClick={() => setPlanEdit(null)} disabled={guardando}>Cancelar</button>
              <button type="button" className="button primary"
                      onClick={guardarPlan} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar plan'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}

/* ============================================================
   RESUMEN PARA EL CLIENTE
   ------------------------------------------------------------
   Lo que ve el administrador de una organización en su propio
   panel: su plan, cuánto le queda de cada tope y cuándo vence.

   NO ve precios de otros planes ni las notas comerciales, y no
   puede cambiar nada de esto: un disparador en la base lo impide
   aunque alguien llame a la API a mano.

   Se muestra solo cuando hay algo que decir. Un cliente al
   corriente y con margen no necesita una franja recordándoselo en
   cada visita.
   ============================================================ */
export function ResumenPlan({ organizacionId }) {
  const [org, setOrg] = useState(null)
  const [plan, setPlan] = useState(null)
  const [con, setCon] = useState(null)

  useEffect(() => {
    if (!organizacionId) return
    let vivo = true
    ;(async () => {
      const { data: o } = await supabase
        .from('organizaciones').select('*').eq('id', organizacionId).maybeSingle()
      if (!vivo || !o) return
      setOrg(o)
      if (o.plan_id) {
        const { data: p } = await supabase
          .from('planes').select('*').eq('id', o.plan_id).maybeSingle()
        if (vivo) setPlan(p || null)
      }
      const { data: c } = await supabase.rpc('consumo_organizaciones')
      if (vivo) {
        setCon((c || []).find(f => f.organizacion_id === Number(organizacionId)) || null)
      }
    })()
    return () => { vivo = false }
  }, [organizacionId])

  if (!org || org.exenta_de_limites) return null

  const s = situacion(org)
  const lim = limites(org, plan)
  const uso = con || { alumnos: 0, cursos: 0, facilitadores: 0 }
  const topes = [
    ['Alumnos', uso.alumnos, lim.alumnos],
    ['Cursos', uso.cursos, lim.cursos],
    ['Facilitadores', uso.facilitadores, lim.facilitadores],
  ]
  const apretado = topes.some(([, u, t]) => ['alto', 'lleno'].includes(nivelUso(u, t)))

  // Nada que decir: ni el cobro ni los topes piden atención.
  if (!requiereAtencion(s.clave) && !apretado) return null

  return (
    <div className={`plan-franja plan-${s.tono}`}>
      <div className="plan-franja-cab">
        <strong>{plan ? `Plan ${plan.nombre}` : 'Sin plan asignado'}</strong>
        <span className={`badge susc-${s.tono}`}>{s.etiqueta}</span>
        {org.vence_en && <span className="celda-sub">Vence el {fechaCorta(org.vence_en)}</span>}
      </div>
      <div className="plan-franja-topes">
        {topes.map(([etiqueta, u, t]) => (
          <span key={etiqueta} className="plan-tope">
            <em>{etiqueta}</em>
            <Uso usado={u} tope={t} />
          </span>
        ))}
      </div>
      <p className="nota">
        {s.clave === 'sin_plan'
          ? 'Tu aula funciona sin topes mientras no haya un plan asignado. Escríbenos para formalizarlo.'
          : apretado
            ? 'Estás cerca de tu tope. Cuando se llene no podrás inscribir más hasta ampliar el plan; escríbenos antes de que te pase en medio de una convocatoria.'
            : 'Hay algo pendiente con tu suscripción. Tus alumnos siguen entrando con normalidad.'}
      </p>
    </div>
  )
}
