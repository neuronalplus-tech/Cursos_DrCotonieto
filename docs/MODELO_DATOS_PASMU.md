# Modelo de datos para PASMU

## 1. Objetivo

Este documento define un modelo de datos base para la plataforma institucional de salud mental universitaria. Su intención es ser extensible y ajustable a la operación real de unidades de atención, coordinación institucional, supervisión clínica y evaluación de indicadores.

El modelo evita mezclar:

- identidad de cuentas de acceso,
- información de personas usuarias,
- información institucional,
- expediente clínico,
- auditoría y seguridad,
- configuración general.

## 2. Principios del diseño

1. Las personas pueden ser distintas de las cuentas de acceso.
2. Las unidades y programas son entidades institucionales separadas.
3. El caso clínico siempre debe estar ligado a una persona y una unidad.
4. Los documentos y archivos deben estar vinculados a un caso o a un proceso específico.
5. Todo cambio relevante debe quedar registrado en auditoría.
6. Los permisos deberán evaluarse por contexto, no por una sola bandera.

## 3. Entidades principales

### 3.1 `auth_users`

Representa la cuenta autenticada del sistema.

Campos sugeridos:

- `id` uuid pk
- `email` text unique
- `phone` text nullable
- `created_at` timestamptz
- `last_sign_in_at` timestamptz nullable
- `status` text default 'active'

Notas:

- Esta tabla la maneja Supabase Auth.
- No debe almacenar información clínica.

### 3.2 `personas`

Registro base de la persona.

Campos sugeridos:

- `id` uuid pk
- `auth_user_id` uuid fk -> auth_users
- `nombre` text
- `apellidos` text
- `fecha_nacimiento` date nullable
- `genero` text nullable
- `curp` text nullable
- `telefono` text nullable
- `escolaridad` text nullable
- `estado_civil` text nullable
- `created_at` timestamptz
- `updated_at` timestamptz

Notas:

- La persona es un registro base y puede pertenecer a varias categorías: estudiante, profesional, personal administrativo, practicante.

### 3.3 `instituciones`

Representa la universidad o entidad responsable del PASMU.

Campos:

- `id` bigint pk
- `nombre` text
- `siglas` text nullable
- `tipo` text
- `activo` boolean default true
- `created_at` timestamptz

### 3.4 `unidades`

Unidad operativa del sistema.

Campos:

- `id` bigint pk
- `institucion_id` bigint fk
- `nombre` text
- `codigo` text unique
- `tipo` text
- `responsable_id` uuid fk -> personas
- `activo` boolean default true
- `created_at` timestamptz

### 3.5 `programas`

Programas o servicios de atención.

Campos:

- `id` bigint pk
- `unidad_id` bigint fk
- `nombre` text
- `codigo` text
- `descripcion` text nullable
- `activo` boolean default true

### 3.6 `miembros`

Relaciona una persona con una unidad y un rol.

Campos:

- `id` bigint pk
- `persona_id` uuid fk -> personas
- `unidad_id` bigint fk
- `programa_id` bigint nullable fk
- `rol_id` bigint fk -> roles
- `fecha_inicio` date
- `fecha_fin` date nullable
- `activo` boolean default true
- `created_at` timestamptz

### 3.7 `roles`

Catálogo de roles institucionales.

Campos:

- `id` bigint pk
- `nombre` text
- `codigo` text unique
- `descripcion` text
- `activo` boolean default true

Ejemplos:

- coordinador_pasu
- psicologo
- practicante
- supervisor
- administrativa
- director_unidad
- analista_indicadores

### 3.8 `permisos`

Catálogo de permisos granulares.

Campos:

- `id` bigint pk
- `codigo` text unique
- `descripcion` text
- `categoria` text
- `activo` boolean default true

Ejemplos:

- `agenda.ver`
- `agenda.programar`
- `expediente.ver`
- `expediente.editar`
- `reportes.exportar`
- `usuarios.crear`
- `casos.cerrar`

### 3.9 `rol_permisos`

Asignación de permisos por rol.

Campos:

