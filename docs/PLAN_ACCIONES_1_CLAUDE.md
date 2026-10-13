# Plan de acciones 1 — Evolución por roles

> **Proyecto:** `Cursos_DrCotonieto` — Dr. Ernesto Cotonieto
> **Fecha:** 12 de octubre de 2026 · **Autor:** Claude (agente de código)
> **Tipo:** plan de implementación ejecutable (define orden, archivos, pasos y prueba de aceptación)
> **Cruza:** `docs/CORTE_DIAGNOSTICO_2_CLAUDE.md` (hallazgos) × el mapa de requerimientos B2B2C EdTech
> (adjunto por el dueño) × el código real del repositorio.
> **Antecedentes que respeta:** `docs/CORTE_DIAGNOSTICO_1_CLINE.md`, `docs/PLAN_CORTO_PLAZO.md`
> (decisión de video: YouTube no listado + OneDrive; decisión de correo: Apps Script hasta comprar dominio).

---

## Para quien ejecuta este plan (humano o IA)

Léelo así:

1. **Este documento no es el diagnóstico.** Los hallazgos, con su `archivo:línea`, están en
   `CORTE_DIAGNOSTICO_2_CLAUDE.md`. Aquí se dan **acciones**; cada ficha cita el hallazgo que resuelve.
2. **Cada ficha de acción tiene el mismo formato**, pensado para ejecutarse sin volver a investigar:
   `ID · título · a qué rol sirve · qué hallazgo cruza · qué requisito del mapa cubre · archivos reales ·
   pasos · prueba de aceptación · esfuerzo · depende de`.
3. **El orden de las fases importa.** La Fase 0 es de seguridad y desbloqueo: sin ella, "pensar por
   roles" es inseguro, porque hay funciones que ignoran el aislamiento entre organizaciones.
4. **Reglas del proyecto que NO se rompen** (vienen del código y de los diagnósticos previos):
   - No escribir secretos en el repo. El correo sale por `apps-script/Notificador.gs` hasta que se
     compre dominio (decisión del dueño, `PLAN_CORTO_PLAZO.md`).
   - Todo HTML que se renderice pasa por `sanear`/`sanearDocumento` de `src/lib/foro.js`.
   - Toda función nueva `SECURITY DEFINER` lleva `set search_path = public` y su `revoke`/`grant`.
   - Cada cambio se valida con `npm run build` (bloqueante) y `npm run lint` (hoy informativo; la
     Acción F0-7 lo vuelve bloqueante).
   - Los scripts SQL son idempotentes y se registran en `supabase/ESTADO.sql`.
5. **Verificar antes de construir.** Varias acciones son "encender lo que ya existe", no "crear".
   Si una ficha dice "probablemente ya está escrito", el primer paso es comprobarlo, no reescribirlo.

---

## Parte A — El filtro de realidad

El mapa de requerimientos describe un **LXP/LMS multi-tenant empresarial** (split payments, Kafka,
Kubernetes, DRM, SCORM/LTI, proctoring biométrico, CDN propia). El proyecto real es un **LMS en
React + Supabase (Postgres/RLS) + 2 edge functions, servido en Cloudflare Workers**, operado por un
doctor que da cursos y talleres. Las 151 funciones no se transcriben: se clasifican en cuatro cajones,
y solo los tres primeros entran al plan.

### Cajón 1 — Ya existe en el repositorio (a veces apagado)

Esto es lo más importante que revela el cruce: **gran parte de lo que el mapa pide como "motor
estrella" ya está escrito.**

| Requisito del mapa | Dónde ya vive | Estado |
|---|---|---|
| Engine de Permisos Granulares / Custom RBAC (Rol 1) | `ROLES_5_PERMISOS.sql`, `ROLES_6_POLITICAS.sql`, `ROLES_7_CONTENIDO.sql`, `src/components/AdminRoles.jsx`, `src/lib/roles.js`, `src/lib/permisos.js` | **Escrito y cableado; probablemente NO desplegado** (Fase 1) |
| Certificados verificables por QR/folio | `src/components/VerificarConstancia.jsx`, `verificar_constancia()`, `constancias` | **Funciona** (supera a Moodle) |
| Banco de preguntas por dificultad y tema | `banco_preguntas`, `src/components/BancoPreguntas.jsx` | Funciona |
| Rúbricas de evaluación por criterios y niveles | `rubrica_criterios`, `src/components/AdminTareas.jsx`, `TareasAlumno.jsx` | Funciona |
| Foros moderados por tema, con calificación | `foro_hilos`, `src/components/ForoCurso.jsx`, `AdminForo.jsx` | Funciona |
| Mensajería interna sin compartir número | `mensajes`, `src/components/MensajesInbox.jsx` | Funciona |
| Cohortes con sede y modalidad | `generaciones`, `sedes`, `src/components/AdminGeneraciones.jsx` | Funciona, mejor enfocado que Moodle |
| Asistencia por sesión | `asistencia`, `sesiones`, `src/components/PaseDeLista.jsx` | Funciona (pero invisible al alumno, Fase 4) |
| Multi-tenant con aislamiento de datos | `organizaciones`, `organizacion_id`, RLS por tabla | **Parcial** — hay fugas (Fase 0) |
| Marca blanca básica (logo, colores) | `organizaciones.logo_url/color_primario/color_acento`, `src/components/AdminOrganizaciones.jsx` | Funciona |
| Suscripciones y planes B2B | `planes`, `pagos_suscripcion`, `src/components/AdminSuscripciones.jsx` | Funciona (sin pasarela) |
| Exportación de datos (CSV) | `src/lib/exportar.js` | Funciona |
| Logs inmutables / auditoría | `auditoria` + 20 disparadores | Funciona |
| Alta masiva por CSV/padrón | `src/lib/padron.js` | Funciona |
| Plantillas de documento editables | `plantillas_documento`, `src/components/AdminPlantillas.jsx` | Funciona (pero la constancia no las usa, Fase 3) |
| Super-admin / centro de control | `src/components/Admin.jsx`, `AdminOrganizaciones.jsx` | Funciona |
| Drip content (liberar por disponibilidad) | `modulos.disponible`, `recursos.disponible` | Parcial (manual, sin fechas, Fase 3) |

