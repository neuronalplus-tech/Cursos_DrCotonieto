-- PASMU 25: ruta de atención, asignaciones con historial, prioridad administrativa, cierre con motivo,
-- reprogramación, recordatorios con consentimiento, mensajes entre sesiones y bitácora de consultas.
-- Solo PRUEBAS. Idempotente. Requiere 24 aplicado. Sin datos de personas ni contenido clínico libre.
begin;

-- ——— ruta de atención: fechas de cada etapa (la primera sesión se deriva de la agenda) ———
create table if not exists public.casos_ruta (
  caso_id bigint primary key references public.casos(id) on delete cascade,
  origen text not null default 'autosolicitud' check (origen in ('autosolicitud', 'tutoria', 'otra_area')),
  solicitada_en date not null default current_date,
  evaluacion_en date,
  entrevista_en date,
  asignacion_en date,
  creada_por uuid references public.personas(id) on delete set null,
  actualizada_en timestamptz not null default now(),
  check (evaluacion_en is null or evaluacion_en >= solicitada_en),
  check (entrevista_en is null or (evaluacion_en is not null and entrevista_en >= evaluacion_en)),
  check (asignacion_en is null or asignacion_en >= solicitada_en)
);

-- Todo caso nuevo nace con su ruta; los existentes se completan una sola vez.
create or replace function private.pasmu_casos_ruta_alta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.casos_ruta (caso_id, solicitada_en, asignacion_en)
  values (new.id, new.fecha_apertura::date, case when new.responsable_actual_id is not null then new.fecha_apertura::date end)
  on conflict (caso_id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_casos_ruta_alta on public.casos;
create trigger trg_casos_ruta_alta after insert on public.casos
  for each row execute function private.pasmu_casos_ruta_alta();
insert into public.casos_ruta (caso_id, solicitada_en, asignacion_en)
select c.id, c.fecha_apertura::date, case when c.responsable_actual_id is not null then c.fecha_apertura::date end
from public.casos c
on conflict (caso_id) do nothing;

-- ——— historial de asignaciones (solo se inserta; nunca se edita) ———
create table if not exists public.casos_asignaciones (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  desde_persona_id uuid references public.personas(id) on delete set null,
  hacia_persona_id uuid references public.personas(id) on delete set null,
  motivo text not null check (motivo in (
    'asignacion_inicial', 'baja_licencia', 'redistribucion', 'solicitud_persona_usuaria', 'cambio_unidad', 'otro')),
  fecha date not null default current_date,
  registrada_por uuid references public.personas(id) on delete set null,
  registrada_en timestamptz not null default now()
);
create index if not exists idx_casos_asignaciones_caso on public.casos_asignaciones (caso_id, fecha);

-- ——— prioridad administrativa: la define una persona con un criterio de una lista institucional ———
create table if not exists public.criterios_prioridad (
  codigo text primary key,
  nombre text not null,
  activo boolean not null default true
);
insert into public.criterios_prioridad (codigo, nombre) values
  ('sin_criterio', 'Sin criterio especial'),
  ('atencion_previa', 'Antecedente de atención previa'),
  ('cierre_periodo', 'Cierre de periodo académico próximo'),
  ('urgencia_academica', 'Solicitud con urgencia académica'),
  ('vulnerabilidad_referida', 'Situación de vulnerabilidad referida por tutoría o por la persona')
on conflict (codigo) do update set nombre = excluded.nombre;

create table if not exists public.casos_prioridad (
  caso_id bigint primary key references public.casos(id) on delete cascade,
  nivel text not null default 'regular' check (nivel in ('regular', 'prioritaria')),
  criterio text not null default 'sin_criterio' references public.criterios_prioridad(codigo),
  definida_por uuid references public.personas(id) on delete set null,
  definida_en timestamptz not null default now(),
  check (nivel = 'regular' or criterio <> 'sin_criterio')
);

-- ——— cierre con motivo y reprogramación ———
alter table public.casos add column if not exists motivo_cierre text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_casos_motivo_cierre') then
    alter table public.casos add constraint chk_casos_motivo_cierre
      check (motivo_cierre is null or motivo_cierre in ('alta_terapeutica', 'derivacion', 'abandono', 'otro')) not valid;
  end if;
end $$;

-- Convención de agenda.estado que usan los indicadores: programada, realizada, no_asistio, cancelada.
alter table public.agenda add column if not exists reprogramada_desde timestamptz;
alter table public.agenda add column if not exists motivo_reprogramacion text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_agenda_motivo_reprogramacion') then
    alter table public.agenda add constraint chk_agenda_motivo_reprogramacion
      check (motivo_reprogramacion is null or motivo_reprogramacion in
        ('solicitud_persona_usuaria', 'cambio_persona_terapeuta', 'causa_institucional')) not valid;
  end if;
end $$;

-- ——— recordatorios: solo con consentimiento y por el canal que elige la persona ———
create table if not exists public.preferencias_recordatorio (
  caso_id bigint primary key references public.casos(id) on delete cascade,
  consentimiento boolean not null default false,
  canal text check (canal in ('correo', 'sms', 'whatsapp')),
  actualizada_en timestamptz not null default now(),
  check (not consentimiento or canal is not null)
);

-- ——— mensajes entre sesiones: la persona deja algo para comentar; sin enlaces, correos ni números ———
create table if not exists public.mensajes_entre_sesiones (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  texto text not null check (
    char_length(btrim(texto)) between 3 and 500
    and texto !~* '(https?://|www\.|@[a-z0-9]|[0-9]{7,})'),
  creado_en timestamptz not null default now(),
  visto_en timestamptz,
  abordado_en timestamptz
);
create index if not exists idx_mensajes_entre_sesiones_caso on public.mensajes_entre_sesiones (caso_id, creado_en desc);

-- ——— bitácora de consultas del expediente: inalterable y visible para la persona usuaria ———
create table if not exists public.bitacora_consultas_expediente (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  rol_codigo text not null,
  fecha date not null default current_date,
  unique (caso_id, persona_id, fecha)
);
create or replace function private.pasmu_bloquear_modificacion()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Este registro es inalterable.' using errcode = '42501';
end;
$$;
drop trigger if exists trg_bitacora_consultas_inalterable on public.bitacora_consultas_expediente;
create trigger trg_bitacora_consultas_inalterable before update or delete on public.bitacora_consultas_expediente
  for each row execute function private.pasmu_bloquear_modificacion();
drop trigger if exists trg_casos_asignaciones_inalterable on public.casos_asignaciones;
create trigger trg_casos_asignaciones_inalterable before update or delete on public.casos_asignaciones
  for each row execute function private.pasmu_bloquear_modificacion();

-- ——— ayudas de autorización ———
create or replace function private.pasmu_soy_persona_del_caso(_caso_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.casos c
    join public.personas_usuarias pu on pu.id = c.persona_usuaria_id
    where c.id = _caso_id and pu.persona_id = private.pasmu_current_persona_id()
  )
$$;

-- Verdadero si la agenda de la unidad la lleva personal administrativo y quien consulta solo es terapeuta.
create or replace function private.pasmu_agenda_bloqueada(_unidad_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.modo_agenda = 'administrativo' from public.unidad_ajustes a where a.unidad_id = _unidad_id), false)
    and private.pasmu_mis_roles(_unidad_id) && array['terapeuta', 'coterapeuta']
    and not (private.pasmu_mis_roles(_unidad_id) && array['clinico_administrativo', 'responsable_unidad', 'coordinador_clinico'])
    and not private.pasmu_es_admin_global()
