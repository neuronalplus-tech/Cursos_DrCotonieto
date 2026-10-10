export const PLANTILLA_RUBRICA = [
  ['criterio', 'peso', 'descripcion'],
  ['Análisis del caso', 40, 'Integra los datos relevantes y fundamenta la interpretación.'],
  ['Propuesta de intervención', 35, 'Define acciones claras y coherentes con el análisis.'],
  ['Presentación y fuentes', 25, 'Organiza el trabajo y cita las fuentes consultadas.'],
].map(f => f.join('\t')).join('\n')

import { PLANTILLA_TSV } from './examenes'
import { PLANTILLA_PADRON } from './padron'

export const CATALOGO_PLANTILLAS = [
  { nombre: 'Rúbrica de tarea', archivo: 'plantilla-rubrica.tsv', contenido: PLANTILLA_RUBRICA, imagen: '/plantillas/ejemplo-rubrica.svg', detalle: 'Criterios, peso y descripción. Importable desde la opción Excel de la rúbrica.' },
  { nombre: 'Preguntas para examen o banco', archivo: 'plantilla-preguntas.tsv', contenido: PLANTILLA_TSV, imagen: '/plantillas/ejemplo-preguntas.svg', detalle: 'Preguntas de opción, verdadero/falso, respuesta corta o emparejar.' },
  { nombre: 'Padrón de alumnos', archivo: 'plantilla-padron.tsv', contenido: PLANTILLA_PADRON, imagen: '/plantillas/ejemplo-padron.svg', detalle: 'Columnas nombre, correo, generación y ruta, como las solicita el importador masivo.' },
]

export function descargarPlantilla(plantilla) {
  const blob = new Blob(['\ufeff', plantilla.contenido], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = plantilla.archivo; a.click()
  URL.revokeObjectURL(url)
}
