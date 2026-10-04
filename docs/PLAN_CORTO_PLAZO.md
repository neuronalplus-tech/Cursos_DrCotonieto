# Plan de corto plazo (0–4 semanas) — Cursos_DrCotonieto

> **Proyecto:** `Cursos_DrCotonieto` — Dr. Ernesto Cotonieto
> **Basado en:** `docs/CORTE_DIAGNOSTICO_1_CLINE.md` (§5.1 Corto plazo)
> **Fecha:** 2 de octubre de 2026 · **Actualizado:** 3 de octubre de 2026 (estado de publicación verificado, ver §7)
> **Autor:** Cline (agente de código)
> **Tipo de documento:** plan de implementación (define dependencias, orden y responsables)

---

## Estado verificado (03/10/2026)

| Paso | Acción | Estado |
|---|---|---|
| 1 | Clases en vivo (Teams como liga externa) | ✅ Decidido e implementado |
| 2 | Cloudflare Web Analytics (beacon) | ✅ En vivo y funcionando |
| 3 | Archivos pesados en R2 | ❌ Descartado (pide tarjeta) → YouTube no listado + OneDrive 1 TB |
| 4 | Comunicados con *tracking* (Resend) | ⏳ **Bloqueado** — espera tus cuentas (D1, D2, D5) — **D1 se puede posponer sin problema** |
| 5 | Refactor de `App.jsx` en módulos | 🔄 **Iniciado** — `src/lib/` y `src/components/` creados (etapa 1) | → ✅ **COMPLETO** (etapas 1, 2a, 2b, 2c, 2d — ver §4.0.1) |
| 6 | Tipos de pregunta en `examenes` | ✅ **Hecho** (commit `0734945`) + **panel admin completo** (03/10) |

> **Lo pendiente de tu lado:** nada urgente. Los seis pasos de la tabla
> anterior están completos. El paso 4 (Resend) queda **en pausa por tu
> decisión** de aplazar la compra del dominio (03/10): no bloquea nada más.
>
> **Pendiente que sí requiere acción tuya:** correr
> `supabase/RLS_EXAMENES.sql` en el SQL Editor de Supabase y confirmar que
> `select public.es_admin()` devuelve `true`. Sin eso no puedes crear ni
> guardar exámenes desde el panel.

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
| **D1** | Comprar **dominio propio** (ej. `drcotonieto.com`) vía Cloudflare Registrar | Habilita correo con *tracking* (Resend), analítica automática y sitio con marca | ~US$10/año |
| **D2** | Crear cuenta **Resend** (gratis) + API key + verificar dominio | Comunicados con métricas de apertura/clics | $0 |
| **D3** | ~~Activar **Cloudflare Web Analytics** y pasarme el *snippet*~~ ✅ **Recibido** (token `07cbd488…`) | Métricas de visitas | $0 |
| **D4** | ~~Crear **bucket R2** + API token~~ ❌ **Descartado 02/10: pide tarjeta. Decisión: YouTube no listado + OneDrive 1 TB** | Flujo confirmado (cero tarjeta, cero costo) | $0 |
| **D5** | Acceso al **proyecto Supabase** (o compartir el SQL del esquema) | Edge Function de correo y tipos de pregunta | $0 |
| **D6** | ~~Decidir **Jitsi o Teams**~~ ✅ **Decidido 02/10: Teams** | Diseño de la clase en vivo | $0 |

> Nota: **D1 no es indispensable** para los pasos ya hechos. Solo será necesaria para el correo con *tracking* (paso 4).
>
> **Decisión 03/10 (Dr. Ernesto):** la compra del dominio **se aplaza**, y con
> ella **D2 (Resend) también**. El paso 4 queda en pausa hasta que haya un
> momento adecuado para ambas cuentas. Mientras tanto, el correo sigue con
> Google Apps Script (`apps-script/Notificador.gs`), que ya funciona.
>
> **Lo que sí puedo hacer sin D1/D2:** seguir con el refactor y con todo lo que
> no dependa de cuentas externas. Nada de lo hecho hasta ahora queda bloqueado.

---

## 2. Orden de ejecución propuesto

El orden respeta **dependencias** (qué habilita a qué) y prioriza **valor/costo**:

| Orden | Acción | Depende de | Quién | Riesgo |
|---|---|---|---|---|
| **1** | Clases en vivo con **Teams (liga externa)** | nada | ✅ Decidido | Bajo |
| **2** | **Cloudflare Web Analytics** | D3 | ✅ Hecho (beacon en vivo) | Bajo |
| **3** | ~~**Archivos pesados en R2**~~ ❌ **Descartado — se sigue con YouTube no listado + OneDrive 1 TB** | — | — | — |
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

