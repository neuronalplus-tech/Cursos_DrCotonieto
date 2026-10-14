/* ============================================================
   ALTA DE USUARIOS  ·  función del servidor (Supabase Edge)
   ------------------------------------------------------------
   Sirve para el alta individual y para la masiva: la individual es
   una lista de un elemento. Una sola función en vez de dos evita
   que una se arregle y la otra se quede atrás, que es más o menos
   lo que nos pasó.

   POR QUÉ CORRE AQUÍ Y NO EN EL NAVEGADOR
   Crear cuentas exige la clave de servicio, y esa clave no puede
   salir nunca al navegador: quien la tenga puede hacer cualquier
   cosa con la base saltándose todas las políticas. Aquí está a
   salvo, y la pone Supabase sola en la variable de entorno.

   QUÉ ARREGLA RESPECTO A LA VERSIÓN ANTERIOR

   1. LA COMPROBACIÓN DE PERMISO. La anterior miraba la tabla
      `admins` esperando UNA fila. El multi-inquilino hizo que una
      persona pueda tener varias —una sin organización, que es el
      administrador de la plataforma, y una por cada cliente que
      administre—. Desde ese cambio, el alta fallaba. Aquí basta
      con tener al menos una fila, del tipo que sea.

   2. CONFIRMA EL CORREO AL CREAR (`email_confirm: true`). Si la
      cuenta nace sin confirmar y el proyecto exige confirmación,
      la persona no puede entrar aunque la contraseña sea correcta,
      y el error que ve parece de contraseña equivocada.

   3. COMPRUEBA LO QUE HIZO. Vuelve a leer la cuenta después de
      crearla en vez de fiarse de la respuesta. El fallo que nos
      trajo aquí duró tres semanas porque algo contestaba "listo"
      sin mirar.

   4. NORMALIZA EL CORREO. El formulario de acceso siempre envía en
      minúsculas y sin espacios; si la cuenta se crea con una
      mayúscula, nadie podrá teclear esa dirección igual.

   5. FRENOS Y BITÁCORA (F6-2). Cada llamada con sesión deja una
      entrada en `auditoria`; hay tope de 30 llamadas por
      administrador/minuto y de 128 KB de cuerpo. Si falta correr
      supabase/BITACORA.sql, la consola lo avisa y el alta sigue:
      la bitácora nunca tumba la llamada.

   CÓMO SE INSTALA
   Supabase -> Edge Functions -> Deploy a new function
     · Nombre EXACTO: crear-usuarios
     · Pega este archivo completo y despliega.
   No hace falta configurar ninguna clave: SUPABASE_URL y
   SUPABASE_SERVICE_ROLE_KEY ya existen dentro de las funciones.

   Requiere haber corrido antes supabase/USUARIOS_ALTA.sql.
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

/* --- F6-2 · frenos y bitácora --------------------------------
   Tres defensas que no dependen de que nadie se acuerde:

   · TOPE DE CUERPO. Un JSON enorme obliga a cargarlo entero en
     memoria antes de mirarlo. Se corta dos veces: por la cabecera
     Content-Length si la trae, y después sobre lo leído, porque la
     cabecera puede faltar en transferencias por trozos.

   · LÍMITE POR ADMINISTRADOR/MINUTO. Contadores en memoria de ESTA
     instancia: si Supabase reparte entre varias, cada una aplica la
     suya — el tope efectivo puede ser mayor, nunca menor que uno.
     Se borran al desplegar y no se persiste a propósito: es un
     freno, no una policía.

   · UNA ENTRADA EN `auditoria` POR LLAMADA. La escribe la función
     con la clave de servicio; desde el navegador sigue sin poder
     escribirse. Las llamadas sin sesión válida no se anotan: sin
     autor fiable, cualquier anónimo de internet llenaría la tabla. */
const VENTANA_MS = 60_000
const MAX_CUERPO = 128 * 1024   // el mayor padrón legítimo ronda los 60 KB
const LIMITE_ADMIN = 30         // un padrón de 200 correos son 8 llamadas
const LIMITE_IP = 120

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

