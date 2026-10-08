/* ============================================================
   PLAZOS DE LAS ACTIVIDADES
   ------------------------------------------------------------
   Una sola idea de qué significa «vencido», usada por las tres
   actividades evaluables y por las pantallas de las dos partes.

   AVISO QUE CONVIENE NO OLVIDAR
   Esto decide qué se ENSEÑA. Lo que de verdad cierra la puerta son
   los disparadores de supabase/FECHAS_LIMITE.sql, porque la
   aplicación habla con la base desde el navegador y esconder un
   botón no impide nada. Si alguna vez discrepan, manda la base.

   DOS FECHAS DISTINTAS
   · `fecha_limite` es cuándo se esperaba.
   · `cierra_al_vencer` dice si al pasar se bloquea o solo se marca
     como tardía.
   Hay trabajos donde llegar tarde resta y exámenes donde llegar
   tarde no existe; un solo campo obligaría a tratarlos igual.
   ============================================================ */

const MINUTO = 60000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

/** Umbral para avisar de que queda poco. */
export const AVISO_HORAS = 48

/**
 * Estado de un plazo para una persona concreta.
 *
 * @param actividad {{fecha_limite?, cierra_al_vencer?}}
 * @param prorroga   fecha de su prórroga, si la tiene
 * @returns {{clave, etiqueta, tono, abierto, tarde, fecha, ms}}
 *
 * `clave`: 'sin_plazo' | 'abierto' | 'por_vencer' | 'tarde' | 'cerrado'
 *   · 'tarde'   = venció pero aún se admite (no cierra)
 *   · 'cerrado' = venció y no se admite
 */
export function estadoPlazo(actividad, prorroga = null, ahora = Date.now()) {
  const base = actividad?.fecha_limite || null
  const fecha = masTarde(base, prorroga)

  if (!fecha) {
    return {
      clave: 'sin_plazo', etiqueta: 'Sin fecha límite', tono: 'neutro',
      abierto: true, tarde: false, fecha: null, ms: null,
    }
  }

  const ms = new Date(fecha).getTime() - ahora
  const cierra = actividad?.cierra_al_vencer !== false

  if (ms >= 0) {
    const pocoTiempo = ms <= AVISO_HORAS * HORA
    return {
      clave: pocoTiempo ? 'por_vencer' : 'abierto',
      etiqueta: `Cierra ${enPalabras(ms)}`,
      tono: pocoTiempo ? 'aviso' : 'ok',
      abierto: true, tarde: false, fecha, ms,
    }
  }

  // Ya venció.
  if (!cierra) {
    return {
      clave: 'tarde',
      etiqueta: `Venció ${enPalabras(ms)} · se admite tarde`,
      tono: 'aviso', abierto: true, tarde: true, fecha, ms,
    }
  }
  return {
    clave: 'cerrado',
    etiqueta: `Cerró ${enPalabras(ms)}`,
    tono: 'alerta', abierto: false, tarde: true, fecha, ms,
  }
}

/** La más tardía de dos fechas. Una prórroga nunca acorta un plazo. */
export function masTarde(a, b) {
  if (!a) return b || null
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

/**
 * «en 3 días», «hace 2 horas». Sin librerías: es media docena de
 * casos y una dependencia más pesa más que esto.
 */
export function enPalabras(ms) {
  const futuro = ms >= 0
  const n = Math.abs(ms)
  const di = (cantidad, unidad) =>
    `${futuro ? 'en' : 'hace'} ${cantidad} ${unidad}${cantidad === 1 ? '' : 's'}`

  if (n < MINUTO) return futuro ? 'en menos de un minuto' : 'hace un momento'
  if (n < HORA) return di(Math.round(n / MINUTO), 'minuto')
  if (n < DIA) return di(Math.round(n / HORA), 'hora')
  if (n < 30 * DIA) return di(Math.round(n / DIA), 'día')
  return di(Math.round(n / (30 * DIA)), 'mes')
}

/** La fecha, escrita como se lee en México. */
export function fechaLarga(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Lo que necesita un <input type="datetime-local">, que trabaja en
 * hora LOCAL y sin zona. `toISOString` daría UTC y la fecha
 * aparecería corrida varias horas al abrir el editor.
 */
export function aCampoLocal(valor) {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** El camino de vuelta: del campo local a lo que guarda la base. */
export function deCampoLocal(texto) {
  if (!texto) return null
  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Índice de prórrogas para buscar sin recorrer la lista cada vez.
 * Clave: `${tipo}:${actividad_id}`.
 */
export function indicePorActividad(prorrogas) {
  const m = {}
  for (const p of prorrogas || []) {
    const k = `${p.tipo}:${p.actividad_id}`
    // Si llegaran dos —una suya y una de su generación—, manda la
    // más tardía, igual que en la base.
    m[k] = masTarde(m[k], p.nueva_fecha)
  }
  return m
}

export const prorrogaDe = (indice, tipo, id) => indice?.[`${tipo}:${id}`] || null
