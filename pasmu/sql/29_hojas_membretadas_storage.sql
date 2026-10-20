-- PASMU 29: hojas membretadas (global y por unidad) con márgenes por tipo de documento, y su bucket privado de Storage.
-- Solo PRUEBAS. Idempotente. Requiere 24 aplicado. Proyecto Supabase (usa el esquema `storage`).
--
-- Convención de rutas dentro del bucket «membretes»:
--   global/<archivo>            → hoja global (la administra la administración global)
--   unidad-<id>/<archivo>       → hoja de una unidad (la administra su responsable)
-- El bucket es privado: las personas autenticadas leen mediante URL firmada (ver la función edge generar-pdf).
begin;

create or replace function private.pasmu_margenes_validos(_margenes jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(_margenes) = 'object'
    and not exists (
      select 1
      from jsonb_each(_margenes) t
      where t.key not in ('expediente', 'nota', 'reporte', 'constancia')
         or jsonb_typeof(t.value) <> 'object'
         or not (t.value ?& array['top', 'bottom', 'left', 'right'])
         or exists (
           select 1 from jsonb_each(t.value) m
           where m.key not in ('top', 'bottom', 'left', 'right')
              or jsonb_typeof(m.value) <> 'number'
              or (m.value #>> '{}')::numeric not between 0 and 120)
         or ((t.value ->> 'left')::numeric + (t.value ->> 'right')::numeric) > 130
         or ((t.value ->> 'top')::numeric + (t.value ->> 'bottom')::numeric) > 200)
$$;

create table if not exists public.hojas_membretadas (
  id uuid primary key default gen_random_uuid(),
  ambito text not null check (ambito in ('global', 'unidad')),
  unidad_id bigint references public.unidades(id) on delete cascade,
  ruta_storage text unique check (ruta_storage ~ '^(global|unidad-[0-9]+)/[A-Za-z0-9._-]{1,100}$'),
  nombre_archivo text check (nombre_archivo is null or char_length(nombre_archivo) <= 120),
  tipo_mime text check (tipo_mime in ('image/png', 'image/jpeg', 'image/webp')),
  margenes jsonb not null default '{}'::jsonb check (private.pasmu_margenes_validos(margenes)),
  version integer not null default 1,
  activa boolean not null default true,
  subida_por uuid references public.personas(id) on delete set null,
  subida_en timestamptz not null default now(),
  check ((ambito = 'global' and unidad_id is null) or (ambito = 'unidad' and unidad_id is not null)),
  check ((ruta_storage is null) = (tipo_mime is null))
);
create unique index if not exists uq_hoja_membretada_activa
  on public.hojas_membretadas (ambito, coalesce(unidad_id, 0)) where activa;

alter table public.hojas_membretadas enable row level security;
revoke all on table public.hojas_membretadas from public, anon, authenticated;
grant select on table public.hojas_membretadas to authenticated;
drop policy if exists hojas_membretadas_read on public.hojas_membretadas;
create policy hojas_membretadas_read on public.hojas_membretadas for select to authenticated
  using (private.pasmu_es_admin_global()
         or ambito = 'global'
         or (ambito = 'unidad' and private.pasmu_is_unit_member(unidad_id)));

-- ¿Puede quien consulta leer o escribir esta ruta del bucket?
create or replace function private.pasmu_membrete_ruta_permitida(_ruta text, _escritura boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _ruta ~ '^global/[A-Za-z0-9._-]{1,100}$' then
      case when _escritura then private.pasmu_es_admin_global()
           else private.pasmu_current_persona_id() is not null end
    when _ruta ~ '^unidad-[0-9]+/[A-Za-z0-9._-]{1,100}$' then
      private.pasmu_es_admin_global()
      or (case when _escritura
               then private.pasmu_has_permission('membrete.unidad', substring(_ruta from '^unidad-([0-9]+)/')::bigint)
               else private.pasmu_is_unit_member(substring(_ruta from '^unidad-([0-9]+)/')::bigint) end)
    else false
  end
$$;

-- Bucket privado, 1.5 MB por archivo, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('membretes', 'membretes', false, 1500000, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 1500000,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists membretes_read on storage.objects;
create policy membretes_read on storage.objects for select to authenticated
  using (bucket_id = 'membretes' and private.pasmu_membrete_ruta_permitida(name, false));
drop policy if exists membretes_insert on storage.objects;
create policy membretes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'membretes' and private.pasmu_membrete_ruta_permitida(name, true));
drop policy if exists membretes_update on storage.objects;
create policy membretes_update on storage.objects for update to authenticated
  using (bucket_id = 'membretes' and private.pasmu_membrete_ruta_permitida(name, true))
  with check (bucket_id = 'membretes' and private.pasmu_membrete_ruta_permitida(name, true));
drop policy if exists membretes_delete on storage.objects;
create policy membretes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'membretes' and private.pasmu_membrete_ruta_permitida(name, true));

-- RPC: registra una versión nueva de la hoja (archivo ya subido) y/o sus márgenes por tipo de documento.
create or replace function public.pasmu_membrete_registrar(
  _ambito text, _unidad_id bigint, _ruta text, _nombre text, _mime text, _margenes jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_prev public.hojas_membretadas%rowtype;
  v_id uuid;
begin
  if v_persona is null then raise exception 'Perfil PASMU activo requerido.' using errcode = '42501'; end if;
  if _ambito = 'global' then
    if _unidad_id is not null or not private.pasmu_es_admin_global() then
      raise exception 'Solo la administración global carga la hoja global.' using errcode = '42501';
    end if;
  elsif _ambito = 'unidad' then
    if _unidad_id is null or not (private.pasmu_es_admin_global() or private.pasmu_has_permission('membrete.unidad', _unidad_id)) then
      raise exception 'Solo la persona responsable de la unidad carga su hoja.' using errcode = '42501';
    end if;
  else
    raise exception 'Ámbito no válido.' using errcode = '22023';
  end if;
  if not private.pasmu_margenes_validos(coalesce(_margenes, '{}'::jsonb)) then
    raise exception 'Cada margen debe estar entre 0 y 120 mm y dejar espacio al contenido.' using errcode = '22023';
  end if;
  if _ruta is not null then
    if _ruta !~ ('^' || case when _ambito = 'global' then 'global' else 'unidad-' || _unidad_id end || '/[A-Za-z0-9._-]{1,100}$') then
      raise exception 'La ruta no corresponde al ámbito de la hoja.' using errcode = '22023';
    end if;
    if _mime not in ('image/png', 'image/jpeg', 'image/webp') then
      raise exception 'Usa una imagen PNG, JPG o WebP.' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'membretes' and o.name = _ruta) then
      raise exception 'Sube primero el archivo al bucket membretes.' using errcode = '22023';
    end if;
  end if;
  select * into v_prev from public.hojas_membretadas
    where ambito = _ambito and coalesce(unidad_id, 0) = coalesce(_unidad_id, 0) and activa;
  -- Solo márgenes: se actualiza la hoja vigente sin crear una versión nueva del archivo.
  if _ruta is null and v_prev.id is not null then
    update public.hojas_membretadas set margenes = margenes || coalesce(_margenes, '{}'::jsonb) where id = v_prev.id;
    perform private.pasmu_auditar(_unidad_id, 'hojas_membretadas', v_prev.id::text, 'UPDATE', jsonb_build_object('margenes', _margenes));
    return v_prev.id;
  end if;
  update public.hojas_membretadas set activa = false where id = v_prev.id;
  insert into public.hojas_membretadas (ambito, unidad_id, ruta_storage, nombre_archivo, tipo_mime, margenes, version, subida_por)
  values (_ambito, _unidad_id, _ruta, case when _ruta is null then null else left(_nombre, 120) end,
          case when _ruta is null then null else _mime end,
          coalesce(v_prev.margenes, '{}'::jsonb) || coalesce(_margenes, '{}'::jsonb),
          coalesce(v_prev.version, 0) + 1, v_persona)
  returning id into v_id;
  perform private.pasmu_auditar(_unidad_id, 'hojas_membretadas', v_id::text, 'INSERT', jsonb_build_object('ambito', _ambito, 'ruta', _ruta));
  return v_id;
end;
$$;

-- RPC: hoja y márgenes que usa un documento (la de la unidad si existe; si no, la global).
create or replace function public.pasmu_membrete_resolver(_unidad_id bigint, _tipo text)
returns table (origen text, ruta text, mime text, margen_superior numeric, margen_inferior numeric, margen_izquierdo numeric, margen_derecho numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.hojas_membretadas%rowtype;
  v_origen text := 'ninguna';
  m jsonb;
begin
  if _tipo not in ('expediente', 'nota', 'reporte', 'constancia') then
    raise exception 'Tipo de documento no válido.' using errcode = '22023';
  end if;
  if private.pasmu_current_persona_id() is null
     or not (_unidad_id is null or private.pasmu_es_admin_global() or private.pasmu_is_unit_member(_unidad_id)) then
    raise exception 'Sin acceso a la hoja membretada de esta unidad.' using errcode = '42501';
  end if;
  if _unidad_id is not null then
    select * into h from public.hojas_membretadas where ambito = 'unidad' and unidad_id = _unidad_id and activa and ruta_storage is not null;
    if h.id is not null then v_origen := 'unidad'; end if;
  end if;
  if h.id is null then
    select * into h from public.hojas_membretadas where ambito = 'global' and activa and ruta_storage is not null;
    if h.id is not null then v_origen := 'global'; end if;
  end if;
  m := coalesce(h.margenes -> _tipo, '{"top": 38, "bottom": 28, "left": 22, "right": 22}'::jsonb);
  return query select v_origen, h.ruta_storage, h.tipo_mime,
    (m ->> 'top')::numeric, (m ->> 'bottom')::numeric, (m ->> 'left')::numeric, (m ->> 'right')::numeric;
end;
$$;

revoke all on function private.pasmu_margenes_validos(jsonb) from public, anon;
revoke all on function private.pasmu_membrete_ruta_permitida(text, boolean) from public, anon;
grant execute on function private.pasmu_margenes_validos(jsonb) to authenticated;
grant execute on function private.pasmu_membrete_ruta_permitida(text, boolean) to authenticated;
revoke all on function public.pasmu_membrete_registrar(text, bigint, text, text, text, jsonb) from public, anon;
revoke all on function public.pasmu_membrete_resolver(bigint, text) from public, anon;
grant execute on function public.pasmu_membrete_registrar(text, bigint, text, text, text, jsonb) to authenticated;
grant execute on function public.pasmu_membrete_resolver(bigint, text) to authenticated;

commit;
