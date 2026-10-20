-- PASMU 44: configuración compartida de la plataforma + gestión de accesos a la versión DEMO.
-- Solo PRUEBAS. Idempotente. Requiere 24 (helpers private.*) y 42 (unidad DEMO y rol experiencia_demo).
--
-- 1) plataforma_estado: una sola fila 'global' con la misma configuración que usa la DEMO en el navegador
--    (instituciones, metas, catálogo de indicadores, personal, hojas membretadas, permisos por rol…).
--    Lectura: personal con membresía vigente. Escritura: solo por pasmu_guardar_plataforma (control de versión).
-- 2) Accesos DEMO: Dirección PASMU (o administración global) registra, lista y revoca cuentas con rol
--    experiencia_demo en la unidad DEMO, con vigencia (fecha_fin).
begin;

-- ——— quién puede leer / escribir la plataforma compartida ———
create or replace function private.pasmu_puede_plataforma(_escritura boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pasmu_es_admin_global()
    or private.pasmu_mis_roles() && array[
      'direccion_pasmu', 'responsable_unidad', 'coordinador_clinico', 'supervisor_clinico',
      'clinico_administrativo', 'practicante', 'tallerista', 'terapeuta'
    ]::text[]
$$;
revoke all on function private.pasmu_puede_plataforma(boolean) from public, anon;
grant execute on function private.pasmu_puede_plataforma(boolean) to authenticated;

create table if not exists public.plataforma_estado (
  clave text primary key,
  estado jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  actualizado_por uuid references public.personas(id) on delete set null,
  actualizado_en timestamptz not null default now()
);
alter table public.plataforma_estado enable row level security;
revoke all on table public.plataforma_estado from public, anon, authenticated;
grant select on table public.plataforma_estado to authenticated;
drop policy if exists plataforma_estado_lectura on public.plataforma_estado;
create policy plataforma_estado_lectura on public.plataforma_estado
  for select to authenticated using (private.pasmu_puede_plataforma(false));

create or replace function public.pasmu_guardar_plataforma(_estado jsonb, _version bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_yo uuid := private.pasmu_current_persona_id(); v_nueva bigint;
begin
  if v_yo is null or not private.pasmu_puede_plataforma(true) then
    raise exception 'Sin permiso para guardar la configuración de la plataforma.' using errcode = '42501'; end if;
  if _estado is null or jsonb_typeof(_estado) <> 'object' then
    raise exception 'El estado de la plataforma no es válido.' using errcode = '22023'; end if;
  if pg_column_size(_estado) > 12 * 1024 * 1024 then
    raise exception 'El estado de la plataforma excede el tamaño permitido.' using errcode = '22023'; end if;

  insert into public.plataforma_estado as pe (clave, estado, version, actualizado_por)
  values ('global', _estado, 1, v_yo)
  on conflict (clave) do update
    set estado = excluded.estado, version = pe.version + 1, actualizado_por = v_yo, actualizado_en = now()
    where pe.version = _version
  returning pe.version into v_nueva;

  if v_nueva is null then
    raise exception 'Conflicto de versión: la configuración cambió desde otra sesión.' using errcode = '40001'; end if;
  perform private.pasmu_auditar(null, 'plataforma_estado', 'global', 'UPDATE', jsonb_build_object('version', v_nueva));
  return v_nueva;
end $$;
revoke all on function public.pasmu_guardar_plataforma(jsonb, bigint) from public, anon;
grant execute on function public.pasmu_guardar_plataforma(jsonb, bigint) to authenticated;

-- ——— accesos a la versión DEMO ———
create or replace function public.pasmu_puede_gestionar_demo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles())
$$;
revoke all on function public.pasmu_puede_gestionar_demo() from public, anon;
grant execute on function public.pasmu_puede_gestionar_demo() to authenticated;

-- Perfiles (vistas) que puede explorar cada acceso DEMO. Lista vacía = todos. Solo se lee/escribe por las funciones de abajo.
create table if not exists public.acceso_demo_perfiles (
  miembro_id bigint primary key references public.miembros(id) on delete cascade,
  perfiles text[] not null default '{}'::text[]
);
alter table public.acceso_demo_perfiles enable row level security;
revoke all on table public.acceso_demo_perfiles from public, anon, authenticated;

drop function if exists public.pasmu_registrar_acceso_demo(text, text, integer);
drop function if exists public.pasmu_listar_accesos_demo();

-- Vincula una cuenta de Auth ya creada (con la contraseña que usted asigna) a la unidad DEMO con vigencia.
create or replace function public.pasmu_registrar_acceso_demo(_email text, _nombre text, _dias integer default 30, _perfiles text[] default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correo text := lower(btrim(_email));
  v_nombre text := btrim(_nombre);
  v_auth uuid; v_persona uuid; v_unidad bigint; v_rol bigint; v_miembro bigint;
begin
  if not public.pasmu_puede_gestionar_demo() then
    raise exception 'Solo Dirección PASMU gestiona los accesos DEMO.' using errcode = '42501'; end if;
  if v_correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'El correo no es válido.' using errcode = '22023'; end if;
  if char_length(v_nombre) < 2 then raise exception 'Escribe el nombre de la persona.' using errcode = '22023'; end if;
  if _dias is null or _dias < 1 or _dias > 365 then
    raise exception 'La vigencia debe estar entre 1 y 365 días.' using errcode = '22023'; end if;

  if exists (select 1 from unnest(coalesce(_perfiles, '{}'::text[])) p where p !~ '^[A-Za-z0-9]{2,40}$') then
    raise exception 'La lista de perfiles no es válida.' using errcode = '22023'; end if;

  select id into v_auth from auth.users where lower(email) = v_correo limit 1;
  if v_auth is null then
    raise exception 'No existe una cuenta de Auth con ese correo. Créala primero (con su contraseña) y vuelve a registrar el acceso.' using errcode = 'P0002'; end if;
  select id into v_unidad from public.unidades where codigo = 'DEMO';
  select id into v_rol from public.roles where codigo = 'experiencia_demo' and activo;
  if v_unidad is null or v_rol is null then
    raise exception 'Falta aplicar el script 42 (unidad DEMO y rol experiencia_demo).' using errcode = 'P0002'; end if;

  select id into v_persona from public.personas where auth_user_id = v_auth;
  if v_persona is null then
    insert into public.personas (auth_user_id, nombre, apellidos, email)
    values (v_auth, split_part(v_nombre, ' ', 1), coalesce(nullif(btrim(substr(v_nombre, strpos(v_nombre, ' ') + 1)), ''), '-'), v_correo)
    returning id into v_persona;
  end if;
  -- Una cuenta DEMO no debe acumular membresías institucionales.
  if exists (select 1 from public.miembros m join public.roles r on r.id = m.rol_id
             where m.persona_id = v_persona and m.activo and r.codigo <> 'experiencia_demo') then
    raise exception 'Esa cuenta ya es institucional; usa otra cuenta para la DEMO.' using errcode = '22023'; end if;

  select id into v_miembro from public.miembros where persona_id = v_persona and unidad_id = v_unidad and rol_id = v_rol limit 1;
  if v_miembro is null then
    insert into public.miembros (persona_id, unidad_id, rol_id, fecha_inicio, fecha_fin, activo)
    values (v_persona, v_unidad, v_rol, current_date, current_date + _dias, true) returning id into v_miembro;
  else
    update public.miembros set activo = true, fecha_inicio = current_date, fecha_fin = current_date + _dias where id = v_miembro;
  end if;
  insert into public.acceso_demo_perfiles (miembro_id, perfiles)
  values (v_miembro, coalesce(_perfiles, '{}'::text[]))
  on conflict (miembro_id) do update set perfiles = excluded.perfiles;
  perform private.pasmu_auditar(v_unidad, 'miembros', v_miembro::text, 'INSERT',
    jsonb_build_object('rol', 'experiencia_demo', 'dias', _dias, 'perfiles', coalesce(_perfiles, '{}'::text[])));
  return v_miembro;
end $$;
revoke all on function public.pasmu_registrar_acceso_demo(text, text, integer, text[]) from public, anon;
grant execute on function public.pasmu_registrar_acceso_demo(text, text, integer, text[]) to authenticated;

create or replace function public.pasmu_listar_accesos_demo()
returns table (miembro_id bigint, nombre text, email text, vigente_hasta date, activo boolean, vigente boolean, creado_en timestamptz, perfiles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, btrim(p.nombre || ' ' || p.apellidos), p.email, m.fecha_fin, m.activo,
         (m.activo and m.fecha_inicio <= current_date and (m.fecha_fin is null or m.fecha_fin >= current_date)),
         m.created_at, coalesce(ap.perfiles, '{}'::text[])
  from public.miembros m
  join public.personas p on p.id = m.persona_id
  join public.roles r on r.id = m.rol_id
  left join public.acceso_demo_perfiles ap on ap.miembro_id = m.id
  where r.codigo = 'experiencia_demo' and public.pasmu_puede_gestionar_demo()
  order by m.created_at desc
$$;
revoke all on function public.pasmu_listar_accesos_demo() from public, anon;
grant execute on function public.pasmu_listar_accesos_demo() to authenticated;

-- Perfiles que puede explorar quien inició sesión con una cuenta DEMO vigente (vacío = todos).
create or replace function public.pasmu_mis_perfiles_demo()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select array_agg(distinct x)
    from public.miembros m
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    join public.acceso_demo_perfiles ap on ap.miembro_id = m.id,
    lateral unnest(ap.perfiles) x
    where p.auth_user_id = (select auth.uid()) and r.codigo = 'experiencia_demo'
      and m.activo and m.fecha_inicio <= current_date and (m.fecha_fin is null or m.fecha_fin >= current_date)
  ), '{}'::text[])
$$;
revoke all on function public.pasmu_mis_perfiles_demo() from public, anon;
grant execute on function public.pasmu_mis_perfiles_demo() to authenticated;

create or replace function public.pasmu_revocar_acceso_demo(_miembro_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pasmu_puede_gestionar_demo() then
    raise exception 'Solo Dirección PASMU gestiona los accesos DEMO.' using errcode = '42501'; end if;
  update public.miembros m set activo = false
  from public.roles r
  where m.id = _miembro_id and r.id = m.rol_id and r.codigo = 'experiencia_demo';
  if not found then raise exception 'No existe ese acceso DEMO.' using errcode = 'P0002'; end if;
  perform private.pasmu_auditar(null, 'miembros', _miembro_id::text, 'UPDATE', jsonb_build_object('revocado', true));
end $$;
revoke all on function public.pasmu_revocar_acceso_demo(bigint) from public, anon;
grant execute on function public.pasmu_revocar_acceso_demo(bigint) to authenticated;

commit;
