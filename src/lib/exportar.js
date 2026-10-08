/* ============================================================
   EXPORTAR LOS DATOS DE UNA ORGANIZACIÓN
   ------------------------------------------------------------
   Si un cliente se va, tiene derecho a llevarse lo suyo. No es
   cortesía: la LFPDPPP reconoce la portabilidad, y además es una
   pregunta que las instituciones hacen EN LA NEGOCIACIÓN, no
   después. Poder contestar "aquí tienes un botón" vale más que
   cualquier promesa.

   POR QUÉ CSV Y NO UN VOLCADO DE LA BASE
   Un volcado SQL solo le sirve a quien tenga otro Postgres. Un CSV
   lo abre su administrativo en Excel, se lo pasa a otra plataforma
   o lo archiva. Quien se lleva sus datos casi nunca es ingeniero.

   POR QUÉ SE ARMA EN EL NAVEGADOR
   Porque lo que se exporta es exactamente lo que RLS deja leer a
   quien pulsa el botón. Si se hiciera en el servidor con permisos
   elevados habría que reimplementar ahí quién puede ver qué, y esa
   segunda implementación acabaría discrepando de las políticas.
   Así, el límite es el mismo que en toda la aplicación.
   ============================================================ */

/* Excel en español espera `;` y, sin la marca de orden de bytes al
   principio, destroza los acentos. Las dos cosas juntas son la
   diferencia entre un archivo que se abre y uno que hay que
   importar a mano. */
const SEP = ';'

