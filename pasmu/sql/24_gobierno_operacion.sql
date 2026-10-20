-- PASMU 24: gobierno de la operación — roles, permisos, ajustes por unidad, fase de implementación,
-- metas por instituto, línea base y capacidad de agenda.
-- Solo PRUEBAS. Idempotente. Requiere 01-05, 04 y 17 aplicados. No contiene datos de personas.
--
-- Decisiones de la institución que este script implementa:
--   * La revisión de contenido es de supervisión clínica y coordinación clínica.
--   * Fase de implementación (línea base o metas definitivas), metas, porcentaje de muestreo de revisión y
--     plazo de firma se definen por la administración global, por unidad.
begin;

-- ——— roles nuevos ———
insert into public.roles (codigo, nombre, descripcion) values
  ('administracion_global', 'Administración global', 'Configura fase, metas, hojas membretadas y actividades globales'),
  ('tutoria', 'Tutoría (canalización)', 'Canaliza solicitudes de apoyo; sin acceso a contenido clínico')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = true;

-- ——— permisos nuevos ———
insert into public.permisos (codigo, descripcion, categoria) values
  ('calendario.ver', 'Ver el calendario propio', 'calendario'),
  ('calendario.global', 'Publicar actividades globales', 'calendario'),
  ('calendario.unidad', 'Publicar actividades de la unidad', 'calendario'),
  ('membrete.global', 'Cargar la hoja membretada global', 'documentos'),
  ('membrete.unidad', 'Cargar la hoja membretada de la unidad', 'documentos'),
  ('unidad.configurar', 'Configurar agenda y revisiones de la unidad', 'admin'),
  ('plataforma.configurar', 'Definir fase, metas, muestreo y plazos', 'admin'),
  ('revision.contenido', 'Revisar el contenido de notas, historia y familiograma', 'clinico'),
  ('revision.formal', 'Checklist de cumplimiento formal, sin contenido', 'clinico'),
  ('revision.recibir', 'Recibir y confirmar revisiones', 'clinico'),
  ('casos.asignar', 'Asignar, traspasar y priorizar casos', 'clinico'),
  ('ruta.registrar', 'Registrar etapas de la ruta de atención', 'clinico'),
  ('constancias.emitir', 'Emitir constancias de asistencia', 'documentos'),
  ('canalizacion.crear', 'Registrar una solicitud canalizada por tutoría', 'clinico')
on conflict (codigo) do update set descripcion = excluded.descripcion, activo = true;

-- Asignación mínima y auditable. Ajustar tras aprobar la matriz de permisos.
insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, v.ambito
from (values
  ('administracion_global', 'plataforma.configurar', 'institucion'),
  ('administracion_global', 'calendario.global', 'institucion'),
  ('administracion_global', 'calendario.unidad', 'institucion'),
  ('administracion_global', 'membrete.global', 'institucion'),
  ('administracion_global', 'membrete.unidad', 'institucion'),
  ('administracion_global', 'unidad.configurar', 'institucion'),
  ('administracion_global', 'dashboard.ver', 'institucion'),
  ('administracion_global', 'reportes.ver', 'institucion'),
  ('responsable_unidad', 'calendario.unidad', 'unidad'),
  ('responsable_unidad', 'membrete.unidad', 'unidad'),
  ('responsable_unidad', 'unidad.configurar', 'unidad'),
  ('responsable_unidad', 'revision.formal', 'unidad'),
  ('responsable_unidad', 'casos.asignar', 'unidad'),
  ('coordinador_clinico', 'casos.asignar', 'unidad'),
  ('coordinador_clinico', 'casos.editar', 'unidad'),
  ('coordinador_clinico', 'ruta.registrar', 'unidad'),
  ('coordinador_clinico', 'revision.contenido', 'unidad'),
  ('coordinador_clinico', 'revision.formal', 'unidad'),
  ('coordinador_clinico', 'constancias.emitir', 'unidad'),
  ('supervisor_clinico', 'revision.contenido', 'unidad'),
  ('terapeuta', 'agenda.ver', 'unidad'),
  ('terapeuta', 'agenda.programar', 'unidad'),
  ('terapeuta', 'casos.editar', 'unidad'),
  ('terapeuta', 'revision.recibir', 'unidad'),
  ('terapeuta', 'constancias.emitir', 'unidad'),
  ('coterapeuta', 'revision.recibir', 'unidad'),
  ('clinico_administrativo', 'revision.formal', 'unidad'),
  ('clinico_administrativo', 'ruta.registrar', 'unidad'),
  -- Tutoría solo canaliza y consulta sus propias solicitudes; no recibe casos.ver para no leer la lista de la unidad.
  ('tutoria', 'canalizacion.crear', 'unidad')
) as v(rol, permiso, ambito)
join public.roles r on r.codigo = v.rol
join public.permisos p on p.codigo = v.permiso
on conflict (rol_id, permiso_id) do nothing;

