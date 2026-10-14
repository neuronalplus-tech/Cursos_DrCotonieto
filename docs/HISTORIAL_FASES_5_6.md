# Historial interno Fases 5 y 6 — Directivos / Plataforma / Pasarela de pago

> **Propósito:** dejar rastro reversible de cada cambio. Nada se borra: si algo rompe, se revierte por entrada.
> **Fecha inicio:** 2026-10-13
> **Base:** `docs/CORTE_DIAGNOSTICO_2_CLAUDE.md` + `docs/PLAN_ACCIONES_1_CLAUDE.md` (Fase 5 y Fase 6)

## Convenciones (de TRASPASO_13OCT_CLAUDE.md §4)
1. SQL nuevo: archivo en `supabase/`, idempotente, con cabecera + PRUEBA DE ACEPTACIÓN. Se entrega para correr, nunca se asume corrido.
2. `SECURITY DEFINER` siempre con `set search_path = public` + `revoke`/`grant` explícito.
3. Columnas nuevas nacen en `null`/default que reproduce el comportamiento actual.
4. Frontend degrada con elegancia si falta SQL (`42703` o mensaje PostgREST → reintentar sin esos campos + aviso de qué script falta).
5. Antes de commit: `npm run lint` (0 errores), `npx vite build`, `npm run smoke`.
6. Registrar cada script en `supabase/ESTADO.sql`.
7. F6-1 (pasarela) NO se empieza sin decisión del dueño sobre proveedor + país.

## Entradas (nada se borra, solo se añade)

### 2026-10-13 — E00 Historial creado
- **Qué:** este archivo. Sin cambios de código ni SQL.
- **Revertir:** borrar `docs/HISTORIAL_FASES_5_6.md`.
- **Estado:** sin SQL nuevo pendiente de correr.

### 2026-10-13 — E01 F5-2 Retención INSTALADA (verificado por dueño)
- **Qué:** `supabase/RETENCION_1_ALERTAS.sql` (función `alertas_retencion`),
  `src/lib/retencion.js`, sección «A quién llamar esta semana» en
  `src/components/TableroOrg.jsx`, `supabase/test-retencion.mjs` (22/22 OK),
  fila 45 en `supabase/ESTADO.sql`.
- **Revertir:** `drop function if exists public.alertas_retencion(bigint);`
  + `git revert` del front + quitar fila 45 de ESTADO.sql.
- **Estado:** ✅ ESTADO.sql fila 45 «ya está» (verificado 13-oct por el dueño).
  Fila 24 (`ALMACEN_CHAT_PRIVADO.sql`) sigue «FALTA»: es anterior a este
  trabajo y tiene orden propio (correr SQL → subir código → poner bucket en
  privado); no se toca en esta entrada.

### 2026-10-13 — E02 F5-1 Comunicados: historial + programado (listo, falta correr SQL)
- **Qué:** `supabase/COMUNICADOS_1_HISTORIAL.sql` (tabla `comunicados` + RLS
  por organización, sin borrado a propósito), `src/lib/comunicados.js`
  (etiqueta de destino, fila de historial, programados vencidos),
  `supabase/test-comunicados.mjs` (14/14 OK), fila 46 en `ESTADO.sql`.
  En `src/components/Admin.jsx`: carga del historial al abrir la pestaña,
  registro de cada envío de correo (sin tocar el envío actual), sección
  🗂️ Historial, programar para después (datetime-local + validación de
  futuro), aviso ⏰ de programados vencidos y botón «Marcar enviado».
  Si falta el SQL, avisa qué falta y el envío funciona igual.
- **Revertir:** `drop table if exists public.comunicados;` + `git revert`
  del front y lib + quitar fila 46 de ESTADO.sql.
- **Estado:** ⚠️ FALTA CORRER `COMUNICADOS_1_HISTORIAL.sql` en Supabase.
  Sin cron en el plan gratuito: programar = anotar; el envío lo dispara
  quien programó desde el historial.

