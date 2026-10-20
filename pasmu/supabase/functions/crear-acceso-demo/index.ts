// Crea (o actualiza) la cuenta de Auth de una persona para la versión DEMO con la contraseña asignada
// y la vincula a la unidad DEMO con vigencia. Solo Dirección PASMU / administración global.
// Despliegue: supabase functions deploy crear-acceso-demo
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function contrasenaTemporal() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const autorizacion = req.headers.get('Authorization')
  if (!autorizacion) return responder({ error: 'Se requiere sesión.' }, 401)

  const quien = createClient(url, anon, { global: { headers: { Authorization: autorizacion } } })
  const { data: puede, error: errorPermiso } = await quien.rpc('pasmu_puede_gestionar_demo')
  if (errorPermiso || puede !== true) return responder({ error: 'Solo Dirección PASMU gestiona los accesos DEMO.' }, 403)

  let cuerpo: { email?: string; nombre?: string; password?: string; dias?: number; perfiles?: string[] }
  try { cuerpo = await req.json() } catch { return responder({ error: 'Cuerpo inválido.' }, 400) }
  const email = String(cuerpo.email || '').trim().toLowerCase()
  const nombre = String(cuerpo.nombre || '').trim()
  const dias = Number(cuerpo.dias ?? 30)
  const perfiles = Array.isArray(cuerpo.perfiles) ? cuerpo.perfiles.map(String) : []
  const password = String(cuerpo.password || '').trim() || contrasenaTemporal()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return responder({ error: 'El correo no es válido.' }, 400)
  if (nombre.length < 2) return responder({ error: 'Escribe el nombre de la persona.' }, 400)
  if (password.length < 10) return responder({ error: 'La contraseña debe tener al menos 10 caracteres.' }, 400)

  const admin = createClient(url, servicio)
  const { data: creada, error: errorCrear } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  let reutilizada = false
  if (errorCrear) {
    if (!/already|registered|exists/i.test(errorCrear.message)) return responder({ error: errorCrear.message }, 400)
    // Ya existe: solo se le cambia la contraseña si ya es una cuenta DEMO (la RPC lo comprueba al vincular).
    const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existente = lista?.users.find((u) => u.email?.toLowerCase() === email)
    if (!existente) return responder({ error: 'No se pudo localizar la cuenta existente.' }, 400)
    const { data: previa } = await admin.from('personas').select('id').eq('auth_user_id', existente.id).maybeSingle()
    if (previa) {
      const { data: otros } = await admin.from('miembros').select('id, roles(codigo)').eq('persona_id', previa.id).eq('activo', true)
      if ((otros || []).some((m: { roles: { codigo: string } | null }) => m.roles?.codigo !== 'experiencia_demo')) {
        return responder({ error: 'Esa cuenta ya es institucional; usa otra cuenta para la DEMO.' }, 400)
      }
    }
    const { error: errorActualizar } = await admin.auth.admin.updateUserById(existente.id, { password })
    if (errorActualizar) return responder({ error: errorActualizar.message }, 400)
    reutilizada = true
  }

  const { data: miembro, error: errorRegistro } = await quien.rpc('pasmu_registrar_acceso_demo', {
    _email: email, _nombre: nombre, _dias: dias, _perfiles: perfiles
  })
  if (errorRegistro) {
    if (creada?.user) await admin.auth.admin.deleteUser(creada.user.id) // no dejar una cuenta huérfana
    return responder({ error: errorRegistro.message }, 400)
  }
  return responder({ ok: true, miembro, email, password, vigenciaDias: dias, reutilizada })
})