### Cajón 2 — Cabe y vale la pena a esta escala (entra al plan)

Badges/Open Badges · drip real por fecha · prerrequisitos · pantalla "Mis cursos" · PWA instalable ·
modo oscuro · accesibilidad WCAG 2.2 AA · apuntes del alumno · aviso de calificación · asistencia
visible y ponderable · plantilla de constancia usada de verdad · comunicados programados con historial ·
encuestas NPS · directorio de participantes · "qué nota necesito" · guardado de borrador en exámenes ·
preferencias de notificación.

### Cajón 3 — Proyecto grande pero legítimo (decisión de negocio del dueño, fichas marcadas ⟡)

Pasarela de pago real (Stripe/Mercado Pago) y e-commerce · landing builder · marketplace de cursos ·
clases en vivo integradas (hoy liga a Teams, decisión tomada). Se incluye **la ficha de arranque** de
cada uno con su punto de entrada real, pero no el proyecto completo: son decisiones de inversión.

### Cajón 4 — Trampa a esta escala o requiere re-plataforma (NO entra — Parte D)

Kafka/Kubernetes/microservicios · DRM FairPlay/Widevine · transcodificación HLS propia · CDN propia ·
proctoring biométrico/facial · blockchain para títulos · split payments multi-nivel · SCORM/LTI/xAPI ·
SSO SAML/OAuth corporativo · multimoneda con conciliación fiscal multi-jurisdicción · apps nativas en
las tiendas. **No son "no para siempre": son "no con Supabase + Cloudflare Workers y a la escala de un
consultorio".** La Parte D explica cada una, porque dejarlas sin mencionar sería ocultar la decisión.

---

## Parte B — Mapa de roles: el del mapa contra el del proyecto

El mapa define 5 niveles. El proyecto ya tiene 5 perfiles reales. Encajan casi uno a uno, y el
subsistema de roles (Fase 1) es lo que hace que el encaje sea configurable en vez de estar en el código.

| Rol del mapa | Perfil real en el proyecto | Dónde se decide hoy |
|---|---|---|
| Dueño de la Plataforma (SaaS Admin) | Admin de plataforma | fila en `admins` con `organizacion_id IS NULL` |
| Directivos de Organización (B2B) | Admin de organización | fila en `admins` con `organizacion_id` |
| Docente / Creador / Facilitador | Facilitador + (futuro) roles "Docente"/"Coordinación" | `facilitadores` + `asignaciones_rol` (Fase 1) |
| Estudiante / Participante | Alumno + autoinscrito gratuito | fila en `acceso` (o taller gratuito) |
| Capa transversal | — | eventos de correo/notificación, constancia, progreso |

El hueco que el subsistema de roles llena exactamente es el que el propio `ROLES_5_PERMISOS.sql`
documenta en su cabecera: hoy "Coordinación" tendría que ser admin de organización para armar grupos,
y eso le daría acceso al contrato. Con roles, no.

---

## Parte C — El plan por fases

### FASE 0 — Verificar el estado real y cerrar seguridad

**Por qué primero:** "pensar por roles" es inseguro mientras existan funciones que ignoran el
aislamiento entre organizaciones. Y la mitad del plan depende de saber qué está instalado de verdad.

#### F0-1 · Fotografiar el estado real de la base
- **Sirve a:** todos. **Cruza:** diagnóstico §0.
- **Pasos:**
  1. Supabase → SQL Editor → correr `supabase/ESTADO.sql` completo. Anotar qué filas salen como faltantes.
  2. Correr: `select pg_get_viewdef('vista_admin_inscripciones'), reloptions from pg_class where relname='vista_admin_inscripciones';`
  3. Correr: `select proname, proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and prosecdef and (proconfig is null or not ('search_path=public'=any(proconfig)));` (lista las SECURITY DEFINER sin search_path fijo).
  4. Regenerar `supabase/ESTRUCTURA.md` con el generador existente y añadirle sección de vistas.
