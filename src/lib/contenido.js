/* ============================================================
   CONTENIDO EDITABLE DESDE LA PÁGINA
   ------------------------------------------------------------
   UNA SOLA LÓGICA PARA TODO
   Cualquier texto, imagen, lista o botón del sitio puede tener
   una «capa de edición» en la tabla `contenido_sitio`
   (supabase/CONTENIDO_1_EDITABLE.sql): clave -> valor (jsonb).

   · El código sigue poniendo el valor POR OMISIÓN (lo de hoy).
   · La tabla solo lo SOBREESCRIBE, campo por campo.
   · Restablecer = borrar la fila: vuelve a verse lo de siempre.

   Campos que entiende el valor (todos opcionales):
     texto, url, mensaje (WhatsApp), estilo, fondo, colorTexto,
     src (imagen), items (listas), visible (false = oculto al
     público), eliminado (true = quitado, también para el admin
     fuera del modo edición).

   CLAVES GENERALES Y ESPECÍFICAS
   «curso.inscribirme» vale para todos los cursos;
   «curso.inscribirme@curso:12» solo para el 12. Se mezclan en
   ese orden: lo específico gana, campo por campo.

   POR QUÉ UNA CACHÉ DE MÓDULO
   Igual que permisos.js y organizacion.js: la tabla se lee UNA
   vez por visita y todos los elementos montados se enteran.
   ============================================================ */

import { useEffect, useReducer } from 'react'
import { supabase } from './supabase'
import { WHATSAPP } from '../config'

let cache = { cargado: false, orgId: undefined, filas: [], falta: false }
let enVuelo = null
// Modo edición: lo enciende la barra flotante (BarraEdicion) solo
// si quien mira puede administrar la organización de esta visita.
let modo = { puedeEditar: false, editando: false }
const suscriptores = new Set()

function avisar() {
  for (const fn of suscriptores) fn()
}

const CLAVE_MODO = 'contenido.editando'

/** Explica, con nombre y apellido, por qué no se pudo guardar. */
export function explicarError(error) {
  const m = error?.message || String(error || '')
  if (error?.code === 'PGRST205' || error?.code === '42P01' ||
      /could not find the table|does not exist/i.test(m)) {
    return 'No se puede guardar porque falta la tabla «contenido_sitio» en la base. ' +
      'Necesitas correr supabase/CONTENIDO_1_EDITABLE.sql en Supabase → SQL Editor ' +
      '(una sola vez). Mientras tanto, el sitio se ve igual que siempre.'
  }
  if (error?.code === '42501' || /row-level security|permission denied/i.test(m)) {
    return 'La base rechazó el cambio por permisos: la política de «contenido_sitio» solo deja ' +
      'escribir a quien administra esta organización (es_admin_de) o, en el sitio principal, ' +
      'al administrador de la plataforma (es_admin). Tu cuenta no aparece así en la tabla «admins».'
  }
  return 'No se pudo guardar: ' + m
}

async function cargar(orgId) {
  const { data, error } = await supabase
    .from('contenido_sitio').select('id, clave, valor, organizacion_id')
  if (error) {
    // Sin tabla, el sitio se ve como siempre; solo se avisa al editar.
    cache = { cargado: true, orgId, filas: [], falta: true, error: explicarError(error) }
    return
  }
  // Solo lo del sitio principal (null) y lo de esta organización.
  const filas = (data || []).filter(
    (f) => f.organizacion_id == null || (orgId != null && Number(f.organizacion_id) === Number(orgId)),
  )
  cache = { cargado: true, orgId, filas, falta: false }
}

// La organización llega tarde (primero es null y luego la de casa): si
// cambia mientras una lectura está en vuelo, se vuelve a leer al terminar
// para no quedarse con las filas de la organización equivocada.
let pedida
function asegurar(orgId) {
  pedida = orgId
  if (enVuelo) return
  if (cache.cargado && cache.orgId === orgId) return
  enVuelo = cargar(orgId).finally(() => {
    enVuelo = null
    if (pedida !== cache.orgId) asegurar(pedida)
    else avisar()
  })
}

/** Busca la fila de una clave: primero la de la organización, luego la general. */
function filaDe(clave) {
  const deOrg = cache.filas.find((f) => f.clave === clave && f.organizacion_id != null)
  return deOrg || cache.filas.find((f) => f.clave === clave && f.organizacion_id == null) || null
}

/** Mezcla campo por campo, ignorando undefined (no pisa con «nada»). */
function mezclar(...capas) {
  const r = {}
  for (const c of capas) {
    if (!c) continue
    for (const [k, v] of Object.entries(c)) if (v !== undefined) r[k] = v
  }
  return r
}

