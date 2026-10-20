-- PASMU 36: roles definitivos, altas de personal, correos con bitácora, talleres y datos de perfil.
-- Solo PRUEBAS. Idempotente. Requiere 17, 24 y 32.
-- Roles definitivos del programa: Dirección PASMU, Responsable de unidad (una o más por instituto), Coordinación clínica,
-- Supervisión clínica, Personal clínico-administrativo, Prácticas y servicio social, Tallerista, Terapeuta y Persona usuaria.
-- Los roles «coterapeuta» y «tutoria» ya no se asignan (siguen en el catálogo para no romper membresías anteriores).
begin;

-- ——— roles ———
insert into public.roles (codigo, nombre, descripcion) values
  ('direccion_pasmu', 'Dirección PASMU', 'Define metas, hojas membretadas y actividades globales; ve todos los institutos'),
  ('responsable_unidad', 'Responsable de unidad', 'Administra su instituto: altas, agenda, revisiones y comunicación; puede haber más de una persona por instituto'),
  ('coordinador_clinico', 'Coordinación clínica', 'Coordina casos, asignaciones, agenda e indicadores operativos'),
  ('supervisor_clinico', 'Supervisión clínica', 'Revisa el contenido de los expedientes, atiende incidentes y firma horas de práctica'),
  ('clinico_administrativo', 'Personal clínico-administrativo', 'Agenda, primer contacto y apoyo; sin contenido clínico'),
  ('practicante', 'Prácticas y servicio social', 'Atiende bajo supervisión; todo lo que registra entra a revisión'),
  ('tallerista', 'Tallerista', 'Gestiona sus talleres y su asistencia; sin acceso a expedientes'),
  ('terapeuta', 'Terapeuta', 'Atiende casos; llena expediente y notas por selección'),
  ('persona_usuaria', 'Persona usuaria', 'Portal propio: citas, plan de seguridad, consentimientos, tareas y diario')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = true;
update public.roles set descripcion = 'En desuso: no se asigna a personas nuevas' where codigo in ('coterapeuta', 'tutoria');

-- ——— permisos ———
insert into public.permisos (codigo, descripcion, categoria) values
  ('altas.personal', 'Dar de alta al personal del instituto', 'admin'),
  ('talleres.gestionar', 'Gestionar talleres y su asistencia', 'clinico'),
  ('correos.enviar', 'Enviar correos y avisos con bitácora', 'comunicacion'),
  ('perfil.editar', 'Editar los datos de contacto del propio perfil', 'general'),
  ('chat.leer', 'Usar los mensajes internos del equipo', 'general')
on conflict (codigo) do update set descripcion = excluded.descripcion, activo = true;

insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, v.ambito
from (values
  ('direccion_pasmu', 'altas.personal', 'institucion'), ('responsable_unidad', 'altas.personal', 'unidad'),
  ('responsable_unidad', 'talleres.gestionar', 'unidad'), ('coordinador_clinico', 'talleres.gestionar', 'unidad'), ('tallerista', 'talleres.gestionar', 'unidad'),
  ('direccion_pasmu', 'correos.enviar', 'institucion'), ('responsable_unidad', 'correos.enviar', 'unidad'), ('coordinador_clinico', 'correos.enviar', 'unidad'),
  ('clinico_administrativo', 'correos.enviar', 'unidad'), ('terapeuta', 'correos.enviar', 'unidad'),
  -- indicadores: cada perfil ve los de su alcance; los de la persona terapeuta son agregados, nunca de otra persona
  ('supervisor_clinico', 'dashboard.ver', 'unidad'), ('clinico_administrativo', 'dashboard.ver', 'unidad'), ('practicante', 'dashboard.ver', 'unidad'),
  ('tallerista', 'dashboard.ver', 'unidad'), ('terapeuta', 'dashboard.ver', 'unidad'),
  -- prácticas y servicio social
  ('practicante', 'casos.ver', 'unidad'), ('practicante', 'agenda.ver', 'unidad'), ('practicante', 'expediente.ver', 'unidad'),
  ('practicante', 'expediente.editar', 'unidad'), ('practicante', 'seguridad.registrar', 'unidad'), ('practicante', 'resultados.registrar', 'unidad'),
  ('practicante', 'revision.recibir', 'unidad'), ('tallerista', 'agenda.ver', 'unidad')
) as v(rol, permiso, ambito)
join public.roles r on r.codigo = v.rol
join public.permisos p on p.codigo = v.permiso
on conflict (rol_id, permiso_id) do nothing;

insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, 'unidad'
from public.roles r, public.permisos p
where p.codigo = 'perfil.editar' and r.activo
on conflict (rol_id, permiso_id) do nothing;
insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, 'unidad'
from public.roles r, public.permisos p
where p.codigo = 'chat.leer' and r.activo and r.codigo <> 'persona_usuaria'
on conflict (rol_id, permiso_id) do nothing;