### 3.6 Tipos de pregunta en `examenes` — **LISTO en código (paso 6, sin romper nada)**
- **Qué:** además de opción múltiple: **Verdadero/Falso** (`tipo:'vf'` o 2 opciones V/F), **respuesta corta** (`tipo:'corta'` + `respuesta:'...'`, acepta variantes con `|`) y **emparejar** (`tipo:'emparejar'` + `pares:[{id,premisa,respuesta}]`).
- **Cómo:** extensión solo de UI + calificación en `ExamenModulo` (`tipoDe`/`esCorrecta`). **Sin migración SQL**: `preguntas` es `jsonb`, las preguntas viejas (sin `tipo`) siguen calificando igual. `intentos_examen.respuestas` guarda el mismo objeto.
- **Ejemplo JSON para Supabase (tabla `examenes`, campo `preguntas`):**
```json
[
  {"id":"p1","tipo":"opcion","pregunta":"¿...?","opciones":[{"texto":"A","correcta":false},{"texto":"B","correcta":true}]},
  {"id":"p2","tipo":"vf","pregunta":"El duelo normativo...","opciones":[{"texto":"Verdadero","correcta":true},{"texto":"Falso","correcta":false}]},
  {"id":"p3","tipo":"corta","pregunta":"Siglas de...","respuesta":"TEPT|trastorno de estrés postraumático"},
  {"id":"p4","tipo":"emparejar","pregunta":"Relaciona","pares":[{"id":"a","premisa":"ACT","respuesta":"Aceptación"},{"id":"b","premisa":"DBT","respuesta":"Regulación"}]}
]
```

## 4. Qué ya hice hoy (sin costo ni riesgo de producción)

### 4.0 Exámenes: panel admin + carga masiva desde Excel (03/10/2026)

**Antes:** los exámenes solo se podían crear entrando a Supabase a mano, y únicamente se mostraban en páginas de **módulo**. Los talleres (que no tienen módulos) no podían tener examen.

**Ahora:**

| Capacidad | Dónde |
|---|---|
| Crear/editar exámenes sin tocar Supabase | Panel → **📝 Exámenes** |
| Examen a nivel **módulo** | Aparece al final de la página del módulo |
| Examen a nivel **curso** (nuevo) | Aparece al final de la página del curso **y de los talleres** |
| Carga masiva desde Excel / Sheets / CSV | Pegar la tabla (Ctrl+C) o subir el archivo |
| Descargar plantilla `.tsv` | Botón «⬇️ Descargar plantilla» en el editor |
| Editar un examen ya existente en Excel | Botón «⬇️ Descargar estas preguntas» → edita → vuelve a pegar |
| Activar/desactivar sin borrar | Checkbox «Examen activo» |
| Eliminar examen + sus intentos | Botón «🗑️ Eliminar examen» (pide confirmación) |

**Formato de la tabla (10 columnas):**

| tipo | pregunta | op1…op5 | correcta | respuesta | pares |
|---|---|---|---|---|---|
| `opcion` | el enunciado | las opciones | **número** (1) o **texto exacto** | — | — |
| `vf` | el enunciado | — | `1`=Verdadero, `0`=Falso | — | — |
| `corta` | el enunciado | — | — | `TEPT\|trastorno de estrés postraumático` | — |
| `emparejar` | el enunciado | — | — | — | `ACT=Aceptar; DBT=Regular` |

Detalles que hace el importador:
- Detecta solo si el texto es **TSV** (tabulador, al copiar de Excel) o **CSV** (comas).
- **Mapea por nombre de encabezado**: acepta `Opción 2`, `Correcta`, `Respuesta correcta`, `Enunciado`, y columnas `A`–`E`. Aunque uses solo 3 columnas.
- Si no hay encabezado, respeta el orden fijo de 10 columnas.
- Respeta comillas y comas dentro del texto (`"Di, ¿cómo estás?"`).
- Las filas con problema **se reportan una por una** y no detienen el resto.
- Las preguntas viejas (sin `tipo`) siguen funcionando igual.

**Pruebas:** `supabase/test-examenes.mjs` → **36 pruebas, 0 fallos**. Ejecuta con `node supabase/test-examenes.mjs`.

**SQL para el examen de prueba:** `supabase/EXAMENES_PRUEBA.sql`
> ⚠️ **Ejecuta primero la parte 1** (el `ALTER TABLE ... add column curso_id`), si no el panel de exámenes pedirá crear la columna.

