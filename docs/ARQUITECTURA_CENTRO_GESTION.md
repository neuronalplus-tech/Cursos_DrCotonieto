# Centro de gestión y estructura única del sitio

*15 de octubre de 2026 · rama `editor-en-pagina`*

Qué se encontró al auditar cómo se edita y se presenta el contenido, qué
principios se fijaron, qué quedó construido y qué falta. El plano en código
es **`src/lib/estructura.js`**: si este documento y ese archivo discrepan,
manda el archivo.

---

## 1. Auditoría: lo que había

| Hallazgo | Evidencia | Consecuencia |
|---|---|---|
| **La gestión estaba repartida.** Exámenes, tareas, avance, participantes y generaciones se abrían desde dentro de cada curso; el foro y el banco, desde pestañas sueltas del panel; los botones de ruta y de módulo, desde cada página. | 13 pestañas en `Admin.jsx` + 6 botones de gestión en `CursoView.jsx` + 5 en `ModuloView.jsx` | Para cambiar un botón había que recordar en qué pantalla vivía. |
| **Los perfiles existían, pero no se veían.** Dirección, Coordinación y Docente ya están en la base (`ROLES_5`, con sus permisos), pero no había dónde ver ni cambiar qué edita cada uno. | `sembrar_roles_basicos`, pestaña «Roles» con casillas por permiso técnico | No se podía comprobar «¿Coordinación puede tocar el foro?» sin leer SQL. |
| **El material se clasificaba por formato, no por uso.** `recursos.tipo` = pdf, video, word, enlace, autoevaluación; salían en el orden de carga. | `ICONO_TIPO`/`NOMBRE_TIPO` en `config.js` | El alumno busca «la lectura» o «la grabación», no «el PDF». |
| **Sin un aspecto fijo por formato.** El color de los botones extra lo elegía cada quien (`estilo`), y el de los recursos era el mismo para todos. | `b.estilo \|\| 'azul'` en 3 componentes | Un PDF no se reconocía de un vistazo. |
| **Muchas formas de decir «no disponible».** | «Próximamente» ×14, «Bloqueado» ×34, «Privado» ×10, «cerrado» ×46, «aún no tiene / Todavía no hay» ×33 | El alumno veía avisos distintos para lo mismo, y huecos vacíos con texto de relleno. |
| **Bloques anclados por título de curso.** Diapositivas para presentar caso, Entregables, juego de la sesión 4, página de detalles del duelo. | `cursoEspecial`, `esCursoProblemasContemporaneos`, `DETALLES_DUELO`, regex sobre `modulo.titulo` | No se pueden reutilizar en otro curso ni editar desde el panel. |
| **El foro siempre visible** para quien tenía acceso, tuviera temas o no. | `CursoView.jsx` | Un botón que llevaba a una página vacía. |
| **Botones de taller sin eliminar.** Registro y grabación solo tenían candado; vacíos, ocupaban sitio con «Registro aún no disponible». | `CursoCard.jsx`, `TallerRecursos.jsx` | **Ya corregido y publicado** (papelera junto al candado). |

## 2. Principios

1. **Un solo plano.** Perfiles, permisos por elemento, categorías, formatos,
   secciones de cada página y estados viven en `estructura.js`. Las páginas,
   el Centro y la matriz lo leen; nadie decide por su cuenta.
2. **Un sitio para gestionar, el mismo editor.** El Centro reúne todo lo de un
   curso, pero reutiliza los editores que ya existían (no hay dos formas de
   editar lo mismo).
3. **Secciones fijas; lo vacío no se pinta.** Cada página tiene sus secciones
   en un orden fijo. Si una no tiene contenido, el alumno no la ve y su sitio
   lo ocupa la siguiente. Nada de «aún no disponible».
4. **El permiso lo decide la base.** Cada elemento nombra el MISMO permiso que
   su política (`ROLES_6/7`). La pantalla solo evita ofrecer lo que la base
   va a rechazar.
5. **Aditivo.** Nada de lo anterior se quita: el panel clásico sigue, las
   columnas nuevas son opcionales y sin su SQL todo se ve como antes.

## 3. Perfiles y qué edita cada uno

Por omisión (los permisos con los que nace cada rol; cada organización puede
cambiarlos en **Centro de gestión → Permisos por perfil**):