- **Prueba de aceptación:** una tabla con "qué scripts faltan por correr" y la respuesta a si
  `vista_admin_inscripciones` es `security_invoker`.
- **Esfuerzo:** XS. **Depende de:** nada.

#### F0-2 · Cerrar la inscripción libre a cursos de pago
- **Sirve a:** Dueño, Directivos (protege el modelo de negocio). **Cruza:** §8.1 B3 (bloqueante).
- **Archivos:** `supabase/ESQUEMA_SEGURIDAD.sql:98` y `:110` (`bulk_grant_course_access`, `bulk_remove_course_access`).
- **Pasos:** crear `supabase/SEG_1_BULK_ACCESO.sql` que redefina ambas funciones con, al inicio del
  cuerpo: `if not public.puede_gestionar_curso(target_course_id) then raise exception 'No autorizado' using errcode='42501'; end if;` · añadir `set search_path = public` · y al final
  `revoke all on function … from public; grant execute on function … to authenticated;`
- **Prueba de aceptación:** desde una sesión de alumno, llamar la RPC en la consola del navegador con
  un `curso_id` de pago devuelve "No autorizado"; desde un admin de ese curso, inscribe.
- **Esfuerzo:** XS. **Depende de:** F0-1.

#### F0-3 · Lote de seguridad XS
- **Sirve a:** aislamiento entre roles y organizaciones. **Cruza:** §8.1 B4, §8.2 A6, §8.3 M1, M4.
- **Pasos (un solo script `supabase/SEG_2_LOTE.sql`):**
  1. **B4** — en `eliminar_usuario` (`WHATSAPP_Y_BAJAS.sql:222`): la comprobación de admin debe exigir
     `es_admin()` **o** que el objetivo pertenezca a una organización que quien llama administra.
  2. **A6** — `alter function … set search_path = public` en las que F0-1 haya listado (candidatas:
     `alumnos_de_curso`, las dos `bulk_*`, `get_admin_id`, `obtener_usuario_por_email`).
  3. **M1** — `drop policy if exists "modulos_lectura_publica" on public.modulos;` (deja actuar a
     `leer_modulos`, que sí distingue gratuito de pago).
  4. **M4** — renombrar `supabase/RLS_EXAMENES.sql` a `OBSOLETO_RLS_EXAMENES.sql` con una cabecera de
     advertencia: **no correr nunca**, redefine `es_admin()` sin el filtro de organización.
- **Prueba de aceptación:** un visitante sin sesión no lista módulos de cursos de pago; un admin de
  organización no puede borrar un usuario de otra.
- **Esfuerzo:** XS. **Depende de:** F0-1.

#### F0-4 · Decidir el aislamiento de la vista de inscripciones
- **Sirve a:** Directivos (no ver datos de otros clientes). **Cruza:** §8.2 A7, §3.3.
- **Pasos:** según el resultado de F0-1: si `vista_admin_inscripciones` **no** es `security_invoker`,
  correr `alter view public.vista_admin_inscripciones set (security_invoker = true);` y volcar su
  definición a `supabase/VISTAS.sql`. Si lo es, solo volcar la definición.
- **Prueba de aceptación:** un alumno autenticado que pida la vista por su nombre con la clave pública
  recibe solo lo suyo (o nada), no el padrón completo.
- **Esfuerzo:** S. **Depende de:** F0-1.

#### F0-5 · Filtrar inscripciones por organización en todos los refrescos
- **Sirve a:** Directivos. **Cruza:** §3.4 (bloqueante).
- **Archivos:** `src/components/Admin.jsx` (escrituras de `setFilas` en `:312, 627, 823, 1358, 1456`).
- **Pasos:** extraer `cargarInscripciones(orgId)` como única función que escribe `filas`, con el filtro
  `idsCurso` dentro; las cuatro llamadas restantes la usan.
- **Prueba de aceptación:** tras un alta masiva, el panel sigue mostrando solo las inscripciones de la
  organización activa. **Esfuerzo:** XS. **Depende de:** nada.

#### F0-6 · Las tres funciones de directorio, por organización
- **Sirve a:** Directivos (no ver el padrón de otros clientes ni sus notas privadas). **Cruza:** §8.2 A1.
- **Archivos:** `listar_usuarios_con_accesos` (`ALTA_PUBLICA_2_TANDAS.sql:211`), `listar_whatsapp`
  (`WHATSAPP_Y_BAJAS.sql:117`), `listar_inscritos_gratuitos` (`ALTA_PUBLICA.sql:128`).
- **Pasos:** parametrizar cada una por `p_org bigint`, comprobar `es_admin_de(p_org)` (con `es_admin()`
  como único atajo), y que los componentes que las llaman pasen `organizacion.id`.
