/* ============================================================
   CENTRO DE GESTIÓN · datos y reglas
   ------------------------------------------------------------
   Lo que el Centro (CentroGestion.jsx, GestionCurso.jsx) necesita
   saber y que no depende de la pantalla: qué roles hay y con qué
   permisos, qué secciones abre cada perfil, cuánto contenido tiene
   cada curso y cómo queda su página pública.

   Las funciones puras van primero (las prueba test:estructura);
   las que hablan con Supabase, después.
   ============================================================ */

import { supabase } from './supabase'
import { ELEMENTOS, permite, permisosDePerfil, ANATOMIA, CATEGORIAS_MATERIAL, categoriaDe } from './estructura'

/** Las tarjetas del Centro, en el orden en que se enseñan. */
export const SECCIONES_CURSO = [
  { clave: 'info', nombre: 'Información del curso', icono: '📝', ayuda: 'Título, descripción y estado de publicación.' },
  { clave: 'modulos', nombre: 'Módulos y materiales', icono: '📚', ayuda: 'Estructura del curso y los materiales de cada módulo, por sección.' },
  { clave: 'botones', nombre: 'Botones', icono: '🔗', ayuda: 'Enlaces extra de cada ruta y de cada módulo.' },
  { clave: 'constancia', nombre: 'Constancia', icono: '🎓', ayuda: 'Qué dice, si lleva horas y cuándo la ven los participantes.' },
  { clave: 'examenes', nombre: 'Exámenes', icono: '🧪', ayuda: 'El examen del curso y los de cada módulo.' },
  { clave: 'tareas', nombre: 'Tareas', icono: '📥', ayuda: 'Entregas que el alumno sube y se califican aquí.' },
  { clave: 'foro', nombre: 'Foro', icono: '💬', ayuda: 'Temas de conversación. Sin temas, el alumno no ve el foro.' },
  { clave: 'generaciones', nombre: 'Generaciones y asistencia', icono: '🗓️', ayuda: 'Cada edición del curso, su cupo y su lista.' },
  { clave: 'participantes', nombre: 'Participantes', icono: '👥', ayuda: 'Quién está inscrito y cuándo entró por última vez.' },
  { clave: 'avance', nombre: 'Avance y calificaciones', icono: '📊', ayuda: 'Quién va atrasado y cómo salió en los exámenes.' },
]

/**
 * Contexto de permisos: quién mira y con qué.
 *  · real: la persona conectada.
 *  · simulado: «Ver como» un perfil (solo para quien administra).
 */
export function contextoReal({ esPlataforma, esAdminOrg, permisosRol = [], esFacilitador = false }) {
  if (esPlataforma) return { permisos: null, esAdminOrg: true, esPlataforma: true }
  const permisos = new Set(permisosRol)
  // Quien facilita un curso hace en él lo que un Docente (así lo trata
  // hoy la app con `puedeGestionar`): se refleja igual aquí.
  if (esFacilitador) permisosDePerfil('docente').forEach((p) => permisos.add(p))
  return { permisos, esAdminOrg: !!esAdminOrg, esPlataforma: false }
}

export function contextoSimulado(clavePerfil, rolesBD) {
  if (clavePerfil === 'plataforma') return { permisos: null, esAdminOrg: true, esPlataforma: true }
  return { permisos: permisosDePerfil(clavePerfil, rolesBD), esAdminOrg: false, esPlataforma: false }
}

/** Secciones del Centro que este contexto puede abrir. */
export function seccionesPermitidas(ctx) {
  const abiertas = new Set()
  for (const e of ELEMENTOS) if (e.seccion && permite(e, ctx)) abiertas.add(e.seccion)
  return abiertas
}

/** Qué elementos concretos abre una sección para este contexto. */
export const elementosDeSeccion = (seccion, ctx) =>
  ELEMENTOS.filter((e) => e.seccion === seccion).map((e) => ({ ...e, permitido: permite(e, ctx) }))

/**
 * Cómo queda la página pública del curso: cada sección fija con
 * `lleno` true/false. Una vacía NO se muestra al alumno.
 * `datos`: { curso, modulos, recursos, temasForo, tareas }
 */
export function llenadoPagina({ curso, modulos = [], recursos = [], temasForo = 0, tareas = 0, tieneDetalles = false }) {
  const botonesRuta = Object.values(curso?.rutas_botones || {}).some((l) => (l || []).some((b) => b.activo !== false))
  const lleno = {
    encabezado: !!(curso?.titulo),
    avance: modulos.length > 0,
    contenido: modulos.length > 0,
    botones: botonesRuta,
    tareas: tareas > 0,
    foro: temasForo > 0,
    detalles: !!tieneDetalles,
  }
  const curso_ = ANATOMIA.curso.map((s) => ({ ...s, lleno: !!lleno[s.clave] }))
  // Para el módulo: qué categorías tienen al menos un recurso en algún módulo.
  const categorias = new Set(recursos.filter((r) => r.disponible !== false).map(categoriaDe))
  const modulo = ANATOMIA.modulo.map((s) => {
    const cat = s.clave.startsWith('material.') ? s.clave.slice(9) : null
    return { ...s, lleno: cat ? categorias.has(cat) : null }
  })
  return { curso: curso_, modulo }
}

