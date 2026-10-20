# Arquitectura objetivo del sistema PASMU

## 1. Propósito y alcance

Esta arquitectura define la base de un sistema institucional para administrar, monitorear y evaluar la atención de salud mental universitaria, sin reutilizar el dominio ni los datos del repositorio educativo actual. El objetivo es separar claramente la lógica de negocio institucional, la identidad digital, la atención clínica y la operación administrativa.

El sistema debe sostener:

- Gestión de unidades de atención psicológica.
- Registro y seguimiento administrativo de personas usuarias.
- Admisión, agenda, citas y episodios de atención.
- Expediente clínico y documentación profesional.
- Alta, baja, cierre y reactivación de procesos.
- Asignación de profesionales y practicantes.
- Supervisión clínica y académica.
- Prácticas profesionales, horas y competencias.
- Evaluaciones psicológicas e instrumentos autorizados.
- Talleres, campañas y actividades preventivas.
- Materiales psicoeducativos y desarrollo de competencias.
- Canalizaciones y seguimiento institucional.
- Indicadores operativos, tácticos y estratégicos.
- Matriz de indicadores vinculada al marco lógico del PASMU.
- Informes institucionales y medios de verificación.
- Auditoría, seguridad y administración.
- Acceso web adaptable para entorno móvil.

## 2. Principios de arquitectura

1. Separación de responsabilidades.
   - Autenticación, perfil, roles, permisos y negocio clínico no deben mezclarse.
2. Política de mínimo privilegio.
   - Cada usuario solo tiene acceso a lo necesario para su función y contexto.
3. Fuente de verdad en backend.
   - La autorización debe validarse en PostgreSQL con RLS, RPC y políticas de acceso reforzadas.
4. Datos sensibles en dominios explícitos.
   - El expediente clínico, la información de personas usuarias y la auditoría institucional no comparten el mismo espacio de negocio que la configuración general.
5. Acceso por contexto.
   - El permiso depende del rol, unidad, servicio, programa, caso y atribución institucional.
6. Trazabilidad total.
   - Toda operación relevante debe quedar auditada con quién, cuándo y qué cambió.
7. Diseño modular.
   - Cada módulo debe poder evolucionar sin romper a los demás.
8. Seguridad desde el diseño.
   - No se asume que el front-end es suficiente para proteger información sensible.

## 3. Arquitectura de capas

### 3.1 Capa de identidad y acceso

Responsable de:

- autenticación de usuarios
- gestión de credenciales
- sesiones y reautenticación
- memberships y pertenencia institucional
- roles institucionales
- autorización basada en permisos

Componentes sugeridos:

- `auth.users` (Supabase Auth)
- `personas`
- `instituciones`
- `miembros`
- `roles`
- `permisos`
- `asignaciones_rol`
- `auditoria_seguridad`

### 3.2 Capa de administración institucional

Responsable de:

- unidades de atención
- programas y servicios
- profesionales
- practicantes y supervisores
- indicadores institucionales
- cronogramas de operación

### 3.3 Capa de atención y caso

Responsable de:

- personas usuarias
- admitidos y procesos de atención
- citas y agenda
- episodios clínicos
- canalizaciones
- alta, baja, cierre y reactivación

### 3.4 Capa de expediente y documentación

Responsable de:

- documentos de atención
- notas profesionales
- evaluación psicológica
- instrumentos autorizados
- consentimiento y confidencialidad
- almacenamiento y acceso a archivos

### 3.5 Capa de evaluación y indicadores

Responsable de:

- seguimiento a metas
- indicadores de operación
- indicadores de impacto
- resultados por unidad
- marco lógico y reportes

### 3.6 Capa de experiencia y presentación

Responsable de:

- front-end web
- módulos por rol
- dashboards
- formularios de atención
- navegación segura por permisos
- notificaciones internas y alertas

## 4. Modelo conceptual de usuarios

### 4.1 Distinciones obligatorias

El sistema no debe tratar a la cuenta de autenticación como una sola identidad. Deben existir varios niveles:

- `auth_user`: cuenta autenticada en Supabase.
- `persona`: registro base de la persona.
- `perfil_institucional`: datos vinculados a la institución o a una unidad.
- `miembro`: relación de una persona con una unidad o programa.
- `rol`: rol funcional dentro del sistema.
- `permiso`: capacidad granular para ejecutar una acción.
- `usuario_atendido`: persona usuaria del servicio de salud mental.
- `caso_clinico`: episodio o proceso de atención.

### 4.2 Regla central

Un usuario puede tener:

- una cuenta de acceso,
- varios perfiles institucionales,
- distintas afiliaciones (unidad, programa, servicio),
- una combinación de roles y permisos,
- acceso restringido a pacientes, casos y documentos según el contexto.

## 5. Autorización por contexto

La autorización no se debe resolver solo con un booleano `esAdmin`.

Se recomienda un modelo de permisos granulares con contexto:

