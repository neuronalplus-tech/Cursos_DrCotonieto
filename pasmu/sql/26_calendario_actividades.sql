-- PASMU 26: calendario de actividades dirigido por grupo e instituto.
-- Solo PRUEBAS. Idempotente. Requiere 24 y 25 aplicados.
--
-- Reglas (las decide la base, no la pantalla):
--   * La administración global publica actividades globales y puede dirigirlas por grupo y por unidad.
--   * Cada unidad publica para su propio equipo; nunca para personas usuarias.
--   * Las personas usuarias reciben únicamente actividades globales marcadas para ellas.
--   * Dirección PASMU y administración global ven todo.
begin;

create table if not exists public.actividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 4 and 120),
  tipo text not null check (tipo in ('actividad', 'conferencia', 'difusion', 'capacitacion', 'reunion')),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  ambito text not null check (ambito in ('global', 'unidad')),
  unidad_id bigint references public.unidades(id) on delete cascade,
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  check ((ambito = 'global' and unidad_id is null) or (ambito = 'unidad' and unidad_id is not null))
);
create index if not exists idx_actividades_fecha on public.actividades (fecha);

create table if not exists public.actividad_audiencia (
  actividad_id uuid not null references public.actividades(id) on delete cascade,
  grupo text not null check (grupo in ('responsables', 'administrativos', 'terapeutas', 'usuarios')),
  primary key (actividad_id, grupo)
);

-- Si una actividad global se dirige a ciertas unidades, se listan aquí; vacío = todas.
create table if not exists public.actividad_unidades (
  actividad_id uuid not null references public.actividades(id) on delete cascade,
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  primary key (actividad_id, unidad_id)
);

create or replace function private.pasmu_audiencia_valida()
returns trigger
language plpgsql
as $$
begin
  if new.grupo = 'usuarios'
     and exists (select 1 from public.actividades a where a.id = new.actividad_id and a.ambito <> 'global') then
    raise exception 'Las personas usuarias solo reciben actividades globales.' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_actividad_audiencia_valida on public.actividad_audiencia;
create trigger trg_actividad_audiencia_valida before insert or update on public.actividad_audiencia
  for each row execute function private.pasmu_audiencia_valida();

-- Grupos de calendario a los que pertenece quien consulta.
create or replace function private.pasmu_mis_grupos()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct g), '{}')
  from (
    select case r.codigo
             when 'responsable_unidad' then 'responsables'
             when 'coordinador_clinico' then 'responsables'
             when 'supervisor_clinico' then 'responsables'
             when 'clinico_administrativo' then 'administrativos'
             when 'tutoria' then 'administrativos'
             when 'terapeuta' then 'terapeutas'
             when 'coterapeuta' then 'terapeutas'
             when 'tallerista' then 'terapeutas'
           end as g
    from public.miembros m
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    where p.auth_user_id = (select auth.uid())
      and p.activo and m.activo and r.activo
      and m.fecha_inicio <= current_date and (m.fecha_fin is null or m.fecha_fin >= current_date)
    union all
    select 'usuarios'
    where exists (
      select 1 from public.personas_usuarias pu
      where pu.persona_id = private.pasmu_current_persona_id()
    )
  ) x
  where g is not null
$$;

create or replace function private.pasmu_ve_todo_el_calendario()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles())
$$;

