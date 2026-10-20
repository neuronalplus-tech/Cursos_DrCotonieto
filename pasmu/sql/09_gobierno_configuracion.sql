-- PASMU: base persistente para proponer y revisar cambios de configuración.
-- No publica ni activa configuraciones. Ejecutar manualmente solo tras revisar
-- el esquema, respaldo y permisos del proyecto Supabase de destino.

begin;

insert into public.permisos (codigo, descripcion, categoria)
values
  ('configuracion.ver', 'Consultar propuestas de configuración del ámbito autorizado', 'admin'),
  ('configuracion.proponer', 'Crear y enviar propuestas de configuración', 'admin'),
  ('configuracion.revisar', 'Revisar propuestas de configuración', 'admin'),
  ('configuracion.aprobar_alto_riesgo', 'Aprobar propuestas de configuración de alto impacto', 'admin')
on conflict (codigo) do nothing;

create table if not exists public.solicitudes_cambio_configuracion (
  id uuid primary key default gen_random_uuid(),
  cambio_id uuid not null,
  version integer not null check (version > 0),
  sustituye_id uuid references public.solicitudes_cambio_configuracion(id) on delete restrict,
  dominio text not null check (dominio in (
    'institutional_scope',
    'service_flow',
    'catalogs',
    'indicator_definitions',
    'public_content',
    'roles_permissions',
    'clinical_protocols',
    'privacy_retention',
    'security_platform'
  )),
  unidad_id bigint not null references public.unidades(id) on delete restrict,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  motivo text not null check (char_length(btrim(motivo)) between 10 and 1000),
  propuesta jsonb not null check (
    jsonb_typeof(propuesta) = 'object'
    and jsonb_typeof(propuesta->'description') is not distinct from 'string'
    and char_length(btrim(propuesta->>'description')) between 10 and 3000
    and jsonb_typeof(propuesta->'scope') is not distinct from 'string'
    and char_length(btrim(propuesta->>'scope')) between 2 and 120
    and jsonb_typeof(propuesta->'impact') is not distinct from 'string'
    and char_length(btrim(propuesta->>'impact')) between 10 and 2000
    and jsonb_typeof(propuesta->'rollbackPlan') is not distinct from 'string'
    and char_length(btrim(propuesta->>'rollbackPlan')) between 10 and 2000
    and jsonb_typeof(propuesta->'validationEvidence') is not distinct from 'string'
    and char_length(btrim(propuesta->>'validationEvidence')) between 10 and 2000
    and octet_length(propuesta::text) <= 65536
  ),
  estado text not null default 'draft'
    check (estado in ('draft', 'in_review', 'approved', 'rejected')),
  creada_por uuid not null references public.personas(id) on delete restrict,
  enviada_en timestamptz,
  creada_en timestamptz not null default now(),
  unique (cambio_id, version),
  unique (id, cambio_id),
  check ((version = 1 and sustituye_id is null) or (version > 1 and sustituye_id is not null)),
  check ((estado = 'draft' and enviada_en is null) or (estado <> 'draft' and enviada_en is not null))
);

alter table public.solicitudes_cambio_configuracion
  drop constraint if exists solicitudes_cambio_configuracion_supersedes_same_change;
alter table public.solicitudes_cambio_configuracion
  add constraint solicitudes_cambio_configuracion_supersedes_same_change
  foreign key (sustituye_id, cambio_id)
  references public.solicitudes_cambio_configuracion(id, cambio_id)
  on delete restrict;

