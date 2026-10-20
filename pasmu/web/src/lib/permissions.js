export const ROLES = {
  experiencia_demo: {
    name: 'Experiencia DEMO',
    permissions: ['dashboard.ver', 'casos.ver', 'agenda.ver', 'expediente.ver', 'reportes.ver', 'perfil.ver']
  },
  direccion_pasmu: {
    name: 'Dirección PASMU',
    permissions: ['dashboard.ver', 'reportes.ver', 'reportes.exportar', 'admin.auditoria', 'admin.unidades']
  },
  responsable_unidad: {
    name: 'Responsable de unidad',
    permissions: ['dashboard.ver', 'casos.ver', 'casos.crear', 'casos.editar', 'agenda.ver', 'agenda.programar', 'expediente.ver', 'reportes.ver', 'reportes.exportar', 'admin.unidades', 'admin.roles']
  },
  coordinador_clinico: {
    name: 'Coordinador clínico',
    permissions: ['dashboard.ver', 'casos.ver', 'casos.crear', 'casos.editar', 'agenda.ver', 'agenda.programar', 'expediente.ver', 'reportes.ver', 'reportes.exportar']
  },
  supervisor_clinico: {
    name: 'Supervisor clínico',
    permissions: ['casos.ver', 'expediente.ver', 'agenda.ver', 'reportes.ver', 'supervision.revisar', 'supervision.comentar']
  },
  terapeuta: {
    name: 'Terapeuta',
    permissions: ['casos.ver', 'casos.editar', 'agenda.ver', 'agenda.programar', 'expediente.ver', 'expediente.editar', 'expediente.documentos']
  },
  coterapeuta: {
    name: 'Co-terapeuta',
    permissions: ['casos.ver', 'agenda.ver', 'expediente.ver', 'expediente.editar']
  },
  clinico_administrativo: {
    name: 'Clínico-administrativo',
    permissions: ['agenda.ver', 'agenda.programar', 'casos.ver', 'expediente.estado']
  },
  tallerista: {
    name: 'Tallerista',
    permissions: ['agenda.ver', 'casos.ver', 'expediente.estado']
  },
  persona_usuaria: {
    name: 'Persona usuaria',
    permissions: ['miportal.ver', 'miportal.tareas', 'miportal.notas']
  },
  // Compatibilidad con catálogo anterior (demo + seed 05 ya aplicado)
  coordinador_pasu: {
    name: 'Coordinador PASMU (legado)',
    permissions: ['dashboard.ver', 'casos.ver', 'casos.crear', 'casos.editar', 'agenda.ver', 'agenda.programar', 'expediente.ver', 'reportes.ver', 'reportes.exportar', 'admin.unidades', 'admin.roles', 'admin.auditoria']
  },
  psicologo: {
    name: 'Psicólogo (legado → terapeuta)',
    permissions: ['casos.ver', 'casos.editar', 'agenda.ver', 'agenda.programar', 'expediente.ver', 'expediente.editar', 'expediente.documentos']
  },
  supervisor: {
    name: 'Supervisor (legado)',
    permissions: ['casos.ver', 'expediente.ver', 'agenda.ver', 'reportes.ver']
  },
  practicante: {
    name: 'Practicante (legado → clínico-administrativo)',
    permissions: ['casos.ver', 'agenda.ver', 'expediente.ver']
  },
  administrativo: {
    name: 'Administrativo (legado)',
    permissions: ['agenda.ver', 'agenda.programar', 'casos.ver']
  },
  analista_indicadores: {
    name: 'Analista de indicadores',
    permissions: ['reportes.ver', 'reportes.exportar']
  },
  direccion: {
    name: 'Dirección (legado)',
    permissions: ['dashboard.ver', 'reportes.ver', 'reportes.exportar', 'admin.auditoria']
  },
  seguridad: {
    name: 'Seguridad',
    permissions: ['seguridad.ver', 'admin.auditoria']
  }
}

export const ROLE_ORDER = [
  'direccion_pasmu', 'responsable_unidad', 'coordinador_clinico', 'supervisor_clinico',
  'terapeuta', 'coterapeuta', 'clinico_administrativo', 'tallerista', 'persona_usuaria',
  'experiencia_demo',
]