type Operacion = 'ALTA' | 'ENLACE' | 'INTENTO'
type Salida = (o: {
  cuerpo: Record<string, unknown>
  status: number
  operacion: Operacion
  /** Se usa si `cuerpo.error` no sirve de título. */
  titulo?: string
  /** Detalle extra para la bitácora; NUNCA el cuerpo completo (lleva contraseñas). */
  despues?: Record<string, unknown>
  /** false = no dejar renglón (429 repetidos). */
  anotar?: boolean
}) => Promise<Response>

type Resultado = { email: string; status: string; mensaje: string; id?: string }

/* A dónde manda el enlace de recuperación después de verificarlo.

   Se acepta el origen que pide el panel para poder probar el flujo desde
   una vista previa o desde el equipo de desarrollo, pero solo de una lista
   cerrada: `redirect_to` llega del navegador, y si se pasara tal cual
   cualquiera podría generar un enlace que entrega la sesión de
   recuperación a un sitio suyo. Lo que no esté en la lista cae al sitio
   de producción, que es el que está dado de alta en Supabase
   (Authentication → URL Configuration → Redirect URLs). */
const DESTINO_PRODUCCION = 'https://cursos-drcotonieto.neuronal-plus.workers.dev/recuperar'
const HOSTS_RECUPERACION = [
  'cursos-drcotonieto.neuronal-plus.workers.dev',
  'localhost',
  '127.0.0.1',
]

