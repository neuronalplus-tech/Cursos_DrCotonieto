/* ============================================================
   ELEMENTOS EDITABLES DESDE LA PÁGINA
   ------------------------------------------------------------
   Cuatro envoltorios y UN solo diálogo:

     <TextoEditable>   un texto (título, párrafo, etiqueta)
     <ImagenEditable>  una imagen (la URL)
     <ListaEditable>   una lista (servicios, redes, casos…)
     <BotonEditable>   un botón o enlace: texto, enlace o mensaje
                       de WhatsApp, estilo, colores, visible,
                       eliminar

   Fuera del modo edición se pintan igual que siempre (con lo que
   haya en `contenido_sitio` encima). En modo edición cada uno lleva
   un lápiz ✏️ que abre el MISMO diálogo.

   BOTONES QUE YA VIVÍAN EN LA BASE
   El registro, la grabación y los botones extra de un taller ya
   guardaban su texto y enlace en `cursos`/`curso_material`. Para
   no crear dos verdades, `fuente` le dice al diálogo dónde guardar
   esos campos: el diálogo es el mismo, el destino es el de siempre.
   La apariencia (estilo, colores) va a `contenido_sitio`.
   ============================================================ */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalPortal } from './ui'
import { ESTILOS_BOTON } from '../config'
import { useOrganizacion } from '../lib/organizacion'
import { usePermisos } from '../lib/permisos'
import {
  useContenido, resolver, claveCon, rellenar, enlaceDe,
  guardarCapa, restablecerCapa, tieneCapa, alternarEdicion, fijarPuedeEditar,
} from '../lib/contenido'

function useCapa() {
  const { organizacion } = useOrganizacion()
  const c = useContenido(organizacion?.id)
  return { ...c, orgId: organizacion?.id ?? null }
}

/** Lápiz que abre el diálogo. Solo existe en modo edición. */
function Lapiz({ onClick, etiqueta }) {
  return (
    <button type="button" className="editable-lapiz"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      aria-label={`Editar: ${etiqueta}`} title={`Editar: ${etiqueta}`}>
      ✏️
    </button>
  )
}

/** Quita del objeto los campos vacíos: «vacío» = usar lo de siempre. */
function sinVacios(o) {
  const r = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === '' || v === undefined || v === null) continue
    r[k] = v
  }
  return r
}

/** `**así**` se pinta en negritas (solo donde el elemento lo permite). */
function conNegritas(texto) {
  const partes = String(texto).split(/\*\*(.+?)\*\*/g)
  return partes.length === 1 ? texto
    : partes.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))
}

/** Explica qué marcadores ({titulo}, {ruta}…) entiende este elemento. */
function NotaMarcadores({ datos, negritas }) {
  const claves = Object.keys(datos || {})
  if (!claves.length && !negritas) return null
  return (
    <p className="nota">
      {claves.length > 0 && <>Marcadores: {claves.map((k, i) => (
        <span key={k}>{i > 0 && ', '}<code>{`{${k}}`}</code> → «{datos[k]}»</span>
      ))}. </>}
      {negritas && <>Escribe <code>**así**</code> para poner negritas.</>}
    </p>
  )
}

/* ------------------------------------------------------------
   EL DIÁLOGO ÚNICO
   ------------------------------------------------------------ */
