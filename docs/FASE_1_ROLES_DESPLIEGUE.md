# Fase 1 — Encender el subsistema de roles · guía de despliegue

> **Proyecto:** `Cursos_DrCotonieto` · **Fecha:** 12 de octubre de 2026 · **Autor:** Claude
> **Parte de:** `docs/PLAN_ACCIONES_1_CLAUDE.md` (Fase 1).
> **Qué es esto:** el resultado de auditar el subsistema de roles antes de encenderlo, más la
> secuencia exacta para desplegarlo y probarlo. No es un plan: es la lista de pasos a ejecutar.

---

## Veredicto de la auditoría

**El subsistema de roles está completo y bien construido de punta a punta.** Lo revisé entero
(SQL + biblioteca + interfaz) y no encontré bugs; sí corregí un hueco menor en la interfaz (abajo).

Corrección importante al plan: el plan decía que la F1-2 (llevar los permisos a las políticas de la
base, "tabla por tabla") era trabajo **pendiente de talla L**. **No lo es: ya está escrito**, repartido
entre `ROLES_6_POLITICAS.sql` (grupos, sesiones, asistencia, inscripciones, sedes, plantillas,
perfiles) y `ROLES_7_CONTENIDO.sql` (cursos, módulos, recursos, exámenes, banco, tareas, rúbricas,
entregas, intentos, foro, progreso, prórrogas, constancias). Las políticas son **aditivas** —se suman
con OR a las que ya existen—, así que **encenderlas no le quita el acceso a nadie**: solo se lo da a
quien antes no lo tenía.

Qué revisé y confirmé:

- **SQL (`ROLES_5/6/7`):** las funciones `tiene_permiso`, `mis_permisos`, `puedo_en_curso`,
  `puedo_en_generacion`, `puedo_en_contenido`, `cursos_que_puedo` son coherentes, todas
  `security definer` con `search_path` fijo y con su `revoke`/`grant`. El ámbito por sede y categoría
  se resuelve antes de preguntar, así que "Coordinación del Plantel Norte" no toca el grupo de otro
  plantel. Justificar faltas va en un disparador aparte (bien: una política decide por fila, no por
  columna). Las políticas nuevas llevan sufijo `_rol`, distinto de las existentes.
- **Biblioteca (`src/lib/permisos.js`, `src/lib/roles.js`):** `useMisPermisos` consume `mis_permisos`
  y expone `puede(clave, donde)`, `puedeAlguno(...)` y `tieneAlguno`; `cargar()` consume
  `cursos_que_puedo`. Todo **degrada con elegancia** si el SQL aún no está: si una función no existe,
  se sigue sin permisos de rol en vez de romper el panel. La firma `cursos_que_puedo(p_permiso) →
  curso_id` coincide con lo que el frontend espera.
- **Interfaz (`src/components/AdminRoles.jsx`, `src/components/Admin.jsx`):** la pestaña Roles crea
  roles, reparte permisos y asigna personas con ámbito; el panel deja entrar a un rol
  (`puedeEntrar = esAdmin || permisosRol.tieneAlguno`) y filtra cada pestaña por `PERMISO_DE[clave]`.
  Si falta el SQL, la pantalla de Roles muestra el catálogo vacío en vez de caerse.

Único arreglo aplicado (ya desplegado con esta guía): la pestaña inicial del panel es
"Inscripciones", y un **rol personalizado sin `alumnos.ver`** aterrizaba ahí, en una vista que no
puede ver. Ahora el panel salta a la primera pestaña que esa persona sí puede ver. Los tres roles
básicos tienen `alumnos.ver`, así que a ellos nunca les afectó; esto cubre los roles a medida.

---

## Requisitos previos

- Haber corrido antes (están en `ESTADO.sql`): `ORGANIZACIONES_1_BASE.sql`, `ASISTENCIA.sql`,
  `MODULOS.sql`. Si `ESTADO.sql` los marca pendientes, correrlos primero.
