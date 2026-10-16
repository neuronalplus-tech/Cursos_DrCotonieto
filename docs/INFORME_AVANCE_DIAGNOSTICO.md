# Informe de avance — pendientes del diagnóstico

Fecha: 2026-10-16
Rama: main (74ea0b5 + cambios locales por subir)

## 1. Lo que SÍ se logró (frontend, verificado en diff)

### B5 — respuestas de examen al navegador
Archivo: `src/components/ExamenModulo.jsx`
- L39: `select('*')` → columnas explícitas (`id, titulo, descripcion, preguntas, aleatorio_n, mezclar_opciones, activo, max_intentos, umbral_aprobacion, curso_id, modulo_id, limite_minutos`).
- L342: `(juego || (examen?.preguntas || []).map(limpiarPregunta) || [])` — el render limpia antes de pintar.
- Efecto: el render ya no muestra respuestas aunque vengan en el objeto.
- Límite honesto: `examen.preguntas` completo sigue llegando al navegador en la carga inicial; el cierre total exige que `servir_examen()` sea la única fuente.

### A7 — vista_admin_inscripciones acotada en frontend
Archivo: `src/components/Admin.jsx` (`recargarInscripciones`, L347-355)
- El equipo centralizó la recarga; este cambio suma el filtro por org en la consulta (`if (organizacion?.id) consulta = consulta.eq('organizacion_id', organizacion.id)`) + filtro por cursos de la org en memoria.
- Los 4 refrescos (alta, alta masiva, dar/quitar acceso, acción masiva) usan esa vía.
- Efecto: el panel ya no pide el padrón completo desde esos puntos.

### A1 (parcial) — fugas entre organizaciones en frontend
- `src/components/CursoView.jsx`: `useOrganizacion` + `.eq('organizacion_id', ...)` + `.eq('curso_id', curso.id)` en `vista_admin_inscripciones`.
- `src/components/MensajesInbox.jsx`: `useOrganizacion` + `.eq('organizacion_id', ...)` en contactos.
- `src/lib/correo.js` `obtenerEmailsInscritos()`: `.eq('curso_id', cursoId)` en servidor (antes traía todo y filtraba en memoria).

## 2. Lo que NO se logró / sigue abierto

> No se tocó SQL ni Edge Functions en esta ronda. La seguridad real (RLS) sigue sin verificarse en servidor.

- **A7 fondo (30 seg §0): NO confirmado.** El filtro por `organizacion_id` es solo frontend. Si la vista `vista_admin_inscripciones` o su RLS no filtra por organización, cualquier usuario puede quitar el filtro en consola y leer el padrón completo. Falta correr la consulta del §0 contra Supabase. Si falla → pasa a ser lo primero.
- **A1 fondo:** el frontend filtra, pero la seguridad real es RLS en `acceso`, `perfiles`, `vista_admin_inscripciones`. No verificado.
- **A2 — enlaces de recuperación:** no se modificó `supabase/functions/crear-usuarios/index.ts`. No se confirmó si valida la organización del emisor. Sigue abierto.
- **A4 — constancia autoemitida:** no se modificó `CONSTANCIAS_3_APROBACION.sql` ni `CONSTANCIAS_2_EMISION.sql`. `emitir_constancia(p_curso)` solo verifica `tiene_acceso_al_curso()`, no que curso y alumno sean de la misma organización. Sigue abierto.
- **A8 / M2 — folios enumerables y notas privadas:** no se tocó.
  - `listar_usuarios_con_accesos()` devuelve `usuario_id, email, nombre_completo, profesion, notas_admin, ...` de TODOS los `auth.users` si el llamante está en `admins` (cualquier org). Es fuga entre organizaciones + expone `notas_admin`.
  - `verificar_constancia(p_folio)` es pública (anon) por diseño; si los folios fueran predecibles/secuenciales serían enumerables. El folio actual usa `gen_random_uuid()` pero no se auditó unicidad/historial.
  - RLS de `perfiles.notas_admin`: RLS decide por fila, no por columna. `perfil_select` permite a admin/facilitador ver la fila completa (incluye notas). No hay enmascaramiento por columna.

## 3. Evidencia
- `git diff HEAD --stat`: Admin.jsx, CursoView.jsx, ExamenModulo.jsx, MensajesInbox.jsx, lib/correo.js + este informe.
- Conflictos de merge ya resueltos: se conservó `recargarInscripciones()` del equipo (ya filtra por org en memoria) y se sumó el `.eq('organizacion_id')` en la consulta + filtro org+curso en CursoView.
- Build: `npm run build` OK (3.91s, sin errores).

## 4. Siguiente paso recomendado (orden)
1. Confirmar A7 con consulta §0 (RLS de la vista). Si falla → es lo primero, antes que todo.
2. Parche SQL: `listar_usuarios_con_accesos()` filtrar por org del admin que llama.
3. Parche SQL: `emitir_constancia` + `completo_el_curso` exigir misma `organizacion_id`.
4. Revisar RLS `perfiles` para `notas_admin` (vista separada sin notas o función con máscara).
5. Recién entonces: commit + build + smoke de los 5 archivos del §1.