### 2026-10-13 — E03 F5-3 Encuestas NPS + marca blanca CSS (listo, faltan correr 2 SQL)
- **Qué:** `supabase/ENCUESTAS_1_NPS.sql` (tablas `encuestas` y
  `respuestas_encuesta` con índice único por alumno+encuesta, RLS,
  RPC `encuesta_del_curso` que crea la encuesta sola con `on conflict`,
  RPC `nps_organizacion` que solo devuelve NPS de la organización que
  administra quien llama), `supabase/MARCA_1_CSS.sql` (columna
  `organizaciones.css_extra`), `src/lib/encuestas.js` (`grupoNps`,
  `calcularNps` que devuelve `null` con menos de 10 respuestas —
  un NPS de 3 respuestas miente —, `resumirNps`, `sanearCss`),
  `supabase/test-encuestas.mjs` (21/21 OK), filas 47 y 48 en
  `ESTADO.sql`. En el front: `src/components/EncuestaNps.jsx`
  (escala 0-10 + comentario, upsert por alumno, solo al 100% de
  progreso y sin chantaje a la constancia), sección «Qué dicen los
  alumnos (NPS)» en `TableroOrg.jsx` con degradado si falta el SQL,
  `css_extra` en `AdminOrganizaciones.jsx` (guardado con reintento
  sin la columna si da `42703`), `aplicarMarca` en
  `src/lib/organizacion.js` inyecta el CSS saneado, y estilos
  `.nps-*` / `.tablero-retencion` en `src/App.css`.
- **Revertir:** `drop table if exists public.respuestas_encuesta;`
  `drop table if exists public.encuestas;`
  `drop function if exists public.encuesta_del_curso(integer);`
  `drop function if exists public.nps_organizacion(bigint);`
  `alter table public.organizaciones drop column if exists css_extra;`
  + `git revert` del front/lib + quitar filas 47 y 48 de ESTADO.sql.
- **Estado:** ⚠️ FALTA CORRER `ENCUESTAS_1_NPS.sql` y `MARCA_1_CSS.sql`
  en Supabase. Sin esas dos, la encuesta no aparece y el tablero
  avisa; el resto del curso funciona igual.

### 2026-10-13 — E04 F6-2 Frenos y bitácora en las edge functions (sin SQL nuevo)
- **Qué:** en `supabase/functions/crear-usuarios/index.ts` y
  `supabase/functions/whatsapp-enviar/index.ts`: **tope de cuerpo**
  (128 KB y 1 MB; primero por la cabecera Content-Length y otra vez
  sobre lo leído, por si la cabecera falta), **límite por
  admin/minuto** en memoria de la instancia (30/min y 10/min; la
  consulta `estado` de WhatsApp no consume cupo porque es lo que hace
  el panel al abrir; capa extra por IP antes de comprobar la sesión,
  120/min y 60/min, solo si llega `x-forwarded-for`), y **una
  entrada en `auditoria` por llamada autenticada** —`ALTA`,
  `ENLACE`, `ENVIO`, `ESTADO` o `INTENTO`— escrita con la clave de
  servicio. Un 4xx/5xx se anota como `INTENTO`; el 429 deja como
  mucho un renglón por ventana (un bombardeo no debe llenar la
  bitácora); las llamadas sin sesión no se anotan (sin autor fiable,
  cualquier anónimo de internet llenaría la tabla). Si falta
  `BITACORA.sql`, la consola avisa con ese nombre y la llamada se
  contesta igual. En `src/components/AdminBitacora.jsx`: verbos
  ALTA/ENLACE/ENVIO/ESTADO/INTENTO, filtro «Cuentas» y «WhatsApp» y
  párrafo de entrada actualizado. En `src/components/Admin.jsx`: el
  envío por API ahora lee el cuerpo del error cuando `invoke`
  devuelve 4xx/5xx, para que el tope se entienda en pantalla (los
  otros caminos ya leían `json.error`).
- **Revertir:** `git revert` del commit es lo limpio. A mano: quitar
  de cada función el bloque «F6-2 · frenos y bitácora» (constantes,
  `apuntar`, `FALTAN_EN_AUDITORIA`, tipos), el bloque `salir` /
  `salidaParaElCatch` y volver cada `return await salir(…)` a
  `return responder(…)` (los de error conservan su cuerpo y código);
  en AdminBitacora quitar los cinco verbos y las dos tablas nuevas;
  en Admin.jsx volver a `if (error) throw error`.
- **Estado:** sin SQL nuevo. Depende de `BITACORA.sql` (fila 7 de
  ESTADO.sql) solo para guardar los renglones; sin él, la consola de
  la función avisa y todo lo demás funciona. El límite es por
  instancia y memoria: se reinicia en cada despliegue y el tope
  efectivo puede ser mayor (nunca menor) si Supabase reparte la
  carga.