$$;

-- Etapa que el caso está esperando y desde cuándo (nula cuando ya tuvo su primera sesión).
create or replace function private.pasmu_etapa_actual(_caso_id bigint)
returns table (etapa text, desde date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.casos_ruta%rowtype;
begin
  select * into r from public.casos_ruta where caso_id = _caso_id;
  if not found then return; end if;
  if exists (select 1 from public.agenda a where a.caso_id = _caso_id and a.estado = 'realizada') then return; end if;
  if r.asignacion_en is not null then
    return query select 'sesion'::text, r.asignacion_en;
  elsif r.entrevista_en is not null then
    return query select 'asignacion'::text, r.entrevista_en;
  elsif r.evaluacion_en is not null then
    return query select 'entrevista'::text, r.evaluacion_en;
  else
    return query select 'evaluacion'::text, r.solicitada_en;
  end if;
end;
$$;

alter table public.casos_ruta enable row level security;
alter table public.casos_asignaciones enable row level security;
alter table public.criterios_prioridad enable row level security;
alter table public.casos_prioridad enable row level security;
alter table public.preferencias_recordatorio enable row level security;
alter table public.mensajes_entre_sesiones enable row level security;
alter table public.bitacora_consultas_expediente enable row level security;
revoke all on table public.casos_ruta, public.casos_asignaciones, public.criterios_prioridad, public.casos_prioridad,
  public.preferencias_recordatorio, public.mensajes_entre_sesiones, public.bitacora_consultas_expediente
  from public, anon, authenticated;
grant select on table public.casos_ruta, public.casos_asignaciones, public.criterios_prioridad, public.casos_prioridad,
  public.preferencias_recordatorio, public.mensajes_entre_sesiones to authenticated;
-- La persona usuaria ve rol y fecha, nunca nombres.
grant select (caso_id, rol_codigo, fecha) on table public.bitacora_consultas_expediente to authenticated;

drop policy if exists casos_ruta_read on public.casos_ruta;
create policy casos_ruta_read on public.casos_ruta for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'casos.ver') or creada_por = private.pasmu_current_persona_id());

