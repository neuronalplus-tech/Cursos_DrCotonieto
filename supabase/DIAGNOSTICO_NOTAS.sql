-- =============================================================
--  DIAGNÓSTICO: ¿DE QUÉ NOTAS SALE LA CALIFICACIÓN DE UN CURSO?
--
--  PARA QUÉ SIRVE
--  Comprobar que la rejilla del facilitador (Panel de progreso) y
--  "Mis calificaciones" del alumno están mirando LO MISMO. Te
--  enseña, alumno por alumno, cada nota que entra en el cálculo,
--  con qué máximo, y cuánto da el promedio.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  No hay nada que editar: sale el repaso de TODOS tus cursos.
--
--  Si tienes muchos alumnos y quieres mirar uno solo, cambia el
--  `null` de la línea marcada por el id del curso. Ese id sale en
--  la dirección cuando entras al curso (.../curso/7 -> 7) y también
--  en la columna `curso_id` de este mismo resultado.
--
--  Solo lee. No modifica nada.
-- =============================================================

with parametros as (
  -- null = todos los cursos. Un número = solo ese curso.
  select null::bigint as curso
),

cursos_sel as (
  select c.id, c.titulo, c.ponderacion
  from public.cursos c, parametros p
  where p.curso is null or c.id = p.curso
),

-- Exámenes y tareas pueden colgar del curso o de uno de sus
-- módulos, así que hace falta saber a qué curso pertenece cada
-- módulo para no perder la mitad de las notas.
mods as (
  select m.id, m.curso_id
  from public.modulos m
  join cursos_sel c on c.id = m.curso_id
  where coalesce(m.activo, true)
),

examenes_sel as (
  select e.id, e.titulo, coalesce(e.curso_id, m.curso_id) as curso_id
  from public.examenes e
  left join mods m on m.id = e.modulo_id
  where coalesce(e.curso_id, m.curso_id) in (select id from cursos_sel)
),

-- Del examen cuenta el MEJOR intento: es el que ve el alumno y el
-- que cuenta para la constancia.
notas_examen as (
  select distinct on (i.usuario_id, i.examen_id)
    i.usuario_id,
    es.curso_id,
    'Examen'::text as tipo,
    es.titulo,
    i.calificacion::numeric as obtenida,
    100::numeric as maximo
  from public.intentos_examen i
  join examenes_sel es on es.id = i.examen_id
  where i.calificacion is not null
  order by i.usuario_id, i.examen_id, i.calificacion desc
),

tareas_sel as (
  select t.id, t.titulo,
         coalesce(t.curso_id, m.curso_id) as curso_id,
         coalesce(t.puntos_max, 100)::numeric as maximo
  from public.tareas t
  left join mods m on m.id = t.modulo_id
  where coalesce(t.curso_id, m.curso_id) in (select id from cursos_sel)
),

notas_tarea as (
  select
    en.usuario_id,
    ts.curso_id,
    'Tarea'::text as tipo,
    ts.titulo,
    en.calificacion::numeric as obtenida,
    ts.maximo
  from public.entregas en
  join tareas_sel ts on ts.id = en.tarea_id
  where en.calificado_en is not null
    and en.calificacion is not null
),

-- Se promedia DENTRO de cada hilo: quien escribió diez veces en el
-- mismo hilo no debe pesar diez veces más que quien escribió una.
notas_foro as (
  select
    r.autor_id as usuario_id,
    h.curso_id,
    'Foro'::text as tipo,
    h.titulo,
    round(avg(r.calificacion), 2) as obtenida,
    coalesce(h.puntos_max, 10)::numeric as maximo
  from public.foro_respuestas r
  join public.foro_hilos h on h.id = r.hilo_id
  where h.curso_id in (select id from cursos_sel)
    and h.califica
    and not coalesce(r.borrada, false)
    and r.calificacion is not null
  group by r.autor_id, h.curso_id, h.titulo, h.puntos_max
),

todo as (
  select * from notas_examen
  union all select * from notas_tarea
  union all select * from notas_foro
),

con_base as (
  select
    t.*,
    round((t.obtenida / nullif(t.maximo, 0)) * 100, 1) as en_base_100
  from todo t
)

select
  c.id as curso_id,
  c.titulo as curso,
  coalesce(pe.nombre_completo, '(sin nombre)') as alumno,
  b.tipo,
  b.titulo as actividad,
  b.obtenida,
  b.maximo,
  b.en_base_100,
  -- Promedio simple de las filas de ESE alumno en ESE curso.
  -- Solo coincide con la pantalla si el curso NO tiene ponderación.
  round(avg(b.en_base_100) over (partition by b.usuario_id, b.curso_id), 1)
    as promedio_simple,
  count(*) over (partition by b.usuario_id, b.curso_id) as notas,
  case when c.ponderacion is null then 'promedio simple'
       else c.ponderacion::text end as como_califica_el_curso
from con_base b
join cursos_sel c on c.id = b.curso_id
left join public.perfiles pe on pe.id = b.usuario_id
order by c.titulo, alumno, b.tipo, b.titulo;

-- =============================================================
--  CÓMO LEERLO
--
--  · en_base_100 es lo que entra en el promedio. Todo se normaliza
--    antes, porque un examen sobre 10 y una tarea sobre 100 no se
--    pueden promediar crudos.
--
--  · promedio_simple se repite en todas las filas del mismo alumno
--    y del mismo curso: es el promedio de su columna en_base_100.
--    Cuando como_califica_el_curso dice "promedio simple", ESE
--    numero es el que deben enseñar las dos pantallas.
--
--  · Si como_califica_el_curso trae un JSON con pesos, el curso esta
--    ponderado y promedio_simple NO aplica: ahi se promedia primero
--    dentro de cada tipo (Examen, Tarea, Foro) y luego se aplican
--    los pesos, saltando los tipos que ese alumno no tenga.
--
--  · Lo que NO aparece aqui NO cuenta. Una tarea entregada pero sin
--    calificar no sale, y eso es a proposito: a mitad de curso,
--    contarla como cero daria un numero que no significa nada.
--
--  LA COMPROBACION QUE IMPORTA
--  Toma un alumno de un curso SIN ponderacion. Su promedio_simple
--  tiene que ser identico a lo que dice la columna Calificacion del
--  panel de progreso Y a lo que ese alumno ve en Mis calificaciones.
--  Los tres numeros, iguales.
--
--  QUE HACER SI ALGO NO CUADRA
--  · Las dos pantallas dan numeros distintos entre si -> mandamelo.
--    Es un error, y es justo el que esto venia a eliminar.
--  · Falta una nota que si pusiste -> mira si la entrega quedo sin
--    `calificado_en` (se guardo pero no se califico), o si la
--    respuesta del foro esta en un hilo sin la casilla de calificar.
--  · No sale ninguna fila -> todavia no hay nada calificado en
--    ningun curso.
--  · Sale lentisimo o son demasiadas filas -> pon el id de un curso
--    en la linea del `null`, arriba.
-- =============================================================
