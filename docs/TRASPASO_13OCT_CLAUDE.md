# Traspaso — estado al 13 de octubre de 2026

> **Proyecto:** `Cursos_DrCotonieto` — Dr. Ernesto Cotonieto
> **Para:** cualquier agente (IA) que continúe este trabajo
> **Último commit en `main`:** `2f1548d` (árbol de trabajo limpio, todo empujado)
> **Documentos antecedentes, en orden de lectura:**
> 1. `docs/CORTE_DIAGNOSTICO_2_CLAUDE.md` — el diagnóstico (hallazgos, severidad, archivo:línea)
> 2. `docs/PLAN_ACCIONES_1_CLAUDE.md` — el plan por fases que se ha venido ejecutando
> 3. `docs/FASE_1_ROLES_DESPLIEGUE.md` — guía específica del subsistema de roles
> 4. Este documento — qué de ese plan ya se hizo, qué falta, y qué revisar antes de tocar nada

---

## 0. Antes de escribir una sola línea: dos verificaciones obligatorias

El agente anterior (yo) **no tiene acceso de escritura a la base de datos** — el `.env` del repo
solo trae la clave pública (`VITE_SUPABASE_PUBLISHABLE_KEY`). Todo el SQL se entregó como archivos
en `supabase/*.sql` para que el Dr. Cotonieto los corriera a mano en el SQL Editor de Supabase.
**Esto significa que ningún agente puede saber con certeza, desde el repo, qué SQL está realmente
instalado.** Antes de construir sobre cualquier función o columna nueva:

1. **Correr `supabase/ESTADO.sql`** en el SQL Editor y leer qué filas dicen `❌ FALTA CORRER`. Es la
   única fuente de verdad. No asumas nada por los commits de git: un commit que *añade* un script no
   prueba que *se haya corrido*.
2. **Comprobar el aislamiento de `vista_admin_inscripciones`:**
   ```sql
   select pg_get_viewdef('vista_admin_inscripciones'), reloptions
     from pg_class where relname = 'vista_admin_inscripciones';
   ```
   Si `reloptions` no incluye `security_invoker=true`, es una fuga de datos entre organizaciones
   (cualquier autenticado podría leer el padrón completo de la plataforma) y es **lo primero** que
   hay que arreglar, por encima de cualquier otra tarea de este documento.

### SQL creado en esta sesión cuyo estado de ejecución NO está confirmado

El usuario dijo "he corrido todos los SQL" en un punto intermedio (cubre `SEG_1_BULK_ACCESO.sql`,
`SEG_2_LOTE.sql`, `MODULOS_VISIBILIDAD.sql`, y probablemente `ROLES_5/6/7_*.sql`), pero **después de
eso se crearon cuatro scripts más** y su ejecución nunca se reconfirmó:

| Script | De qué depende el frontend | Si falta, qué se rompe (nada grave — todo degrada) |
|---|---|---|
| `supabase/MODULOS_FECHAS.sql` | Columnas `modulos.abre_el`/`cierra_el` | El modal de editar módulo guarda todo lo demás pero avisa que las fechas no se guardaron |
| `supabase/ASISTENCIA_ALUMNO.sql` | Función `mi_asistencia(curso)` | "Mis cursos" simplemente no muestra el bloque de asistencia |
| `supabase/APUNTES.sql` | Tabla `apuntes` | El panel "📝 Mis apuntes" del módulo no aparece |
| `supabase/MODULOS_PRERREQUISITO.sql` | Columna `modulos.requiere_modulo_id` | El selector "Requiere completar antes" no persiste; el resto del modal sí se guarda |

**Acción para quien retome:** correr `ESTADO.sql`, ver cuáles de estos cuatro faltan, pasárselos al
Dr. Cotonieto para correr en Supabase (orden: no importa entre ellos, son independientes), y solo
entonces construir funcionalidad que dependa de ellos.

---

## 1. Qué se ha hecho (Fases 0 a 4, parcial)

Todo el frontend está **desplegado en producción** (push a `main` → CI en
`.github/workflows/deploy.yml` → Cloudflare Workers). El lint en CI es bloqueante **solo por errores**
(no por avisos), tras corregir que estaba en `continue-on-error` y dejaba pasar bugs reales.

| Fase | Hecho | Commit |
|---|---|---|
| 0 — Seguridad y desbloqueo | Cierra inscripción libre a cursos de pago, search_path en funciones definer, retira política pública de módulos, obsoleta un script-regresión (`RLS_EXAMENES.sql` → `OBSOLETO_`), aísla borrado de usuario por organización | `39b121f` |
| 1 — Roles | Auditoría completa del subsistema `ROLES_5/6/7` (ya estaba escrito, solo faltaba desplegarse); arreglo de la pestaña inicial del panel para roles personalizados | `c810d0c` |
| 2 — Control granular | Editor de módulo completo (antes no se podía editar tras crear), fechas en foro desacopladas de "calificar", casilla de constancia para cursos de pago, fechas de apertura/cierre de módulo, notificación de "módulo abierto" corregida (emparejaba por título, ahora por `curso_id`) | `1d8a19a`, `b063529` |
| 3 — Alumno | Pantalla **"Mis cursos"** (nueva, `/mis-cursos`), PWA instalable (`manifest.json`), `aria-label` en botones destructivos de Gestión de usuarios, asistencia visible al alumno, apuntes personales por módulo | `aa42826`, `3b30fe8` |
| Accesibilidad transversal | Logo responde a Espacio (antes solo Enter), enlace "Saltar al contenido" | `8504935` |
| 4 — Docente (parcial) | Reordenar módulos y recursos con ↑/↓ (antes solo tecleando un número), prerrequisitos de módulo (drip por avance: "completa X antes de entrar a Y") | `dd13b68`, `2f1548d` |