create table if not exists public.revisiones_cambio_configuracion (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_cambio_configuracion(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  comentario text check (comentario is null or char_length(comentario) <= 1000),
  revisada_por uuid not null references public.personas(id) on delete restrict,
  revisada_en timestamptz not null default now(),
  unique (solicitud_id, revisada_por)
);

create table if not exists public.eventos_cambio_configuracion (
  id bigint generated always as identity primary key,
  solicitud_id uuid not null references public.solicitudes_cambio_configuracion(id) on delete restrict,
  evento text not null check (evento in ('draft_created', 'submitted_for_review', 'approved', 'rejected')),
  actor_id uuid not null references public.personas(id) on delete restrict,
  detalle text check (detalle is null or char_length(detalle) <= 1000),
  creado_en timestamptz not null default now()
);

create index if not exists idx_solicitudes_cambio_configuracion_scope_status
  on public.solicitudes_cambio_configuracion(unidad_id, estado, creada_en desc);
create index if not exists idx_solicitudes_cambio_configuracion_change_version
  on public.solicitudes_cambio_configuracion(cambio_id, version desc);
create index if not exists idx_eventos_cambio_configuracion_request
  on public.eventos_cambio_configuracion(solicitud_id, creado_en);

alter table public.solicitudes_cambio_configuracion enable row level security;
alter table public.revisiones_cambio_configuracion enable row level security;
alter table public.eventos_cambio_configuracion enable row level security;

revoke all on table
  public.solicitudes_cambio_configuracion,
  public.revisiones_cambio_configuracion,
  public.eventos_cambio_configuracion
from public, anon, authenticated;

grant select (
  id, cambio_id, version, sustituye_id, dominio, unidad_id, titulo, motivo,
  propuesta, estado, creada_por, enviada_en, creada_en
) on table public.solicitudes_cambio_configuracion to authenticated;
grant select (
  id, solicitud_id, decision, comentario, revisada_por, revisada_en
) on table public.revisiones_cambio_configuracion to authenticated;
grant select (
  id, solicitud_id, evento, actor_id, detalle, creado_en
) on table public.eventos_cambio_configuracion to authenticated;

drop policy if exists solicitudes_cambio_configuracion_read on public.solicitudes_cambio_configuracion;
create policy solicitudes_cambio_configuracion_read
  on public.solicitudes_cambio_configuracion
  for select to authenticated
  using (private.pasmu_has_permission('configuracion.ver', unidad_id));

drop policy if exists revisiones_cambio_configuracion_read on public.revisiones_cambio_configuracion;
create policy revisiones_cambio_configuracion_read
  on public.revisiones_cambio_configuracion
  for select to authenticated
  using (
    exists (
      select 1
      from public.solicitudes_cambio_configuracion request
      where request.id = revisiones_cambio_configuracion.solicitud_id
        and private.pasmu_has_permission('configuracion.ver', request.unidad_id)
    )
  );

drop policy if exists eventos_cambio_configuracion_read on public.eventos_cambio_configuracion;
create policy eventos_cambio_configuracion_read
  on public.eventos_cambio_configuracion
  for select to authenticated
  using (
    exists (
      select 1
      from public.solicitudes_cambio_configuracion request
      where request.id = eventos_cambio_configuracion.solicitud_id
        and private.pasmu_has_permission('configuracion.ver', request.unidad_id)
    )
  );

create or replace function private.pasmu_configuracion_crear_borrador(
  _dominio text,
  _unidad_id bigint,
  _titulo text,
  _motivo text,
  _propuesta jsonb,
  _sustituye_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_change_id uuid;
  v_version integer := 1;
  v_previous public.solicitudes_cambio_configuracion%rowtype;
  v_root public.solicitudes_cambio_configuracion%rowtype;
  v_request_id uuid;
begin
  v_actor := private.pasmu_current_persona_id();
  if v_actor is null then
    raise exception 'Perfil PASMU activo requerido.' using errcode = '42501';
  end if;
  if _unidad_id is null then
    raise exception 'El flujo de cambios aún requiere un ámbito de unidad validado.' using errcode = '22023';
  end if;
  if not private.pasmu_has_permission('configuracion.proponer', _unidad_id) then
    raise exception 'No tienes permiso para proponer cambios en este ámbito.' using errcode = '42501';
  end if;
  if _dominio is null or _dominio not in (
    'institutional_scope', 'service_flow', 'catalogs', 'indicator_definitions',
    'public_content', 'roles_permissions', 'clinical_protocols',
    'privacy_retention', 'security_platform'
  ) then
    raise exception 'Dominio de configuración no permitido.' using errcode = '22023';
  end if;
  if _titulo is null or char_length(btrim(_titulo)) not between 3 and 120
    or _motivo is null or char_length(btrim(_motivo)) not between 10 and 1000
    or _propuesta is null or jsonb_typeof(_propuesta) <> 'object'
    or jsonb_typeof(_propuesta->'description') is distinct from 'string'
    or char_length(btrim(_propuesta->>'description')) not between 10 and 3000
    or jsonb_typeof(_propuesta->'scope') is distinct from 'string'
    or char_length(btrim(_propuesta->>'scope')) not between 2 and 120
    or jsonb_typeof(_propuesta->'impact') is distinct from 'string'
    or char_length(btrim(_propuesta->>'impact')) not between 10 and 2000
    or jsonb_typeof(_propuesta->'rollbackPlan') is distinct from 'string'
    or char_length(btrim(_propuesta->>'rollbackPlan')) not between 10 and 2000
    or jsonb_typeof(_propuesta->'validationEvidence') is distinct from 'string'
    or char_length(btrim(_propuesta->>'validationEvidence')) not between 10 and 2000
    or octet_length(_propuesta::text) > 65536 then
    raise exception 'La propuesta no cumple los límites de validación.' using errcode = '22023';
  end if;

  if _sustituye_id is not null then
    select *
      into v_previous
    from public.solicitudes_cambio_configuracion
    where id = _sustituye_id
    for update;

    if not found
      or not private.pasmu_has_permission('configuracion.ver', v_previous.unidad_id)
      or v_previous.dominio <> _dominio
      or v_previous.unidad_id is distinct from _unidad_id
      or v_previous.estado = 'in_review' then
      raise exception 'La propuesta anterior no existe o no puede versionarse.' using errcode = '22023';
    end if;

    select *
      into v_root
    from public.solicitudes_cambio_configuracion
    where cambio_id = v_previous.cambio_id
    order by version
    limit 1
    for update;

    v_change_id := v_previous.cambio_id;
    select coalesce(max(version), 0) + 1
      into v_version
    from public.solicitudes_cambio_configuracion
    where cambio_id = v_change_id;
  else
    v_change_id := gen_random_uuid();
  end if;

  insert into public.solicitudes_cambio_configuracion (
    cambio_id, version, sustituye_id, dominio, unidad_id, titulo, motivo,
    propuesta, creada_por
  )
  values (
    v_change_id, v_version, _sustituye_id, _dominio, _unidad_id,
    btrim(_titulo), btrim(_motivo), _propuesta, v_actor
  )
  returning id into v_request_id;

  insert into public.eventos_cambio_configuracion (solicitud_id, evento, actor_id)
  values (v_request_id, 'draft_created', v_actor);

  return v_request_id;
end
$$;

create or replace function private.pasmu_configuracion_enviar_revision(_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_request public.solicitudes_cambio_configuracion%rowtype;
begin
  v_actor := private.pasmu_current_persona_id();
  select *
    into v_request
  from public.solicitudes_cambio_configuracion
  where id = _solicitud_id
  for update;

  if not found
    or v_actor is null
    or not private.pasmu_has_permission('configuracion.proponer', v_request.unidad_id)
    or v_request.creada_por <> v_actor
    or v_request.estado <> 'draft' then
    raise exception 'La propuesta no existe o no puede enviarse a revisión.' using errcode = '42501';
  end if;

  update public.solicitudes_cambio_configuracion
  set estado = 'in_review', enviada_en = now()
  where id = _solicitud_id;

  insert into public.eventos_cambio_configuracion (solicitud_id, evento, actor_id)
  values (_solicitud_id, 'submitted_for_review', v_actor);
end
$$;

create or replace function private.pasmu_configuracion_decidir_revision(
  _solicitud_id uuid,
  _decision text,
  _comentario text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_request public.solicitudes_cambio_configuracion%rowtype;
  v_high_impact boolean;
begin
  v_actor := private.pasmu_current_persona_id();
  select *
    into v_request
  from public.solicitudes_cambio_configuracion
  where id = _solicitud_id
  for update;

  if not found or v_actor is null or _decision is null or _decision not in ('approved', 'rejected')
    or (_comentario is not null and char_length(_comentario) > 1000)
    or (_decision = 'rejected' and char_length(btrim(coalesce(_comentario, ''))) < 5)
    or not private.pasmu_has_permission('configuracion.revisar', v_request.unidad_id)
    or v_request.creada_por = v_actor
    or v_request.estado <> 'in_review' then
    raise exception 'La propuesta no existe o no puede ser revisada por esta cuenta.' using errcode = '42501';
  end if;

  v_high_impact := v_request.dominio in (
    'roles_permissions', 'clinical_protocols', 'privacy_retention', 'security_platform'
  );
  if v_high_impact
    and not private.pasmu_has_permission('configuracion.aprobar_alto_riesgo', v_request.unidad_id) then
    raise exception 'La revisión de este dominio requiere autorización de alto impacto.' using errcode = '42501';
  end if;

  update public.solicitudes_cambio_configuracion
  set estado = _decision
  where id = _solicitud_id
    and estado = 'in_review';

  if not found then
    raise exception 'La propuesta cambió durante la revisión; vuelve a cargarla.' using errcode = '40001';
  end if;

  insert into public.revisiones_cambio_configuracion (
    solicitud_id, decision, comentario, revisada_por
  )
  values (_solicitud_id, _decision, nullif(btrim(_comentario), ''), v_actor);

  insert into public.eventos_cambio_configuracion (solicitud_id, evento, actor_id, detalle)
  values (_solicitud_id, _decision, v_actor, null);
end
$$;

revoke all on function private.pasmu_configuracion_crear_borrador(text, bigint, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.pasmu_configuracion_enviar_revision(uuid) from public, anon, authenticated;
revoke all on function private.pasmu_configuracion_decidir_revision(uuid, text, text) from public, anon, authenticated;
grant execute on function private.pasmu_configuracion_crear_borrador(text, bigint, text, text, jsonb, uuid) to authenticated;
grant execute on function private.pasmu_configuracion_enviar_revision(uuid) to authenticated;
grant execute on function private.pasmu_configuracion_decidir_revision(uuid, text, text) to authenticated;

create or replace function public.pasmu_configuration_create_draft(
  _dominio text,
  _unidad_id bigint,
  _titulo text,
  _motivo text,
  _propuesta jsonb,
  _sustituye_id uuid default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.pasmu_configuracion_crear_borrador(
    _dominio, _unidad_id, _titulo, _motivo, _propuesta, _sustituye_id
  )
$$;

create or replace function public.pasmu_configuration_submit_review(_solicitud_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.pasmu_configuracion_enviar_revision(_solicitud_id)
$$;

create or replace function public.pasmu_configuration_review(
  _solicitud_id uuid,
  _decision text,
  _comentario text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.pasmu_configuracion_decidir_revision(
    _solicitud_id, _decision, _comentario
  )
$$;

revoke all on function public.pasmu_configuration_create_draft(text, bigint, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.pasmu_configuration_submit_review(uuid) from public, anon, authenticated;
revoke all on function public.pasmu_configuration_review(uuid, text, text) from public, anon, authenticated;
grant execute on function public.pasmu_configuration_create_draft(text, bigint, text, text, jsonb, uuid) to authenticated;
grant execute on function public.pasmu_configuration_submit_review(uuid) to authenticated;
grant execute on function public.pasmu_configuration_review(uuid, text, text) to authenticated;

commit;