- **Prueba de aceptación:** un admin de organización solo obtiene filas de la suya. **Esfuerzo:** M.

#### F0-7 · Dejar el lint en cero y volverlo bloqueante en CI
- **Sirve a:** todos (evita que vuelva a colarse un bug como el de los exámenes). **Cruza:** §3.1.
- **Pasos:**
  1. Borrar `src/client/` (huérfano, verificado: no lo importa nadie).
  2. Arreglar `ExamenModulo.jsx:235`: `sinMigracion` → `sinMigrar`.
  3. `npm run lint` debe quedar en **0 errores** (solo quedan 4 avisos de hooks).
  4. En `.github/workflows/deploy.yml`, quitar `continue-on-error: true` del paso de lint y cambiar el
     comando a `npm run lint -- --max-warnings=999` (bloquea por errores, no por avisos).
- **Prueba de aceptación:** `npm run lint` sale con código 0; un `no-undef` nuevo rompe el deploy.
- **Esfuerzo:** XS. **Depende de:** nada.

---

### FASE 1 — Encender el subsistema de roles (el corazón de "pensar por roles")

**Hallazgo central:** el RBAC completo ya está escrito y cableado, y **probablemente no está desplegado**
(F0-1 lo confirma). Esta fase no construye: enciende y conecta.

#### F1-1 · Desplegar los tres scripts de roles
- **Sirve a:** Dueño y Directivos (crear "Coordinación", "Dirección", "Docente" sin tocar código).
- **Cubre del mapa:** "Engine de Permisos Granulares y Roles Personalizados (Custom RBAC)",
  "Gestión del Personal Docente y Administrativo", "Panel de Asignación Masiva de Cursos por Rol".
- **Archivos:** `supabase/ROLES_5_PERMISOS.sql`, `ROLES_6_POLITICAS.sql`, `ROLES_7_CONTENIDO.sql`.
- **Pasos:**
  1. Si F0-1 confirmó que faltan: correrlos **en orden** (5 → 6 → 7) en el SQL Editor.
  2. Verificar con el bloque de comprobación al final de cada uno (el 5 debe dar: 21 permisos, 4 tablas,
     3 funciones).
  3. En el panel → Roles → "Crear los tres roles básicos" (llama `sembrar_roles_basicos`).
  4. Regenerar `ESTRUCTURA.md`.
- **Prueba de aceptación:** el panel Roles lista 21 permisos agrupados, se crean los 3 roles, y una
  persona con rol "Coordinación" (sin ser admin) puede ver lo que su permiso concede.
- **Esfuerzo:** S. **Depende de:** F0-1.

#### F1-2 · Llevar los permisos de rol a las políticas de la base, tabla por tabla
- **Sirve a:** que un rol conceda de verdad, no solo en la pantalla. **Cruza:** la nota final de
  `ROLES_5_PERMISOS.sql` ("las políticas siguen mirando `admins` y `facilitadores`").
- **Pasos:** este es el trabajo delicado que el propio script advierte. Hacerlo **una tabla a la vez**,
  añadiendo `or public.tiene_permiso('<permiso>', organizacion_id, …)` a la política existente **sin
  quitar** la condición de `admins`/`facilitadores` (se suma, no se reemplaza). Orden sugerido por
  riesgo bajo→alto: `asistencia` (permiso `asistencia.pasar`) → `generaciones` (`grupos.gestionar`) →
  `tareas`/`entregas` (`calificaciones.capturar`) → `cursos`/`modulos`/`recursos` (`cursos.editar`).
- **Prueba de aceptación:** por cada tabla, una persona con el permiso correspondiente (y sin ser admin)
  puede hacer la acción; sin el permiso, la RLS la rechaza.
- **Esfuerzo:** L. **Depende de:** F1-1. **Nota:** no relajar `es_admin()` para lograrlo (eso es M4).

---

### FASE 2 — Control y granularidad (tu queja principal)

Cruza §4 del diagnóstico. El principio: **el control que pides casi siempre ya está en la base; falta el
interruptor.** Todo esto sirve sobre todo al Rol 3 (docente/creador) y al Rol 2 (directivos).

#### F2-1 · Que la casilla "Activo" de los botones de ruta se respete
- **Cruza:** §4.2 hueco 5. **Archivo:** `src/components/CursoView.jsx:439`.
- **Paso:** en el `.map` de `curso.rutas_botones[g]`, filtrar `.filter(b => gestiona || b.activo !== false)`
  (igual que ya hace `ModuloView.jsx:265`).
- **Prueba:** apagas un botón de ruta en el editor y deja de aparecer para el alumno. **Esfuerzo:** XS.

#### F2-2 · Que un curso nuevo reciba su organización
- **Cruza:** §4.2 hueco (bug multi-inquilino). **Archivo:** `src/components/AdminCursos.jsx:120`.
- **Paso:** `editando === 'nueva'` → `editando === 'nuevo'` (el valor que se asigna en `:81`).
- **Prueba:** un curso creado aparece en la lista de su organización. **Esfuerzo:** XS.

