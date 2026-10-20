import { hasPermission } from './permissions.js'

export function getDashboardGuidance(user) {
  const role = user?.role
  if (role === 'direccion_pasmu' || role === 'direccion') {
    return {
      title: 'Perspectiva de dirección',
      summary: 'Usa este resumen para orientar preguntas de gestión; valida tendencias y definiciones en Reportes antes de tomar decisiones.',
      principles: [
        'Las cifras corresponden solo al contexto y los permisos visibles en esta sesión.',
        'Un conteo operativo no explica por sí solo causas, calidad clínica ni resultados de intervención.',
        'La comparación entre periodos requiere la misma definición, alcance y método de captura.'
      ]
    }
  }

  if (user?.role !== 'coordinador_pasu') {
    return {
      title: 'Resumen de contexto',
      summary: 'Este tablero presenta únicamente conteos agregados disponibles para tu sesión.',
      principles: [
        'El alcance depende del contexto activo y de los permisos efectivos en la base.',
        'Los conteos no sustituyen el flujo de trabajo del módulo correspondiente.',
        'No se muestran datos de personas usuarias en este resumen.'
      ]
    }
  }

  return {
    title: 'Perspectiva de coordinación',
    summary: 'Utiliza los módulos autorizados para organizar la revisión operativa y dar seguimiento con los equipos responsables.',
    principles: [
      'Confirma los pendientes con el equipo en los flujos operativos disponibles; este resumen no asigna tareas.',
      'Las mediciones sin meta o repetidas son señales para validar, no errores confirmados.',
      'Mantén la revisión agregada aquí; consulta datos de caso solo dentro del módulo y permiso correspondiente.'
    ]
  }
}

export function getDashboardActions(user) {
  const actions = [
    { permission: 'casos.ver', to: '/casos', label: 'Revisar casos autorizados' },
    { permission: 'agenda.ver', to: '/agenda', label: 'Consultar agenda' },
    { permission: 'reportes.ver', to: '/reportes', label: 'Revisar indicadores y reportes' }
  ]

  return actions.filter((action) => hasPermission(user, action.permission))
}
