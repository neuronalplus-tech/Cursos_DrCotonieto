# PASMU — Gobierno y ficha metodológica de indicadores

**Versión 1.0 · 17 de octubre de 2026 · Plantilla sin valores institucionales**

Este documento no prescribe qué resultados debe perseguir PASMU. Establece
qué información hace falta para que Dirección, Coordinación y responsables de
datos interpreten cada indicador de forma consistente. No completar valores,
metas ni frecuencias por intuición del equipo técnico.
Las fichas aprobadas deberán gestionarse dentro de PASMU como versiones
consultables, con autoría, aprobación y fechas de vigencia; este documento es
una plantilla, no el catálogo operativo definitivo.

## 1. Reglas de gobierno

- Cada indicador tiene un dueño metodológico y una fuente autorizada.
- La definición tiene versión y fecha de vigencia; los cambios no reescriben
  periodos ya cerrados sin una corrección documentada.
- Separar conteo de actividad, acceso/cobertura, calidad de proceso y
  resultados percibidos/clínicos.
- Toda cifra muestra periodo, unidad/ámbito, fecha de actualización y estado
  (provisional, validada o cerrada).
- No comparar periodos si cambia definición, denominador, población,
  cobertura o método; informar ruptura de serie.
- Una meta es un compromiso aprobado, no un valor de referencia inventado.
- No publicar desagregaciones que expongan grupos pequeños o personas.
- No utilizar indicador agregado para diagnóstico, asignación clínica,
  ranking o decisión laboral individual.
- Toda alerta tiene destinatario responsable, plazo y ruta de resolución; si
  no existe capacidad de respuesta, no se activa alerta.
- Exportar es una acción sensible: registrar finalidad y actor cuando la
  operación institucional lo permita.

## 2. Ficha por indicador — duplicar para cada indicador aprobado

### Identidad y propósito

| Campo | Completar por responsable |
| --- | --- |
| Código/nombre oficial | Pendiente |
| Versión de definición/vigencia | Pendiente |
| Objetivo institucional / marco lógico | Pendiente |
| Decisión que informa | Pendiente |
| Dueño metodológico | Pendiente |
| Responsable de fuente/captura | Pendiente |
| Responsable de validación/cierre | Pendiente |
| Audiencia autorizada | Pendiente |

### Definición y cálculo

| Campo | Completar por responsable |
| --- | --- |
| Tipo (actividad/acceso/proceso/resultado) | Pendiente |
| Definición operacional | Pendiente |
| Numerador | Pendiente / no aplica, justificación |
| Denominador | Pendiente / no aplica, justificación |
| Fórmula exacta y reglas de redondeo | Pendiente |
| Unidad de medida | Pendiente |
| Dirección esperada (mayor/menor/rango/no definida) | Pendiente |
| Interpretación permitida y no permitida | Pendiente |
| Fuente y consulta/registro primario | Pendiente |
| Inclusiones, exclusiones y manejo de duplicados | Pendiente |
| Población elegible y criterios de pertenencia | Pendiente |

### Tiempo, metas y calidad

| Campo | Completar por responsable |
| --- | --- |
| Frecuencia esperada | Pendiente |
| Periodo que representa vs fecha de captura | Pendiente |
| Fecha límite/corte de captura | Pendiente |
| Meta y autoridad de aprobación | Pendiente |
| Vigencia de la meta | Pendiente |
| Tolerancia / reglas fuera de rango | Pendiente |
| Completitud y oportunidad mínimas | Pendiente |
| Reconciliación con fuente, muestra y tolerancia | Pendiente |
| Estado de periodo y quién puede cambiarlo | Pendiente |
| Versiones anteriores y regla de ruptura de serie | Pendiente |

### Privacidad, sesgo y uso

| Campo | Completar por responsable |
| --- | --- |
| Nivel de sensibilidad de fuente | Pendiente |
| Desagregaciones autorizadas | Pendiente |
| Umbral mínimo de grupo/supresión | Pendiente por evaluación |
| Riesgo de reidentificación | Pendiente |
| Diferencias de acceso/captura que sesgan la lectura | Pendiente |
| Uso permitido | Pendiente |
| Uso prohibido / decisión que no debe automatizar | Pendiente |
| Retención y audiencia de exportación | Pendiente |
| Fecha, autoridad y evidencia de aprobación | Pendiente |

## 3. Catálogo institucional de indicadores (vacío hasta aprobación)

| Código | Nombre aprobado | Tipo | Frecuencia | Fuente | Dueño | Estado ficha | Estado del periodo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sin indicadores institucionales aprobados en este documento | — | — | — | — | — | — | — |

