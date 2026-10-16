# ¿Qué más se puede volver editable?

*Análisis de la evolución de la plataforma y propuestas · 15 de octubre de 2026*

Este documento parte de lo que el proyecto ya aprendió al cambiar, no de una
lista genérica de funciones. Cada propuesta dice qué pasa **hoy** (con la
evidencia en el código o en la base), qué se propone, en qué buena práctica se
apoya y cuánto cuesta.

---

## 1. El patrón que ya sigue el proyecto

Mirando la historia, cada salto de facilidad repitió el mismo movimiento:

| Etapa | Antes | Después |
|---|---|---|
| Cursos | Escritos en el código | Tabla `cursos` + alta desde el panel (`CURSOS_ALTA`) |
| Personas | «¿Eres admin?» | Facilitadores → roles con permisos por organización (`ROLES_5-7`) |
| Clientes | Un solo sitio | Organizaciones con su marca y su plan (`ORGANIZACIONES_1`, `SUSCRIPCIONES`) |
| Textos | En el código | Capa editable con lápiz (`CONTENIDO_1`) |
| Estructura | Cada pantalla a su manera | Plano único y Centro de gestión (`estructura.js`) |
| Bloques especiales | Escritos para un curso por su título | Categorías de material reutilizables (`ESTRUCTURA_1`) |

**La regla que sale de ahí:** cada decisión escrita en el código se convierte
en **dato** con cuatro piezas: un sitio fijo en la página, un editor, un
permiso y una regla para cuando está vacío («si no hay, no se muestra»). Las
propuestas siguientes aplican esa regla a lo que todavía no la tiene.

## 2. Criterios (buenas prácticas en que se apoya)

- **Contenido estructurado** (modelo de los CMS «headless»): tipos de
  contenido con campos fijos en vez de bloques libres. Es lo que permite que
  el sistema sepa dónde poner cada cosa.
- **Mínimo privilegio (RBAC):** cada perfil tiene lo justo, y quien administra
  puede comprobarlo (la matriz y «Ver como»).
- **Diseño Universal para el Aprendizaje (UDL) y WCAG 2.2 AA:** varias formas
  de acceder al mismo contenido; contraste, texto alternativo, subtítulos.
- **Alineación (Quality Matters):** objetivos, actividades y evaluación
  conectados y visibles para el alumno.
- **Consistencia y reconocimiento antes que memoria** (heurísticas de
  Nielsen): lo mismo se ve igual en todos los cursos y se encuentra donde se
  espera.
- **Design tokens:** colores y estilos como variables con nombre, no como
  valores sueltos.

---

## 3. Oportunidades

Esfuerzo: **S** pequeño (horas, sin SQL) · **M** mediano (SQL aditivo) ·
**L** grande (varias piezas).

### A. Estructura del curso

**A1. Las rutas como entidad propia** · M
- *Hoy:* la ruta es un texto libre en `modulos.grupo`. Su nombre y su
  descripción están escritos en `CursoView` (`rutaLabel`, `rutaDescripcion`,
  solo para «Acompañamiento» y «Clínica»), y sus botones viven en otro sitio
  (`cursos.rutas_botones`).
- *Propuesta:* tabla `rutas` (curso, nombre, a quién va dirigida, orden,
  botones). En el Centro, una tarjeta «Rutas» para crearlas, ordenarlas y
  asignar módulos arrastrando.
- *Por qué:* hoy cualquier curso con rutas que no se llamen así sale con
  textos genéricos.

**A2. Modelos de curso** · M
- *Hoy:* existe `duplicar_curso` (`CURSOS_PLANTILLA`), pero se copia un curso
  concreto con todo su contenido.
- *Propuesta:* modelos vacíos con su estructura armada: «Taller de una
  sesión», «Curso de 4 módulos con 2 rutas», «Diplomado», «Supervisión
  clínica». Cada uno trae sus secciones (sesión en vivo, lecturas,
  entregables…) listas para llenar.
- *Por qué:* empezar desde un esqueleto correcto evita los cursos «a medio
  armar».

**A3. Objetivos de aprendizaje por módulo** · M
- *Hoy:* el módulo solo tiene título y descripción.
- *Propuesta:* lista editable «Al terminar podrás…» arriba de cada módulo, con
  cada material, actividad y examen ligado al objetivo que trabaja. En el
  Centro, aviso de los objetivos sin actividad o sin evaluación.
- *Por qué:* alineación (Quality Matters): el alumno sabe para qué sirve cada
  cosa.

