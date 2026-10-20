export const dashboardMetrics = [
  { label: 'Casos activos', value: '128', detail: 'Conteo simulado; no implica prioridad clínica.' },
  { label: 'Registros de agenda hoy', value: '34', detail: 'Conteo simulado; puede incluir distintos estados.' },
  { label: 'Mediciones registradas del mes', value: '18', detail: 'Conteo simulado; no representa cobertura esperada.' }
]

export const casos = [
  { id: 'demo-1', paciente: 'María A.', unidad: 'UAP', estado: 'En seguimiento', responsable: 'Ana Ruiz', prioridad: 'Alta' },
  { id: 'demo-2', paciente: 'José P.', unidad: 'UAP', estado: 'Abierto', responsable: 'Marta López', prioridad: 'Media' },
  { id: 'demo-3', paciente: 'Lucía T.', unidad: 'UAP', estado: 'Cerrado', responsable: 'Sofía Méndez', prioridad: 'Baja' },
  { id: 'demo-4', paciente: 'Carlos V.', unidad: 'UAP', estado: 'En evaluación', responsable: 'Luis García', prioridad: 'Alta' }
]

export const agenda = [
  { hora: '09:00', titulo: 'Evaluación inicial', responsable: 'Ana Ruiz', tipo: 'Psicología' },
  { hora: '11:30', titulo: 'Seguimiento de caso', responsable: 'Marta López', tipo: 'Coordinación' },
  { hora: '15:00', titulo: 'Taller preventivo', responsable: 'Coordinación', tipo: 'Grupo' },
  { hora: '17:00', titulo: 'Revisión de expediente', responsable: 'Sofía Méndez', tipo: 'Documentación' }
]

export const expediente = {
  paciente: 'María A.',
  motivo: 'Ansiedad y síntomas de agotamiento',
  ultimaNota: '15/10/2026 — seguimiento de riesgo y plan de intervención.',
  datos: [
    { etiqueta: 'Edad', valor: '28 años' },
    { etiqueta: 'Unidad', valor: 'UAP' },
    { etiqueta: 'Estado', valor: 'En seguimiento' },
    { etiqueta: 'Prioridad', valor: 'Alta' }
  ],
  historial: [
    'Consulta inicial realizada con evaluación psicosocial completa.',
    'Se definió plan de intervención con seguimiento semanal.',
    'Se activó protocolo de apoyo con revisión de riesgo.'
  ]
}

export const reportesKpis = [
  { label: 'Atenciones este mes', value: '482', detail: '92% dentro de tiempo' },
  { label: 'Tasa de continuidad', value: '87%', detail: '↑ 4 puntos' },
  { label: 'Canalizaciones', value: '24', detail: '6 no resueltas' },
  { label: 'Satisfacción', value: '4.7/5', detail: 'Encuesta institucional' }
]

export const reportesTablas = [
  { categoria: 'Atenciones', total: 482, meta: 500 },
  { categoria: 'Derivaciones', total: 24, meta: 30 },
  { categoria: 'Casos cerrados', total: 31, meta: 40 }
]

export const seguridadEventos = [
  { momento: '08:40', evento: 'Acceso exitoso', usuario: 'Ana Ruiz', detalle: 'Ingreso a expediente UAP-102' },
  { momento: '10:10', evento: 'Exportación', usuario: 'Marta López', detalle: 'Reporte mensual descargado' },
  { momento: '12:30', evento: 'Cambio de permisos', usuario: 'Nora Vega', detalle: 'Actualización de rol de coordinador' },
  { momento: '16:00', evento: 'Auditoría', usuario: 'Sistema', detalle: 'Se verificaron accesos de 24 horas' }
]