No convertir los nombres de demo (p. ej. “casos activos” o “mediciones del
mes”) en indicadores oficiales sin validación, definición, denominador,
fuente, alcance y responsable.

## 4. Ciclo del periodo

Estados propuestos para validar con operación:

`no iniciado → pendiente de captura → capturado/provisional → en validación → validado → cerrado`

Rutas de excepción a acordar:

- `requiere corrección`: conservar el valor original, motivo, autor y
  aprobación; emitir nueva versión.
- `no aplica`: conservar motivo y autoridad que confirma la excepción.
- `sin dato/fuente no disponible`: no tratarlo como cero.
- `dato tardío`: conservar periodo observado y fecha real de recepción.
- `definición modificada`: versionar, documentar quiebre y decidir si se
  recalculan retrospectivamente los periodos.

Los estados son un borrador de diseño; responsables institucionales deben
aprobar nombres, transiciones, tiempos y quién puede cerrar.

Una ficha vigente debe poder modificarse sin sobrescribirla: generar una nueva
versión, registrar por qué cambia, identificar a quienes la revisan y aprobar
la fecha desde la que aplica. El sistema debe avisar si el cambio altera
comparabilidad y mantener disponible la definición anterior para interpretar
datos históricos.

## 5. Roles de indicador y separación de funciones

| Acción | Rol posible (por validar) | Control |
| --- | --- | --- |
| Proponer/cambiar definición | Dueño metodológico | Revisión de versión e impacto de serie |
| Capturar/adjuntar evidencia | Responsable de fuente | No valida su propia captura si la segregación es necesaria |
| Validar/reconciliar | Responsable de datos distinto cuando sea viable | Evidencia de fuente, regla y fecha |
| Aprobar meta | Autoridad directiva competente | Vigencia y acta |
| Cerrar periodo | Autoridad que defina gobernanza | Registro de quién/cuándo y excepciones |
| Consultar agregado | Dirección/Coordinación/analista autorizados | Ámbito, supresión y finalidad |
| Exportar | Permiso explícito | Mínimo ámbito, actor, tiempo y finalidad |

## 6. Alertas permitidas solo después de definir operación

Una alerta de calidad puede ser apropiada si hay regla verificable: periodo
esperado no capturado tras fecha límite, meta ausente, valor fuera del rango
definido o discrepancia con la fuente. Cada una necesita:

1. explicación del dato/regla que la activó;
2. responsable y suplente;
3. plazo de revisión y acción permitida;
4. mecanismo para marcar falso positivo/corregir con auditoría;
5. escalación operativa aprobada;
6. prueba de que el contenido de la notificación no revela datos sensibles.

No configurar alerta por riesgo clínico, suicidio, diagnóstico, “estancamiento”
o abandono terapéutico a partir de este marco general.

## 7. Aceptación de un indicador antes de mostrarlo a Dirección

- [ ] definición versionada y aprobación identificable;
- [ ] fórmula reproducible probada con ejemplos sintéticos de borde;
- [ ] fuente reconciliada con muestra independiente;
- [ ] periodo observado separado de fecha de captura;
- [ ] faltantes, ceros, duplicados y denominador especificados;
- [ ] unidad de análisis y cobertura visibles;
- [ ] estado provisional/validado/cerrado disponible;
- [ ] comparación histórica revisada por quiebres metodológicos;
- [ ] privacidad de celdas pequeñas/desagregación revisada;
- [ ] permiso de lectura/exportación y prueba de acceso denegado;
- [ ] audiencia y usos prohibidos comunicados;
- [ ] responsable confirma que el indicador informa la decisión prevista.

## 8. Relación con el prototipo

La pantalla actual consulta `indicadores`, `metas_indicadores` y
`mediciones_indicadores` existentes. Las señales de avance y variación son
aritméticas y descriptivas; no convierten registros existentes en indicadores
aprobados. Antes de captura, se requiere diseño versionado, migración revisada,
RPC/servicio controlado, auditoría y pruebas de autorización. Ver el
[plan maestro](./PLAN_MAESTRO_PASMU.md) y la
[valoración del inventario](./VALORACION_INVENTARIO_PASMU.md).

La consola permite registrar propuestas de cambios en Supabase cuando esté
instalada la migración 09 y asignados los permisos, pero no modifica
directamente indicadores. La gestión persistente de definiciones, metas,
captura, validación y cierre requiere el servicio tipado y seguro descrito en
[Gobierno de cambios PASMU](./GOBIERNO_CAMBIOS_PASMU.md).