-- ——— datos de perfil ———
alter table public.personas add column if not exists correo_contacto text;
alter table public.personas add column if not exists disponibilidad text;
alter table public.personas add column if not exists enfoque text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_personas_contacto') then
    alter table public.personas add constraint chk_personas_contacto check (
      (correo_contacto is null or correo_contacto ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')
      and (disponibilidad is null or char_length(disponibilidad) <= 120)
      and (enfoque is null or char_length(enfoque) <= 160)) not valid;
  end if;
end $$;

-- La persona edita solo sus datos de contacto (no nombre, rol ni unidad).
create or replace function public.pasmu_perfil_guardar(_telefono text, _correo_contacto text, _disponibilidad text, _enfoque text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_yo uuid := private.pasmu_current_persona_id();
begin
  if v_yo is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if _telefono is not null and _telefono !~ '^[0-9+()[:space:]-]{8,20}$' then raise exception 'El teléfono solo admite números y + ( ) -.' using errcode = '22023'; end if;
  if _correo_contacto is not null and _correo_contacto !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then raise exception 'El correo de contacto no es válido.' using errcode = '22023'; end if;
  update public.personas
    set telefono = nullif(btrim(_telefono), ''), correo_contacto = nullif(btrim(_correo_contacto), ''),
        disponibilidad = left(nullif(btrim(_disponibilidad), ''), 120), enfoque = left(nullif(btrim(_enfoque), ''), 160)
    where id = v_yo;
end $$;

-- ——— altas de personal: roles definitivos y alcance por instituto ———
create or replace function public.pasmu_preAlta_equipo(_email text, _nombre text, _rol text, _unidad bigint, _programa bigint default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_yo uuid := private.pasmu_current_persona_id(); v_id uuid;
begin
  if v_yo is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if _rol not in ('responsable_unidad', 'coordinador_clinico', 'supervisor_clinico', 'clinico_administrativo', 'practicante', 'tallerista', 'terapeuta') then
    raise exception 'Rol de equipo no permitido.' using errcode = '22023';
  end if;
  if lower(btrim(_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then raise exception 'El correo no es válido.' using errcode = '22023'; end if;
  -- Dirección da de alta a responsables; la persona responsable, al resto y solo en sus unidades.
  if _rol = 'responsable_unidad' then
    if not (private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles())) then
      raise exception 'Solo Dirección PASMU da de alta a personas responsables de unidad.' using errcode = '42501';
    end if;
  elsif not (private.pasmu_es_admin_global() or private.pasmu_has_permission('altas.personal', _unidad)) then
    raise exception 'Solo en tus unidades.' using errcode = '42501';
  end if;
  insert into public.prealtas_equipo (email, nombre, rol_codigo, unidad_id, programa_id, creada_por)
  values (lower(btrim(_email)), btrim(_nombre), _rol, _unidad, _programa, v_yo) returning id into v_id;
  perform private.pasmu_auditar(_unidad, 'prealtas_equipo', v_id::text, 'invitar', jsonb_build_object('rol', _rol));
  return v_id;
end $$;

-- ——— correos con bitácora (el envío real lo hace una función edge con un proveedor de correo) ———
create table if not exists public.comunicaciones (
  id bigserial primary key,
  unidad_id bigint references public.unidades(id) on delete set null,
  plantilla text not null default 'aviso',
  asunto text not null check (char_length(asunto) between 4 and 120),
  cuerpo text not null check (char_length(cuerpo) between 10 and 1000),
  audiencia text not null,
  destinatarios integer not null default 0 check (destinatarios >= 0),
  omitidos integer not null default 0 check (omitidos >= 0),
  estado text not null default 'en_cola' check (estado in ('en_cola', 'enviado', 'error')),
  enviada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now()
);
alter table public.comunicaciones enable row level security;
revoke all on public.comunicaciones from public, anon, authenticated;
grant select on public.comunicaciones to authenticated;
drop policy if exists comunicaciones_leer on public.comunicaciones;
create policy comunicaciones_leer on public.comunicaciones for select to authenticated
  using (enviada_por = private.pasmu_current_persona_id()
         or (unidad_id is not null and private.pasmu_has_permission('unidad.configurar', unidad_id))
         or private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles()));

-- Registra el envío en la bitácora. Las personas usuarias solo cuentan si autorizaron el correo (recordatorios) y el
-- mensaje nunca lleva contenido clínico; la persona terapeuta solo escribe a las personas de sus casos.
create or replace function public.pasmu_comunicacion_registrar(
  _unidad_id bigint, _plantilla text, _asunto text, _cuerpo text, _audiencia text, _destinatarios integer, _omitidos integer default 0)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  if not (private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles())
          or (_unidad_id is not null and private.pasmu_has_permission('correos.enviar', _unidad_id))) then
    raise exception 'Tu perfil no envía correos.' using errcode = '42501';
  end if;
  if _audiencia not in ('equipo_instituto', 'terapeutas_instituto', 'personas_instituto', 'citas_proximas', 'mis_personas', 'todo_personal') then
    raise exception 'Audiencia no válida.' using errcode = '22023';
  end if;
  if _destinatarios is null or _destinatarios < 1 then raise exception 'No hay destinatarios con autorización.' using errcode = '22023'; end if;
  insert into public.comunicaciones (unidad_id, plantilla, asunto, cuerpo, audiencia, destinatarios, omitidos, enviada_por)
  values (_unidad_id, left(_plantilla, 30), _asunto, _cuerpo, _audiencia, _destinatarios, greatest(coalesce(_omitidos, 0), 0), private.pasmu_current_persona_id())
  returning id into v_id;
  perform private.pasmu_auditar(_unidad_id, 'comunicaciones', v_id::text, 'registrar', jsonb_build_object('audiencia', _audiencia, 'destinatarios', _destinatarios));
  return v_id;
end $$;

-- ——— talleres ———
create table if not exists public.talleres (
  id bigserial primary key,
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 3 and 120),
  tallerista_id uuid references public.personas(id) on delete set null,
  estado text not null default 'en_preparacion' check (estado in ('en_preparacion', 'programado', 'en_curso', 'realizado')),
  cupo integer not null check (cupo between 1 and 500),
  inscritos integer not null default 0 check (inscritos >= 0),
  constraint chk_talleres_inscritos check (inscritos <= cupo)
);
create table if not exists public.taller_sesiones (
  id bigserial primary key,
  taller_id bigint not null references public.talleres(id) on delete cascade,
  fecha date not null,
  asistentes integer not null check (asistentes >= 0)
);
alter table public.talleres enable row level security;
alter table public.taller_sesiones enable row level security;
revoke all on public.talleres, public.taller_sesiones from public, anon, authenticated;
grant select on public.talleres, public.taller_sesiones to authenticated;
drop policy if exists talleres_leer on public.talleres;
create policy talleres_leer on public.talleres for select to authenticated
  using (tallerista_id = private.pasmu_current_persona_id() or private.pasmu_has_permission('talleres.gestionar', unidad_id)
         or private.pasmu_has_permission('dashboard.ver', unidad_id) or private.pasmu_es_admin_global());
drop policy if exists taller_sesiones_leer on public.taller_sesiones;
create policy taller_sesiones_leer on public.taller_sesiones for select to authenticated
  using (exists (select 1 from public.talleres t where t.id = taller_id));

create or replace function private.pasmu_taller_gestiona(_taller_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.talleres t where t.id = _taller_id
    and (t.tallerista_id = private.pasmu_current_persona_id() or private.pasmu_has_permission('talleres.gestionar', t.unidad_id)))
$$;

create or replace function public.pasmu_taller_guardar(_taller_id bigint, _inscritos integer, _estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare t public.talleres%rowtype;
begin
  select * into t from public.talleres where id = _taller_id;
  if t.id is null then raise exception 'El taller no existe.' using errcode = '22023'; end if;
  if not private.pasmu_taller_gestiona(_taller_id) then raise exception 'Ese taller no es de tu alcance.' using errcode = '42501'; end if;
  if _inscritos is null or _inscritos < 0 or _inscritos > t.cupo then raise exception 'Los participantes deben estar entre 0 y %.', t.cupo using errcode = '22023'; end if;
  if _estado not in ('en_preparacion', 'programado', 'en_curso', 'realizado') then raise exception 'Estado no válido.' using errcode = '22023'; end if;
  update public.talleres set inscritos = _inscritos, estado = _estado where id = _taller_id;
end $$;

create or replace function public.pasmu_taller_sesion_registrar(_taller_id bigint, _fecha date, _asistentes integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare t public.talleres%rowtype; v_id bigint;
begin
  select * into t from public.talleres where id = _taller_id;
  if t.id is null then raise exception 'El taller no existe.' using errcode = '22023'; end if;
  if not private.pasmu_taller_gestiona(_taller_id) then raise exception 'Ese taller no es de tu alcance.' using errcode = '42501'; end if;
  if _fecha is null or _fecha > current_date then raise exception 'La fecha de la sesión no puede ser futura.' using errcode = '22023'; end if;
  if _asistentes is null or _asistentes < 0 or _asistentes > t.cupo then raise exception 'La asistencia debe estar entre 0 y %.', t.cupo using errcode = '22023'; end if;
  insert into public.taller_sesiones (taller_id, fecha, asistentes) values (_taller_id, _fecha, _asistentes) returning id into v_id;
  update public.talleres set estado = 'en_curso' where id = _taller_id and estado in ('en_preparacion', 'programado');
  return v_id;
end $$;

-- ——— permisos de ejecución ———
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in (
             'pasmu_perfil_guardar', 'pasmu_prealta_equipo', 'pasmu_comunicacion_registrar', 'pasmu_taller_guardar', 'pasmu_taller_sesion_registrar')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
revoke all on function private.pasmu_taller_gestiona(bigint) from public, anon;

commit;
