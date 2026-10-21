/* ============================================================
   ESTRUCTURA DEL SITIO · UNA SOLA FUENTE DE VERDAD
   ------------------------------------------------------------
   Antes cada pantalla decidía por su cuenta qué enseñar, dónde y
   con qué palabras: «Próximamente», «Oculto», «Bloqueado» y «aún no
   tiene» convivían para decir casi lo mismo; un PDF salía con el
   color del botón que alguien eligió; el foro aparecía en unos
   cursos aunque estuviera vacío y en otros no.

   Este archivo es el plano. Lo leen las páginas públicas (curso,
   módulo), el Centro de gestión y la matriz de permisos, así que
   cambiar algo aquí lo cambia en todas a la vez:

     1. PERFILES          quién edita (y con qué permisos de base)
     2. ELEMENTOS         qué se puede editar y qué permiso lo abre
     3. CATEGORÍAS        cómo se agrupa el material de un módulo
     4. FORMATOS          un solo aspecto por formato (PDF, video…)
     5. ANATOMÍA          las secciones fijas de cada página
     6. ESTADOS           un solo vocabulario para «no disponible»

   EL PERMISO DE VERDAD LO DECIDE LA BASE
   Igual que permisos.js: esto decide qué se ENSEÑA. Las políticas
   (ROLES_6/7, CONTENIDO_1) son las que aceptan o rechazan. Por eso
   cada elemento nombra el MISMO permiso que su política.
   ============================================================ */

import { ICONO_TIPO, NOMBRE_TIPO } from '../config'

/* ------------------------------------------------------------
   1. PERFILES
   `rol` es el nombre del rol en la tabla `roles` (ROLES_5). La
   administración global no es un rol: es la fila sin organización
   en `admins`, y puede todo.
   ------------------------------------------------------------ */
export const PERFILES = [
  { clave: 'plataforma', nombre: 'Administración global', rol: null, icono: '🌐',
    descripcion: 'Todo, en todas las organizaciones: también los textos del sitio, las organizaciones y los planes.' },
  { clave: 'direccion', nombre: 'Dirección', rol: 'Dirección', icono: '🏛️',
    descripcion: 'Mira, autoriza y se lleva los datos. No imparte ni califica.' },
  { clave: 'coordinacion', nombre: 'Coordinación', rol: 'Coordinación', icono: '🗂️',
    descripcion: 'Arma grupos, inscribe, asigna docentes y genera documentos.' },
  { clave: 'docente', nombre: 'Docente', rol: 'Docente', icono: '🎓',
    descripcion: 'Imparte: contenido, exámenes, foro, asistencia y calificaciones de sus cursos.' },
]

/**
 * Permisos con los que nace cada rol. COPIA de `sembrar_roles_basicos`
 * (supabase/ROLES_5_PERMISOS.sql); la prueba test:estructura compara
 * las dos listas para que no se separen. Solo se usan cuando la
 * organización todavía no tiene sus roles en la base.
 */
export const PERMISOS_BASE = {
  direccion: [
    'cursos.ver', 'alumnos.ver', 'calificaciones.ver', 'indicadores.ver',
    'datos.exportar', 'marca.editar', 'documentos.generar',
    'documentos.plantillas', 'facilitadores.asignar',
  ],
  coordinacion: [
    'cursos.ver', 'alumnos.ver', 'alumnos.inscribir', 'facilitadores.asignar',
    'grupos.gestionar', 'asistencia.justificar', 'sedes.gestionar',
    'calificaciones.ver', 'documentos.generar', 'indicadores.ver',
  ],
  docente: [
    'cursos.ver', 'cursos.editar', 'examenes.editar', 'foro.moderar',
    'alumnos.ver', 'asistencia.pasar', 'calificaciones.ver',
    'calificaciones.capturar', 'documentos.generar',
  ],
}

/* ------------------------------------------------------------
   2. ELEMENTOS EDITABLES
   `permiso` es la clave del catálogo `permisos`, o:
     'admin'      solo quien administra la organización (p. ej. los
                  textos de la página: política de contenido_sitio)
     'plataforma' solo la administración global
   `seccion` es la tarjeta del Centro de gestión donde se edita.
   ------------------------------------------------------------ */
