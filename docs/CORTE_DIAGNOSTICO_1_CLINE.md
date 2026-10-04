# Corte diagnóstico 1 — Cline
## Ecosistema open source para el EVA (Entorno Virtual de Aprendizaje)

> **Proyecto:** `Cursos_DrCotonieto` — Dr. Ernesto Cotonieto
> **Repositorio:** https://github.com/neuronalplus-tech/Cursos_DrCotonieto
> **Rama:** `main`
> **Fecha del corte:** 2 de octubre de 2026
> **Autor del análisis:** Cline (agente de código)
> **Tipo de documento:** Diagnóstico + comparativa + recomendaciones (no ejecuta cambios)

---

## ⚠️ LECCIÓN PERMANENTE — Correo: los permisos de Google Apps Script

> **Si estás leyendo esto y los correos "no llegan", empieza por aquí.**
> Resuelto el 3 de octubre de 2026. Costó varias sesiones de diagnóstico.

### El síntoma

El Apps Script respondía `200 OK`, el `ping` funcionaba, la página mostraba
"✓ enviado"... pero **no llegaba ningún correo**, ni a la bandeja de entrada ni
a "Enviados" de Gmail.

### La causa real

**Google Apps Script no había autorizado el envío de correo.** El proyecto
nunca se había ejecutado *desde el editor*, y el primer uso de `GmailApp`
(o `MailApp`) mediante una web app **externa** no dispara el consentimiento.

Consecuencia: el script corría, pero `GmailApp.sendEmail()` fallaba por falta
de autorización, y el fallo quedaba escondido detrás de un `catch` genérico.

### La solución

Ejecutar **una vez** una función desde el propio editor y aprobar los permisos:

1. Apps Script → en el desplegable de funciones elige **`testEnviar`**.
2. Pulsa **▶ Ejecutar**.
3. Acepta los permisos que pide Google ("Enviar correo en tu nombre",
   "Acceder a tus datos"). Google pedirá la cuenta; acepta.
4. Listo. A partir de ahí el envío funciona desde la web.

Esa función `testEnviar()` existe en `apps-script/Notificador.gs` justamente
para este propósito: manda un correo con lo mínimo (sin `from`, sin `replyTo`)
y devuelve el resultado.

### Regla para futuros despliegues

> **Todo script de Apps Script nuevo, o al añadir un servicio nuevo
> (Gmail, Drive, Calendar…), debe probarse una vez desde el editor con ▶**
> antes de confiar en que funcionará desde la web.

### Trampas relacionadas (también hubo que aprenderlas)

| Trampa | Qué pasar | Cómo evitarla |
|---|---|---|
| **`fetch(..., {mode:'no-cors'})`** | El navegador descarta la respuesta: **imposible saber si se envió**. El panel decía "✓ enviado" siempre. | Ya no se usa. Ver `src/lib/correo.js`. |
| **`?callback=` de Google** | **No envuelve la salida** (comprobado en un deployment real). El callback nunca se llamaba y todo iba a timeout. | El script devuelve él mismo `window.__appsCorreoRespuesta(reqid, {...})`. |
| **Deployment desactualizado** | El editor se ve bien pero la URL sigue sirviendo código viejo. | El `ping` devuelve `version`; si no aparece, el deployment está viejo. **Ctrl+S no basta: hay que ir a *Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión*.** |
| **Varios deployments** | Cada implementación tiene su URL. Editar una mientras la web llama a otra = cambios invisibles. | Una sola implementación activa. Borrar las viejas. |
| **`from` inválido** | Solo válido si es un **alias real** de la cuenta. Si no, Gmail responde *"Argumento no válido"* y **no sale ningún correo**. | `CONFIG.remitente` va **vacío a propósito**: sin `from`, Gmail envía desde la cuenta del script. |
| **Sintaxis válida ≠ código bien colocado** | Un error de inserción puso helpers dentro de un `catch`. `node --check` pasaba, pero el código era inalcanzable. | Existe `supabase/test-correo.mjs`: ejecuta el `.gs` con stubs y verifica comportamiento. |

### Herramientas de diagnóstico incluidas

- **`testEnviar()`** — envía un correo mínimo y devuelve `OK` o el error.
- **`testEstado()`** — muestra `version`, `remitente` y `cuenta`.
- **`ping` por HTTP** — devuelve `version`, `remitenteEnElScript` y `cuentaQueEnvia`:

