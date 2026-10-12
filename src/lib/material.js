/* ============================================================
   MATERIAL PROTEGIDO DEL TALLER
   ------------------------------------------------------------
   Los enlaces sensibles de un taller (grabación, cuadernillos,
   botones extra) NO viven en la tabla `cursos`. Si estuvieran
   ahí, cualquiera con la llave pública los leería por la API
   aunque la pantalla los ocultara. Viven en `curso_material`,
   sin lectura directa, y se piden por estos dos RPC.

   QUIÉN DECIDE EL PERMISO
   No este archivo: lo decide `material_de_taller` en la base.
   Este helper solo transporta. Cuando no hay permiso el RPC
   devuelve null y aquí se convierte en `{}`, que es "sin
   material": la pantalla muestra entonces "grabación en
   proceso" en lugar de un enlace que no debía estar.
   ============================================================ */

import { supabase } from './supabase'

/** Material del taller, o `{}` si no hay permiso o no existe. */
export async function materialDeTaller(cursoId) {
  if (!cursoId) return {}
  const { data, error } = await supabase.rpc('material_de_taller', { p_curso_id: cursoId })
  if (error) return {}
  return data || {}
}

/**
 * Guarda el material del taller. Solo pasa para admin o quien
 * gestiona el curso; si no, el RPC lanza excepción y la promesa
 * rechaza —quien llama la captura y avisa.
 */
export async function guardarMaterialTaller(cursoId, datos) {
  const { error } = await supabase.rpc('guardar_material_taller', {
    p_curso_id: cursoId,
    p_material: datos,
  })
  if (error) throw error
}
