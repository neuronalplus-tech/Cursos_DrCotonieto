/* ============================================================
   ENVÍO DE CORREO  ·  función del servidor (Supabase Edge)
   ------------------------------------------------------------
   EL PROBLEMA QUE RESUELVE (hallazgo B1 del diagnóstico)
   El relay de correo es un Google Apps Script abierto: cualquiera
   en internet con la URL podía mandar correo desde la cuenta de
   Gmail del doctor. Ni secreto, ni sesión, ni origen: un relay
   público disfrazado de herramienta interna.

   CÓMO SE CIERRA
   El navegador ya no llama al Apps Script. Llama AQUÍ, y aquí
   solo pasa el mensaje si:

   1. Quien llama trae una sesión válida Y aparece en `admins` o
      en `facilitadores` (el correo es cosa de gestión, no de
      alumnado). Único caso sin sesión que se admite:
      `solicitud-materiales`, el formulario público del taller,
      que además se REARMAN aquí: solo correo, título del curso y
      nada más; nadie puede colar asuntos ni cuerpos arbitrarios
      por esa puerta.
   2. El Apps Script exige, además, el secreto compartido
      `CORREO_SECRETO` (v5 de Notificador.gs). El mismo valor
      vive en dos sitios que nunca se ven: como secreto de esta
      función en Supabase, y como propiedad de script en Apps
      Script. No está en el navegador ni en el repo.

   CÓMO SE INSTALA (en este orden, para no dejar huecos)
     1. Genera un secreto largo (p. ej. con un gestor de
        contraseñas): nada de palabras.
     2. Supabase -> Edge Functions -> Secrets -> añade
        CORREO_SECRETO (y opcionalmente CORREO_URL).
     3. Apps Script -> Configuración del proyecto ->
        Propiedades de script -> añade CORREO_SECRETO
        con el MISMO valor.
     4. Supabase -> Edge Functions -> Deploy a new function
        · Nombre EXACTO: correo-enviar
        · Pega este archivo completo y despliega.
     5. Recién entonces pega el Notificador.gs v5 en Apps
        Script y publica Nueva versión. Si lo hicieras al
        revés, el Apps Script nuevo se niega a mandar —es a
        propósito— y el correo falla hasta que exista el secreto.

   Si falta CORREO_SECRETO, la función lo dice con nombre y no
   manda nada: mejor un error claro que un correo robado.

   F6-3 · Cada llamada con sesión deja una entrada en
   `auditoria` (tabla `correo-enviar`; si falta
   supabase/BITACORA.sql, la consola lo avisa y el envío sigue).
   Hay tope de 20 llamadas por gestor/minuto, de 30 por IP/minuto
   y de 512 KB de cuerpo. El `ping` no consume bitácora.
   ============================================================ */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const limpiarCorreo = (s: unknown) => String(s ?? '').trim().toLowerCase()
const esCorreo = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
/** Texto plano cortado: nadie manda kilómetros de basura por parámetro. */
const limpiarTexto = (s: unknown, max: number) =>
  String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/* --- F6-3 · frenos, tipos y bitácora ------------------------
   · TOPE DE CUERPO. Un comunicado real (HTML con firma) ronda
     pocos KB; 512 KB es margen holgado.

   · LÍMITES. Por IP antes de comprobar la sesión (30/min: la
     puerta pública de solicitud-materiales vive aquí), y por
     gestor después (20/min). En memoria de ESTA instancia.

   · TIPOS. Lista cerrada: lo que no está en la lista no se
     reenvía, ni aunque la sesión sea buena. Así una función
     nueva del panel no convierte esto en un relay genérico.

   · UNA ENTRADA EN `auditoria` POR LLAMADA CON SESIÓN. Solo
     tipo, destinatarios y resultado: el cuerpo lleva correos y
     textos de alumnos y no le compete a la bitácora. Las
     llamadas sin sesión no se anotan (sin autor fiable). */
const VENTANA_MS = 60_000
const MAX_CUERPO = 512 * 1024
const LIMITE_USUARIO = 20
const LIMITE_IP = 30

const TIPOS_PUBLICOS = new Set(['solicitud-materiales'])
const TIPOS = new Set([
  'ping',
  'aviso',
  'recurso-nuevo',
  'modulo-abierto',
  'comunicado-masivo',
  'solicitud-materiales',
])

type Cubeta = { inicio: number; n: number; anotoLimite: boolean }
const cubetas = new Map<string, Cubeta>()

/** Igual que en las otras dos funciones: una cubeta por clave y
    ventana; `primeraVez` evita anotar un renglón por petición. */