#### F2-3 · Resolver `modulos.oculto` (hoy rompe crear/duplicar módulo)
- **Sirve a:** Docente. **Cruza:** §4.2 hueco 2 (bloqueante).
- **Decisión:** como quieres control fino, **crear la columna** en vez de borrar las referencias.
- **Pasos:**
  1. `supabase/MODULOS_VISIBILIDAD.sql`: `alter table public.modulos add column if not exists oculto boolean not null default false;`
  2. Darle su propio interruptor en el editor de módulo (ver F2-4), separado de `disponible`:
     `oculto` = "no lo ve el alumno ni en la lista"; `disponible` = "visible pero cerrado/próximamente".
  3. Documentar la columna en `ESTRUCTURA.md`.
- **Prueba:** crear y duplicar módulo ya no falla; un módulo `oculto` desaparece para el alumno y la
  etiqueta "🔒 Privado" (`ModuloView.jsx:249`) por fin significa algo. **Esfuerzo:** S.

#### F2-4 · Modal de edición de módulo (hoy no se puede editar tras crearlo)
- **Sirve a:** Docente. **Cruza:** §4.2 hueco 1 (bloqueante).
- **Archivos:** nuevo `ModalEditarModulo` en `src/components/AdminModales.jsx`; botón "✏️ Editar módulo"
  en `ModuloView.jsx` (~`:276`) y lápiz en `CursoView.jsx` (~`:332`).
- **Pasos:** el modal escribe `title`, `descripcion`, `orden`, `grupo`, `oculto`, `disponible` con un
  `update` sobre `modulos`. Reutiliza `ModalPortal` y, tras F3-6, el `<Modal>` accesible.
- **Prueba:** corregir el título de un módulo desde la interfaz, sin entrar a Supabase. **Esfuerzo:** M.

#### F2-5 · Unificar los seis sistemas de botón en uno
- **Sirve a:** Docente, Directivos. **Cruza:** §4.3 (tiene la propuesta completa con el esquema de la
  tabla `botones`, qué se fusiona y qué se retira, archivo por archivo).
- **Cubre del mapa:** "Gestor de Repositorios de Archivos Descargables por Tema", y de paso elimina la
  URL de OneDrive personal cableada en `AdminModales.jsx:131` y la regex sobre el título en `ModuloView.jsx:180`.
- **Pasos:** seguir §4.3 del diagnóstico al pie de la letra: tabla `botones`, `ModalBotones({ambito,…})`,
  `<BotonConfigurable>`, migración de los jsonb y las tripletas `*_activo`.
- **Prueba:** cada botón (ruta, módulo, taller, entregables, registro, grabación, materiales) se edita
  desde un solo modal con el mismo modelo mental, y todos respetan visible/orden/fechas.
- **Esfuerzo:** L. **Depende de:** F3-6 conviene antes (el `<Modal>` accesible).

#### F2-6 · Fechas de apertura y cierre, donde faltan
- **Sirve a:** Docente, Directivos. **Cruza:** §4.2 hueco 6.
- **Cubre del mapa:** "Rutas de Aprendizaje Condicionadas (Drip Content)", "Gestión de Calendarios".
- **Pasos:**
  1. Sembrar los campos `cursos.fecha_inicio`/`fecha_fin` (ya existen, muertos) en `AdminCursos.jsx` y
     filtrar por ellos en `CursoView.jsx` junto a `proximamente`.
  2. `alter table … add column abre_el timestamptz, cierra_el timestamptz` en `modulos` y `recursos`;
     un componente `<CamposApertura>` hermano del `CamposPlazo` de `Prorrogas.jsx:215`.
- **Prueba:** un módulo con `abre_el` futuro no es accesible para el alumno hasta esa fecha. **Esf.:** M.

#### F2-7 · "Notificar al publicar" unificado y correcto
- **Sirve a:** Docente. **Cruza:** §4.2 hueco 7 + §3.5 (empareja por título en vez de `curso_id`).
- **Pasos:** un componente `<CasillaNotificar entidad>` junto a cada interruptor de publicación
  (curso, módulo, recurso, examen, tarea), **siempre** sobre `notificarInscritos()` de
  `src/lib/correo.js:42` (que filtra por `curso_id`); borrar la versión propia de `CursoView.jsx:243-283`.
- **Prueba:** abrir un módulo notifica solo a los inscritos de ese curso, no a los de otro con el mismo
  título; funciona también en cursos gratuitos. **Esfuerzo:** M.

#### F2-8 · La constancia del alumno usa la plantilla editable
- **Sirve a:** Directivos (marca blanca real de constancias). **Cruza:** §4.2 hueco 3.
- **Cubre del mapa:** "Diseñador Dinámico de Certificados y Diplomas".
- **Archivo:** `src/components/Constancia.jsx:31-106` (HTML cableado con firma/cédula/teléfono literales).
- **Pasos:** que `Constancia.jsx` lea la plantilla activa de tipo `constancia` de la organización y la
  pase por `rellenar()` de `src/lib/plantillas.js:94`, como ya hace `GenerarDocumento.jsx:246`. Los
  valores actuales quedan como repliegue si la organización no tiene plantilla.