```
https://script.google.com/macros/s/<ID>/exec?payload=%7B%22tipo%22%3A%22ping%22%7D
```

Si ese ping **no** trae `version`, el deployment está sirviendo código viejo.

### Cómo probar el circuito sin abrir la web

```powershell
$id = '<ID-del-deployment>'
$base = "https://script.google.com/macros/s/$id/exec"
$body = '{"tipo":"recurso-nuevo","curso":{"titulo":"Prueba"},"alumnos":[{"email":"correo@destino.com"}]}'
Invoke-WebRequest -Uri "$base`?payload=$([System.Uri]::EscapeDataString($body))" -UseBasicParsing
```

Respuesta buena: `{"ok":true,"enviados":1,...}`.

### Pendiente conocido: plantilla con la marca

El 3 de octubre de 2026 se intentó meter una plantilla HTML con la marca
(bloque `MARCA` en el script, con botones y vista previa). **Se revirtió a
petición del Dr. Ernesto**: el envío funciona mejor simple y el formato se
hará **a mano**.

> No reintroducir la plantilla sin confirmarlo antes. La versión vigente es la
> simple, con `envolver()` y el bloque `CONFIG` al principio del archivo.

---

## Nota de alcance y limitaciones

- Se leyó íntegramente el código local de `Cursos_DrCotonieto`: `src/App.jsx` (~5.6k líneas), `src/App (1).jsx` (respaldo), `package.json`, `vite.config.js`, `wrangler.jsonc`, `_redirects`, `.gitignore`.
- Se revisaron las fichas/READMEs, licencias y stacks de cada repositorio externo citado.
- **No** se ejecutó el backend real (requiere credenciales de Supabase) ni se clonaron los repos externos.
- Los precios citados son los publicados por cada proveedor a la fecha de consulta y **pueden cambiar**. Verificar antes de contratar.
- No se realizaron cambios de código en este corte; es un documento de decisión.

---

## 1. Diagnóstico de tu entorno actual (línea base)

### 1.1 Stack detectado

| Capa | Tecnología actual |
|---|---|
| Frontend | React 18 + Vite (SPA) — monolito `src/App.jsx` |
| Routing | `react-router-dom` v6 (7 rutas) |
| Backend / DB / Auth | **Supabase** (`@supabase/supabase-js`): Postgres + Auth + Storage + Realtime + Edge Functions (Deno) |
| Archivos | Buckets Supabase `curso_duelo`, `talleres`, `avatares`, `chat_adjuntos` + **OneDrive** (enlaces `1drv.ms`) |
| Visor PDF | `pdfjs-dist` (visor propio integrado) |
| Export PDF | `jspdf` (constancias) |
| Correo | **Google Apps Script** (`APPS_SCRIPT_URL`) |
| Despliegue | Cloudflare Pages/Workers (`wrangler.jsonc`, `_redirects`) + sitio Netlify |

### 1.2 Funcionalidades ya implementadas (línea base funcional)

| Área | Implementación existente |
|---|---|
| Catálogo de cursos | Tabla `cursos` (`activo`, `orden`, `gratuito`, `proximamente`, `constancia`, `rutas_botones`) |
| Estructura | Tabla `modulos` (`activo`, `orden`, `grupo`, `oculto`, `disponible`) |
| Recursos | Tabla `recursos` tipos **pdf / video / word / enlace / autoevaluacion** |
| Anclaje de enlaces | `analizarUrl()` + `<EmbedFrame>` + `<VideoPlayer>` (detección de URLs embebibles) |
| Evaluaciones | `examenes` / `intentos_examen` (autocalificación, `umbral_aprobacion`, historial, mejor intento) |
| Mensajería interna | Tabla `mensajes` con **Supabase Realtime** + adjuntos + RPC `get_admin_id` |
| Perfiles | Tabla `perfiles` + avatares en Storage |
| Control de acceso | Tabla `acceso` + RPC `bulk_grant_course_access` / `bulk_remove_course_access` |
| Panel admin | Vista `vista_admin_inscripciones`, RPC `listar_usuarios_con_accesos`, `notas_admin`, filtros |
| Métricas | Tasa de finalización, activos 30 d, alumnos en riesgo, inscripciones/mes |
| Comunicados | Segmentados (todos / curso / inactivos / activos / completaron) vía Apps Script |
| Constancias | Componente `Constancia` con `jsPDF` |
| Leads talleres | Tabla `leads_talleres` |
| Roles | Tabla `admins` (verificación por email) |

### 1.3 Brechas respecto a "grandes plataformas"

- Clases en vivo (video) integradas en la plataforma.
- Correo con *tracking* de apertura/clics y secuencias automáticas (drip).
- Tipos de pregunta más allá de opción múltiple.
- SCORM / LTI (interoperabilidad con estándares educativos).
- Foros / comunidad por cohorte.
- Notificaciones push.
- Analítica de comportamiento de uso.
- Pasarela de pago para cursos/talleres.
- Arquitectura: **monolito `App.jsx` de ~5.600 líneas** (riesgo de mantenimiento).

---

## 2. Comparativa de plataformas integrales (LMS)

| Plataforma | Repo | Licencia | Stack | Fuerte en | Costo gratis / mínimo pago | ¿Reemplaza tu app? |
|---|---|---|---|---|---|---|
| **Moodle** | `moodle/moodle` | GPL-3.0 | PHP + MySQL/MariaDB (+Redis) | 1.700+ plugins, tipos de examen, insignias, roles, SCORM, LTI | Autohospedaje gratis; Moodle Partner ~US$100+/año | Sí, pero pierdes tu diseño |
| **Chamilo** | `chamilo/chamilo-lms` | GPL-3.0 | PHP + MySQL | Ligerísimo (2–4 GB RAM), fácil para 1º SysAdmin, certificados, red social | Gratis autohospedado | Parcial |
| **Open edX (Tutor)** | `overhangio/tutor` + Open edX | AGPL-3.0 | Python/Django + MySQL + Mongo + Elasticsearch | MOOC a escala, analítica avanzada | Gratis, pero requiere **16–32 GB RAM** | Sobredimensionado |
| **Canvas LMS (OSS)** | `instructure/canvas-lms` | AGPL-3.0 | Ruby on Rails + Postgres + Redis + Cassandra | Integraciones API, *Gradebook* profesional | Requiere 12–24 GB RAM + DevOps Rails | No (ya tienes "Canvas for Teacher" gratis) |
| **Frappe LMS** | `frappe/lms` | AGPL-3.0 | Python (Frappe) + Vue | UI limpia, quizzes, **certificados**, batches, pagos | Gratis; Frappe Cloud ~US$5–10/mes | Sí (más simple que Moodle) |
| **LearnHouse** | `learnhouse/learnhouse` | AGPL-3.0 | Next.js + FastAPI + Postgres | Editor tipo Notion, bloques, *playgrounds* IA, certificados, multi-org | Gratis (CLI `npx learnhouse`); Enterprise para pagos/SSO | Sí, moderno |
| **ClassroomIO** | `classroomio/classroomio` | AGPL-3.0 | SvelteKit + **Supabase** | ¡Usa tu misma stack! cursos, ejercicios, IA, Docker | Gratis self-host; nube desde ~US$0 | **Muy alineado** |
| **CourseLit** | `codelitdev/courselit` | AGPL-3.0 | TS/Node + MongoDB | Web builder, venta con Stripe, analítica básica | Gratis; nube 14 días trial | Complementario |

**Lectura rápida:** tu app **ya cubre** el 80 % de lo que ofrecen Frappe LMS / LearnHouse / ClassroomIO para tu caso. No conviene "migrar" a Moodle / Canvas / Open edX salvo que necesites SCORM, LTI o miles de alumnos simultáneos. Lo que sí conviene es **tomar prestado** componentes puntuales (ver §3).

---

## 3. Comparativa por necesidad específica

### 3.A — Video y clases en vivo

| Herramienta | Repo / Licencia | Qué aporta | Gratis / mínimo pago |
|---|---|---|---|
| **Jitsi Meet** | `jitsi/jitsi-meet` · Apache-2.0 | Videoconferencia, chat, encuestas, **iframe embebible**, grabación | `meet.jit.si` gratis; self-host o JaaS (8x8) pago |
| **BigBlueButton** | `bigbluebutton/bigbluebutton` · LGPL-3.0 | Aula virtual: pizarrón multi-usuario, salas de grupos, **grabación**, dashboard analítico, LTI | Gratis (Ubuntu 22.04, instala en ~30 min) |
| **Cloudflare Stream** | Cloudflare · SaaS | Video hosting + live + DRM ligero | **US$5/mes por 1.000 min almacenados** + US$1 por 1.000 min entregados |
| **Bunny Stream** | bunny.net · SaaS | Streaming/CDN barato, 14 días trial | **US$1 mínimo/mes**; ~US$0.01/GB (EU/NA) |
| **PeerTube** | Framasoft · AGPL | Video federado P2P | Gratis self-host |

**Recomendación:** hoy usa **Jitsi gratuito embebido** (`meet.jit.si`) para las sesiones en vivo (reemplaza Zoom/Dropbox de grabaciones). Al escalar → **Bunny Stream** (más barato que Cloudflare Stream para tu volumen) o **BigBlueButton** si quieres grabación automática + analítica de aula.

### 3.B — Correo y campañas

| Herramienta | Licencia | Aporta | Gratis / pago |
|---|---|---|---|
| **Resend** | SaaS | API moderna, tracking, React Email | **Free 3.000 emails/mes** (100/día); Pro **US$20/mes** (50k) |
| **Brevo** | SaaS | Envío masivo + CRM | Free 300 emails/día |
| **Listmonk** | `knadh/listmonk` · AGPL-3.0 | Newsletter self-host, binario único, métricas | Gratis (self-host) |
| **Mautic** | `mautic/mautic` · GPL | Automatización de marketing (secuencias, *drip*) | Gratis self-host |

**Recomendación:** tu `Apps Script` es frágil y sin *tracking*. Migra a **Resend** (gratis 3.000/mes, suficiente) y, si montas secuencias automáticas de *onboarding*, usa **Mautic** o **Listmonk** self-hosted.

### 3.C — Formularios, exámenes y encuestas

| Herramienta | Licencia | Aporta | Gratis |
|---|---|---|---|
| **Formbricks** | `formbricks/formbricks` · AGPL-3.0 | Encuestas tipo Qualtrics, lógica, in-app, integraciones | Gratis core |
| **LimeSurvey** | GPL | Cuestionarios avanzados (ramos, puntajes) | Gratis self-host |
| **Google Forms** | SaaS | Rápido y conocido | Gratis |

**Recomendación:** tu tabla `examenes` ya autocalifica. Para **encuestas de satisfacción (CSAT) por curso**, añade **Formbricks** embebido; para exámenes con más tipos de pregunta, extiende tu tabla `examenes` (recomendado) o usa LimeSurvey.

### 3.D — Soporte, mensajería y comunidad

| Herramienta | Licencia | Aporta | Gratis |
|---|---|---|---|
| **Chatwoot** | `chatwoot/chatwoot` · MIT | Bandeja compartida multicanal (web, email, WhatsApp), CSAT, respuestas rápidas | Gratis self-host; nube ~US$19/agente |
| **Discourse** | `discourse/discourse` · GPL-2.0 | Foro, categorías, grupos, mensajes privados | Gratis (VPS ~US$10–20/mes) |
| **Matrix / Element** | Apache-2.0 | Chat E2E | Gratis |

**Recomendación:** tu mensajería interna (Realtime) está bien. Añade **Chatwoot** solo si quieres atender dudas externas (pre-inscripción) en un solo lugar. **Discourse** si necesitas un foro por cohorte.

### 3.E — Automatización, analítica y almacenamiento

| Herramienta | Licencia | Aporta | Gratis / pago |
|---|---|---|---|
| **n8n** | `n8n-io/n8n` · Fair-code | Conecta Supabase → correo → hojas; 1.500 integraciones + IA | Self-host gratis; nube ~US$24/mes |
| **Umami** | `umami-software/umami` · MIT | Analítica web sin cookies | Self-host gratis; nube ~US$9/mes |
| **Plausible / Matomo** | AGPL / GPL | Alternativas de analítica | Self-host gratis |
| **Cloudflare R2** | Cloudflare · SaaS | Almacenamiento S3 | **Free 10 GB**, luego **US$0.015/GB-mes**, **egress gratis** |
| **Backblaze B2** | SaaS | Almacenamiento barato | Free 10 GB |
| **Supabase Storage** | (ya lo usas) | Integrado | Free 1 GB; incluido en Pro (100 GB) |
| **OneDrive** | (ya lo usas) | 1 TB | Ya pagado |

**Recomendación de almacenamiento:** tu `OneDrive 1 TB` es perfecto para **materiales estáticos y embeds manuales**, pero para archivos servidos por la app usa **Cloudflare R2** (egress gratis = clave), sobre todo **videos**.

### 3.F — Certificados e insignias

| Herramienta | Licencia | Aporta | Gratis |
|---|---|---|---|
| **jsPDF** (ya lo usas) | MIT | PDF de constancia | Gratis |
| **Open Badges / Badgr** | Open source | Insignias verificables digitales | Gratis self-host |

---

## 4. Matriz de decisión (qué adoptar según necesidad)

| Si tu necesidad es… | Adopta (gratis) | Al escalar (pago mínimo) |
|---|---|---|
| Clases en vivo | Jitsi (`meet.jit.si` embed) | BigBlueButton (grabación+analítica) o JaaS |
| Video alojado propio | OneDrive + embed actual | **Bunny Stream** (~US$1+/mes) o Cloudflare Stream |
| Correo transaccional/masivo | **Resend Free** (3.000/mes) | Resend Pro **US$20** o Brevo |
| Secuencias automáticas | Mautic / Listmonk self-host | n8n Cloud ~US$24 |
| Exámenes avanzados | Extender tu `examenes` | LimeSurvey |
| Encuestas / CSAT | **Formbricks** | Plan nube |
| Foro por cohorte | Discourse (VPS) | VPS gestionado |
| Analítica de uso | **Umami** self-host | Umami Cloud ~US$9 |
| Almacenamiento masivo | R2 free 10 GB | R2 US$0.015/GB (egress gratis) |
| Backend / DB / Auth | Supabase Free | **Supabase Pro US$25/mes** |

---

## 5. Recomendaciones por horizonte

### 5.1 Corto plazo (0–4 semanas) — todo gratis

| # | Acción | Herramienta | Impacto | Costo |
|---|---|---|---|---|
| 1 | Reemplazar Apps Script por **Resend** para comunicados con *tracking* de apertura/clics | Resend Free | Alto | $0 |
| 2 | Embeber **Jitsi** en el recurso tipo `video`/`enlace` para clases en vivo | Jitsi | Alto | $0 |
| 3 | Añadir **Cloudflare R2** para PDF/videos pesados (aliviar el 1 GB de Supabase) | R2 | Alto | $0 (10 GB) |
| 4 | Instalar **Umami** self-host para saber qué recursos se abren más | Umami | Medio | $0 |
| 5 | Endurecer el **anclaje de enlaces**: validar dominios permitidos en `analizarUrl()` y mostrar *preview* (Open Graph) | Código propio | Medio | $0 |
| 6 | Mover reglas de negocio a **Edge Functions** y dividir `App.jsx` en módulos | Refactor | Alto (mantenibilidad) | $0 |
| 7 | Añadir **tipos de pregunta** a `examenes` (V/F, respuesta corta, emparejar) | Código propio | Medio | $0 |

### 5.2 Mediano plazo (1–6 meses) — pago mínimo

| # | Acción | Herramienta | Costo aprox. |
|---|---|---|---|
| 8 | Migrar DB/Auth a **Supabase Pro** al superar 500 MB | Supabase Pro | **US$25/mes** |
| 9 | Video profesional con CDN + reproductor | **Bunny Stream** | desde **US$1/mes** + consumo |
| 10 | Automatizaciones (alta de usuario → bienvenida → recordatorio de módulo) | **n8n** self-host | $0 (o ~US$24 nube) |
| 11 | Grabación automática de clases + analítica de aula | **BigBlueButton** | VPS 4–8 GB (~US$10–20/mes) |
| 12 | Foro/comunidad por curso | **Discourse** | VPS ~US$10–20/mes |
| 13 | CSAT y encuestas post-curso | **Formbricks** | $0 / nube |

### 5.3 Largo plazo (6–18 meses) — escalamiento

| # | Acción | Herramienta | Costo aprox. |
|---|---|---|---|
| 14 | Multi-docencia / multi-programa con roles finos | Extender `admins` → tabla `roles` + RLS | incluido |
| 15 | Pagos de cursos/talleres | Stripe o **Frappe LMS / CourseLit** (Stripe) | comisión ~2.9 % |
| 16 | Insignias verificables (Open Badges) | Badgr self-host | $0 |
| 17 | Analítica avanzada de aprendizaje (xAPI / LRS) | Learning Locker / Moodle si migras | variable |
| 18 | Considerar LMS maduro **solo si** necesitas SCORM/LTI/acreditación | Moodle / Frappe LMS | US$100+/año hosting |
| 19 | SSO institucional (Google/Microsoft) | Supabase Auth + RLS | Pro |
| 20 | DRM / protección de video | Bunny Media Cage / Cloudflare | consumo |

---

## 6. Arquitectura sugerida (de $0 a pago mínimo)

```
HOY (gratis):
React/Vite (Cloudflare Pages) → Supabase Free (DB/Auth/Storage/Realtime)
  → Resend Free (correo)  → Jitsi embed (vivo)  → OneDrive (1 TB materiales)