export const GRUPOS_ELEMENTOS = [
  ['Curso', [
    { clave: 'curso.info', nombre: 'Título, descripción e información', permiso: 'cursos.editar', seccion: 'info' },
    { clave: 'curso.estado', nombre: 'Publicar, «Próximamente» y archivar', permiso: 'cursos.editar', seccion: 'info' },
    { clave: 'curso.botones', nombre: 'Botones de las rutas', permiso: 'cursos.editar', seccion: 'botones' },
    { clave: 'curso.constancia', nombre: 'Constancia: texto, horas y publicación', permiso: 'cursos.editar', seccion: 'constancia' },
  ]],
  ['Módulos y materiales', [
    { clave: 'modulos', nombre: 'Crear, ordenar, abrir y cerrar módulos', permiso: 'cursos.editar', seccion: 'modulos' },
    { clave: 'materiales', nombre: 'Materiales: lecturas, grabaciones, actividades…', permiso: 'cursos.editar', seccion: 'modulos' },
    { clave: 'modulo.botones', nombre: 'Botones de cada módulo', permiso: 'cursos.editar', seccion: 'botones' },
  ]],
  ['Evaluación', [
    { clave: 'examenes', nombre: 'Exámenes y banco de preguntas', permiso: 'examenes.editar', seccion: 'examenes' },
    { clave: 'tareas', nombre: 'Crear y editar tareas', permiso: 'cursos.editar', seccion: 'tareas' },
    { clave: 'calificar', nombre: 'Calificar entregas y conceder prórrogas', permiso: 'calificaciones.capturar', seccion: 'tareas' },
    { clave: 'calificaciones', nombre: 'Ver calificaciones y avance del grupo', permiso: 'calificaciones.ver', seccion: 'avance' },
  ]],
  ['Comunidad', [
    { clave: 'foro', nombre: 'Abrir, cerrar y calificar temas del foro', permiso: 'foro.moderar', seccion: 'foro' },
  ]],
  ['Grupos y personas', [
    { clave: 'generaciones', nombre: 'Generaciones, cupos y sedes', permiso: 'grupos.gestionar', seccion: 'generaciones' },
    { clave: 'participantes', nombre: 'Ver participantes', permiso: 'alumnos.ver', seccion: 'participantes' },
    { clave: 'inscribir', nombre: 'Inscribir y dar de baja', permiso: 'alumnos.inscribir', seccion: null },
    { clave: 'asistencia', nombre: 'Pasar lista', permiso: 'asistencia.pasar', seccion: 'generaciones' },
    { clave: 'docentes', nombre: 'Asignar docentes', permiso: 'facilitadores.asignar', seccion: null },
  ]],
  ['Sitio e institución', [
    { clave: 'sitio.textos', nombre: 'Textos, botones y avisos de las páginas', permiso: 'admin', seccion: null },
    { clave: 'marca', nombre: 'Nombre, logo y colores', permiso: 'marca.editar', seccion: null },
    { clave: 'plantillas', nombre: 'Plantillas de documentos', permiso: 'documentos.plantillas', seccion: null },
    { clave: 'documentos', nombre: 'Generar constancias y documentos', permiso: 'documentos.generar', seccion: null },
    { clave: 'indicadores', nombre: 'Tablero e indicadores', permiso: 'indicadores.ver', seccion: null },
    { clave: 'organizaciones', nombre: 'Organizaciones y planes', permiso: 'plataforma', seccion: null },
  ]],
]

export const ELEMENTOS = GRUPOS_ELEMENTOS.flatMap(([grupo, els]) => els.map((e) => ({ ...e, grupo })))

/**
 * Qué permisos tiene un perfil. `rolesBD` = [{ nombre, permisos: [] }]
 * de la organización; si el rol existe allí, manda la base (el cliente
 * pudo cambiarlo). Si no, los de nacimiento.
 */
export function permisosDePerfil(clavePerfil, rolesBD = []) {
  const perfil = PERFILES.find((p) => p.clave === clavePerfil)
  if (!perfil?.rol) return null // administración global: todo
  const enBase = rolesBD.find((r) => normalizar(r.nombre) === normalizar(perfil.rol))
  return new Set(enBase ? enBase.permisos : PERMISOS_BASE[clavePerfil] || [])
}

