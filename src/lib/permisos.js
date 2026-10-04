/* ============================================================
   PERMISOS POR CURSO
   ------------------------------------------------------------
   Hasta aquí la app solo sabía preguntar "¿eres admin?". Con el
   rol Facilitador la pregunta correcta pasa a ser otra:

       ¿puedes gestionar ESTE curso?

   El admin responde que sí a todos; el facilitador, solo a los
   que se le asignaron desde el panel.

   AVISO IMPORTANTE
   Esto decide qué BOTONES se ven, nada más. El permiso de verdad
   vive en las políticas RLS de Postgres (supabase/ROLES_*.sql),
   porque la app usa la clave pública desde el navegador y
   cualquiera puede llamar a la API saltándose la interfaz. Si
   alguna vez discrepan, manda la base de datos.

   POR QUÉ UNA CACHÉ DE MÓDULO Y NO UN CONTEXT
   Un provider obligaría a reestructurar App.jsx y a envolver el
   árbol entero. Aquí basta con que varias pantallas hagan la misma
   pregunta: se consulta UNA vez por sesión y los componentes
   montados se enteran cuando llega la respuesta.
   ============================================================ */

import { useEffect, useReducer } from 'react'
import { supabase } from './supabase'

const VACIO = { cargado: false, esAdmin: false, cursos: new Set() }

let cache = VACIO
let enVuelo = null
let usuarioCargado = null
const suscriptores = new Set()

function avisar() {
  for (const fn of suscriptores) fn()
}

async function cargar(user) {
  // `facilitadores` ya filtra por RLS: esta consulta solo devuelve
  // las asignaciones de quien pregunta. No hace falta un `where`.
  const [{ data: admin }, { data: asignados }] = await Promise.all([
    supabase.from('admins').select('email').eq('email', user.email).maybeSingle(),
    supabase.from('facilitadores').select('curso_id'),
  ])

  cache = {
    cargado: true,
    esAdmin: !!admin,
    cursos: new Set((asignados || []).map((f) => Number(f.curso_id))),
  }
  usuarioCargado = user.id
  avisar()
}

/** Al cerrar sesión o cambiar de cuenta, los permisos anteriores no valen. */
export function olvidarPermisos() {
  cache = VACIO
  enVuelo = null
  usuarioCargado = null
  avisar()
}

/**
 * Permisos de la persona conectada.
 *
 * `puedeGestionar(cursoId)` admite null/undefined sin romperse: mientras
 * el curso se está cargando devuelve false, que es el lado seguro —
 * antes enseñar de menos que de más.
 */
export function usePermisos(user) {
  const [, redibujar] = useReducer((n) => n + 1, 0)

  useEffect(() => {
    suscriptores.add(redibujar)
    return () => { suscriptores.delete(redibujar) }
  }, [])

  useEffect(() => {
    if (!user?.id) { olvidarPermisos(); return }
    if (usuarioCargado === user.id || enVuelo) return
    enVuelo = cargar(user).finally(() => { enVuelo = null })
    // Se depende del id y el correo, NO del objeto `user`: Supabase
    // entrega uno nuevo en cada refresco de token aunque sea la misma
    // persona, y depender de el relanzaria la consulta sin motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email])

  const esAdmin = cache.esAdmin
  return {
    cargado: cache.cargado,
    esAdmin,
    esFacilitador: cache.cursos.size > 0,
    cursosGestionados: cache.cursos,
    puedeGestionar: (cursoId) =>
      esAdmin || (cursoId != null && cache.cursos.has(Number(cursoId))),
  }
}

/** Atajo para la pregunta de siempre, en una sola línea. */
export function usePuedeGestionar(user, cursoId) {
  return usePermisos(user).puedeGestionar(cursoId)
}