- `rol_id` bigint fk
- `permiso_id` bigint fk
- `ambito` text default 'institucion' 
  - `institucion`
  - `unidad`
  - `servicio`
  - `programa`
  - `caso`
- `primary key (rol_id, permiso_id)`

## 4. Personas usuarias y atención

### 4.1 `personas_usuarias`

Es la entidad del usuario del servicio, población atendida o usuaria del PASMU.

Campos:

- `id` bigint pk
- `persona_id` uuid fk -> personas nullable
- `numero_expediente` text unique
- `estatus` text
- `tipo_atencion` text
- `origen_referencia` text nullable
- `admitido_en` timestamptz
- `estado_actual` text
- `created_at` timestamptz

### 4.2 `casos`

Representa un proceso de atención o episodio.

Campos:

- `id` bigint pk
- `persona_usuaria_id` bigint fk
- `unidad_id` bigint fk
- `programa_id` bigint nullable fk
- `estado` text
- `motivo_referencia` text nullable
- `fecha_apertura` timestamptz
- `fecha_cierre` timestamptz nullable
- `responsable_actual_id` uuid nullable fk -> personas
- `created_at` timestamptz

### 4.3 `caso_profesionales`

Asignación de profesionales o supervisores a un caso.

Campos:

- `id` bigint pk
- `caso_id` bigint fk
- `persona_id` uuid fk -> personas
- `rol_en_caso` text
- `activo` boolean default true
- `asignado_en` timestamptz

### 4.4 `agenda`

Citas y disponibilidad.

Campos:

- `id` bigint pk
- `caso_id` bigint nullable fk
- `persona_usuaria_id` bigint fk
- `unidad_id` bigint fk
- `profesional_id` uuid fk -> personas
- `fecha_inicio` timestamptz
- `fecha_fin` timestamptz
- `tipo` text
- `estado` text
- `motivo` text nullable
- `observaciones` text nullable
- `created_at` timestamptz

## 5. Expediente clínico

### 5.1 `episodios`

Representa cada episodio de atención relacionado con un caso.

Campos:

- `id` bigint pk
- `caso_id` bigint fk
- `tipo` text
- `descripcion` text
- `fecha_inicio` timestamptz
- `fecha_fin` timestamptz nullable
- `creado_por` uuid fk -> personas
- `created_at` timestamptz

### 5.2 `notas_clinicas`

Notas profesionales del expediente.

Campos:

- `id` bigint pk
- `caso_id` bigint fk
- `episodio_id` bigint nullable fk
- `autor_id` uuid fk -> personas
- `tipo` text
- `contenido` text
- `confidencialidad` text default 'nivel_1'
- `created_at` timestamptz

### 5.3 `evaluaciones_psicologicas`

Instrumentos o evaluaciones realizadas.

Campos:

- `id` bigint pk
- `caso_id` bigint fk
- `instrumento_id` bigint fk
- `aplicado_por` uuid fk -> personas
- `fecha_aplicacion` timestamptz
- `resultado_json` jsonb nullable
- `observaciones` text nullable
- `created_at` timestamptz

### 5.4 `instrumentos`

Catálogo de instrumentos autorizados.

Campos:

- `id` bigint pk
- `nombre` text
- `tipo` text
- `version` text
- `activo` boolean default true
- `created_at` timestamptz

## 6. Documentación y archivos

### 6.1 `documentos`

Documentos del caso o proceso institucional.

Campos:

- `id` bigint pk
- `caso_id` bigint nullable fk
- `tipo_documento` text
- `titulo` text
- `descripcion` text nullable
- `creado_por` uuid fk -> personas
- `created_at` timestamptz

### 6.2 `documento_archivos`

Metadatos de archivos asociados a documentos.

Campos:

- `id` bigint pk
- `documento_id` bigint fk
- `storage_path` text
- `mime_type` text
- `tamano_bytes` bigint
- `categoria` text
- `hash_sha256` text nullable
- `uploaded_by` uuid fk -> personas
- `created_at` timestamptz

### 6.3 `consentimientos`

Consentimientos, autorizaciones y documentos legales.

Campos:

- `id` bigint pk
- `caso_id` bigint fk
- `tipo` text
- `estado` text
- `firmado_por` uuid fk -> personas
- `fecha_firma` timestamptz
- `documento_id` bigint nullable fk
- `observaciones` text nullable

## 7. Supervisión académica y práctica

### 7.1 `practicantes`

Relación de practicantes y su formación.

Campos:

- `id` bigint pk
- `persona_id` uuid fk -> personas
- `institucion_formadora` text nullable
- `programa_academico` text nullable
- `supervisor_id` uuid fk -> personas
- `estado` text

### 7.2 `horas_practica`

Horas o actividades académicas registradas.

Campos:

- `id` bigint pk
- `practicante_id` bigint fk
- `caso_id` bigint nullable fk
- `fecha` date
- `horas` numeric(4,2)
- `tipo_actividad` text
- `observaciones` text nullable

### 7.3 `competencias`

Catálogo de competencias profesionales.

Campos:

- `id` bigint pk
- `codigo` text
- `nombre` text
- `descripcion` text
- `activo` boolean default true

### 7.4 `practicante_competencias`

Evidencia del avance de competencias.

Campos:

- `id` bigint pk
- `practicante_id` bigint fk
- `competencia_id` bigint fk
- `nivel` text
- `fecha_evaluacion` timestamptz
- `supervisado_por` uuid fk -> personas

## 8. Indicadores y evaluación institucional

### 8.1 `indicadores`

Catálogo institucional de indicadores.

Campos:

- `id` bigint pk
- `codigo` text unique
- `nombre` text
- `descripcion` text
- `tipo` text
- `unidad_medida` text
- `activo` boolean default true

### 8.2 `meta_indicadores`

Metas por periodo o plan institucional.

Campos:

- `id` bigint pk
- `indicador_id` bigint fk
- `periodo` text
- `meta` numeric
- `unidad_id` bigint nullable fk
- `programa_id` bigint nullable fk

### 8.3 `mediciones_indicadores`

Registros de indicadores.

Campos:

- `id` bigint pk
- `indicador_id` bigint fk
- `periodo` text
- `valor` numeric
- `observaciones` text nullable
- `capturado_por` uuid fk -> personas
- `capturado_en` timestamptz

## 9. Seguridad y auditoría

### 9.1 `auditoria_actividad`

Captura de cambios en la base.

Campos:

- `id` bigint pk
- `tabla` text
- `registro_id` text
- `operacion` text
- `usuario_id` uuid nullable
- `usuario_email` text nullable
- `antes` jsonb nullable
- `despues` jsonb nullable
- `cambios` text[]
- `created_at` timestamptz

### 9.2 `auditoria_seguridad`

Eventos de seguridad y acceso sensible.

Campos:

- `id` bigint pk
- `usuario_id` uuid nullable
- `accion` text
- `recurso` text
- `resultado` text
- `ip_origen` text nullable
- `user_agent` text nullable
- `created_at` timestamptz

## 10. Reglas de integridad recomendadas

- `casos` no pueden existir sin `persona_usuaria_id`.
- `agenda` debe validar fechas finales y coherencia de horario.
- `documento_archivos` debe validar `storage_path` y tipo `mime_type`.
- `notas_clinicas` debe respetar confidencialidad y acceso por rol.
- `auditoria_*` no debe poder modificarse desde el front-end.

## 11. Consideraciones de acceso y RLS

Se recomienda definir políticas por dominio:

- acceso a `personas` restringido según rol y unidad
- acceso a `casos` autorizado por asignación y necesidad de tratamiento
- acceso a `notas_clinicas` según nivel de confidencialidad
- acceso a `documento_archivos` según caso o expediente
- acceso a `auditoria_*` solo a perfiles de seguridad y dirección

## 12. Resumen

Este modelo de datos prioriza integridad, trazabilidad y control de acceso por contexto. Es flexible para crecer en servicios, unidades, indicadores y evaluación institucional, y a la vez define una separación clara entre la identidad digital, la administración institucional y el contenido clínico y documental del PASMU.