const destinoRecuperacion = (crudo: unknown) => {
  if (!crudo) return DESTINO_PRODUCCION
  try {
    const url = new URL(String(crudo))
    const permitido = HOSTS_RECUPERACION.includes(url.hostname)
    if (!permitido || url.pathname !== '/recuperar') return DESTINO_PRODUCCION
    return url.origin + '/recuperar'
  } catch {
    return DESTINO_PRODUCCION
  }
}

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
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    /* --- 1. ¿Quién llama, y puede? --- */
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return responder({ error: 'Falta la sesión. Vuelve a entrar al panel.' }, 401)

    const { data: quien, error: eU } = await admin.auth.getUser(token)
    if (eU || !quien?.user?.email) {
      return responder({ error: 'Tu sesión caducó. Vuelve a entrar al panel.' }, 401)
    }
    const correoAdmin = quien.user.email.toLowerCase()
    const autorId = quien.user.id

    /* Una entrada en `auditoria` por llamada (F6-2). Nunca tumba la
       llamada: si falta la tabla u otro error de escritura, se avisa
       por consola —con el script que falta— y se contesta igual. */
    const salir: Salida = async (o) => {
      if (o.anotar !== false) {
        const aviso = typeof o.cuerpo.error === 'string' ? o.cuerpo.error : ''
        const { error: eBit } = await admin.from('auditoria').insert({
          tabla: 'crear-usuarios',
          registro_id: null,
          // Un fallo no es un alta: los 4xx/5xx se anotan como intento.
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

    // Límite por admin/minuto (F6-2). El padrón del panel son 8
    // llamadas de 25 correos; 30 deja margen para repetir sin esperar.
    const tope = apuntar(`admin:${autorId}`, LIMITE_ADMIN)
    if (tope.rechazado) {
      return await salir({
        cuerpo: { error: `Límite de ${LIMITE_ADMIN} llamadas por minuto alcanzado. Espera un minuto y vuelve a intentarlo.` },
        status: 429,
        operacion: 'INTENTO',
        anotar: tope.primeraVez,
      })
    }

    // Varias filas son normales y no son un error. No usar .single().
    const { data: filasAdmin, error: eA } = await admin
      .from('admins').select('email, organizacion_id').ilike('email', correoAdmin)

    if (eA) return await salir({ cuerpo: { error: 'No pude comprobar tu permiso: ' + eA.message }, status: 500, operacion: 'INTENTO' })
    if (!filasAdmin || filasAdmin.length === 0) {
      return await salir({
        cuerpo: { error: `${correoAdmin} no aparece en la tabla admins, así que no puede dar de alta.` },
        status: 403,
        operacion: 'INTENTO',
      })
    }

    /* --- 2. Qué se pide --- */
    // Segunda redada del tope de cuerpo (F6-2): la cabecera pudo
    // faltar. Se cuenta en caracteres; los límites llevan margen.
    const crudo = await req.text().catch(() => '')
    if (crudo.length > MAX_CUERPO) {
      return await salir({ cuerpo: { error: 'El cuerpo de la petición es demasiado grande.' }, status: 413, operacion: 'INTENTO' })
    }
    let cuerpo: any = {}
    try { cuerpo = JSON.parse(crudo || '{}') } catch { cuerpo = {} }
    if (!cuerpo || typeof cuerpo !== 'object') cuerpo = {}

    // Los enlaces de recuperación se generan en servidor para que no
    // dependan del verificador PKCE guardado en el navegador del docente:
    // el alumno abre el correo en su propio dispositivo.
    if (cuerpo.accion === 'enlace-recuperacion') {
      const email = limpiarCorreo(cuerpo.email)
      if (!esCorreo(email)) {
        return await salir({ cuerpo: { error: 'El correo no es válido.' }, status: 400, operacion: 'INTENTO' })
      }

      // El enlace SE DEVUELVE al navegador que llama, así que vale tanto
      // como la contraseña de esa cuenta: quien lo recibe puede entrar.
      // Por eso una cuenta que también administra solo puede pedir el suyo,
      // salvo que quien llame sea administrador de la plataforma. Sin esto,
      // el responsable de cualquier cliente podría pedir el enlace de tu
      // cuenta y quedarse con el panel entero.
      if (email !== correoAdmin) {
        const esPlataforma = filasAdmin.some(
          (f: { organizacion_id: number | null }) => f.organizacion_id === null,
        )
        if (!esPlataforma) {
          const { data: objetivoAdmin, error: eO } = await admin
            .from('admins').select('email').ilike('email', email).limit(1)
          if (eO) return await salir({ cuerpo: { error: 'No pude comprobar la cuenta destino: ' + eO.message }, status: 500, operacion: 'INTENTO' })
          if (objetivoAdmin && objetivoAdmin.length > 0) {
            return await salir({
              cuerpo: { error: `${email} administra el sitio. Solo esa persona puede pedir su propio enlace.` },
              status: 403,
              operacion: 'INTENTO',
            })
          }
        }
      }

      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: destinoRecuperacion(cuerpo.redirect_to) },
      })
      if (error) return await salir({ cuerpo: { error: 'No se pudo generar el enlace: ' + error.message }, status: 400, operacion: 'INTENTO' })
      const actionLink = data?.properties?.action_link
      if (!actionLink) {
        return await salir({ cuerpo: { error: 'Supabase no devolvió un enlace de recuperación.' }, status: 502, operacion: 'INTENTO' })
      }
      return await salir({
        cuerpo: { action_link: actionLink },
        status: 200,
        operacion: 'ENLACE',
        titulo: `Enlace de recuperación generado para ${email}`,
        // El enlace mismo NO se anota: vale tanto como la contraseña.
        despues: { email, destino: destinoRecuperacion(cuerpo.redirect_to) },
      })
    }

    const lista: unknown[] = Array.isArray(cuerpo.emails)
      ? cuerpo.emails
      : (cuerpo.email ? [cuerpo.email] : [])
    const password = String(cuerpo.password ?? '').trim()
    const cursoIds: number[] = Array.isArray(cuerpo.curso_ids)
      ? cuerpo.curso_ids.map(Number).filter((n: number) => Number.isFinite(n))
      : []

    if (!lista.length) return await salir({ cuerpo: { error: 'No mandaste ningún correo.' }, status: 400, operacion: 'INTENTO' })
    if (lista.length > 200) return await salir({ cuerpo: { error: 'Máximo 200 correos por llamada.' }, status: 400, operacion: 'INTENTO' })
    if (password.length < 6) {
      return await salir({ cuerpo: { error: 'La contraseña debe tener al menos 6 caracteres.' }, status: 400, operacion: 'INTENTO' })
    }

    /* --- 3. Alta, una por una --- */
    const resultados: Resultado[] = []

    for (const crudo of lista) {
      const email = limpiarCorreo(crudo)
      if (!esCorreo(email)) {
        resultados.push({ email: String(crudo ?? ''), status: 'error', mensaje: 'No parece un correo.' })
        continue
      }

      let id: string | null = null
      let status = 'creado'

      const { data: creado, error: eC } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      })

      if (eC) {
        const m = (eC.message || '').toLowerCase()
        const yaExiste = m.includes('already') || m.includes('registered') || m.includes('duplicate')
        if (!yaExiste) {
          resultados.push({ email, status: 'error', mensaje: eC.message || 'No se pudo crear.' })
          continue
        }
        status = 'existente'
      } else {
        id = creado?.user?.id ?? null
      }

      // Se lee de vuelta SIEMPRE. Es lo único que distingue
      // "creado" de "creí que lo creaba".
      if (!id) {
        const { data: encontrado, error: eB } = await admin
          .rpc('usuario_id_por_correo', { p_email: email })
        if (eB) {
          resultados.push({ email, status: 'error', mensaje: 'No pude buscar la cuenta: ' + eB.message })
          continue
        }
        id = (encontrado as string | null) ?? null
      }
      if (!id) {
        resultados.push({
          email, status: 'error',
          mensaje: 'La cuenta no aparece después de crearla. Revísala en Authentication → Users.',
        })
        continue
      }

      // Si ya existía, se le pone la contraseña nueva: es lo que
      // espera quien acaba de escribirla en el panel.
      if (status === 'existente') {
        await admin.auth.admin.updateUserById(id, { password, email_confirm: true })
      }

      /* --- 4. Inscripciones: solo las que falten --- */
      if (cursoIds.length) {
        const { data: ya, error: eY } = await admin
          .from('acceso').select('curso_id').eq('usuario_id', id).in('curso_id', cursoIds)
        if (eY) {
          resultados.push({ email, id, status, mensaje: 'Cuenta lista, pero no pude leer sus cursos: ' + eY.message })
          continue
        }
        const tiene = new Set((ya || []).map((r: { curso_id: number }) => Number(r.curso_id)))
        const faltan = cursoIds.filter((c) => !tiene.has(Number(c)))

        if (faltan.length) {
          const { error: eI } = await admin
            .from('acceso').insert(faltan.map((c) => ({ usuario_id: id, curso_id: c })))
          if (eI) {
            // El tope de alumnos del plan se distingue porque no se
            // arregla reintentando: hay que ampliar el plan.
            const sinCupo = /tope de \d+ alumnos/i.test(eI.message || '')
            resultados.push({
              email, id,
              status: sinCupo ? 'sin_cupo' : 'error',
              mensaje: sinCupo ? eI.message : 'Cuenta lista, pero falló la inscripción: ' + eI.message,
            })
            continue
          }
        }
      }

      resultados.push({
        email, id, status,
        mensaje: status === 'creado'
          ? 'Cuenta creada e inscrita.'
          : 'Ya tenía cuenta; se actualizó su contraseña y se le dio acceso.',
      })
    }

    const creados = resultados.filter((r) => r.status === 'creado').length
    const existentes = resultados.filter((r) => r.status === 'existente').length
    const errores = resultados.filter((r) => r.status === 'error' || r.status === 'sin_cupo').length

    // Un alta de una sola persona que falla debe FALLAR, no
    // contestar 200 con un error escondido dentro.
    const fallaSolo = lista.length === 1 && errores === 1

    return await salir({
      cuerpo: {
        creados,
        existentes,
        errores,
        resultados,
        // Lo que lee el alta individual.
        email: resultados[0]?.email ?? null,
        id: resultados[0]?.id ?? null,
        ...(fallaSolo ? { error: resultados[0].mensaje } : {}),
      },
      status: fallaSolo ? 400 : 200,
      operacion: 'ALTA',
      titulo: fallaSolo
        ? resultados[0].mensaje
        : `${lista.length} correo(s): ${creados} creada(s), ${existentes} existente(s), ${errores} con error`,
      despues: { creados, existentes, errores, resultados },
    })

  } catch (e) {
    const cuerpo = { error: 'Error inesperado: ' + ((e as Error).message || String(e)) }
    // Si la sesión ya se había comprobado, el fallo también deja
    // renglón; si no, no hay autor y no se anota (ver cabecera).
    if (salidaParaElCatch) return salidaParaElCatch({ cuerpo, status: 500, operacion: 'INTENTO' })
    return responder(cuerpo, 500)
  }
})
