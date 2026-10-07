-- =============================================================
--  TABLERO DE LA ORGANIZACIÓN
--
--  QUÉ RESUELVE
--  El director de una institución no necesita el detalle de un
--  curso: necesita saber cómo va su institución. Hoy tiene el panel
--  de progreso, que contesta "cómo va este curso", y nada que
--  conteste "cómo va lo mío". Eso es justamente lo que justifica el
--  precio que le cobras: las funciones de aula las tiene cualquiera.
--
--  QUÉ HACE
--  Dos funciones de solo lectura: los totales de la organización y
--  una fila por curso.
--
--  POR QUÉ EN LA BASE Y NO EN EL NAVEGADOR
--  Calcular el avance medio exige cruzar progreso, recursos,
--  módulos y accesos de toda la organización. Traerse eso al
--  navegador para sumarlo son cientos de miles de filas por la red
--  para mostrar un número de dos dígitos. Postgres lo hace donde
--  están los datos.
--
--  SEGURIDAD
--  Son `security definer` para poder contar por encima de las
--  políticas de lectura, y por eso cada una comprueba `es_admin_de`
--  ANTES de devolver nada. Sin esa comprobación, cualquiera con
--  sesión podría pedir el tablero de otro cliente.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ORGANIZACIONES_1_BASE y TAREAS_1_BASE.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LOS TOTALES
--
--    "Activo" se define como haber tocado algo en 30 días. Es una
--    convención, no una verdad: conviene que la misma cifra
--    signifique lo mismo en el tablero y en los reportes, así que
--    vive aquí y no en cada pantalla.
-- -------------------------------------------------------------
create or replace function public.tablero_organizacion(p_org bigint)
returns table (
  alumnos            int,
  alumnos_activos    int,
  inscripciones      int,
  cursos             int,
  facilitadores      int,
  generaciones       int,
  por_calificar      int,
  constancias        int,
  avance_medio       numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_de(p_org) then
    raise exception 'No administras esa organización.' using errcode = '42501';
  end if;

  return query
  with cursos_org as (
    select c.id from public.cursos c where c.organizacion_id = p_org
  ),
  -- Recursos que cuentan para el avance de cada curso.
  recursos_curso as (
    select m.curso_id, count(r.id)::numeric as total
    from public.modulos m
    join public.recursos r on r.modulo_id = m.id
    where m.curso_id in (select id from cursos_org)
      and coalesce(m.activo, true)
    group by m.curso_id
  ),
  -- Avance de cada inscripción: lo visto sobre lo que hay.
  avance_inscripcion as (
    select
      ac.usuario_id,
      ac.curso_id,
      case when rc.total > 0
           then least(1.0, count(distinct pu.recurso_id)::numeric / rc.total)
           else null end as fraccion
    from public.acceso ac
    join recursos_curso rc on rc.curso_id = ac.curso_id
    left join public.modulos m on m.curso_id = ac.curso_id
    left join public.recursos r on r.modulo_id = m.id
    left join public.progreso_usuario pu
           on pu.recurso_id = r.id
          and pu.usuario_id = ac.usuario_id
          and pu.completado
    where ac.curso_id in (select id from cursos_org)
    group by ac.usuario_id, ac.curso_id, rc.total
  )
  select
    (select count(distinct ac.usuario_id)::int from public.acceso ac
      where ac.curso_id in (select id from cursos_org)),

    (select count(distinct pu.usuario_id)::int
       from public.progreso_usuario pu
       join public.recursos r on r.id = pu.recurso_id
       join public.modulos m on m.id = r.modulo_id
      where m.curso_id in (select id from cursos_org)
        and pu.ultimo_acceso > now() - interval '30 days'),

    (select count(*)::int from public.acceso ac
      where ac.curso_id in (select id from cursos_org)),

    (select count(*)::int from cursos_org),

    (select count(distinct lower(f.email))::int
       from public.facilitadores f
      where f.curso_id in (select id from cursos_org)
         or exists (select 1 from public.categorias k
                     where k.id = f.categoria_id and k.organizacion_id = p_org)),

    (select count(*)::int from public.generaciones g
      where g.curso_id in (select id from cursos_org)),

    (select count(*)::int
       from public.entregas e
       join public.tareas t on t.id = e.tarea_id
      where e.calificado_en is null
        and (t.curso_id in (select id from cursos_org)
          or exists (select 1 from public.modulos m
                      where m.id = t.modulo_id
                        and m.curso_id in (select id from cursos_org)))),

    (select count(*)::int from public.constancias co
      where co.curso_id in (select id from cursos_org)),

    (select round(coalesce(avg(fraccion), 0) * 100, 1) from avance_inscripcion);
end $$;

revoke all on function public.tablero_organizacion(bigint) from public;
grant execute on function public.tablero_organizacion(bigint) to authenticated;

-- -------------------------------------------------------------
-- 2) UNA FILA POR CURSO
--
--    El director quiere ver de un vistazo cuál programa avanza y
--    cuál se atoró. `ultima_actividad` es lo que delata a un curso
--    abandonado mejor que el avance medio: un curso con 40% y
--    movimiento ayer está vivo; uno con 40% y nada desde hace tres
--    meses, no.
-- -------------------------------------------------------------
create or replace function public.tablero_cursos(p_org bigint)
returns table (
  curso_id         bigint,
  titulo           text,
  alumnos          int,
  avance_medio     numeric,
  terminados       int,
  por_calificar    int,
  constancias      int,
  ultima_actividad timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_de(p_org) then
    raise exception 'No administras esa organización.' using errcode = '42501';
  end if;

  return query
  with cursos_org as (
    select c.id, c.titulo from public.cursos c where c.organizacion_id = p_org
  ),
  recursos_curso as (
    select m.curso_id, count(r.id)::numeric as total
    from public.modulos m
    join public.recursos r on r.modulo_id = m.id
    where m.curso_id in (select id from cursos_org)
      and coalesce(m.activo, true)
    group by m.curso_id
  ),
  avance_inscripcion as (
    select
      ac.curso_id,
      ac.usuario_id,
      case when rc.total > 0
           then least(1.0, count(distinct pu.recurso_id)::numeric / rc.total)
           else 0 end as fraccion
    from public.acceso ac
    left join recursos_curso rc on rc.curso_id = ac.curso_id
    left join public.modulos m on m.curso_id = ac.curso_id
    left join public.recursos r on r.modulo_id = m.id
    left join public.progreso_usuario pu
           on pu.recurso_id = r.id
          and pu.usuario_id = ac.usuario_id
          and pu.completado
    where ac.curso_id in (select id from cursos_org)
    group by ac.curso_id, ac.usuario_id, rc.total
  )
  select
    co.id,
    co.titulo,
    (select count(distinct ac.usuario_id)::int from public.acceso ac
      where ac.curso_id = co.id),
    (select round(coalesce(avg(ai.fraccion), 0) * 100, 1)
       from avance_inscripcion ai where ai.curso_id = co.id),
    (select count(*)::int from avance_inscripcion ai
      where ai.curso_id = co.id and ai.fraccion >= 1),
    (select count(*)::int
       from public.entregas e
       join public.tareas t on t.id = e.tarea_id
      where e.calificado_en is null
        and (t.curso_id = co.id
          or exists (select 1 from public.modulos m
                      where m.id = t.modulo_id and m.curso_id = co.id))),
    (select count(*)::int from public.constancias c2 where c2.curso_id = co.id),
    (select max(pu.ultimo_acceso)
       from public.progreso_usuario pu
       join public.recursos r on r.id = pu.recurso_id
       join public.modulos m on m.id = r.modulo_id
      where m.curso_id = co.id)
  from cursos_org co
  order by co.titulo;
end $$;

revoke all on function public.tablero_cursos(bigint) from public;
grant execute on function public.tablero_cursos(bigint) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 3) COMPROBACIÓN
--
--    Se ejecuta sobre TU organización, así que además de confirmar
--    que las funciones existen te enseña tus propios números.
-- -------------------------------------------------------------
select * from public.tablero_organizacion(
  (select id from public.organizaciones where slug = 'cotonieto')
);

-- =============================================================
--  RESULTADO ESPERADO
--  Una fila con tus cifras. Lo que conviene mirar:
--
--  · alumnos        = personas distintas con acceso a algo tuyo
--  · alumnos_activos= las que tocaron algo en 30 dias
--  · avance_medio   = promedio del avance de cada inscripcion
--  · por_calificar  = entregas que esperan tu calificacion
--
--  Si "alumnos" sale 0 y sabes que tienes alumnos, lo mas probable
--  es que tus cursos no tengan organizacion_id: corre
--  ORGANIZACIONES_1_BASE.sql otra vez, que es idempotente y los
--  asigna.
--
--  UNA LIMITACION HONESTA
--  "Activo" y "avance" se miden sobre `progreso_usuario`, que se
--  llena cuando alguien marca un recurso como visto. Quien lee todo
--  sin marcar nada aparece inactivo. Es la misma medida que ya usa
--  el panel de progreso, asi que al menos las dos pantallas
--  coinciden; pero no la presentes a un cliente como "tiempo de
--  conexion", porque no lo es.
-- =============================================================
