-- PASMU 32: atención segura — plan de seguridad, valoración de riesgo, incidentes críticos, consentimientos versionados,
-- resultados clínicos, tareas y diario, credenciales del personal, derivaciones, satisfacción anónima y practicantes.
-- Solo PRUEBAS. Idempotente. Requiere 24, 25, 27 y 28.
-- Principios: la plataforma NO puntúa riesgo ni diagnostica; solo registra lo que decide una persona profesional y
-- vigila que se cumplan los pasos obligatorios (seguimiento, acuse, escalamiento). Las tablas no se escriben directo:
-- todo pasa por funciones public.pasmu_* (errores 42501 = permiso, 22023 = dato inválido).
-- Los textos de consentimiento son MODELOS pendientes de validación jurídica (ver docs/MARCO_NORMATIVO_PASMU.md).
begin;

-- ——— permisos nuevos y su asignación mínima ———
insert into public.permisos (codigo, descripcion, categoria) values
  ('seguridad.registrar', 'Registrar plan de seguridad y valoración de riesgo', 'clinico'),
  ('resultados.registrar', 'Registrar mediciones de resultado y tareas entre sesiones', 'clinico'),
  ('incidentes.gestionar', 'Atender y cerrar incidentes críticos', 'clinico'),
  ('consentimientos.registrar', 'Registrar aceptación o revocación de consentimientos', 'clinico'),
  ('derivaciones.gestionar', 'Crear y dar seguimiento a derivaciones', 'clinico'),
  ('personal.gestionar', 'Registrar y verificar credenciales del personal', 'admin'),
  ('practicantes.gestionar', 'Firmar horas y evaluar competencias de practicantes', 'clinico')
on conflict (codigo) do update set descripcion = excluded.descripcion, activo = true;

insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, v.ambito
from (values
  ('terapeuta', 'seguridad.registrar', 'unidad'), ('terapeuta', 'resultados.registrar', 'unidad'),
  ('terapeuta', 'consentimientos.registrar', 'unidad'), ('terapeuta', 'derivaciones.gestionar', 'unidad'),
  ('coordinador_clinico', 'incidentes.gestionar', 'unidad'), ('coordinador_clinico', 'derivaciones.gestionar', 'unidad'),
  ('coordinador_clinico', 'consentimientos.registrar', 'unidad'), ('coordinador_clinico', 'practicantes.gestionar', 'unidad'),
  ('supervisor_clinico', 'incidentes.gestionar', 'unidad'), ('supervisor_clinico', 'practicantes.gestionar', 'unidad'),
  ('responsable_unidad', 'incidentes.gestionar', 'unidad'), ('responsable_unidad', 'personal.gestionar', 'unidad'),
  ('responsable_unidad', 'derivaciones.gestionar', 'unidad'), ('responsable_unidad', 'practicantes.gestionar', 'unidad'),
  ('clinico_administrativo', 'consentimientos.registrar', 'unidad'), ('clinico_administrativo', 'derivaciones.gestionar', 'unidad'),
  ('administracion_global', 'incidentes.gestionar', 'institucion'), ('administracion_global', 'personal.gestionar', 'institucion')
) as v(rol, permiso, ambito)
join public.roles r on r.codigo = v.rol
join public.permisos p on p.codigo = v.permiso
on conflict (rol_id, permiso_id) do nothing;

-- ——— ayudas ———
create or replace function private.pasmu_atencion_fecha(_ts timestamptz default now())
returns date language sql stable as $$ select private.pasmu_fecha_local(_ts) $$;

-- Verdadero si quien consulta es persona profesional del caso o revisa contenido.
create or replace function private.pasmu_ver_clinico_caso(_caso_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pasmu_case_has_permission(_caso_id, 'expediente.ver')
    and (private.pasmu_is_case_professional(_caso_id) or private.pasmu_case_has_permission(_caso_id, 'revision.contenido'))
$$;

create or replace function private.pasmu_exigir_profesional(_caso_id bigint, _permiso text)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_unidad bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_case_has_permission(_caso_id, _permiso) and private.pasmu_is_case_professional(_caso_id)) then
    raise exception 'Solo la persona profesional del caso puede registrar esto.' using errcode = '42501';
  end if;
  return v_unidad;
end $$;

-- ——— plan de seguridad (una versión vigente por caso, con historial en auditoría) ———
create table if not exists public.caso_plan_seguridad (
  caso_id bigint primary key references public.casos(id) on delete cascade,
  campos jsonb not null,
  elaborado_en date not null default current_date,
  revisado_en date,
  compartido_con_persona boolean not null default false,
  actualizado_por uuid references public.personas(id) on delete set null,
  constraint chk_plan_campos check (private.pasmu_campos_validos(campos))
);