### 4.0.1 Estructura creada (refactor)

```
src/
├── config.js               → configuración global (buckets, marca, redes, copy)
├── lib/
│   ├── supabase.js         → cliente único
│   ├── helpers.js          → helpers puros (analizarUrl, esTallerIndividual, …)
│   └── examenes.js         → lógica de exámenes: tipos, calificación, importador
├── components/
│   ├── ui.jsx              → UI compartida (ModalPortal, Breadcrumb, VideoPlayer, …)
│   ├── MensajesInbox.jsx   → bandeja de mensajes (Realtime) + página de mensajes
│   ├── TallerRecursos.jsx  → modal de edición de taller + material del taller
│   ├── ExamenModulo.jsx    → examen autocalificable (módulo o curso)
│   ├── AdminExamenes.jsx   → vista del panel de exámenes
│   ├── EditorExamen.jsx    → modal crear/editar + carga masiva
│   └── EditorPregunta.jsx  → captura manual de una pregunta
├── App.jsx                 → pantallas y composición
└── main.jsx                → punto de entrada
respaldo/
└── App (1).jsx             → respaldo viejo (no se usa; está en git si lo necesitas)
supabase/
├── EXAMENES_PRUEBA.sql     → columnas curso_id + max_intentos + examen de prueba
└── test-examenes.mjs       → 60 pruebas
```

**Progreso del refactor:**

| Etapa | Qué se movió | Líneas movidas | Estado |
|---|---|---|---|
| 1 | `lib/supabase.js`, `lib/examenes.js`, componentes de exámenes | ~600 | ✅ |
| 2a | `config.js` + `lib/helpers.js` | ~250 | ✅ |
| 2b | `components/ui.jsx` (UI compartida) | ~165 | ✅ |
| 2c | `MensajesInbox`, `TallerRecursos`, `ExamenModulo` | ~1.290 | ✅ |
| 2d | `Header`, `PortadaCurso`, `CursoCard`, `CursoView`, `ModuloView`, `RecursosModulo`, `AdminModales` | **~2.100** | ✅ |

> `App.jsx`: **4.285 → 2.185 líneas** (‑49%) sin cambiar comportamiento.
> El bundle se mantiene en ~1.318 kB, señal de que fue un movimiento puro.

### Estructura final de `src/`

```
src/
├── config.js               → configuración global, paleta, enlaces
├── App.css
├── App.jsx                 → rutas, Home, Login, Perfil, Admin,
│                              CursoDetalle, Constancia
├── lib/
│   ├── supabase.js         → cliente único
│   ├── helpers.js          → helpers puros
│   ├── examenes.js         → tipos, calificación, importador
│   └── correo.js           → envío con confirmación real (JSONP)
└── components/
    ├── ui.jsx              → ModalPortal, Breadcrumb, VideoPlayer, …
    ├── Header.jsx          → barra superior
    ├── PortadaCurso.jsx    → portada animada + motivoDe
    ├── CursoCard.jsx       → tarjeta de curso
    ├── CursoView.jsx       → vista de curso
    ├── ModuloView.jsx      → vista de módulo
    ├── RecursosModulo.jsx  → PdfViewer, Autoevaluacion, RecursoCard,
    │                         modales de recurso, Diapositivas, Entregables
    ├── AdminModales.jsx    → botones de ruta, nuevo módulo, botones de módulo
    ├── TallerRecursos.jsx  → ModalEditarTaller + material del taller
    ├── ExamenModulo.jsx    → examen autocalificable
    ├── AdminExamenes.jsx   → panel de exámenes
    ├── EditorExamen.jsx    → crear/editar + carga masiva
    ├── EditorPregunta.jsx  → captura manual
    └── MensajesInbox.jsx   → bandeja + página de mensajes
```

### Herramientas de seguridad del refactor

| Script | Para qué |
|---|---|
| `scripts/check-imports.mjs` | Detecta componentes JSX usados sin importar. **Vite no avisa de esto**: el build pasa y el error solo aparece en runtime, al entrar a esa página. |
| `scripts/extraer.mjs` | Mueve un componente a otro archivo y añade `export default`. Aborta si el rango no cuadra. |
| `scripts/mover-bloque.mjs` | Igual, pero para varios componentes a la vez, sin añadir exports. |
| `scripts/recortar.mjs` | Borra un bloque y deja un comentario con el destino. |