/**
 * ¿Puede este perfil editar este elemento?
 * `permisos` null = todo (administración global).
 * `esAdminOrg`: quien administra la organización, que pasa los 'admin'.
 */
export function permite(elemento, { permisos, esAdminOrg = false, esPlataforma = false }) {
  if (esPlataforma || permisos === null) return true
  if (elemento.permiso === 'plataforma') return false
  if (elemento.permiso === 'admin') return esAdminOrg
  if (esAdminOrg) return true
  return !!permisos?.has(elemento.permiso)
}

/** Otros elementos que abre el mismo permiso: tocar uno toca todos. */
export function mismoPermiso(permiso) {
  return ELEMENTOS.filter((e) => e.permiso === permiso)
}

/* ------------------------------------------------------------
   3. CATEGORÍAS DEL MATERIAL
   El formato (PDF, video) dice CÓMO se abre; la categoría, PARA QUÉ
   sirve. El alumno busca «la lectura» o «la grabación», no «el PDF».
   El orden de esta lista es el orden de la página.

   Un recurso sin categoría (todos los de antes, o si falta correr
   ESTRUCTURA_1_CATEGORIAS.sql) toma la de su formato: nada cambia
   de sitio hasta que alguien elija otra.
   ------------------------------------------------------------ */
//
// SECCIONES QUE ANTES ERAN CASOS ESPECIALES
// Sesiones en vivo, juegos y entregables vivían como bloques escritos
// para UN curso (por su título). Ahora son categorías como las demás:
// cualquier módulo puede tenerlas y, si no las usa, no aparecen.
// `accion` es el texto del botón de un enlace en esa sección (cada
// recurso puede cambiarlo); `nota`, la ayuda bajo el botón.
export const CATEGORIAS_MATERIAL = [
  { clave: 'sesion', nombre: 'Sesiones en vivo', icono: '📡', accion: 'Entrar a la sesión ↗',
    nota: 'Se abre la videollamada en una pestaña nueva.', soloEnlace: true },
  { clave: 'lectura', nombre: 'Materiales de lectura', icono: '📖', accion: 'Abrir la lectura ↗' },
  { clave: 'grabacion', nombre: 'Grabaciones y videos', icono: '🎬', accion: 'Ver la grabación ↗' },
  { clave: 'actividad', nombre: 'Actividades', icono: '✍️', accion: 'Ir a la actividad ↗' },
  { clave: 'juego', nombre: 'Juegos e interactivos', icono: '🎮', accion: 'Abrir el juego ↗',
    nota: 'Se abre en una pestaña nueva.', soloEnlace: true },
  { clave: 'descargable', nombre: 'Plantillas y descargables', icono: '📥', accion: 'Abrir la plantilla ↗' },
  { clave: 'entregable', nombre: 'Entregables', icono: '📤', accion: 'Subir mi entrega ↗',
    nota: 'Se abre la carpeta compartida en una pestaña nueva. Sube tu archivo con el nombre indicado.', soloEnlace: true },
  { clave: 'enlace', nombre: 'Enlaces de interés', icono: '🔗', accion: 'Abrir enlace →' },
]

export const categoriaPorClave = (clave) => CATEGORIAS_MATERIAL.find((c) => c.clave === clave)

const CATEGORIA_POR_FORMATO = {
  pdf: 'lectura', video: 'grabacion', autoevaluacion: 'actividad', word: 'descargable', enlace: 'enlace',
}

export function categoriaDe(recurso) {
  const propia = recurso?.categoria_material
  if (propia && CATEGORIAS_MATERIAL.some((c) => c.clave === propia)) return propia
  return CATEGORIA_POR_FORMATO[recurso?.tipo] || 'enlace'
}

/**
 * Agrupa respetando el orden de las categorías y, dentro, el de la
 * lista recibida. Las categorías vacías NO salen: «si no hay, no se
 * despliega».
 */
export function agruparPorCategoria(recursos) {
  return CATEGORIAS_MATERIAL
    .map((categoria) => ({ categoria, recursos: (recursos || []).filter((r) => categoriaDe(r) === categoria.clave) }))
    .filter((g) => g.recursos.length > 0)
}

