# Indicadores (KPI) del Centro de gestión

*16 de octubre de 2026 · `supabase/INDICADORES_1_KPI.sql` · `src/lib/indicadores.js`*

Al entrar al **Centro de gestión**, la primera pestaña es **📈 Indicadores**.
Cada perfil ve los cursos a su cargo y, arriba, lo que más le importa. Todo
sale de lo que la plataforma ya registra: nadie captura nada a mano.

## 1. Quién ve qué

«A mi cargo» se decide en la base (`kpi_mis_cursos`), con una sola regla:

| Perfil | Cursos | Equipo |
|---|---|---|
| Administración (global u organización) | Todos los de la organización | Todo el equipo |
| Dirección / Coordinación (rol con «ver indicadores» o «ver calificaciones») | Los de su ámbito (sede o categoría) | Todo su ámbito |
| Docente / facilitador | Los que imparte | Solo a sí mismo |

Con **«Ver como»** cambian los indicadores destacados, no las cifras: la base
solo contesta por quien pregunta.

## 2. Los indicadores

| Grupo | Indicador | Cómo se calcula | Meta por omisión | Destacado para |
|---|---|---|---|---|
| Aprendizaje | Avance medio | Materiales vistos / publicados, por alumno, ponderado | ≥ 60 % | todos |
| | Tasa de finalización | Alumnos que vieron todo / inscritos | ≥ 50 % | Dirección |
| | Aprobación de exámenes | Intentos aprobados / presentados (periodo) | ≥ 80 % | Coordinación |
| | Asistencia | Presente + retardo / registros (periodo) | ≥ 85 % | Coordinación, Docente |
| Actividad | Alumnos activos | Con actividad en el periodo / inscritos | ≥ 60 % | Dirección, Coordinación |
| | Activos en 7 días | Con actividad en la última semana | — | |
| | Alumnos en riesgo | Inscritos > 7 días, sin terminar y sin actividad en 14 | 0 | Coordinación, Docente |
| Docencia | Entregas por calificar | Entregadas sin calificación, a hoy | 0 | Docente, Coordinación |
| | Tiempo medio para calificar | Horas entre entrega y calificación (periodo) | ≤ 72 h | todos |
| | Calificado en ≤ 7 días | % de lo calificado en el periodo | ≥ 90 % | Coordinación |
| | Respuestas en el foro | Respuestas publicadas en el periodo | — | Docente |
| Crecimiento | Inscritos · Inscripciones nuevas · Interesados · Constancias | Conteos | — | Dirección |

- **Metas:** cada tarjeta tiene «editar» para quien administra. Se guardan en
  `contenido_sitio` (`kpi.meta.<clave>`), así que hace falta
  `CONTENIDO_1_EDITABLE.sql`.
- **Semáforo:** verde si cumple la meta; ámbar si está a menos de un 20 %
  (o hasta 3 pendientes cuando la meta es 0); rojo si se aleja más. Además
  del color, la meta va escrita y el borde cambia de grosor.
- **Por curso** y **por persona:** tablas que se ordenan por cualquier
  columna. Cada curso enlaza a su gestión.
- **Por persona:** cuántas entregas calificó y en cuánto tiempo, qué tiene
  pendiente en sus cursos, sus respuestas en el foro y las listas que pasó.

## 3. Datos que la plataforma no genera (económicos, RR. HH.)

La tabla **`indicadores_externos`** es el enchufe. Cada fila es un valor con
su contexto:

| Campo | Ejemplo |
|---|---|
| `organizacion_id` | La institución |
| `area` | `Finanzas`, `Admisiones`, `Recursos humanos` |
| `clave` / `etiqueta` | `ingresos` / «Ingresos del mes» |
| `valor` / `unidad` | `48500` / `MXN` |
| `curso_id` *(opcional)* | Si el valor es de un curso |
| `persona_email` *(opcional)* | Si es de una persona (horas contratadas, pago) |
| `periodo` | `2026-10-01` |
| `fuente` | `manual`, `csv`, `api:contabilidad` |

Leen Dirección y quien administra; escribe quien administra. El tablero los
agrupa por área en «Económicos y fuentes externas».

**Tres formas de alimentarla, de menos a más automática:**
1. **A mano:** Supabase → Table Editor → `indicadores_externos` → Insert row.
2. **CSV:** Table Editor → Import data from CSV, con las columnas de arriba.
   Sirve para lo que ya sale de Excel o del sistema contable.
3. **Automática:** un sistema externo hace `POST` a la API de Supabase con
   una clave de servicio (o una Edge Function propia) y deja una fila por
   periodo. Así se conecta contabilidad, nómina o un CRM sin tocar el
   tablero.

## 4. Siguientes pasos posibles

Requieren construir algo, en orden de valor:

1. **Precio por curso.** Una columna `precio` en `cursos` convierte
   inscripciones en ingresos estimados por curso y por periodo, sin depender
   de una fuente externa.
2. **Tiempo de respuesta en mensajes y foro.** Los datos ya existen
   (`mensajes.created_at`, `foro_respuestas.responde_a`); falta la consulta:
   horas entre la pregunta de un alumno y la primera respuesta del docente.
3. **Horas en la plataforma.** Hoy solo se sabe la última vez que alguien
   abrió cada material. Medir tiempo real requiere un pulso discreto desde
   el navegador (una fila por persona y día en `actividad_diaria`), que
   también daría horas por docente.
4. **Satisfacción por docente.** El NPS existe por curso (`ENCUESTAS_1`);
   cruzarlo con quién impartió da un indicador de calidad por persona.
5. **Tendencia.** Guardar una foto mensual de `kpi_cursos` para ver la
   evolución (este mes contra el anterior), no solo el valor de hoy.