- Idealmente, haber hecho la **Fase 0** (`docs/PLAN_ACCIONES_1_CLAUDE.md` §Fase 0): el aislamiento
  entre organizaciones de los roles se apoya en que esas fugas estén cerradas.

---

## Pasos de despliegue

Supabase → SQL Editor → New query → pegar cada script → Run, **en este orden**. Son idempotentes:
volver a correrlos no rompe nada.

| # | Script | Comprobación al final del script (resultado esperado) |
|---|---|---|
| 1 | `supabase/ROLES_5_PERMISOS.sql` | permisos = 21 · tablas nuevas = 4 · roles creados = 0 · funciones = 3 |
| 2 | `supabase/ROLES_6_POLITICAS.sql` | políticas por rol = 13 · funciones de ámbito = 2 · disparador = 1 |
| 3 | `supabase/ROLES_7_CONTENIDO.sql` | políticas por rol (total) = 33 · de contenido = 18 · `puedo_en_contenido` = 1 |

Después:

4. **Regenerar `ESTRUCTURA.md`** (ahora existen 4 tablas y 6 funciones nuevas).
5. En el panel → **Roles → "Crear los tres roles básicos"** (llama `sembrar_roles_basicos`): crea
   *Dirección*, *Coordinación* y *Docente* con un juego de permisos de partida. **Revisa los permisos
   de cada uno antes de asignar a nadie**: son un punto de partida, no una recomendación cerrada.

---

## Prueba de aceptación (el paso que de verdad importa)

Con una cuenta de prueba que **no** esté en `admins` ni en `facilitadores`:

1. Asígnale el rol **Coordinación** (acotado a una sede si tienes varias).
2. Entra con esa cuenta al panel: debe **poder armar grupos e inscribir**, y **no** ver Suscripciones
   ni Bitácora.
3. Asígnale en otra cuenta el rol **Docente**: al entrar a un curso de esa organización debe poder
   **editar módulos, recursos y exámenes** sin estar en `facilitadores`.
4. **La prueba clave:** con un rol que solo tenga `asistencia.pasar`, intenta **justificar** una falta.
   Debe negarse con "Puedes pasar lista, pero justificar faltas es de coordinación." Si deja
   justificar, el disparador `asistencia_justificar` no está actuando → revisa que ROLES_6 corrió.
5. Quítale `calificaciones.capturar` al rol Docente y recarga: debe **seguir editando** el curso y
   **no poder calificar** una entrega. (Editar y calificar son permisos distintos a propósito.)

---

## Lo que los roles SIGUEN sin conceder (a propósito, no es un olvido)

De las notas de los propios scripts, para que no sorprenda:

- **Crear cursos**: decidir el catálogo de la institución sigue siendo del administrador de la
  organización.
- **Emitir constancias**: pasa por `emitir_constancia`, que comprueba lo suyo.
- **Borrar intentos de examen y entregas**: sigue siendo del administrador. Borrar evidencia de
  evaluación no debería ser de un rol configurable.
- **Repartir roles y ajustar el registro público**: son configuración del sitio; el panel los oculta
  a quien no administra la organización, aunque tenga otros permisos.

---

## Si algo sale mal

- **Error de permisos al crear las políticas:** hazlas desde Storage/Policies en el panel de Supabase
  con el mismo contenido (los scripts lo indican en su cabecera).
- **Un rol no puede hacer algo que debería:** confirma que corriste los **tres** scripts en orden y
  que la persona tiene el permiso en el rol correcto (y el ámbito correcto: un rol acotado a una sede
  no vale en otra).
- **Revertir es seguro:** como las políticas son aditivas y llevan sufijo `_rol`, se pueden quitar una
  a una con `drop policy if exists "<nombre>_rol" on public.<tabla>;` sin tocar las originales. Nadie
  que tuviera acceso por `admins`/`facilitadores` lo pierde.
