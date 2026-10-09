# Control escolar: roles y módulos

Catálogo de opciones para decidir qué se construye. 2026-10-08.

---

## Primero, lo que hay que entender antes de elegir

Hoy esto es un **aula virtual**: contenido, evaluación y seguimiento
del aprendizaje. Lo que pides lo convierte además en un **sistema de
control escolar**: matrícula, asistencia, grupos, horarios, actas,
expedientes y documentos oficiales.

Son dos productos distintos que conviven bien, pero no son el mismo:

| | Aula virtual | Control escolar |
|---|---|---|
| Pregunta que responde | ¿Aprendió? | ¿Está inscrito, asiste y acredita? |
| Lo usa | Docente y alumno | Dirección, coordinación y servicios escolares |
| Si falla | Una clase sale mal | Un título no se puede emitir |

**La consecuencia práctica:** el segundo tiene exigencias legales y de
auditoría que el primero no. Un acta de calificaciones firmada no se
corrige borrando una fila. Eso cambia cómo hay que guardar las cosas,
y conviene saberlo antes y no después.

**Esto es una ventaja comercial, no un problema.** Moodle es aula
virtual; el control escolar lo venden aparte y caro. Ofrecer las dos
cosas con la marca del cliente es un argumento que Moodle no tiene.

---

## 1. Los roles

### Lo que hay hoy

| Rol | Alcance |
|---|---|
| Administrador de plataforma | Todo. Eres tú. |
| Administrador de organización | Todo lo de su institución |
| Facilitador | Los cursos o categorías que se le asignen |
| Alumno | Lo suyo |

### Lo que propones, y cómo encaja

**Dirección** ≈ el administrador de organización que ya existe, pero
con otro énfasis: hoy esa figura *opera* (da de alta cursos, inscribe).
Dirección sobre todo **mira y autoriza**.

**Coordinación** es el hueco real. Hoy no existe nadie entre el
administrador de la institución y el docente, y es quien hace el
trabajo diario: arma grupos, asigna docentes, revisa asistencia,
justifica faltas, persigue al que no entra.

**Facilitador** ya existe y sirve; le faltan herramientas (pase de
lista, informes), no permisos.

### Tres maneras de montarlo

| | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Un rol más** | Añadir `coordinacion` junto a los que hay | Lo más rápido. Dos semanas. | Si mañana quieres «servicios escolares» o «tutor», otra vez lo mismo |
| **B. Roles con permisos** ⭐ | Una tabla de roles y otra de permisos por rol | Se crean roles nuevos sin tocar código. Cada cliente nombra los suyos | Más trabajo al inicio; hay que diseñar bien la lista de permisos |
| **C. Por asignación** | El rol se da sobre un ámbito: *coordinador de esta carrera*, *de este plantel* | Lo que de verdad pasa en una escuela con varias sedes | El más caro. Solo vale la pena si hay planteles |

**Mi recomendación: B.** Ya tienes cuatro roles y vas por el quinto;
el patrón se repite. Y vendiendo a instituciones distintas, cada una
llama distinto a lo mismo — «coordinación académica», «jefatura de
carrera», «subdirección». Con B eso lo configura el cliente.

C tiene sentido más adelante, cuando un cliente tenga planteles.

---

## 2. Los módulos

Agrupados por para qué sirven. El esfuerzo es orientativo: **S** es
días, **M** una o dos semanas, **L** más.

### 🟢 Operación diaria — lo que pediste explícitamente

| Módulo | Qué resuelve | Quién | Esf. |
|---|---|---|---|
| **Pase de lista** | Asistencia por sesión, desde el teléfono, en menos de un minuto | Facilitador | M |
| **Justificación de faltas** | Quien justifica no es quien pasa lista | Coordinación | S |
| **Informes con plantilla** | Documentos oficiales autollenados | Todos | M |
| **Sesiones y calendario** | Qué día toca qué: sin esto, el pase de lista no sabe a qué sesión pertenece | Coordinación | M |

> **Las sesiones son el cimiento.** Pasar lista exige saber *a qué
> sesión*. Si se hace sin eso, la asistencia queda colgando de una
> fecha suelta y no se puede sacar «faltas del parcial 2».

### 🟢 Estructura académica

| Módulo | Qué resuelve | Esf. |
|---|---|---|
| **Ciclos y periodos** | Semestre, cuatrimestre, parciales. Hoy hay `generaciones`, que no es lo mismo | M |
| **Grupos y horarios** | Grupo = alumnos + docente + aula + horario | M |
| **Planes de estudio** | Materias, créditos, seriación, mapa curricular | L |
| **Carga docente** | Cuántos grupos lleva cada quien, y choques de horario | S |

### 🟡 Expediente y documentos

| Módulo | Qué resuelve | Esf. |
|---|---|---|
| **Expediente del alumno** | Acta, CURP, certificado previo, fotografía. Con control de qué falta | M |
| **Actas de calificaciones** | Documento **inmutable** por grupo y periodo, con folio | M |
| **Boletas por parcial** | Lo que el alumno descarga a mitad del ciclo | S |
| **Constancias de estudios** | Distinta de la constancia de curso que ya tienes | S |
| **Kárdex** | Historial completo: todo lo cursado, con promedio general | M |

