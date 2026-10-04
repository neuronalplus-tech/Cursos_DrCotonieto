/**
 * Doble de Supabase para las pruebas de render.
 *
 * El cliente real encadena (.from().select().eq().order()) y devuelve un
 * thenable. Este Proxy reproduce esa forma para que los componentes ejecuten
 * exactamente el mismo codigo.
 *
 * IMPORTANTE: los filtros SI se aplican. Antes se ignoraban y eso era un
 * agujero: toda consulta devolvia todas las filas de la tabla, asi que solo
 * se ejercitaba la rama "hay datos" y nunca "lista vacia", "este curso no
 * tiene modulos" o "el alumno no tiene intentos".
 *
 * Los escenarios se eligen con globalThis.__ESCENARIO__ antes de montar.
 */
const ESCENARIOS = {
  // Todos los registros presentes: la rama "contenido lleno".
  completo: {
    cursos: [
      { id: 1, titulo: 'Duelo y perdida: curso completo', descripcion: 'Descripcion del curso.', activo: true, gratuito: false, oculto: false, orden: 1, linea: 'Duelo', constancia: true, tipo: 'curso' },
      { id: 2, titulo: 'Formulacion y terapias contextuales', descripcion: 'Otro curso.', activo: true, gratuito: true, oculto: false, orden: 2, linea: 'Formulacion', constancia: false, tipo: 'curso' },
    ],
    modulos: [
      { id: 1, curso_id: 1, titulo: 'Modulo 1', descripcion: 'Contenido.', activo: true, grupo: 'acompanamiento', oculto: false, disponible: true, orden: 1 },
      { id: 2, curso_id: 1, titulo: 'Modulo 2', descripcion: 'Contenido 2.', activo: true, grupo: 'clinica', oculto: false, disponible: true, orden: 2 },
      { id: 3, curso_id: 1, titulo: 'Modulo comun', descripcion: 'Sin grupo.', activo: true, grupo: null, oculto: false, disponible: true, orden: 3 },
    ],
    recursos: [
      { id: 1, modulo_id: 1, titulo: 'Presentacion', descripcion: 'PDF.', tipo: 'pdf', archivo: 'caso.pdf', orden: 1, url: null },
      { id: 2, modulo_id: 1, titulo: 'Video', descripcion: 'Video.', tipo: 'video', archivo: 'v.mp4', orden: 2, url: null },
    ],
    acceso: [{ usuario_id: 'u1', curso_id: 1, grupo: 'A' }],
    perfiles: [{ id: 'u1', nombre_completo: 'Usuario Prueba', profesion: 'Psicologo', descripcion: 'Bio.', ubicacion: 'CDMX', avatar_url: 'https://ejemplo.com/a.png' }],
    progreso_usuario: [{ usuario_id: 'u1', recurso_id: 1, completado: true }],
    mensajes: [
      { id: 1, de_id: 'u1', para_id: 'u2', texto: 'Hola', leido: true, creado_en: '2024-01-01T10:00:00Z', adjunto_url: null, adjunto_tipo: null },
      { id: 2, de_id: 'u2', para_id: 'u1', texto: 'Claro', leido: false, creado_en: '2024-01-01T11:00:00Z', adjunto_url: null, adjunto_tipo: null },
    ],
    examenes: [{ id: 1, modulo_id: 1, titulo: 'Evaluacion', descripcion: 'Examen', preguntas: [], activo: true, intentos_max: 2, max_intentos: 2, puntaje_aprobacion: 70 }],
    intentos_examen: [{ id: 1, usuario_id: 'u1', examen_id: 1, calificacion: 90, aprobado: true, creado_en: '2024-01-02T10:00:00Z' }],
    vista_admin_inscripciones: [{ id: 1, nombre: 'Alumno Prueba', email: 'alumno@ejemplo.com', curso_id: 1, curso: 'Duelo', inscrito_el: '2024-01-01T09:00:00Z' }],
    usuarios: [{ id: 'u2', email: 'otro@ejemplo.com', nombre_completo: 'Otro', creado_en: '2024-01-01T08:00:00Z' }],
    constancias: [{ id: 1, usuario_id: 'u1', curso_id: 1, folio: 'TC-001', fecha_emision: '2024-01-01', nombre_completo: 'Usuario Prueba' }],
    notas_admin: [],
    leads_talleres: [],
  },

  // Plataforma recien creada: no hay NADA. Es el estado real de un usuario
  // que se inscribe antes de que publiques contenido.
  vacio: {
    cursos: [], modulos: [], recursos: [], acceso: [], perfiles: [],
    progreso_usuario: [], mensajes: [], examenes: [], intentos_examen: [],
    vista_admin_inscripciones: [], usuarios: [], constancias: [],
    notas_admin: [], leads_talleres: [],
  },
}

