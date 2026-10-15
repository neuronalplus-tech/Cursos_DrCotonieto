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

### 2026-10-13 — E03 F5-3 Encuestas NPS + marca blanca CSS (verificado por el dueño)
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
- **Estado:** ✅ ESTADO.sql filas 47 y 48 «ya están» (verificado 13-oct por el dueño).
   Sin esas dos, la encuesta no aparece y el tablero avisa; el resto del curso funciona igual.

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

### 2026-10-13 — E05 F6-3 Relay de correo autenticado (cierra B1)
- **Qué:** el hallazgo B1 decía que cualquiera con la URL del Apps
  Script podía mandar correo desde la cuenta del doctor. Ahora el
  navegador no llama al Apps Script: llama a la nueva
  `supabase/functions/correo-enviar/index.ts`, que exige sesión +
  fila en `admins` o `facilitadores`, lista cerrada de tipos de
  correo, frenos F6-2 (512 KB de cuerpo, 30/min por IP, 20/min por
  gestor) y una entrada en `auditoria` (tabla `correo-enviar`,
  operación `CORREO`/`INTENTO`; el `ping` y lo público no se
  anotan). El único caso sin sesión es `solicitud-materiales`
  (formulario del taller), que la función rearma sola: solo correo
  válido y título del curso, nada más se reenvía. El Apps Script
  (`apps-script/Notificador.gs` → `2026-10-13.v5-secreto`) exige
  además el secreto compartido `CORREO_SECRETO` en cada petición
  (propiedad de script; si falta, se niega todo —es a propósito—).
  `src/lib/correo.js` reescrito: se retiró el JSONP (la URL en el
  bundle era el agujero) y `enviarCorreo` ahora hace fetch a la
  función con la misma forma de resultado de siempre; se retiró el
  export `LINK_APPS_SCRIPT`. `src/config.js` documenta que
  `APPS_SCRIPT_URL` ya es solo referencia. `supabase/test-correo.mjs`
  ampliado (mock de `PropertiesService` + 4 pruebas de secreto).
  `docs/RECUPERACION_CONTRASENA.md` actualizado (tres despliegues,
  ping con `&secreto=`).
- **Revertir:** `git revert` del commit. A mano: borrar la función
  `correo-enviar`, volver `correo.js` al JSONP (commit anterior),
  y en el .gs quitar `secretoValido` y su llamada y volver VERSION
  a `2026-10-03.v4-fallback-remitente`.
- **Estado:** ⚠️ FALTAN PASOS DEL DUEÑO, en este orden (si se dan
  al revés, el correo se niega a salir hasta que cuadren, a
  propósito): 1) generar un secreto largo; 2) Supabase → Edge
  Functions → Secrets → `CORREO_SECRETO` (opcional `CORREO_URL`);
  3) Apps Script → Propiedades de script → `CORREO_SECRETO` con el
  MISMO valor; 4) desplegar la función `correo-enviar`; 5) subir
  este commit (Cloudflare publica la web); 6) pegar el
  `Notificador.gs` v5 y publicar Nueva versión. Prueba final: ping
  con `&secreto=`, un aviso de recuperación real y la solicitud
  pública de materiales del taller.

### 2026-10-14 — E06 Auditoría tras el Diagnóstico 2 (rama fix-diagnostico-2-blockantes)
- **Qué:** revisión de todo lo hecho desde el traspaso del 13-oct. Arreglos:
  1. `src/components/AdminForo.jsx`: el commit `9c8f817` puso `recargar`
     (useCallback) en las dependencias de un efecto **antes** de
     declararla → ReferenceError al renderizar: la pestaña Foro del panel
     quedaba caída. Se movió la declaración arriba del efecto.
  2. `scripts/smoke-render.jsx` + `.github/workflows/deploy.yml`: el smoke
     ahora renderiza AdminForo/AdminTareas/AdminGeneraciones/AdminCursos
     (con el código de `9c8f817` falla, con el arreglo pasa) y **bloquea
     el deploy** en CI.
  3. `supabase/functions/crear-usuarios/index.ts` — cierra **B2 y A3**: un
     admin de cliente ya no puede pisar la contraseña de una cuenta que ya
     existía si es admin/facilitador o tiene cursos de otra organización
     (se inscribe, pero la contraseña no se toca y el mensaje lo dice), ni
     inscribir en cursos que no son de sus organizaciones (403).
  4. Las tres edge functions: `ilike('email', …)` escapa `_` y `%`
     (`patronExacto`); antes un correo con `_` podía coincidir con otro.
  5. `correo-enviar` + `TallerRecursos.jsx`: la puerta pública
     `solicitud-materiales` toma el título del curso de la base por id
     (antes el anónimo escribía el asunto del correo que salía del Gmail
     del doctor).
  6. `src/lib/encuestas.js` `sanearCss`: descarta escapes `\`, comillas,
     `image-set`, `src()` y comentarios (`u\72l(` y `image-set("…")`
     pasaban el filtro). 4 pruebas nuevas en `test-encuestas.mjs` (25/25).
  7. `Admin.jsx` (historial de comunicados): reconoce `PGRST205` como
     «falta la tabla»; antes, sin el SQL, quedaba «Cargando historial…»
     para siempre. `TableroOrg.jsx` y `EncuestaNps.jsx`: reconocen
     `PGRST202` como «falta la función».
- **Revertir:** `git revert` del commit de esta entrada.
- **Estado:** sin SQL nuevo. ⚠️ Hay que **volver a desplegar** las edge
  functions `crear-usuarios`, `correo-enviar` y `whatsapp-enviar` en
  Supabase para que los arreglos 3-5 tengan efecto (el front solo no basta).

