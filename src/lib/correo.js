/* ============================================================
   ENVÍO DE CORREO (relay con Google Apps Script · F6-3)
   ------------------------------------------------------------
   DESDE F6-3 EL NAVEGADOR YA NO LLAMA AL APPS SCRIPT
   Antes este módulo inyectaba un <script> (JSONP) contra la URL
   del Apps Script: la URL vive en el bundle, así que cualquiera
   en internet con esa URL podía mandar correo desde la cuenta
   del doctor (hallazgo B1 del diagnóstico). Ningún secreto
   puesto aquí serviría: el navegador es una caja abierta.

   Ahora la llamada va a la Edge Function `correo-enviar`, que
   comprueba sesión y permiso (admins o facilitadores), aplica
   sus frenos y reenvía al Apps Script con el SECRETO
   compartido —que solo viven en Supabase y en Apps Script—. El
   único caso sin sesión es `solicitud-materiales`, el
   formulario público del taller, y la función rearma ese
   payload sola: nadie puede colar asuntos ni cuerpos.

   LA FORMA DE SEGUIR SIN CAMBIAR A NADIE
   `enviarCorreo(payload)` devuelve la misma promesa de siempre:
   { ok, motivo?, data?, sinConfirmacion? }. Todos los botones
   que ya la usan siguen funcionando igual, y los errores de
   verdad (script viejo, secreto mal configurado, tope 429)
   llegan escritos en `motivo`.
   ============================================================ */

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
 * Envía un payload a la Edge Function `correo-enviar` y espera la
 * confirmación REAL del Apps Script (que la función retransmite tal
 * cual). Aquí no hay lógica de permiso ni de secreto: la que manda
 * es la del servidor, y este módulo solo transporta y traduce.
 *
 * SIN SESIÓN solo puede pasar `solicitud-materiales`; la función
 * lo asegura. Por eso se manda la llave pública como Authorization
 * cuando no hay sesión: el gateway de las funciones exige un JWT,
 * y el anónimo lo es.
 *
 * @param {object} payload  lo que espera el script (tipo, asunto, alumnos, …)
 * @returns {Promise<{ok:boolean, motivo?:string, data?:any, sinConfirmacion?:boolean}>}
 */
export async function enviarCorreo(payload) {
  try {
    const { data: sesion } = await supabase.auth.getSession()
    const token = sesion?.session?.access_token

    const corte = new AbortController()
    const reloj = setTimeout(() => corte.abort(), TIMEOUT_MS)
    let res
    try {
      res = await fetch(`${supabase.supabaseUrl}/functions/v1/correo-enviar`, {
        method: 'POST',
        signal: corte.signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: supabase.supabaseKey,
          Authorization: `Bearer ${token || supabase.supabaseKey}`,
        },
        body: JSON.stringify(payload),
      })
    } finally {
      clearTimeout(reloj)
    }

    let datos = null
    try { datos = await res.json() } catch { datos = null }

    if (!res.ok) {
      // Error de la función (401/403/413/429/500…): el motivo ya
      // viene escrito para la persona, no hace falta traducirlo.
      return {
        ok: false,
        data: datos || undefined,
        motivo: (datos && (datos.error || datos.motivo)) ||
                `El servidor de correo contestó ${res.status}.`,
      }
    }

    const esError = !datos || datos.ok === false || !!datos.error
    return {
      ok: !esError,
      data: datos || undefined,
      motivo: esError
        ? (datos && (datos.error || datos.motivo)) || 'El script devolvió un error.'
        : undefined,
    }
  } catch (e) {
    const abortado = e && e.name === 'AbortError'
    return {
      ok: false,
      sinConfirmacion: abortado,
      motivo: abortado
        ? `El servidor de correo no confirmó en ${TIMEOUT_MS / 1000} s. ` +
          'Puede que sí se haya enviado; revisa Gmail antes de reintentar.'
        : 'No se pudo contactar el servidor de correo: ' + ((e && e.message) || e),
    }
  }
}

/** Convierte un resultado de enviarCorreo() en un mensaje para la interfaz. */
export function mensajeResultado(res, { exitoSiConfirmado = '✓ Enviado.' } = {}) {
  if (!res) return 'Sin respuesta.'
  if (res.ok) return exitoSiConfirmado + (res.data ? '' : ' (sin detalle)')
  if (res.sinConfirmacion) {
    return '⚠️ ' + res.motivo
  }
  return '✗ No se envió: ' + (res.motivo || 'error desconocido')
}

