-- =============================================================
--  INDICADORES 1 — KPI POR PERFIL, CON LO QUE YA REGISTRA LA PLATAFORMA
--
--  QUÉ RESUELVE
--  El tablero de la organización (TABLERO_ORG) solo contesta a quien
--  ADMINISTRA la organización. Un rol de Dirección o Coordinación
--  —que tiene el permiso «indicadores.ver»— no veía ninguna cifra
--  global, y un docente solo podía mirar curso por curso.
--
--  QUÉ DEJA
--  1) kpi_mis_cursos(org)        Los cursos «a mi cargo». Una sola
--     regla para todos los informes:
--       · quien administra la organización: todos;
--       · un rol con «indicadores.ver» o «calificaciones.ver»: los de
--         su ámbito (sede/categoría) — Dirección, Coordinación;
--       · quien facilita: los suyos (por curso o por categoría).
--  2) kpi_cursos(org, días)      Una fila por curso con CONTEOS
--     (no porcentajes ya hechos), para que la pantalla pueda sumar
--     varios cursos sin promediar promedios.
--  3) kpi_personas(org, días)    Una fila por persona del equipo:
--     cuánto califica y en cuánto tiempo, qué tiene pendiente, cuánto
--     participa en el foro y cuántas listas pasa. Dirección y
--     Coordinación ven a todo su ámbito; un docente, solo a sí mismo.
--  4) indicadores_externos       Para lo que la plataforma no sabe
--     (ingresos, costos, horas contratadas…): cualquier sistema o una
--     carga de CSV deja aquí un valor con su área, curso, persona,
--     periodo y fuente, y el tablero lo muestra junto a los demás.
--
--  DE DÓNDE SALE CADA CIFRA (nada se captura a mano)
--  acceso (inscripción), progreso_usuario (avance y última
--  actividad), entregas (entregado_en / calificado_en / calificado_por),
--  intentos_examen, asistencia + sesiones + generaciones, foro_hilos +
--  foro_respuestas, constancias, leads_talleres (interesados).
--
--  SEGURO
--  Funciones de solo lectura (security definer, cada una se limita a
--  kpi_mis_cursos). Una tabla nueva y vacía. No cambia nada existente.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Requiere ROLES_5 (tiene_permiso), TAREAS_1,
--  ASISTENCIA y FORO (ya los tienes si el panel funciona).
-- =============================================================

