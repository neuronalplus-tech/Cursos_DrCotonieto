# Plan de implementación progresiva para PASMU

> **Documento de referencia histórica.** Este esquema inicial fue replanteado
> y ya no es la hoja de ruta vigente. El plan rector es
> [PLAN_MAESTRO_PASMU.md](./PLAN_MAESTRO_PASMU.md); la evaluación de las
> propuestas del inventario está en
> [VALORACION_INVENTARIO_PASMU.md](./VALORACION_INVENTARIO_PASMU.md).
> Se conserva este archivo para dejar constancia de la evolución del proyecto.

## 1. Visión general

La implementación del PASMU debe ocurrir en fases, con una base institucional mínima que permita crecer de forma segura. No se debe construir toda la plataforma de golpe ni mezclar requisitos clínicos, administrativos e institucionales sin una separación clara de dominio.

La estrategia recomendada es:

- resolver primero identidad, roles y permisos,
- luego atender casos y agenda,
- después expediente y documentación,
- finalmente indicadores, reportes y controles institucionales.

## 2. Metodología

Se propone una metodología incremental con:

- pruebas funcionales por módulo,
- validación de permisos y acceso,
- auditoría y trazabilidad en cada fase,
- revisión del diseño con usuarios de operación y coordinación,
- validación del impacto institucional antes de abrir nuevos módulos.

## 3. Fase 0 — diagnóstico y preparación

### Objetivo

Establecer la base operativa y técnica del proyecto.

### Entregables

- definición del alcance institucional
- arquitectura base del sistema
- modelo de datos inicial
- estructura de repositorio y entorno
- decisiones de seguridad y autenticación
- lista de riesgos y supuestos

### Evidencia mínima

- repositorio independiente del proyecto educativo
- variables de entorno definidas
- proyecto React + Supabase con base técnica estable
- reglas de trabajo con documentación y control de cambios

## 4. Fase 1 — identidad institucional y acceso

### Objetivo

Crear la base para distinguir identidad de permisos.

### Componentes

- cuentas de autenticación
- perfiles de persona
- instituciones y unidades
- miembros, roles y permisos
- asignación por unidad y programa
- auditoría mínima de accesos

### Resultados esperados

- cada persona puede tener una cuenta y varios roles
- cada acceso queda vinculado a una unidad o servicio
- los permisos no dependen sólo de `esAdmin`
- se puede crear una base sólida para el resto del sistema

### Riesgos a controlar

- demasiados permisos globales
- perfiles sin contexto institucional
- permisos por rol que no reflejen la operación real

## 5. Fase 2 — administración y operación

### Objetivo

Dar servicio a la administración institucional del PASMU.

### Componentes

- unidades de atención
- servicios y programas
- profesionales y practicantes
- líneas de intervención
- configuración de calendario
- administradores y supervisores

### Resultados esperados

- la coordinación puede operar desde un panel de administración
- los servicios quedan organizados por unidad y programa
- la asignación de personal se hace con trazabilidad

## 6. Fase 3 — atención y casos

### Objetivo

Permitir la operación de identificación, admisión, cita y seguimiento de personas usuarias.

### Componentes

- personas usuarias
- admitidos y casos
- agenda y citas
- canalizaciones
- citas recurrentes
- estado del caso
- alta, baja, reactivación y cierre

### Resultados esperados

- cada caso queda asociado a una persona usuaria y una unidad
- la cita y la atención son trazables
- el proceso de atención puede seguirse con claridad

## 7. Fase 4 — expediente y documentos

### Objetivo

Registrar la información clínica y documental de un proceso de atención con controles de acceso.

### Componentes

- episodios de atención
- notas clínicas
- documentos y consentimientos
- archivos seguros
- acceso por confidencialidad
- trazabilidad de cambios

### Reglas clave

- no todo el personal debe ver todo
- el contenido clínico debe estar minimizado y auditado
- la subida de archivos debe seguir reglas de seguridad y almacenamiento

