/* ============================================================
   PERMISOS POR ROL
   ------------------------------------------------------------
   Decide qué enseña la pantalla. El permiso de verdad lo deciden
   las políticas de la base: esto solo evita ofrecer botones que
   iban a fallar al pulsarlos.

   EL ÁMBITO
   Una asignación puede valer para toda la organización o solo para
   una sede o una categoría. «Coordinación» y «coordinación de esta
   sede» son roles distintos en la práctica, y modelarlo como dos
   roles obligaría a duplicar la lista de permisos por cada sede.

   La regla, y conviene no invertirla: una asignación SIN ámbito
   vale en todas partes; una CON ámbito, solo ahí. Al revés —que lo
   específico ampliara— un coordinador de una sede acabaría mandando
   en todas.
   ============================================================ */

/** Los grupos del catálogo, en el orden en que se enseñan. */
export const GRUPOS_PERMISO = [
  'Contenido', 'Personas', 'Operación', 'Evaluación', 'Documentos', 'Dirección',
]

/**
 * Índice de lo que puede hacer una persona.
 *
 * @param filas  lo que devuelve `mis_permisos`:
 *               [{ permiso, sede_id, categoria_id }]
 */
export function indicePermisos(filas) {
  const m = {}
  for (const f of filas || []) {
    const lista = (m[f.permiso] ||= [])
    lista.push({ sede: f.sede_id ?? null, categoria: f.categoria_id ?? null })
  }
  return m
}

/**
 * ¿Puede hacer esto, aquí?
 *
 * `donde` admite { sede, categoria }. Sin `donde`, basta con tener
 * el permiso en cualquier ámbito: sirve para decidir si se enseña
 * una sección entera, y dentro ya se afina.
 */
export function puede(indice, permiso, donde = null) {
  const ambitos = indice?.[permiso]
  if (!ambitos || !ambitos.length) return false
  if (!donde) return true
  return ambitos.some(a =>
    (a.sede === null || a.sede === donde.sede) &&
    (a.categoria === null || a.categoria === donde.categoria))
}

/** ¿Tiene alguno de estos? Para enseñar una pestaña que agrupa varias cosas. */
export const puedeAlguno = (indice, permisos, donde = null) =>
  (permisos || []).some(p => puede(indice, p, donde))

/** Agrupa el catálogo para pintarlo por secciones. */
export function porGrupo(permisos) {
  const m = {}
  for (const p of permisos || []) (m[p.grupo] ||= []).push(p)
  for (const g of Object.keys(m)) {
    m[g].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
  }
  // Primero los grupos conocidos, en su orden; después cualquier otro.
  const orden = [...GRUPOS_PERMISO, ...Object.keys(m).filter(g => !GRUPOS_PERMISO.includes(g))]
  return orden.filter(g => m[g]).map(g => [g, m[g]])
}

/**
 * Resumen de un rol para la lista: «9 permisos · Contenido, Personas».
 * Enseñar las nueve claves no cabe y no se lee.
 */
export function resumenRol(claves, catalogo) {
  const porClave = Object.fromEntries((catalogo || []).map(p => [p.clave, p]))
  const grupos = [...new Set((claves || []).map(c => porClave[c]?.grupo).filter(Boolean))]
  return {
    total: (claves || []).length,
    grupos,
    texto: grupos.length ? grupos.join(', ') : 'Sin permisos',
  }
}

/**
 * Un rol sin permisos no sirve para nada y es fácil de crear sin
 * querer: se guarda el nombre y se olvida marcar las casillas.
 */
export const rolVacio = (claves) => !claves || claves.length === 0

/** Nombre del ámbito de una asignación, para la lista. */
export function ambitoDe(asignacion, sedes, categorias) {
  const partes = []
  if (asignacion?.sede_id) {
    partes.push(sedes?.find(s => s.id === asignacion.sede_id)?.nombre || 'una sede')
  }
  if (asignacion?.categoria_id) {
    partes.push(categorias?.find(c => c.id === asignacion.categoria_id)?.nombre || 'una categoría')
  }
  return partes.length ? partes.join(' · ') : 'Toda la organización'
}