-- -------------------------------------------------------------
-- 1) LOS CURSOS A MI CARGO
-- -------------------------------------------------------------
create or replace function public.kpi_mis_cursos(p_org bigint)
returns table (curso_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id::bigint
    from public.cursos c
   where (p_org is null or c.organizacion_id = p_org)
     and (
       public.es_admin_de(c.organizacion_id)
       or public.tiene_permiso('indicadores.ver', c.organizacion_id, null, c.categoria_id)
       or public.tiene_permiso('calificaciones.ver', c.organizacion_id, null, c.categoria_id)
       or exists (
         select 1 from public.facilitadores f
          where lower(f.email) = lower(auth.jwt() ->> 'email')
            and (f.curso_id = c.id
              or (f.categoria_id is not null and f.categoria_id = c.categoria_id)))
     )
$$;

revoke all on function public.kpi_mis_cursos(bigint) from public;
grant execute on function public.kpi_mis_cursos(bigint) to authenticated;

-- -------------------------------------------------------------
-- 2) UNA FILA POR CURSO
--    «Periodo» = los últimos p_días días (30 por omisión).
--    en_riesgo: inscrito hace más de 7 días, sin terminar y sin
--    actividad en 14 (la misma idea que las alertas de retención).
-- -------------------------------------------------------------
drop function if exists public.kpi_cursos(bigint, int);
create function public.kpi_cursos(p_org bigint, p_dias int default 30)
returns table (
  curso_id           bigint,
  titulo             text,
  alumnos            int,
  nuevos             int,
  activos_7          int,
  activos_periodo    int,
  avance_medio       numeric,
  terminados         int,
  en_riesgo          int,
  por_calificar      int,
  calificadas        int,
  horas_calificar    numeric,
  calificadas_7d     int,
  intentos           int,
  aprobados          int,
  asistencias        int,
  presentes          int,
  temas_foro         int,
  respuestas_periodo int,
  constancias        int,
  interesados        int,
  ultima_actividad   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with mis as (select k.curso_id from public.kpi_mis_cursos(p_org) k),
  desde as (select now() - make_interval(days => greatest(coalesce(p_dias, 30), 1)) as t),
  rec as (
    select m.curso_id::bigint as curso_id, r.id as recurso_id
      from public.modulos m
      join public.recursos r on r.modulo_id = m.id
     where m.curso_id in (select curso_id from mis) and coalesce(m.activo, true)
  ),
  tot as (select rec.curso_id, count(*)::numeric as total from rec group by rec.curso_id),
  prog as (
    select ac.curso_id::bigint as curso_id, ac.usuario_id, ac.created_at,
           count(distinct pu.recurso_id) filter (where pu.completado) as vistos,
           max(pu.ultimo_acceso) as ultimo
      from public.acceso ac
      left join rec on rec.curso_id = ac.curso_id
      left join public.progreso_usuario pu
             on pu.recurso_id = rec.recurso_id and pu.usuario_id = ac.usuario_id
     where ac.curso_id in (select curso_id from mis)
     group by ac.curso_id, ac.usuario_id, ac.created_at
  ),
  ins as (
    select p.curso_id,
           count(*)::int as alumnos,
           count(*) filter (where p.created_at >= (select t from desde))::int as nuevos,
           count(*) filter (where p.ultimo >= now() - interval '7 days')::int as activos_7,
           count(*) filter (where p.ultimo >= (select t from desde))::int as activos_periodo,
           round(avg(case when tot.total > 0 then least(1, p.vistos / tot.total) end) * 100, 1) as avance_medio,
           count(*) filter (where tot.total > 0 and p.vistos >= tot.total)::int as terminados,
           count(*) filter (where tot.total > 0 and p.vistos < tot.total
                              and p.created_at < now() - interval '7 days'
                              and coalesce(p.ultimo, p.created_at) < now() - interval '14 days')::int as en_riesgo,
           max(p.ultimo) as ultimo
      from prog p
      left join tot on tot.curso_id = p.curso_id
     group by p.curso_id
  ),
  ent as (
    select coalesce(t.curso_id, m.curso_id)::bigint as curso_id, e.entregado_en, e.calificado_en
      from public.entregas e
      join public.tareas t on t.id = e.tarea_id
      left join public.modulos m on m.id = t.modulo_id
     where coalesce(t.curso_id, m.curso_id) in (select curso_id from mis)
  ),
  entk as (
    select ent.curso_id,
           count(*) filter (where ent.calificado_en is null)::int as por_calificar,
           count(*) filter (where ent.calificado_en >= (select t from desde))::int as calificadas,
           round((avg(extract(epoch from (ent.calificado_en - ent.entregado_en)) / 3600)
                  filter (where ent.calificado_en >= (select t from desde)))::numeric, 1) as horas,
           count(*) filter (where ent.calificado_en >= (select t from desde)
                              and ent.calificado_en - ent.entregado_en <= interval '7 days')::int as a_tiempo,
           max(greatest(ent.entregado_en, ent.calificado_en)) as ultimo
      from ent
     group by ent.curso_id
  ),
  exa as (
    select coalesce(x.curso_id, m.curso_id)::bigint as curso_id,
           count(*)::int as intentos,
           count(*) filter (where i.aprobado)::int as aprobados,
           max(i.fecha) as ultimo
      from public.intentos_examen i
      join public.examenes x on x.id = i.examen_id
      left join public.modulos m on m.id = x.modulo_id
     where coalesce(x.curso_id, m.curso_id) in (select curso_id from mis)
       and i.fecha >= (select t from desde)
     group by 1
  ),
  asi as (
    select g.curso_id::bigint as curso_id,
           count(*)::int as asistencias,
           count(*) filter (where a.estado in ('presente', 'retardo'))::int as presentes
      from public.asistencia a
      join public.sesiones s on s.id = a.sesion_id
      join public.generaciones g on g.id = s.generacion_id
     where g.curso_id in (select curso_id from mis)
       and a.registrado_en >= (select t from desde)
     group by 1
  ),
  foro as (
    select h.curso_id::bigint as curso_id,
           count(distinct h.id)::int as temas,
           count(r.id) filter (where r.creado_en >= (select t from desde)
                                 and not coalesce(r.borrada, false))::int as resp,
           max(greatest(h.creado_en, r.creado_en)) as ultimo
      from public.foro_hilos h
      left join public.foro_respuestas r on r.hilo_id = h.id
     where h.curso_id in (select curso_id from mis)
     group by 1
  ),
  con as (
    select co.curso_id::bigint as curso_id, count(*)::int as n
      from public.constancias co
     where co.curso_id in (select curso_id from mis)
       and co.fecha_emision >= (select t from desde)
     group by 1
  ),
  lea as (
    select l.curso_id::bigint as curso_id, count(*)::int as n
      from public.leads_talleres l
     where l.curso_id in (select curso_id from mis)
       and l.creado_en >= (select t from desde)
     group by 1
  )
  select c.id::bigint, c.titulo,
         coalesce(ins.alumnos, 0), coalesce(ins.nuevos, 0),
         coalesce(ins.activos_7, 0), coalesce(ins.activos_periodo, 0),
         ins.avance_medio, coalesce(ins.terminados, 0), coalesce(ins.en_riesgo, 0),
         coalesce(entk.por_calificar, 0), coalesce(entk.calificadas, 0), entk.horas,
         coalesce(entk.a_tiempo, 0),
         coalesce(exa.intentos, 0), coalesce(exa.aprobados, 0),
         coalesce(asi.asistencias, 0), coalesce(asi.presentes, 0),
         coalesce(foro.temas, 0), coalesce(foro.resp, 0),
         coalesce(con.n, 0), coalesce(lea.n, 0),
         greatest(ins.ultimo, entk.ultimo, exa.ultimo, foro.ultimo)
    from public.cursos c
    join mis on mis.curso_id = c.id
    left join ins  on ins.curso_id  = c.id
    left join entk on entk.curso_id = c.id
    left join exa  on exa.curso_id  = c.id
    left join asi  on asi.curso_id  = c.id
    left join foro on foro.curso_id = c.id
    left join con  on con.curso_id  = c.id
    left join lea  on lea.curso_id  = c.id
   order by c.orden, c.titulo
$$;

revoke all on function public.kpi_cursos(bigint, int) from public;
grant execute on function public.kpi_cursos(bigint, int) to authenticated;

-- -------------------------------------------------------------
-- 3) UNA FILA POR PERSONA DEL EQUIPO
--    Equipo = quien facilita algún curso a mi cargo, quien calificó
--    entregas en ellos o quien pasó lista. Los alumnos no salen aquí.
-- -------------------------------------------------------------
drop function if exists public.kpi_personas(bigint, int);
create function public.kpi_personas(p_org bigint, p_dias int default 30)
returns table (
  email            text,
  nombre           text,
  cursos           int,
  calificadas      int,
  horas_calificar  numeric,
  por_calificar    int,
  respuestas_foro  int,
  asistencias      int,
  ultima_actividad timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_yo    text := lower(auth.jwt() ->> 'email');
  v_desde timestamptz := now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));
  v_todo  boolean;
