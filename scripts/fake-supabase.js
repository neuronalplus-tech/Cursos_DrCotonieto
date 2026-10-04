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
    foro_hilos: [
      { id: 1, curso_id: 1, autor_id: 'u1', autor_nombre: 'Dr. Ernesto Cotonieto', autor_email: 'doc@ejemplo.com', titulo: 'Bienvenida al foro', cuerpo: '<p>Presenta aqui tus dudas.</p>', fijado: true, cerrado: false, creado_en: '2024-01-03T10:00:00Z', actualizado_en: '2024-01-03T10:00:00Z' },
      { id: 2, curso_id: 1, autor_id: 'u1', autor_nombre: 'Dr. Ernesto Cotonieto', autor_email: 'doc@ejemplo.com', titulo: 'Tema cerrado', cuerpo: 'Este ya no admite respuestas.', fijado: false, cerrado: true, creado_en: '2024-01-02T10:00:00Z', actualizado_en: '2024-01-02T10:00:00Z' },
    ],
    foro_respuestas: [
      { id: 1, hilo_id: 1, autor_id: 'u2', autor_nombre: 'Alumno Prueba', autor_email: 'alumno@ejemplo.com', cuerpo: '<p>Tengo una duda.</p>', editado: false, borrada: false, creado_en: '2024-01-03T11:00:00Z' },
    ],
  },

  // Plataforma recien creada: no hay NADA. Es el estado real de un usuario
  // que se inscribe antes de que publiques contenido.
  vacio: {
    cursos: [], modulos: [], recursos: [], acceso: [], perfiles: [],
    progreso_usuario: [], mensajes: [], examenes: [], intentos_examen: [],
    vista_admin_inscripciones: [], usuarios: [], constancias: [],
    notas_admin: [], leads_talleres: [], foro_hilos: [], foro_respuestas: [],
  },
}

// Derivados: se construyen a mano porque un escenario vacio debe cambiar
// UNA tabla y mantener el resto con datos.
ESCENARIOS.sinModulos = { ...ESCENARIOS.completo, modulos: [], recursos: [], examenes: [], intentos_examen: [] }
ESCENARIOS.sinRecursos = { ...ESCENARIOS.completo, recursos: [] }
ESCENARIOS.sinIntentos = { ...ESCENARIOS.completo, intentos_examen: [] }
ESCENARIOS.sinMensajes = { ...ESCENARIOS.completo, mensajes: [] }
// Foro recien creado: el admin aún no abrió ningún tema.
ESCENARIOS.sinForo = { ...ESCENARIOS.completo, foro_hilos: [], foro_respuestas: [] }

function tablas() {
  return ESCENARIOS[globalThis.__ESCENARIO__] || ESCENARIOS.completo
}

/**
 * Compara como lo hace PostgREST: el valor de la URL llega siempre como TEXTO
 * (`useParams()` devuelve "36"), y el servidor lo castea al tipo de la columna
 * (`bigint`). Con `===` estricto, `f.curso_id === '1'` era siempre false y el
 * foro salía VACÍO aunque hubiera temas: smoke-datos daba "OK" sin haber
 * ejercitado nunca la lista con datos.
 */
function igual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/**
 * Registro de escrituras para las pruebas de interacción.
 *
 * El doble antes ignoraba insert/update/delete, así que las pruebas solo
 * podían comprobar que la vista se pinta, nunca que el botón de guardar
 * llega a enviar algo. Ahora cada escritura queda anotada en
 * globalThis.__ESCRITAS__ y las pruebas pueden verificar, entre otras
 * cosas, que un tema nuevo va con autor_id de verdad y no a null.
 */
function anotar(tabla, operacion, datos) {
  if (!globalThis.__ESCRITAS__) globalThis.__ESCRITAS__ = []
  globalThis.__ESCRITAS__.push({ tabla, operacion, datos })
}

/** Deja el registro limpio. Lo llama cada prueba antes de empezar. */
export function limpiarEscritas() {
  globalThis.__ESCRITAS__ = []
}

export function escrituras() {
  return globalThis.__ESCRITAS__ || []
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
          return (col, val) => { filas = filas.filter((f) => igual(f[col], val)); return proxy }
        case 'neq':
          return (col, val) => { filas = filas.filter((f) => !igual(f[col], val)); return proxy }
        case 'is':
          return (col, val) => { filas = filas.filter((f) => (val === null ? f[col] == null : f[col] === val)); return proxy }
        case 'in':
          return (col, vals) => { filas = filas.filter((f) => (vals || []).some((v) => igual(f[col], v))); return proxy }
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
        // insert / update / delete no transforman las filas; solo quedan anotados
        // para que las pruebas de interacción vean lo que se intentó escribir.
        case 'insert':
          return (datos) => { anotar(tabla, 'insert', datos); return proxy }
        case 'upsert':
          return (datos) => { anotar(tabla, 'upsert', datos); return proxy }
        case 'update':
          return (datos) => { anotar(tabla, 'update', datos); return proxy }
        case 'delete':
          return () => { anotar(tabla, 'delete', null); return proxy }
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

/**
 * Canales de Realtime falsos que se comportan como los de verdad.
 *
 * Antes `channel()` devolvía un objeto nuevo e inocente, así que ninguna
 * prueba podía ver el fallo real que dejaba la página en blanco. En el
 * cliente real:
 *   · `channel(tema)` REUTILIZA el canal que ya existe con ese tema, y
 *   · `.on(...)` LANZA una excepción si el canal ya está suscrito:
 *       "cannot add `postgres_changes` callbacks for ... after `subscribe()`"
 * Como `removeChannel` es ASÍNCRONO (hace `await unsubscribe()` y luego
 * suelta el canal), repetir el efecto con el mismo tema encontraba el canal
 * viejo todavía vivo: la excepción dentro del useEffect desmontaba el árbol
 * entero de React y la pantalla quedaba en blanco, sin menú ni pistas.
 */
const canales = new Map()

function crearCanal(tema) {
  const canal = {
    tema,
    suscrito: false,
    bindings: [],
    on(tipo, filtro, cb) {
      // Mismo guardia que el cliente real.
      if (canal.suscrito && (tipo === 'postgres_changes' || tipo === 'presence')) {
        throw new Error(
          `cannot add \`${tipo}\` callbacks for realtime:${tema} after \`subscribe()\`.`
        )
      }
      canal.bindings.push({ tipo, filtro, cb })
      return canal
    },
    subscribe(cb) {
      canal.suscrito = true
      if (cb) setTimeout(cb, 0)
      return canal
    },
    unsubscribe() {
      canal.suscrito = false
      return Promise.resolve('ok')
    },
    teardown() {},
  }
  return canal
}

/** Lo usan las pruebas para comprobar cuántos canales quedaron vivos. */
export function canalesFalsos() {
  return canales
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

  // Reutiliza el canal con el mismo tema, igual que supabase-js.
  channel: (tema) => {
    if (!canales.has(tema)) canales.set(tema, crearCanal(tema))
    return canales.get(tema)
  },

  removeChannel: async (canal) => {
    if (!canal) return 'ok'
    const estado = await canal.unsubscribe()
    canal.teardown()
    canales.delete(canal.tema)
    return estado
  },
}

export default supabase