## 8. Fase 5 — indicadores y evaluación institucional

### Objetivo

Activar la evaluación del PASMU con indicadores de operación y resultados.

### Componentes

- catálogo de indicadores
- metas por periodo
- resultados por unidad, programa o servicio
- dashboards institucionales
- reportes para coordinación y dirección
- control de calidad, cobertura y trazabilidad de cada periodo

### Mecanismos de control y seguimiento

La pantalla actual es de consulta. El avance `valor/meta`, la comparación del
mes anterior, las metas ausentes y las posibles capturas repetidas son señales
descriptivas sobre las filas visibles; no equivalen a una evaluación de mejora,
un cierre institucional ni una confirmación de error. No se deben inferir
periodos faltantes mientras cada indicador no tenga una frecuencia esperada.

Antes de habilitar captura se debe completar una ficha versionada por
indicador con, al menos:

- definición, propósito y vínculo con el marco lógico;
- fórmula, numerador/denominador y unidad de medida;
- dirección esperada (ascendente, descendente o intervalo) y reglas explícitas
  de interpretación;
- frecuencia, periodo esperado, fecha límite y tolerancia de cierre;
- fuente, responsable de captura y responsable de validación;
- nivel de desagregación autorizado, límites de privacidad y tamaño mínimo de
  grupo cuando haya riesgo de reidentificación;
- metas por unidad/programa/periodo, vigencia y responsable de aprobación.

El seguimiento operativo deberá distinguir `pendiente`, `capturado`,
`requiere revisión`, `validado` y `cerrado`, con avisos de periodos vencidos,
metas sin asignar, valores fuera de rango y capturas repetidas. La validación
debe guardar quién revisó y cuándo. Las correcciones conservarán valor previo,
nuevo valor, motivo y actor mediante auditoría; no se sobrescribirán en silencio.
Los avisos no incluirán datos clínicos identificables ni convertirán por sí
solos una métrica agregada en una alerta clínica.

Estos controles requieren una migración revisada para definición/frecuencia/
dirección/vigencia, una captura mediante RPC o servicio autorizado, privilegios
mínimos y auditoría append-only, y pruebas RLS con varias identidades. Hasta
que se aprueben esos controles, mantener la app conectada en solo lectura y no
capturar información real.

### Vistas por responsabilidad institucional

La misma plataforma debe apoyar decisiones distintas sin dar a cada perfil un
tablero indiscriminado:

| Perspectiva | Decisión o necesidad | Vista futura apropiada | Límite de diseño |
| --- | --- | --- | --- |
| Dirección | Priorizar recursos, revisar resultados y rendición de cuentas | Tendencias agregadas, metas aprobadas, calidad de dato y fecha de cierre | Sin identidades ni detalle clínico; separar resultado observado de causalidad |
| Coordinación | Organizar capacidad, cobertura operativa y revisión de periodos | Colas de trabajo verificables, agenda y estado de captura/validación | Una métrica agregada no crea tareas ni asigna responsables por sí sola |
| Terapeuta/profesional | Preparar citas y dar continuidad segura a casos asignados | Agenda y tareas clínicas dentro de permisos por caso, con trazabilidad | No usar indicadores gerenciales para inferir riesgo o desempeño individual |
| Persona usuaria del servicio | Comprender su atención, acuerdos y siguientes pasos | En el futuro, canal separado para citas, información propia, consentimiento y derechos | No es una cuenta de personal; sin portal aprobado no exponer expediente ni prometer autoservicio |

La vista actual implementa solo un resumen agregado para roles autorizados de
Dirección/Coordinación y enlaces a módulos permitidos. No sustituye una cola de
trabajo de Coordinación ni el flujo de continuidad clínica del profesional. El
portal de personas usuarias queda fuera del alcance funcional implementado y
requiere diseño de identidad, consentimiento, accesibilidad, privacidad y
atención de solicitudes antes de abrirlo.

