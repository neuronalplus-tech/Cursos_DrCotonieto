# Experiencia DEMO en línea (rama `experiencia-demo`)

> Prototipo. Solo PRUEBAS con datos sintéticos `SIN-xxxxxxxx` en la unidad `DEMO`. No usar con datos reales.
> Esta guía vive solo en la rama `experiencia-demo`; `main` no se toca.

## Qué cambia esta rama (mínimo, sin romper lo existente)

- **SQL nuevo (aditivo, idempotente):**
  - `pasmu/sql/42_experiencia_demo.sql`: crea unidad `DEMO` + rol `experiencia_demo` con 6 permisos
    (`dashboard.ver, casos.ver, agenda.ver, expediente.ver, reportes.ver, perfil.editar`, ámbito `unidad`),
    blindaje anti-escritura y `pasmu_preAlta_equipo()` reinstalada con las mismas reglas de 36
    (correo válido, solo Dirección da de alta responsables, alcance por `altas.personal`, auditoría)
    + `experiencia_demo` solo permitido en la unidad `DEMO`.
  - `pasmu/sql/43_verificar_experiencia_demo.sql`: 6 checks de solo lectura (todo debe dar `ok = true`).
  - No se modifica ningún script 00-41. La verificación 37 sigue pasando (sin `coterapeuta`, con `practicante`).
- **Frontend (defensa en UI; la real es RLS/RPC):**
  - `lib/permissions.js`: rol `experiencia_demo`, helper `isExperienciaDemo()`, `ROLE_ORDER` + `USERS.experiencia_demo`,
    `exportar` exige `reportes.exportar` y niega demo (ACC-09: ver ≠ exportar).
  - `App.jsx`: `/expediente/exportar→exportar`, `/expediente/revisiones→revisiones`, `/conversacion→chat`.
  - `Layout.jsx`: banner “Exploración DEMO · Solo lectura…”, oculta PDF a demo.
  - `Altas.jsx`: catálogo real de roles (los 7 definitivos + `experiencia_demo` solo DEMO).
  - `Casos/Expediente/NotaSoap/BancoRecursos/PaseSesion.jsx`: sin crear/editar/asignar/guardar para demo.
  - `Reportes.jsx`: sin cambios (ya exige `reportes.exportar`; demo no lo tiene).
- **Prueba:** `tests/permissions.test.js` → “experiencia_demo es solo lectura…”. `npm test --prefix pasmu/web`: 32/32.

## Orden de aplicación en Supabase de PRUEBAS (manual, responsable autorizado)

1. Base ya aplicada 01→41 (ver `00c_estado_scripts.sql`).
2. `42_experiencia_demo.sql` → `43_verificar_experiencia_demo.sql` (6 filas `ok = true`).
3. `37_verificar_roles_altas.sql` debe seguir en `ok = true` (no se rompió 36).

## Dar acceso a una persona (tú decides quién entra)

1. En Auth crea/confirma `demo+cliente@tu-dominio.mx`.
2. En SQL (o desde `/altas` con Dirección/Responsable + `altas.personal`):
   `select pasmu_preAlta_equipo('demo+cliente@tu-dominio.mx','Nombre Demo','experiencia_demo',(select id from unidades where codigo='DEMO'));`
   luego vincula `personas.auth_user_id` + `miembros(persona, unidad DEMO, rol experiencia_demo, fecha_fin = hoy+15)`.
3. Pásale la URL del preview de Cloudflare (proyecto preview-demo → Supabase demo) + esta guía de 15 min:
   Dirección→`/dashboard+/reportes`, Coordinación→`/casos+/agenda`, Terapeuta→`/expediente` sintético.
4. Revocar: `update miembros set activo=false` o deja vencer `fecha_fin`; RLS cierra el acceso solo.

## Puertas antes de internet (DESPLIEGUE §28-34 + DESCUBRIMIENTO §8)

- Proyecto Supabase **demo** separado del de producción; solo `SIN-xxxxxxxx`, sin PII.
- Preview Cloudflare separado, `noindex`, dominio temporal autorizado en Auth/CORS.
- Sin `service_role` en `VITE_*`; sin adjuntos/Storage clínico; correo real pendiente.
- Aprobación Dirección/clínico/privacidad/tec-seguridad antes de datos reales.
