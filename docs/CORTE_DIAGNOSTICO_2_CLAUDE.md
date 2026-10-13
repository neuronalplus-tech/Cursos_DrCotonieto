# Corte diagnóstico 2 — Revisión estratégica multidisciplinaria

> **Proyecto:** `Cursos_DrCotonieto` — Dr. Ernesto Cotonieto
> **Rama:** `main` · **Fecha del corte:** 12 de octubre de 2026
> **Autor del análisis:** Claude (agente de código), integrando cinco pasadas especializadas
> **Tipo de documento:** diagnóstico (no ejecuta cambios)
> **Antecedente:** `docs/CORTE_DIAGNOSTICO_1_CLINE.md` (2 oct) y `docs/PLAN_CORTO_PLAZO.md` (3 oct).
> Este corte **no los repite**: aquellos trataron el ecosistema y el plan de 4 semanas; este mira la
> estructura del producto frente a Moodle.

---

## Cómo leer este documento

Seis ejes, revisados en paralelo por pasadas independientes y después contrastados entre sí.
Cada hallazgo lleva **archivo:línea verificado**. Lo que no se pudo confirmar está marcado como
tal en vez de darse por bueno — y la sección 0 explica cómo confirmarlo en diez minutos.

Severidades: **bloqueante** (hay alguien afectado hoy) · **alta** · **media** · **baja**.
Esfuerzos: **XS** (minutos) · **S** (una sesión) · **M** (varios días) · **L** (un proyecto).

---

## 0. Antes que nada: cuatro comprobaciones de diez minutos

Cuatro de las cinco pasadas se toparon con el mismo obstáculo y conviene resolverlo **antes** de
tocar nada, porque cambia el diagnóstico de varias secciones.

`supabase/ESTRUCTURA.md` se generó el **9 de octubre** leyendo el catálogo real de Postgres. Varias
cosas que el código usa no figuran ahí. Cruzando la fecha del volcado con la fecha de cada script
en git se puede separar «el volcado está viejo» de «el script nunca se corrió»:

| Script | Fecha en git | ¿Sus objetos están en el volcado? | Lectura |
|---|---|---|---|
| `ROLES_5_PERMISOS.sql` | **08 oct** (anterior al volcado) | **No** (0 de 4 tablas, 0 de 5 funciones) | **Casi con certeza nunca se corrió** |
| `EXAMENES_LIMITE_TIEMPO.sql` | 09 oct (mismo día) | No | Ambiguo — hay que mirar |
| `CONSTANCIAS_5_…sql` | 10 oct | No | El volcado está viejo, normal |
| `CONFIG_REGISTRO.sql` | 11 oct | No | El volcado está viejo, normal |
| `ALTA_PUBLICA_2_TANDAS.sql`, `WHATSAPP_Y_BAJAS.sql` | 12 oct | No | Recién escritos, normal |