| Tarjeta del Centro | Global | Dirección | Coordinación | Docente |
|---|:-:|:-:|:-:|:-:|
| Información del curso | ✓ | — | — | ✓ |
| Módulos y materiales | ✓ | — | — | ✓ |
| Botones | ✓ | — | — | ✓ |
| Exámenes | ✓ | — | — | ✓ |
| Tareas (crear / calificar) | ✓ | — | — | ✓ |
| Foro | ✓ | — | — | ✓ |
| Generaciones y asistencia | ✓ | — | ✓ | solo pasar lista |
| Participantes | ✓ | ✓ | ✓ | ✓ |
| Avance y calificaciones | ✓ | ✓ | ✓ | ✓ |
| Textos de las páginas (lápiz ✏️) | ✓ | solo si administra la organización | | |

Quien administra una organización puede todo en ella. Quien **facilita** un
curso (tabla `facilitadores`) se trata como Docente en ese curso.

Un permiso puede abrir varios elementos (`cursos.editar` abre módulos,
materiales, botones e información). La matriz lo avisa antes de marcar.

## 4. Anatomía de las páginas

**Curso:** Encabezado → Tu avance → Contenido (rutas y módulos) → Botones de
ruta → Tareas → Foro (solo con al menos un tema).

**Módulo:** Encabezado → Botones del módulo → Materiales de lectura →
Grabaciones y videos → Actividades → Plantillas y descargables → Enlaces de
interés → Evaluación → Tareas.

Cada recurso tiene **formato** (cómo se abre: PDF, video…) y **categoría**
(para qué sirve). La categoría por omisión es la de su formato (PDF →
lectura, video → grabación, autoevaluación → actividad, Word → descargable,
enlace → enlace) y se puede cambiar por recurso con
`ESTRUCTURA_1_CATEGORIAS.sql`. El color sale del formato y es el mismo en
todos los cursos (`--formato-*` en `App.css`).

Vocabulario único de estados (`ESTADOS`): Publicado · Próximamente ·
Programado · Oculto para alumnos · Cerrado · Archivado.

## 5. Qué quedó construido

- **`/gestion` — Centro de gestión.** Tarjetas por curso con sus cifras
  (módulos, materiales, exámenes, tareas, temas de foro), búsqueda y filtros
  por estado y tipo.
- **`/gestion/curso/:id`.** Nueve tarjetas que se abren: información y
  estado, módulos y materiales (por categoría, con candado, orden y edición),
  botones, exámenes, tareas, foro, generaciones, participantes y avance. A la
  derecha, **«Así se ve la página»**: qué secciones están llenas y cuáles
  vacías (y por tanto ocultas al alumno).
- **«Ver como»** (Global, Dirección, Coordinación, Docente): recorrer el
  Centro con los ojos de ese perfil; lo que no le toca sale con 🔒 y la razón.
- **Permisos por perfil:** matriz de elementos × perfiles, con filtros
  («solo lo que puede…», «lo que NO puede…») y casillas que cambian el rol en
  la base. En una organización sin roles ofrece crearlos.
- **Página del módulo** agrupada por categoría; lo cerrado ya no se le
  enseña al alumno.
- **Foro** solo visible con temas.
- Entradas: menú de cuenta («Centro de gestión») y franja al inicio del
  panel clásico.

Pruebas: `test:estructura` (36, incluye que el código y `ROLES_5` digan lo
mismo) y `test:pantallas` (68, interacción real en jsdom).

## 6. Qué falta, en orden

1. **Correr SQL** (dueño): `CONTENIDO_1_EDITABLE.sql` (lápiz ✏️) y
   `ESTRUCTURA_1_CATEGORIAS.sql` (elegir categoría por recurso). Para los
   roles: `ROLES_5 → 6 → 7` si no están (`ESTADO.sql` filas 29-31).
2. **Retirar los casos especiales por título.** Diapositivas, Entregables y
   el juego de la sesión 4 pasan a ser recursos normales (categoría
   «Plantillas» o «Actividades») creados una vez desde el Centro; la página de
   detalles del duelo, a contenido editable del curso. Requiere migrar sus
   enlaces actuales: se hace curso por curso, sin borrar nada.
3. **Unificar los avisos de estado** de `CursoView`/`ModuloView` con
   `ESTADOS` (hoy el Centro ya lo usa; las páginas aún tienen sus textos).
4. **Textos de página por rol.** Hoy solo quien administra la organización
   escribe en `contenido_sitio`. Si se quiere que Coordinación o Docente
   editen textos, hace falta un permiso nuevo (`sitio.editar`) y ajustar la
   política (SQL nuevo).
5. **Ámbito por curso en los roles.** Los roles se acotan por sede o
   categoría, no por curso; el Centro trata los permisos «en algún ámbito».
6. **Lo de toda la organización** (inscripciones, comunicados, plantillas,
   tablero) sigue en el panel clásico; el siguiente paso es darle su sección
   en el Centro y, cuando esté todo, retirar el panel clásico.