// Derivados: se construyen a mano porque un escenario vacio debe cambiar
// UNA tabla y mantener el resto con datos.
ESCENARIOS.sinModulos = { ...ESCENARIOS.completo, modulos: [], recursos: [], examenes: [], intentos_examen: [] }
ESCENARIOS.sinRecursos = { ...ESCENARIOS.completo, recursos: [] }
ESCENARIOS.sinIntentos = { ...ESCENARIOS.completo, intentos_examen: [] }
ESCENARIOS.sinMensajes = { ...ESCENARIOS.completo, mensajes: [] }

function tablas() {
  return ESCENARIOS[globalThis.__ESCENARIO__] || ESCENARIOS.completo
}

/**
 * Query builder falso que APLICA los filtros.
 *
 * El cliente real encadena .from(tabla).select().eq().order() y devuelve un
 * thenable. Este Proxy reproduce esa forma, con la diferencia clave de que
 * .eq/.in/.gte/.order/.limit de verdad transforman las filas. Gracias a eso se
 * ejercitan ramas como "este modulo no tiene recursos" o "ordenado por titulo",
 * que antes nunca se tocaban.
 */
function consulta(tabla) {
  let filas = tablas()[tabla] || []
  let orden = null
  let limite = null

  const construir = () => {
    let out = filas
    if (orden) {
      const copia = [...out]
      copia.sort((a, b) => {
        for (const [col, dir] of orden) {
          const va = a[col]
          const vb = b[col]
          if (va === vb) continue
          const cmp = va > vb ? 1 : -1
          return dir === 'desc' ? -cmp : cmp
        }
        return 0
      })
      out = copia
    }
    if (limite != null) out = out.slice(0, limite)
    return out
  }

  const resolver = (datos) => Promise.resolve({ data: datos, error: null })

  const base = {
    then: (res, rej) => resolver(construir()).then(res, rej),
    catch: (rej) => resolver(construir()).catch(rej),
    finally: (f) => resolver(construir()).finally(f),
    maybeSingle: () => resolver(construir()[0] ?? null),
    single: () => resolver(construir()[0] ?? null),
  }

  let proxy
  proxy = new Proxy(base, {
    get(objetivo, prop) {
      if (prop in objetivo) return objetivo[prop]
      if (typeof prop === 'symbol') return undefined

      switch (prop) {
        case 'eq':
          return (col, val) => { filas = filas.filter((f) => f[col] === val); return proxy }
        case 'neq':
          return (col, val) => { filas = filas.filter((f) => f[col] !== val); return proxy }
        case 'is':
          return (col, val) => { filas = filas.filter((f) => (val === null ? f[col] == null : f[col] === val)); return proxy }
        case 'in':
          return (col, vals) => { filas = filas.filter((f) => (vals || []).includes(f[col])); return proxy }
        case 'gte':
          return (col, val) => { filas = filas.filter((f) => f[col] != null && f[col] >= val); return proxy }
        case 'gt':
          return (col, val) => { filas = filas.filter((f) => f[col] != null && f[col] > val); return proxy }
        case 'lte':
          return (col, val) => { filas = filas.filter((f) => f[col] != null && f[col] <= val); return proxy }
        case 'order':
          return (col, dir = 'asc', anidado) => {
            orden = [[col, dir]]
            if (anidado && typeof anidado === 'object') orden.push(...Object.entries(anidado))
            return proxy
          }
        case 'limit':
          return (n) => { limite = n; return proxy }
        case 'range':
          return (desde, hasta) => { filas = filas.slice(desde, hasta + 1); return proxy }
        // select / update / insert / upsert / delete no transforman nada aqui
        default:
          return () => proxy
      }
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