---

## 2. Qué falta — por fase, con la razón por la que no se hizo ya

### Fase 2 (control) — dos pendientes, y los dos a propósito

- **F2-5 — unificar los seis sistemas de botón configurable** en una sola tabla/editor. **No se
  hizo porque implica migrar datos de botones que ya existen en cursos en producción** (jsonb en
  `cursos.rutas_botones`, `modulos.botones_extra`, columnas sueltas en `curso_material`). Migrar a
  ciegas sin ver la forma real de esos datos puede perder botones configurados. **Antes de tocarlo:**
  pedir al Dr. Cotonieto una consulta de muestra de esas tres fuentes (`select rutas_botones from
  cursos where rutas_botones != '{}'`, etc.) y diseñar la migración contra datos reales, no contra lo
  hipotético. Detalle completo de los seis sistemas en `CORTE_DIAGNOSTICO_2_CLAUDE.md` §4.3.
- **F2-8 — que la constancia del alumno use `plantillas_documento`.** Investigado a fondo: **no es
  un cambio de frontend**. La constancia la genera el alumno en su propio navegador, y por RLS un
  alumno no puede leer `plantillas_documento` (política `plantillas_select` solo permite
  admin/facilitador). Para que funcionara habría que mover la lectura de la plantilla a
  `preparar_descarga_constancia()` (función `security definer`, atómica, que además emite folios
  verificables públicamente) — cambio que no se puede probar sin acceso de escritura a la base. Como
  hoy esa organización no tiene plantilla de constancia configurada, el beneficio inmediato es cero.
  Dejarlo para cuando exista una segunda organización que lo necesite, y hacerlo con la función ya
  probada contra datos reales.

### Fase 3 (alumno) — un pendiente, deliberado

- **F3-5 — insignias / Open Badges.** No se construyó. El diagnóstico (`CORTE_DIAGNOSTICO_2_CLAUDE.md`
  §9, punto 8 de la comparativa con Moodle) advierte explícitamente: la plataforma ya tiene algo mejor
  que insignias — la constancia con folio verificable en público — y añadir insignias decorativas
  **devalúa** esa credencial en vez de sumar. Si se retoma, debe ser con esa advertencia presente, no
  como un "ítem más del backlog".
- **Modo oscuro y tokens de espaciado/tipografía** (resto de F3-6): no empezado. Es un proyecto en sí:
  hoy solo existen 14 de los ~90 tokens de color que un tema oscuro necesitaría. No improvisar por
  pantalla — completar primero la escala de tokens semánticos (`CORTE_DIAGNOSTICO_2_CLAUDE.md` §6,
  hallazgos 9 y 10) y solo después el bloque `@media (prefers-color-scheme: dark)`.
- Barrido completo de `<label htmlFor>` en formularios (166 labels huérfanos detectados en el
  diagnóstico): no empezado, es trabajo de talla L.

### Fase 4 (docente) — dos pendientes

- **F4-3 — unificar `AdminForo.jsx` y `AdminForoModal.jsx`** (el mismo CRUD de hilos escrito dos
  veces, ya divergente: uno reinicia la fecha límite al abrir un tema nuevo y el otro no lo hacía
  hasta que se corrigió en esta sesión — ver si la corrección de `AdminForoModal.jsx` del commit
  `1d8a19a` ya cerró esa divergencia puntual, pero el duplicado estructural sigue). Es refactor puro,
  sin cambio visible; bajo riesgo pero requiere tocar dos archivos con cuidado de no romper ninguno
  de los dos flujos (panel central vs. dentro del curso).
- **Archivar/restaurar** en vez de borrado duro para módulo, recurso, foro, generación, categoría. Hoy
  solo `cursos` tiene archivar (vía `activo`). Patrón a copiar: `AdminCursos.jsx` líneas de
  archivar/reactivar.

### Fases 5 y 6 (directivos y plataforma) — no empezadas

Todo el contenido de `PLAN_ACCIONES_1_CLAUDE.md` §Fase 5 (comunicados programados con historial,
dashboard de retención/deserción, encuestas NPS, marca blanca por CSS) y §Fase 6 (pasarela de pago —
marcada ⟡ como decisión de negocio del dueño, no tocar sin que él decida proveedor y país—, rate
limiting en las edge functions, autenticar el relay de correo) siguen sin empezar.

---

## 3. Seguridad — lo que el diagnóstico encontró y aún no se cerró