**A4. Liberación por generación** · M
- *Hoy:* las fechas de apertura y cierre (`MODULOS_FECHAS`) son del módulo y
  valen para todas las generaciones.
- *Propuesta:* fechas relativas al inicio de cada generación («semana 2»). Al
  crear la siguiente generación, el calendario de aperturas se recalcula solo.

### B. Materiales

**B1. Subir el archivo desde el editor** · S/M · *el más urgente*
- *Hoy:* para un PDF o un Word hay que escribir a mano la «ruta en Storage»
  (`ModalEditarRecurso`). La única subida real que existe es la foto de
  perfil (`Perfil.jsx`).
- *Propuesta:* botón «Subir archivo» que lo guarda en el bucket del curso y
  rellena la ruta. Al reemplazar, conserva el material y sus «visto».
- *Por qué:* hoy es el paso que más depende de saber cómo está armada la base
  por dentro.

**B2. Ficha del material** · M
- *Propuesta:* campos opcionales por recurso: **duración estimada**
  («15 min»), **obligatorio / complementario** (el avance cuenta solo los
  obligatorios), **disponible desde** y **texto alternativo / transcripción**.
- *Por qué:* UDL y WCAG; además el alumno puede planear su tiempo.

**B3. Biblioteca compartida** · L
- *Hoy:* el mismo PDF en tres cursos son tres filas con su ruta; si se
  corrige, hay que cambiarlo tres veces.
- *Propuesta:* biblioteca de la organización (con buscador y etiquetas) y
  materiales que *apuntan* a ella. Se corrige una vez y cambia en todos.

**B4. Sesión en vivo enlazada con la agenda** · M
- *Hoy:* `sesiones` tiene fecha, hora, lugar y módulo por generación, pero no
  el enlace de la videollamada. La nueva sección «Sesiones en vivo» guarda el
  enlace aparte.
- *Propuesta:* unirlas. La sesión de la agenda trae su enlace; el botón
  «Entrar a la sesión» solo se activa desde 15 minutos antes, y después la
  misma tarjeta se convierte en «Ver la grabación».

### C. Experiencia del alumno

**C1. «Qué me toca hoy»** · M
- *Propuesta:* en *Mis cursos*, una sola lista ordenada: la próxima sesión,
  las entregas que vencen pronto, el módulo que acaba de abrirse y el último
  material sin terminar. Se arma con datos que ya existen (`sesiones`,
  `tareas.fecha_limite`, `modulos.abre_el`, `progreso_usuario`).

**C2. Tablón de avisos del curso** · S/M
- *Hoy:* los comunicados (`COMUNICADOS_1`) son correos.
- *Propuesta:* que el mismo comunicado quede fijado arriba del curso como
  aviso (sección fija; vacía si no hay), con fecha de caducidad.

**C3. Preguntas frecuentes y glosario por curso** · S
- *Propuesta:* dos listas editables más en la página de detalles. Cuestan poco
  y le ahorran mensajes de WhatsApp al docente.

**C4. Insignias por módulo** · L
- *Hoy:* las constancias ya son verificables (`CONSTANCIAS_VERIFICABLES`).
- *Propuesta:* insignias por módulo o por ruta, compatibles con
  **Open Badges 3.0**, que el alumno puede llevar a LinkedIn.

### D. Comunicación

**D1. Todos los mensajes de WhatsApp en una sola lista** · S
- *Hoy:* los mensajes ya son editables, pero repartidos por cada botón.
  `whatsapp.js` tiene sus propias plantillas y marcadores.
- *Propuesta:* tarjeta «Mensajes» en el Centro con todos los mensajes del
  sitio, dónde aparece cada uno, sus marcadores y una vista previa. Se
  cambia el tono de todo de una vez.

**D2. Inventario de textos** · S
- *Propuesta:* además del lápiz en la página, una tabla de todos los textos
  editables (`contenido_sitio` y sus valores por omisión), con buscador
  («¿dónde dice “Próximamente”?»), cuáles se cambiaron y botón para
  restablecer.

**D3. Recordatorios automáticos** · M
- *Propuesta:* aviso por correo 24 horas antes de una sesión o de una entrega.
  El correo ya existe (`correo.js`); falta la programación.

### E. Operación y calidad

**E1. Chequeo del curso** · S · *muy rentable*
- *Propuesta:* en cada tarjeta del Centro, un indicador de salud con lo que
  ya se puede detectar: videos marcados `PENDIENTE`, PDFs sin archivo, módulos
  sin materiales, exámenes sin preguntas, tareas con fecha vencida que siguen
  abiertas, enlaces que no responden y rutas sin módulos. Cada aviso lleva un
  botón «Ir a arreglarlo».