**Comprobación 1 — ¿está instalado el sistema de roles?**
Las tablas `roles`, `permisos`, `rol_permisos`, `asignaciones_rol` y las funciones `tiene_permiso`,
`cursos_que_puedo`, `mis_permisos`, `puedo_en_generacion`, `sembrar_roles_basicos` **no aparecen
en el volcado**, y su script es *anterior* a él. Mientras tanto, el panel tiene una pestaña
**Roles** ([AdminRoles.jsx](../src/components/AdminRoles.jsx)) y [permisos.js](../src/lib/permisos.js)
pregunta por `cursos_que_puedo` — con una degradación elegante si la función no existe
([permisos.js:71](../src/lib/permisos.js#L71)), que es precisamente lo que ha estado ocultando el
problema. Si se confirma, **la granularidad de roles que el producto aparenta no existe en la base**.
→ `supabase/ESTADO.sql` (fila 29) lo responde. Pégalo en el SQL Editor y córrelo.

**Comprobación 2 — ¿existe `examenes.limite_minutos`?**
Se usa en [EditorExamen.jsx:115](../src/components/EditorExamen.jsx#L115) y
[ExamenModulo.jsx:66](../src/components/ExamenModulo.jsx#L66). El reintento defensivo de
[EditorExamen.jsx:141-143](../src/components/EditorExamen.jsx#L141-L143) cubre `aleatorio_n` y
`mezclar_opciones` pero **no** `limite_minutos`: si la columna falta, poner un límite de tiempo
**rompe el guardado entero del examen**, no solo el límite.

**Comprobación 3 — regenerar `ESTRUCTURA.md`.**
Ocho RPC que el frontend invoca no están en el volcado, y el volcado **no tiene sección de vistas**
—así que `vista_admin_inscripciones`, de la que dependen el panel de inscripciones, la mensajería y
todo el envío de correo, no está documentada en ninguna parte del repositorio ni definida en ningún
`.sql`. Si se recrea el proyecto, no hay forma de reconstruirla.

**Comprobación 4 — ¿esa vista respeta el RLS?** La más urgente de las cuatro, y son 30 segundos:

```sql
select pg_get_viewdef('vista_admin_inscripciones'), reloptions
  from pg_class where relname = 'vista_admin_inscripciones';
```

En Postgres una vista se ejecuta con los privilegios de su **propietario** y **no aplica el RLS de
las tablas de debajo** salvo que se haya creado con `WITH (security_invoker = true)`. El comentario
de [correo.js:29-30](../src/lib/correo.js#L29-L30) afirma que «ya respeta RLS de `es_admin()`», y eso
es casi seguro falso. Si `reloptions` no incluye `security_invoker=true`, cualquier usuario
autenticado puede pedir la vista por su nombre con la clave pública y obtener **el padrón de
inscripciones completo de la plataforma** — y ese pasa a ser el primer arreglo de toda la lista.

---

## 1. La foto honesta

**La plataforma está mucho mejor de lo que su desorden sugiere.** Hay piezas que superan a Moodle y
que no son fáciles de construir: constancia con folio y verificación pública sin sesión, un libro de
calificaciones que le dice al alumno *qué le falta* con el enlace para ir a hacerlo, rúbricas visibles
antes de entregar, exámenes servidos por RPC sin respuestas, cohortes con sede y modalidad, alta
masiva por padrón. Nada de eso hay que inventarlo.

El problema tampoco es que falten abstracciones. Son cuatro diagnósticos transversales, y los cuatro
son la misma enfermedad en capas distintas:

**(a) Las abstracciones se construyeron después de las pantallas, y las pantallas no volvieron a
buscarlas.** Existe `lib/plazos.js` con el formateador de fechas y lo importan 4 archivos, mientras
~30 sitios llaman a `toLocaleDateString` con opciones distintas. Existe `:root` con 22 tokens y hay
**277 colores escritos a mano**, 40 de ellos el propio azul de marca. Existe `ModalPortal` y los 32
modales repiten a mano el mismo esqueleto. Existe `notificarInscritos()` y `CursoView` se escribió
su propia versión que empareja alumnos **por título de curso** en vez de por id. No es deuda por
dejadez: es deuda por no haber vuelto a pasar.

**(b) El control que pides existe en la base de datos; lo que falta es el interruptor.**
`cursos.fecha_inicio` y `cursos.fecha_fin` existen y **ningún archivo de `src/` las lee ni las
escribe**. *(Si lo buscas verás 20 coincidencias de `fecha_inicio`: todas son de
`generaciones.fecha_inicio`, en `AdminGeneraciones`, `Calendario`, `GenerarDocumento` y
`PanelProgreso`. En `AdminCursos`, `CursoView`, `CursoCard` y `helpers.js` no hay ni una.)* `cursos.constancia` decide si un curso de pago emite constancia y no tiene casilla en
ningún formulario. `categorias.activa`, `categorias.orden` y `categorias.motivo` existen y el
formulario solo manda nombre y descripción. `recursos.contenido` existe y ningún campo lo edita.
Hay **seis sistemas distintos de botón configurable** porque cada vez que hizo falta un control nuevo
se añadió una columna más en vez de usar la que ya había.

**(c) Un módulo no se puede editar después de crearlo.** Es el hueco más caro y el más invisible:
en todo `src/` hay exactamente tres `update` sobre `modulos`, y ninguno toca título, descripción,
orden ni ruta. Para corregir una errata en el título de un módulo hay que entrar a Supabase.

**(d) La red de seguridad automática está apagada, y ya dejó pasar un bug.** CI publica en cada push
y **lo único que bloquea es que compile**: lint y `check` están en `continue-on-error`
([deploy.yml:33,39](../.github/workflows/deploy.yml#L33)), y los 16 archivos de prueba de `supabase/`
más los 3 *smoke* nunca corren. Hoy `npm run lint` devuelve exactamente **2 errores**: uno es código
huérfano y el otro es un bug real que lleva publicándose (§3.1). El `check-columnas` tampoco ayuda:
su expresión regular solo mira `.select(…)`, así que no ve que dos `insert` escriben en una columna
que no existe.

**(e) En seguridad, el modelo es bueno y lo que falla son las excepciones.** No hay ni una tabla sin
RLS, nadie puede nombrarse administrador desde la API, las constancias no se pueden falsificar y los
exámenes se sirven por una ruta bien diseñada. Pero hay un puñado de funciones que no usa ese modelo,
y el precio es alto: **dos funciones `SECURITY DEFINER` sin ninguna comprobación de permiso dejan a
cualquier alumno inscribirse solo en cualquier curso de pago** (§8.1 B3), tres funciones devuelven el
padrón de *todos* los clientes a cualquier admin de organización (§8.2 A1), y el relay de correo no
pide credencial ninguna, así que cualquiera en internet puede enviar correo desde tu Gmail con tu
marca (§8.1 B1). Son excepciones, no el diseño — y las dos primeras se cierran con cambios de talla XS.

**Veredicto para la comparación con Moodle:** no estás por debajo en funcionalidad —estás por debajo
en **continuidad**. A Moodle le sobra estructura y le falta claridad; aquí es al revés. La estrategia
competitiva no es añadir funciones, es terminar de adoptar lo que ya construiste y darle interruptor
a lo que ya está en la base.

---

## 2. Por dónde empezar

### Primero: dos comprobaciones que pueden reordenar todo lo demás (10 minutos)

| | Qué | Por qué antes que nada |
|---|---|---|
| 0a | Correr `supabase/ESTADO.sql` y regenerar `ESTRUCTURA.md` | Sin esto, cinco secciones de este informe siguen siendo «probablemente» — incluida la de si tienes sistema de roles |
| 0b | `select pg_get_viewdef('vista_admin_inscripciones'), reloptions from pg_class where relname='vista_admin_inscripciones'` | Si esa vista no es `security_invoker`, **cualquier autenticado puede pedir el padrón completo de inscripciones** y eso pasa a ser lo primero de la lista (§8.2 A7) |

### Después: diez arreglos, y los ocho primeros caben en una sesión

| # | Qué | Eje | Sev. | Esf. | Por qué este |
|---|---|---|---|---|---|
| 1 | Comprobación de permiso + `revoke` en `bulk_grant_course_access` y `bulk_remove_course_access` | Seg. | **bloq.** | **XS** | Hoy **cualquier alumno con cuenta se inscribe solo en cualquier curso de pago** desde la consola del navegador. Es tu modelo de negocio, y se cierra con un `if` |
| 2 | Lote de seguridad XS: filtrar organización en `eliminar_usuario` · `search_path` en 5 funciones · borrar `modulos_lectura_publica` · retirar `RLS_EXAMENES.sql` | Seg. | bloq./alta | **XS** | Cuatro cambios pequeños y sueltos. El último es un script-regresión que, si alguien lo corre, convierte a todo admin de cliente en admin de plataforma |
| 3 | `sinMigracion` → `sinMigrar` en [ExamenModulo.jsx:235](../src/components/ExamenModulo.jsx#L235) | Alumno | bloq. | XS | Una palabra. Hoy «Volver a intentar» no hace nada, **en silencio** |
| 4 | Borrar `src/client/` y poner el lint **bloqueante** en CI | Arq. | alta | XS | Deja el lint en 0 errores y cierra para siempre la clase de fallo del punto 3 |
| 5 | Filtrar `b.activo !== false` en [CursoView.jsx:439](../src/components/CursoView.jsx#L439) | Control | alta | XS | Apagas un botón de ruta y sigue saliendo. Es literalmente tu queja |
| 6 | `'nueva'` → `'nuevo'` en [AdminCursos.jsx:120](../src/components/AdminCursos.jsx#L120) | Control | alta | XS | Un curso nuevo nunca recibe `organizacion_id` y desaparece de su propia lista |
| 7 | Un solo `cargarInscripciones(orgId)` con el filtro dentro | Arq. | bloq. | XS | Cuatro refrescos escriben `filas` sin filtro: fuga entre clientes en la propia pantalla |
| 8 | Subir `--gris`, añadir `--accent-texto`, arreglar `.button.whatsapp` | Estética | bloq. | XS | Tres líneas de CSS corrigen el contraste de ~150 reglas y del CTA comercial |
| 9 | Autenticar el relay de Apps Script | Seg. | **bloq.** | M | Hoy **cualquiera en internet** manda correo desde tu Gmail con tu marca a quien quiera |
| 10 | Dar a `ModalPortal` el contrato de diálogo | Accesib. | bloq. | M | Un componente arregla **32 modales**, incluido el de borrado de cuentas |

Justo detrás, los dos de mayor valor estructural: **garantizar la fila en `acceso` del autoinscrito
más una ruta `/mis-cursos`** (arregla seis pantallas de un golpe, §5.1) y **resolver `modulos.oculto`
y el editor de módulo** (hoy no puedes corregir el título de un módulo sin entrar a Supabase, §4.2).

---

## 3. Eje A — Arquitectura y duplicidad

### 3.1 El lint apagado dejó pasar un bug real · bloqueante · XS

[ExamenModulo.jsx:233](../src/components/ExamenModulo.jsx#L233) declara `const sinMigrar` y
[:235](../src/components/ExamenModulo.jsx#L235) lee `if (!sinMigracion)` — variable inexistente.
Es un `ReferenceError` dentro de un `catch` en una función `async`: **no hay mensaje, no hay alerta,
no pasa nada**. El camino correcto está dos funciones más arriba, en
[:113-115](../src/components/ExamenModulo.jsx#L113-L115), escrito bien.

*Desde fuera:* el alumno que suspende y pulsa «Volver a intentar» justo cuando la base dice que no
(plazo cerrado, intentos agotados) ve que el botón **no hace absolutamente nada**. Pulsa tres veces
y escribe por WhatsApp.

Lo relevante no es el bug, es cómo llegó a producción: **ESLint ya lo detecta**
(`'sinMigracion' is not defined`), pero CI corre el lint con `continue-on-error: true`. El comentario
de [deploy.yml:26-31](../.github/workflows/deploy.yml#L26-L31) explica la decisión y es razonable
—se puso bloqueante, un fallo de lint congeló la publicación y se desactivó—. La salida no es
elegirlo todo o nada: hoy el lint tiene **2 errores y 4 avisos**; si se borra el huérfano
`src/client/components/CourseView.jsx` (17 líneas, en inglés, que no importa nadie y referencia un
archivo inexistente) y se arregla esta palabra, queda en **cero errores** y se puede bloquear solo
por errores (`--max-warnings=999`) sin volver a congelar nada.

### 3.2 Seis sistemas de «botón configurable» conviven · alta · L

Esto merece su propia sección por ser tu queja explícita: ver **§4.3**.

### 3.3 `vista_admin_inscripciones` no existe en el repositorio · bloqueante · XS

Ocho sitios la consultan ([Admin.jsx:307](../src/components/Admin.jsx#L307), `:627`, `:823`,
`:1358`, `:1456`, [CursoView.jsx:244](../src/components/CursoView.jsx#L244),
[MensajesInbox.jsx:145](../src/components/MensajesInbox.jsx#L145),
[correo.js:29](../src/lib/correo.js#L29)) y no está definida en ningún `.sql` ni mencionada en
`ESTRUCTURA.md`. Es exactamente el riesgo que `ESTRUCTURA.md` dice querer cerrar, y quedó fuera.
→ Volcar `pg_get_viewdef('vista_admin_inscripciones')` a `supabase/VISTAS.sql`.

### 3.4 El filtro multi-inquilino solo se aplica en la carga inicial · bloqueante · XS

[Admin.jsx:312](../src/components/Admin.jsx#L312) acota las inscripciones a los cursos de la
organización. Los cuatro refrescos posteriores —`:627`, `:823`, `:1358`, `:1456`— hacen
`setFilas(data || [])` **sin ese filtro**.

*Desde fuera:* un admin de organización que crea un usuario, usa el alta masiva o toca un candado
ve, desde ese instante y sin recargar, las inscripciones de **todos los demás clientes**.

### 3.5 Resto de hallazgos de arquitectura

| Sev. | Qué | Dónde | Esf. |
|---|---|---|---|
| alta | Dos columnas a una letra de distancia: `cursos.grabacion_activa` (muerta) y `curso_material.grabacion_activo` (viva). Con `sesion_vivo_*`, `proxima_sesion` e `imagen_portada`, **siete columnas de `cursos` sin una sola referencia en `src/`** | `ESTRUCTURA.md:172,192` | S |
| alta | «Notificar al publicar» existe dos veces con criterios incompatibles: [correo.js:26](../src/lib/correo.js#L26) filtra por `curso_id`; [CursoView.jsx:248](../src/components/CursoView.jsx#L248) compara **títulos normalizados**. Dos cursos con el mismo título reciben el aviso cruzado | | XS |
| alta | Tres formas de responder «¿soy admin?», y la del `Header` es la peor: [App.jsx:70](../src/App.jsx#L70) consulta directo y baja un booleano como prop; [ForoCurso.jsx:278](../src/components/ForoCurso.jsx#L278) **se trae la tabla `admins` entera al navegador**; el hook bueno es [permisos.js:96](../src/lib/permisos.js#L96) | | S |
| alta | `AdminForo.jsx` y `AdminForoModal.jsx` son el mismo CRUD escrito dos veces, **y ya divergieron** (el modal no reinicia la fecha límite al abrir un tema nuevo) | | M |
| alta | `Admin.jsx`: 2 998 líneas, 82 `useState`, 12 vistas de las que 5 siguen dentro. Orden de extracción propuesto: métricas → facilitadores → comunicados → usuarios → inscripciones, con `useInscripciones(orgId)` como paso 0 | | L |
| alta | `estado_constancia` está definida **tres veces** en tres scripts; cuál está viva depende de cuál se corrió último | | S |
| media | «Mostrar/ocultar» reescrito 12 veces; [CursoCard.jsx:52-91](../src/components/CursoCard.jsx#L52-L91) y [TallerRecursos.jsx:217-249](../src/components/TallerRecursos.jsx#L217-L249) son copias literales que pueden desincronizarse en la misma sesión | | M |
| media | **Cuatro** patrones de confirmación (17 `window.confirm`, 7 modales, confirmación por correo, doble clic) y **24 `alert()`** frente a 30 avisos en caja | | M |
| media | El editor de HTML enriquecido existe dos veces: `EditorForo.jsx` y otra vez dentro de `Admin.jsx` | | M |
| media | La administración del curso vive dentro de la pantalla del alumno: `CursoView.jsx` borra módulos, dispara correo masivo e importa cinco paneles de admin. El JavaScript viaja al navegador del alumno aunque esté tras `if (gestiona)` | | L |
| media | El saneador de HTML está bien centralizado —**todos** los `dangerouslySetInnerHTML` pasan por él, es el mejor ejemplo del proyecto— pero vive en `lib/foro.js`, así que quien añada una pantalla no lo va a encontrar | | S |
| baja | Un componente huérfano (`src/client/`), 20 archivos de depuración versionados en la raíz y `respaldo/App (1).jsx` con 4 000 líneas que ensucian toda búsqueda | | XS |

---

## 4. Eje B — Control y granularidad

Es el eje que más te importa, así que va completo.

### 4.1 La matriz

✅ existe · 🟡 parcial o roto · ❌ no existe

| Entidad | Visible | Abierto/cerrado | Fecha apertura | Fecha cierre | Notificar | Descripción | Plantilla HTML | Orden | Prerreq. | Particip. | Etiquetas | Duplicar/archivar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Curso** | ✅ | 🟡 | ❌ *(columna muerta)* | ❌ *(columna muerta)* | ❌ | ✅ | ❌ | 🟡 | ❌ | ❌ | ✅ | ✅ |
| **Módulo** | 🟡 *(roto)* | 🟡 | ❌ | ❌ | 🟡 | ❌ | ❌ | 🟡 *(solo al crear)* | ❌ | — | 🟡 | 🟡 |
| **Recurso** | 🟡 | 🟡 | ❌ | ❌ | 🟡 *(solo al crear)* | ✅ | 🟡 *(columna sin UI)* | ✅ | ❌ | — | 🟡 | 🟡 |
| **Examen** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | 🟡 | ❌ | — | ❌ | 🟡 |
| **Tarea** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | — | 🟡 | 🟡 |
| **Foro** | ❌ | ✅ | ❌ | 🟡 *(solo si califica)* | ❌ | ✅ | 🟡 | 🟡 | ❌ | 🟡 *(sin control)* | ❌ | ❌ |
| **Constancia** | 🟡 *(solo gratuitos)* | 🟡 | ❌ | ❌ | ❌ | — | 🟡 *(la editable no se usa)* | — | — | — | — | ❌ *(sin revocar)* |
| **Comunicado** | — | ❌ *(sin borrador)* | ❌ *(sin programar)* | — | *(es la función)* | ✅ | 🟡 | — | — | — | — | ❌ *(sin historial)* |
| **Categoría** | ❌ *(columna sin UI)* | — | — | — | — | ✅ | ❌ *(columna sin UI)* | ❌ *(columna sin UI)* | — | — | — | ❌ |
| **Generación** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 🟡 | ❌ | ❌ | 🟡 *(solo gestión)* | ✅ | 🟡 |
| **Organización** | ✅ | 🟡 | ❌ | ✅ | ❌ | 🟡 | ✅ *(lo mejor hecho)* | ❌ | — | — | ❌ | 🟡 |
| **Participantes** | 🟡 | ✅ | ❌ | ❌ | 🟡 | 🟡 | ❌ | ❌ | — | ❌ *(cableado en RLS)* | 🟡 | 🟡 |

Tres lecturas de la matriz:

- **La columna de fechas de apertura está casi vacía.** `generaciones` es la **única** entidad con
  fecha de apertura real. Todo lo demás se abre con un clic manual tuyo en el momento exacto.
- **`generaciones`, `examenes` y `tareas` son los modelos a copiar.** Tienen borrador de verdad
  (`activo`) separado del cierre, con aviso al admin de que está oculto. Módulo y recurso usan **un
  solo booleano para oculto y para cerrado**, que es lo que impide dejar algo *visible pero cerrado*
  —lo normal en un curso.
- **`plantillas_documento` es la pieza mejor construida del sistema** (membrete, firma, posición,
  validación de bloques sin cerrar, vista previa saneada)… y **la constancia que descarga el alumno
  no la usa**: [Constancia.jsx:31-106](../src/components/Constancia.jsx#L31-L106) tiene el HTML
  cableado, con nombre de quien firma, cédula y teléfono **literales en el código**.

### 4.2 Los huecos, por impacto

| # | Sev. | Qué falta | Dónde debería ir | Esf. |
|---|---|---|---|---|
| 1 | bloq. | **Un módulo no se puede editar después de crearlo.** Los únicos `update` sobre `modulos` tocan `disponible` y `botones_extra`. Título, descripción, orden y ruta solo se escriben al crear o duplicar | `ModalEditarModulo` nuevo, con lápiz en `CursoView` y botón en `ModuloView` | M |
| 2 | bloq. | `modulos.oculto` **no existe** y se escribe en dos `insert` ([AdminModales.jsx:76](../src/components/AdminModales.jsx#L76), [RecursosModulo.jsx:344](../src/components/RecursosModulo.jsx#L344)) y se lee en tres. Crear y duplicar módulo deberían estar fallando con `PGRST204` | Crear la columna con su interruptor propio, separada de `disponible` | XS–S |
| 3 | alta | La constancia del alumno ignora `plantillas_documento` | `Constancia.jsx` debe leer la plantilla activa y pasarla por `rellenar()` de `lib/plantillas.js:94`, como ya hace `GenerarDocumento.jsx:246` | M |
| 4 | alta | **Seis sistemas de botón** (§4.3) | Una tabla `botones` y un `ModalBotones` | L |
| 5 | alta | La casilla «Activo» de los botones de ruta **existe en el editor y se ignora al pintar** | `CursoView.jsx:439` → `.filter(b => b.activo !== false)` | XS |
| 6 | alta | Ninguna entidad salvo `generaciones` tiene fecha de apertura; `cursos.fecha_inicio`/`fecha_fin` existen y están muertas | Sembrarlas en `AdminCursos`; añadir `abre_el` a módulo, recurso, examen y tarea | M |
| 7 | alta | «Notificar al publicar» solo existe en dos sitios, se **salta en cursos gratuitos** y empareja por título | Un `<CasillaNotificar>` junto a cada interruptor, siempre sobre `notificarInscritos()` | M |
| 8 | alta | Las plantillas de los correos automáticos viven en `apps-script/Notificador.gs:233-268`, **fuera del panel**, y la vista previa las replica a mano → dos verdades que se desincronizan | Filas de `plantillas_documento` con `tipo='correo'` | M–L |
| 9 | media | Foro: la fecha límite **solo aparece si marcas «califica»**, y abrir un tema nuevo **hereda la fecha del último editado** | Sacar `CamposPlazo` fuera del `{califica && …}`; añadir los dos `setState` que faltan | XS |
| 10 | media | `cursos.constancia` (¿emite constancia este curso de pago?) no tiene casilla en ningún formulario | `AdminCursos.jsx:275-291` | XS |
| 11 | media | `categorias.activa`, `orden` y `motivo` existen y no se pueden editar; `activa` ni siquiera se filtra; y la categoría nueva **no recibe `organizacion_id`** | Tres campos más en la fila de edición | S |
| 12 | media | **Visibilidad de participantes entre sí: no hay interruptor.** Está cableada en la política `perfil_select`. [Participantes.jsx:270-277](../src/components/Participantes.jsx#L270-L277) ya calcula «cursos en común», o sea se diseñó como directorio y el RLS no lo permite | `cursos.directorio_visible` + política que la consulte | M–L |
| 13 | media | **No hay prerrequisitos en ninguna entidad** | `modulos.requiere_modulo_id` | L |
| 14 | media | Reordenar es teclear un número; **cero `draggable` en todo `src/`**. Módulo y tarea no se pueden reordenar en absoluto | Arrastrar en las listas; columna `tareas.orden` | M |
| 15 | media | Los comunicados **no se guardan ni se programan**: todo vive en estado de React. Sin historial, sin borrador, sin envío a futuro | Tabla `comunicados` + `programado_para` | L |
| 16 | baja | El límite de **2 descargas** de constancia está cableado en tres sitios y en SQL | `cursos.max_descargas_constancia` | S |
| 17 | baja | No hay **archivar/restaurar** en módulo, recurso, foro, generación ni categoría: solo borrado duro. No hay **duplicar** en examen, tarea, foro ni generación | `archivado_en` + botón, copiando el patrón de `AdminCursos` | M |
| 18 | baja | `recursos.contenido` existe y ningún campo del modal lo edita | Tipo `html` en el `<select>` + `<textarea>` | S |

### 4.3 Los botones: seis sistemas, cuatro almacenamientos

| # | Sistema | Editor | Dónde se guarda | Quién lo pinta |
|---|---|---|---|---|
| A | Botones de **ruta** | `ModalEditarBotonesRuta` ([AdminModales.jsx:12](../src/components/AdminModales.jsx#L12)) | `cursos.rutas_botones` jsonb, **mapa** `grupo → []` | `CursoView.jsx:437` |
| B | Botones de **módulo** | `ModalEditarBotonesModulo` ([AdminModales.jsx:126](../src/components/AdminModales.jsx#L126)) | `modulos.botones_extra` jsonb, **array** | `ModuloView.jsx:263` |
| C | Botones de **taller** | dentro de `ModalEditarTaller` ([TallerRecursos.jsx:158](../src/components/TallerRecursos.jsx#L158)) | `curso_material.botones_extra`, **solo por RPC** | `TallerRecursos.jsx:475` **y** `CursoCard.jsx:229` |
| D | **Entregables** | `Entregables` ([RecursosModulo.jsx:772](../src/components/RecursosModulo.jsx#L772)) | fila con `tipo:'entregables'` dentro de B | `ModuloView.jsx:311` |
| E | **Botones fijos** (`*_activo`) | `ModalEditarTaller` | tripletas `link_X`+`X_texto`+`X_activo` en dos tablas | tres bloques a mano, **duplicados** en `CursoCard` |
| F | **Cableados** | ninguno | ninguno | diapositivas; «juego de la sesión 4» **activado por una expresión regular sobre el título**; CTAs de WhatsApp |

Lo único compartido es la UI del editor de campos (`EditorBotonesExtra`, `ui.jsx:190`). El
almacenamiento, el guardado, el criterio de visibilidad y el pintado son distintos en cada uno.

**Qué puede hacer cada uno:**

| Capacidad | A ruta | B módulo | C taller | D entregables | E fijos |
|---|---|---|---|---|---|
| texto y URL | ✅ | ✅ | ✅ | ✅ | ✅ |
| estilo/color | ✅ | ✅ | ✅ | ❌ | ❌ |
| casilla «Activo» | **se ignora al pintar** | ✅ | ✅ | ✅ | ✅ |
| candado en la propia página | ❌ | ❌ | ✅ | ✅ | ✅ |
| incrustar («Ver aquí») | ❌ | ❌ | ✅ | ❌ | ✅ |
| título y descripción | ❌ | ❌ | ❌ | ✅ | fijos |
| papelera (reversible) | ❌ | solo entregables | ❌ | ✅ | — |
| orden / fechas | ❌ | ❌ | ❌ | ❌ | ❌ |
| protegido de lectura anónima | ❌ | ❌ | ✅ | ❌ | mixto |

**El que más control da es C** (candado sin abrir modal, incrustado, lectura protegida por RPC).
**D** es el único con título, descripción y papelera. **A es el más pobre y además tiene la casilla
rota.** Ninguno tiene fechas ni orden.

**Propuesta: una tabla, un editor, un renderizador.**

```sql
botones
  id, ambito ('curso'|'ruta'|'modulo'|'recurso'), ambito_id,
  grupo,            -- solo ambito='ruta'; sustituye el mapa de rutas_botones
  clave,            -- 'registro'|'grabacion'|'materiales'|'entregables'|null
  titulo, descripcion, texto, url, estilo, icono,
  visible,          -- el candado, uno solo para todos
  abre_en,          -- 'pestana' | 'incrustado'
  abre_el, cierra_el,   -- lo que hoy no tiene ninguno
  sensible,         -- true => solo por RPC, como curso_material
  orden, eliminado_en   -- la papelera de D, para todos
```

Se fusionan A + B + C en un `ModalBotones({ambito, ambitoId, grupo})`; D pasa a ser una fila con
`clave='entregables'` (y **desaparece del código la URL de OneDrive personal** que hoy está literal
en [AdminModales.jsx:131](../src/components/AdminModales.jsx#L131)); los cuatro botones fijos de E
se siembran como filas con `clave`; los cableados de F se vuelven filas que puedes apagar **sin
tocar código** —incluida la expresión regular sobre el título del módulo—. Un `<BotonConfigurable>`
único sustituye cinco pintados distintos, respeta siempre `visible` y ofrece el candado si gestionas.

Se retiran: los dos modales de `AdminModales.jsx`, el componente `Entregables`, los tres bloques
fijos de `TallerRecursos.jsx` y **sus gemelos literales en `CursoCard.jsx`**. Se conserva la
protección por RPC de `curso_material`: es lo único de C que no hay que rehacer, solo generalizar.

---

## 5. Eje C — Recorrido del alumno

### 5.1 El hueco que más alumnos pierde

El autoinscrito de taller gratuito es ciudadano de segunda en **seis pantallas**, y todas por la
misma causa raíz: no tiene fila en `acceso`.

| | Taller gratuito | Curso de pago |
|---|---|---|
| Aparece en la portada | **No**, si no tiene `linea` ([Home.jsx:47](../src/components/Home.jsx#L47)) | Sí |
| Fila en `acceso` | Solo si entró por `?redirigir=/curso/N` | Siempre |
| «Mis cursos» del header | Vacío | Sí |
| Mis calificaciones | **«Todavía no estás inscrito en ningún curso»** aunque tenga constancia con folio | Completo |
| Calendario | Vacío | Con fechas |
| Barra de avance | **Ocultada a propósito** ([CursoView.jsx:399](../src/components/CursoView.jsx#L399)) | Sí |
| Foro | Botón visible, pero la RLS solo mira `acceso` → ve «Todavía no hay temas» | Funciona |
| Examen | Visible, pero **no condiciona nada** y nadie se lo dice | Pondera |

El detalle más caro: [TallerRecursos.jsx:362](../src/components/TallerRecursos.jsx#L362) le promete
«tu constancia **y el foro con el docente**» para que cree la cuenta, y al entrar al foro la RLS le
devuelve cero hilos, que la pantalla presenta como «el docente no ha escrito nada». Es un vacío de
permiso disfrazado de vacío de contenido.

**Garantizar esa fila en `acceso` y añadir una ruta `/mis-cursos` arregla las seis.**

### 5.2 El resto del recorrido

| Paso | Sev. | Qué pasa | Esf. |
|---|---|---|---|
| Rutas | alta | **No hay ruta comodín**: un enlace con una errata pinta el header y un `<main>` vacío, sin decir que no existe | XS |
| Sesión | alta | A los 30 días se cierra la sesión con el mensaje «**Tu acceso expiró. Escríbeme para renovarlo**» ([App.jsx:48](../src/App.jsx#L48)). El alumno de un curso de 6 meses cree que perdió **la inscripción**. Carga de soporte pura | XS |
| Inicio | bloq. | El taller gratuito **no aparece en el catálogo**; si perdió el enlace de WhatsApp no hay forma de volver | S |
| Registro | bloq. | La inscripción depende de un parámetro de URL; quien llega por `/registro` limpio queda con cuenta y cero cursos | M |
| Registro | media | El correo se pide 2 veces, la contraseña 2 veces y el nombre 3 veces a lo largo del recorrido (registro, perfil, constancia) | S |
| Lista | alta | **No existe pantalla «Mis cursos»**; el punto de partida diario está escondido tras la foto de perfil y se carga solo al abrirlo | M |
| Curso | alta | Un taller gratuito **con** `linea` pierde toda su pantalla: cae al bloque de módulos y muestra «aún no tiene módulos publicados», sin grabación ni materiales ni constancia. Dos talleres casi iguales se comportan al revés | S |
| Curso | media | Desde el curso **no hay camino** a las calificaciones ni a la constancia | XS |
| Módulo | media | El botón de constancia aparece **a media carrera**: se muestra cuando no hay módulo siguiente, y los módulos cerrados no cuentan | XS |
| Módulo | media | El aviso al gestor **muestra SQL en pantalla**: `update modulos set disponible = true where id = N;` | XS |
| Examen | bloq. | El bug de §3.1 | XS |
| Tarea | media | Si la consulta falla, la sección de tareas **desaparece entera** sin mensaje: el alumno nunca sabe que había una entrega | XS |
| Calificaciones | bloq. | Al autoinscrito le dice que no está inscrito en nada aunque tenga constancia emitida | M |
| Calificaciones | media | **La asistencia no se le muestra nunca al alumno** ni pondera, aunque las tablas existen y el pase de lista funciona | M |
| Constancia | alta | **Imprimir es generar**: se consume una de las dos descargas *antes* de abrir el diálogo de impresión. Si cancela o el móvil falla, la perdió | S |
| Constancia | alta | «Descargar mi constancia» se pinta **sin consultar** `estado_constancia`, a diferencia de las otras dos pantallas que sí lo hacen | S |
| Verificación | baja | «No se pudo verificar» no distingue **folio falso** de **servicio caído**. Para un empleador son conclusiones opuestas | XS |

---

## 6. Eje D — Estética y coherencia visual

**Veredicto: no hay sistema de diseño. Hay una paleta de marca bien elegida y 22 tokens, sobre los
que cada pantalla improvisó su propio ritmo.**

| Métrica | Valor |
|---|---|
| Tokens definidos | 22 (14 de color, 2 de fuente, 1 sombra, 1 radio) |
| Tokens de **espaciado** o escala tipográfica | **0** |
| Hex literales fuera de `:root` (CSS + JSX) | **277** — 40 de ellos el propio azul y acento de marca |
| `style={{ }}` en JSX | 270 (61 solo en `Admin.jsx`) |
| Valores distintos de `padding` | **121** |
| Tamaños de letra distintos | **30+** (incluye 13.8px, 15.5px, 10.5px) |
| `border-radius` usando el token | **26 de 222** (12 %) |
| `prefers-color-scheme` / `data-theme` | **0 / 0** |

**Modo oscuro: no está «pendiente», está estructuralmente imposible hoy.** De los ~90 tokens de
color que haría falta redefinir solo existen 14. El orden correcto es completar los tokens
semánticos primero y añadir un único bloque después; improvisarlo por pantalla saldría peor.

**Densidad: el panel y el alumno son dos lenguajes visuales.** El alumno ve 16-19px con aire de
20-24px; el panel, 10.5-12.5px con aire de 2-10px. Dicho de otro modo: **al administrador —que eres
tú, el usuario de más edad del sistema— le toca la tipografía más pequeña del producto, con el gris
de peor contraste encima.**

**Botones:** 9 variantes de `.button` más ~20 clases de botón completamente paralelas que no pasan
por el sistema (`.editor-btn`, `.side-btn`, `.red-btn`, `.nav-flotante-btn`…). Hay solape claro:
`.azul` es `.primary` al revés — dos azules sólidos sin diferencia de jerarquía.

**Lo que sí está bien y conviene no romper:** el responsive es mejor de lo que el resto sugiere —32
media queries con cortes coherentes y **las cuatro tablas tienen envoltorio de scroll**—. El punto
flojo es que las 5 acciones por fila van en una celda `nowrap` alineada a la derecha, así que en
teléfono quedan fuera de pantalla.

---

## 7. Eje E — Accesibilidad (WCAG 2.2 AA)

Los contrastes están **calculados** sobre los hex reales del archivo, no estimados.

| # | Sev. | Qué pasa | Esf. |
|---|---|---|---|
| 1 | bloq. | **Los 32 modales no son diálogos**: `ModalPortal` es un portal desnudo, sin `role="dialog"`, sin `aria-modal`, sin trampa de foco y **sin cierre con Escape** (cero coincidencias de `Escape` en todo `src/`). Quien usa teclado abre «Eliminar cuenta», tabula y el foco se va al fondo; con lector de pantalla el modal no se anuncia | M |
| 2 | bloq. | `.button.whatsapp`: blanco sobre `#25D366` = **1.98:1** (mínimo 4.5:1). Es el CTA comercial principal, en 10 sitios | XS |
| 3 | bloq. | **166 `<label>` huérfanos** sin `htmlFor` y **0 `aria-label`** en 264 controles. Casi todo formulario del panel se escucha como «cuadro de edición, en blanco» | L |
| 4 | bloq. | `--gris`/`--muted` se usan como color de texto en **90 reglas** y dan **3.49:1**. Afecta correos y fechas del padrón, pestañas del panel, notas al pie y los 98 `.button.texto` | **XS** (un token) |
| 5 | alta | **146 avisos de error y éxito y solo uno** tiene región viva. Se guarda, falla, aparece un recuadro rojo y el lector no dice nada | M |
| 6 | alta | El editor de comunicados: sin `role="textbox"`, sin nombre accesible, placeholder en CSS (no se lee), **anula a mano el foco visible** y lo sustituye por un halo de 1.13:1, barra sin `role="toolbar"` y **tres botones que se llaman «A»**. Con teclado se puede enfocar el área pero la barra no aplica nada porque se pierde la selección | M |
| 7 | alta | Los botones 🔑 📱 🗑 de la tabla de usuarios **no tienen `aria-label`**: un lector recorre 40 filas y escucha «papelera botón» cuarenta veces, sin saber de quién. **El de la papelera borra la cuenta definitivamente** | S |
| 8 | alta | `--accent` como texto da **3.38:1** en 58 reglas: «Saber más», los enlaces del correo, la etiqueta «Facilita». El color de marca es justo el que marca lo accionable y es el que menos se ve | S |
| 9 | alta | **11 reglas anulan el foco visible** con `outline: none`; el sustituto calcula 1.13:1, o sea no se percibe. El contorno de 3px que el equipo diseñó nunca se pinta | S |
| 10 | media | No hay enlace para saltar al contenido y `<main>` existe en **7 de 50** componentes; 14 tienen `<h1>` | S |
| 11 | media | El logo es un `div` con `role="button"` que **solo responde a Enter, no a Espacio** | XS |
| 12 | media | El menú de cuenta declara `role="menu"` **sin la navegación por flechas que ese patrón exige**: queda más inaccesible con el `role` que sin él | S |
| 13 | baja | `--borde` da **1.33:1**: los campos de texto no se distinguen del fondo hasta que se enfocan | XS |

**Los tres arreglos que más gente desbloquean:** (1) dar a `ModalPortal` el contrato de diálogo
—un componente arregla 32 modales—; (2) **subir dos tokens de color**, que corrige 148 reglas con
tres líneas de CSS; (3) dar nombre a los controles destructivos y poner región viva en los avisos.

**Lo que ya está bien y un refactor podría borrar sin querer:** `prefers-reduced-motion` neutraliza
toda animación; **27 de 27 `<img>` tienen `alt`** (12 decorativos correctos); **34 de 34**
`target="_blank"` llevan `rel="noopener noreferrer"`; `aria-current="page"` en pestañas y migas;
cero enlaces que digan «aquí» o «ver más»; y `BarreraErrores` evita la pantalla en blanco.
Conviene fijarlo con reglas de lint antes de hacer los barridos.

---

## 8. Eje F — Seguridad

Es el eje con los hallazgos más serios del informe. **La buena noticia primero:** el modelo de
seguridad está bien diseñado —`es_admin()`, `es_admin_de(org)` y `puede_gestionar_curso()` son
correctos, **no hay ni una sola tabla sin RLS** (hay incluso un disparador de evento que la activa
sola en cada tabla nueva), la tabla `admins` no tiene política de escritura así que **nadie se puede
nombrar administrador desde la API**, y las constancias no se pueden falsificar en base. El problema
no es el modelo: es un puñado de funciones que no lo usa.

### 8.1 Bloqueantes

| # | Qué pasa | Quién puede abusar y qué consigue | Esf. |
|---|---|---|---|
| **B1** | El relay de correo de Apps Script **no comprueba nada**: ni token, ni origen. La URL del `/exec` está en el bundle público ([config.js:26](../src/config.js#L26)), el cuerpo HTML se usa tal cual y la lista de destinatarios viene en la petición | **Cualquiera en internet, sin cuenta.** Copia la URL del JS y envía el HTML que quiera a los destinatarios que quiera **desde tu Gmail**, con la plantilla de marca del LMS. Phishing creíble contra tu padrón a tu nombre, más agotamiento de la cuota diaria que deja sin avisos a los envíos legítimos. El saneado del navegador no protege aquí: se salta entero | M |
| **B2** | `crear-usuarios` comprueba «al menos una fila en `admins`, del tipo que sea», sin mirar `organizacion_id`; y si la cuenta ya existe le **reescribe la contraseña** ([index.ts:233](../supabase/functions/crear-usuarios/index.ts#L233)) | **Un admin de organización cliente.** Pide el alta de *tu* correo con una contraseña que él elige; la cuenta existe, así que la función se la cambia y confirma. Toma del panel completo. La rama de recuperación sí protege cuentas admin; esta no | S |
| **B3** | `bulk_grant_course_access` y `bulk_remove_course_access` ([ESQUEMA_SEGURIDAD.sql:98](../supabase/ESQUEMA_SEGURIDAD.sql#L98) y `:110`) son `SECURITY DEFINER`, **sin una sola comprobación de permiso**, sin `search_path` y **sin `revoke`** → conservan `EXECUTE` para PUBLIC. *Verificado a mano al integrar* | **Cualquier alumno con cuenta**, incluido un autoinscrito de taller gratuito. Desde la consola del navegador se inscribe en cualquier curso de pago de cualquier organización. La variante `remove` es destructiva: deja sin acceso a una clase entera. **Esta es la escalada real al contenido de pago** | **XS** |
| **B4** | `eliminar_usuario` ([WHATSAPP_Y_BAJAS.sql:222](../supabase/WHATSAPP_Y_BAJAS.sql#L222)) comprueba `admins` sin filtrar por organización | **Un admin de organización cliente** borra definitivamente a cualquier alumno de cualquier otra. Sus tres frenos (constancia emitida, es admin, es tu cuenta) no incluyen «no es de tu organización». La bitácora lo registra pero no lo impide | XS |
| **B5** | Dos políticas permisivas se suman y dejan leer `examenes` entera a cualquier autenticado; `examenes.preguntas` guarda las opciones **con su marca `correcta`**, y [ExamenModulo.jsx:39](../src/components/ExamenModulo.jsx#L39) pide `select('*')`. *Verificado a mano al integrar* | **Cualquier alumno** lee las respuestas correctas de cualquier examen activo antes de contestarlo. Toda la maquinaria de `servir_examen` —que está bien hecha y sirve las preguntas limpias— queda inútil, porque el dato viaja por el otro lado | S |

### 8.2 Altas

| # | Qué pasa | Esf. |
|---|---|---|
| **A1** | **El aislamiento entre organizaciones está roto en tres funciones**: `listar_usuarios_con_accesos`, `listar_whatsapp` y `listar_inscritos_gratuitos` devuelven filas de **toda la plataforma**. Un responsable de cliente abre su panel y ve el padrón entero del resto: nombres, correos, profesión, teléfono y **las notas privadas que escribiste sobre cada alumno**. Es a la vez fuga de datos personales y la lista de objetivos para B4. *(En cambio `tablero_organizacion` sí comprueba bien)* | M |
| **A2** | El panel genera enlaces de recuperación y **se los devuelve al navegador**; el único filtro es que el objetivo no sea administrador. Un admin de cliente mina el enlace de un alumno de otra organización y entra como él | S |
| **A3** | `crear-usuarios` inscribe en los `curso_ids` que vengan en la petición **con el service role**, que salta el RLS, sin comprobar que sean de su organización | S |
| **A4** | **Constancia verificable autoemitida.** Para un taller gratuito con constancia habilitada basta tener sesión y un nombre en el perfil: no se exige fila en `acceso`. Cualquiera se registra, se pone el nombre que quiera y obtiene una constancia con folio real que `/verificar` confirmará como auténtica, sin haber asistido | S |
| **A5** | `whatsapp-enviar` acepta números y texto libres sobre tu número verificado y tu token, sin límite de llamadas y sin registro en la bitácora | M |
| **A6** | **Seis funciones `SECURITY DEFINER` sin `search_path` fijo**: `alumnos_de_curso`, las dos `bulk_*`, `get_admin_id`, `obtener_usuario_por_email` y la versión vieja de `listar_usuarios_con_accesos`. Riesgo de segundo orden, pero es el escalón que convierte un acceso limitado en control total | **XS** |
| **A7** | **Comprobación de 30 segundos:** `vista_admin_inscripciones` no está definida en ningún script (§3.3). En Postgres una vista corre con los privilegios de su **propietario** y **no aplica el RLS de las tablas de debajo** salvo que se cree con `security_invoker = true`. El comentario de [correo.js:29](../src/lib/correo.js#L29) afirma que «ya respeta RLS» y eso es casi seguro falso. Si no es `security_invoker`, **cualquier autenticado puede pedir el padrón completo de inscripciones** y esto sube a bloqueante | S |
| **A8** | Los folios de constancia son enumerables: prefijo público + año conocido + 6 hex. `verificar_constancia` está abierta a `anon`, sin límite de ritmo, y devuelve nombre completo **y profesión**. El endpoint para que un empleador compruebe un folio sirve para cosechar el padrón | S |

### 8.3 Medias y bajas

| # | Qué pasa | Esf. |
|---|---|---|
| **M1** | `modulos_lectura_publica` (`using (activo = true)` a `public`) **anula por OR** la política que protege los módulos de pago. Un visitante sin cuenta lista títulos y descripciones de todos los cursos de todas las organizaciones. *(El contenido en sí ya está a salvo)* | XS |
| **M2** | `perfiles.notas_admin` está al alcance del propio alumno: **puede leer y borrar las notas privadas que escribiste sobre él**. Es justo el problema que `WHATSAPP_Y_BAJAS.sql` razona bien para el teléfono y resuelve con tabla aparte; `notas_admin` se quedó en `perfiles` | S |
| **M3** | `obtener_usuario_por_email` (oráculo correo → uuid), `get_admin_id` y `alumnos_de_curso` tampoco comprueban organización ni tienen `revoke` | S |
| **M4** | **`RLS_EXAMENES.sql` es un script-regresión.** No está en `ESTADO.sql`, pero sigue en el repo anunciándose como seguro, y si alguien lo corre: redefine `es_admin()` **sin** el filtro de organización —todo admin de cliente pasa a admin de plataforma— y reabre `intentos_insert_own`, con lo que el alumno podría insertar su intento **con la calificación que escriba** | XS |
| **M5** | Ninguna edge function tiene límite de llamadas ni registro en bitácora; la contraseña mínima son 6 caracteres y las cuentas nacen confirmadas | M |
| **M6** | `organizaciones_select` es `using (true)` a `anon`: expone **la lista de clientes con su plan, estado de suscripción y topes** a cualquier visitante. `sedes` igual. *(En `categorias`, `planes` y `config_registro` el `using (true)` sí está razonado)* | S |
| **Ba1** | **`.env` está en el índice de git** — confirmado. Lo que contiene hoy son solo la URL y la clave *publishable*, que es pública por diseño y viaja en el bundle igualmente, **así que no hay un secreto comprometido**. El riesgo es el patrón: el próximo secreto que entre a ese archivo se publicará solo | XS |
| **Ba4** | CORS abierto en las dos edge functions. **No es el problema que parece**: ninguna usa `Allow-Credentials` y autentican por cabecera `Bearer`, no por cookie. Queda como endurecimiento | XS |

### 8.4 Sobre el saneador de HTML

Se revisó punto por punto y **las cinco superficies que preocupaban están cubiertas**: lista blanca
de atributos (así que `onerror`/`onload` no pasan), esquemas de URL restringidos a `https?`,
`mailto` y `tel` con `data:` bloqueado, `<style>`/`<iframe>`/`srcdoc` fuera de la lista de etiquetas,
lista blanca de 25 propiedades de estilo con filtro de `url()` y `expression()`, y el orden correcto
(rellenar y *después* sanear). Es más estricto de lo habitual.

Quedan dos reservas honestas: el patrón «parsear → serializar → volver a parsear» es la superficie
clásica de mXSS, una clase de fallo que DOMPurify lleva una década parcheando y que un saneador
propio hereda sin esos parches; y **el saneado es del lado del cliente, así que B1 lo deja
irrelevante para el correo** — quien llama al relay directamente manda el HTML que quiera.

### 8.5 Orden sugerido para seguridad

1. **Hoy, casi todos XS:** B3 (añadir la comprobación a las dos `bulk_*` y ponerles `revoke`), B4
   (una línea), A6 (cinco `alter function`), M1 (borrar una política), M4 (retirar
   `RLS_EXAMENES.sql`). **Cinco cambios pequeños que cierran dos bloqueantes.**
2. **Antes que nada, 30 segundos:** A7 — `select pg_get_viewdef('vista_admin_inscripciones')` y sus
   `reloptions`. Si esa vista no es `security_invoker`, pasa a ser lo primero de toda la lista.
3. **Esta semana:** B1 y B2, las dos tomas de control completas.
4. **Después:** B5 y A1, los dos que piden tocar componentes y firmas de funciones.

---

## 9. Comparativa con Moodle

| # | Punto | Estado | ¿Vale cerrarlo? |
|---|---|---|---|
| 1 | **Cursos** | ✅ cubierto | No hay nada que cerrar. Moodle exige elegir formato, rol y método de matriculación antes de poder subir un PDF; aquí se crea y se publica. **No copiar esa complejidad** |
| 2 | **Secciones / temas** | 🟡 parcial | Cerrar solo lo barato: resolver `modulos.oculto` y mover los nombres de ruta a datos. La restricción de acceso condicional de Moodle **no** merece copiarse |
| 3 | **Actividades y recursos** | ✅ cubierto | De sobra. Lo que falta (wiki, glosario, SCORM, taller de coevaluación) son justo las actividades que casi nadie usa |
| 4 | **Libro de calificaciones** | ✅ cubierto, **y por encima** | Único hueco: **la asistencia no pondera** aunque el dato ya se captura. Las categorías anidadas y fórmulas libres de Moodle son donde su libro se vuelve inusable; la simplicidad aquí es ventaja comercial |
| 5 | **Grupos** | 🟡 parcial | `acceso.grupo` es texto libre sin catálogo: **un dedazo esconde módulos en silencio**. Cerrar solo eso |
| 6 | **Cohortes** | ✅ cubierto | Mejor enfocado que Moodle (sus cohortes son globales y no saben de fechas, sede ni modalidad). No tocar |
| 7 | **Roles granulares** | **⚠️ verificar primero** | El sistema está escrito y **probablemente no instalado** (§0). Si lo está, es más granular que lo que usa cualquier Moodle real. **Primero comprobar, no construir** |
| 8 | **Badges / insignias** | ❌ falta | **No cerrarlo.** Ya tienes la credencial que importa y que Moodle hace peor: constancia firmada con folio y verificación pública. Añadir insignias decorativas **devalúa** la constancia |
| 9 | **Backup y restauración** | 🟡 parcial | Hay `duplicar_curso`, exportación a CSV y bitácora con la fila completa. Falta importar. Cerrar solo la **definición** del curso en JSON (permite vender plantillas y migrar entre inquilinos); olvidarse de restaurar datos de alumnos, que es lo que hace frágil el `.mbz` |
| 10 | **Móvil** | 🟡 parcial | Responsive de verdad, pero **no instalable**: sin `manifest.json` ni service worker. Cerrar la mitad barata (manifest + iconos) es casi todo lo que la gente percibe como «la app». **No** hacer app nativa: la de Moodle existe porque su web es inusable en teléfono, y esta no lo es |

**Por encima de Moodle** en honestidad hacia el alumno: le enseñas lo pendiente en ámbar con el
enlace para ir a hacerlo, distingues «no participé» de «participé y falta nota», la rúbrica se ve
antes de entregar, los errores de acceso dicen la causa real, y la constancia se verifica en público
sin sesión.

**Por debajo** en que el alumno no tiene un «mi aula»: no hay `/mis-cursos`, no hay 404, la
asistencia capturada nunca se le devuelve, y no hay forma de mover la definición de un curso entre
instancias.

---

## 10. Lo que ya está bien (y conviene no romper al refactorizar)

- **El saneado de HTML está centralizado y no se salta ni una vez**: todos los
  `dangerouslySetInnerHTML` del proyecto pasan por él. Es el mejor ejemplo del repositorio.
- **Los exámenes se sirven sin respuestas** y la nota la pone la base, no el navegador.
- **El material sensible va por RPC**, no en el objeto `cursos`: un visitante sin permiso recibe
  `null` y el enlace no se pinta. Diseño correcto de «cerrado por defecto».
- **`lib/calificacion.js` es la única fuente del cálculo**, compartida a propósito entre la vista
  del alumno y la rejilla del facilitador.
- **`plantillas_documento`** valida bloques sin cerrar, avisa de marcadores inexistentes y tiene
  vista previa saneada.
- **La bitácora guarda la fila completa** antes de cada borrado, con 20 disparadores.
- **Los comentarios del código explican el *porqué*, no el *qué*** —incluidas las decisiones
  equivocadas y su coste—. Es lo que ha hecho posible este diagnóstico, y vale más que varias de
  las funciones que faltan.

---

## 11. Método, alcance y limitaciones

**Método.** Cinco pasadas independientes y en paralelo (arquitectura y duplicidad; control y
granularidad; recorrido del alumno y comparativa Moodle; estética y accesibilidad; seguridad), cada
una leyendo el código directamente, más una integración posterior que contrastó los hallazgos entre
sí y verificó a mano los de mayor severidad.

**Qué se verificó de primera mano al integrar** (no solo se tomó de las pasadas): el bug de
`ExamenModulo.jsx:235` y que ESLint ya lo detecta; que `npm run lint` devuelve exactamente 2 errores;
que `modulos` no tiene columna `oculto` y que `check-columnas.mjs` no puede detectarlo porque su
expresión regular solo mira `.select(…)`; que la casilla «Activo» de los botones de ruta existe en
el editor y se ignora al pintar, mientras la de módulo sí se respeta; que `AdminCursos.jsx:120`
compara contra un valor que nunca se asigna; que los cuatro refrescos de `filas` pierden el filtro de
organización; y el cruce de fechas de git contra el volcado del esquema que permite afirmar que
`ROLES_5_PERMISOS.sql` probablemente nunca se corrió.

**Limitaciones, dichas con claridad:**

1. **No se ejecutó nada contra la base de datos.** Desde el repositorio solo hay clave pública. Todo
   lo que dependa del estado real de Postgres está marcado como «verificar» y la sección 0 dice cómo.
2. **No se abrió la aplicación en un navegador.** Las afirmaciones sobre densidad visual y responsive
   salen de leer el CSS. Antes de rediseñar las tablas del panel conviene una captura a 390px.
3. **No se leyó el código de las dos edge functions con el mismo detalle** en los ejes de
   arquitectura y control; el eje de seguridad sí las cubre.
4. **Esto es un diagnóstico, no un plan.** No se tocó ningún archivo. El orden sugerido de la
   sección 2 es una propuesta, no una secuencia obligatoria.