- **Prueba:** cambiar el membrete en `AdminPlantillas` cambia la constancia que descarga el alumno.
- **Esfuerzo:** M.

#### F2-9 · Interruptores de control que faltan (lote XS/S)
- **Cruza:** §4.2 huecos 9, 10, 11, 16, 18. Cada uno es independiente:
  - **Foro:** sacar `CamposPlazo` fuera del `{califica && …}` en `AdminForoModal.jsx:229` y reiniciar
    `fechaLimite`/`cierraAlVencer` en `abrirNuevo` (`:62`). (XS)
  - **Curso de pago:** casilla para `cursos.constancia` en `AdminCursos.jsx:275-291`. (XS)
  - **Categoría:** editar `activa`, `orden`, `motivo` y pasar `organizacion_id` en `AdminCursos.jsx:168-182`. (S)
  - **Constancia:** `cursos.max_descargas_constancia` en vez del 2 cableado en `Constancia.jsx`. (S)
  - **Recurso HTML:** tipo `html` en el `<select>` de `RecursosModulo.jsx:229` + `<textarea>` que escriba
    `recursos.contenido` (ya existe, sin UI). (S)

---

### FASE 3 — Experiencia del estudiante (Rol 4)

Cruza §5 del diagnóstico. El hilo conductor: **el autoinscrito gratuito es ciudadano de segunda en seis
pantallas, y casi todo arranca de que no tiene fila en `acceso`.**

#### F3-1 · Garantizar la inscripción del autoinscrito + pantalla "Mis cursos"
- **Cruza:** §5.1 (el hueco que más alumnos pierde). **Cubre del mapa:** "Panel de Tareas y Calendario
  Unificado", "Entorno de Aprendizaje".
- **Pasos:**
  1. Al entrar con sesión y 0 filas en `acceso`, resolver el taller de origen (guardado en `localStorage`
     al visitar un gratuito, o preguntándolo) e insertar la fila — reusando el disparador de
     `ALTA_PUBLICA_2_TANDAS.sql:104`.
  2. Nueva ruta `/mis-cursos` (en `App.jsx:94-110`) como destino por defecto tras login: lista cursos,
     avance y pendientes.
- **Prueba:** un autoinscrito ve su taller en "Mis cursos", en el calendario y en calificaciones.
- **Esfuerzo:** M. **Arregla de paso:** foro vacío engañoso, barra de avance oculta, calendario vacío.

#### F3-2 · Lote de arreglos XS del recorrido
- **Cruza:** §5.2. Cada uno independiente:
  - Ruta comodín `<Route path="*">` con "no existe" + botón a Inicio (`App.jsx`). (XS)
  - Mensaje de sesión caducada: no decir "tu acceso expiró" sino "por seguridad cerramos tu sesión"
    (`App.jsx:48`). (XS)
  - Quitar `!curso.gratuito` de la barra de avance (`CursoView.jsx:399`). (XS)
  - Botón de constancia solo cuando `estado_constancia.disponible`, no cuando no hay módulo siguiente
    (`ModuloView.jsx:338`). (XS)
  - Reemplazar el SQL visible al gestor (`ModuloView.jsx:193`) por el botón de candado. (XS)
  - La sección de tareas no debe desaparecer en silencio si falla la consulta (`TareasAlumno.jsx:269`). (XS)

#### F3-3 · Asistencia visible y ponderable para el alumno
- **Cruza:** §5.2. **Cubre del mapa:** transparencia académica.
- **Pasos:** bloque "Tu asistencia: N/M sesiones" en `MisCalificaciones.jsx` (lee `asistencia` vía una
  RPC `mi_asistencia(curso)`); opcionalmente añadir `asistencia` como componente en `src/lib/calificacion.js:8`.
- **Prueba:** el alumno de un curso presencial ve su asistencia y, si se activa, cómo pesa. **Esf.:** M.

#### F3-4 · Apuntes personales del alumno
- **Cubre del mapa:** "Toma de Apuntes Personales", "Espacio de Notas Privadas no Compartidas".
- **Pasos:** tabla `apuntes (usuario_id, recurso_id|modulo_id, texto, actualizado_en)` con RLS
  `auth.uid() = usuario_id`; un panel plegable en `ModuloView.jsx`/`RecursosModulo.jsx`.
- **Prueba:** el alumno escribe una nota, recarga y sigue ahí; el docente no la ve. **Esfuerzo:** M.

#### F3-5 · Insignias / Open Badges
- **Cubre del mapa:** "Módulo de Insignias Digitales (Open Badges)", gamificación.
- **Nota de criterio (del diagnóstico §9):** las insignias **complementan**, no sustituyen, la
  constancia con folio. No convertirlas en el logro principal.
