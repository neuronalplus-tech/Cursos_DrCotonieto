import { supabase } from '../lib/supabase'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase no está configurado.')
  }

  return supabase
}

export async function signIn(email, password) {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithPassword({ email, password })

  if (error) throw error
}

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()

  if (error) throw error
}

export async function loadPasmuUser(authUser) {
  const client = requireSupabase()
  const { data: person, error: personError } = await client
    .from('personas')
    .select('id, nombre, apellidos')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (personError) throw personError
  if (!person) {
    throw new Error('Tu cuenta de Auth todavía no está vinculada a un perfil PASMU activo.')
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: memberships, error: membershipError } = await client
    .from('miembros')
    .select('id, unidad_id, programa_id, rol_id, unidades(codigo, nombre), programas(codigo, nombre)')
    .eq('persona_id', person.id)
    .eq('activo', true)
    .lte('fecha_inicio', today)
    .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    .order('id', { ascending: true })

  if (membershipError) throw membershipError
  if (!memberships?.length) {
    throw new Error('Tu perfil no tiene una membresía institucional vigente.')
  }

  const roleIds = [...new Set(memberships.map((membership) => membership.rol_id))]
  const [rolesResult, permissionsResult] = await Promise.all([
    client.from('roles')
      .select('id, codigo, nombre')
      .in('id', roleIds)
      .eq('activo', true),
    client.from('rol_permisos')
      .select('rol_id, permisos(codigo, activo)')
      .in('rol_id', roleIds)
  ])
  const { data: roles, error: roleError } = rolesResult
  const { data: rolePermissions, error: permissionError } = permissionsResult
  if (roleError) throw roleError
  if (permissionError) throw permissionError
  const rolesById = new Map((roles || []).map((role) => [String(role.id), role]))
  const permissionsByRoleId = new Map()
  for (const assignment of rolePermissions || []) {
    if (assignment.permisos?.activo !== true || !assignment.permisos.codigo) continue
    const roleId = String(assignment.rol_id)
    const current = permissionsByRoleId.get(roleId) || []
    current.push(assignment.permisos.codigo)
    permissionsByRoleId.set(roleId, current)
  }
  const contexts = memberships.flatMap((membership) => {
    const roleId = String(membership.rol_id)
    const role = rolesById.get(roleId)
    if (!role) return []

    return [{
      membershipId: membership.id,
      roleId: role.id,
      role: role.codigo,
      roleName: role.nombre,
      unitId: membership.unidad_id,
      unit: membership.unidades?.codigo || membership.unidades?.nombre || '',
      programId: membership.programa_id,
      program: membership.programas?.codigo || membership.programas?.nombre || '',
      permissions: permissionsByRoleId.get(roleId) || []
    }]
  })
  if (!contexts.length) {
    throw new Error('Tu perfil no tiene una membresía vigente con un rol activo.')
  }

  const activeContext = contexts[0]
  return {
    id: person.id,
    authUserId: authUser.id,
    name: [person.nombre, person.apellidos].filter(Boolean).join(' '),
    ...activeContext,
    contexts
  }
}
