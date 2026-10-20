# Seguridad, privacidad y auditoría para PASMU

## 1. Objetivo

Este documento define la base de seguridad para la plataforma institucional del PASMU. La prioridad es proteger la información de personas usuarias, profesionales, canales de atención y documentos ligados a la salud mental universitaria.

La aplicación no puede considerarse segura por el simple hecho de usar Supabase. La seguridad debe estar diseñada en capas, con validación en backend, permisos por contexto y trazabilidad total.

## 2. principios de seguridad

### 2.1 Mínimo privilegio

Toda persona debe tener solo los permisos necesarios para su tarea. Un coordinador no debe ver expedientes clínicos sin necesidad, y un profesional no debe administrar indicadores si su función no lo requiere.

### 2.2 Separación de funciones

- atención
- supervisión
- coordinación
- administración institucional
- auditoría
- indicadores

Cada una debe tener roles y permisos distintos.

### 2.3 Fuente de verdad en la base

La autorización debe evaluarse en PostgreSQL mediante:

- RLS
- funciones RPC
- políticas por usuario, unidad, programa y caso
- validaciones de negocio en backend

La UI solo debe no mostrar opciones que no correspondan a un rol válido; no debe ser la defensa final de seguridad.

## 3. Identidad y autorización

### 3.1 Modelo recomendado

- `auth_users`: autenticación
- `personas`: identidad base
- `miembros`: relación con unidad/programa y rol
- `roles`: catálogo funcional
- `permisos`: capacidades granulares
- `asignaciones`: relación de permisos por contexto

### 3.2 Reglas mínimas

- `esAdmin` no debe sustituir la resolución de permisos.
- Se deben definir permisos por dominio y contexto.
- El acceso a casos debe permitirse solo cuando la relación del usuario y el caso lo justifique.
- El acceso a documentos sensibles debe ser validado por caso, expediente o nivel de confidencialidad.

### 3.3 Estado de la base RLS inicial

`pasmu/sql/04_rls.sql` aplica una primera barrera por usuario, rol, ámbito, unidad, programa y caso. Los perfiles se vinculan con Auth mediante `personas.auth_user_id`; si no existe esa vinculación activa y una membresía vigente, la cuenta no obtiene permisos. Los ámbitos `institucion` y `unidad` se limitan a las unidades donde la persona tiene membresía; el ámbito `caso` requiere además asignación activa a ese caso.

- Los datos básicos de `personas` son visibles únicamente para la propia persona.
- Los expedientes, notas, evaluaciones, consentimientos y documentos clínicos requieren permiso y asignación activa al caso.
- Las notas clínicas son de solo inserción desde el cliente; la corrección o anulación debe implementarse mediante un flujo auditado.
- La administración de catálogos/membresías y las escrituras de auditoría permanecen cerradas al cliente hasta contar con RPCs controladas.
- La lectura de tablas de auditoría se mantiene cerrada porque los snapshots pueden contener datos clínicos; se requiere una vista/RPC redactada antes de habilitarla.
- `private` debe mantenerse fuera de los esquemas expuestos por PostgREST. Las funciones helper están ahí para que las políticas no publiquen un oráculo de permisos vía RPC.
- Las mediciones requieren unidad y admiten ámbito de programa para que RLS pueda filtrar los resultados.

Esto es una base de desarrollo, no una certificación de cumplimiento ni una política final de producción. Antes de usar datos reales hay que revisar la matriz con responsables institucionales, crear los flujos de alta/identidad, definir auditoría segura, políticas de Storage y probar con cuentas Auth separadas para cada perfil.

## 4. Protección de datos sensibles

### 4.1 Clasificación sugerida

- pública: información institucional general
- interna: datos operativos y administrativos
- confidencial: datos de personal y coordinación
- restringida: expediente clínico, evaluaciones, documentos de riesgo o sensibilidad

### 4.2 Reglas de tratamiento

- no usar `localStorage` para información sensible
- no incluir detalles clínicos en mensajes de error o logs del front-end
- no hacer logging de contenido de expediente en consola
- usar almacenamiento con acceso restringido y metadatos mínimos

## 5. Archivos y almacenamiento

Los archivos deben manejarse con políticas por bucket, tipo y contexto.

### 5.1 Buckets recomendados

- `documentos_institucionales`
- `expediente_clinico`
- `consentimientos`
- `material_psicoeducativo`
- `reportes`
- `auditoria`

### 5.2 Reglas

- los archivos clínicos deben ser privados y con acceso por identificación de caso
- los documentos de secretaria o administración no deben mezclarse con los clínicos
- la descarga de archivos debe tener trazabilidad
- el nombre del archivo debe ser controlado y el contenido no debe ser público por defecto
- las políticas RLS de `documento_archivos` no sustituyen las políticas del bucket de Supabase Storage; no subir archivos hasta definirlas y probarlas

## 6. Auditoría

La auditoría es obligatoria en este sistema.

### 6.1 Qué debe auditarse

- inicio y cierre de sesión
- acceso a expediente, notas y casos
- creaciones y edición de archivos
- alta o baja de usuarios y profesionales
- cambios relevantes en permisos y roles
- cierre, reactivación o transferencia de casos
- exportación de reportes o indicadores sensibles

### 6.2 Recomendaciones

- registro en backend y no por la interfaz
- guardar `antes` y `después` de cambios críticos
- identificar usuario, unidad y caso si aplica
- bloquear la manipulación directa de auditoría desde front-end

## 7. Seguridad por módulos

### 7.1 Módulo administrativo

- permisos por unidad y programa
- control de personal y roles
- monitoreo de cambios críticos

### 7.2 Módulo de atención

- acceso por caso y rol
- trazabilidad de citas y episodios
- controles de confidencialidad

### 7.3 Módulo de expediente

- acceso mínimo necesario
- notas de nivel de confidencialidad
- archivos protegidos por caso

### 7.4 Módulo de indicadores

- exportación controlada
- permisos por coordinación o analistas
- filtros por unidad, programa o periodo

## 8. Manejo de errores

La seguridad del sistema incluye la respuesta ante fallas.

### Reglas

- no mostrar mensajes con contenido clínico en fallos visibles
- registrar errores técnicos en backend con metadatos suficientes, nunca con información de paciente
- diferenciar errores de negocio de errores de infraestructura
- no filtrar datos sensibles por la interfaz de error

## 9. Revisión periódica y control de riesgos

Se recomienda:

- revisión trimestral de permisos por rol
- revisión anual de accesos a archivos y casos
- revisión activa de eventos de auditoría sospechosos
- cortes de acceso cuando cambia la asignación de personal
- validación de usuarios inactivos y permisos expirados

## 10. Indicadores de seguridad

- accesos fallidos por usuario y por recurso
- accesos a expdientes fuera de horario o sin justificación
- exportaciones de informes sensibles
- cambios de permisos en roles críticos
- intentos de acceso a archivos protegidos

## 11. Resumen

El PASMU necesita un diseño de seguridad centrado en: identificación clara, permisos por contexto, validación en la base de datos, auditoría continua y manejo cuidadoso de archivos y documentos. La seguridad no es un módulo extra; debe ser una dimensión transversal y obligatoria en todo el sistema.
