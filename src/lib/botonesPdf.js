/* ============================================================
   PDF EN LOS BOTONES
   ------------------------------------------------------------
   Un botón con `archivo` (en vez de `url`) abre ese PDF dentro de
   la plataforma, como «Ver aquí» de una grabación. El archivo vive
   en el bucket PRIVADO `botones_pdf`; se lee con la sesión de quien
   mira (ver supabase/BOTONES_PDF.sql).
   ============================================================ */
import { supabase } from './supabase'
import { BOTONES_PDF_BUCKET } from '../config'

export const MAX_PDF_MB = 25

/** Sube un PDF y devuelve su ruta en el bucket. Lanza Error con un mensaje claro. */
export async function subirPdfBoton(archivo) {
  if (!archivo) throw new Error('No se eligió ningún archivo.')
  if (archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) throw new Error('Solo se aceptan archivos PDF.')
  if (archivo.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`El PDF pesa más de ${MAX_PDF_MB} MB.`)
  const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')
  const ruta = `${Date.now()}_${limpio}`
  const { error } = await supabase.storage.from(BOTONES_PDF_BUCKET)
    .upload(ruta, archivo, { contentType: 'application/pdf', upsert: false })
  if (error) {
    throw new Error(/bucket not found/i.test(error.message)
      ? 'Falta crear el almacén de PDF: corre supabase/BOTONES_PDF.sql en el SQL Editor.'
      : error.message)
  }
  return ruta
}

/** Borra el archivo (al quitar el botón). Sin error si ya no estaba. */
export async function borrarPdfBoton(ruta) {
  if (!ruta) return
  try { await supabase.storage.from(BOTONES_PDF_BUCKET).remove([ruta]) } catch { /* ya no estaba */ }
}

/** ¿Este botón guardado cuenta como completo? (texto + enlace o PDF) */
export const botonValido = (b) => !!(b.texto || '').trim() && (!!(b.url || '').trim() || !!b.archivo)

/** Lo que se guarda: solo botones completos y sin la marca interna `nuevo`. */
export const botonesParaGuardar = (lista) =>
  (lista || []).filter(botonValido).map(({ nuevo, ...b }) => b) // eslint-disable-line no-unused-vars
