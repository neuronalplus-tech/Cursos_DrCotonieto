# Informe de avance — pendientes del diagnóstico

Fecha: 2026-10-16
Rama: main (cambios sin commitear al generar este informe)

## 1. Lo que SÍ se logró (código local, no commiteado)

Cambios verificados con `git diff HEAD`:

### B5 — respuestas de examen al navegador
Archivo: `src/components/ExamenModulo.jsx`
- Línea 39: `select('*')` → `select('id, titulo, descripcion, preguntas, aleatorio_n, mezclar_opciones, activo, max_intentos, umbral_aprobacion, curso_id, modulo_id, limite_minutos')`
- Línea 342: `(juego || examen.preguntas || [])` → `(juego || (examen?.preguntas || []).map(limpiarPregunta) || [])`
- Efecto: el render ya no muestra respuestas correctas aunque vengan en el objeto. Queda pendiente que `servir_examen()` sea la única fuente (el `examen.preguntas` completo sigue llegando al navegador en la carga inicial).

### A7 — vista_admin_inscripciones acotada en frontend
Archivo: `src/components/Admin.jsx` — 5 consultas:
- L251, L497, L693, L1031, L1130: añadido `.eq('organizacion_id', organizacion?.id)`
- Efecto: el panel ya no pide el padrón completo desde esos 5 puntos.

### A1 (parcial) — fugas entre organizaciones en frontend
- `src/components/CursoView.jsx`: import `useOrganizacion` + `.eq('organizacion_id', ...)` + `.eq('curso_id', curso.id)` en consulta a `vista_admin_inscripciones`.
- `src/components/MensajesInbox.jsx`: import `useOrganizacion` + `.eq('organizacion_id', ...)` en contactos.
- `src/lib/correo.js` `obtenerEmailsInscritos()`: añadido `.eq('curso_id', cursoId)` (antes traía todo y filtraba en memoria).

## 2. Lo que NO se logró / sigue abierto

> Nada de lo de abajo tiene parche aplicado. No se tocó SQL ni Edge Functions en esta ronda.

- **A7 fondo (30 seg §0): NO confirmado.** El filtro `.eq('organizacion_id', ...)` es solo frontend. Si la vista `vista_admin_inscripciones` o su RLS no filtra por organización, cualquier usuario con cuenta puede quitar el filtro en consola y leer el padrón completo. Falta correr la consulta del §0 contra Supabase para verificar RLS de la vista.
- **A1 fondo:** el frontend filtra, pero la seguridad real es RLS en `acceso`, `perfiles`, `vista_admin_inscripciones`. No verificado.
- **A2 — enlaces de recuperación:** no se modificó `supabase/functions/crear-usuarios/index.ts`. No se confirmó si valida organización del emisor. Sigue abierto.
- **A4 — constancia autoemitida:** no se modificó `CONSTANCIAS_3_APROBACION.sql` ni `CONSTANCIAS_2_EMISION.sql`. `emitir_constancia(p_curso)` solo verifica `tiene_acceso_al_curso()`, no que curso y alumno sean de la misma organización. Sigue abierto.
- **A8 / M2 — folios enumerables y notas privadas:** no se tocó.
  - `listar_usuarios_con_accesos()` devuelve `usuario_id, email, nombre_completo, profesion, notas_admin, ...` de TODOS los `auth.users` si el llamante está en `admins` (cualquier org). Es fuga entre organizaciones + expone `notas_admin`.
  - `verificar_constancia(p_folio)` es pública (anon) por diseño; si los folios son predecibles/secuenciales son enumerables. El folio actual usa `gen_random_uuid()` pero no se auditó unicidad/historial.
  - RLS de `perfiles.notas_admin`: RLS decide por fila, no por columna. `perfil_select` permite a admin/facilitador ver la fila completa (incluye notas). No hay enmascaramiento por columna.
- **Deuda de esta ronda:** los cambios listados en §1 están solo en working copy, sin commit, sin pruebas, sin `npm run build` / tests corridos.

## 3. Evidencia
- `git status --short`: M Admin.jsx, CursoView.jsx, ExamenModulo.jsx, MensajesInbox.jsx, lib/correo.js
- `git diff --stat HEAD`: 5 files, 19 insertions, 7 deletions
- No hay commits nuevos: HEAD sigue en `44845ca fix(participantes)...`

## 4. Siguiente paso recomendado (orden)
1. Confirmar A7 con consulta §0 (RLS de la vista). Si falla → es lo primero, antes que todo.
2. Parche SQL: `listar_usuarios_con_accesos()` filtrar por org del admin que llama.
3. Parche SQL: `emitir_constancia` + `completo_el_curso` exigir misma `organizacion_id`.
4. Revisar RLS `perfiles` para `notas_admin` (vista separada sin notas o función con máscara).
5. Recién entonces: commit + build + smoke de los 5 archivos del §1.