> **Un acta emitida no se edita.** Si hay que corregirla, se emite una
> rectificación que deja constancia de las dos. Es la diferencia entre
> un registro escolar y una tabla.

### 🟡 Seguimiento y alerta temprana

| Módulo | Qué resuelve | Esf. |
|---|---|---|
| **Semáforo de riesgo** | Quién va a desertar, antes de que deserte: faltas + bajas notas + sin entrar | M |
| **Tutorías** | Bitácora de seguimiento por alumno | M |
| **Canalización** | Derivación a psicopedagogía, con seguimiento. **Tu terreno.** | M |
| **Incidencias** | Conducta, con quién la reportó y qué se hizo | S |

> El **semáforo** es, de toda esta lista, lo que más dinero le ahorra
> a una institución: un alumno que deserta en el mes 3 es una
> colegiatura perdida que ya estaba vendida. Y es barato, porque los
> datos ya los tienes.

### 🟡 Dirección

| Módulo | Qué resuelve | Esf. |
|---|---|---|
| **Tablero de indicadores** | Matrícula, retención, aprobación, asistencia media | S |
| **Comparativo entre ciclos** | ¿Vamos mejor o peor que el año pasado? | S |
| **Reportes exportables** | Lo que se lleva a una junta de consejo | S |
| **Autorizaciones** | Bajas, cambios de grupo, rectificaciones | M |

### 🔴 Administración (el más grande)

| Módulo | Qué resuelve | Esf. |
|---|---|---|
| **Colegiaturas** | Qué debe cada alumno, qué pagó, qué se le condonó | L |
| **Becas y descuentos** | Con vigencia y condiciones | M |
| **Recibos y facturación** | CFDI. Exige integrar a un tercero | L |

> **Mi consejo: no entres aquí todavía.** La cobranza escolar es un
> producto por sí solo, con reglas fiscales que cambian. Casi todas
> las instituciones ya tienen algo. Pregunta antes de construir.

### 🔵 Comunicación

| Módulo | Qué resuelve | Esf. |
|---|---|---|
| **Avisos con acuse** | Quién leyó el reglamento, y cuándo | S |
| **Comunicados por grupo** | Hoy existe, pero no por grupo | S |
| **Padres o tutores** | Acceso de solo lectura al avance de un menor | M |

---

## 3. Módulos activables por cliente

Dijiste *«se seccionaría para facilitar su uso»*, y eso es una
decisión de arquitectura, no de interfaz.

**Propuesta:** `organizaciones.modulos` como lista de lo que esa
institución tiene contratado. El panel enseña solo esas secciones.

Tres cosas que esto resuelve de golpe:

1. Un despacho de dos personas no ve «carga docente» ni «kárdex», y
   su panel sigue siendo usable.
2. **Se vuelve tu lista de precios.** El plan Semilla trae aula
   virtual; el Institucional añade control escolar; las colegiaturas
   se cobran aparte. Ya tienes `planes` — esto cuelga ahí.
3. Puedes vender un módulo nuevo sin tocar a quien no lo quiere.

Sin esto, cada módulo que añadas le complica el panel a **todos** tus
clientes, incluidos los que nunca lo van a usar.

---

## 4. Por dónde empezaría

**Primera tanda (lo que pediste, y se sostiene solo):**

1. Roles con permisos *(opción B)* — porque todo lo demás cuelga de ahí
2. Ciclos, periodos y grupos — el cimiento
3. Sesiones y calendario
4. **Pase de lista**
5. **Informes con plantilla** — empezando por lista de asistencia y acta
6. Módulos activables por cliente

Eso ya es un sistema de control escolar presentable, y cada pieza
sirve desde el día que está.

**Segunda tanda, por valor comercial:**

7. Semáforo de riesgo — lo que más vende
8. Tablero de dirección
9. Expediente del alumno
10. Kárdex y boletas

**Después, y solo preguntando antes:** colegiaturas, planes de
estudio con seriación, padres o tutores.

---

## 5. Lo que tengo que preguntarte antes de empezar

De esto depende cómo se guardan las cosas, y cambiarlo después es
caro:

1. **¿Presencial, en línea, o las dos?** Si hay grupos presenciales y
   en línea conviviendo, el modelo cambia.
2. **¿Semestre, cuatrimestre, o módulos sueltos?** ¿Cuántos parciales?
3. **¿Una sede o varias?** Define si hace falta la opción C de roles.
4. **¿Quién firma un acta?** ¿Hace falta firma electrónica, o basta
   con el nombre y el folio?
5. **¿Hay validez oficial (RVOE) de por medio?** Si la hay, el
   formato de las actas no lo decides tú.
6. **¿La institución que tienes en mente ya usa algo** para esto, y
   qué le falta?

Las dos últimas son las que más pueden cambiar el diseño.

---

## 6. Lo que esto no quita de la lista

Sigue pendiente de antes: **SMTP** (un pase de lista sin avisos
pierde la mitad de su valor: nadie se entera de las faltas),
**respaldos** —el plan gratuito no tiene ninguno, y aquí ya hablamos
de registros escolares—, PWA, aleatorización de exámenes y
estadística de preguntas.

La PWA sube de prioridad con esto: **el pase de lista se hace desde
el teléfono, de pie, en el salón.** Si no abre rápido y no funciona
con mala señal, no se usa.
