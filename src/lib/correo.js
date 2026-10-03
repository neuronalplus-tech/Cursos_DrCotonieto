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

const TIMEOUT_MS = 20000

/**
 * Envía un payload al Apps Script y ESPERA CONFIRMACIÓN REAL.
 *
 * @param {object} payload  lo que espera el script (tipo, asunto, alumnos, …)
 * @returns {Promise<{ok:boolean, motivo?:string, data?:any, sinConfirmacion?:boolean}>}
 *
 * ok:true                → el script respondió (confirmado)
 * ok:false               → el script respondió con error, o no respondió
 * sinConfirmacion:true   → no hubo respuesta en el tiempo esperado
 */
export function enviarCorreo(payload) {
  return new Promise((resolve) => {
    if (!APPS_SCRIPT_URL) {
      resolve({ ok: false, motivo: 'No hay URL de Apps Script configurada (APPS_SCRIPT_URL).' })
      return
    }

    const nombreCb = '__correoCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)
    let terminado = false

    const limpiar = () => {
      delete window[nombreCb]
      if (script && script.parentNode) script.parentNode.removeChild(script)
      clearTimeout(timer)
    }

    const finalizar = (resultado) => {
      if (terminado) return
      terminado = true
      limpiar()
      resolve(resultado)
    }

    // Si el script responde, llamamos esto.
    window[nombreCb] = function (respuesta) {
      // El script puede devolver {ok:true} o {error:"..."} o un objeto simple.
      const esError = respuesta && (respuesta.ok === false || respuesta.error)
      finalizar({
        ok: !esError,
        data: respuesta,
        motivo: esError
          ? (respuesta.error || 'El script devolvió un error.')
          : undefined,
      })
    }

    const script = document.createElement('script')
    script.src = APPS_SCRIPT_URL +
      '?callback=' + nombreCb +
      '&payload=' + encodeURIComponent(JSON.stringify(payload))

    // Si Google devuelve una página de error (script inexistente, sin permiso),
    // al cargarla como <script> dispara un error de sintaxis → script.onerror.
    script.onerror = () => finalizar({
      ok: false,
      motivo: 'Google no pudo ejecutar el script. Revisa que esté desplegado como "Web app" ' +
              'con acceso "Cualquier persona".',
    })

    const timer = setTimeout(() => finalizar({
      ok: false,
      sinConfirmacion: true,
      motivo: 'El script no confirmó en ' + (TIMEOUT_MS / 1000) + ' s. ' +
              'Puede que sí se haya enviado, o que el script no devuelva nada: ' +
              'en ese caso no hay forma de verificarlo desde el navegador.',
    }), TIMEOUT_MS)

    document.body.appendChild(script)
  })
}

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