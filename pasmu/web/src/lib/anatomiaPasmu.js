export const ANATOMIA_PASMU = [
  { clave: 'historia', nombre: 'Historia clínica', permiso: 'expediente.ver', seccion: 'expediente' },
  { clave: 'examen_mental', nombre: 'Examen del estado mental', permiso: 'expediente.ver', seccion: 'expediente' },
  { clave: 'notas', nombre: 'Notas clínicas', permiso: 'expediente.ver', seccion: 'expediente' },
  { clave: 'tareas', nombre: 'Tareas entre sesiones', permiso: 'expediente.ver', seccion: 'expediente' },
  { clave: 'material', nombre: 'Material asignado', permiso: 'expediente.ver', seccion: 'expediente' },
  { clave: 'autoevaluaciones', nombre: 'Autoevaluaciones', permiso: 'expediente.ver', seccion: 'expediente' },
  { clave: 'asistencia', nombre: 'Asistencia a sesión', permiso: 'agenda.ver', seccion: 'agenda' },
  { clave: 'reportes', nombre: 'Reportes de evaluación', permiso: 'reportes.ver', seccion: 'reportes' },
  { clave: 'consentimientos', nombre: 'Consentimientos', permiso: 'expediente.documentos', seccion: 'expediente' },
]

export const ESTADOS_SESION = [
  ['presente', 'Presente', '✓'],
  ['retardo', 'Retardo', '⏱'],
  ['ausente', 'Ausente', '✕'],
  ['permiso', 'Permiso', '◐'],
]

export const OBJETIVOS_CLINICOS = [
  'estres', 'procrastinacion', 'rumiacion', 'ansiedad', 'animo', 'sueno', 'habilidades', 'duelo', 'otro',
]

const TAB = String.fromCharCode(9)
export function parsePadronClinico(texto) {
  const errores = []
  if (!texto?.trim()) return { filas: [], errores, conColumnas: false }
  const lineas = texto.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  const filas = []
  const vistos = new Set()
  for (let i = 0; i < lineas.length; i++) {
    const celdas = lineas[i].split(lineas[i].includes(TAB) ? TAB : ',').map((c) => c.trim())
    if (i === 0 && /correo|email|nombre/i.test(lineas[i])) continue
    const email = celdas.find((c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c))?.toLowerCase()
    if (!email) { errores.push(`Fila ${i + 1}: sin correo válido.`); continue }
    if (vistos.has(email)) { errores.push(`Fila ${i + 1}: repetido.`); continue }
    vistos.add(email)
    filas.push({ email, nombre: celdas.find((c) => c && c !== email && !/^[^@\s]+@/.test(c)) || '' })
  }
  return { filas, errores, conColumnas: filas.some((f) => f.nombre) }
}

export function normalizarTelefonoMX(crudo) {
  if (!crudo) return null
  let d = String(crudo).replace(/\D/g, '')
  if (d.startsWith('044') || d.startsWith('045')) d = d.slice(3)
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10) d = '52' + d
  if (d.length < 11 || d.length > 15) return null
  return d
}

export function enlaceWhatsAppCita(numero, texto) {
  const d = normalizarTelefonoMX(numero)
  if (!d) return null
  return `https://wa.me/${d}?text=${encodeURIComponent(texto || '')}`
}

export function aplicarPlantillaCita(texto, datos = {}) {
  return String(texto || '')
    .replace(/\{\{\s*nombre\s*\}\}/g, (datos.nombre || '').trim())
    .replace(/\{\{\s*fecha\s*\}\}/g, (datos.fecha || '').trim())
    .replace(/\{\{\s*unidad\s*\}\}/g, (datos.unidad || '').trim())
}
