/* ============================================================
   ARCHIVOS EN LOS BOTONES
   ------------------------------------------------------------
   Un botón con `archivo` (en vez de `url`) abre ese archivo (PDF, Word,
   Excel…) dentro de la plataforma, como «Ver aquí» y también se puede
   descargar. El archivo vive en el bucket PRIVADO `botones_pdf`; se lee con la sesión de quien
   mira (ver supabase/BOTONES_PDF.sql).
   ============================================================ */
import { supabase } from './supabase'
import { BOTONES_PDF_BUCKET } from '../config'

export const MAX_PDF_MB = 25

/** Extensiones que se aceptan y cómo se pueden ver dentro de la plataforma. */
export const TIPOS_ARCHIVO = {
  pdf: 'pdf',
  doc: 'office', docx: 'office', xls: 'office', xlsx: 'office', ppt: 'office', pptx: 'office',
  png: 'imagen', jpg: 'imagen', jpeg: 'imagen', gif: 'imagen', webp: 'imagen',
  txt: 'texto', csv: 'texto',
  zip: 'descarga', rar: 'descarga', odt: 'descarga', ods: 'descarga', odp: 'descarga',
}
export const ACEPTA_ARCHIVOS = Object.keys(TIPOS_ARCHIVO).map((e) => '.' + e).join(',')
const MIME = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
}

export const extensionDe = (nombre) => (String(nombre || '').split('.').pop() || '').toLowerCase()
/** 'pdf' | 'office' | 'imagen' | 'texto' | 'descarga' */
export const tipoDeArchivo = (nombre) => TIPOS_ARCHIVO[extensionDe(nombre)] || 'descarga'
export const nombreDeArchivo = (ruta) => String(ruta || '').replace(/^\d+_/, '').split('/').pop()

/** Sube un archivo y devuelve su ruta en el bucket. Lanza Error con un mensaje claro. */
export async function subirArchivoBoton(archivo) {
  if (!archivo) throw new Error('No se eligió ningún archivo.')
  const ext = extensionDe(archivo.name)
  if (!TIPOS_ARCHIVO[ext]) throw new Error('Tipo de archivo no permitido. Usa PDF, Word, Excel, PowerPoint, imagen, TXT/CSV o ZIP.')
  if (archivo.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_PDF_MB} MB.`)
  const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')
  const ruta = `${Date.now()}_${limpio}`
  const { error } = await supabase.storage.from(BOTONES_PDF_BUCKET)
    .upload(ruta, archivo, { contentType: MIME[ext] || archivo.type || 'application/octet-stream', upsert: false })
  if (error) {
    throw new Error(/bucket not found/i.test(error.message)
      ? 'Falta crear el almacén de archivos: corre supabase/BOTONES_PDF.sql en el SQL Editor.'
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