create or replace function public.pasmu_guardar_plan_seguridad(_caso_id bigint, _campos jsonb, _compartir boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint := private.pasmu_exigir_profesional(_caso_id, 'seguridad.registrar');
begin
  if not private.pasmu_campos_validos(_campos) then raise exception 'Plan inválido: usa solo opciones de las listas.' using errcode = '22023'; end if;
  insert into public.caso_plan_seguridad (caso_id, campos, elaborado_en, compartido_con_persona, actualizado_por)
  values (_caso_id, _campos, private.pasmu_atencion_fecha(), _compartir, private.pasmu_current_persona_id())
  on conflict (caso_id) do update
    set campos = excluded.campos, revisado_en = private.pasmu_atencion_fecha(),
        compartido_con_persona = excluded.compartido_con_persona, actualizado_por = excluded.actualizado_por;
  perform private.pasmu_auditar(v_unidad, 'caso_plan_seguridad', _caso_id::text, 'guardar', jsonb_build_object('compartido', _compartir));
end $$;

-- ——— valoración de riesgo (registrada por la persona profesional; no hay puntaje automático) ———
create table if not exists public.caso_valoraciones_riesgo (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  fecha date not null default current_date,
  ideacion text not null check (ideacion in ('Sin ideación', 'Ideación pasiva', 'Ideación activa sin plan', 'Ideación con plan', 'Ideación con plan e intención')),
  intento_previo text not null,
  acceso_medios text not null,
  disposicion text[] not null default '{}',
  seguimiento_en date,
  seguimiento_hecho boolean not null default false,
  registrada_por uuid references public.personas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_valoraciones_riesgo_caso on public.caso_valoraciones_riesgo (caso_id, fecha desc);

create table if not exists public.incidentes_criticos (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  unidad_id bigint not null references public.unidades(id) on delete restrict,
  tipo text not null check (tipo in ('Riesgo suicida inminente', 'Violencia o abuso', 'Crisis aguda', 'Otro incidente crítico')),
  estado text not null default 'abierto' check (estado in ('abierto', 'atendido', 'cerrado')),
  abierto_en date not null default current_date,
  abierto_por uuid references public.personas(id) on delete set null,
  atendido_en date,
  atendido_por uuid references public.personas(id) on delete set null,
  acciones text[] not null default '{}',
  autoridad text not null default 'No aplica' check (autoridad in ('No aplica', 'Se notificó', 'Pendiente de decidir', 'Se decidió no notificar con justificación')),
  seguimiento_en date,
  cerrado_en date,
  created_at timestamptz not null default now()
);
create index if not exists idx_incidentes_unidad_estado on public.incidentes_criticos (unidad_id, estado);

create or replace function private.pasmu_incidente_abrir(_caso_id bigint, _tipo text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint; v_id bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  select id into v_id from public.incidentes_criticos where caso_id = _caso_id and tipo = _tipo and estado <> 'cerrado';
  if v_id is not null then return v_id; end if;
  insert into public.incidentes_criticos (caso_id, unidad_id, tipo, abierto_en, abierto_por)
  values (_caso_id, v_unidad, _tipo, private.pasmu_atencion_fecha(), private.pasmu_current_persona_id()) returning id into v_id;
  perform private.pasmu_auditar(v_unidad, 'incidentes_criticos', v_id::text, 'abrir', jsonb_build_object('tipo', _tipo));
  return v_id;
end $$;

create or replace function public.pasmu_abrir_incidente(_caso_id bigint, _tipo text)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  perform private.pasmu_exigir_profesional(_caso_id, 'seguridad.registrar');
  return private.pasmu_incidente_abrir(_caso_id, _tipo);
end $$;

create or replace function public.pasmu_registrar_riesgo(
  _caso_id bigint, _ideacion text, _intento text, _acceso text, _disposicion text[], _seguimiento_en date default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_unidad bigint := private.pasmu_exigir_profesional(_caso_id, 'seguridad.registrar');
  v_hoy date := private.pasmu_atencion_fecha();
  v_alta boolean := _ideacion in ('Ideación con plan', 'Ideación con plan e intención');
  v_protocolo boolean := 'Se activó el protocolo de incidente crítico' = any (coalesce(_disposicion, '{}'));
  v_urgente boolean := 'Canalización urgente a servicio de emergencia' = any (coalesce(_disposicion, '{}'));
  v_id bigint;
begin
  if coalesce(array_length(_disposicion, 1), 0) = 0 then raise exception 'Indica qué se hizo: al menos una disposición.' using errcode = '22023'; end if;
  if v_alta and not (v_protocolo or v_urgente) then
    raise exception 'Con ideación con plan es obligatorio activar el protocolo de incidente crítico o canalizar de forma urgente.' using errcode = '22023';
  end if;
  if _ideacion <> 'Sin ideación' then
    if _seguimiento_en is null then raise exception 'Indica la fecha del seguimiento.' using errcode = '22023'; end if;
    if _seguimiento_en < v_hoy or _seguimiento_en > v_hoy + (case when v_alta then 2 else 14 end) then
      raise exception 'El seguimiento debe ser en un máximo de % días.', case when v_alta then 2 else 14 end using errcode = '22023';
    end if;
  end if;
  insert into public.caso_valoraciones_riesgo (caso_id, fecha, ideacion, intento_previo, acceso_medios, disposicion, seguimiento_en, registrada_por)
  values (_caso_id, v_hoy, _ideacion, _intento, _acceso, _disposicion, _seguimiento_en, private.pasmu_current_persona_id())
  returning id into v_id;
  if v_protocolo then perform private.pasmu_incidente_abrir(_caso_id, 'Riesgo suicida inminente'); end if;
  perform private.pasmu_auditar(v_unidad, 'caso_valoraciones_riesgo', v_id::text, 'registrar', jsonb_build_object('ideacion', _ideacion));
  return v_id;
end $$;

create or replace function public.pasmu_completar_seguimiento_riesgo(_valoracion_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caso bigint;
begin
  select caso_id into v_caso from public.caso_valoraciones_riesgo where id = _valoracion_id;
  if v_caso is null then raise exception 'La valoración no existe.' using errcode = '22023'; end if;
  perform private.pasmu_exigir_profesional(v_caso, 'seguridad.registrar');
  update public.caso_valoraciones_riesgo set seguimiento_hecho = true where id = _valoracion_id;
end $$;

create or replace function public.pasmu_atender_incidente(_id bigint, _acciones text[], _autoridad text, _seguimiento_en date)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.incidentes_criticos%rowtype;
begin
  select * into i from public.incidentes_criticos where id = _id;
  if i.id is null then raise exception 'El incidente no existe.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('incidentes.gestionar', i.unidad_id) then raise exception 'Tu perfil no atiende incidentes.' using errcode = '42501'; end if;
  if i.estado <> 'abierto' then raise exception 'El incidente ya fue atendido.' using errcode = '22023'; end if;
  if coalesce(array_length(_acciones, 1), 0) = 0 then raise exception 'Registra al menos una acción realizada.' using errcode = '22023'; end if;
  if _seguimiento_en is null or _seguimiento_en < private.pasmu_atencion_fecha() then raise exception 'Programa la fecha de seguimiento.' using errcode = '22023'; end if;
  update public.incidentes_criticos
    set estado = 'atendido', atendido_en = private.pasmu_atencion_fecha(), atendido_por = private.pasmu_current_persona_id(),
        acciones = _acciones, autoridad = _autoridad, seguimiento_en = _seguimiento_en
    where id = _id;
  perform private.pasmu_auditar(i.unidad_id, 'incidentes_criticos', _id::text, 'atender', jsonb_build_object('autoridad', _autoridad));
end $$;

create or replace function public.pasmu_cerrar_incidente(_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.incidentes_criticos%rowtype;
begin
  select * into i from public.incidentes_criticos where id = _id;
  if i.id is null then raise exception 'El incidente no existe.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('incidentes.gestionar', i.unidad_id) then raise exception 'Tu perfil no cierra incidentes.' using errcode = '42501'; end if;
  if i.estado <> 'atendido' then raise exception 'Primero se atiende el incidente.' using errcode = '22023'; end if;
  if i.seguimiento_en > private.pasmu_atencion_fecha() then raise exception 'Aún no llega la fecha de seguimiento.' using errcode = '22023'; end if;
  update public.incidentes_criticos set estado = 'cerrado', cerrado_en = private.pasmu_atencion_fecha() where id = _id;
  perform private.pasmu_auditar(i.unidad_id, 'incidentes_criticos', _id::text, 'cerrar', '{}'::jsonb);
end $$;

-- ——— consentimientos versionados ———
create table if not exists public.plantillas_consentimiento (
  id text primary key,
  titulo text not null,
  version integer not null default 1,
  obligatoria boolean not null default false,
  vigencia_meses integer check (vigencia_meses is null or vigencia_meses between 1 and 60),
  hash text not null default '',
  activa boolean not null default true
);
insert into public.plantillas_consentimiento (id, titulo, version, obligatoria, vigencia_meses) values
  ('privacidad', 'Aviso de privacidad integral (modelo)', 1, true, null),
  ('atencion', 'Consentimiento informado para la atención psicológica (modelo)', 1, true, 12),
  ('teleconsulta', 'Consentimiento para atención a distancia (modelo)', 1, false, 12),
  ('canales', 'Autorización de canales de contacto y recordatorios (modelo)', 1, false, null),
  ('grabacion', 'Consentimiento para grabación con fines de supervisión (modelo)', 1, false, 6)
on conflict (id) do nothing;

create table if not exists public.consentimientos_aceptados (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  plantilla_id text not null references public.plantillas_consentimiento(id),
  version integer not null,
  aceptado_en date not null default current_date,
  metodo text not null check (metodo in ('En el portal', 'En persona con firma', 'Por la persona acompañada en sesión')),
  registrado_por uuid references public.personas(id) on delete set null,
  revocado_en date,
  created_at timestamptz not null default now()
);
create index if not exists idx_consent_caso on public.consentimientos_aceptados (caso_id, plantilla_id, aceptado_en desc);

-- Solo se puede modificar la fecha de revocación; el resto es inalterable.
create or replace function private.pasmu_consentimiento_inalterable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' or old.revocado_en is not null
     or (to_jsonb(new) - 'revocado_en') is distinct from (to_jsonb(old) - 'revocado_en') then
    raise exception 'El consentimiento es inalterable; solo puede revocarse.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_consent_inalterable on public.consentimientos_aceptados;
create trigger trg_consent_inalterable before update or delete on public.consentimientos_aceptados
  for each row execute function private.pasmu_consentimiento_inalterable();

-- Estado de un consentimiento: vigente, por_vencer (≤1 mes), vencido, revocado, version_anterior o pendiente.
create or replace function private.pasmu_consentimiento_estado(_caso_id bigint, _plantilla text, _hoy date default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  t public.plantillas_consentimiento%rowtype;
  a public.consentimientos_aceptados%rowtype;
  v_hoy date := coalesce(_hoy, private.pasmu_atencion_fecha());
  v_vence date;
begin
  select * into t from public.plantillas_consentimiento where id = _plantilla;
  select * into a from public.consentimientos_aceptados where caso_id = _caso_id and plantilla_id = _plantilla order by aceptado_en desc, id desc limit 1;
  if a.id is null then return 'pendiente'; end if;
  if a.revocado_en is not null then return 'revocado'; end if;
  if a.version <> t.version then return 'version_anterior'; end if;
  if t.vigencia_meses is not null then
    v_vence := (a.aceptado_en + make_interval(months => t.vigencia_meses))::date;
    if v_vence < v_hoy then return 'vencido'; end if;
    if v_vence <= (v_hoy + interval '1 month')::date then return 'por_vencer'; end if;
  end if;
  return 'vigente';
end $$;

create or replace function private.pasmu_consentimientos_faltantes(_caso_id bigint)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.id order by t.id), '{}')
  from public.plantillas_consentimiento t
  where t.obligatoria and t.activa
    and private.pasmu_consentimiento_estado(_caso_id, t.id) not in ('vigente', 'por_vencer')
$$;

create or replace function public.pasmu_aceptar_consentimiento(_caso_id bigint, _plantilla text, _metodo text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare t public.plantillas_consentimiento%rowtype; v_id bigint; v_unidad bigint;
begin
  select * into t from public.plantillas_consentimiento where id = _plantilla and activa;
  if t.id is null then raise exception 'La plantilla no existe.' using errcode = '22023'; end if;
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  -- La persona acepta lo suyo en el portal; el personal solo si tiene permiso y es de su caso.
  if private.pasmu_soy_persona_del_caso(_caso_id) then
    if _metodo <> 'En el portal' then raise exception 'Desde el portal el método es «En el portal».' using errcode = '22023'; end if;
  elsif not (private.pasmu_case_has_permission(_caso_id, 'consentimientos.registrar')
             and (private.pasmu_is_case_professional(_caso_id) or not private.pasmu_mis_roles(v_unidad) && array['terapeuta', 'coterapeuta'])) then
    raise exception 'Sin permiso para registrar este consentimiento.' using errcode = '42501';
  end if;
  insert into public.consentimientos_aceptados (caso_id, plantilla_id, version, aceptado_en, metodo, registrado_por)
  values (_caso_id, _plantilla, t.version, private.pasmu_atencion_fecha(), _metodo, private.pasmu_current_persona_id()) returning id into v_id;
  perform private.pasmu_auditar(v_unidad, 'consentimientos_aceptados', v_id::text, 'aceptar', jsonb_build_object('plantilla', _plantilla));
  return v_id;
end $$;

create or replace function public.pasmu_revocar_consentimiento(_caso_id bigint, _plantilla text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint; v_id bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if not (private.pasmu_soy_persona_del_caso(_caso_id) or (private.pasmu_case_has_permission(_caso_id, 'consentimientos.registrar')
          and (private.pasmu_is_case_professional(_caso_id) or not private.pasmu_mis_roles(v_unidad) && array['terapeuta', 'coterapeuta']))) then
    raise exception 'Sin permiso para revocar este consentimiento.' using errcode = '42501';
  end if;
  select id into v_id from public.consentimientos_aceptados
    where caso_id = _caso_id and plantilla_id = _plantilla and revocado_en is null order by aceptado_en desc, id desc limit 1;
  if v_id is null then raise exception 'No hay consentimiento vigente que revocar.' using errcode = '22023'; end if;
  update public.consentimientos_aceptados set revocado_en = private.pasmu_atencion_fecha() where id = v_id;
  perform private.pasmu_auditar(v_unidad, 'consentimientos_aceptados', v_id::text, 'revocar', jsonb_build_object('plantilla', _plantilla));
end $$;

-- ——— mediciones de resultado (PHQ-9, GAD-7 y escalas breves propias) ———
create table if not exists public.mediciones_resultado (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  instrumento text not null check (instrumento in ('phq9', 'gad7', 'resultado', 'alianza')),
  fecha date not null default current_date,
  items integer[] not null,
  total integer not null,
  item_riesgo integer,
  registrada_por uuid references public.personas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mediciones_caso on public.mediciones_resultado (caso_id, instrumento, fecha);

-- Cuántos ítems y qué rango admite cada instrumento; el total solo se suma, la persona profesional interpreta.
create or replace function public.pasmu_registrar_medicion(_caso_id bigint, _instrumento text, _items integer[])
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_unidad bigint; v_n integer; v_max integer; v_id bigint; v_riesgo integer;
  v_persona boolean := private.pasmu_soy_persona_del_caso(_caso_id);
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not v_persona then perform private.pasmu_exigir_profesional(_caso_id, 'resultados.registrar'); end if;
  v_n := case _instrumento when 'phq9' then 9 when 'gad7' then 7 when 'resultado' then 4 when 'alianza' then 4 end;
  v_max := case _instrumento when 'phq9' then 3 when 'gad7' then 3 else 10 end;
  if v_n is null then raise exception 'Instrumento inválido.' using errcode = '22023'; end if;
  if coalesce(array_length(_items, 1), 0) <> v_n or exists (select 1 from unnest(_items) x where x is null or x < 0 or x > v_max) then
    raise exception 'Respuestas incompletas o fuera de rango.' using errcode = '22023';
  end if;
  v_riesgo := case when _instrumento = 'phq9' then _items[9] end;
  insert into public.mediciones_resultado (caso_id, instrumento, fecha, items, total, item_riesgo, registrada_por)
  values (_caso_id, _instrumento, private.pasmu_atencion_fecha(), _items, (select sum(x) from unnest(_items) x), v_riesgo, private.pasmu_current_persona_id())
  returning id into v_id;
  return v_id;
end $$;

-- ——— tareas entre sesiones y diario ———
create table if not exists public.tareas_caso (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  tipo text not null,
  titulo text not null check (char_length(titulo) <= 80),
  asignada_en date not null default current_date,
  limite_en date not null,
  estado text not null default 'asignada' check (estado in ('asignada', 'entregada', 'revisada')),
  dificultad text,
  entregada_en date,
  retro text,
  asignada_por uuid references public.personas(id) on delete set null
);
create index if not exists idx_tareas_caso on public.tareas_caso (caso_id, estado);

create table if not exists public.diario_caso (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  fecha date not null default current_date,
  emocion text not null,
  disparadores text[] not null default '{}',
  compartido boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.pasmu_asignar_tarea(_caso_id bigint, _tipo text, _titulo text, _limite_en date)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  perform private.pasmu_exigir_profesional(_caso_id, 'resultados.registrar');
  if _limite_en is null or _limite_en < private.pasmu_atencion_fecha() then raise exception 'La fecha límite no puede ser pasada.' using errcode = '22023'; end if;
  insert into public.tareas_caso (caso_id, tipo, titulo, limite_en, asignada_por)
  values (_caso_id, _tipo, _titulo, _limite_en, private.pasmu_current_persona_id()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.pasmu_entregar_tarea(_id bigint, _dificultad text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caso bigint;
begin
  select caso_id into v_caso from public.tareas_caso where id = _id and estado = 'asignada';
  if v_caso is null or not private.pasmu_soy_persona_del_caso(v_caso) then raise exception 'Tarea no disponible para entregar.' using errcode = '42501'; end if;
  update public.tareas_caso set estado = 'entregada', entregada_en = private.pasmu_atencion_fecha(), dificultad = _dificultad where id = _id;
end $$;

create or replace function public.pasmu_revisar_tarea(_id bigint, _retro text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caso bigint;
begin
  select caso_id into v_caso from public.tareas_caso where id = _id and estado = 'entregada';
  if v_caso is null then raise exception 'Solo se revisa una tarea entregada.' using errcode = '22023'; end if;
  perform private.pasmu_exigir_profesional(v_caso, 'resultados.registrar');
  update public.tareas_caso set estado = 'revisada', retro = _retro where id = _id;
end $$;

create or replace function public.pasmu_diario_agregar(_caso_id bigint, _emocion text, _disparadores text[], _compartido boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not private.pasmu_soy_persona_del_caso(_caso_id) then raise exception 'El diario es de la persona usuaria.' using errcode = '42501'; end if;
  insert into public.diario_caso (caso_id, fecha, emocion, disparadores, compartido)
  values (_caso_id, private.pasmu_atencion_fecha(), _emocion, coalesce(_disparadores, '{}'), coalesce(_compartido, false)) returning id into v_id;
  return v_id;
end $$;

-- ——— credenciales del personal ———
create table if not exists public.credenciales_personal (
  persona_id uuid primary key references public.personas(id) on delete cascade,
  cedula text check (cedula is null or cedula ~ '^[0-9]{7,8}$'),
  titulo text,
  especialidad text,
  verificada_en date,
  verificada_por uuid references public.personas(id) on delete set null,
  seguro_vence_en date,
  constancia_vence_en date
);

create or replace function private.pasmu_credencial_estado(_persona uuid, _hoy date default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare c public.credenciales_personal%rowtype; v_hoy date := coalesce(_hoy, private.pasmu_atencion_fecha());
begin
  select * into c from public.credenciales_personal where persona_id = _persona;
  if c.persona_id is null or c.cedula is null or c.verificada_en is null then return 'sin_verificar'; end if;
  if (c.seguro_vence_en is not null and c.seguro_vence_en < v_hoy) or (c.constancia_vence_en is not null and c.constancia_vence_en < v_hoy) then return 'vencida'; end if;
  if (c.seguro_vence_en is not null and c.seguro_vence_en <= v_hoy + 30) or (c.constancia_vence_en is not null and c.constancia_vence_en <= v_hoy + 30) then return 'por_vencer'; end if;
  return 'vigente';
end $$;

create or replace function public.pasmu_guardar_credencial(_persona uuid, _cedula text, _titulo text, _especialidad text, _seguro date, _constancia date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  select exists (select 1 from public.miembros m where m.persona_id = _persona and m.activo and private.pasmu_has_permission('personal.gestionar', m.unidad_id)) into v_ok;
  if not (v_ok or private.pasmu_es_admin_global()) then raise exception 'Tu perfil no gestiona credenciales.' using errcode = '42501'; end if;
  if _cedula is not null and _cedula !~ '^[0-9]{7,8}$' then raise exception 'La cédula tiene 7 u 8 dígitos.' using errcode = '22023'; end if;
  insert into public.credenciales_personal (persona_id, cedula, titulo, especialidad, seguro_vence_en, constancia_vence_en)
  values (_persona, _cedula, _titulo, _especialidad, _seguro, _constancia)
  on conflict (persona_id) do update set
    verificada_en = case when public.credenciales_personal.cedula is distinct from excluded.cedula then null else public.credenciales_personal.verificada_en end,
    verificada_por = case when public.credenciales_personal.cedula is distinct from excluded.cedula then null else public.credenciales_personal.verificada_por end,
    cedula = excluded.cedula, titulo = excluded.titulo, especialidad = excluded.especialidad,
    seguro_vence_en = excluded.seguro_vence_en, constancia_vence_en = excluded.constancia_vence_en;
  perform private.pasmu_auditar(null, 'credenciales_personal', _persona::text, 'guardar', '{}'::jsonb);
end $$;

create or replace function public.pasmu_verificar_credencial(_persona uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (private.pasmu_es_admin_global() or exists (select 1 from public.miembros m where m.persona_id = _persona and m.activo and private.pasmu_has_permission('personal.gestionar', m.unidad_id))) then
    raise exception 'Tu perfil no verifica credenciales.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.credenciales_personal where persona_id = _persona and cedula is not null) then
    raise exception 'Registra primero la cédula.' using errcode = '22023';
  end if;
  update public.credenciales_personal set verificada_en = private.pasmu_atencion_fecha(), verificada_por = private.pasmu_current_persona_id() where persona_id = _persona;
  perform private.pasmu_auditar(null, 'credenciales_personal', _persona::text, 'verificar', '{}'::jsonb);
end $$;

-- ——— derivaciones ———
create table if not exists public.derivaciones (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  tipo text not null,
  destino text not null,
  estado text not null default 'solicitada' check (estado in ('solicitada', 'aceptada', 'atendida', 'sin_respuesta', 'cerrada')),
  solicitada_en date not null default current_date,
  vence_en date not null,
  solicitada_por uuid references public.personas(id) on delete set null
);
create index if not exists idx_derivaciones_caso on public.derivaciones (caso_id, estado);

create or replace function public.pasmu_crear_derivacion(_caso_id bigint, _tipo text, _destino text, _plazo_dias integer default 15)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint; v_id bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_case_has_permission(_caso_id, 'derivaciones.gestionar')
          and (private.pasmu_is_case_professional(_caso_id) or not private.pasmu_mis_roles(v_unidad) && array['terapeuta', 'coterapeuta'])) then
    raise exception 'Sin permiso para derivar este caso.' using errcode = '42501';
  end if;
  insert into public.derivaciones (caso_id, tipo, destino, vence_en, solicitada_por)
  values (_caso_id, _tipo, _destino, private.pasmu_atencion_fecha() + greatest(1, least(coalesce(_plazo_dias, 15), 90)), private.pasmu_current_persona_id())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.pasmu_actualizar_derivacion(_id bigint, _estado text)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.derivaciones%rowtype; v_unidad bigint;
begin
  select * into d from public.derivaciones where id = _id;
  if d.id is null then raise exception 'La derivación no existe.' using errcode = '22023'; end if;
  select unidad_id into v_unidad from public.casos where id = d.caso_id;
  if not (private.pasmu_case_has_permission(d.caso_id, 'derivaciones.gestionar')
          and (private.pasmu_is_case_professional(d.caso_id) or not private.pasmu_mis_roles(v_unidad) && array['terapeuta', 'coterapeuta'])) then
    raise exception 'Sin permiso para esta derivación.' using errcode = '42501';
  end if;
  if not (
       (d.estado = 'solicitada' and _estado in ('aceptada', 'atendida', 'sin_respuesta'))
    or (d.estado = 'aceptada' and _estado in ('atendida', 'sin_respuesta'))
    or (d.estado = 'atendida' and _estado = 'cerrada')
    or (d.estado = 'sin_respuesta' and _estado in ('solicitada', 'cerrada'))) then
    raise exception 'Transición no permitida: % → %.', d.estado, _estado using errcode = '22023';
  end if;
  update public.derivaciones set estado = _estado where id = _id;
end $$;

-- ——— satisfacción anónima: sin caso ni persona en la respuesta ———
create table if not exists public.encuestas_satisfaccion (
  id bigserial primary key,
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  mes date not null,
  nps integer not null check (nps between 0 and 10),
  escuchado integer not null check (escuchado between 1 and 5)
);
-- Control de una respuesta por caso y mes; no guarda qué se contestó.
create table if not exists public.encuestas_control (
  caso_id bigint not null references public.casos(id) on delete cascade,
  mes date not null,
  primary key (caso_id, mes)
);

create or replace function public.pasmu_enviar_encuesta(_caso_id bigint, _nps integer, _escuchado integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint; v_mes date := date_trunc('month', private.pasmu_atencion_fecha())::date;
begin
  if not private.pasmu_soy_persona_del_caso(_caso_id) then raise exception 'Solo la persona usuaria responde la encuesta.' using errcode = '42501'; end if;
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if exists (select 1 from public.encuestas_control where caso_id = _caso_id and mes = v_mes) then
    raise exception 'Ya respondiste la encuesta de este mes.' using errcode = '22023';
  end if;
  insert into public.encuestas_control values (_caso_id, v_mes);
  insert into public.encuestas_satisfaccion (unidad_id, mes, nps, escuchado) values (v_unidad, v_mes, _nps, _escuchado);
end $$;

-- Solo agregados y con grupo mínimo de 5 respuestas (protege el anonimato en unidades pequeñas).
create or replace function public.pasmu_resumen_encuesta(_unidad_id bigint default null)
returns table (n bigint, nps numeric, escuchado numeric, suprimido boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if _unidad_id is null then
    if not private.pasmu_es_admin_global() then raise exception 'Sin permiso.' using errcode = '42501'; end if;
  elsif not (private.pasmu_has_permission('dashboard.ver', _unidad_id) or private.pasmu_es_admin_global()) then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  return query
    select count(*)::bigint,
           case when count(*) >= 5 then round(100.0 * (count(*) filter (where e.nps >= 9) - count(*) filter (where e.nps <= 6)) / count(*), 0) end,
           case when count(*) >= 5 then round(avg(e.escuchado), 1) end,
           count(*) < 5
    from public.encuestas_satisfaccion e where _unidad_id is null or e.unidad_id = _unidad_id;
end $$;

-- ——— practicantes: firma de horas, competencias y revisión al 100 % ———
alter table public.horas_practica add column if not exists firmada_por uuid references public.personas(id) on delete set null;
alter table public.horas_practica add column if not exists firmada_en date;
alter table public.practicantes add column if not exists horas_requeridas integer not null default 480;

create table if not exists public.caso_practicantes (
  caso_id bigint not null references public.casos(id) on delete cascade,
  practicante_id bigint not null references public.practicantes(id) on delete cascade,
  primary key (caso_id, practicante_id)
);

create or replace function private.pasmu_practicante_unidad(_practicante_id bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select m.unidad_id from public.practicantes p join public.miembros m on m.persona_id = p.persona_id and m.activo
  where p.id = _practicante_id order by m.id limit 1
$$;

create or replace function public.pasmu_registrar_horas_practica(_practicante_id bigint, _fecha date, _horas numeric, _actividad text, _caso_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not exists (select 1 from public.practicantes where id = _practicante_id and persona_id = private.pasmu_current_persona_id())
     and not private.pasmu_has_permission('practicantes.gestionar', private.pasmu_practicante_unidad(_practicante_id)) then
    raise exception 'Sin permiso para registrar horas.' using errcode = '42501';
  end if;
  if _horas is null or _horas <= 0 or _horas > 12 then raise exception 'Las horas deben estar entre 0.5 y 12.' using errcode = '22023'; end if;
  insert into public.horas_practica (practicante_id, caso_id, fecha, horas, tipo_actividad) values (_practicante_id, _caso_id, _fecha, _horas, _actividad) returning id into v_id;
  return v_id;
end $$;

create or replace function public.pasmu_firmar_horas_practica(_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare h public.horas_practica%rowtype; p public.practicantes%rowtype;
begin
  select * into h from public.horas_practica where id = _id;
  select * into p from public.practicantes where id = h.practicante_id;
  if h.id is null then raise exception 'Registro inexistente.' using errcode = '22023'; end if;
  if h.firmada_por is not null then raise exception 'Las horas ya están firmadas.' using errcode = '22023'; end if;
  if p.persona_id = private.pasmu_current_persona_id() then raise exception 'No puedes firmar tus propias horas.' using errcode = '42501'; end if;
  if not (p.supervisor_id = private.pasmu_current_persona_id() or private.pasmu_has_permission('practicantes.gestionar', private.pasmu_practicante_unidad(p.id))) then
    raise exception 'Solo la supervisión firma las horas.' using errcode = '42501';
  end if;
  update public.horas_practica set firmada_por = private.pasmu_current_persona_id(), firmada_en = private.pasmu_atencion_fecha() where id = _id;
end $$;

create or replace function public.pasmu_evaluar_competencia(_practicante_id bigint, _competencia text, _nivel text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_comp bigint; v_sup uuid;
begin
  select supervisor_id into v_sup from public.practicantes where id = _practicante_id;
  if not (v_sup = private.pasmu_current_persona_id() or private.pasmu_has_permission('practicantes.gestionar', private.pasmu_practicante_unidad(_practicante_id))) then
    raise exception 'Solo la supervisión evalúa competencias.' using errcode = '42501';
  end if;
  select id into v_comp from public.competencias where nombre = _competencia limit 1;
  if v_comp is null then
    insert into public.competencias (codigo, nombre) values (left(regexp_replace(lower(_competencia), '[^a-z0-9]+', '_', 'g'), 60), _competencia)
    on conflict (codigo) do update set nombre = excluded.nombre returning id into v_comp;
  end if;
  insert into public.practicante_competencias (practicante_id, competencia_id, nivel, supervisado_por) values (_practicante_id, v_comp, _nivel, private.pasmu_current_persona_id());
end $$;

-- ——— alertas e indicadores de atención segura (paridad con web/src/lib/operacion.js) ———
create or replace function public.pasmu_alertas_atencion(_unidad_id bigint default null, _hoy date default current_date)
returns table (tipo text, caso_id bigint, detalle text, responsable text, dias integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pasmu_puede_ver_operacion(_unidad_id, null) then raise exception 'Sin permiso para ver la operación.' using errcode = '42501'; end if;
  return query
    -- incidentes sin atender: 0-1 día supervisión, 2 días responsable de unidad, 3 o más dirección
    select 'Incidente'::text, i.caso_id, i.tipo || ' sin atender', case when _hoy - i.abierto_en >= 3 then 'Dirección' when _hoy - i.abierto_en >= 2 then 'Responsable de unidad' else 'Supervisión clínica' end, (_hoy - i.abierto_en)
    from public.incidentes_criticos i where i.estado = 'abierto' and (_unidad_id is null or i.unidad_id = _unidad_id)
    union all
    select 'Riesgo', v.caso_id, 'Seguimiento de riesgo vencido (' || v.ideacion || ')', 'Persona terapeuta', (_hoy - v.seguimiento_en)
    from public.caso_valoraciones_riesgo v join public.casos c on c.id = v.caso_id
    where not v.seguimiento_hecho and v.seguimiento_en is not null and v.seguimiento_en < _hoy and (_unidad_id is null or c.unidad_id = _unidad_id)
    union all
    select 'Derivación', d.caso_id, 'Derivación a ' || d.destino || ' fuera de plazo', 'Coordinación clínica', (_hoy - d.vence_en)
    from public.derivaciones d join public.casos c on c.id = d.caso_id
    where d.estado not in ('cerrada', 'atendida') and d.vence_en < _hoy and (_unidad_id is null or c.unidad_id = _unidad_id);
end $$;

-- ——— programar cita exige consentimientos obligatorios y credencial vigente ———
do $$
declare v_def text;
begin
  select pg_get_functiondef('private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text)'::regprocedure) into v_def;
  if position('pasmu_consentimientos_faltantes' in v_def) = 0 then
    v_def := replace(v_def,
      'if _fin <= _inicio then raise exception',
      'if coalesce(array_length(private.pasmu_consentimientos_faltantes(_caso_id), 1), 0) > 0 then
    raise exception ''Faltan consentimientos obligatorios vigentes: no se puede programar la sesión.'' using errcode = ''22023'';
  end if;
  if _fin <= _inicio then raise exception');
    execute v_def;
  end if;
end $$;

-- ——— revisión de practicantes al 100 %: los casos con practicante siempre entran a la muestra ———
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'pasmu_kpis_operacion' limit 1;
  if v_def is not null and position('caso_practicantes' in v_def) = 0 then
    v_def := replace(v_def,
      'or ((a.id * 37 + 11) % 100) <',
      'or exists (select 1 from public.caso_practicantes cp where cp.caso_id = cs.id)
         or ((a.id * 37 + 11) % 100) <');
    execute v_def;
  end if;
end $$;

-- ——— RLS: lectura por política, escritura solo por funciones ———
alter table public.caso_plan_seguridad enable row level security;
alter table public.caso_valoraciones_riesgo enable row level security;
alter table public.incidentes_criticos enable row level security;
alter table public.plantillas_consentimiento enable row level security;
alter table public.consentimientos_aceptados enable row level security;
alter table public.mediciones_resultado enable row level security;
alter table public.tareas_caso enable row level security;
alter table public.diario_caso enable row level security;
alter table public.credenciales_personal enable row level security;
alter table public.derivaciones enable row level security;
alter table public.encuestas_satisfaccion enable row level security;
alter table public.encuestas_control enable row level security;
alter table public.caso_practicantes enable row level security;

revoke all on public.caso_plan_seguridad, public.caso_valoraciones_riesgo, public.incidentes_criticos, public.plantillas_consentimiento,
  public.consentimientos_aceptados, public.mediciones_resultado, public.tareas_caso, public.diario_caso, public.credenciales_personal,
  public.derivaciones, public.encuestas_satisfaccion, public.encuestas_control, public.caso_practicantes from public, anon, authenticated;
grant select on public.caso_plan_seguridad, public.caso_valoraciones_riesgo, public.incidentes_criticos, public.plantillas_consentimiento,
  public.consentimientos_aceptados, public.mediciones_resultado, public.tareas_caso, public.diario_caso, public.credenciales_personal,
  public.derivaciones, public.caso_practicantes to authenticated;
-- Las respuestas de la encuesta no se leen directo: solo el agregado con grupo mínimo.

drop policy if exists plantillas_leer on public.plantillas_consentimiento;
create policy plantillas_leer on public.plantillas_consentimiento for select to authenticated using (true);

drop policy if exists plan_leer on public.caso_plan_seguridad;
create policy plan_leer on public.caso_plan_seguridad for select to authenticated
  using (private.pasmu_ver_clinico_caso(caso_id) or (compartido_con_persona and private.pasmu_soy_persona_del_caso(caso_id)));
drop policy if exists riesgo_leer on public.caso_valoraciones_riesgo;
create policy riesgo_leer on public.caso_valoraciones_riesgo for select to authenticated using (private.pasmu_ver_clinico_caso(caso_id));
drop policy if exists incidentes_leer on public.incidentes_criticos;
create policy incidentes_leer on public.incidentes_criticos for select to authenticated
  using (private.pasmu_has_permission('incidentes.gestionar', unidad_id) or private.pasmu_ver_clinico_caso(caso_id) or private.pasmu_es_admin_global());
drop policy if exists consent_leer on public.consentimientos_aceptados;
create policy consent_leer on public.consentimientos_aceptados for select to authenticated
  using (private.pasmu_soy_persona_del_caso(caso_id) or private.pasmu_case_has_permission(caso_id, 'consentimientos.registrar') or private.pasmu_ver_clinico_caso(caso_id));
drop policy if exists mediciones_leer on public.mediciones_resultado;
create policy mediciones_leer on public.mediciones_resultado for select to authenticated
  using (private.pasmu_ver_clinico_caso(caso_id) or private.pasmu_soy_persona_del_caso(caso_id));
drop policy if exists tareas_leer on public.tareas_caso;
create policy tareas_leer on public.tareas_caso for select to authenticated
  using (private.pasmu_ver_clinico_caso(caso_id) or private.pasmu_soy_persona_del_caso(caso_id));
drop policy if exists diario_leer on public.diario_caso;
create policy diario_leer on public.diario_caso for select to authenticated
  using (private.pasmu_soy_persona_del_caso(caso_id) or (compartido and private.pasmu_ver_clinico_caso(caso_id)));
drop policy if exists credenciales_leer on public.credenciales_personal;
create policy credenciales_leer on public.credenciales_personal for select to authenticated
  using (persona_id = private.pasmu_current_persona_id() or private.pasmu_es_admin_global()
         or exists (select 1 from public.miembros m where m.persona_id = credenciales_personal.persona_id and m.activo and private.pasmu_has_permission('personal.gestionar', m.unidad_id)));
drop policy if exists derivaciones_leer on public.derivaciones;
create policy derivaciones_leer on public.derivaciones for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'derivaciones.gestionar') or private.pasmu_ver_clinico_caso(caso_id));
drop policy if exists caso_practicantes_leer on public.caso_practicantes;
create policy caso_practicantes_leer on public.caso_practicantes for select to authenticated using (private.pasmu_ver_clinico_caso(caso_id));

-- ——— permisos de ejecución ———
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'pasmu_guardar_plan_seguridad', 'pasmu_abrir_incidente', 'pasmu_registrar_riesgo', 'pasmu_completar_seguimiento_riesgo',
             'pasmu_atender_incidente', 'pasmu_cerrar_incidente', 'pasmu_aceptar_consentimiento', 'pasmu_revocar_consentimiento',
             'pasmu_registrar_medicion', 'pasmu_asignar_tarea', 'pasmu_entregar_tarea', 'pasmu_revisar_tarea', 'pasmu_diario_agregar',
             'pasmu_guardar_credencial', 'pasmu_verificar_credencial', 'pasmu_crear_derivacion', 'pasmu_actualizar_derivacion',
             'pasmu_enviar_encuesta', 'pasmu_resumen_encuesta', 'pasmu_registrar_horas_practica', 'pasmu_firmar_horas_practica',
             'pasmu_evaluar_competencia', 'pasmu_alertas_atencion')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
revoke all on function private.pasmu_consentimientos_faltantes(bigint), private.pasmu_consentimiento_estado(bigint, text, date),
  private.pasmu_credencial_estado(uuid, date), private.pasmu_incidente_abrir(bigint, text), private.pasmu_exigir_profesional(bigint, text),
  private.pasmu_ver_clinico_caso(bigint) from public, anon;
grant execute on function private.pasmu_ver_clinico_caso(bigint), private.pasmu_consentimientos_faltantes(bigint) to authenticated;

commit;
