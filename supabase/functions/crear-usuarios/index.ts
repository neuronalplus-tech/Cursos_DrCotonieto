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

type Resultado = { email: string; status: string; mensaje: string; id?: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

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

    // Varias filas son normales y no son un error. No usar .single().
    const { data: filasAdmin, error: eA } = await admin
      .from('admins').select('email, organizacion_id').ilike('email', correoAdmin)

    if (eA) return responder({ error: 'No pude comprobar tu permiso: ' + eA.message }, 500)
    if (!filasAdmin || filasAdmin.length === 0) {
      return responder({
        error: `${correoAdmin} no aparece en la tabla admins, así que no puede dar de alta.`,
      }, 403)
    }

    /* --- 2. Qué se pide --- */
    const cuerpo = await req.json().catch(() => ({}))
    const lista: unknown[] = Array.isArray(cuerpo.emails)
      ? cuerpo.emails
      : (cuerpo.email ? [cuerpo.email] : [])
    const password = String(cuerpo.password ?? '').trim()
    const cursoIds: number[] = Array.isArray(cuerpo.curso_ids)
      ? cuerpo.curso_ids.map(Number).filter((n: number) => Number.isFinite(n))
      : []

    if (!lista.length) return responder({ error: 'No mandaste ningún correo.' }, 400)
    if (lista.length > 200) return responder({ error: 'Máximo 200 correos por llamada.' }, 400)
    if (password.length < 6) {
      return responder({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
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

    return responder({
      creados,
      existentes,
      errores,
      resultados,
      // Lo que lee el alta individual.
      email: resultados[0]?.email ?? null,
      id: resultados[0]?.id ?? null,
      // Un alta de una sola persona que falla debe FALLAR, no
      // contestar 200 con un error escondido dentro.
      ...(lista.length === 1 && errores === 1 ? { error: resultados[0].mensaje } : {}),
    }, lista.length === 1 && errores === 1 ? 400 : 200)

  } catch (e) {
    return responder({ error: 'Error inesperado: ' + ((e as Error).message || String(e)) }, 500)
  }
})