const apuntar = (clave: string, max: number) => {
  const ahora = Date.now()
  if (cubetas.size > 500) {
    for (const [k, v] of cubetas) if (ahora - v.inicio >= VENTANA_MS) cubetas.delete(k)
  }
  let c = cubetas.get(clave)
  if (!c || ahora - c.inicio >= VENTANA_MS) {
    c = { inicio: ahora, n: 0, anotoLimite: false }
    cubetas.set(clave, c)
  }
  c.n += 1
  if (c.n <= max) return { rechazado: false, primeraVez: false }
  const primeraVez = !c.anotoLimite
  c.anotoLimite = true
  return { rechazado: true, primeraVez }
}

const FALTAN_EN_AUDITORIA = new Set(['42P01', '42703', '42883', 'PGRST205'])

/* La URL del Apps Script vive como secreto (CORREO_URL). El
   respaldo escrito es la misma que ya está publicada en
   src/config.js —no es un secreto: el agujero era la falta de
   secreto, no la URL— y sirve para que al dueño solo le haga
   falta configurar CORREO_SECRETO. */
const CORREO_URL_RESPALDO =
  'https://script.google.com/macros/s/AKfycbwPLMNkKPnU0xRVgtqk55vCMLP-n2BOPNCwC4-Jr37x005RgdTfdGKJCAK0K8yDjNY_fw/exec'

