/* ============================================================
   CONFIGURACIÓN GLOBAL
   Extraído de App.jsx durante el refactor. Mismos valores, un solo origen.
   ============================================================ */

export const BUCKET_PAGO = 'curso_duelo'
export const BUCKET_TALLERES = 'talleres'
export const AVATAR_BUCKET = 'avatares'
export const CHAT_ADJUNTOS_BUCKET = 'chat_adjuntos'

export const CONTACTO_EMAIL = 'cotonietoe@gmail.com'
export const WHATSAPP = '5215637841931'
export const wa = (t) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t)}`
export const WA_CONSULTA = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, vi tu página y me gustaría agendar una llamada de encuadre.')}`

export const LOGO_BLANCO = '/logo_blanco_1024.png'
export const LOGO_CLARO = '/logo_claro_1024.png'
export const FOTO_PERFIL = 'https://ohhdnaewtjfqszxemrju.supabase.co/storage/v1/object/public/avatares/foto_perfil_instagram_facebook.png'

export const ENLACE_DIAPOSITIVAS_PRESENTAR_CASO = 'https://1drv.ms/p/c/a43668d1cdc6e346/IQABiMuYL5oQQLuzj7m72L_FAR9JRwJCn52xxu9qaRKAENU?e=NA3oRy'
export const ENLACE_ENTREGABLES = 'https://1drv.ms/f/c/a43668d1cdc6e346/IgCxnJ6u1wjqSYKpW0N7eSgzAWc1XQw02u1GwWpkduAL9EI?e=h9CAvA'
// IMPORTANTE: guardar el código en Apps Script ya actualiza este deployment,
// no hace falta crear uno nuevo (crearlo es lo que genera URLs nuevas).
// Si algún día cambias "Quién tiene acceso", entonces sí debes crear uno nuevo
// y pasarme la URL.
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyphl1phs105zfP-y1UuAJqd9vrOx2xhQzTuuDoI3zU5e6ToeSB_CQpyWoswJcTqbP9RA/exec'

export const MARCA = {
  nombre: 'Dr. Ernesto Cotonieto',
  credencial: 'Cédula profesional 10521804 · Doctorado en Ciencias del Comportamiento Saludable',
  slogan: 'No tienes que traducirte para que te entiendan.',
  subtitulo: 'Un espacio afirmativo, para quienes cargan más de lo que muestran.',
  bio: 'Acompaño a adolescentes (desde 13 años) y adultos en procesos psicológicos basados en evidencia, y formo a profesionales de la salud mental. Combino la práctica clínica con la investigación y la docencia.'
}

export const REDES = [
  { nombre: 'Página oficial', corto: 'Web', url: 'https://drcotonieto.netlify.app/', icono: '🌐' },
  { nombre: 'Instagram', corto: 'Instagram', url: 'https://www.instagram.com/dr.cotonieto/', icono: '📷' },
  { nombre: 'Facebook', corto: 'Facebook', url: 'https://www.facebook.com/dr.cotonieto', icono: '👥' },
  { nombre: 'LinkedIn', corto: 'LinkedIn', url: 'https://www.linkedin.com/in/ernesto-cotonieto-928039235/', icono: '💼' },
  { nombre: 'Google Scholar', corto: 'Publicaciones', url: 'https://scholar.google.com/citations?hl=es&user=8wRWA-sAAAAJ', icono: '🎓' }
]

export const SERVICIOS = [
  { titulo: 'Terapia individual en línea', detalle: 'Adolescentes desde 13 años y adultos. Procesos basados en evidencia.' },
  { titulo: 'Llamada de encuadre sin costo', detalle: '15 a 20 minutos para conocernos y ver si es buen momento.' },
  { titulo: 'Supervisión clínica grupal', detalle: 'Grupos cerrados de 5 a 6 profesionales, con método de formulación.' },
  { titulo: 'Cursos y talleres', detalle: 'Formación clínica aplicada para profesionales de la salud mental.' }
]

export const CASOS = [
  'Ansiedad intensa y ataques de pánico', 'Trauma y TEPT',
  'Distimia y estados de ánimo persistentes', 'Neurodivergencia',
  'Crisis emocionales', 'Estrés profesional y autoexigencia extrema'
]

export const ENFOQUES = ['Terapia de Aceptación y Compromiso (ACT)', 'Análisis funcional de la conducta', 'Terapia Dialéctico-Conductual (DBT)']

export const LINEA_COPY = {
  'Formulación y terapias contextuales': { texto: 'Formulación de caso, ACT, DBT, mindfulness y análisis funcional para decidir con criterio clínico.', motivo: 'red' },
  'Duelo y pérdida': { texto: 'Duelo normativo, complicado, infantil y escritura emocional reflexiva.', motivo: 'ondas' },
  'Neurodivergencia': { texto: 'Detección, diagnóstico diferencial y acompañamiento afirmativo, con criterios DSM-5-TR.', motivo: 'malla' },
  'Riesgo, documentación y ética': { texto: 'Evaluación de riesgo suicida, documentación clínica y límites éticos en la práctica.', motivo: 'escudo' },
  'Peritaje psicológico': { texto: 'Fundamentos del peritaje y revisión metodológica de entrevistas forenses.', motivo: 'prisma' },
  'Ciclo vital y bienestar': { texto: 'Mindfulness clínico, ansiedad y pánico, y bienestar en la adultez y la vejez.', motivo: 'circulos' },
  'Práctica profesional': { texto: 'Supervisión clínica grupal, psicometría aplicada y prevención del desgaste profesional.', motivo: 'arcos' },
  'Talleres gratuitos': { texto: 'Formación breve y de acceso libre para empezar a formarte hoy mismo.', motivo: 'arcos' },
  'Educación': { texto: 'Debates contemporáneos y herramientas aplicables para profesionales de la educación.', motivo: 'prisma' }
}

export const ICONO_TIPO = { pdf: '📄', video: '🎬', word: '📝', enlace: '🔗', autoevaluacion: '✍️' }
export const NOMBRE_TIPO = { pdf: 'Documento', video: 'Video', word: 'Descargable', enlace: 'Enlace', autoevaluacion: 'Autoevaluación' }

export const CURSOS_ESPECIALES = {
  duelo: {
    patron: /duelo\s+normativo/i,
    disponibleDesde: '1 de octubre',
    detallesKey: 'duelo'
  }
}

export const ESTILOS_BOTON = [
  { valor: 'primary',   etiqueta: 'Oscuro sólido' },
  { valor: 'secondary', etiqueta: 'Contorno' },
  { valor: 'azul',      etiqueta: 'Azul' },
  { valor: 'whatsapp',  etiqueta: 'Verde WhatsApp' },
]

/** Redirige al login conservando a dónde quería ir el usuario. */
export const rutaAcceso = (destino) => `/acceso?redirigir=${encodeURIComponent(destino)}`