- `global`: aplica a toda la institución
- `unidad`: aplica a una unidad específica
- `servicio`: aplica a un servicio dentro de la unidad
- `programa`: aplica a un programa o intervención
- `caso`: aplica a un caso clínico
a

Ejemplos:

- `usuarios.consultar_todos`
- `expedientes.ver_episodio`
- `agenda.programar_cita`
- `indicadores.exportar_reporte`
- `auditoria.ver_eventos_sensibles`
- `usuarios_admin.alta_personal`

La evaluación final debe ser:

- ¿quién es?
- ¿en qué unidad/servicio trabaja?
- ¿qué rol tiene?
- ¿qué caso o expediente le corresponde?
- ¿tiene permiso explícito sobre ese ámbito?

## 6. Separación funcional por módulos

### 6.1 Módulo de identidad y accesos

- registro de personas
- carga de perfiles
- identificación institucional
- vinculación a unidades
- roles y permisos
- sesiones y recuperación

### 6.2 Módulo de administración

- unidades
- servicios
- programas
- profesionales
- practicantes
- carga masiva institucional
- configuraciones generales

### 6.3 Módulo de atención

- valoración inicial
- admisión
- agenda
- citas
- seguimiento
- canalizaciones
- cierre del caso

### 6.4 Módulo clínico

- episodios
- historial de atención
- notas profesionales
- intervenciones
- evaluaciones psicológicas
- consentimiento informado
- tratamiento y seguimiento

### 6.5 Módulo de documentos y archivos

- documentos institucionales
- archivos del expediente
- documentación legal
- consentimiento
- archivos firmados o seguros

### 6.6 Módulo de indicadores

- indicadores operativos
- indicadores de resultados
- cuadros de mando
- dashboards por unidad
- exportación y reportes

### 6.7 Módulo de seguridad y auditoría

- trazas de acceso
- cambios en expediente
- gestión de riesgos
- revisión de permisos
- alertas por actividades críticas

## 7. Arquitectura de la aplicación web

### 7.1 Front-end

Se recomienda una SPA React con separación por módulos.

Stack sugerido:

- React 18+
- Vite
- React Router
- TanStack Query o manejo propio de cache con validación de estado
- Estado global mínimo
- Servicios de dominio por módulo

### 7.2 Patrón de rutas

- `/login`
- `/recuperar`
- `/registro`
- `/dashboard`
- `/personas`
- `/unidad/:id`
- `/agenda`
- `/casos/:id`
- `/expediente/:id`
- `/indicadores`
- `/admin`
- `/seguridad`
- `/404`

Rutas protegidas por permiso, no por “si existe sesión”.

### 7.3 Carga diferida

Se mantiene el patrón `lazy()` + `Suspense` para módulos pesados.

Se recomienda cargar:

- rutas públicas
- dashboard principal
- módulos cotidianos
- módulos complejos bajo demanda

## 8. Persistencia y base de datos

Se recomienda PostgreSQL con Supabase.

La base debe estar segmentada por dominios:

- identidad
- institucional
- atención
- expediente
- indicadores
- auditoría
- archivos

Se recomienda:

- RLS por tabla y por contexto
- vistas de lectura tipadas para dashboards
- funciones RPC para consultas de permisos
- triggers para auditoría
- índices para acceso por usuario, caso, unidad y fecha

## 9. Seguridad y cumplimiento

### 9.1 Riesgos a considerar

- fuga de expediente clínico
- acceso por permisos excesivos
- uso indebido de archivos adjuntos
- trazabilidad insuficiente
- compartir información sensible en logs o errores

### 9.2 Reglas obligatorias

- no exponer datos clínicos en errores del front-end
- no guardar información sensible en `localStorage` cuando no sea necesario
- todas las operaciones sensibles deben pasar por backend con validación
- registrar solo eventos de auditoría relevantes y minimizados
- separar roles de atención, supervisión y administración

## 10. Roadmap recomendado

### Fase 1: base institucional

- identidad y personas
- unidades y roles
- permisos y memberships
- autenticación y recuperación
- auditoría básica

### Fase 2: atención y agenda

- admisión
- personas usuarias
- agenda y citas
- episodios
- alta/baja/cierre

### Fase 3: expediente y documentos

- historial clínico
- documentos
- consentimiento
- archivos seguros
- acceso y trazabilidad

### Fase 4: indicadores y reportes

- KPIs del PASMU
- dashboard institucional
- matriz de indicadores
- reportes y exportación

### Fase 5: crecimiento y seguridad

- optimización de rendimiento
- automatización de alertas
- revisión de permisos
- hardening de seguridad
- preparación de cumplimiento institucional

## 11. Resumen ejecutivo

La arquitectura objetivo del PASMU debe ser un sistema modular, con identidad separada del negocio clínico, permisos por contexto y acceso determinado por la base de datos. El repositorio educativo aporta patrones valiosos de front-end, lógica de permisos y seguridad por diseño, pero el modelo final debe ser completamente nuevo y específico para salud mental universitaria.
