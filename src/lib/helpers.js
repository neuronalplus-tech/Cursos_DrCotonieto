/* ============================================================
   HELPERS PUROS (sin React, sin Supabase)
   Extraídos de App.jsx durante el refactor. Mismo comportamiento.
   ============================================================ */

// Con extensión: Vite resuelve `../config` igual, pero Node no, y las
// pruebas de supabase/test-helpers.mjs importan este archivo directo.
import { CURSOS_ESPECIALES } from '../config.js'

/** Quita acentos y pasa a minúsculas, para comparar títulos de forma tolerante. */
const sinAcentos = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function normalizarTexto(s) {
  return (s || '').toString().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim()
}

/** El curso contenedor de talleres (título "Talleres gratuitos"). */
export function esContenedorTalleres(curso) {
  if (!curso) return false
  const t = sinAcentos(curso.titulo)
  return t.includes('taller') && t.includes('gratuit')
}

/**
 * Un curso gratuito sin `linea` se clasifica como "taller individual".
 * IMPORTANTE: la portada filtra con `.filter(c => !esTallerIndividual(c))`,
 * por eso un curso `gratuito = true` y sin `linea` NO aparece en el inicio.
 */
export function esTallerIndividual(curso) {
  if (!curso || !curso.gratuito) return false
  if (esContenedorTalleres(curso)) return false
  return !curso.linea
}

/**
 * ¿Esta persona puede ver este módulo?
 *
 * El parámetro se llama `gestionaCurso` y no `esAdmin` porque la
 * pregunta correcta desde que existe el rol Facilitador es si
 * gestiona ESTE curso, no si administra la plataforma. Quien lo
 * llama ya lo calcula con `puedeGestionar(curso_id)`.
 *
 * Ojo con renombrarlo: al desestructurar, un nombre que no coincide
 * con lo que manda quien llama no es un error, es `undefined`. Esta
 * función se pasó un tiempo recibiendo `gestionaCurso` mientras leía
 * `esAdmin`, así que el permiso de quien gestiona el curso no se
 * aplicaba nunca y los módulos con ruta salían como privados incluso
 * para el administrador.
 */
export function moduloVisible(m, { user, gestionaCurso, miGrupo }) {
  if (gestionaCurso) return true
  if (m.oculto && !user) return false
  if (m.grupo) {
    if (!user) return false
    if (m.grupo !== miGrupo) return false
  }
  return true
}

export function moduloBloqueadoParaAlumno(m) {
  // Con `m && ...` esto devolvía null para un módulo nulo. Funciona
  // igual dentro de un `if`, pero una función que pregunta sí o no
  // debe contestar sí o no.
  return !!m && m.disponible === false
}

export function emiteConstancia(curso) {
  if (!curso) return false
  if (curso.gratuito) return false
  if (curso.constanciaConfigurada === false || curso.constancia === false) return false
  return true
}

export function cursoEspecial(curso) {
  if (!curso) return null
  return Object.values(CURSOS_ESPECIALES).find(e => e.patron.test(curso.titulo || '')) || null
}

export function esCursoProblemasContemporaneos(curso) {
  if (!curso) return false
  const t = sinAcentos(curso.titulo)
  return t.includes('problemas') && t.includes('contempor')
}

// Detecta la procedencia de un link (YouTube, Google Drive, OneDrive, otro)
// y devuelve la versión embebible cuando es posible. Los links de OneDrive
// cortos (1drv.ms) o de SharePoint no se pueden convertir de forma confiable
// sin resolver el redirect en el servidor, así que se quedan como "externo".
export function analizarUrl(url) {
  const externo = { origen: 'externo', embeddable: false, embedUrl: null }
  if (!url || typeof url !== 'string') return externo

  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)
  if (yt) {
    return { origen: 'youtube', embeddable: true, embedUrl: `https://www.youtube.com/embed/${yt[1]}` }
  }

  const drive = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/)
  if (drive) {
    const id = drive[1] || drive[2]
    return { origen: 'googledrive', embeddable: true, embedUrl: `https://drive.google.com/file/d/${id}/preview` }
  }

  const oneDriveLive = url.match(/onedrive\.live\.com\/[^\s]*resid=[^&\s]+/i)
  if (oneDriveLive) {
    const embedUrl = url.replace(/onedrive\.live\.com\/(?:redir|view\.aspx)?/i, 'onedrive.live.com/embed')
    return { origen: 'onedrive', embeddable: true, embedUrl }
  }

  if (/1drv\.ms|sharepoint\.com/i.test(url)) {
    return { origen: 'onedrive', embeddable: false, embedUrl: null }
  }

  // Microsoft Forms: pega el link que da la opción "Compartir → Insertar código (Embed)".
  // Ese link ya viene listo para iframe, no hace falta transformarlo.
  if (/forms\.office\.com|forms\.microsoft\.com|forms\.office365\.com/i.test(url)) {
    return { origen: 'msforms', embeddable: true, embedUrl: url }
  }

  // Vimeo: reproductor embebible estándar.
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)
  if (vimeo) {
    return { origen: 'vimeo', embeddable: true, embedUrl: `https://player.vimeo.com/video/${vimeo[1]}` }
  }

  // Jitsi / Teams / Meet: NO se embeben (se abren en pestaña aparte con botón "Unirse").
  // - meet.jit.si gratis corta el iframe a los 5 min ("demo purposes", exige JaaS de pago
  //   para producción) y ya ni siquiera ofrece botón de grabar en la nube.
  // - Teams/Meet bloquean iframe por política. Patrón correcto: liga externa.
  // Se detecta el origen solo para etiquetar, pero embeddable = false.
  if (/^https?:\/\/([a-z0-9-]+\.)*jit\.si\//i.test(url)) {
    return { origen: 'jitsi', embeddable: false, embedUrl: null }
  }

  return externo
}
