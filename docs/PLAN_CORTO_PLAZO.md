# Plan de corto plazo (0–4 semanas) — Cursos_DrCotonieto

> **Proyecto:** `Cursos_DrCotonieto` — Dr. Ernesto Cotonieto
> **Basado en:** `docs/CORTE_DIAGNOSTICO_1_CLINE.md` (§5.1 Corto plazo)
> **Fecha:** 2 de octubre de 2026
> **Autor:** Cline (agente de código)
> **Tipo de documento:** plan de implementación (define dependencias, orden y responsables)

---

## Criterios rectores

1. **Gratis y sin mantenimiento propio** (evitar VPS / DevOps).
2. **Aprovechar lo que ya pagas:** Microsoft 365 Family (Teams + OneDrive 1 TB) y Cloudflare.
3. **Riesgo controlado:** cambios pequeños, verificados con `vite build`, reversibles con `git revert`.
4. **No romper producción:** cada cambio se prueba en local antes de publicar.

---

## 1. Decisiones / acciones que necesito de ti

| # | Acción tuya | Para qué sirve | Costo |
|---|---|---|---|
| **D1** | Decidir si compramos **dominio propio** (ej. `drcotonieto.com`) vía Cloudflare Registrar | Habilita correo con *tracking* (Resend), analítica automática y sitio con marca | ~US$10/año |
| **D2** | Crear cuenta **Resend** (gratis) + API key + verificar dominio | Comunicados con métricas de apertura/clics | $0 |
| **D3** | ~~Activar **Cloudflare Web Analytics** y pasarme el *snippet*~~ ✅ **Recibido** (token `07cbd488…`) | Métricas de visitas | $0 |
| **D4** | Crear **bucket R2** + API token | Alojar PDF/videos pesados fuera del 1 GB de Supabase | $0 (10 GB) |
| **D5** | Confirmar acceso al **proyecto Supabase** (o compartir el SQL del esquema) | Edge Function de correo y tipos de pregunta | $0 |
| **D6** | ~~Decidir **Jitsi o Teams**~~ ✅ **Decidido 02/10: Teams** | Diseño de la clase en vivo | $0 |

> Nota: **D1 no es indispensable** para los pasos 2 y 3 (Jitsi y analítica). Solo es necesaria para el correo con *tracking*.

---

## 2. Orden de ejecución propuesto

El orden respeta **dependencias** (qué habilita a qué) y prioriza **valor/costo**:

| Orden | Acción | Depende de | Quién | Riesgo |
|---|---|---|---|---|
| **1** | Clases en vivo con **Teams (liga externa)** | nada | ✅ Decidido | Bajo |
| **2** | **Cloudflare Web Analytics** | D3 | ✅ Hecho (beacon en vivo) | Bajo |
| **3** | **Archivos pesados en R2** | D4 | Tú (bucket) + Yo (código) | Medio |
| **4** | **Comunicados con tracking (Resend)** | D1 + D2 + D5 | Tú (cuentas) + Yo (código) | Medio |
| **5** | **Refactor de `App.jsx` en módulos** | — | Yo (por etapas) | Alto (autorizar) |
| **6** | **Tipos de pregunta en `examenes`** | D5 | Yo | Medio |

---

## 3. Detalle por acción