export const claveCon = (clave, ambito) => (ambito ? `${clave}@${ambito}` : clave)

/**
 * Valor final de un elemento: lo del código, luego la clave general,
 * luego la específica del ámbito (p. ej. un curso).
 */
export function resolver(clave, defecto, ambito) {
  const general = filaDe(clave)?.valor
  const especifico = ambito ? filaDe(claveCon(clave, ambito))?.valor : null
  return mezclar(defecto, general, especifico)
}

/** ¿Hay capa guardada para esta clave (general o del ámbito)? */
export function tieneCapa(clave, ambito) {
  return !!(filaDe(clave) || (ambito && filaDe(claveCon(clave, ambito))))
}

/** Rellena {titulo} y demás marcadores de un texto. */
export function rellenar(texto, datos = {}) {
  return String(texto ?? '').replace(/\{(\w+)\}/g, (m, k) => (datos[k] ?? m))
}

/** Enlace final de un botón: URL propia o mensaje de WhatsApp. */
export function enlaceDe(v, datos) {
  if (v.url) return rellenar(v.url, datos)
  if (v.mensaje) {
    const numero = String(v.whatsapp || WHATSAPP).replace(/\D/g, '')
    return `https://wa.me/${numero}?text=${encodeURIComponent(rellenar(v.mensaje, datos))}`
  }
  return null
}

/**
 * Guarda (sustituye) la capa de una clave en la organización de esta
 * visita. `valor` es el objeto completo que debe quedar.
 */
export async function guardarCapa(clave, valor, orgId, autor) {
  const destino = orgId ?? null
  let q = supabase.from('contenido_sitio').select('id').eq('clave', clave)
  q = destino == null ? q.is('organizacion_id', null) : q.eq('organizacion_id', destino)
  const { data: ya, error: eBuscar } = await q.maybeSingle()
  if (eBuscar) throw new Error(explicarError(eBuscar))

  const fila = { valor, actualizado_en: new Date().toISOString(), actualizado_por: autor || null }
  const { data, error } = ya
    ? await supabase.from('contenido_sitio').update(fila).eq('id', ya.id).select('*').maybeSingle()
    : await supabase.from('contenido_sitio')
      .insert({ ...fila, clave, organizacion_id: destino }).select('*').maybeSingle()
  if (error) throw new Error(explicarError(error))
  // RLS que filtra en silencio: el update no toca nada y no da error.
  if (!data) throw new Error(explicarError({ code: '42501' }))

  cache = { ...cache, filas: [...cache.filas.filter((f) => f.id !== data.id), data] }
  avisar()
}

/** Borra la capa de una clave (vuelve a lo que diga el código). */
export async function restablecerCapa(clave, orgId) {
  const destino = orgId ?? null
  let q = supabase.from('contenido_sitio').delete().eq('clave', clave)
  q = destino == null ? q.is('organizacion_id', null) : q.eq('organizacion_id', destino)
  const { error } = await q
  if (error) throw new Error(explicarError(error))
  cache = {
    ...cache,
    filas: cache.filas.filter((f) => !(f.clave === clave &&
      (destino == null ? f.organizacion_id == null : Number(f.organizacion_id) === Number(destino)))),
  }
  avisar()
}

/** Lo enciende BarraEdicion tras comprobar permisos. */
export function fijarPuedeEditar(puede) {
  if (modo.puedeEditar === puede) return
  let guardado = false
  try { guardado = puede && localStorage.getItem(CLAVE_MODO) === '1' } catch { /* sin almacenamiento */ }
  modo = { puedeEditar: puede, editando: puede && (modo.editando || guardado) }
  avisar()
}

export function alternarEdicion() {
  if (!modo.puedeEditar) return
  modo = { ...modo, editando: !modo.editando }
  try { localStorage.setItem(CLAVE_MODO, modo.editando ? '1' : '0') } catch { /* sin almacenamiento */ }
  avisar()
}

/**
 * Hook único. `orgId` es la organización de esta visita
 * (useOrganizacion): las ediciones se guardan para ella.
 */
export function useContenido(orgId) {
  const [, redibujar] = useReducer((n) => n + 1, 0)

  useEffect(() => {
    suscriptores.add(redibujar)
    return () => { suscriptores.delete(redibujar) }
  }, [])

  useEffect(() => { asegurar(orgId) }, [orgId])

  return {
    cargado: cache.cargado,
    falta: cache.falta,
    errorCarga: cache.error || null,
    puedeEditar: modo.puedeEditar,
    editando: modo.puedeEditar && modo.editando,
    resolver,
    tieneCapa,
  }
}
