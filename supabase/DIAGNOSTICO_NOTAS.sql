-- =============================================================
--  DIAGNÓSTICO: ¿DE QUÉ NOTAS SALE LA CALIFICACIÓN DE UN CURSO?
--
--  PARA QUÉ SIRVE
--  Comprobar que la rejilla del facilitador y "Mis calificaciones"
--  del alumno están mirando LO MISMO. Te enseña, alumno por alumno,
--  cada nota que entra en el cálculo y con qué máximo.
--
--  POR QUÉ NO CALCULA AQUÍ LA NOTA FINAL
--  Porque sería una TERCERA implementación del mismo número, y
--  entonces no sabrías a cuál creerle. Si esta consulta dijera 88 y
--  la pantalla 85, el primer sospechoso sería la pantalla, cuando
--  igual la equivocada es la consulta.
--
--  Lo que hace es enseñarte las ENTRADAS. Si las dos pantallas
--  parten de aquí y dan números distintos, el problema está en el
--  cálculo. Si una pantalla ignora alguna de estas filas, el
--  problema está en lo que esa pantalla carga. Y la aritmética de
--  una sola fila la puedes comprobar a mano en treinta segundos.
--
--  CÓMO USARLO
--
--  PASO 1. Averigua el ID DEL CURSO. Es un NÚMERO, no un correo
--  ni un título. Corre esta consulta aparte:
--
--      select id, titulo, ponderacion from public.cursos order by id;
--
--  También sale en la dirección cuando entras al curso:
--  .../curso/7  ->  el id es 7
--
--  PASO 2. Escribe ese número en la línea marcada más abajo,
--  donde ahora dice 12. Debe quedar así, con el número suelto:
--
--      select 7::bigint as curso
--
--  PASO 3. Supabase -> SQL Editor -> pega esto -> Run.
--
--  Solo lee. No modifica nada.
-- =============================================================

with parametros as (
  select 12::bigint as curso   -- <<< PON AQUÍ EL ID DEL CURSO (un número)
),

-- Los módulos del curso, porque exámenes y tareas pueden colgar del
-- curso o de un módulo suyo.
mods as (
  select m.id from public.modulos m, parametros p
  where m.curso_id = p.curso and coalesce(m.activo, true)
),

inscritos as (
  select distinct ac.usuario_id from public.acceso ac, parametros p
  where ac.curso_id = p.curso
),

-- Del examen cuenta el MEJOR intento: es el que ve el alumno y el
-- que cuenta para la constancia.
mejor_examen as (
  select distinct on (i.usuario_id, i.examen_id)
    i.usuario_id, e.titulo, i.calificacion
  from public.intentos_examen i
  join public.examenes e on e.id = i.examen_id, parametros p
  where (e.curso_id = p.curso or e.modulo_id in (select id from mods))
    and i.calificacion is not null
  order by i.usuario_id, i.examen_id, i.calificacion desc
),

tareas_calificadas as (
  select en.usuario_id, t.titulo, en.calificacion,
         coalesce(t.puntos_max, 100) as maximo
  from public.entregas en
  join public.tareas t on t.id = en.tarea_id, parametros p
  where (t.curso_id = p.curso or t.modulo_id in (select id from mods))
    and en.calificado_en is not null
    and en.calificacion is not null
),

-- Se promedia DENTRO de cada hilo: quien escribió diez veces en el
-- mismo hilo no debe pesar diez veces más.
foro as (
  select r.autor_id as usuario_id, h.titulo,
         round(avg(r.calificacion), 2) as calificacion,
         coalesce(h.puntos_max, 10) as maximo
  from public.foro_respuestas r
  join public.foro_hilos h on h.id = r.hilo_id, parametros p
  where h.curso_id = p.curso
    and h.califica
    and not coalesce(r.borrada, false)
    and r.calificacion is not null
  group by r.autor_id, h.titulo, h.puntos_max
),

todo as (
  select i.usuario_id, 'Examen' as tipo, me.titulo, me.calificacion, 100::numeric as maximo
  from inscritos i join mejor_examen me on me.usuario_id = i.usuario_id
  union all
  select i.usuario_id, 'Tarea', tc.titulo, tc.calificacion, tc.maximo::numeric
  from inscritos i join tareas_calificadas tc on tc.usuario_id = i.usuario_id
  union all
  select i.usuario_id, 'Foro', f.titulo, f.calificacion, f.maximo::numeric
  from inscritos i join foro f on f.usuario_id = i.usuario_id
)

select
  coalesce(pe.nombre_completo, '(sin nombre)') as alumno,
  t.tipo,
  t.titulo,
  t.calificacion as obtenida,
  t.maximo,
  round((t.calificacion / nullif(t.maximo, 0)) * 100, 1) as en_base_100
from todo t
left join public.perfiles pe on pe.id = t.usuario_id
order by alumno, t.tipo, t.titulo;

-- =============================================================
--  CÓMO LEERLO
--
--  1. La columna `en_base_100` es la que entra en el promedio. Todo
--     se normaliza antes de promediar porque un examen sobre 10 y
--     una tarea sobre 100 no se pueden promediar crudos.
--
--  2. SIN PONDERAR, la nota del curso es el promedio simple de
--     TODOS los `en_base_100` de ese alumno. Toma un alumno, suma su
--     columna, divide entre el numero de filas que tiene, y compara
--     con lo que dicen las dos pantallas. Los tres numeros deben
--     coincidir.
--
--  3. PONDERADO, primero se promedia dentro de cada tipo (Examen,
--     Tarea, Foro) y luego se aplican los pesos del curso, saltando
--     los tipos que ese alumno no tenga.
--
--  4. Lo que NO aparece aqui NO cuenta. Una tarea entregada pero sin
--     calificar no sale, y eso es a proposito: a mitad de curso,
--     contarla como cero daria un numero que no significa nada.
--
--  QUE HACER SI ALGO NO CUADRA
--  · Las dos pantallas dan numeros distintos -> mandamelo, es un
--    error y es justo el que esto venia a eliminar.
--  · Falta una nota que si pusiste -> fijate si la entrega quedo sin
--    `calificado_en`, o si la respuesta del foro esta en un hilo que
--    no tiene activada la casilla de calificar.
--  · No sale ninguna fila -> ese curso todavia no tiene nada
--    calificado, o cambiaste mal el id del curso arriba.
--
--  PARA VER LA PONDERACION DEL CURSO
--    select id, titulo, ponderacion from public.cursos where id = 12;
-- =============================================================