### 3.1 Clases en vivo — **Decisión 02/10: Teams (liga externa), Jitsi descartado para producción**
- **Qué:** los botones de sesión en vivo (Jitsi, Teams, Meet) se muestran como **liga externa "Unirse ↗"** (sin iframe).
- **Por qué se descartó Jitsi embebido:** `meet.jit.si` corta el iframe a los **5 min** ("demo purposes", exige JaaS de pago para producción: Developer gratis 25 MAU, Basic $99/mes) y **ya no ofrece grabar en la nube** (issue #16024 confirmado). Para clases con datos sensibles que requieren **iniciar/detener grabación**, Teams es superior.
- **Teams (M365 Family, ya pagado):** graba con **Más opciones → Iniciar/detener grabación** en cualquier momento (avisa a todos), guarda en **OneDrive/SharePoint** (chat de la reunión), y de ahí se **descarga y sube** a OneDrive/Supabase para embeberlo como grabación (mecanismo `1drv.ms` actual). **Ojo:** por defecto la grabación se crea como archivo normal en tu OneDrive — **tú decides cuándo detenerla** antes de datos sensibles; la "grabación automática" es opt-in por reunión.
- **Qué hice:** `analizarUrl()` marca Jitsi como `embeddable:false` (commit pendiente) — quita el botón "Ver aquí" para evitar el corte de 5 min.

### 3.2 Analítica con Cloudflare Web Analytics — **LISTO en código**

> **Estado (02/10/2026):** beacon integrado en `index.html` (token `07cbd488…`)
> tras recibir tu snippet (D3 ✅). Commit `a58ff09`, **pusheado a GitHub**, y
> verificado en el sitio en vivo: `/` sirve `index-f1c080b6.js` **con el beacon**.
> Las métricas ya deben estar llegando a tu panel de Cloudflare Web Analytics.
- **Qué:** saber cuántas visitas y **qué recursos/cursos se abren más**.
- **Por qué:** **reemplaza a Umami self-host** (que exigiría un servidor). Es **gratis, sin cookies y sin servidor**.
- **Qué necesito de ti:** en el panel de Cloudflare → *Web Analytics* → *Add a site* (hostname `cursos-drcotonieto.neuronal-plus.workers.dev`) → copiarme el **JS snippet** (token público, no es secreto).
- **Qué haré yo:** insertar el *snippet* en `index.html` (antes de `</body>`) y verificar el build.

### 3.3 Archivos pesados en Cloudflare R2 — **paso 3**
- **Qué:** mover **PDF y videos pesados** de Supabase (1 GB gratis) a **R2** (10 GB gratis, **egress sin costo**).
- **Por qué:** evita que Supabase se llene y se pause; abarata servir archivos.
- **Qué necesito de ti:** en Cloudflare → **R2** → crear un bucket (ej. `cursos-drcotonieto`) + **API token** con permiso de escritura. (Definir si el acceso será público con dominio o *signed URLs*.)
- **Qué haré yo:** adaptar la **subida** (panel admin) y la **descarga/visualización** (`PdfViewer`, `VideoPlayer`, `RecursoCard`) para leer de R2, manteniendo compatibilidad con lo existente. Migración **gradual** (archivo por archivo), sin romper enlaces actuales.

### 3.4 Comunicados con *tracking* (Resend) — **paso 4**
- **Qué:** enviar comunicados y saber **quién abrió y quién hizo clic**, con plantillas y mejor entregabilidad (que no caigan en spam).
- **Por qué:** tu `Apps Script` actual funciona pero **no da métricas** y es frágil.
- **Requisitos:** **dominio propio (D1)** verificado con DKIM/SPF + cuenta Resend (D2) + API key.
- **Qué haré yo:** crear una **Edge Function en Supabase** (guarda la API key como secreto, nunca en el navegador) y reemplazar la llamada a `APPS_SCRIPT_URL` en el módulo de comunicados. El `Apps Script` se conserva como respaldo hasta validar.

### 3.5 Refactor de `App.jsx` en módulos — **paso 5 (requiere tu autorización)**
- **Qué:** dividir el monolito de ~5.160 líneas en carpetas por dominio (`recursos/`, `cursos/`, `admin/`, `mensajes/`, `ui/`, `lib/`).
- **Por qué:** a más funciones, más difícil y riesgoso mantener. Es la base para crecer (vivo, foro, pagos).
- **Cuidado:** es el cambio de **mayor riesgo**. Se hará **por etapas**, cada etapa con build + prueba, en rama aparte, sin cambiar comportamiento. **No lo inicio sin tu "adelante".**

### 3.6 Tipos de pregunta en `examenes` — **paso 6 (opcional)**
- **Qué:** además de opción múltiple: **Verdadero/Falso**, **respuesta corta** y **emparejar**.
- **Requisito:** necesito ver el esquema SQL de `examenes` / `intentos_examen` (D5) para no romper datos.
- **Qué haré yo:** extender el modelo y la autocalificación.

---

## 4. Qué ya hice hoy (sin costo ni riesgo de producción)

1. **Código:** soporte de **Jitsi** (clases en vivo) y **Vimeo** en `analizarUrl()`, + permisos de cámara/micrófono en `iframe`. **Build verificado (`EXIT=0`, bundle `index-4a3ee28d.js`).** Commits `b655b45` (Jitsi) y `a58ff09` (beacon), ambos **pusheados a GitHub**. ⚠️ El `wrangler deploy` **falló por falta de token** (`CLOUDFLARE_API_TOKEN`), así que el sitio en vivo **aún no muestra** estos cambios; ver §7.
2. **Documento:** este plan.
3. *(Sesión previa)* Restauré y respaldé tus utilidades del 29/09 (commit `0ed7399`).

---

## 5. Riesgos y reversión

- **Publicar un cambio = actualizar el sitio en vivo.** Por eso los cambios de código quedan **confirmados en local pero sin publicar** hasta tu OK.
- **Reversión:** todo es `git`; si algo falla → `git revert <commit>` y volver a publicar.
- **Supabase Free** se pausa por inactividad (ya existe `keep-alive`). Para producción estable → Pro (US$25/mes) *más adelante*.
- **`1drv.ms`** no es estable para servir muchos archivos; por eso R2 en el paso 3.
- **Precios** citados son de referencia y pueden cambiar.

---

## 6. Comparativa para tu decisión (Jitsi vs Teams)

| Criterio | Jitsi (`meet.jit.si`) | Microsoft Teams (M365 Family) |
|---|---|---|
| Embeber dentro de la plataforma | ✅ **Sí** (iframe) | ❌ No (Microsoft lo bloquea) |
| Costo | $0 | Ya pagado |
| Cuenta del alumno | No requiere | Enlace abierto (como invitado) |
| Grabación | ❌ No en la nube (solo local/JaaS de pago) | ✅ Sí, pero queda en el **chat y caduca a los 30 días** |
| Alojamiento de la grabación | — | Hay que **descargar** y subir a OneDrive/Supabase |
| Recomendación | **Clase en vivo embebida** | Grabar (opcional) y hospedar en OneDrive |

**Estrategia sugerida:** clase en vivo **embebida con Jitsi** (fricción cero); si quieres grabar, **graba en Teams**, **descarga** el video dentro de los 30 días y **súbelo a OneDrive/Supabase** para embeberlo en el curso (ya funciona con el mecanismo actual de `1drv.ms`).

---

