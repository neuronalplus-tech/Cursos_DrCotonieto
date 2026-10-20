-- 20b: RPCs complementarios + superview: estado, casos asignados, etc.
drop function if exists public.pasmu_expediente_estado(bigint);

create or replace function public.pasmu_expediente_estado(p_caso_id bigint)
returns table (caso_id bigint, estado_actual text, ultima_actividad text, ultima_actividad_en timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select c.id, c.estado_actual, 'expediente abierto' as ultima_actividad, c.creado_en as ultima_actividad_en
  from public.expediente_caso c where c.id = p_caso_id
$$;

drop function if exists public.pasmu_casos_del_usuario(bigint);

create or replace function public.pasmu_casos_del_usuario(p_unidad_id bigint default null)
returns table (id bigint, folio text, nombre_completo text, estado_actual text)
language sql security definer set search_path = public, pg_temp as $$
  select c.id, c.folio, c.nombre_completo, c.estado_actual
  from public.expediente_caso c
  where c.creado_por = current_setting('request.jwt.claims')::uuid
    and (p_unidad_id is null or true)
$$;

commit;