export const USERS = {
  experiencia_demo: { name: 'Exploración DEMO (solo lectura)', role: 'experiencia_demo', unit: 'DEMO' },
  direccion: { name: 'Dirección PASMU (demo)', role: 'direccion_pasmu', unit: 'UAP' },
  responsable: { name: 'Responsable unidad (demo)', role: 'responsable_unidad', unit: 'UAP' },
  coordinador: { name: 'Coordinación clínica (demo)', role: 'coordinador_clinico', unit: 'UAP' },
  supervisor: { name: 'Supervisión clínica (demo)', role: 'supervisor_clinico', unit: 'UAP' },
  terapeuta: { name: 'Terapeuta (demo)', role: 'terapeuta', unit: 'UAP' },
  coterapeuta: { name: 'Co-terapeuta (demo)', role: 'coterapeuta', unit: 'UAP' },
  administrativo: { name: 'Clínico-administrativo (demo)', role: 'clinico_administrativo', unit: 'UAP' },
  tallerista: { name: 'Tallerista (demo)', role: 'tallerista', unit: 'UAP' },
  usuaria: { name: 'Persona usuaria (demo)', role: 'persona_usuaria', unit: 'UAP' },
  // Legados para no romper demo anterior
  coord: { name: 'Marta López', role: 'coordinador_pasu', unit: 'UAP' },
  psicologo: { name: 'Ana Ruiz', role: 'psicologo', unit: 'UAP' },
  admin: { name: 'Nora Vega', role: 'administrativo', unit: 'UAP' },
  analista: { name: 'Pablo Ruiz', role: 'analista_indicadores', unit: 'UAP' },
  seguridad: { name: 'Elena Sánchez', role: 'seguridad', unit: 'UAP' }
}

// Cuenta auditora demo: ve cada rol con su vista diferenciada.
export const AUDIT_ACCOUNT_EMAIL = 'ernesto_cotonieto@uaeh.edu.mx'

// Rol de exploración por invitación: solo lectura. No tiene .crear/.editar/.exportar/.admin.
export const DEMO_SESSION_MINUTES = 15;

export function isExperienciaDemo(user) {
  const role = user?.role || user?.contexts?.[0]?.role;
  return role === 'experiencia_demo';
}

export function createDemoSession(user, minutes = DEMO_SESSION_MINUTES) {
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  return {
    ...user,
    demo: {
      expiresAt,
      mode: "preview",
      note: `Solo lectura · no se guarda ni sincroniza · sesión expira en ${minutes} minutos.`,
      expiresAtDisplay: new Date(expiresAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    }
  };
}

export function isDemoSessionActive(user, now = Date.now()) {
  if (!user?.demo?.expiresAt) return false;
  return new Date(user.demo.expiresAt).getTime() > now;
}

export function isReadOnlyDemo(user, now = Date.now()) {
  return isExperienciaDemo(user) && isDemoSessionActive(user, now);
}


export function hasPermission(user, permission) {
  if (!user || typeof permission !== 'string' || permission.length === 0) return false
  if (user.authUserId) {
    return Array.isArray(user.permissions) && user.permissions.includes(permission)
  }

  const permissions = user.permissions || ROLES[user.role]?.permissions || []
  return permissions.includes(permission)
}

export function canAccessRoute(user, route) {
  const permissionsByRoute = {
    dashboard: 'dashboard.ver',
    casos: 'casos.ver',
    caso: 'casos.ver',
    agenda: 'agenda.ver',
    expediente: 'expediente.ver',
    expediente_revisiones: 'supervision.revisar',
    expediente_exportar: 'expediente.ver',
    reportes: 'reportes.ver',
    seguridad: 'seguridad.ver'
  }
  if (route === 'admin') {
    return hasPermission(user, user?.authUserId ? 'configuracion.ver' : 'admin.roles')
  }
  if (route === 'revisiones') {
    return hasPermission(user, 'supervision.revisar') || hasPermission(user, 'supervision.comentar')
  }
  if (route === 'exportar') {
    // ACC-09: ver no autoriza exportar. El rol demo no tiene reportes.exportar.
    if (isExperienciaDemo(user)) return false
    return hasPermission(user, 'reportes.exportar')
  }
  if (route === 'perfil') {
    // Ver perfil propio está abierto a cualquier persona autenticada.
    // Editar requiere `perfil.editar` explícito.
    if (!user?.authUserId && !isExperienciaDemo(user)) {
      return false
    }
    return true
  }
  if (route === 'chat') {
    return hasPermission(user, 'chat.leer')
  }
  const requiredPermission = permissionsByRoute[route]
  return requiredPermission ? hasPermission(user, requiredPermission) : false
}
