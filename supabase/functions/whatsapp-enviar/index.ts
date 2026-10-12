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

type Destino = { numero: string; nombre?: string; texto?: string; variables?: string[] }
type Resultado = { numero: string; ok: boolean; motivo?: string }

/** Solo dígitos: es lo único que acepta la API de Meta. */
const soloDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

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

    const { data: filasAdmin, error: eA } = await admin
      .from('admins').select('email').ilike('email', correoAdmin)
    if (eA) return responder({ error: 'No pude comprobar tu permiso: ' + eA.message }, 500)
    if (!filasAdmin || filasAdmin.length === 0) {
      return responder({ error: `${correoAdmin} no puede enviar comunicados.` }, 403)
    }

    /* --- 2. ¿Está configurado el Cloud API? ---
       Se contesta 200 y no un error: para el panel «no configurado»
       no es un fallo, es el estado normal mientras uses los enlaces. */
    const cuerpo = await req.json().catch(() => ({}))
    if (cuerpo.accion === 'estado' || !token || !phoneId) {
      return responder({
        configurado: !!(token && phoneId),
        motivo: token && phoneId
          ? null
          : 'Faltan los secretos WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en Supabase → Edge Functions → Secrets.',
      })
    }

    /* --- 3. A quién y qué --- */
    const destinos: Destino[] = Array.isArray(cuerpo.destinos) ? cuerpo.destinos : []
    if (destinos.length === 0) return responder({ error: 'No hay destinatarios.' }, 400)
    if (destinos.length > 200) {
      return responder({ error: `${destinos.length} destinatarios de una vez es demasiado. Divide en tandas.` }, 400)
    }
    const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : ''
    const plantilla = typeof cuerpo.plantilla === 'string' ? cuerpo.plantilla.trim() : ''
    const idioma = typeof cuerpo.idioma === 'string' && cuerpo.idioma ? cuerpo.idioma : 'es_MX'
    if (!texto && !plantilla) return responder({ error: 'No hay mensaje que enviar.' }, 400)

    /* --- 4. Uno por uno, diciendo la verdad de cada uno ---
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
    return responder({
      configurado: true,
      enviados,
      fallidos: resultados.length - enviados,
      resultados,
    })
  } catch (e) {
    return responder({ error: (e as Error).message }, 500)
  }
})
