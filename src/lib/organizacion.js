/* ============================================================
   EN QUÉ ORGANIZACIÓN ESTAMOS
   ------------------------------------------------------------
   La misma aplicación sirve a varias instituciones. Cuál de ellas
   se decide por la dirección con la que se entró:

     1. Dominio propio      aula.fmp.org.mx   → por `dominio`
     2. Subdominio nuestro  fmp.<base>        → por `slug`
     3. El dominio base     <base>            → la de casa

   `VITE_DOMINIO_BASE` dice cuál es el dominio base. Sin esa
   variable solo funciona el caso 1 y el 3, que es exactamente lo
   que pasa hoy: una sola organización y nada que repartir.

   AVISO
   Esto decide qué se ENSEÑA, no qué se puede ver. Quien consulte
   la API directamente seguirá leyendo el catálogo público de
   cualquiera: son títulos de venta, lo mismo que hay en la
   portada. Lo que protege de verdad el contenido privado —
   módulos, entregas, calificaciones — son las políticas RLS, que
   no dependen de esto.
   ============================================================ */

import { useEffect, useReducer } from 'react'
import { supabase } from './supabase'

const BASE = (import.meta.env.VITE_DOMINIO_BASE || '').toLowerCase().trim()

let cache = { cargado: false, org: null }
let enVuelo = null
const suscriptores = new Set()

function avisar() {
  for (const fn of suscriptores) fn()
}

/** El subdominio, si lo hay y no es uno de los de cortesía. */
export function slugDelHost(host = '') {
  const h = String(host).toLowerCase().replace(/:\d+$/, '')
  if (!BASE || h === BASE) return null
  if (!h.endsWith('.' + BASE)) return null
  const etiqueta = h.slice(0, -(BASE.length + 1))
  // Un subdominio con puntos (a.b.base) no es un inquilino nuestro,
  // y `www` es el sitio de casa con otro nombre.
  if (!etiqueta || etiqueta.includes('.') || etiqueta === 'www') return null
  return etiqueta
}

async function resolver() {
  const host = window.location.hostname.toLowerCase()

  // 1) ¿Alguien tiene este dominio como suyo?
  const { data: porDominio } = await supabase
    .from('organizaciones').select('*').ilike('dominio', host).maybeSingle()
  if (porDominio) return porDominio

  // 2) ¿Es un subdominio nuestro?
  const slug = slugDelHost(host)
  if (slug) {
    const { data: porSlug } = await supabase
      .from('organizaciones').select('*').ilike('slug', slug).maybeSingle()
    if (porSlug) return porSlug
  }

  // 3) El dominio base: la organización de casa. Se toma la más
  //    antigua y no una marcada "principal" para no inventar otra
  //    columna que signifique lo mismo que "la primera".
  const { data: casa } = await supabase
    .from('organizaciones').select('*')
    .order('id').limit(1).maybeSingle()
  return casa || null
}

/**
 * Organización de esta visita.
 *
 * Mientras resuelve devuelve `null`, y las pantallas que filtran por
 * ella deben esperar a `cargado` antes de decidir que no hay nada:
 * si no, la portada parpadea vacía en cada carga.
 */
export function useOrganizacion() {
  const [, redibujar] = useReducer((n) => n + 1, 0)

  useEffect(() => {
    suscriptores.add(redibujar)
    return () => { suscriptores.delete(redibujar) }
  }, [])

  useEffect(() => {
    if (cache.cargado || enVuelo) return
    enVuelo = resolver()
      .then((org) => { cache = { cargado: true, org } })
      .catch(() => { cache = { cargado: true, org: null } })
      .finally(() => { enVuelo = null; avisar() })
  }, [])

  return { cargado: cache.cargado, organizacion: cache.org }
}

/**
 * Aplica la marca del cliente sobre las variables CSS.
 *
 * Se tocan las variables y no las clases porque todo el estilo ya
 * cuelga de ellas: cambiar dos valores revisa la plataforma entera
 * sin tener que duplicar una hoja por inquilino.
 */
export function aplicarMarca(org) {
  if (!org) return
  const raiz = document.documentElement
  if (org.color_primario) raiz.style.setProperty('--primary', org.color_primario)
  if (org.color_acento) raiz.style.setProperty('--accent', org.color_acento)
  if (org.nombre) document.title = org.nombre
}