ESCALA (pago mínimo, ~US$26–50/mes):
React/Vite → Supabase Pro ($25)  → Cloudflare R2 (archivos, egress gratis)
  → Bunny Stream ($1+) (video)  → n8n self-host (automatización)
  → Umami (analítica)  → BigBlueButton (aula en vivo con grabación)
```

---

## 7. Riesgos y consideraciones

- **Lock-in de licencias AGPL** (Frappe LMS, LearnHouse, ClassroomIO, Open edX): si las usas como servicio, debes publicar tus modificaciones. Moodle (GPL-3) y Chamilo son más permisivas para uso interno.
- **Supabase Free** pausa proyectos tras 1 semana de inactividad y tiene 2 proyectos máximo → a producción, Pro.
- **`1drv.ms`** no es estable para *hotlinking* masivo; para escalar, migra los assets a R2.
- **Monolito `App.jsx`**: a más funciones (vivo, correo, foro) más difícil de mantener; dividir por dominio antes de crecer.
- **Autohospedaje** (Jitsi / BBB / Discourse / n8n) requiere un VPS y algo de DevOps; si no quieres administrarlo, paga la versión nube.
- **Precios**: las cifras son referencias publicadas y pueden cambiar; verifica antes de contratar.

---

## 8. Conclusión

No necesitas **reemplazar** tu plataforma: ya es más completa que muchas soluciones gratuitas para tu escala. La estrategia óptima es **componer** (*composable LMS*):

- **Gratis ahora:** Resend + Jitsi + Cloudflare R2 + Umami + refactor del monolito.
- **Pago mínimo al escalar:** Supabase Pro (US$25) + Bunny Stream (US$1+) + VPS para n8n/BigBlueButton.
- **Solo migrar a un LMS maduro** (Moodle / Frappe) si aparecen requisitos duros: SCORM/LTI, acreditación o >10.000 usuarios concurrentes.

---

## 9. Fuentes consultadas

Repositorios y documentación revisados (a la fecha del corte):

- Moodle — https://github.com/moodle/moodle
- Chamilo LMS — https://github.com/chamilo/chamilo-lms
- Frappe LMS — https://github.com/frappe/lms
- LearnHouse — https://github.com/learnhouse/learnhouse
- ClassroomIO — https://github.com/classroomio/classroomio
- CourseLit — https://github.com/codelitdev/courselit
- Tutor (Open edX) — https://docs.tutor.edly.io/
- Jitsi Meet — https://github.com/jitsi/jitsi-meet
- BigBlueButton — https://github.com/bigbluebutton/bigbluebutton
- Listmonk — https://github.com/knadh/listmonk
- Mautic — https://github.com/mautic/mautic
- Formbricks — https://github.com/formbricks/formbricks
- Chatwoot — https://github.com/chatwoot/chatwoot
- Discourse — https://github.com/discourse/discourse
- n8n — https://github.com/n8n-io/n8n
- Umami — https://github.com/umami-software/umami
- Supabase Pricing — https://supabase.com/pricing
- Cloudflare R2 Pricing — https://developers.cloudflare.com/r2/pricing/
- Cloudflare Stream Pricing — https://developers.cloudflare.com/stream/pricing/
- Bunny.net Pricing — https://bunny.net/pricing/
- Resend Pricing — https://resend.com/pricing

---

*Fin del corte diagnóstico 1. Documento de referencia; no implica cambios en el código.*