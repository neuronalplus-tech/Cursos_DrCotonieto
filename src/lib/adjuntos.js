/* ============================================================
   ADJUNTOS DE LOS MENSAJES
   ------------------------------------------------------------
   El bucket `chat_adjuntos` era público, y un bucket público sirve
   sus archivos a cualquiera que tenga la dirección: sin sesión, sin
   pasar por ninguna política. Ahí van los archivos que se adjuntan
   en los mensajes privados entre el docente y sus alumnos. Para
   material clínico eso no es lo que nadie entiende por «privado».

   LO QUE CAMBIA
   Antes se guardaba en la base la dirección pública completa. Ahora
   se guarda la RUTA dentro del bucket, y la dirección se firma en
   el momento de mostrarla: vale unos minutos y caduca.

   POR QUÉ NO HIZO FALTA MIGRAR NADA
   Los mensajes antiguos tienen guardada la dirección completa. En
   vez de reescribirlos uno por uno —y de arriesgarse a perder
   alguno—, se les saca la ruta de dentro de esa dirección. La forma
   es fija y conocida:

       https://…/storage/v1/object/public/chat_adjuntos/<ruta>

   Así, viejos y nuevos acaban en el mismo sitio y el cambio no
   depende de que una migración salga perfecta.
   ============================================================ */

import { CHAT_ADJUNTOS_BUCKET } from '../config.js'

/** Minutos que vale una dirección firmada. */
export const VIGENCIA_SEGUNDOS = 600

/**
 * Saca la ruta dentro del bucket, venga como venga.
 *
 * Acepta la ruta tal cual (lo que se guarda desde ahora) o una
 * dirección pública completa (lo que hay guardado de antes).
 * Devuelve null si no reconoce nada, que es más seguro que devolver
 * algo a medias y pedir una firma de una ruta inventada.
 */
export function rutaDeAdjunto(valor, bucket = CHAT_ADJUNTOS_BUCKET) {
  const s = String(valor || '').trim()
  if (!s) return null

  // Ruta directa: no es una dirección.
  if (!/^https?:\/\//i.test(s)) return s.replace(/^\/+/, '')

  // Dirección completa: lo que va después del nombre del bucket.
  // Se busca `/<bucket>/` y no solo el nombre suelto, porque un
  // archivo podría llamarse igual que el bucket.
  const marca = `/${bucket}/`
  const i = s.indexOf(marca)
  if (i === -1) return null

  const resto = s.slice(i + marca.length)
  // Una dirección firmada trae `?token=…`; la pública, no. Se corta
  // igual por si acaso, porque el token no es parte de la ruta.
  const sinConsulta = resto.split('?')[0]
  try {
    return decodeURIComponent(sinConsulta)
  } catch {
    // Una ruta con un `%` suelto hace estallar decodeURIComponent.
    // Mejor la ruta sin descodificar que nada.
    return sinConsulta
  }
}

/**
 * Dirección temporal para ver un adjunto.
 *
 * Devuelve null si no se puede firmar —porque la ruta no se
 * reconoce o porque quien pregunta no tiene permiso—, y quien llama
 * decide qué enseñar. Nunca devuelve la dirección pública como
 * respaldo: eso reabriría justo el agujero que esto cierra.
 */
export async function firmarAdjunto(supabase, valor, bucket = CHAT_ADJUNTOS_BUCKET) {
  const ruta = rutaDeAdjunto(valor, bucket)
  if (!ruta) return null
  const { data, error } = await supabase.storage
    .from(bucket).createSignedUrl(ruta, VIGENCIA_SEGUNDOS)
  if (error) return null
  return data?.signedUrl || null
}