- **Pasos:** tabla `insignias` (catálogo por organización: nombre, icono, criterio) + `insignias_ganadas`;
  emisión por evento (completar curso, aprobar examen) reusando los disparadores; visible en el perfil.
- **Prueba:** completar un curso otorga su insignia y aparece en el perfil. **Esfuerzo:** M.

#### F3-6 · PWA instalable + modo oscuro + accesibilidad
- **Cruza:** diagnóstico §6 y §7. **Cubre del mapa:** "Navegación Offline" (parcial), "Modo Nocturno",
  "Cumplimiento WCAG 2.1 AA".
- **Pasos (sub-fichas, en este orden):**
  1. **ModalPortal accesible** (§7.1, bloqueante): `role="dialog"`, `aria-modal`, Escape, trampa de foco,
     retorno de foco, bloqueo de scroll, en `src/components/ui.jsx:65`. Arregla los 32 modales de golpe.
  2. **Dos tokens de color** (§7.4, bloqueante, XS): subir `--gris`/`--muted` a `#5A6771`, añadir
     `--accent-texto: #9C5636`, arreglar `.button.whatsapp` en `src/App.css`.
  3. **Nombres accesibles** en los botones emoji 🔑📱🗑 y en la casilla de fila (`Admin.jsx`), y
     `role="alert"`/`status` en un componente `<Aviso>` que reemplace los 146 avisos.
  4. **Tokens de espaciado y escala tipográfica** en `:root` (§6, habilita el modo oscuro).
  5. **Modo oscuro:** bloque `@media (prefers-color-scheme: dark)` + `data-theme`, una vez existan los tokens.
  6. **PWA:** `public/manifest.json` + iconos + service worker mínimo (instalable, no offline completo).
- **Prueba:** navegación completa por teclado con foco visible; la app se instala en el teléfono; el
  modo oscuro del sistema la respeta. **Esfuerzo:** L (pero 1 y 2 son XS/M y de altísimo valor).

---

### FASE 4 — Docente y creador (Rol 3)

#### F4-1 · Drip real y prerrequisitos
- **Cruza:** §4.2 huecos 6, 13. **Cubre del mapa:** "Drip Content", "Visualizador de Prerequisitos".
- **Pasos:** sobre F2-6 (fechas), añadir `modulos.requiere_modulo_id` y comprobar en `esModuloBloqueado`
  (`CursoView.jsx:191`); mostrar al alumno "se desbloquea al completar X". **Esfuerzo:** L.

#### F4-2 · Reordenar arrastrando y archivar/restaurar
- **Cruza:** §4.2 huecos 14, 17. **Cubre del mapa:** "Course Builder".
- **Pasos:** arrastrar módulos y recursos (escribe `orden`); añadir `tareas.orden`; `archivado_en` +
  botón "📦 Archivar / ↩️ Restaurar" en módulo, recurso, foro, generación, categoría (copiando el patrón
  de `AdminCursos.jsx:415`). **Esfuerzo:** M.

#### F4-3 · Unificar los dos editores de foro y los dos de HTML
- **Cruza:** §3.5. **Pasos:** `<EditorHilo>` único para `AdminForo.jsx` y `AdminForoModal.jsx`;
  `<EditorRico>` en `ui.jsx` para `EditorForo.jsx` y el bloque de comunicados de `Admin.jsx`. **Esf.:** M.

---

### FASE 5 — Directivos (Rol 2)

#### F5-1 · Comunicados con historial y envío programado
- **Cruza:** §4.2 hueco 15. **Cubre del mapa:** "Campañas de Re-engagement", "Programación de Notificaciones".
- **Pasos:** tabla `comunicados` (asunto, cuerpo, canal, destino, estado, `programado_para`, `enviado_en`,
  `resultado`); guardar borrador; un cron de Cloudflare Workers o de Supabase para los programados.
- **Prueba:** redactar hoy un comunicado que sale mañana; ver el historial de enviados. **Esfuerzo:** L.

#### F5-2 · Dashboard de retención y alertas de deserción
- **Cruza:** §5.2 (datos ya existen). **Cubre del mapa:** "Dashboard de Retención", "Early Warning System".
- **Pasos:** reusar `calcularMetricas` y `vista_admin_inscripciones`; lista de alumnos con >N días sin
  entrar, con botón de comunicado directo. Sin IA: un umbral configurable basta a esta escala.
- **Prueba:** el directivo ve quién lleva 15 días sin entrar y le escribe en un clic. **Esfuerzo:** M.

#### F5-3 · Encuestas NPS y marca blanca por CSS
- **Cubre del mapa:** "Encuestas de Satisfacción (NPS)", "Personalización de Marca Blanca (CSS)".
- **Pasos:** tabla `encuestas`/`respuestas_encuesta`; módulo breve al terminar un curso. Para marca:
  campo `organizaciones.css_extra` saneado y aplicado tras los tokens. **Esfuerzo:** M cada uno.

