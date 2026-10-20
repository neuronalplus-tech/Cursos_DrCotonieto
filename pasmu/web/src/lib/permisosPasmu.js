let cache = { loaded: true, rows: [], error: null }
let inflight = null

function indice(rows) {
  const m = {}
  for (const r of rows || []) (m[r.permiso] ||= []).push({ unidad: r.unidad_id ?? null, programa: r.programa_id ?? null })
  return m
}

export function puedeEn(ind, permiso, donde = null) {
  const ambitos = ind?.[permiso]
  if (!ambitos?.length) return false
  if (!donde) return true
  return ambitos.some((a) =>
    (a.unidad === null || a.unidad === donde.unidad) &&
    (a.programa === null || a.programa === donde.programa))
}

export async function cargarPermisosPasmu(client) {
  const { data, error } = await client.rpc('pasmu_mis_permisos_pasmu')
  if (error) throw new Error(error.message)
  cache = { loaded: true, rows: data || [], error: null }
  return indice(cache.rows)
}

export function useMisPermisosPasmu() {
  const ind = indice(cache.rows)
  return { cargado: cache.loaded, indice: ind, puede: (p, d) => puedeEn(ind, p, d) }
}