/* ------------------------------------------------------------
   4. FORMATOS: un solo aspecto por formato
   El color sale de la clase `formato-*` (App.css, variables
   --formato-*), nunca de lo que elija cada quien: un PDF se ve
   igual en todos los cursos.
   ------------------------------------------------------------ */
export const FORMATOS = Object.fromEntries(
  Object.keys(CATEGORIA_POR_FORMATO).map((t) => [t, { icono: ICONO_TIPO[t], nombre: NOMBRE_TIPO[t], clase: `formato-${t}` }]),
)
export const claseFormato = (tipo) => FORMATOS[tipo]?.clase || 'formato-otro'

/* ------------------------------------------------------------
   5. ANATOMÍA DE LAS PÁGINAS
   Cada página tiene secciones fijas, siempre en este orden. Una
   sección sin contenido no se pinta para el alumno (su espacio lo
   toma la siguiente); quien gestiona la ve en el Centro de gestión
   como «vacía», con el sitio exacto donde caerá lo que añada.
   ------------------------------------------------------------ */
export const ANATOMIA = {
  curso: [
    { clave: 'encabezado', nombre: 'Encabezado', contiene: 'Título, fecha de inicio y descripción', seccion: 'info' },
    { clave: 'avance', nombre: 'Tu avance', contiene: 'Barra de progreso (solo con sesión)', seccion: null },
    { clave: 'contenido', nombre: 'Contenido del curso', contiene: 'Rutas y módulos, en su orden', seccion: 'modulos' },
    { clave: 'botones', nombre: 'Botones de ruta', contiene: 'Enlaces extra de cada ruta', seccion: 'botones' },
    { clave: 'tareas', nombre: 'Tareas', contiene: 'Entregas del curso', seccion: 'tareas' },
    { clave: 'foro', nombre: 'Foro', contiene: 'Solo si hay al menos un tema publicado', seccion: 'foro' },
    { clave: 'detalles', nombre: 'Página de detalles', contiene: 'Temario ampliado; solo si tiene contenido', seccion: null },
  ],
  modulo: [
    { clave: 'encabezado', nombre: 'Encabezado', contiene: 'Título, descripción y avance', seccion: 'modulos' },
    { clave: 'botones', nombre: 'Botones del módulo', contiene: 'Enlaces extra activos', seccion: 'botones' },
    ...CATEGORIAS_MATERIAL.map((c) => ({ clave: `material.${c.clave}`, nombre: c.nombre, contiene: `${c.icono} Recursos de esta categoría`, seccion: 'modulos' })),
    { clave: 'examen', nombre: 'Evaluación', contiene: 'El examen del módulo', seccion: 'examenes' },
    { clave: 'tareas', nombre: 'Tareas', contiene: 'Entregas del módulo', seccion: 'tareas' },
  ],
}

/* ------------------------------------------------------------
   6. ESTADOS: un solo vocabulario
   `tono` elige el color de la insignia (badge ok / proximo / neutro).
   ------------------------------------------------------------ */
export const ESTADOS = {
  publicado: { etiqueta: 'Publicado', tono: 'ok' },
  proximamente: { etiqueta: 'Próximamente', tono: 'proximo' },
  programado: { etiqueta: 'Programado', tono: 'proximo' },
  oculto: { etiqueta: 'Oculto para alumnos', tono: 'neutro' },
  cerrado: { etiqueta: 'Cerrado', tono: 'neutro' },
  archivado: { etiqueta: 'Archivado', tono: 'neutro' },
}

export function estadoCurso(c) {
  if (c?.activo === false) return 'archivado'
  if (c?.proximamente) return 'proximamente'
  return 'publicado'
}

export function estadoModulo(m, ahora = Date.now()) {
  if (m?.disponible === false) return 'oculto'
  if (m?.abre_el && new Date(m.abre_el).getTime() > ahora) return 'programado'
  if (m?.cierra_el && new Date(m.cierra_el).getTime() < ahora) return 'cerrado'
  return 'publicado'
}

export const estadoRecurso = (r) => (r?.disponible === false ? 'oculto' : 'publicado')

function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}