---

### FASE 6 — Plataforma (Rol 1), lo que aplica a esta escala

#### F6-1 ⟡ · Pasarela de pago real (arranque)
- **Cubre del mapa:** "E-Commerce Integrado", "Pasarelas de Pago". **Decisión de negocio.**
- **Punto de entrada real:** ya existe `pagos_suscripcion` y `AdminSuscripciones.jsx`, hoy manuales.
  Una edge function nueva `pago-webhook` que reciba el webhook de **Stripe o Mercado Pago** (uno, no
  "pasarelas internacionales integradas") y escriba el pago. Empezar por pago único de un curso, no
  suscripción recurrente. **Esfuerzo:** L. **No empezar sin decisión del dueño sobre el proveedor y el país.**

#### F6-2 · Rate limiting y bitácora en las edge functions
- **Cruza:** §8.3 M5, A5. **Pasos:** límite por admin/minuto, tope de tamaño de cuerpo, una entrada en
  `auditoria` por llamada, en `crear-usuarios` y `whatsapp-enviar`. **Esfuerzo:** M.

#### F6-3 · Autenticar el relay de correo
- **Cruza:** §8.1 B1 (bloqueante). **Pasos:** secreto compartido en `apps-script/Notificador.gs` vía
  `PropertiesService`, exigido en cada petición; a medio plazo, mover el envío a una edge function que
  valide la sesión. **Esfuerzo:** M. **Nota:** encaja con la compra de dominio diferida (`PLAN_CORTO_PLAZO.md`).

---

## Parte D — Lo que NO se hace, y por qué

No es "imposible": es que con **Supabase + Cloudflare Workers, un equipo pequeño y la escala de un
consultorio**, el costo/beneficio no cierra. Dejarlo escrito es parte del trabajo: así la decisión es
informada, no un olvido.

| Requisito del mapa | Por qué no, hoy | Qué se hace en su lugar |
|---|---|---|
| Microservicios / Kafka / Kubernetes / balanceo elástico | Es una arquitectura para miles de inquilinos; aquí añade operación y costo sin usuarios que lo justifiquen. Cloudflare Workers + Supabase ya escalan solos para este volumen | Nada. El monolito actual es la decisión correcta |
| DRM (FairPlay/Widevine), transcodificación HLS, CDN propia, marca de agua en video | Requiere infraestructura de video dedicada y licencias caras | Decisión ya tomada: YouTube no listado + OneDrive (`PLAN_CORTO_PLAZO.md`) |
| SCORM / LTI 1.3 / xAPI (import/export) | Estándares pesados de otro ecosistema (Moodle/Canvas); nadie en este proyecto trae contenido SCORM | Si algún día hace falta migrar, se evalúa un importador puntual |
| Proctoring biométrico / facial / fonoaudiológico | Privacidad (datos biométricos), costo y fricción enormes para talleres de salud mental | Exámenes por RPC sin respuestas + límite de intentos y tiempo (ya existe) |
| Blockchain para títulos | La verificación pública por folio ya resuelve la infalsificabilidad sin la complejidad | `verificar_constancia` (ya funciona) |
| Split payments multi-nivel, multimoneda, conciliación fiscal multi-jurisdicción | Es un producto financiero en sí; aquí hay un instructor, no un marketplace de instituciones | Pago único por curso con un proveedor (F6-1), si el dueño lo decide |
| SSO SAML/OAuth corporativo (Azure AD/Okta) | No hay clientes corporativos con directorio activo que lo pidan | Correo + contraseña de Supabase (ya existe), con recuperación |
| Apps nativas en App Store / Google Play | Mantener dos clientes multiplica el trabajo; la web ya es responsive | PWA instalable (F3-6), que cubre el 90% de lo que la gente llama "la app" |
| Marketplace global, SEO automático, landing builder, afiliados | Son un negocio de crecimiento, no una necesidad del producto actual | Si el catálogo crece, se reevalúa; empezar por `/mis-cursos` (F3-1) |

---

## Resumen ejecutable: las primeras tres sesiones

1. **Sesión 1 — Fase 0 completa.** Verificar estado (F0-1), cerrar los agujeros de seguridad XS
   (F0-2, F0-3, F0-5, F0-7). Casi todo es de una línea y cierra dos bloqueantes.
2. **Sesión 2 — Fase 1.** Desplegar y encender el subsistema de roles (F1-1). Es el "pensar por roles"
   que pediste, y ya estaba escrito.
3. **Sesión 3 — Lo que más se nota.** El lote de control XS (F2-1, F2-2, F2-9) + el ModalPortal
   accesible y los dos tokens de color (F3-6 pasos 1-2) + el editor de módulo (F2-4).

A partir de ahí, las fases 2–6 se toman por valor contra esfuerzo según lo que el negocio priorice.
Nada de este plan requiere cambiar de arquitectura: todo se construye sobre lo que ya hay.