function EditorCapa({ tipo, clave, ambito, etiquetaAmbito, defecto, actual, fuente, campos, datos, negritas, onClose }) {
  const { orgId, falta, errorCarga } = useCapa()
  const [alcance, setAlcance] = useState(ambito ? 'general' : 'unico')
  const [v, setV] = useState(() => ({ ...actual }))
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const campo = (k, val) => setV((x) => ({ ...x, [k]: val }))

  const claveDestino = alcance === 'ambito' ? claveCon(clave, ambito) : clave

  // Lo que va a `contenido_sitio`: solo lo que difiere del valor por
  // omisión. Así un cambio en el código sigue llegando a lo no tocado.
  // Para «solo aquí» la referencia es lo que ya aplica en general: así
  // también se puede volver, solo aquí, a algo que en general cambió.
  const capaNueva = () => {
    const referencia = alcance === 'ambito' ? resolver(clave, defecto) : defecto
    const r = {}
    for (const [k, val] of Object.entries(v)) {
      if (k === 'eliminado') continue
      if (k === 'visible' && val !== false && referencia.visible !== false) continue
      if (fuente && (k === 'texto' || k === 'url' || (k === 'visible' && fuente.visible !== undefined))) continue
      if (JSON.stringify(val) !== JSON.stringify(referencia[k])) r[k] = val
    }
    return sinVacios(r)
  }

  const guardar = async () => {
    setGuardando(true); setMsg(null)
    try {
      if (fuente?.guardar) {
        const cambios = {}
        if (v.texto !== actual.texto) cambios.texto = v.texto
        if (v.url !== actual.url) cambios.url = v.url
        if (fuente.visible !== undefined && v.visible !== actual.visible) cambios.visible = v.visible !== false
        if (Object.keys(cambios).length) await fuente.guardar(cambios)
      }
      const capa = capaNueva()
      if (Object.keys(capa).length) {
        await guardarCapa(claveDestino, capa, orgId)
      } else if (tieneCapa(claveDestino)) {
        await restablecerCapa(claveDestino, orgId)
      }
      onClose()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const restablecer = async () => {
    if (!window.confirm('¿Volver a como estaba originalmente? Se borra lo que editaste aquí.')) return
    setGuardando(true); setMsg(null)
    try { await restablecerCapa(claveDestino, orgId); onClose() } catch (e) { setMsg(e.message) } finally { setGuardando(false) }
  }

  const eliminar = async () => {
    if (fuente?.eliminar) {
      if (!window.confirm('¿Eliminar este botón definitivamente? Se borra de la base.')) return
      setGuardando(true); setMsg(null)
      try { await fuente.eliminar(); onClose() } catch (e) { setMsg(e.message) } finally { setGuardando(false) }
      return
    }
    if (!window.confirm('¿Eliminar este elemento? Desaparece para todos. Podrás recuperarlo en modo edición con «Restaurar».')) return
    setGuardando(true); setMsg(null)
    try { await guardarCapa(claveDestino, { ...capaNueva(), eliminado: true }, orgId); onClose() } catch (e) { setMsg(e.message) } finally { setGuardando(false) }
  }

  const restaurar = async () => {
    setGuardando(true); setMsg(null)
    try {
      const capa = capaNueva()
      delete capa.eliminado
      if (Object.keys(capa).length) await guardarCapa(claveDestino, capa, orgId)
      else await restablecerCapa(claveDestino, orgId)
      onClose()
    } catch (e) { setMsg(e.message) } finally { setGuardando(false) }
  }

  const items = v.items || []
  const moverItem = (i, d) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const n = [...items];[n[i], n[j]] = [n[j], n[i]]
    campo('items', n)
  }

  return (
    <ModalPortal onClose={onClose} label="Editar elemento">
      <div className="modal-overlay" onClick={() => !guardando && onClose()}>
        <div className="modal-box modal-recurso editor-capa" onClick={(e) => e.stopPropagation()}>
          <h3>✏️ Editar {tipo === 'boton' ? 'botón' : tipo === 'imagen' ? 'imagen' : tipo === 'lista' ? 'lista' : 'texto'}</h3>

          {falta && (
            <p className="aviso-error">{errorCarga}</p>
          )}

          {ambito && (
            <fieldset className="editor-capa-alcance">
              <legend>¿Dónde aplica el cambio?</legend>
              <label><input type="radio" checked={alcance === 'general'} onChange={() => setAlcance('general')} /> En todos ({etiquetaAmbito?.general || 'todos los elementos de este tipo'})</label>
              <label><input type="radio" checked={alcance === 'ambito'} onChange={() => setAlcance('ambito')} /> Solo aquí ({etiquetaAmbito?.unico || ambito})</label>
            </fieldset>
          )}

          {(tipo === 'texto' || tipo === 'boton') && (
            <>
              <label htmlFor="ec-texto">Texto</label>
              {tipo === 'texto' && (v.texto || '').length > 60
                ? <textarea id="ec-texto" className="modal-textarea" rows={4} value={v.texto || ''} onChange={(e) => campo('texto', e.target.value)} />
                : <input id="ec-texto" className="input" value={v.texto || ''} onChange={(e) => campo('texto', e.target.value)} />}
              {tipo === 'texto' && <NotaMarcadores datos={datos} negritas={negritas} />}
            </>
          )}

          {tipo === 'boton' && defecto.textoAbierto !== undefined && (
            <>
              <label htmlFor="ec-texto-abierto">Texto cuando está desplegado</label>
              <input id="ec-texto-abierto" className="input" value={v.textoAbierto || ''} onChange={(e) => campo('textoAbierto', e.target.value)} />
            </>
          )}

          {tipo === 'imagen' && (
            <>
              <label htmlFor="ec-src">Dirección (URL) de la imagen</label>
              <input id="ec-src" className="input" value={v.src || ''} onChange={(e) => campo('src', e.target.value)} placeholder="https://…" />
              {v.src && <img src={v.src} alt="Vista previa" className="editor-capa-previa" />}
            </>
          )}

          {tipo === 'boton' && (
            <>
              <label htmlFor="ec-url">Enlace (URL)</label>
              <input id="ec-url" className="input" value={v.url || ''} onChange={(e) => campo('url', e.target.value)}
                placeholder={v.mensaje ? 'Vacío = usa el mensaje de WhatsApp de abajo' : 'https://… o /ruta-interna'} />
              {!fuente && (
                <>
                  <label htmlFor="ec-mensaje">Mensaje de WhatsApp (si no hay enlace)</label>
                  <textarea id="ec-mensaje" className="modal-textarea" rows={3} value={v.mensaje || ''}
                    onChange={(e) => campo('mensaje', e.target.value)} />
                  <NotaMarcadores datos={datos} />
                  <p className="nota">Si pones un enlace arriba, gana el enlace.</p>
                  <label htmlFor="ec-numero">Número de WhatsApp (vacío = el de siempre)</label>
                  <input id="ec-numero" className="input" inputMode="tel" value={v.whatsapp || ''}
                    onChange={(e) => campo('whatsapp', e.target.value)} placeholder="5215512345678" />
                </>
              )}

              <label htmlFor="ec-estilo">Estilo</label>
              <select id="ec-estilo" className="input" value={v.estilo || ''} onChange={(e) => campo('estilo', e.target.value)}>
                <option value="">(el de siempre)</option>
                {ESTILOS_BOTON.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
              </select>
            </>
          )}

          {(tipo === 'texto' || tipo === 'boton') && (
            <div className="editor-capa-colores">
              {tipo === 'boton' && (
                <label>Fondo{' '}
                  <input type="color" value={v.fondo || '#1b3a4b'} onChange={(e) => campo('fondo', e.target.value)} />
                  {v.fondo && <button type="button" className="button texto" onClick={() => campo('fondo', '')}>quitar</button>}
                </label>
              )}
              <label>Color del texto{' '}
                <input type="color" value={v.colorTexto || '#1b3a4b'} onChange={(e) => campo('colorTexto', e.target.value)} />
                {v.colorTexto && <button type="button" className="button texto" onClick={() => campo('colorTexto', '')}>quitar</button>}
              </label>
            </div>
          )}

          {tipo === 'lista' && (
            <div className="editor-capa-lista">
              {items.map((it, i) => (
                <div key={i} className="editor-capa-fila">
                  {campos.map((c) => (
                    <input key={c.k} className="input" placeholder={c.etiqueta} aria-label={`${c.etiqueta} ${i + 1}`}
                      value={(typeof it === 'string' ? (c.k === 'texto' ? it : '') : it[c.k]) || ''}
                      onChange={(e) => {
                        const n = [...items]
                        n[i] = typeof it === 'string' ? e.target.value : { ...it, [c.k]: e.target.value }
                        campo('items', n)
                      }} />
                  ))}
                  <button type="button" className="button texto" onClick={() => moverItem(i, -1)} aria-label="Subir">↑</button>
                  <button type="button" className="button texto" onClick={() => moverItem(i, 1)} aria-label="Bajar">↓</button>
                  <button type="button" className="button texto" aria-label={`Quitar elemento ${i + 1}`}
                    onClick={() => campo('items', items.filter((_, j) => j !== i))}>🗑</button>
                </div>
              ))}
              <button type="button" className="button secondary"
                onClick={() => campo('items', [...items, campos.length === 1 && campos[0].k === 'texto' ? '' : {}])}>
                + Añadir
              </button>
            </div>
          )}

          <label className="editor-capa-check">
            <input type="checkbox" checked={v.visible !== false} onChange={(e) => campo('visible', e.target.checked)} />
            Visible para el público
          </label>

          {msg && <p className="aviso-error" role="alert">{msg}</p>}

          <div className="modal-botones">
            <button type="button" className="button primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {actual.eliminado
              ? <button type="button" className="button secondary" onClick={restaurar} disabled={guardando}>Restaurar</button>
              : <button type="button" className="button texto peligro" onClick={eliminar} disabled={guardando}>🗑 Eliminar</button>}
            {tieneCapa(claveDestino) && (
              <button type="button" className="button texto" onClick={restablecer} disabled={guardando}>Restablecer original</button>
            )}
            <button type="button" className="button texto" onClick={onClose} disabled={guardando}>Cancelar</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

/** Estado común: valor resuelto, si se muestra y el diálogo. */
function useElemento(clave, defecto, ambito) {
  const ctx = useCapa()
  const [abierto, setAbierto] = useState(false)
  const v = resolver(clave, defecto, ambito)
  const oculto = v.eliminado || v.visible === false
  return { ctx, v, oculto, abierto, setAbierto, mostrar: ctx.editando || !oculto }
}

const marcaEdicion = (v) =>
  `editable${v.eliminado ? ' editable-eliminado' : v.visible === false ? ' editable-oculto' : ''}`

/* ------------------------------------------------------------ */
export function TextoEditable({
  clave, defecto = '', as: Etiqueta = 'span', className, ambito, etiquetaAmbito, datos, comillas, negritas, style,
}) {
  const { ctx, v, mostrar, abierto, setAbierto } = useElemento(clave, { texto: defecto }, ambito)
  if (!mostrar) return null
  const texto = rellenar(v.texto, datos)
  const estilo = v.colorTexto ? { ...style, color: v.colorTexto } : style
  const visible = comillas ? `"${texto}"` : texto
  return (
    <Etiqueta className={[className, ctx.editando && marcaEdicion(v)].filter(Boolean).join(' ') || undefined} style={estilo}>
      {negritas ? conNegritas(visible) : visible}
      {ctx.editando && <Lapiz etiqueta={texto.replace(/\*\*/g, '') || clave} onClick={() => setAbierto(true)} />}
      {abierto && (
        <EditorCapa tipo="texto" clave={clave} ambito={ambito} etiquetaAmbito={etiquetaAmbito}
          defecto={{ texto: defecto }} datos={datos} negritas={negritas}
          actual={v} onClose={() => setAbierto(false)} />
      )}
    </Etiqueta>
  )
}

/* ------------------------------------------------------------ */
export function ImagenEditable({ clave, defecto, alt, className }) {
  const { ctx, v, mostrar, abierto, setAbierto } = useElemento(clave, { src: defecto }, undefined)
  if (!mostrar) return null
  const img = <img src={v.src} alt={alt} className={className} />
  if (!ctx.editando) return img
  return (
    <span className={`${marcaEdicion(v)} editable-imagen`}>
      {img}
      <Lapiz etiqueta={alt || 'imagen'} onClick={() => setAbierto(true)} />
      {abierto && (
        <EditorCapa tipo="imagen" clave={clave} defecto={{ src: defecto }} actual={v}
          onClose={() => setAbierto(false)} />
      )}
    </span>
  )
}

/* ------------------------------------------------------------
   `campos`: [{ k, etiqueta }]. Con un solo campo `texto`, los
   elementos son cadenas simples (p. ej. CASOS).
   `children(items)` pinta la lista como siempre.
   ------------------------------------------------------------ */
export function ListaEditable({ clave, defecto = [], campos, children, etiqueta }) {
  const { ctx, v, mostrar, abierto, setAbierto } = useElemento(clave, { items: defecto }, undefined)
  if (!mostrar) return null
  const items = Array.isArray(v.items) ? v.items : defecto
  return (
    <>
      {children(items)}
      {ctx.editando && (
        <div className={`${marcaEdicion(v)} editable-lista-barra`}>
          <span>{etiqueta || 'Lista'}</span>
          <Lapiz etiqueta={etiqueta || 'lista'} onClick={() => setAbierto(true)} />
        </div>
      )}
      {abierto && (
        <EditorCapa tipo="lista" clave={clave} defecto={{ items: defecto }} actual={{ ...v, items }}
          campos={campos} onClose={() => setAbierto(false)} />
      )}
    </>
  )
}

/* ------------------------------------------------------------
   BOTÓN
   defecto: { texto, url?, mensaje?, estilo, textoAbierto? }
   clase:   clases fijas (p. ej. 'button ancho'); el estilo editable
            se añade aparte.
   onClick: para botones que hacen algo (desplegar, navegar). Si se
            edita un enlace, el enlace gana.
   to:      ruta interna (Link).
   abierto: para los que despliegan (usa textoAbierto).
   fuente:  { texto, url, visible?, guardar(cambios), eliminar? }
            cuando el texto/enlace viven en otra tabla.
   extra:   lo que se pinta al lado (p. ej. el candado de siempre).
   ------------------------------------------------------------ */
export function BotonEditable({
  clave, defecto, ambito, etiquetaAmbito, datos, clase = 'button', onClick, to,
  abierto: desplegado, fuente, extra, disabled, ariaExpanded, nuevaPestana = true,
  pintar, lapizDentro, ariaLabel, siempreVisible, textoDeshabilitado, role,
}) {
  const base = fuente
    ? { ...defecto, texto: fuente.texto ?? defecto.texto, url: fuente.url ?? defecto.url,
        ...(fuente.visible !== undefined ? { visible: fuente.visible } : {}) }
    : defecto
  const { ctx, v, mostrar, abierto, setAbierto } = useElemento(clave, base, ambito)
  // `siempreVisible`: quien gestiona ve el botón oculto (atenuado) para
  // poder volver a abrirlo con su candado, como antes.
  const ocultoParaGestor = siempreVisible && !v.eliminado && v.visible === false
  if (!mostrar && !ocultoParaGestor) return null

  const base0 = desplegado && v.textoAbierto ? v.textoAbierto : v.texto
  const textoPlano = rellenar(
    v.visible === false && !ctx.editando ? `${base0} (oculto)`
      : disabled && textoDeshabilitado ? textoDeshabilitado : base0,
    datos)
  const lapiz = ctx.editando && <Lapiz etiqueta={textoPlano || clave} onClick={() => setAbierto(true)} />
  // `pintar` deja envolver el texto (icono, parte que se oculta en móvil…);
  // `lapizDentro` mete el lápiz en el propio botón (los flotantes).
  const texto = <>{pintar ? pintar(textoPlano) : textoPlano}{lapizDentro && lapiz}</>
  const href = enlaceDe(v, datos)
  const aria = { ...(ariaLabel ? { 'aria-label': ariaLabel } : {}), ...(role ? { role } : {}) }
  const clases = [clase, v.estilo].filter(Boolean).join(' ')
  const estilo = (v.fondo || v.colorTexto)
    ? { ...(v.fondo ? { background: v.fondo, borderColor: v.fondo } : {}), ...(v.colorTexto ? { color: v.colorTexto } : {}) }
    : undefined

  // El enlace editado gana sobre la acción del código, salvo que el
  // código diga que el botón está deshabilitado (p. ej. «cerrado»).
  const enlaceEditado = (fuente ? v.url !== fuente.url : v.url !== defecto.url) || v.mensaje !== defecto.mensaje
  // «/curso/3» es una ruta de la app (Link); «/juegos/x.html» es un
  // archivo estático y el router no lo conoce: va como enlace normal.
  const rutaInterna = href?.startsWith('/') && !/\.\w+($|[?#])/.test(href)
  const comoEnlace = () => (rutaInterna
    ? <Link to={href} className={clases} style={estilo} {...aria}>{texto}</Link>
    : <a className={clases} style={estilo} href={href} {...aria}
        {...(nuevaPestana ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{texto}</a>)
  let el
  if (disabled || ocultoParaGestor) el = <button type="button" className={clases} style={estilo} disabled {...aria}>{texto}</button>
  else if (href && enlaceEditado) el = comoEnlace()
  else if (to) el = <Link to={to} className={clases} style={estilo} {...aria}>{texto}</Link>
  else if (onClick) el = <button type="button" className={clases} style={estilo} onClick={onClick} aria-expanded={ariaExpanded} {...aria}>{texto}</button>
  else if (href) el = comoEnlace()
  else el = <button type="button" className={clases} style={estilo} disabled {...aria}>{texto}</button>

  const editor = abierto && (
    <EditorCapa tipo="boton" clave={clave} ambito={ambito} etiquetaAmbito={etiquetaAmbito}
      defecto={base} actual={v} fuente={fuente} datos={datos} onClose={() => setAbierto(false)} />
  )
  if (!ctx.editando && !extra) return el
  if (lapizDentro) return <>{el}{extra}{editor}</>
  return (
    <div className={['card-boton-admin', ctx.editando && marcaEdicion(v)].filter(Boolean).join(' ')}>
      {el}
      {extra}
      {lapiz}
      {editor}
    </div>
  )
}

/* ------------------------------------------------------------
   BARRA FLOTANTE: enciende y apaga el modo edición. Solo la ve
   quien administra la organización de esta visita.
   ------------------------------------------------------------ */
export function BarraEdicion({ user }) {
  const ctx = useCapa()
  const { organizacion, cargado: orgCargada } = useOrganizacion()
  const permisos = usePermisos(user)
  // Mismo criterio que la política de la tabla: en el sitio de una
  // organización, quien la administra; sin organización, el de plataforma.
  const puede = !!user && permisos.cargado && orgCargada &&
    (organizacion?.id != null ? permisos.esAdminDe(organizacion.id) : permisos.esAdmin)
  useEffect(() => { fijarPuedeEditar(puede) }, [puede])
  if (!ctx.puedeEditar) return null
  return (
    <div className="barra-edicion" role="region" aria-label="Edición de la página">
      {ctx.editando && ctx.falta && (
        <p className="barra-edicion-aviso">⚠️ {ctx.errorCarga}</p>
      )}
      {ctx.editando && !ctx.falta && (
        <p className="barra-edicion-aviso">Toca ✏️ junto a cualquier elemento. Lo oculto se ve tenue; lo eliminado, tachado.</p>
      )}
      <button type="button" className="button primary" onClick={alternarEdicion} aria-pressed={ctx.editando}>
        {ctx.editando ? '✓ Terminar edición' : '✏️ Editar página'}
      </button>
    </div>
  )
}