> **Por qué existen.** Ya pasó dos veces: `TallerRecursos` usaba
> `<VideoPlayer>` sin importarlo, y `App.jsx` usaba `<ModalEditarTaller>` en
> `CursoCard` sin importarlo (dos botones lo abrían → *ReferenceError* al
> pulsarlos). El segundo lo detectó `check-imports.mjs` antes de publicar.
>
> **Antes de publicar un refactor:**
> `node scripts/check-imports.mjs` y luego `npm run build`.

---

### 4.0.2 Captura manual + límite de intentos (03/10/2026)

**Captura manual de preguntas** (antes solo había carga masiva):
- Botón **«✍️ Escribir pregunta a mano»** dentro del editor de exámenes.
- Formulario con los 4 tipos: opción múltiple (hasta 6 opciones, marca la correcta con radio),
  verdadero/falso, respuesta corta y emparejar.
- Validación en vivo: no deja guardar sin enunciado, sin opciones, o sin marcar exactamente
  una respuesta correcta.
- Cada pregunta de la lista tiene **↑ ↓** (reordenar), **✏️ Editar** y **🗑️ Quitar**.

**Límite de intentos** (antes ilimitado):
- Campo «Intentos permitidos por alumno» (default **3**, `0` = ilimitado).
- Al agotarlos se bloquea y se muestra **solo la mejor calificación**, en grande.
- Mientras quedan intentos se indica cuántos van y cuántos faltan.
- Si en algún intento aprueban, queda como aprobado aunque después repruebe.

**Dónde viven las respuestas** (todo en Supabase, dentro del plan gratuito):

| Dato | Tabla | Campo |
|---|---|---|
| Las preguntas del examen | `examenes` | `preguntas` (jsonb) |
| Las respuestas del alumno | `intentos_examen` | `respuestas` (jsonb), `calificacion`, `aprobado`, `fecha` |

Nada se hospeda fuera: es tu base de datos Postgres de Supabase. El plan **Free** da 500 MB,
que alcanza para **miles de alumnos × cientos de intentos**.

**Pruebas:** `node supabase/test-examenes.mjs` → **60 pruebas, 0 fallos**.

**SQL actualizado:** `supabase/EXAMENES_PRUEBA.sql` ahora agrega también `max_intentos`.

---


1. **Código:** soporte de **Jitsi** (clases en vivo) y **Vimeo** en `analizarUrl()`, + permisos de cámara/micrófono en `iframe`. **Build verificado (`EXIT=0`, bundle `index-4a3ee28d.js`).** Commits `b655b45` (Jitsi) y `a58ff09` (beacon), ambos **pusheados a GitHub**. ✅ **Actualización 03/10:** el sitio en vivo **sí está actualizado** (verificado en §7); la nota anterior que decía "el deploy falló" quedó obsoleta.
2. **Exámenes:** tipos de pregunta nuevos (V/F, respuesta corta, emparejar) en commit `0734945`. **Publicado en vivo** ✅.
3. **Reto S4:** botón "abrir en ventana nueva" + `public/juegos/juego-s4.html` en commit `a946fee`. **Publicado en vivo** ✅ (verificado en §7).
4. **Documento:** este plan.
5. *(Sesión previa)* Restauré y respaldé tus utilidades del 29/09 (commit `0ed7399`).

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

> ⚠️ **Nota:** esta §6 es el comparativo original. La **decisión final** está en §3.1 (Teams como liga externa, Jitsi embebido descartado por el corte de 5 min de `meet.jit.si`). Conserva el valor histórico de por qué se descartó.

---

## 7. Publicación (deploy) — estado verificado 03/10/2026

### 7.1 El deploy es AUTOMÁTICO (no necesito token)

**Descubrimiento clave:** Cloudflare Pages tiene **integración con GitHub** conectada a este repo. Cada `git push` a `main` dispara el build y la publicación solos.

| Comprobación | Resultado |
|---|---|
| Bundle servido (antes) | `assets/index-cb8531e2.js` |
| Bundle servido (después del push `219c9b5`) | `assets/index-2aac866d.js` ✅ |
| Contiene "Examen del curso completo" | ✅ Sí |
| Contiene "Cargar preguntas desde Excel" | ✅ Sí |
| Contiene `juego-s4` (commit `a946fee`) | ✅ Sí |
| Árbol de trabajo local | ✅ Limpio |
| `origin/main` | ✅ Al día |

> **Conclusión:** publicar = `commit` + `push`. No hace falta `wrangler` ni `CLOUDFLARE_API_TOKEN`.
> Los deploys manuales con `wrangler deploy` **fallan** (no hay token y no hay sesión OAuth), pero **no afectan nada** porque el auto-deploy ya publica. Es ruido histórico en los logs.