drop policy if exists casos_asignaciones_read on public.casos_asignaciones;
create policy casos_asignaciones_read on public.casos_asignaciones for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'casos.ver'));

drop policy if exists criterios_prioridad_read on public.criterios_prioridad;
create policy criterios_prioridad_read on public.criterios_prioridad for select to authenticated using (activo);

drop policy if exists casos_prioridad_read on public.casos_prioridad;
create policy casos_prioridad_read on public.casos_prioridad for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'casos.ver'));

drop policy if exists preferencias_recordatorio_read on public.preferencias_recordatorio;
create policy preferencias_recordatorio_read on public.preferencias_recordatorio for select to authenticated
  using (private.pasmu_soy_persona_del_caso(caso_id) or private.pasmu_case_has_permission(caso_id, 'agenda.ver'));

drop policy if exists mensajes_entre_sesiones_read on public.mensajes_entre_sesiones;
create policy mensajes_entre_sesiones_read on public.mensajes_entre_sesiones for select to authenticated
  using (private.pasmu_soy_persona_del_caso(caso_id)
         or (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id)));

drop policy if exists bitacora_consultas_read on public.bitacora_consultas_expediente;
create policy bitacora_consultas_read on public.bitacora_consultas_expediente for select to authenticated
  using (private.pasmu_soy_persona_del_caso(caso_id));