### Estado orientativo del plan

Este corte describe lo que está implementado en el prototipo; no es una
declaración de aceptación institucional ni autorización para operar datos
reales.

| Fase | Estado del prototipo | Brecha antes de declarar salida |
| --- | --- | --- |
| 0. Preparación | Arquitectura, repositorio independiente y documentación inicial | Validar alcance y responsables institucionales |
| 1. Identidad y acceso | Supabase Auth, memberships/roles/permisos y RLS base en SQL | Ejecutar verificador actualizado y probar matriz con distintas identidades/contextos |
| 2. Administración y operación | Catálogos y modelo SQL inicial | Interfaces y flujos administrativos auditados aún no habilitados |
| 3. Atención y casos | Lectura de casos/agenda protegida por permisos/RLS | Altas, modificaciones, estados y auditoría todavía no habilitados en web |
| 4. Expediente y documentos | Lectura limitada del expediente según permisos/asignación | Escrituras, Storage, consentimiento y pruebas clínicas reales pendientes |
| 5. Indicadores | Catálogo, mediciones, metas, filtros, agregados descriptivos y CSV | Ficha metodológica, frecuencia, captura/revisión/cierre auditados y aceptación operativa |
| 6. Seguridad y preparación operativa | Endurecimiento inicial de grants/RLS y diagnóstico SQL | Storage, observabilidad, revisión periódica, autorización con cuentas múltiples y respuesta a incidentes |

La prioridad gerencial no es agregar más tarjetas, sino cerrar brechas que
hacen confiables las decisiones: definiciones versionadas, cobertura esperada,
responsable y fecha de actualización, validación de cifras, privacidad por
tamaño de grupo y trazabilidad desde el dato agregado hasta su fuente
autorizada.

### Resultados esperados

- la coordinación puede evaluar cumplimiento y evolución
- los indicadores quedan enlazados con el marco lógico
- se pueden generar reportes para decisiones institucionales
- las alertas explican el dato y el ámbito visible sin atribuir causalidad
- el cierre de cada periodo es verificable y las correcciones son trazables

## 9. Fase 6 — seguridad, auditoría y hardening

### Objetivo

Fortalecer la seguridad del sistema y dejarlo preparado para trabajo institucional real.

### Componentes

- auditoría de seguridad
- permisos de acceso por caso/servicio
- revisión periódica de permisos
- alerts y eventos críticos
- logs de cambios y accesos
- limpieza de datos y observabilidad

### Requisitos mínimos

- acceso sensible auditado
- permisos verificables en base de datos
- políticas por contexto
- no hay datos clínicos en errores visibles para usuarios finales

## 10. Criterios de salida por fase

Cada fase se considera exitosa cuando:

- la funcionalidad corre en ambiente de desarrollo
- las políticas de acceso están validadas
- los datos críticos quedan auditados
- los flujos clave tienen pruebas mínimas
- el equipo de operación lo acepta con evidencia real

## 11. Riesgos del plan

### Riesgo 1: avanzar sin separar identidad y clínica

Consecuencia:

- acceso incorrecto a datos sensibles
- combinaciones de permisos que no representan la realidad

Mitigación:

- definir desde inicio el diseño de personas, roles, miembros y permisos

### Riesgo 2: construir demasiados módulos a la vez

Consecuencia:

- aumento de errores
- falta de trazabilidad
- costos de corregir diseño tarde

Mitigación:

- implementar por fases y validar cada bloque individualmente

### Riesgo 3: confiar en la UI para la seguridad

Consecuencia:

- brechas funcionales
- acceso desde clientes no autorizados

Mitigación:

- validación en base de datos con RLS y políticas de negocio

## 12. Resumen

El plan recomendado para PASMU prioriza estabilidad institucional, control de acceso y trazabilidad. La secuencia de fases evita sobrecargar el desarrollo y deja preparado el sistema para crecer con la operación real, los indicadores y la responsabilidad institucional.