### 7.2 Cómo publicar (regla)

```bash
npm run build      # siempre, para verificar que compile
git add -A
git commit -m "mensaje"
git push origin main      # ← esto publica
```

Después del push, Cloudflare Pages tarda ~1–2 minutos en actualizar. Puedes verificarlo así:

```bash
# Ver qué bundle sirve el sitio en vivo
curl -s https://cursos-drcotonieto.neuronal-plus.workers.dev/ | Select-String "assets/index-.*\.js"

# Confirmar que ese bundle existe en tu dist local
Get-ChildItem dist\assets\index-*.js
```

Si los nombres coinciden → publicado correctamente.

### 7.3 Rollback

```bash
git revert <commit>
git push origin main     # publica el revert automáticamente
```

---

## 8. Verificación automática (03/10/2026)

El plan cerró con una barrera que corre antes de publicar. Todo se ejecuta con
`npm run` y no necesita cuentas externas.

| Comando | Qué comprueba | Resultado 03/10 |
|---|---|---|
| `npm run check` | Identificadores usados sin importar en cada componente. **Vite no los detecta**: el error solo aparece al entrar a esa página | 28 archivos · 0 rotas |
| `npm run check:texto` | Texto corrupto (mojibake). Imprime puntos de código en ASCII porque la consola de Windows recodifica lo que muestra | 0 marcas |
| `npm run smoke` | Las vistas se renderizan sin reventar | 19/19 |
| `npm run smoke:datos` | La app completa en jsdom, con datos falsos | **108/108** |
| `node supabase/test-examenes.mjs` | Lógica de exámenes, importador, autocalificación | 60/60 |
| `node supabase/test-correo.mjs` | Plantilla de correo y callbacks del script | 27/27 |
| `npm run reparar:texto` | Corrige mojibake automáticamente | a demanda |

### 8.1 Escenarios de datos de `smoke:datos`

El doble de Supabase (`scripts/fake-supabase.js`) **aplica los filtros**
(`.eq`, `.in`, `.gte`, `.order`, `.limit`). Antes los ignoraba, así que toda
consulta devolvía todas las filas y solo se ejercitaba la rama "hay datos".

| Escenario | Qué simula |
|---|---|
| `completo` | Todo lleno: la referencia |
| `vacio` | Nada publicado — el estado de una cuenta recién creada |
| `sinModulos` | El curso existe pero está vacío |
| `sinRecursos` | El módulo existe pero sin materiales |
| `sinIntentos` | El alumno nunca abrió el examen |
| `sinMensajes` | Bandeja de entrada vacía |

Cada uno se monta en las 9 rutas, con y sin sesión: **6 × 2 × 9 = 108**.

### 8.2 Bugs que encontraron estas pruebas

| Bug | Consecuencia | Por qué estaba oculto |
|---|---|---|
| `Constancia.jsx` usaba `wa()` sin importarlo | **`/constancia/:id` reventaba** al pulsar "Escríbeme por WhatsApp" | El doble no tenía la tabla `constancias`, así que esa rama nunca se ejecutaba |
| `ModalEditarTaller` sin importar | Botón "Editar taller" tumbaba la tarjeta de curso | El componente se movió de archivo y se olvidó el `export` |
| `VideoPlayer` sin importar en `TallerRecursos` | La página de talleres se caía al entrar | Igual: el bloque se movió, la conexión se olvidó |
| 28 identificadores sin importar en total | Varias rutas rotas | El refactor de `App.jsx` los dejó atrás |

### 8.3 Lo que **no** cubren estas pruebas

Conviene tenerlo claro para no confiar de más:

1. **Sin interacción.** No hay clics, `submit`, apertura de modales ni uploads.
   Solo render y carga de datos.
2. **Sin red real.** El doble no llama a Supabase, así que un error de RLS,
   una columna mal nombrada o un tipo devuelto distinto **no se detectan**.
   Para eso están las pruebas manuales contra el sitio publicado.
3. **Sin `pdfjs` ni `canvas`.** jsdom no los implementa; los visores de PDF y
   el canvas de páginas quedan fuera de alcance.

### 8.4 Antes de publicar, siempre

```bash
npm run check          # imports
npm run check:texto    # mojibake
npm run smoke:datos    # 108 montajes
npm run build
git add -A && git commit -m "..." && git push origin main
```

Los tres primeros se ejecutan en segundos y han encontrado **más bugs reales
que la revisión manual**.