begin
  -- Ver a todo el equipo: quien administra, o quien tiene
  -- «indicadores.ver» en algún curso a su cargo. Si no, solo a sí mismo.
  v_todo := public.es_admin_de(p_org) or exists (
    select 1 from public.cursos c
     where c.id in (select k.curso_id from public.kpi_mis_cursos(p_org) k)
       and public.tiene_permiso('indicadores.ver', c.organizacion_id, null, c.categoria_id));

  return query
  with mis as (select k.curso_id from public.kpi_mis_cursos(p_org) k),
  fac as (
    select lower(f.email) as email, count(distinct c.id)::int as cursos
      from public.facilitadores f
      join public.cursos c
        on c.id = f.curso_id or (f.categoria_id is not null and c.categoria_id = f.categoria_id)
     where c.id in (select curso_id from mis)
     group by 1
  ),
  ent as (
    select lower(u.email) as email, e.entregado_en, e.calificado_en
      from public.entregas e
      join public.tareas t on t.id = e.tarea_id
      left join public.modulos m on m.id = t.modulo_id
      join auth.users u on u.id = e.calificado_por
     where coalesce(t.curso_id, m.curso_id) in (select curso_id from mis)
       and e.calificado_en >= v_desde
  ),
  entk as (
    select ent.email, count(*)::int as n,
           round((avg(extract(epoch from (ent.calificado_en - ent.entregado_en)) / 3600))::numeric, 1) as horas,
           max(ent.calificado_en) as ultimo
      from ent group by ent.email
  ),
  pend as (
    select lower(f.email) as email, count(distinct e.id)::int as n
      from public.entregas e
      join public.tareas t on t.id = e.tarea_id
      left join public.modulos m on m.id = t.modulo_id
      join public.facilitadores f on f.curso_id = coalesce(t.curso_id, m.curso_id)
     where e.calificado_en is null
       and coalesce(t.curso_id, m.curso_id) in (select curso_id from mis)
     group by 1
  ),
  foro as (
    select lower(r.autor_email) as email, count(*)::int as n, max(r.creado_en) as ultimo
      from public.foro_respuestas r
      join public.foro_hilos h on h.id = r.hilo_id
     where h.curso_id in (select curso_id from mis)
       and r.creado_en >= v_desde
       and not coalesce(r.borrada, false)
     group by 1
  ),
  asi as (
    select lower(a.registrado_por) as email, count(*)::int as n, max(a.registrado_en) as ultimo
      from public.asistencia a
      join public.sesiones s on s.id = a.sesion_id
      join public.generaciones g on g.id = s.generacion_id
     where g.curso_id in (select curso_id from mis)
       and a.registrado_en >= v_desde
       and a.registrado_por is not null
     group by 1
  ),
  gente as (
    select fac.email from fac
    union select entk.email from entk
    union select asi.email from asi
  )
  select g.email, p.nombre_completo,
         coalesce(fac.cursos, 0), coalesce(entk.n, 0), entk.horas, coalesce(pend.n, 0),
         coalesce(foro.n, 0), coalesce(asi.n, 0),
         greatest(entk.ultimo, foro.ultimo, asi.ultimo)
    from gente g
    left join fac  on fac.email  = g.email
    left join entk on entk.email = g.email
    left join pend on pend.email = g.email
    left join foro on foro.email = g.email
    left join asi  on asi.email  = g.email
    left join auth.users u on lower(u.email) = g.email
    left join public.perfiles p on p.id = u.id
   where v_todo or g.email = v_yo
   order by coalesce(pend.n, 0) desc, g.email;