create or replace function private.pasmu_actividad_visible(_actividad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pasmu_ve_todo_el_calendario()
    -- Quien publica o administra el calendario de la unidad siempre ve lo que publicó.
    or exists (
      select 1 from public.actividades a
      where a.id = _actividad_id
        and (a.creada_por = private.pasmu_current_persona_id()
             or (a.ambito = 'unidad' and private.pasmu_has_permission('calendario.unidad', a.unidad_id))))
    or exists (
      select 1
      from public.actividades a
      join public.actividad_audiencia au on au.actividad_id = a.id
      where a.id = _actividad_id
        and au.grupo = any (private.pasmu_mis_grupos())
        and (
          case
            when au.grupo = 'usuarios' then
              a.ambito = 'global' and (
                not exists (select 1 from public.actividad_unidades t where t.actividad_id = a.id)
                or exists (
                  select 1
                  from public.actividad_unidades t
                  join public.casos c on c.unidad_id = t.unidad_id
                  join public.personas_usuarias pu on pu.id = c.persona_usuaria_id
                  where t.actividad_id = a.id and pu.persona_id = private.pasmu_current_persona_id()))
            when a.ambito = 'unidad' then private.pasmu_is_unit_member(a.unidad_id)
            else
              not exists (select 1 from public.actividad_unidades t where t.actividad_id = a.id)
              or exists (select 1 from public.actividad_unidades t
                         where t.actividad_id = a.id and private.pasmu_is_unit_member(t.unidad_id))
          end)
    )
$$;

alter table public.actividades enable row level security;
alter table public.actividad_audiencia enable row level security;
alter table public.actividad_unidades enable row level security;
revoke all on table public.actividades, public.actividad_audiencia, public.actividad_unidades from public, anon, authenticated;
grant select on table public.actividades, public.actividad_audiencia, public.actividad_unidades to authenticated;

drop policy if exists actividades_read on public.actividades;
create policy actividades_read on public.actividades for select to authenticated
  using (private.pasmu_actividad_visible(id));
drop policy if exists actividad_audiencia_read on public.actividad_audiencia;
create policy actividad_audiencia_read on public.actividad_audiencia for select to authenticated
  using (private.pasmu_actividad_visible(actividad_id));
drop policy if exists actividad_unidades_read on public.actividad_unidades;
create policy actividad_unidades_read on public.actividad_unidades for select to authenticated
  using (private.pasmu_actividad_visible(actividad_id));

-- ——— RPC: publicar y eliminar actividades ———
create or replace function public.pasmu_actividad_crear(
  _titulo text, _tipo text, _fecha date, _hora_inicio time, _hora_fin time,
  _ambito text, _unidad_id bigint, _grupos text[], _unidades bigint[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_id uuid;
  v_grupo text;
  v_unidad bigint;
begin
  if v_persona is null then raise exception 'Perfil PASMU activo requerido.' using errcode = '42501'; end if;
  if _ambito = 'global' then
    if not private.pasmu_es_admin_global() then
      raise exception 'Solo la administración global publica actividades globales.' using errcode = '42501';
    end if;
    if _unidad_id is not null then raise exception 'Una actividad global no lleva unidad.' using errcode = '22023'; end if;
  elsif _ambito = 'unidad' then
    if _unidad_id is null or not (private.pasmu_es_admin_global() or private.pasmu_has_permission('calendario.unidad', _unidad_id)) then
      raise exception 'Solo puedes publicar actividades de tu unidad.' using errcode = '42501';
    end if;
  else
    raise exception 'Ámbito no válido.' using errcode = '22023';
  end if;
  if _grupos is null or cardinality(_grupos) = 0 then
    raise exception 'Elige al menos un grupo que verá la actividad.' using errcode = '22023';
  end if;
  insert into public.actividades (titulo, tipo, fecha, hora_inicio, hora_fin, ambito, unidad_id, creada_por)
  values (btrim(_titulo), _tipo, _fecha, _hora_inicio, _hora_fin, _ambito, _unidad_id, v_persona)
  returning id into v_id;
  foreach v_grupo in array _grupos loop
    insert into public.actividad_audiencia (actividad_id, grupo) values (v_id, v_grupo) on conflict do nothing;
  end loop;
  if _ambito = 'global' and _unidades is not null then
    foreach v_unidad in array _unidades loop
      insert into public.actividad_unidades (actividad_id, unidad_id) values (v_id, v_unidad) on conflict do nothing;
    end loop;
  end if;
  return v_id;
end;
$$;

create or replace function public.pasmu_actividad_eliminar(_actividad_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.actividades%rowtype;
begin
  select * into a from public.actividades where id = _actividad_id;
  if a.id is null then raise exception 'La actividad no existe.' using errcode = '22023'; end if;
  if not (private.pasmu_es_admin_global()
          or (a.ambito = 'unidad' and private.pasmu_has_permission('calendario.unidad', a.unidad_id))) then
    raise exception 'No puedes eliminar esta actividad.' using errcode = '42501';
  end if;
  delete from public.actividades where id = _actividad_id;
end;
$$;

-- ——— lectura: el calendario del equipo (invoker: aplica la RLS de actividades y de agenda) ———
create or replace function public.pasmu_calendario(_desde date, _hasta date)
returns table (clase text, id text, titulo text, fecha date, inicio time, fin time, ambito text, unidad_id bigint, estado text)
language sql
stable
set search_path = ''
as $$
  select 'actividad', a.id::text, a.titulo, a.fecha, a.hora_inicio, a.hora_fin, a.ambito, a.unidad_id, null::text
  from public.actividades a
  where a.fecha between _desde and _hasta
  union all
  select 'sesion', g.id::text, 'Sesión', (g.fecha_inicio at time zone 'America/Mexico_City')::date,
         (g.fecha_inicio at time zone 'America/Mexico_City')::time, (g.fecha_fin at time zone 'America/Mexico_City')::time,
         'unidad', g.unidad_id, g.estado
  from public.agenda g
  where (g.fecha_inicio at time zone 'America/Mexico_City')::date between _desde and _hasta
  order by 4, 5
$$;

-- Citas de la persona usuaria: solo fecha, hora y estado (nunca motivo ni observaciones de la agenda).
create or replace function public.pasmu_mis_citas(_desde date default current_date, _hasta date default current_date + 60)
returns table (id bigint, fecha date, inicio time, fin time, estado text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, (g.fecha_inicio at time zone 'America/Mexico_City')::date,
         (g.fecha_inicio at time zone 'America/Mexico_City')::time, (g.fecha_fin at time zone 'America/Mexico_City')::time, g.estado
  from public.agenda g
  where g.caso_id is not null and private.pasmu_soy_persona_del_caso(g.caso_id)
    and (g.fecha_inicio at time zone 'America/Mexico_City')::date between _desde and _hasta
  order by 2, 3
$$;

revoke all on function private.pasmu_mis_grupos() from public, anon;
revoke all on function private.pasmu_ve_todo_el_calendario() from public, anon;
revoke all on function private.pasmu_actividad_visible(uuid) from public, anon;
revoke all on function private.pasmu_audiencia_valida() from public, anon, authenticated;
grant execute on function private.pasmu_mis_grupos() to authenticated;
grant execute on function private.pasmu_ve_todo_el_calendario() to authenticated;
grant execute on function private.pasmu_actividad_visible(uuid) to authenticated;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pasmu_actividad_crear(text, text, date, time, time, text, bigint, text[], bigint[])',
    'public.pasmu_actividad_eliminar(uuid)',
    'public.pasmu_calendario(date, date)',
    'public.pasmu_mis_citas(date, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;