- *Por qué:* hoy esos errores los descubre el alumno.

**E2. Borrador y publicar** · M
- *Propuesta:* editar un módulo en borrador y publicarlo de una vez, con
  vista previa «como alumno de la ruta X» (que sea de verdad, no solo de
  permisos).

**E3. Historial y deshacer** · M
- *Hoy:* la bitácora (`auditoria`) ya guarda los cambios, pero solo se
  consulta en el panel de plataforma.
- *Propuesta:* en cada curso, «Cambios recientes» (quién cambió qué y
  cuándo) con «Deshacer».

**E4. Acciones masivas** · S/M
- *Propuesta:* seleccionar varios módulos o materiales para abrir, cerrar,
  cambiar de categoría, mover de ruta o copiar a otro curso.

**E5. Permisos por curso y textos por rol** · M
- *Hoy:* los roles se acotan por sede o categoría, no por curso. Los textos
  de la página son solo de quien administra (decisión confirmada).
- *Propuesta:* asignar un rol solo en uno o varios cursos. Así el Docente de
  un curso no aparece como Docente de toda la categoría.

### F. Marca y presentación

**F1. Editor visual de la marca** · M
- *Hoy:* la marca es nombre, logo, colores y `css_extra` (`MARCA_1_CSS`), que
  es CSS a mano.
- *Propuesta:* tokens con nombre (color principal, acento, colores de cada
  formato, tipografía, radio de las esquinas). Cada combinación pasa por una
  comprobación de contraste AA, con vista previa en vivo de una tarjeta y un
  módulo.

**F2. Portadas de curso** · S
- *Hoy:* las ilustraciones de portada se generan por código (`PortadaCurso`)
  y no se pueden cambiar.
- *Propuesta:* elegir entre el motivo generado o subir una imagen, con su
  texto alternativo obligatorio.

**F3. Modo oscuro y tamaño de letra** · M
- *Propuesta:* preferencia de lectura para el alumno (UDL), posible gracias a
  que los colores ya son variables.

### G. Datos y portabilidad

**G1. Exportar e importar un curso** · M
- *Propuesta:* un curso completo en un archivo (estructura, textos y
  materiales) para respaldo, para moverlo a otra organización o para venderlo
  como «curso llave en mano». A futuro, compatible con IMS Common Cartridge.

**G2. Tablero por curso** · S
- *Hoy:* las alertas de retención (`RETENCION_1`) y el NPS (`ENCUESTAS_1`) ya
  existen.
- *Propuesta:* mostrarlos dentro de la tarjeta del curso en el Centro: «3
  alumnos en riesgo», «NPS 72», con su acción («escribirles»).

---

## 4. Apuestas más creativas

- **«Modo docente en clase»:** una vista de proyección del módulo
  (diapositivas, juego y temporizador) con pase de lista integrado. Pensada
  para dar la sesión en vivo desde la plataforma.
- **El juego como tipo de contenido:** que los juegos (como el de la sesión 4)
  se armen desde una plantilla (preguntas, casos, tiempo) en vez de un HTML
  hecho a mano, y que su resultado cuente como actividad.
- **Ruta personalizada:** un cuestionario breve al inscribirse («¿atiendes en
  consulta?») que asigna la ruta Acompañamiento o Clínica y lo explica.
- **Asistente de armado:** a partir de los objetivos del curso, el Centro
  sugiere qué secciones faltan («este módulo no tiene actividad»). Es la
  versión guiada del chequeo E1.
- **Página pública por organización:** que cada cliente arme su portada con
  los mismos bloques fijos (perfil, cursos, servicios, contacto) sin tocar
  código. Ya existe la mitad: el lápiz y la marca por organización.

---

## 5. Orden sugerido

| Ola | Qué | Por qué primero |
|---|---|---|
| **1 (sin SQL)** | B1 subir archivo · E1 chequeo del curso · D1 mensajes en una lista · D2 inventario de textos · C3 preguntas frecuentes | Mayor alivio diario, riesgo casi nulo |
| **2 (SQL aditivo)** | A1 rutas · B2 ficha del material · B4 sesión + enlace · C1 «qué me toca hoy» · E3 historial | Ordena la estructura y la experiencia del alumno |
| **3 (de producto)** | A2 modelos · B3 biblioteca · F1 marca visual · G1 exportar · C4 insignias · E5 permisos por curso | Hacen la plataforma vendible a más clientes |