-- Todos los perfiles ven su calendario (qué ve cada quien lo decide 26_calendario_actividades.sql).
insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, 'unidad'
from public.roles r, public.permisos p
where p.codigo = 'calendario.ver' and r.activo
on conflict (rol_id, permiso_id) do nothing;

-- ——— ayudas de autorización ———
create or replace function private.pasmu_es_admin_global()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros m
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    where p.auth_user_id = (select auth.uid())
      and p.activo = true and m.activo = true and r.activo = true
      and r.codigo = 'administracion_global'
      and m.fecha_inicio <= current_date
      and (m.fecha_fin is null or m.fecha_fin >= current_date)
  )
$$;

-- Roles vigentes de quien consulta, opcionalmente dentro de una unidad.
create or replace function private.pasmu_mis_roles(_unidad_id bigint default null)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct r.codigo), '{}')
  from public.miembros m
  join public.personas p on p.id = m.persona_id
  join public.roles r on r.id = m.rol_id
  where p.auth_user_id = (select auth.uid())
    and p.activo = true and m.activo = true and r.activo = true
    and m.fecha_inicio <= current_date
    and (m.fecha_fin is null or m.fecha_fin >= current_date)
    and (_unidad_id is null or m.unidad_id = _unidad_id)
$$;

-- Bitácora de cambios de configuración (reutiliza auditoria_actividad de 03).
create or replace function private.pasmu_auditar(_unidad_id bigint, _tabla text, _registro text, _operacion text, _despues jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.auditoria_actividad (unidad_id, tabla, registro_id, operacion, usuario_id, despues)
  values (_unidad_id, _tabla, _registro, _operacion, (select auth.uid()), _despues)
$$;

-- ——— ajustes por unidad ———
create table if not exists public.unidad_ajustes (
  unidad_id bigint primary key references public.unidades(id) on delete cascade,
  modo_agenda text not null default 'terapeuta' check (modo_agenda in ('terapeuta', 'administrativo')),
  admin_checklist boolean not null default false,
  fase text not null default 'linea_base' check (fase in ('linea_base', 'metas')),
  muestreo_revision_pct integer not null default 20 check (muestreo_revision_pct between 0 and 100),
  plazo_firma_dias integer not null default 3 check (plazo_firma_dias between 1 and 30),
  actualizado_por uuid references public.personas(id) on delete set null,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.ajustes_globales (
  id smallint primary key default 1 check (id = 1),
  fase text not null default 'metas' check (fase in ('linea_base', 'metas')),
  actualizado_por uuid references public.personas(id) on delete set null,
  actualizado_en timestamptz not null default now()
);
insert into public.ajustes_globales (id) values (1) on conflict (id) do nothing;

create table if not exists public.metas_operacion (
  id bigserial primary key,
  unidad_id bigint references public.unidades(id) on delete cascade, -- null = meta global
  codigo text not null check (codigo in (
    'asistencia', 'cancelacion', 'espera_maxima', 'primer_contacto', 'sin_seguimiento', 'notas_pendientes',
    'pases_pendientes', 'tamizaje', 'talleres', 'historia', 'revision',
    'etapa_evaluacion', 'etapa_entrevista', 'etapa_asignacion', 'etapa_sesion', 'etapa_total')),
  valor numeric not null check (valor >= 0 and valor <= 1000),
  actualizado_por uuid references public.personas(id) on delete set null,
  actualizado_en timestamptz not null default now()
);
create unique index if not exists uq_metas_operacion_ambito
  on public.metas_operacion (coalesce(unidad_id, 0), codigo);

-- Metas globales de partida (de ejemplo; la administración global las redefine con la línea base).
insert into public.metas_operacion (unidad_id, codigo, valor) values
  (null, 'asistencia', 85), (null, 'cancelacion', 15), (null, 'espera_maxima', 7), (null, 'primer_contacto', 7),
  (null, 'sin_seguimiento', 0), (null, 'notas_pendientes', 0), (null, 'pases_pendientes', 0), (null, 'tamizaje', 80),
  (null, 'talleres', 60), (null, 'historia', 80), (null, 'revision', 80), (null, 'etapa_evaluacion', 3),
  (null, 'etapa_entrevista', 3), (null, 'etapa_asignacion', 2), (null, 'etapa_sesion', 5), (null, 'etapa_total', 10)
on conflict do nothing;

create table if not exists public.lineas_base (
  id bigserial primary key,
  unidad_id bigint references public.unidades(id) on delete cascade, -- null = global
  fecha date not null default current_date,
  valores jsonb not null check (jsonb_typeof(valores) = 'object'),
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now()
);
create index if not exists idx_lineas_base_ambito on public.lineas_base (coalesce(unidad_id, 0), fecha desc);

create table if not exists public.perfiles_terapeuta (
  persona_id uuid primary key references public.personas(id) on delete cascade,
  capacidad_semanal integer not null default 4 check (capacidad_semanal between 1 and 40),
  actualizado_en timestamptz not null default now()
);

alter table public.unidad_ajustes enable row level security;
alter table public.ajustes_globales enable row level security;
alter table public.metas_operacion enable row level security;
alter table public.lineas_base enable row level security;
alter table public.perfiles_terapeuta enable row level security;
revoke all on table public.unidad_ajustes, public.ajustes_globales, public.metas_operacion,
  public.lineas_base, public.perfiles_terapeuta from public, anon, authenticated;
grant select on table public.unidad_ajustes, public.ajustes_globales, public.metas_operacion,
  public.lineas_base, public.perfiles_terapeuta to authenticated;
grant usage, select on sequence public.metas_operacion_id_seq, public.lineas_base_id_seq to authenticated;

drop policy if exists unidad_ajustes_read on public.unidad_ajustes;
create policy unidad_ajustes_read on public.unidad_ajustes for select to authenticated
  using (private.pasmu_es_admin_global() or private.pasmu_is_unit_member(unidad_id));

drop policy if exists ajustes_globales_read on public.ajustes_globales;
create policy ajustes_globales_read on public.ajustes_globales for select to authenticated using (true);

drop policy if exists metas_operacion_read on public.metas_operacion;
create policy metas_operacion_read on public.metas_operacion for select to authenticated
  using (unidad_id is null or private.pasmu_es_admin_global() or private.pasmu_is_unit_member(unidad_id));

drop policy if exists lineas_base_read on public.lineas_base;
create policy lineas_base_read on public.lineas_base for select to authenticated
  using (private.pasmu_es_admin_global()
         or (unidad_id is not null and private.pasmu_has_permission('dashboard.ver', unidad_id)));

drop policy if exists perfiles_terapeuta_read on public.perfiles_terapeuta;
create policy perfiles_terapeuta_read on public.perfiles_terapeuta for select to authenticated
  using (persona_id = private.pasmu_current_persona_id()
         or private.pasmu_es_admin_global()
         or private.pasmu_has_permission('casos.asignar'));

-- ——— RPC: agenda y checklist formal de la unidad (administración global o responsable de la unidad) ———
create or replace function public.pasmu_ajustes_unidad_guardar(
  _unidad_id bigint,
  _modo_agenda text default null,
  _admin_checklist boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
begin
  if v_persona is null then raise exception 'Perfil PASMU activo requerido.' using errcode = '42501'; end if;
  if not exists (select 1 from public.unidades where id = _unidad_id) then
    raise exception 'La unidad no existe.' using errcode = '22023';
  end if;
  if not (private.pasmu_es_admin_global() or private.pasmu_has_permission('unidad.configurar', _unidad_id)) then
    raise exception 'Solo la administración global o la persona responsable de la unidad la configura.' using errcode = '42501';
  end if;
  if _modo_agenda is not null and _modo_agenda not in ('terapeuta', 'administrativo') then
    raise exception 'Modo de agenda no válido.' using errcode = '22023';
  end if;
  insert into public.unidad_ajustes (unidad_id, modo_agenda, admin_checklist, actualizado_por)
  values (_unidad_id, coalesce(_modo_agenda, 'terapeuta'), coalesce(_admin_checklist, false), v_persona)
  on conflict (unidad_id) do update set
    modo_agenda = coalesce(_modo_agenda, public.unidad_ajustes.modo_agenda),
    admin_checklist = coalesce(_admin_checklist, public.unidad_ajustes.admin_checklist),
    actualizado_por = v_persona,
    actualizado_en = now();
  perform private.pasmu_auditar(_unidad_id, 'unidad_ajustes', _unidad_id::text, 'UPDATE',
    jsonb_build_object('modo_agenda', _modo_agenda, 'admin_checklist', _admin_checklist));
end;
$$;

-- ——— RPC: fase, muestreo y plazo de firma (solo administración global) ———
create or replace function public.pasmu_ajustes_admin_guardar(
  _unidad_id bigint,
  _fase text default null,
  _muestreo integer default null,
  _plazo integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
begin
  if v_persona is null or not private.pasmu_es_admin_global() then
    raise exception 'Solo la administración global define la fase, el muestreo y el plazo.' using errcode = '42501';
  end if;
  if _fase is not null and _fase not in ('linea_base', 'metas') then
    raise exception 'Fase no válida.' using errcode = '22023';
  end if;
  if _muestreo is not null and _muestreo not between 0 and 100 then
    raise exception 'El muestreo debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  if _plazo is not null and _plazo not between 1 and 30 then
    raise exception 'El plazo de firma debe ser de 1 a 30 días.' using errcode = '22023';
  end if;
  if _unidad_id is null then
    if _muestreo is not null or _plazo is not null then
      raise exception 'Muestreo y plazo se definen por unidad.' using errcode = '22023';
    end if;
    update public.ajustes_globales set fase = coalesce(_fase, fase), actualizado_por = v_persona, actualizado_en = now() where id = 1;
    perform private.pasmu_auditar(null, 'ajustes_globales', '1', 'UPDATE', jsonb_build_object('fase', _fase));
    return;
  end if;
  if not exists (select 1 from public.unidades where id = _unidad_id) then
    raise exception 'La unidad no existe.' using errcode = '22023';
  end if;
  insert into public.unidad_ajustes (unidad_id, fase, muestreo_revision_pct, plazo_firma_dias, actualizado_por)
  values (_unidad_id, coalesce(_fase, 'linea_base'), coalesce(_muestreo, 20), coalesce(_plazo, 3), v_persona)
  on conflict (unidad_id) do update set
    fase = coalesce(_fase, public.unidad_ajustes.fase),
    muestreo_revision_pct = coalesce(_muestreo, public.unidad_ajustes.muestreo_revision_pct),
    plazo_firma_dias = coalesce(_plazo, public.unidad_ajustes.plazo_firma_dias),
    actualizado_por = v_persona,
    actualizado_en = now();
  perform private.pasmu_auditar(_unidad_id, 'unidad_ajustes', _unidad_id::text, 'UPDATE',
    jsonb_build_object('fase', _fase, 'muestreo', _muestreo, 'plazo', _plazo));
end;
$$;

-- ——— RPC: meta por unidad (valor nulo = heredar la meta global) ———
create or replace function public.pasmu_meta_guardar(_unidad_id bigint, _codigo text, _valor numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
begin
  if v_persona is null or not private.pasmu_es_admin_global() then
    raise exception 'Solo la administración global define las metas.' using errcode = '42501';
  end if;
  if _valor is null then
    if _unidad_id is null then raise exception 'La meta global no se puede heredar.' using errcode = '22023'; end if;
    delete from public.metas_operacion where unidad_id = _unidad_id and codigo = _codigo;
  else
    if _valor < 0 or _valor > 1000 then raise exception 'La meta debe estar entre 0 y 1000.' using errcode = '22023'; end if;
    insert into public.metas_operacion (unidad_id, codigo, valor, actualizado_por)
    values (_unidad_id, _codigo, _valor, v_persona)
    on conflict (coalesce(unidad_id, 0), codigo) do update set valor = excluded.valor, actualizado_por = v_persona, actualizado_en = now();
  end if;
  perform private.pasmu_auditar(_unidad_id, 'metas_operacion', _codigo, 'UPDATE', jsonb_build_object('valor', _valor));
end;
$$;

-- ——— RPC: capacidad semanal de una persona terapeuta ———
create or replace function public.pasmu_capacidad_guardar(_persona_id uuid, _capacidad integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.pasmu_current_persona_id() is null or not private.pasmu_es_admin_global() then
    raise exception 'Solo la administración global define la capacidad.' using errcode = '42501';
  end if;
  if _capacidad is null or _capacidad not between 1 and 40 then
    raise exception 'La capacidad debe ser de 1 a 40 sesiones por semana.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.personas where id = _persona_id and activo) then
    raise exception 'La persona no existe.' using errcode = '22023';
  end if;
  insert into public.perfiles_terapeuta (persona_id, capacidad_semanal) values (_persona_id, _capacidad)
  on conflict (persona_id) do update set capacidad_semanal = excluded.capacidad_semanal, actualizado_en = now();
end;
$$;

revoke all on function private.pasmu_es_admin_global() from public, anon;
revoke all on function private.pasmu_mis_roles(bigint) from public, anon;
revoke all on function private.pasmu_auditar(bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.pasmu_es_admin_global() to authenticated;
grant execute on function private.pasmu_mis_roles(bigint) to authenticated;
revoke all on function public.pasmu_ajustes_unidad_guardar(bigint, text, boolean) from public, anon;
revoke all on function public.pasmu_ajustes_admin_guardar(bigint, text, integer, integer) from public, anon;
revoke all on function public.pasmu_meta_guardar(bigint, text, numeric) from public, anon;
revoke all on function public.pasmu_capacidad_guardar(uuid, integer) from public, anon;
grant execute on function public.pasmu_ajustes_unidad_guardar(bigint, text, boolean) to authenticated;
grant execute on function public.pasmu_ajustes_admin_guardar(bigint, text, integer, integer) to authenticated;
grant execute on function public.pasmu_meta_guardar(bigint, text, numeric) to authenticated;
grant execute on function public.pasmu_capacidad_guardar(uuid, integer) to authenticated;

commit;
