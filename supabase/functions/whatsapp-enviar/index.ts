/* ============================================================
   ENVÍO POR WHATSAPP  ·  función del servidor (Supabase Edge)
   ------------------------------------------------------------
   El panel sabe mandar WhatsApp de dos maneras, y la diferencia
   entre ellas no es técnica, es de permiso:

   1. ENLACES wa.me (no necesita esta función)
      Abre tu WhatsApp con el mensaje escrito y tú das enviar. No
      pide permiso a nadie porque el mensaje lo mandas tú, con tu
      cuenta, uno por uno. Funciona siempre.

   2. CLOUD API DE META (esta función)
      Manda solo, en bloque. A cambio, Meta exige: una cuenta de
      WhatsApp Business, un número DEDICADO a la API (deja de poder
      usarse en la app del celular), y —esto es lo que más sorprende—
      que un mensaje enviado a quien NO te escribió en las últimas 24
      horas sea una PLANTILLA APROBADA por Meta, no texto libre. Un
      recordatorio de taller a 50 personas que nunca te han escrito
      cae ahí. Y se cobra por conversación.

   Por eso el envío automático no es el camino por defecto: es el que
   enciendes cuando ya tienes el trámite hecho.

   CÓMO SE INSTALA
   Supabase -> Edge Functions -> Deploy a new function
     · Nombre EXACTO: whatsapp-enviar
     · Pega este archivo completo y despliega.
   Luego, en Edge Functions -> Secrets, añade:
     · WHATSAPP_TOKEN      — el token permanente de la app de Meta
     · WHATSAPP_PHONE_ID   — el «Phone number ID» del número emisor
   Mientras no existan esas dos, la función contesta «no configurado»
   y el panel sigue ofreciendo los enlaces wa.me. No se rompe nada.

   QUÉ MANDA
   · Si el panel envía `plantilla`, se manda esa plantilla aprobada
     con sus variables (lo que Meta exige fuera de las 24 h).
   · Si envía `texto`, se manda texto libre. Solo llega a quien te
     escribió hace menos de 24 h; a los demás Meta lo rechaza y aquí
     se devuelve el motivo, persona por persona, sin inventar éxitos.

   F6-2 · Cada llamada con sesión deja una entrada en `auditoria`
   (si falta supabase/BITACORA.sql, la consola lo avisa y el envío
   sigue: la bitácora nunca tumba la llamada). Hay tope de 10
   llamadas por administrador/minuto —la consulta de `estado` no lo
   consume— y de 1 MB de cuerpo.
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

/** Para `ilike` como igualdad sin mayúsculas: `_` y `%` son comodines
    y un correo con `_` (válido) coincidiría con otros que no son él. */
const patronExacto = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c)

type Destino = { numero: string; nombre?: string; texto?: string; variables?: string[] }
type Resultado = { numero: string; ok: boolean; motivo?: string }

/** Solo dígitos: es lo único que acepta la API de Meta. */
const soloDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')

/* --- F6-2 · frenos y bitácora --------------------------------
   Misma idea que en crear-usuarios; los números cambian porque un
   envío es una llamada cara: Meta cobra por conversación.

   · TOPE DE CUERPO. Un envío legítimo ronda los 250 KB (200
     destinatarios con su texto personalizado); 1 MB es margen
     holgado y corta los cuerpos gigantes antes de cargarlos.

   · LÍMITE POR ADMIN/MINUTO. En la memoria de ESTA instancia (si
     Supabase reparte, cada una aplica la suya — el tope efectivo
     puede ser mayor, nunca menor que uno). La consulta de `estado`
     no consume cupo: es lo que hace el panel al abrir, barato, y
     frenarla solo dejaría el botón en «no desplegada».

   · UNA ENTRADA EN `auditoria` POR LLAMADA, también en `estado`.
     Las llamadas sin sesión no se anotan: sin autor fiable, cualquier
     anónimo de internet llenaría la tabla. */
const VENTANA_MS = 60_000
const MAX_CUERPO = 1024 * 1024
const LIMITE_ADMIN = 10          // un envío por clic; el estado no consume
const LIMITE_IP = 60

type Cubeta = { inicio: number; n: number; anotoLimite: boolean }
const cubetas = new Map<string, Cubeta>()

/** Apunta una llamada a la cubeta de `clave`. `rechazado` = pasó del
    tope; `primeraVez` = el rechazo de esta ventana todavía no se
    anotó, para que un bombardeo cueste un renglón por minuto, no uno
    por petición. */
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

/** Códigos con los que PostgrES se niega a escribir en `auditoria`
    porque falta correr supabase/BITACORA.sql (o cambió la tabla). */