-- ——— RPC: registrar evaluación inicial o primera entrevista ———
create or replace function public.pasmu_ruta_registrar(_caso_id bigint, _etapa text, _fecha date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidad bigint;
  r public.casos_ruta%rowtype;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('ruta.registrar', v_unidad) then
    raise exception 'Sin permiso ruta.registrar.' using errcode = '42501';
  end if;
  if _etapa not in ('evaluacion', 'entrevista') then
    raise exception 'Esa etapa se registra sola: la asignación al asignar y la primera sesión en la agenda.' using errcode = '22023';
  end if;
  if _fecha is null or _fecha > current_date then raise exception 'La fecha no puede ser posterior a hoy.' using errcode = '22023'; end if;
  select * into r from public.casos_ruta where caso_id = _caso_id;
  if _fecha < r.solicitada_en then raise exception 'La fecha no puede ser anterior a la solicitud.' using errcode = '22023'; end if;
  if _etapa = 'entrevista' and r.evaluacion_en is null then raise exception 'Registra primero la evaluación inicial.' using errcode = '22023'; end if;
  if _etapa = 'entrevista' and _fecha < r.evaluacion_en then raise exception 'La entrevista no puede ser anterior a la evaluación inicial.' using errcode = '22023'; end if;
  if _etapa = 'evaluacion' then
    update public.casos_ruta set evaluacion_en = _fecha, actualizada_en = now() where caso_id = _caso_id;
  else
    update public.casos_ruta set entrevista_en = _fecha, actualizada_en = now() where caso_id = _caso_id;
  end if;
end;
$$;

-- ——— RPC: asignar o traspasar. Quien deja el caso pierde el acceso en el mismo instante ———
create or replace function public.pasmu_caso_asignar(_caso_id bigint, _persona_id uuid, _motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := private.pasmu_current_persona_id();
  c public.casos%rowtype;
begin
  select * into c from public.casos where id = _caso_id;
  if c.id is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if v_yo is null or not private.pasmu_has_permission('casos.asignar', c.unidad_id) then
    raise exception 'Sin permiso casos.asignar.' using errcode = '42501';
  end if;
  if _motivo not in ('asignacion_inicial', 'baja_licencia', 'redistribucion', 'solicitud_persona_usuaria', 'cambio_unidad', 'otro') then
    raise exception 'Elige el motivo de la asignación.' using errcode = '22023';
  end if;
  if c.estado = 'cerrado' then raise exception 'El expediente está cerrado.' using errcode = '22023'; end if;
  if c.responsable_actual_id is not distinct from _persona_id then
    raise exception 'Elige una persona terapeuta distinta de la actual.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.miembros m
    join public.roles r on r.id = m.rol_id
    where m.persona_id = _persona_id and m.unidad_id = c.unidad_id and m.activo and r.activo
      and r.codigo in ('terapeuta', 'coterapeuta')
      and m.fecha_inicio <= current_date and (m.fecha_fin is null or m.fecha_fin >= current_date)
  ) then
    raise exception 'La persona terapeuta debe estar activa y dada de alta en la unidad del caso.' using errcode = '22023';
  end if;
  update public.caso_profesionales set activo = false
    where caso_id = _caso_id and rol_en_caso = 'responsable' and activo;
  insert into public.caso_profesionales (caso_id, persona_id, rol_en_caso) values (_caso_id, _persona_id, 'responsable');
  update public.casos set responsable_actual_id = _persona_id where id = _caso_id;
  update public.casos_ruta set asignacion_en = coalesce(asignacion_en, current_date), actualizada_en = now() where caso_id = _caso_id;
  insert into public.casos_asignaciones (caso_id, desde_persona_id, hacia_persona_id, motivo, registrada_por)
  values (_caso_id, c.responsable_actual_id, _persona_id,
          case when c.responsable_actual_id is null then 'asignacion_inicial' else _motivo end, v_yo);
  delete from public.casos_prioridad where caso_id = _caso_id;
end;
$$;

-- ——— RPC: prioridad administrativa (solo mientras el caso espera terapeuta) ———
create or replace function public.pasmu_caso_prioridad(_caso_id bigint, _nivel text, _criterio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.casos%rowtype;
begin
  select * into c from public.casos where id = _caso_id;
  if c.id is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('casos.asignar', c.unidad_id) then
    raise exception 'Sin permiso casos.asignar.' using errcode = '42501';
  end if;
  if _nivel not in ('regular', 'prioritaria') then raise exception 'Nivel no válido.' using errcode = '22023'; end if;
  if not exists (select 1 from public.criterios_prioridad where codigo = _criterio and activo) then
    raise exception 'Elige un criterio de la lista institucional.' using errcode = '22023';
  end if;
  if _nivel = 'prioritaria' and _criterio = 'sin_criterio' then
    raise exception 'Una prioridad necesita un criterio de la lista.' using errcode = '22023';
  end if;
  if c.responsable_actual_id is not null then
    raise exception 'La prioridad aplica mientras el caso espera terapeuta.' using errcode = '22023';
  end if;
  insert into public.casos_prioridad (caso_id, nivel, criterio, definida_por)
  values (_caso_id, _nivel, case when _nivel = 'regular' then 'sin_criterio' else _criterio end, private.pasmu_current_persona_id())
  on conflict (caso_id) do update set nivel = excluded.nivel, criterio = excluded.criterio,
    definida_por = excluded.definida_por, definida_en = now();
end;
$$;

-- ——— RPC: cierre con motivo y reapertura ———
create or replace function public.pasmu_caso_cerrar(_caso_id bigint, _motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.casos%rowtype;
begin
  select * into c from public.casos where id = _caso_id;
  if c.id is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_has_permission('casos.editar', c.unidad_id)
          and (private.pasmu_is_case_professional(_caso_id) or private.pasmu_has_permission('casos.asignar', c.unidad_id))) then
    raise exception 'Sin permiso para cerrar este expediente.' using errcode = '42501';
  end if;
  if _motivo not in ('alta_terapeutica', 'derivacion', 'abandono', 'otro') then
    raise exception 'Elige el motivo de cierre.' using errcode = '22023';
  end if;
  if c.estado = 'cerrado' then raise exception 'El expediente ya está cerrado.' using errcode = '22023'; end if;
  if exists (select 1 from public.agenda a where a.caso_id = _caso_id and a.estado = 'programada' and a.fecha_inicio >= now()) then
    raise exception 'Cancela o realiza las sesiones programadas antes de cerrar el expediente.' using errcode = '22023';
  end if;
  update public.casos set estado = 'cerrado', fecha_cierre = now(), motivo_cierre = _motivo where id = _caso_id;
end;
$$;

create or replace function public.pasmu_caso_reabrir(_caso_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.casos%rowtype;
begin
  select * into c from public.casos where id = _caso_id;
  if c.id is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_has_permission('casos.editar', c.unidad_id)
          and (private.pasmu_is_case_professional(_caso_id) or private.pasmu_has_permission('casos.asignar', c.unidad_id))) then
    raise exception 'Sin permiso para reabrir este expediente.' using errcode = '42501';
  end if;
  if c.estado <> 'cerrado' then raise exception 'El expediente no está cerrado.' using errcode = '22023'; end if;
  update public.casos set estado = 'abierto', fecha_cierre = null, motivo_cierre = null where id = _caso_id;
end;
$$;

-- ——— agenda: quien agenda es la persona que la unidad decida; el profesional es el del caso ———
create or replace function private.pasmu_agenda_programar(
  _caso_id bigint,
  _inicio timestamptz,
  _fin timestamptz,
  _tipo text default 'cita'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  c public.casos%rowtype;
  v_profesional uuid;
  v_id bigint;
begin
  if v_persona is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  select * into c from public.casos where id = _caso_id;
  if c.id is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('agenda.programar', c.unidad_id) then
    raise exception 'Sin permiso agenda.programar.' using errcode = '42501';
  end if;
  if private.pasmu_agenda_bloqueada(c.unidad_id) then
    raise exception 'En esta unidad la agenda la lleva el personal administrativo.' using errcode = '42501';
  end if;
  if c.estado = 'cerrado' then raise exception 'El expediente está cerrado.' using errcode = '22023'; end if;
  if _fin <= _inicio then raise exception 'Rango de agenda inválido.' using errcode = '22023'; end if;
  v_profesional := coalesce(c.responsable_actual_id, v_persona);
  if exists (
    select 1 from public.agenda a
    where a.profesional_id = v_profesional and a.estado = 'programada'
      and a.fecha_inicio < _fin and a.fecha_fin > _inicio
  ) then
    raise exception 'Esa persona terapeuta ya tiene una sesión en ese horario.' using errcode = '22023';
  end if;
  insert into public.agenda (caso_id, persona_usuaria_id, unidad_id, profesional_id, fecha_inicio, fecha_fin, tipo)
  values (_caso_id, c.persona_usuaria_id, c.unidad_id, v_profesional, _inicio, _fin, _tipo)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.pasmu_agenda_reprogramar(
  _agenda_id bigint, _inicio timestamptz, _fin timestamptz, _motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.agenda%rowtype;
begin
  select * into a from public.agenda where id = _agenda_id;
  if a.id is null then raise exception 'La sesión no existe.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('agenda.programar', a.unidad_id) then
    raise exception 'Sin permiso agenda.programar.' using errcode = '42501';
  end if;
  if private.pasmu_agenda_bloqueada(a.unidad_id) then
    raise exception 'En esta unidad la agenda la lleva el personal administrativo.' using errcode = '42501';
  end if;
  if a.estado <> 'programada' then raise exception 'Solo se reprograman sesiones programadas.' using errcode = '22023'; end if;
  if _motivo not in ('solicitud_persona_usuaria', 'cambio_persona_terapeuta', 'causa_institucional') then
    raise exception 'Elige el motivo de la reprogramación.' using errcode = '22023';
  end if;
  if _fin <= _inicio or _inicio < now() then raise exception 'Rango de agenda inválido.' using errcode = '22023'; end if;
  if exists (
    select 1 from public.agenda o
    where o.id <> a.id and o.profesional_id = a.profesional_id and o.estado = 'programada'
      and o.fecha_inicio < _fin and o.fecha_fin > _inicio
  ) then
    raise exception 'Esa persona terapeuta ya tiene una sesión en ese horario.' using errcode = '22023';
  end if;
  update public.agenda set fecha_inicio = _inicio, fecha_fin = _fin,
    reprogramada_desde = a.fecha_inicio, motivo_reprogramacion = _motivo where id = _agenda_id;
end;
$$;

-- ——— RPC: recordatorios (consentimiento de la persona usuaria) y lista de envíos pendientes ———
create or replace function public.pasmu_recordatorios_guardar(_caso_id bigint, _consentimiento boolean, _canal text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.pasmu_soy_persona_del_caso(_caso_id) then
    raise exception 'Solo la persona usuaria define sus recordatorios.' using errcode = '42501';
  end if;
  if coalesce(_consentimiento, false) and _canal not in ('correo', 'sms', 'whatsapp') then
    raise exception 'Elige un canal para los recordatorios.' using errcode = '22023';
  end if;
  insert into public.preferencias_recordatorio (caso_id, consentimiento, canal)
  values (_caso_id, coalesce(_consentimiento, false), case when coalesce(_consentimiento, false) then _canal end)
  on conflict (caso_id) do update set consentimiento = excluded.consentimiento, canal = excluded.canal, actualizada_en = now();
end;
$$;

-- El texto nunca lleva contenido clínico ni el motivo de la atención.
create or replace function public.pasmu_recordatorios_pendientes(_unidad_id bigint, _horas integer default 48)
returns table (agenda_id bigint, caso_id bigint, canal text, programada timestamptz, texto text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pasmu_has_permission('agenda.programar', _unidad_id) then
    raise exception 'Sin permiso agenda.programar.' using errcode = '42501';
  end if;
  return query
    select a.id, a.caso_id, p.canal, a.fecha_inicio,
           'Recordatorio: tienes una cita el ' || to_char(a.fecha_inicio at time zone 'America/Mexico_City', 'YYYY-MM-DD')
           || ' a las ' || to_char(a.fecha_inicio at time zone 'America/Mexico_City', 'HH24:MI') || '.'
    from public.agenda a
    join public.preferencias_recordatorio p on p.caso_id = a.caso_id and p.consentimiento
    where a.unidad_id = _unidad_id and a.estado = 'programada'
      and a.fecha_inicio >= now() and a.fecha_inicio <= now() + make_interval(hours => greatest(1, least(_horas, 168)))
    order by a.fecha_inicio;
end;
$$;

-- ——— RPC: mensajes entre sesiones ———
create or replace function public.pasmu_mensaje_entre_sesiones_crear(_caso_id bigint, _texto text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not private.pasmu_soy_persona_del_caso(_caso_id) then
    raise exception 'Solo la persona usuaria escribe en su espacio.' using errcode = '42501';
  end if;
  if _texto is null or char_length(btrim(_texto)) not between 3 and 500 then
    raise exception 'El mensaje admite de 3 a 500 caracteres.' using errcode = '22023';
  end if;
  if _texto ~* '(https?://|www\.|@[a-z0-9]|[0-9]{7,})' then
    raise exception 'No incluyas enlaces, correos ni números de teléfono o de cuenta.' using errcode = '22023';
  end if;
  insert into public.mensajes_entre_sesiones (caso_id, texto) values (_caso_id, btrim(_texto)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.pasmu_mensaje_entre_sesiones_marcar(_mensaje_id bigint, _estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caso bigint;
begin
  select caso_id into v_caso from public.mensajes_entre_sesiones where id = _mensaje_id;
  if v_caso is null then raise exception 'El mensaje no existe.' using errcode = '22023'; end if;
  if not (private.pasmu_case_has_permission(v_caso, 'expediente.ver') and private.pasmu_is_case_professional(v_caso)) then
    raise exception 'Solo la persona terapeuta del caso lo marca.' using errcode = '42501';
  end if;
  if _estado = 'visto' then
    update public.mensajes_entre_sesiones set visto_en = coalesce(visto_en, now()) where id = _mensaje_id;
  elsif _estado = 'abordado' then
    update public.mensajes_entre_sesiones set visto_en = coalesce(visto_en, now()), abordado_en = coalesce(abordado_en, now()) where id = _mensaje_id;
  else
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
end;
$$;

-- ——— RPC: canalización por tutoría y consulta de su propio avance (sin contenido clínico) ———
create or replace function public.pasmu_canalizacion_crear(_unidad_id bigint, _motivo text default 'Canalización por tutoría')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_usuaria bigint;
  v_caso bigint;
begin
  if v_persona is null or not private.pasmu_has_permission('canalizacion.crear', _unidad_id) then
    raise exception 'Sin permiso canalizacion.crear.' using errcode = '42501';
  end if;
  insert into public.personas_usuarias (numero_expediente, tipo_atencion, origen_referencia)
  values ('SIN-' || substr(gen_random_uuid()::text, 1, 8), 'general', 'tutoria') returning id into v_usuaria;
  insert into public.casos (persona_usuaria_id, unidad_id, motivo_referencia)
  values (v_usuaria, _unidad_id, 'Canalización por tutoría') returning id into v_caso;
  update public.casos_ruta set origen = 'tutoria', creada_por = v_persona where caso_id = v_caso;
  return v_caso;
end;
$$;

create or replace function public.pasmu_mis_canalizaciones()
returns table (caso_id bigint, unidad_id bigint, solicitada_en date, etapa text, dias_en_etapa integer, estado text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.caso_id, c.unidad_id, r.solicitada_en, e.etapa, (current_date - e.desde)::integer, c.estado
  from public.casos_ruta r
  join public.casos c on c.id = r.caso_id
  left join lateral private.pasmu_etapa_actual(r.caso_id) e on true
  where r.creada_por = private.pasmu_current_persona_id()
  order by r.solicitada_en desc
$$;

-- ——— RPC: bitácora de consultas ———
create or replace function public.pasmu_consulta_registrar(_caso_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_unidad bigint;
  v_rol text;
begin
  if v_persona is null then return; end if;
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_case_has_permission(_caso_id, 'casos.ver') or private.pasmu_case_has_permission(_caso_id, 'expediente.ver')) then
    raise exception 'Sin acceso al caso.' using errcode = '42501';
  end if;
  if private.pasmu_soy_persona_del_caso(_caso_id) then return; end if;
  select r.codigo into v_rol
  from public.miembros m join public.roles r on r.id = m.rol_id
  where m.persona_id = v_persona and m.unidad_id = v_unidad and m.activo
  order by array_position(array['terapeuta', 'coterapeuta', 'supervisor_clinico', 'coordinador_clinico', 'responsable_unidad',
                                'clinico_administrativo', 'administracion_global'], r.codigo)
  limit 1;
  insert into public.bitacora_consultas_expediente (caso_id, persona_id, rol_codigo)
  values (_caso_id, v_persona, coalesce(v_rol, 'otro'))
  on conflict (caso_id, persona_id, fecha) do nothing;
end;
$$;

-- Para auditoría: quién consultó (con identidad), solo con admin.auditoria en la unidad.
create or replace function public.pasmu_bitacora_auditoria(_caso_id bigint)
returns table (fecha date, rol_codigo text, persona_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unidad bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null or not (private.pasmu_has_permission('admin.auditoria', v_unidad) or private.pasmu_es_admin_global()) then
    raise exception 'Sin permiso admin.auditoria.' using errcode = '42501';
  end if;
  return query select b.fecha, b.rol_codigo, b.persona_id from public.bitacora_consultas_expediente b
    where b.caso_id = _caso_id order by b.fecha desc;
end;
$$;

-- ——— permisos de ejecución ———
-- La función privada de agenda solo se invoca desde su wrapper público (11c), como antes.
revoke all on function private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function private.pasmu_casos_ruta_alta() from public, anon, authenticated;
revoke all on function private.pasmu_soy_persona_del_caso(bigint) from public, anon;
revoke all on function private.pasmu_agenda_bloqueada(bigint) from public, anon;
revoke all on function private.pasmu_etapa_actual(bigint) from public, anon;
grant execute on function private.pasmu_soy_persona_del_caso(bigint) to authenticated;
grant execute on function private.pasmu_agenda_bloqueada(bigint) to authenticated;
grant execute on function private.pasmu_etapa_actual(bigint) to authenticated;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pasmu_ruta_registrar(bigint, text, date)',
    'public.pasmu_caso_asignar(bigint, uuid, text)',
    'public.pasmu_caso_prioridad(bigint, text, text)',
    'public.pasmu_caso_cerrar(bigint, text)',
    'public.pasmu_caso_reabrir(bigint)',
    'public.pasmu_agenda_reprogramar(bigint, timestamptz, timestamptz, text)',
    'public.pasmu_recordatorios_guardar(bigint, boolean, text)',
    'public.pasmu_recordatorios_pendientes(bigint, integer)',
    'public.pasmu_mensaje_entre_sesiones_crear(bigint, text)',
    'public.pasmu_mensaje_entre_sesiones_marcar(bigint, text)',
    'public.pasmu_canalizacion_crear(bigint, text)',
    'public.pasmu_mis_canalizaciones()',
    'public.pasmu_consulta_registrar(bigint)',
    'public.pasmu_bitacora_auditoria(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;