De `CORTE_DIAGNOSTICO_2_CLAUDE.md` §8, lo que la Fase 0 **no** alcanzó a cubrir (son de talla S/M,
no XS, por eso se dejaron para después):

- **B1** — el relay de correo (`apps-script/Notificador.gs`) no comprueba ningún secreto ni origen:
  cualquiera en internet con la URL puede mandar correo desde la cuenta de Gmail del doctor. Encaja
  con la decisión ya tomada de posponer el dominio propio (`docs/PLAN_CORTO_PLAZO.md`); cuando se
  retome el dominio, es el momento de resolver esto junto con un secreto compartido vía
  `PropertiesService`.
- **B2** — la edge function `crear-usuarios` deja que un admin de una organización pise la
  contraseña de una cuenta de **otra** organización si ya existe (la rama de "ya existía" no tiene el
  mismo filtro que la rama de recuperación de enlace).
- **B5** — las respuestas correctas de los exámenes viajan completas al navegador de cualquier
  alumno autenticado, porque dos políticas de `examenes` se suman por OR y una de ellas no distingue
  roles. `ExamenModulo.jsx` pide `select('*')`.
- **A1-A8** — funciones de directorio (`listar_usuarios_con_accesos`, `listar_whatsapp`,
  `listar_inscritos_gratuitos`) que no filtran por organización; folios de constancia enumerables;
  enlaces de recuperación que el panel se devuelve a sí mismo sin filtrar por organización destino.

Ninguno de estos es XS. Si el próximo trabajo es seguridad y no funcionalidad, empezar por **B1 y
B5**: son los dos con mayor exposición pública (sin necesidad de ser admin de nada).

---

## 4. Convenciones que hay que seguir si se continúa el patrón de esta sesión

Para que el estilo y las garantías no se rompan entre agentes distintos:

1. **Todo SQL nuevo es un archivo `.sql` en `supabase/`, idempotente**, con cabecera que explica qué
   resuelve, cómo funciona, y una sección final `PRUEBA DE ACEPTACIÓN`. Se entrega al Dr. Cotonieto
   para correr — **nunca asumir que ya corrió** sin pedir confirmación o sin verificar con `ESTADO.sql`.
2. **Toda función `SECURITY DEFINER` nueva lleva `set search_path = public`** y su `revoke all … from
   public; grant execute … to authenticated` explícito. Es el patrón que corrigió media docena de
   fugas en la Fase 0.
3. **Toda columna nueva nace en `null`/con un default que reproduce el comportamiento actual.** El
   patrón de todo lo añadido (`oculto`, `abre_el`/`cierra_el`, `requiere_modulo_id`) es: si no se
   usa, el sistema se comporta exactamente igual que antes. Nunca un cambio que obligue a migrar
   datos existentes para no romper nada.
4. **El frontend que depende de SQL nuevo degrada con elegancia.** Patrón repetido: detectar el error
   de "columna/función no existe" (`error.code === '42703'` o el mensaje de PostgREST) y reintentar
   sin esos campos, avisando qué script falta correr — nunca dejar una pantalla rota por un SQL no
   corrido. Ver `ModalEditarModulo` en `AdminModales.jsx` como referencia.
5. **Antes de cada commit:** `npm run lint` (debe dar 0 errores — los avisos de `react-hooks/exhaustive-deps`
   preexistentes están bien dejarlos), `npx vite build`, `npm run smoke`. Los tres deben pasar.
6. **Registrar cada script nuevo en `supabase/ESTADO.sql`** (la tabla `esperado`) para que la
   comprobación de estado siga siendo la fuente de verdad única.
7. **Nunca tocar `F2-5` (botones) ni `F2-8` (constancia) sin antes pedir datos reales** de la base,
   por las razones explicadas arriba. Son los dos únicos puntos donde "avanzar solo" es
   deliberadamente irresponsable.
8. Cuidado con el contexto de **ventana de mantenimiento**: en esta sesión el trabajo se hizo
   asumiendo que no había usuarios navegando en vivo (confirmado explícitamente por el dueño). Si se
   retoma sin esa confirmación, **preguntar primero** si hay tráfico real antes de desplegar cambios
   que toquen pantallas muy usadas (login, curso, módulo).

---

## 5. Puntero rápido de archivos clave

| Qué | Dónde |
|---|---|
| Hallazgos del diagnóstico, por eje, con severidad | `docs/CORTE_DIAGNOSTICO_2_CLAUDE.md` |
| El plan completo de 6 fases | `docs/PLAN_ACCIONES_1_CLAUDE.md` |
| Cómo desplegar y probar el subsistema de roles | `docs/FASE_1_ROLES_DESPLIEGUE.md` |
| Estado de instalación de todo el SQL | `supabase/ESTADO.sql` (correr, no leer) |
| Convención de permisos del proyecto | `src/lib/permisos.js` (comentario de cabecera) |
| Patrón de degradar sin romper si falta SQL | `src/components/AdminModales.jsx` → `ModalEditarModulo` |
| CI / despliegue | `.github/workflows/deploy.yml` |
