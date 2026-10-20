# PASMU — Plan operativo de demostración de valor

**Versión 1.0 · 18-oct-2026 · Prototipo con datos sintéticos. Sin datos reales.**

## 0. Qué demuestra y qué no
Demuestra: navegación por rol, gestión de casos/agenda, monitoreo agregado,
trazabilidad de decisiones y usabilidad diferenciada terapeuta ↔ coordinación ↔
dirección ↔ persona usuaria (futura). No demuestra: eficacia clínica, cobertura
real, desempeño individual ni cumplimiento normativo.
Lectura obligada antes de la demo: `PLAN_MAESTRO_PASMU.md §7`,
`MATRIZ_ACEPTACION_PASMU.md §2-4`, `FICHAS_INDICADORES_PASMU.md §7`,
`DESCUBRIMIENTO_PASMU.md §7` (límites vigentes).

## 1. Guion navegable (15 min, 8 usuarios demo en `lib/permissions.js:USERS`)
1. **Coordinación (Marta López):** `/login` → `/dashboard` (3 conteos + ámbito) →
   `/casos` (buscar/filtrar + crear caso controlado `SIN-xxxxxxxx`) →
   `/agenda` (semana) → `/reportes` (filtros + CSV) → `/admin` (borrador local, enviar a revisión simulada).
2. **Psicólogo (Ana Ruiz):** `/casos` → `/expediente?casoId=` (ficha + historial) →
   crear nota vía RPC `pasmu_nota_crear` (solo caso asignado; negativa si no asignado).
3. **Supervisor (Luis García):** `/casos` + `/expediente` (solo lectura asignados) + `/reportes`.
4. **Dirección (Jorge Cárdenas):** `/dashboard` perspectiva dirección + `/reportes`
   (agregado, sin drill-down a caso/terapeuta).
5. **Negativas en vivo:** sin sesión → redirect `/login`; rol sin permiso → `/sin-acceso`;
   crear caso sin `casos.crear` → 42501; nota sin asignación → 42501; URL de otra unidad → denegado.


## 2. Utilidad para gestión (coordinación/administración)
- Ver: casos visibles por unidad/programa/estado, agenda 7 días, mediciones del mes.
- Hacer: crear caso controlado (motivo genérico 5-500, sin PII), programar agenda vía
  RPC (valida rango), proponer cambio operativo en `/admin` (borrador → revisión).
- Falta para operar real: altas con identidad, estados aprobados, canalizaciones,
  practicantes/horas, Storage consentimientos, auditoría redactada.
- Criterio demo: coordinador crea, filtra y exporta sin ver PII ajena ni nota no asignada.

## 3. Monitoreo y toma de decisiones (dirección/analista/supervisión)
- Ver: catálogo + mediciones + metas con % avance, variación mes anterior,
  señales sin-meta/duplicado/no-positiva, paginación 200, CSV anti-fórmulas.
- Reglas: periodo + ámbito + fecha + estado visibles; sin ficha no es meta oficial;
  cero distinto de faltante; duplicado es señal; grupo pequeño se suprime;
  agregado nunca evalúa terapeuta individual.
- Falta: ficha versionada, frecuencia/corte, captura/validación/cierre, responsable,
  quiebre de serie, umbral privacidad, finalidad de exportación.
- Criterio: dirección explica qué decisión NO puede tomar con el dato antes de pedir más.

## 4. Usabilidad terapeuta y persona usuaria
- Terapeuta hoy: lista mínima, ficha + última nota + historial, selector casoId,
  errores seguros sin PII/SQL.
- Persona usuaria futura: solo su información, lenguaje claro, derechos/tiempos/urgencias,
  sin chat/diario/crisis sin responsable. No prometer respuesta inmediata.
- Mejoras demo: breadcrumbs caso-expediente, empty-state con acción, foco en
  #main-content, contraste status-pill, orden tabular estable.
- Criterio: terapeuta completa ver → abrir → registrar nota sin ver casos ajenos.

## 5. Backlog priorizado por valor demo (no construir 248 funciones)
- P0 demo creíble: breadcrumbs + empty-states accionables + foco; formulario programar
  agenda en UI (ya existe RPC); formulario nota en expediente (ya existe RPC);
  vista `vista_auditoria_redactada` en `/seguridad` para rol seguridad/dirección.
- P1 decisión confiable: ficha mínima visible por indicador (dueño/fuente/periodo/estado);
  etiqueta `provisional/validada/cerrada`; supresión grupo pequeño; finalidad en exportación.
- P2 operación trazable: estados de caso aprobados, transferencia con revocación (ACC-11),
  cierre/addendum de notas (no sobrescribir), suplencias/ausencias.
- Explícitamente NO en demo: portal paciente autenticado, mensajería, crisis/triaje/IA,
  pagos/SaaS, rankings, Storage clínico sin políticas, SMTP masivo.
- Cada P0-P2 con caso ACC/IND/CFG de `MATRIZ_ACEPTACION` y prueba negativa.

## 6. Puertas antes de mostrar a dirección y antes de datos reales
- Demo a dirección: guion §1 + negativas §1.5 + lectura §3 en voz alta; acta con
  qué NO se puede decidir aún; sin prometer cobertura ni ranking.
- Datos reales: `08` en OK/0 tras 04+09+10+11; RLS multicuenta (ACC-03/04/11);
  Storage por bucket; respaldo/restauración probada; aprobaciones dirección/clínico/
  privacidad-jurídico/tec-seguridad (`DESPLIEGUE §28-34` + `DESCUBRIMIENTO §8`).
- Actualizados hoy: `INDICE_PASMU.md` (este plan + cambios 18-oct).
  Vigentes sin cambio: `PLAN_MAESTRO` (rector), `PLAN_FASES` (histórico),
  `VALORACION` (filtro 248), resto como plantilla/cuaderno.