type Operacion = 'CORREO' | 'INTENTO'
type Salida = (o: {
  cuerpo: Record<string, unknown>
  status: number
  operacion: Operacion
  titulo?: string
  despues?: Record<string, unknown>
  anotar?: boolean
}) => Promise<Response>
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (Number(req.headers.get('content-length') || 0) > MAX_CUERPO) {
    return responder({ error: 'El cuerpo de la petición es demasiado grande.' }, 413)
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  if (ip && apuntar(`ip:${ip}`, LIMITE_IP).rechazado) {
    return responder({ error: 'Demasiadas llamadas desde esta conexión. Espera un minuto.' }, 429)
  }

  let salidaParaElCatch: Salida | null = null

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    /* --- 1. ¿Quién llama? --- */
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const { data: quien } = token
      ? await admin.auth.getUser(token).catch(() => ({ data: null as any }))
      : { data: null as any }
    const correoGestor = quien?.user?.email ? String(quien.user.email).toLowerCase() : ''
    const autorId = quien?.user?.id as string | undefined

    /* Una entrada en `auditoria` por llamada con sesión. Como en
       las otras funciones: nunca tumba la llamada. */
    const salir: Salida = async (o) => {
      if (o.anotar !== false) {
        const aviso = typeof o.cuerpo.error === 'string' ? o.cuerpo.error : ''
        const { error: eBit } = await admin.from('auditoria').insert({
          tabla: 'correo-enviar',
          registro_id: null,
          operacion: o.status >= 400 ? 'INTENTO' : o.operacion,
          autor_id: autorId ?? null,
          autor_email: correoGestor || null,
          antes: null,
          despues: { titulo: o.titulo || aviso || 'Llamada', http: o.status, ...(o.despues ?? {}) },
          cambios: null,
        })
        if (eBit) {
          console.error(
            FALTAN_EN_AUDITORIA.has(eBit.code || '')
              ? 'No pude anotar en auditoria: falta correr supabase/BITACORA.sql — ' + eBit.message
              : 'No pude anotar en auditoria: ' + eBit.message,
          )
        }
      }
      return responder(o.cuerpo, o.status)
    }
    salidaParaElCatch = salir

    /* --- 2. Qué se pide --- */
    const crudo = await req.text().catch(() => '')
    if (crudo.length > MAX_CUERPO) {
      return await salir({ cuerpo: { error: 'El cuerpo de la petición es demasiado grande.' }, status: 413, operacion: 'INTENTO' })
    }
    let cuerpo: any = {}
    try { cuerpo = JSON.parse(crudo || '{}') } catch { cuerpo = {} }
    if (!cuerpo || typeof cuerpo !== 'object') cuerpo = {}

    const tipo = limpiarTexto(cuerpo.tipo, 40)
    if (!TIPOS.has(tipo)) {
      return await salir({
        cuerpo: { error: `Tipo de correo no reconocido: «${tipo || '(vacío)'}».` },
        status: 400,
        operacion: 'INTENTO',
      })
    }

    /* --- 3. Permiso --- */
    let payloadEnviar: Record<string, unknown>

    if (!correoGestor) {
      /* Sin sesión: existe UN caso, el formulario público del
         taller. Y no se reenvía lo que llegó: se rearma con lo
         poco que hace falta, para que nadie mande asuntos ni
         cuerpos arbitrarios por esta puerta. */
      if (!TIPOS_PUBLICOS.has(tipo)) {
        return responder({ error: 'Falta la sesión. Vuelve a entrar al panel.' }, 401)
      }
      const email = limpiarCorreo(cuerpo.email)
      if (!esCorreo(email)) {
        return responder({ error: 'El correo no es válido.' }, 400)
      }
      payloadEnviar = {
        tipo,
        curso: { titulo: limpiarTexto(cuerpo?.curso?.titulo, 200) },
        email,
      }
    } else {
      const tope = apuntar(`gestor:${autorId}`, LIMITE_USUARIO)
      if (tope.rechazado) {
        return await salir({
          cuerpo: { error: `Límite de ${LIMITE_USUARIO} llamadas por minuto alcanzado. Espera un minuto y vuelve a intentarlo.` },
          status: 429,
          operacion: 'INTENTO',
          anotar: tope.primeraVez,
        })
      }

      // El correo es cosa de gestión: admins o facilitadores. El
      // alumnado no envía correos desde el panel, y hoy no debe.
      const [{ data: filasAdmin, error: eA }, { data: filasFac, error: eF }] = await Promise.all([
        admin.from('admins').select('email').ilike('email', correoGestor).limit(1),
        admin.from('facilitadores').select('email').ilike('email', correoGestor).limit(1),
      ])
      if (eA || eF) {
        return await salir({
          cuerpo: { error: 'No pude comprobar tu permiso: ' + (eA || eF)!.message },
          status: 500,
          operacion: 'INTENTO',
        })
      }
      if (!filasAdmin?.length && !filasFac?.length) {
        return await salir({
          cuerpo: { error: `${correoGestor} no puede mandar correos desde el panel (no es administrador ni facilitador).` },
          status: 403,
          operacion: 'INTENTO',
        })
      }

      // Con sesión buena, el payload se reenvía tal cual: quien
      // llama ya es personal del taller y el panel le pone los
      // mismos filtros de siempre (sanear, límite de alumnos…).
      payloadEnviar = cuerpo
    }

    /* --- 4. El secreto y el Apps Script --- */
    const secreto = Deno.env.get('CORREO_SECRETO')
    if (!secreto) {
      return await salir({
        cuerpo: {
          error: 'Falta configurar el secreto CORREO_SECRETO en la función (Supabase → Edge Functions → Secrets). El correo NO se envió.',
        },
        status: 500,
        operacion: 'INTENTO',
        anotar: correoGestor ? undefined : false,
      })
    }
    const url = Deno.env.get('CORREO_URL') || CORREO_URL_RESPALDO

    const cuerpoApps = new URLSearchParams()
    cuerpoApps.set('payload', JSON.stringify(payloadEnviar))
    cuerpoApps.set('secreto', secreto)

    const rApps = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: cuerpoApps.toString(),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null)

    if (!rApps) {
      return await salir({
        cuerpo: {
          error: 'El servidor de correo no respondió (timeout o red). Puede que sí se haya enviado; revisa Gmail antes de reintentar.',
        },
        status: 504,
        operacion: 'INTENTO',
        anotar: correoGestor ? undefined : false,
      })
    }

    const texto = await rApps.text().catch(() => '')
    let datos: any
    try { datos = JSON.parse(texto) } catch { datos = null }
    if (!datos || typeof datos !== 'object') {
      return await salir({
        cuerpo: {
          error: 'El servidor de correo contestó con un formato desconocido: el Notificador.gs desplegado es anterior a v5. Hay que pegar el .gs nuevo y publicar Nueva versión.',
        },
        status: 502,
        operacion: 'INTENTO',
        anotar: correoGestor ? undefined : false,
      })
    }

    /* --- 5. Bitácora y respuesta --- */
    if (!correoGestor || tipo === 'ping') {
      // Sin sesión no hay autor que anotar; y el ping es la
      // comprobación de salud, no una noticia.
      return responder(datos)
    }

    const destinatarios = Array.isArray((payloadEnviar as any)?.alumnos)
      ? (payloadEnviar as any).alumnos.length
      : ((payloadEnviar as any)?.email ? 1 : 0)
    const okHttp = datos.ok !== false && !datos.error
    return await salir({
      cuerpo: datos,
      status: okHttp ? 200 : 502,
      operacion: 'CORREO',
      titulo: okHttp
        ? `${tipo}: ${destinatarios} destinatario(s)`
        : `${tipo} rechazado: ${datos.error || datos.motivo || 'error del script'}`,
      despues: { tipo, destinatarios, ...(okHttp ? {} : { motivo: datos.error || datos.motivo || null }) },
    })
  } catch (e) {
    const cuerpo = { error: 'Error inesperado: ' + ((e as Error).message || String(e)) }
    if (salidaParaElCatch) return salidaParaElCatch({ cuerpo, status: 500, operacion: 'INTENTO' })
    return responder(cuerpo, 500)
  }
})



