export const PLANTILLA_RUBRICA = [
  ['criterio', 'peso', 'descripcion'],
  ['Análisis del caso', 40, 'Integra los datos relevantes y fundamenta la interpretación.'],
  ['Propuesta de intervención', 35, 'Define acciones claras y coherentes con el análisis.'],
  ['Presentación y fuentes', 25, 'Organiza el trabajo y cita las fuentes consultadas.'],
].map(f => f.join('\t')).join('\n')

export const PLANTILLA_PADRON_CSV = [
  ['nombre', 'apellidos', 'correo', 'curso', 'grupo'],
  ['Ana', 'Ejemplo', 'ana@example.com', 'Curso', 'Grupo A'],
].map(f => f.join(',')).join('\n')

export const CATALOGO_PLANTILLAS = [
  { nombre: 'Rúbrica de tarea', archivo: 'plantilla-rubrica.tsv', contenido: PLANTILLA_RUBRICA, detalle: 'Criterios, peso y descripción. Importable desde la opción Excel de la rúbrica.' },
  { nombre: 'Preguntas para examen o banco', archivo: 'plantilla-preguntas.tsv', contenido: 'tipo\tpregunta\top1\top2\top3\top4\top5\tcorrecta\trespuesta\tpares\nopcion\tEscribe aquí la pregunta\tOpción correcta\tDistractor 1\tDistractor 2\tDistractor 3\t\t1\t\t', detalle: 'Preguntas de opción, verdadero/falso, respuesta corta o emparejar.' },
  { nombre: 'Padrón de alumnos', archivo: 'plantilla-padron.csv', contenido: PLANTILLA_PADRON_CSV, detalle: 'Ejemplo de tabla para preparar altas e inscripciones masivas.' },
]

export function descargarPlantilla(plantilla) {
  const blob = new Blob(['\ufeff', plantilla.contenido], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = plantilla.archivo; a.click()
  URL.revokeObjectURL(url)
}
