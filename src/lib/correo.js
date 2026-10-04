/* ============================================================
   ENVÍO DE CORREO (relay con Google Apps Script)

   POR QUÉ EXISTE ESTE MÓDULO
   Antes se usaba `fetch(url, { mode: 'no-cors' })`. Con "no-cors" el
   navegador descarta la respuesta como opaca: NO hay forma de saber si el
   script se ejecutó, si falló o si la URL está mal. El códigottpónicamente
   mostrar "✓ enviado" siempre. Ese mensaje verde NO probaba nada.

   AQUÍ SE USA JSONP
   Se inyecta un <script> con ?callback=..., que es la única forma de leer
   la respuesta de Apps Script desde el navegador sin CORS. Si el script
   devuelve un valor, lo recibimos de verdad y podemos confirmar o mostrar
   el error exacto de Google.
   ============================================================ */

import { APPS_SCRIPT_URL } from '../config'
import { supabase } from './supabase'

const TIMEOUT_MS = 20000

/**
 * Devuelve los correos de los inscritos activos del curso, sin repetir.
 * Se apoya en la vista de administración, que ya respeta RLS de es_admin().
 */
export async function obtenerEmailsInscritos(cursoId) {
  if (!cursoId) return []
  const { data, error } = await supabase
    .from('vista_admin_inscripciones').select('email, curso_id')
  if (error) throw error
  const delCurso = (data || []).filter(f => String(f.curso_id) === String(cursoId))
  return [...new Set(delCurso.map(f => (f.email || '').trim().toLowerCase()).filter(Boolean))]
}

/**
 * Atajo de un solo paso: busca a los inscritos y les manda la notificación.
 * Se usa desde el checkbox de "crear recurso" y de "crear módulo", para que
 * publicar y avisar sea una sola operación en vez de dos.
 *
 * @returns {Promise<{ok:boolean, enviados:number, motivo?:string}>}
 */
export async function notificarInscritos(cursoId, { tipo, curso, modulo, recurso }) {
  try {
    const emails = await obtenerEmailsInscritos(cursoId)
    if (!emails.length) return { ok: false, enviados: 0, motivo: 'No hay inscritos en este curso.' }
    const res = await enviarCorreo({
      tipo,
      curso,
      modulo,
      recurso,
      alumnos: emails.map(email => ({ email, nombre_completo: '' })),
    })
    return res.ok
      ? { ok: true, enviados: emails.length }
      : { ok: false, enviados: emails.length, motivo: res.motivo }
  } catch (e) {
    return { ok: false, enviados: 0, motivo: e.message }
  }
}

/**
 * Envía un payload al Apps Script y ESPERA CONFIRMACIÓN REAL.
 *
 * CÓMO SE LEE LA RESPUESTA
 * Con fetch + CORS es imposible (Google no manda cabeceras CORS) y con
 * 'no-cors' la respuesta llega opaca. La única vía es inyectar un <script>.
 *
 * NO usamos el parámetro `callback` de Google porque, comprobado contra un
 * deployment real, NO envuelve la salida: la respuesta llegó tal cual. Si
 * dependiéramos de él, el callback nunca se llamaría y cada envío acabaría
 * en timeout aunque el correo sí hubiera salido.
 *
 * En vez de eso, el script recibe un `reqid` y devuelve él mismo el JavaScript
 * `window.__appsCorreoRespuesta("<reqid>", {...})`. Es determinista: no depende
 * de que Google haga nada especial.
 *
 * @param {object} payload  lo que espera el script (tipo, asunto, alumnos, …)
 * @returns {Promise<{ok:boolean, motivo?:string, data?:any, sinConfirmacion?:boolean}>}
 */
export function enviarCorreo(payload) {
  return new Promise((resolve) => {
    if (!APPS_SCRIPT_URL) {
      resolve({ ok: false, motivo: 'No hay URL de Apps Script configurada (APPS_SCRIPT_URL).' })
      return
    }

    const reqid = 'r' + Date.now() + Math.floor(Math.random() * 1e6)

    // Un solo manejador global: el script sabe a qué petición contestar.
    if (!window.__appsCorreoRespuesta) {
      window.__appsCorreoRespuesta = function (idRecibido, datos) {
        const pendiente = pendientes[idRecibido]
        if (!pendiente) return
        delete pendientes[idRecibido]
        pendiente(datos)
      }
    }

    const finalizar = (resultado) => {
      const fn = pendientes[reqid]
      if (!fn) return
      delete pendientes[reqid]
      clearTimeout(timer)
      if (script && script.parentNode) script.parentNode.removeChild(script)
      window.removeEventListener('error', alEscucharError)
      resolve(resultado)
    }

    pendientes[reqid] = function (datos) {
      const esError = !datos || datos.ok === false || !!datos.error
      finalizar({
        ok: !esError,
        data: datos,
        motivo: esError ? (datos && (datos.error || datos.mensaje) || 'El script devolvió un error.') : undefined,
      })
    }

    const script = document.createElement('script')
    script.src = APPS_SCRIPT_URL +
      '?reqid=' + encodeURIComponent(reqid) +
      '&payload=' + encodeURIComponent(JSON.stringify(payload))

    // Fallo de red: script inexistente, sin permisos, 404…
    script.onerror = () => finalizar({
      ok: false,
      motivo: 'No se pudo cargar el script. Revisa que siga desplegado y con acceso ' +
              '"Cualquier persona".',
    })

    /**
     * CASO QUE ANTES COLGABA: si el deployment es el viejo, responde JSON plano.
     * Al cargarlo como <script> eso es un error de SINTACTIS, y para scripts
     * clásicos `script.onerror` NO se dispara (solo ante fallos de red). Antes
     * solo nos cubría el timeout, dejando el botón en "Enviando..." 20 s.
     * Este listener global sí recibe ese error, con el nombre del fichero.
     */
    function alEscucharError(evento) {
      const deNuestroScript =
        (evento && evento.target === script) ||
        (evento && typeof evento.filename === 'string' && evento.filename.indexOf(APPS_SCRIPT_URL) === 0)
      if (!deNuestroScript) return
      finalizar({
        ok: false,
        versionDesactualizada: true,
        motivo: 'El script respondió con un formato que el navegador no puede ejecutar. ' +
                'Es la versión anterior del Apps Script: hay que pegar el Notificador.gs nuevo, ' +
                'guardar y actualizar la implementación.',
      })
    }
    window.addEventListener('error', alEscucharError)

    const timer = setTimeout(() => finalizar({
      ok: false,
      sinConfirmacion: true,
      motivo: 'El script no confirmó en ' + (TIMEOUT_MS / 1000) + ' s. ' +
              'Puede que sí se haya enviado, o que la versión desplegada sea la antigua.',
    }), TIMEOUT_MS)

    document.body.appendChild(script)
  })
}

/** Peticiones en vuelo, indexadas por reqid. */
const pendientes = {}

/** Link para abrir el Apps Script en una pestaña y ver su respuesta real. */
export const LINK_APPS_SCRIPT = APPS_SCRIPT_URL

/** Convierte un resultado de enviarCorreo() en un mensaje para la interfaz. */
export function mensajeResultado(res,{exitoSiConfirmado = '✓ Enviado.' } = {}) {
  if (!res) return 'Sin respuesta.'
  if (res.ok) return exitoSiConfirmado + (res.data ? '' : ' (sin detalle)')
  if (res.sinConfirmacion) {
    return '⚠️ ' + res.motivo +
      ' Abre el script en una pestaña para ver el error real de Google.'
  }
  return '✗ No se envió: ' + (res.motivo || 'error desconocido')
}