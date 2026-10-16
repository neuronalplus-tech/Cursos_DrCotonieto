/* ============================================================
   INDICADORES CLAVE (KPI) POR PERFIL
   ------------------------------------------------------------
   Las cifras salen de la base (INDICADORES_1_KPI.sql): kpi_cursos
   devuelve CONTEOS por curso y aquí se convierten en indicadores.
   Se suman conteos y no promedios: el promedio de los promedios de
   tres cursos de 5, 40 y 200 alumnos no es el promedio de nadie.

   CADA INDICADOR DICE
     · cómo se calcula (para que nadie tenga que adivinarlo),
     · qué es «bueno» (sentido y semáforo; la meta es editable),
     · a qué perfil le importa más (sale destacado arriba).

   META EDITABLE
   La meta de cada indicador vive en contenido_sitio con la clave
   «kpi.meta.<clave>» (la misma capa del lápiz ✏️): la cambia quien
   administra la organización y vale para todos sus tableros.
   ============================================================ */

/** Suma las filas de kpi_cursos (las de los cursos a mi cargo). */
export function sumar(filas) {
  const t = {
    cursos: 0, alumnos: 0, nuevos: 0, activos_7: 0, activos_periodo: 0, terminados: 0, en_riesgo: 0,
    por_calificar: 0, calificadas: 0, horas_ponderadas: 0, calificadas_7d: 0, intentos: 0, aprobados: 0,
    asistencias: 0, presentes: 0, temas_foro: 0, respuestas_periodo: 0, constancias: 0, interesados: 0,
    avance_ponderado: 0, alumnos_con_avance: 0,
  }
  for (const f of filas || []) {
    t.cursos++
    for (const k of ['alumnos', 'nuevos', 'activos_7', 'activos_periodo', 'terminados', 'en_riesgo', 'por_calificar',
      'calificadas', 'calificadas_7d', 'intentos', 'aprobados', 'asistencias', 'presentes', 'temas_foro',
      'respuestas_periodo', 'constancias', 'interesados']) t[k] += Number(f[k]) || 0
    if (f.horas_calificar != null) t.horas_ponderadas += Number(f.horas_calificar) * (Number(f.calificadas) || 0)
    if (f.avance_medio != null) {
      t.avance_ponderado += Number(f.avance_medio) * (Number(f.alumnos) || 0)
      t.alumnos_con_avance += Number(f.alumnos) || 0
    }
  }
  return t
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

/*
  sentido: 'sube' = más es mejor · 'baja' = menos es mejor.
  meta: valor por omisión (editable). Semáforo: verde si cumple la
  meta; ámbar si está a menos de `tolerancia` (proporción) de ella.
  perfiles: dónde sale destacado arriba.
*/
export const KPIS = [
  // APRENDIZAJE
  { clave: 'avance', grupo: 'Aprendizaje', nombre: 'Avance medio', unidad: '%', sentido: 'sube', meta: 60,
    perfiles: ['direccion', 'coordinacion', 'docente'],
    como: 'Materiales vistos sobre los publicados, promedio por alumno (ponderado por curso).',
    calcular: (t) => (t.alumnos_con_avance ? Math.round((t.avance_ponderado / t.alumnos_con_avance) * 10) / 10 : null) },
  { clave: 'finalizacion', grupo: 'Aprendizaje', nombre: 'Tasa de finalización', unidad: '%', sentido: 'sube', meta: 50,
    perfiles: ['direccion'],
    como: 'Alumnos que vieron todos los materiales de su curso, sobre los inscritos.',
    calcular: (t) => pct(t.terminados, t.alumnos) },
  { clave: 'aprobacion', grupo: 'Aprendizaje', nombre: 'Aprobación de exámenes', unidad: '%', sentido: 'sube', meta: 80,
    perfiles: ['coordinacion'],
    como: 'Intentos aprobados sobre intentos presentados en el periodo.',
    calcular: (t) => pct(t.aprobados, t.intentos) },
  { clave: 'asistencia', grupo: 'Aprendizaje', nombre: 'Asistencia', unidad: '%', sentido: 'sube', meta: 85,
    perfiles: ['coordinacion', 'docente'],
    como: 'Presente o retardo sobre los registros de asistencia del periodo.',
    calcular: (t) => pct(t.presentes, t.asistencias) },

  // ACTIVIDAD Y RETENCIÓN
  { clave: 'activos', grupo: 'Actividad', nombre: 'Alumnos activos (periodo)', unidad: '%', sentido: 'sube', meta: 60,
    perfiles: ['direccion', 'coordinacion'],
    como: 'Inscritos que abrieron algún material en el periodo, sobre los inscritos.',
    calcular: (t) => pct(t.activos_periodo, t.alumnos) },
  { clave: 'activos7', grupo: 'Actividad', nombre: 'Activos en los últimos 7 días', unidad: 'alumnos', sentido: 'sube', meta: null,
    perfiles: [],
    como: 'Inscritos con actividad en la última semana.',
    calcular: (t) => t.activos_7 },
  { clave: 'riesgo', grupo: 'Actividad', nombre: 'Alumnos en riesgo', unidad: 'alumnos', sentido: 'baja', meta: 0,
    perfiles: ['coordinacion', 'docente'],
    como: 'Inscritos hace más de 7 días, sin terminar y sin actividad en 14 días.',
    calcular: (t) => t.en_riesgo },

  // DOCENCIA (servicio al alumno)
  { clave: 'por_calificar', grupo: 'Docencia', nombre: 'Entregas por calificar', unidad: 'entregas', sentido: 'baja', meta: 0,
    perfiles: ['docente', 'coordinacion'],
    como: 'Entregas recibidas que todavía no tienen calificación (a hoy).',
    calcular: (t) => t.por_calificar },
  { clave: 'horas_calificar', grupo: 'Docencia', nombre: 'Tiempo medio para calificar', unidad: 'h', sentido: 'baja', meta: 72,
    perfiles: ['docente', 'coordinacion', 'direccion'],
    como: 'Horas entre que el alumno entrega y recibe calificación, en lo calificado en el periodo.',
    calcular: (t) => (t.calificadas ? Math.round((t.horas_ponderadas / t.calificadas) * 10) / 10 : null) },
  { clave: 'a_tiempo', grupo: 'Docencia', nombre: 'Calificado en ≤ 7 días', unidad: '%', sentido: 'sube', meta: 90,
    perfiles: ['coordinacion'],
    como: 'Entregas calificadas en una semana o menos, sobre las calificadas en el periodo.',
    calcular: (t) => pct(t.calificadas_7d, t.calificadas) },
  { clave: 'foro', grupo: 'Docencia', nombre: 'Respuestas en el foro', unidad: 'respuestas', sentido: 'sube', meta: null,
    perfiles: ['docente'],
    como: 'Respuestas publicadas en los foros de tus cursos durante el periodo.',
    calcular: (t) => t.respuestas_periodo },

  // CRECIMIENTO
  { clave: 'inscritos', grupo: 'Crecimiento', nombre: 'Inscritos', unidad: 'alumnos', sentido: 'sube', meta: null,
    perfiles: ['direccion'],
    como: 'Inscripciones vigentes en los cursos a tu cargo.',
    calcular: (t) => t.alumnos },
  { clave: 'nuevos', grupo: 'Crecimiento', nombre: 'Inscripciones nuevas', unidad: 'alumnos', sentido: 'sube', meta: null,
    perfiles: ['direccion'],
    como: 'Inscripciones creadas en el periodo.',
    calcular: (t) => t.nuevos },
  { clave: 'interesados', grupo: 'Crecimiento', nombre: 'Interesados (leads)', unidad: 'personas', sentido: 'sube', meta: null,
    perfiles: ['direccion'],
    como: 'Correos dejados en talleres («quiero los materiales») en el periodo.',
    calcular: (t) => t.interesados },
  { clave: 'constancias', grupo: 'Crecimiento', nombre: 'Constancias emitidas', unidad: 'constancias', sentido: 'sube', meta: null,
    perfiles: [],
    como: 'Constancias con folio emitidas en el periodo.',
    calcular: (t) => t.constancias },
]

export const GRUPOS_KPI = [...new Set(KPIS.map((k) => k.grupo))]

/** Semáforo: 'verde' | 'ambar' | 'rojo' | null (sin meta o sin dato). */
export function semaforo(kpi, valor, meta = kpi.meta, tolerancia = 0.2) {
  if (valor == null || meta == null) return null
  if (kpi.sentido === 'sube') {
    if (valor >= meta) return 'verde'
    return valor >= meta * (1 - tolerancia) ? 'ambar' : 'rojo'
  }
  if (valor <= meta) return 'verde'
  // Con meta 0 («nada pendiente»), poco pendiente es ámbar.
  const margen = meta === 0 ? 3 : meta * tolerancia
  return valor <= meta + margen ? 'ambar' : 'rojo'
}

/** Los indicadores que se destacan arriba para un perfil. */
export function destacadosDe(perfil) {
  if (!perfil || perfil === 'plataforma') return KPIS.filter((k) => k.perfiles.includes('direccion'))
  return KPIS.filter((k) => k.perfiles.includes(perfil))
}

/** Formato corto de un valor con su unidad. */
export function formato(valor, unidad) {
  if (valor == null) return '—'
  if (unidad === '%') return `${valor}%`
  if (unidad === 'h') return valor >= 48 ? `${Math.round((valor / 24) * 10) / 10} días` : `${valor} h`
  return String(valor)
}

/** Agrupa indicadores externos por área → [{ area, filas }], lo más reciente primero. */
export function externosPorArea(filas) {
  const m = new Map()
  for (const f of [...(filas || [])].sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)))) {
    if (!m.has(f.area)) m.set(f.area, [])
    m.get(f.area).push(f)
  }
  return [...m].map(([area, lista]) => ({ area, filas: lista }))
}