end $$;

revoke all on function public.kpi_personas(bigint, int) from public;
grant execute on function public.kpi_personas(bigint, int) to authenticated;

-- -------------------------------------------------------------
-- 4) INDICADORES EXTERNOS: el enchufe para lo que la plataforma no sabe
--
--    Ejemplos de `clave`: ingresos, costo_docente, becas,
--    horas_contratadas, presupuesto. `curso_id` y `persona_email` son
--    opcionales: un valor puede ser de toda la organización, de un
--    curso o de una persona. `fuente` dice de dónde vino ('manual',
--    'csv', 'api:contabilidad'…), para saber en qué confiar.
-- -------------------------------------------------------------
create table if not exists public.indicadores_externos (
  id              bigint generated by default as identity primary key,
  organizacion_id bigint references public.organizaciones(id) on delete cascade,
  curso_id        integer references public.cursos(id) on delete cascade,
  persona_email   text,
  area            text not null default 'General',
  clave           text not null check (length(clave) between 1 and 80),
  etiqueta        text not null,
  valor           numeric not null,
  unidad          text,
  periodo         date not null default current_date,
  fuente          text not null default 'manual',
  creado_en       timestamptz not null default now()
);

create index if not exists indicadores_externos_org_idx
  on public.indicadores_externos (organizacion_id, periodo desc);

alter table public.indicadores_externos enable row level security;

drop policy if exists "indicadores_externos_leer" on public.indicadores_externos;
create policy "indicadores_externos_leer" on public.indicadores_externos
  for select to authenticated
  using (
    public.es_admin_de(organizacion_id)
    or public.tiene_permiso('indicadores.ver', organizacion_id)
  );

drop policy if exists "indicadores_externos_escribir" on public.indicadores_externos;
create policy "indicadores_externos_escribir" on public.indicadores_externos
  for all to authenticated
  using (public.es_admin_de(organizacion_id))
  with check (public.es_admin_de(organizacion_id));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA (como dueño del SQL Editor no hay sesión, así que solo
-- comprueba que todo existe; las cifras se ven en el Centro).
-- RESULTADO ESPERADO: 3 funciones y 1 tabla.
-- -------------------------------------------------------------
select 'funciones' as que, count(*)::text as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('kpi_mis_cursos', 'kpi_cursos', 'kpi_personas')
union all
select 'tabla indicadores_externos', count(*)::text
  from information_schema.tables
 where table_schema = 'public' and table_name = 'indicadores_externos';