const FALTAN_EN_AUDITORIA = new Set(['42P01', '42703', '42883', 'PGRST205'])

type Operacion = 'ENVIO' | 'ESTADO' | 'INTENTO'
type Salida = (o: {
  cuerpo: Record<string, unknown>
  status: number
  operacion: Operacion
  /** Se usa si `cuerpo.error` no sirve de título. */
  titulo?: string
  /** Detalle extra para la bitácora; NUNCA el cuerpo completo (lleva teléfonos y textos). */
  despues?: Record<string, unknown>
  /** false = no dejar renglón (429 repetidos). */
  anotar?: boolean
}) => Promise<Response>

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Tope de cuerpo (F6-2) antes de leer nada: si la cabecera falta
  // o miente, la redada se repite sobre lo leído, más abajo.
  if (Number(req.headers.get('content-length') || 0) > MAX_CUERPO) {
    return responder({ error: 'El cuerpo de la petición es demasiado grande.' }, 413)
  }

  // Tope por IP antes de comprobar la sesión: comprobarla cuesta
  // una llamada al servidor de autenticación. Solo si llega la
  // cabecera x-forwarded-for; sin ella no se junta a todos los que
  // llaman en una sola cubeta.
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  if (ip && apuntar(`ip:${ip}`, LIMITE_IP).rechazado) {
    return responder({ error: 'Demasiadas llamadas desde esta conexión. Espera un minuto.' }, 429)
  }

  // Si la sesión se comprueba, `salir` se encarga de anotar cada
  // llamada en la bitácora antes de contestar; el catch de abajo
  // también la usa si el fallo venía después.
  let salidaParaElCatch: Salida | null = null

  try {
    const token = Deno.env.get('WHATSAPP_TOKEN')
    const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    /* --- 1. ¿Quién llama, y puede? --- */
    const sesion = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!sesion) return responder({ error: 'Falta la sesión. Vuelve a entrar al panel.' }, 401)

    const { data: quien, error: eU } = await admin.auth.getUser(sesion)
    if (eU || !quien?.user?.email) {
      return responder({ error: 'Tu sesión caducó. Vuelve a entrar al panel.' }, 401)
    }
    const correoAdmin = quien.user.email.toLowerCase()
    const autorId = quien.user.id

    /* Una entrada en `auditoria` por llamada (F6-2), también en la
       consulta de `estado`. Nunca tumba la llamada: si falta la
       tabla u otro error de escritura, se avisa por consola —con el
       script que falta— y se contesta igual. */
    const salir: Salida = async (o) => {
      if (o.anotar !== false) {
        const aviso = typeof o.cuerpo.error === 'string' ? o.cuerpo.error : ''
        const { error: eBit } = await admin.from('auditoria').insert({
          tabla: 'whatsapp-enviar',
          registro_id: null,
          // Un fallo no es un envío: los 4xx/5xx se anotan como intento.
          operacion: o.status >= 400 ? 'INTENTO' : o.operacion,
          autor_id: autorId,
          autor_email: correoAdmin,
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

    /* --- 2. El cuerpo, con su tope (F6-2) --- */
    // La cabecera Content-Length pudo faltar: la redada se repite
    // sobre lo leído. En caracteres; los límites llevan margen.
    const crudo = await req.text().catch(() => '')
    if (crudo.length > MAX_CUERPO) {
      return await salir({ cuerpo: { error: 'El cuerpo de la petición es demasiado grande.' }, status: 413, operacion: 'INTENTO' })
    }
    let cuerpo: any = {}
    try { cuerpo = JSON.parse(crudo || '{}') } catch { cuerpo = {} }
    if (!cuerpo || typeof cuerpo !== 'object') cuerpo = {}
    const esEstado = cuerpo.accion === 'estado'

    // Límite por admin/minuto (F6-2). `estado` quedó fuera: es lo
    // que hace el panel al abrir, es barato, y frenarlo solo dejaría
    // el botón en «no desplegada».
    if (!esEstado) {
      const tope = apuntar(`admin:${autorId}`, LIMITE_ADMIN)
      if (tope.rechazado) {
        return await salir({
          cuerpo: { error: `Límite de ${LIMITE_ADMIN} llamadas por minuto alcanzado. Espera un minuto y vuelve a intentarlo.` },
          status: 429,
          operacion: 'INTENTO',
          anotar: tope.primeraVez,
        })
      }
    }

    const { data: filasAdmin, error: eA } = await admin
      .from('admins').select('email').ilike('email', patronExacto(correoAdmin))
    if (eA) return await salir({ cuerpo: { error: 'No pude comprobar tu permiso: ' + eA.message }, status: 500, operacion: 'INTENTO' })
    if (!filasAdmin || filasAdmin.length === 0) {
      return await salir({ cuerpo: { error: `${correoAdmin} no puede enviar comunicados.` }, status: 403, operacion: 'INTENTO' })
    }

    /* --- 3. ¿Está configurado el Cloud API? ---
       Se contesta 200 y no un error: para el panel «no configurado»
       no es un fallo, es el estado normal mientras uses los enlaces. */
    if (esEstado || !token || !phoneId) {
      const configurado = !!(token && phoneId)
      return await salir({
        cuerpo: {
          configurado,
          motivo: configurado
            ? null
            : 'Faltan los secretos WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en Supabase → Edge Functions → Secrets.',
        },
        status: 200,
        operacion: esEstado ? 'ESTADO' : 'INTENTO',
        titulo: esEstado
          ? (configurado ? 'Cloud API de Meta: configurada' : 'Cloud API de Meta: sin configurar')
          : 'Envío automático sin configurar (faltan secretos de Meta)',
        despues: { configurado },
      })
    }

    /* --- 4. A quién y qué --- */
    const destinos: Destino[] = Array.isArray(cuerpo.destinos) ? cuerpo.destinos : []
    if (destinos.length === 0) return await salir({ cuerpo: { error: 'No hay destinatarios.' }, status: 400, operacion: 'INTENTO' })
    if (destinos.length > 200) {
      return await salir({ cuerpo: { error: `${destinos.length} destinatarios de una vez es demasiado. Divide en tandas.` }, status: 400, operacion: 'INTENTO' })
    }
    const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : ''
    const plantilla = typeof cuerpo.plantilla === 'string' ? cuerpo.plantilla.trim() : ''
    const idioma = typeof cuerpo.idioma === 'string' && cuerpo.idioma ? cuerpo.idioma : 'es_MX'
    if (!texto && !plantilla) return await salir({ cuerpo: { error: 'No hay mensaje que enviar.' }, status: 400, operacion: 'INTENTO' })

    /* --- 5. Uno por uno, diciendo la verdad de cada uno ---
       En bloque no se puede: la API de Meta es de un mensaje por
       llamada, y si se contara "50 enviados" cuando 12 fallaron, el
       panel estaría mintiendo sobre quién recibió el aviso. */
    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`
    const resultados: Resultado[] = []

    for (const d of destinos) {
      const numero = soloDigitos(d.numero)
      if (numero.length < 11) {
        resultados.push({ numero: String(d.numero ?? ''), ok: false, motivo: 'Número incompleto' })
        continue
      }

      // El texto de cada destino manda sobre el general: viene ya con
      // el nombre de esa persona sustituido.
      const cuerpoTexto = (d.texto && d.texto.trim()) || texto
      const mensaje = plantilla
        ? {
            messaging_product: 'whatsapp',
            to: numero,
            type: 'template',
            template: {
              name: plantilla,
              language: { code: idioma },
              ...(d.variables?.length
                ? {
                    components: [{
                      type: 'body',
                      parameters: d.variables.map(v => ({ type: 'text', text: String(v ?? '') })),
                    }],
                  }
                : {}),
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: numero,
            type: 'text',
            text: { preview_url: true, body: cuerpoTexto },
          }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(mensaje),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json?.messages?.length) {
          resultados.push({ numero, ok: true })
        } else {
          resultados.push({
            numero,
            ok: false,
            motivo: json?.error?.message || `Meta respondió ${res.status}`,
          })
        }
      } catch (e) {
        resultados.push({ numero, ok: false, motivo: (e as Error).message })
      }
    }

    const enviados = resultados.filter(r => r.ok).length
    const fallidos = resultados.length - enviados
    return await salir({
      cuerpo: { configurado: true, enviados, fallidos, resultados },
      status: 200,
      operacion: 'ENVIO',
      titulo: `${enviados} de ${resultados.length} WhatsApp enviados` + (fallidos ? `, ${fallidos} con error` : ''),
      despues: { destinatarios: resultados.length, plantilla: plantilla || null, enviados, fallidos, resultados },
    })
  } catch (e) {
    const cuerpo = { error: (e as Error).message }
    // Si la sesión ya se había comprobado, el fallo también deja
    // renglón; si no, no hay autor y no se anota (ver cabecera).
    if (salidaParaElCatch) return salidaParaElCatch({ cuerpo, status: 500, operacion: 'INTENTO' })
    return responder(cuerpo, 500)
  }
})