function celda(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') v = JSON.stringify(v)
  const s = String(v)
  // Comillas, separador o salto de línea obligan a entrecomillar, y
  // las comillas de dentro se duplican. Es el CSV de siempre.
  return /["\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** Filas de objetos -> texto CSV listo para Excel. */
export function aCSV(filas, columnas) {
  const cols = columnas || (filas.length ? Object.keys(filas[0]) : [])
  const lineas = [cols.join(SEP)]
  for (const f of filas) lineas.push(cols.map(c => celda(f[c])).join(SEP))
  // La marca va con fromCharCode: escrita literal es invisible en el
  // código y se pierde en cuanto alguien toca el archivo.
  return String.fromCharCode(0xFEFF) + lineas.join('\r\n')
}

export function descargar(nombre, contenido, tipo = 'text/csv;charset=utf-8;') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Nombre de archivo sin acentos ni espacios: sobrevive a cualquier sistema. */
export const nombreSeguro = (s) => String(s || 'export')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase()
  .slice(0, 40)

/**
 * Qué se lleva el cliente, y en qué orden se pide.
 *
 * Cada entrada dice de qué tabla sale, cómo acotarla a la
 * organización y qué columnas tiene sentido entregar. Se deja fuera
 * a propósito:
 *
 *   · `auditoria`, que es la bitácora de la plataforma;
 *   · `pagos_suscripcion` y las notas comerciales, que son la
 *     relación comercial y no datos del cliente;
 *   · las contraseñas, que ni existen en claro.
 */
export const CONJUNTOS = [
  { clave: 'cursos', titulo: 'Cursos' },
  { clave: 'modulos', titulo: 'Módulos' },
  { clave: 'recursos', titulo: 'Recursos' },
  { clave: 'generaciones', titulo: 'Generaciones' },
  { clave: 'inscripciones', titulo: 'Inscripciones' },
  { clave: 'alumnos', titulo: 'Personas' },
  { clave: 'progreso', titulo: 'Progreso' },
  { clave: 'examenes', titulo: 'Exámenes' },
  { clave: 'intentos', titulo: 'Intentos de examen' },
  { clave: 'tareas', titulo: 'Tareas' },
  { clave: 'entregas', titulo: 'Entregas y calificaciones' },
  { clave: 'foro_hilos', titulo: 'Temas del foro' },
  { clave: 'foro_respuestas', titulo: 'Aportaciones del foro' },
  { clave: 'constancias', titulo: 'Constancias emitidas' },
]

/* `.in()` con una lista vacía arma un filtro que Postgres rechaza, y
   además no tiene sentido preguntar. Se corta antes. */
const vacio = (xs) => !xs || xs.length === 0

/**
 * Descarga todo lo de una organización.
 *
 * @param supabase cliente ya autenticado
 * @param orgId    organización
 * @param avisar   (texto, hechos, total) para la barra de progreso
 * @returns {Promise<Array<{nombre, csv, filas}>>}
 */
export async function recolectar(supabase, orgId, avisar = () => {}) {
  const salida = []
  const agregar = (nombre, filas) => {
    salida.push({ nombre, csv: aCSV(filas || []), filas: (filas || []).length })
  }
  let hechos = 0
  const paso = (t) => avisar(t, ++hechos, CONJUNTOS.length)

  paso('Cursos')
  const { data: cursos } = await supabase
    .from('cursos').select('*').eq('organizacion_id', orgId).order('orden')
  agregar('cursos', cursos)
  const idsCurso = (cursos || []).map(c => c.id)

  paso('Módulos')
  const { data: modulos } = vacio(idsCurso) ? { data: [] } : await supabase
    .from('modulos').select('*').in('curso_id', idsCurso).order('orden')
  agregar('modulos', modulos)
  const idsModulo = (modulos || []).map(m => m.id)

  paso('Recursos')
  const { data: recursos } = vacio(idsModulo) ? { data: [] } : await supabase
    .from('recursos').select('*').in('modulo_id', idsModulo).order('orden')
  agregar('recursos', recursos)
  const idsRecurso = (recursos || []).map(r => r.id)

  paso('Generaciones')
  const { data: gens } = vacio(idsCurso) ? { data: [] } : await supabase
    .from('generaciones').select('*').in('curso_id', idsCurso)
  agregar('generaciones', gens)

  paso('Inscripciones')
  const { data: accesos } = vacio(idsCurso) ? { data: [] } : await supabase
    .from('acceso').select('*').in('curso_id', idsCurso)
  agregar('inscripciones', accesos)
  const idsAlumno = [...new Set((accesos || []).map(a => a.usuario_id))]

  paso('Personas')
  const { data: perfiles } = vacio(idsAlumno) ? { data: [] } : await supabase
    .from('perfiles').select('id, nombre_completo, profesion, ubicacion')
    .in('id', idsAlumno)
  agregar('personas', perfiles)

  paso('Progreso')
  const { data: progreso } = vacio(idsRecurso) ? { data: [] } : await supabase
    .from('progreso_usuario').select('*').in('recurso_id', idsRecurso)
  agregar('progreso', progreso)

  paso('Exámenes')
  const porCurso = vacio(idsCurso) ? { data: [] } : await supabase
    .from('examenes').select('*').in('curso_id', idsCurso)
  const porModulo = vacio(idsModulo) ? { data: [] } : await supabase
    .from('examenes').select('*').in('modulo_id', idsModulo)
  const examenes = [...(porCurso.data || []), ...(porModulo.data || [])]
  agregar('examenes', examenes)
  const idsExamen = examenes.map(e => e.id)

  paso('Intentos de examen')
  const { data: intentos } = vacio(idsExamen) ? { data: [] } : await supabase
    .from('intentos_examen').select('*').in('examen_id', idsExamen)
  agregar('intentos-examen', intentos)

  paso('Tareas')
  const tCurso = vacio(idsCurso) ? { data: [] } : await supabase
    .from('tareas').select('*').in('curso_id', idsCurso)
  const tModulo = vacio(idsModulo) ? { data: [] } : await supabase
    .from('tareas').select('*').in('modulo_id', idsModulo)
  const tareas = [...(tCurso.data || []), ...(tModulo.data || [])]
  agregar('tareas', tareas)
  const idsTarea = tareas.map(t => t.id)

  paso('Entregas y calificaciones')
  const { data: entregas } = vacio(idsTarea) ? { data: [] } : await supabase
    .from('entregas').select('*').in('tarea_id', idsTarea)
  agregar('entregas', entregas)

  paso('Temas del foro')
  const { data: hilos } = vacio(idsCurso) ? { data: [] } : await supabase
    .from('foro_hilos').select('*').in('curso_id', idsCurso)
  agregar('foro-temas', hilos)
  const idsHilo = (hilos || []).map(h => h.id)

  paso('Aportaciones del foro')
  const { data: respuestas } = vacio(idsHilo) ? { data: [] } : await supabase
    .from('foro_respuestas').select('*').in('hilo_id', idsHilo)
  agregar('foro-aportaciones', respuestas)

  paso('Constancias emitidas')
  const { data: constancias } = vacio(idsCurso) ? { data: [] } : await supabase
    .from('constancias').select('*').in('curso_id', idsCurso)
  agregar('constancias', constancias)

  return salida
}

/**
 * El archivo que explica el paquete.
 *
 * Un montón de CSV sin contexto obliga a quien los recibe a adivinar
 * qué es cada uno y cómo se relacionan. Esto se lo dice.
 */
export function leeme(org, conjuntos, fecha) {
  const L = []
  L.push(`DATOS DE ${(org?.nombre || '').toUpperCase()}`)
  L.push(`Exportado el ${fecha}`)
  L.push('')
  L.push('QUE CONTIENE')
  for (const c of conjuntos) {
    L.push(`  ${c.nombre}.csv  —  ${c.filas} registro(s)`)
  }
  L.push('')
  L.push('COMO SE RELACIONAN')
  L.push('  cursos.id        <- modulos.curso_id, generaciones.curso_id,')
  L.push('                      acceso.curso_id, foro-temas.curso_id')
  L.push('  modulos.id       <- recursos.modulo_id')
  L.push('  recursos.id      <- progreso.recurso_id')
  L.push('  examenes.id      <- intentos-examen.examen_id')
  L.push('  tareas.id        <- entregas.tarea_id')
  L.push('  foro-temas.id    <- foro-aportaciones.hilo_id')
  L.push('  personas.id      <- se repite como usuario_id en inscripciones,')
  L.push('                      progreso, intentos, entregas y constancias')
  L.push('')
  L.push('FORMATO')
  L.push('  Separados por punto y coma y en UTF-8, para que Excel en')
  L.push('  español los abra con doble clic sin romper los acentos.')
  L.push('')
  L.push('QUE NO INCLUYE')
  L.push('  · Contraseñas. Se guardan cifradas con un algoritmo que no se')
  L.push('    puede revertir, asi que no existen en claro en ningun sitio.')
  L.push('  · Los archivos que subieron los alumnos en sus entregas. Aqui')
  L.push('    viene la ruta de cada uno (archivo_path) y la calificacion;')
  L.push('    los archivos en si se piden aparte.')
  L.push('  · La bitacora de la plataforma y la informacion de cobro, que')
  L.push('    son de la plataforma y no de la organizacion.')
  L.push('')
  return L.join('\r\n')
}
