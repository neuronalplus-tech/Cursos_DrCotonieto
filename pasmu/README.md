# PASMU — Proyecto independiente

Este directorio contiene la base inicial para un sistema independiente de salud mental universitaria, separado del repositorio educativo actual.

## Objetivo

Proporcionar una base técnica inicial para:

- identidad institucional,
- personas y roles,
- usuarios atendidos,
- casos y agenda,
- expediente clínico,
- indicadores y reportes,
- seguridad y auditoría.

## Estructura

- `sql/01_catalogos.sql` — tablas base y catálogos
- `sql/02_atencion.sql` — casos, agenda, expediente y documentos
- `sql/03_reportes.sql` — indicadores y matríz de evaluación
- `sql/04_rls.sql` — políticas y reglas de seguridad
- `sql/05_seed_roles.sql` — seed de roles, permisos y asignaciones iniciales
- `web/` — prototipo de frontend con rutas protegidas por rol y permisos

## Principios

- no usar `esAdmin` como autorización final
- separar cuenta, persona, rol y acceso por contexto
- definir permisos por unidad, programa, servicio o caso
- proteger expediente clínico y documentos de atención
- auditar todas las operaciones críticas

## Siguiente paso recomendado

Implementar la base con Supabase, definir roles reales de la universidad y validar permisos por caso y unidad antes de abrir el primer módulo de atención.

## Frontend independiente

El prototipo web de PASMU vive en `pasmu/web/` y ya está preparado para conectarse a Supabase usando variables de entorno:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ejemplo: `pasmu/web/.env.example`.