/** Cuenta por curso: { [cursoId]: { modulos, materiales, examenes, tareas, temas } } */
export function contarPorCurso(cursos, { modulos = [], recursos = [], examenes = [], tareas = [], hilos = [] }) {
  const r = {}
  for (const c of cursos) r[c.id] = { modulos: 0, materiales: 0, examenes: 0, tareas: 0, temas: 0 }
  const cursoDeModulo = {}
  for (const m of modulos) { cursoDeModulo[m.id] = m.curso_id; if (r[m.curso_id]) r[m.curso_id].modulos++ }
  for (const x of recursos) { const c = cursoDeModulo[x.modulo_id]; if (r[c]) r[c].materiales++ }
  for (const e of examenes) { const c = e.curso_id ?? cursoDeModulo[e.modulo_id]; if (r[c]) r[c].examenes++ }
  for (const t of tareas) { const c = t.curso_id ?? cursoDeModulo[t.modulo_id]; if (r[c]) r[c].tareas++ }
  for (const h of hilos) if (r[h.curso_id]) r[h.curso_id].temas++
  return r
}

/** Resumen de materiales por categoría, para el encabezado de un módulo. */
export function resumenMateriales(recursos) {
  return CATEGORIAS_MATERIAL
    .map((c) => ({ ...c, n: recursos.filter((r) => categoriaDe(r) === c.clave).length }))
    .filter((c) => c.n > 0)
}

/* ------------------------------------------------------------
   SUPABASE
   ------------------------------------------------------------ */

/**
 * Roles de la organización con sus permisos.
 * estado: 'ok' | 'sin-org' (sitio principal: los roles son por
 * organización) | 'sin-tabla' (falta ROLES_5) | 'error'
 */
export async function cargarRolesBD(orgId) {
  if (!orgId) return { estado: 'sin-org', roles: [] }
  const { data: roles, error } = await supabase.from('roles')
    .select('id, nombre, activo').eq('organizacion_id', orgId).order('nombre')
  if (error) {
    const falta = error.code === 'PGRST205' || error.code === '42P01' || /does not exist|could not find/i.test(error.message || '')
    // Las políticas de ROLES_5 se consultaban entre sí (roles ↔
    // asignaciones) y Postgres cortaba la consulta. ROLES_8 lo arregla.
    const bucle = error.code === '42P17' || /infinite recursion/i.test(error.message || '')
    return {
      estado: falta ? 'sin-tabla' : 'error',
      roles: [],
      mensaje: bucle
        ? 'las políticas de la tabla de roles se consultan entre sí. Corre supabase/ROLES_8_SIN_RECURSION.sql en Supabase → SQL Editor (una vez) y recarga esta página.'
        : error.message,
    }
  }
  const ids = (roles || []).map((r) => r.id)
  const { data: rp } = ids.length
    ? await supabase.from('rol_permisos').select('rol_id, permiso').in('rol_id', ids)
    : { data: [] }
  return {
    estado: 'ok',
    roles: (roles || []).map((r) => ({ ...r, permisos: (rp || []).filter((x) => x.rol_id === r.id).map((x) => x.permiso) })),
  }
}

export async function sembrarRolesBasicos(orgId) {
  const { data, error } = await supabase.rpc('sembrar_roles_basicos', { p_org: orgId })
  if (error) throw new Error(error.message)
  return data
}

/** Da o quita un permiso a un rol. */
export async function alternarPermisoRol(rolId, permiso, dar) {
  const { error } = dar
    ? await supabase.from('rol_permisos').insert({ rol_id: rolId, permiso })
    : await supabase.from('rol_permisos').delete().eq('rol_id', rolId).eq('permiso', permiso)
  if (error) throw new Error(error.message)
}

/** Lo necesario para las tarjetas de la lista de cursos. */
export async function cargarResumenCursos(cursos) {
  const ids = cursos.map((c) => c.id)
  if (!ids.length) return {}
  const { data: modulos } = await supabase.from('modulos').select('id, curso_id').in('curso_id', ids)
  const idsMod = (modulos || []).map((m) => m.id)
  // Exámenes y tareas cuelgan del curso O de un módulo suyo.
  const deEstos = [`curso_id.in.(${ids.join(',')})`, ...(idsMod.length ? [`modulo_id.in.(${idsMod.join(',')})`] : [])].join(',')
  const [recursos, examenes, tareas, hilos] = await Promise.all([
    idsMod.length ? supabase.from('recursos').select('id, modulo_id').in('modulo_id', idsMod) : { data: [] },
    supabase.from('examenes').select('id, curso_id, modulo_id').or(deEstos),
    supabase.from('tareas').select('id, curso_id, modulo_id').or(deEstos),
    supabase.from('foro_hilos').select('id, curso_id').in('curso_id', ids),
  ])
  return contarPorCurso(cursos, {
    modulos: modulos || [], recursos: recursos.data || [], examenes: examenes.data || [],
    tareas: tareas.data || [], hilos: hilos.data || [],
  })
}
