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
export const WA_CONSULTA = wa('Hola, vi tu página y me gustaría agendar una llamada de encuadre.')

export const LOGO_BLANCO = '/logo_blanco_1024.png'
export const LOGO_CLARO = '/logo_claro_1024.png'
export const FOTO_PERFIL = 'https://ohhdnaewtjfqszxemrju.supabase.co/storage/v1/object/public/avatares/foto_perfil_instagram_facebook.png'

export const ENLACE_DIAPOSITIVAS_PRESENTAR_CASO = 'https://1drv.ms/p/c/a43668d1cdc6e346/IQABiMuYL5oQQLuzj7m72L_FAR9JRwJCn52xxu9qaRKAENU?e=NA3oRy'
export const ENLACE_ENTREGABLES = 'https://1drv.ms/f/c/a43668d1cdc6e346/IgCxnJ6u1wjqSYKpW0N7eSgzAWc1XQw02u1GwWpkduAL9EI?e=h9CAvA'
// IMPORTANTE: guardar el código en Apps Script ya actualiza este deployment,
// no hace falta crear uno nuevo (crearlo es lo que genera URLs nuevas).
// Si algún día cambias "Quién tiene acceso", entonces sí debes crear uno nuevo
// y pasarme la URL.
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwPLMNkKPnU0xRVgtqk55vCMLP-n2BOPNCwC4-Jr37x005RgdTfdGKJCAK0K8yDjNY_fw/exec'

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

/* ============================================================
   DETALLES DEL CURSO DE DUELO
   ============================================================ */
export const DETALLES_DUELO = {
  intro: 'Evaluación y acompañamiento en duelo normativo y prolongado',
  subtitulo: 'Dos rutas paralelas, mismo rigor clínico, distinto punto de partida.',
  rutas: {
    acompanamiento: {
      grupo: 'Acompañamiento',
      nombre: 'Ruta Acompañamiento',
      dirigida: 'Para profesionales que acompañan personas en duelo sin ser especialistas en salud mental.',
      paraTiSi: 'En tu trabajo te toca sostener a alguien que perdió a alguien, y muchas veces no sabes qué decir. Te preocupa meter la pata, decir algo que empeore las cosas, o darte cuenta tarde de que esa persona necesitaba más ayuda de la que tú podías darle.',
      publicos: 'Docencia · salud · recursos humanos · trabajo social · acompañamiento espiritual · tanatología · servicios funerarios · voluntariado · y cualquier profesión donde acompañar sea parte del trabajo.',
      notaFinal: 'No necesitas formación en salud mental. Aquí aprendes a acompañar bien y a derivar a tiempo.',
      modulos: [
        { num: 1, titulo: 'Leer el duelo con modelo, no con intuición', descripcion: 'Los modelos que sí se sostienen con evidencia: la oscilación entre pérdida y restauración (Proceso Dual), las tareas del duelo (Worden) y la transformación del vínculo (vínculos continuos). Por qué las "cinco etapas" se malinterpretaron y qué usar en su lugar.' },
        { num: 2, titulo: 'Distinguir lo normativo de lo prolongado', descripcion: 'Los criterios actuales (DSM-5-TR) explicados y aplicados sobre dos casos gemelos, uno al lado del otro. Qué es realmente una señal de alarma y qué solo parece serlo.' },
        { num: 3, titulo: 'Acompañar con técnica', descripcion: 'Validación que no refuerza la evitación. Anclaje y regulación para sostener a alguien desbordado. Activación por valores. Desgaste por empatía y cómo prevenirlo.' },
        { num: 4, titulo: 'Riesgo, límites y derivación', descripcion: 'Cómo preguntar por ideación suicida sin rodeos. Semáforo de conducta. Dónde termina tu rol y empieza el de salud mental. Cómo derivar sin que se viva como abandono.' }
      ],
      metodologia: 'Cuatro sesiones en vivo, una por semana. Cápsula breve antes de cada una; la sesión se usa para trabajar casos, no para exponer. Dos casos gemelos te acompañan las cuatro semanas.',
      materiales: 'Cuadernillo de trabajo por módulo · guía de exploración · rejilla de señales de alarma · banco de frases · mapa de alcance y ruta de derivación · grabación · constancia de participación.'
    },
    clinica: {
      grupo: 'Clínica',
      nombre: 'Ruta Clínica',
      dirigida: 'Para profesionales de salud mental que atienden duelo en consulta.',
      paraTiSi: 'Atiendes casos de duelo en consulta y quieres pasar de acompañar con oficio a formular con método. Te interesa entender por qué esta persona sigue atascada y qué cadena concreta la mantiene ahí.',
      publicos: 'Psicología clínica · psiquiatría · psicoterapia · estudiantes de posgrado en salud mental · profesionales en formación clínica supervisada.',
      notaFinal: 'Requiere formación en salud mental. Aquí trabajas evaluación diferencial, formulación funcional y diseño de intervención.',
      modulos: [
        { num: 1, titulo: 'Evaluación diferencial del duelo', descripcion: 'Criterios DSM-5-TR aplicados reactivo por reactivo sobre dos casos gemelos. PG-13-R. Diferencial contra depresión, TEPT y adaptativo. Exploración de riesgo suicida.' },
        { num: 2, titulo: 'Formulación funcional del caso', descripcion: 'Arquitectura Nezu, Nezu y Lombardo completa. Análisis funcional del mantenimiento. Mapa de Patogénesis y Mapa de Alcance de Metas.' },
        { num: 3, titulo: 'Intervención: autorregulación y exposición graduada', descripcion: 'Secuencia DBT de tolerancia al malestar. Anclaje mindfulness. Defusión desde ACT. Jerarquía de exposición. Alternancia pérdida↔restauración.' },
        { num: 4, titulo: 'Riesgo, límites y derivación', descripcion: 'Plan de seguridad co-construido. Manejo del ámbar sostenido. Terapia de Shear (16 sesiones). Límites por profesión. Documentación alineada a NOM-004.' }
      ],
      metodologia: 'Cuatro sesiones en vivo, una por semana. Cápsula breve antes de cada una para llegar con el marco leído; la sesión se usa para formular, no para exponer.',
      materiales: 'Cuadernillo clínico por módulo · formatos de formulación y mapas · rejilla de diferencial · guía de exploración de riesgo · formato de nota clínica NOM-004 · grabación · constancia de participación.'
    }
  }
}
