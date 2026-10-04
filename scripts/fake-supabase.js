/**
 * Doble de Supabase para las pruebas de render.
 *
 * El cliente real encadena (.from().select().eq().order()) y devuelve un
 * thenable. Este Proxy reproduce esa forma para que los componentes ejecuten
 * exactamente el mismo código y lleguen a la rama de "datos cargados", que
 * con renderToString nunca se tocaba porque useEffect no corre en servidor.
 *
 * Los datos son falsos pero con las columnas que cada vista lee de verdad.
 */
const TABLAS = {
  cursos: [
    { id: 1, titulo: 'Duelo y pérdida: curso completo', descripcion: 'Descripción del curso de prueba.', activo: true, gratuito: false, oculto: false, orden: 1, linea: 'Duelo y pérdida', constancia: true, tipo: 'curso' },
    { id: 2, titulo: 'Formulación y terapias contextuales', descripcion: 'Otro curso.', activo: true, gratuito: true, oculto: false, orden: 2, linea: 'Formulación y terapias contextuales', constancia: false, tipo: 'curso' },
  ],
  modulos: [
    { id: 1, curso_id: 1, titulo: 'Módulo 1 · El duelo normal', descripcion: 'Contenido del módulo.', activo: true, grupo: null, oculto: false, disponible: true, orden: 1 },
    { id: 2, curso_id: 1, titulo: 'Módulo 2 · Duelo complicado', descripcion: 'Contenido del módulo 2.', activo: true, grupo: null, oculto: false, disponible: true, orden: 2 },
  ],
  recursos: [
    { id: 1, modulo_id: 1, titulo: 'Presentación del caso', descripcion: 'PDF de ejemplo.', tipo: 'pdf', archivo: 'caso.pdf', orden: 1, url: null },
    { id: 2, modulo_id: 1, titulo: 'Video de apoyo', descripcion: 'Video.', tipo: 'video', archivo: 'video.mp4', orden: 2, url: null },
  ],
  acceso: [
    { usuario_id: 'u1', curso_id: 1, grupo: 'A' },
  ],
  perfiles: [
    { id: 'u1', nombre_completo: 'Usuario Prueba', profesion: 'Psicólogo clínico', descripcion: 'Bio de prueba.', ubicacion: 'Ciudad de México', avatar_url: 'https://ejemplo.com/a.png' },
  ],
  progreso_usuario: [
    { usuario_id: 'u1', recurso_id: 1, completado: true },
  ],
  mensajes: [
    { id: 1, de_id: 'u1', para_id: 'u2', texto: 'Hola, ¿me compartes el material?', leido: true, creado_en: '2024-01-01T10:00:00Z', adjunto_url: null, adjunto_tipo: null },
    { id: 2, de_id: 'u2', para_id: 'u1', texto: 'Claro, aquí está.', leido: true, creado_en: '2024-01-01T11:00:00Z', adjunto_url: null, adjunto_tipo: null },
  ],
  examenes: [
    { id: 1, modulo_id: 1, titulo: 'Evaluación del módulo 1', descripcion: 'Examen de prueba', preguntas: [], activo: true, intentos_max: 2, puntaje_aprobacion: 70 },
  ],
  intentos_examen: [
    { id: 1, usuario_id: 'u1', examen_id: 1, calificacion: 90, aprobado: true, creado_en: '2024-01-02T10:00:00Z' },
  ],
  vista_admin_inscripciones: [
    { id: 1, nombre: 'Alumno Prueba', email: 'alumno@ejemplo.com', curso_id: 1, curso: 'Duelo y pérdida', inscrito_el: '2024-01-01T09:00:00Z' },
  ],
  usuarios: [
    { id: 'u2', email: 'otro@ejemplo.com', nombre_completo: 'Otro Usuario', creado_en: '2024-01-01T08:00:00Z' },
  ],
}

/**
 * Constructor de un "query builder" falso: cualquier método encadena y
 * termina en un thenable que resuelve con las filas de la tabla.
 */
function consulta(tabla) {
  const filas = TABLAS[tabla] || []
  const resolver = (datos) => Promise.resolve({ data: datos, error: null })

  let proxy
  const base = {
    then: (res, rej) => resolver(filas).then(res, rej),
    catch: (rej) => resolver(filas).catch(rej),
    finally: (f) => resolver(filas).finally(f),
    maybeSingle: () => resolver(filas[0] || null),
    single: () => resolver(filas[0] || null),
  }

  proxy = new Proxy(base, {
    get(objetivo, prop) {
      if (prop in objetivo) return objetivo[prop]
      if (typeof prop === 'symbol') return undefined
      // select / eq / order / in / limit / gt / update / insert / upsert / delete
      return (..._args) => proxy
    },
  })
  return proxy
}

/**
 * Permite probar las dos ramas: con sesión (globalThis.__SESION__ !== false)
 * y sin sesión. Sin esto solo se ejercita la ruta de usuario conectado.
 */
function sesionActiva() {
  return globalThis.__SESION__ !== false
}

export const supabase = {
  from: (tabla) => consulta(tabla),

  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: (ruta) => ({ data: { publicUrl: `https://falso.local/${ruta}` } }),
      createSignedUrl: async () => ({ data: { signedUrl: 'https://falso.local/firmada' }, error: null }),
      download: async () => ({ data: new Blob(['contenido']), error: null }),
      remove: async () => ({ error: null }),
    }),
  },

  auth: {
    getSession: async () => ({
      data: { session: sesionActiva() ? { access_token: 'token-falso', user: { id: 'u1' } } : null },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ error: null }),
    onAuthStateChange: (cb) => {
      cb('SIGNED_IN', sesionActiva() ? { access_token: 'token-falso', user: { id: 'u1' } } : null)
      return { data: { subscription: { unsubscribe() {} } } }
    },
  },

  rpc: async () => ({ data: [], error: null }),

  channel: () => {
    const c = {
      on: () => c,
      subscribe: (cb) => { if (cb) setTimeout(cb, 0); return c },
      unsubscribe: () => {},
    }
    return c
  },

  removeChannel: () => {},
}

export default supabase
