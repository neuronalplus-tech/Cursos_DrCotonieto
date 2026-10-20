-- PASMU 39: historial de metas, catálogo de indicadores por unidad, dependencias y unidades, riesgo en la lista de espera,
-- canalización a talleres, solicitudes de seguimiento y visto bueno a las altas de las personas responsables.
-- Solo PRUEBAS. Idempotente. Requiere 24, 25, 28, 32 y 36.
-- Pendiente (no incluido): los permisos ajustados por persona del directorio; hoy los permisos salen del rol (rol_permisos).
begin;

create or replace function private.pasmu_es_direccion()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles())
$$;

-- ——— permisos nuevos ———
insert into public.permisos (codigo, descripcion, categoria) values
  ('incidentes.ver', 'Ver los incidentes críticos sin atenderlos', 'clinico'),
  ('riesgo.valorar', 'Valorar el riesgo de quien espera atención', 'clinico'),
  ('seguimientos.solicitar', 'Solicitar seguimiento a la persona responsable de la unidad', 'admin'),
  ('seguimientos.responder', 'Responder las solicitudes de seguimiento', 'admin')
on conflict (codigo) do update set descripcion = excluded.descripcion, activo = true;

insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, v.ambito
from (values
  ('direccion_pasmu', 'incidentes.ver', 'institucion'), ('direccion_pasmu', 'seguimientos.solicitar', 'institucion'),
  ('responsable_unidad', 'riesgo.valorar', 'unidad'), ('responsable_unidad', 'seguimientos.responder', 'unidad'),
  ('coordinador_clinico', 'riesgo.valorar', 'unidad'), ('coordinador_clinico', 'seguimientos.responder', 'unidad'),
  ('terapeuta', 'riesgo.valorar', 'unidad'), ('practicante', 'riesgo.valorar', 'unidad'),
  ('administracion_global', 'incidentes.ver', 'institucion'), ('administracion_global', 'seguimientos.solicitar', 'institucion')
) as v(rol, permiso, ambito)
join public.roles r on r.codigo = v.rol
join public.permisos p on p.codigo = v.permiso
on conflict (rol_id, permiso_id) do nothing;
-- Dirección ya no atiende incidentes: solo los ve.
delete from public.rol_permisos rp using public.roles r, public.permisos p
 where rp.rol_id = r.id and rp.permiso_id = p.id and r.codigo = 'direccion_pasmu' and p.codigo = 'incidentes.gestionar';

-- ——— historial de metas, fases y líneas base ———
create table if not exists public.historial_metas (
  id bigserial primary key,
  fecha date not null default current_date,
  unidad_id bigint references public.unidades(id) on delete set null, -- null = global
  tipo text not null check (tipo in ('meta', 'fase', 'linea_base', 'alta_unidad')),
  codigo text not null,
  etiqueta text not null,
  antes text,
  despues text,
  por uuid references public.personas(id) on delete set null,
  motivo text check (motivo is null or char_length(motivo) <= 300),
  creado_en timestamptz not null default now()
);
create index if not exists idx_historial_metas on public.historial_metas (fecha desc, id desc);
drop trigger if exists trg_historial_metas_inalterable on public.historial_metas;
create trigger trg_historial_metas_inalterable before update or delete on public.historial_metas
  for each row execute function private.pasmu_bloquear_modificacion();

create or replace function private.pasmu_historial_registrar(_unidad bigint, _tipo text, _codigo text, _etiqueta text, _antes text, _despues text)
returns void language sql security definer set search_path = '' as $$
  insert into public.historial_metas (unidad_id, tipo, codigo, etiqueta, antes, despues, por, motivo)
  values (_unidad, _tipo, _codigo, _etiqueta, _antes, _despues, private.pasmu_current_persona_id(),
          nullif(btrim(coalesce(current_setting('pasmu.motivo', true), '')), ''))
$$;

create or replace function private.pasmu_trg_historial_metas()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.pasmu_historial_registrar(old.unidad_id, 'meta', old.codigo, old.codigo, old.valor::text, null);
    return old;
  end if;
  if tg_op = 'INSERT' or old.valor is distinct from new.valor then
    perform private.pasmu_historial_registrar(new.unidad_id, 'meta', new.codigo, new.codigo, case when tg_op = 'UPDATE' then old.valor::text end, new.valor::text);
  end if;
  return new;
end $$;
drop trigger if exists trg_metas_historial on public.metas_operacion;
create trigger trg_metas_historial after insert or update or delete on public.metas_operacion
  for each row execute function private.pasmu_trg_historial_metas();

create or replace function private.pasmu_trg_historial_fase()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint := case tg_table_name when 'unidad_ajustes' then new.unidad_id end;
begin
  if tg_op = 'INSERT' or old.fase is distinct from new.fase then
    perform private.pasmu_historial_registrar(v_unidad, 'fase', 'fase', 'Fase de implementación',
      case when tg_op = 'UPDATE' then case old.fase when 'metas' then 'Metas definitivas' else 'Línea base' end end,
      case new.fase when 'metas' then 'Metas definitivas' else 'Línea base' end);
  end if;
  return new;
end $$;
drop trigger if exists trg_unidad_ajustes_historial on public.unidad_ajustes;
create trigger trg_unidad_ajustes_historial after insert or update on public.unidad_ajustes
  for each row execute function private.pasmu_trg_historial_fase();
drop trigger if exists trg_ajustes_globales_historial on public.ajustes_globales;
create trigger trg_ajustes_globales_historial after update on public.ajustes_globales
  for each row execute function private.pasmu_trg_historial_fase();

create or replace function private.pasmu_trg_historial_linea_base()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.pasmu_historial_registrar(new.unidad_id, 'linea_base', 'linea_base', 'Línea base registrada', null, new.fecha::text);
  return new;
end $$;
drop trigger if exists trg_lineas_base_historial on public.lineas_base;
create trigger trg_lineas_base_historial after insert on public.lineas_base
  for each row execute function private.pasmu_trg_historial_linea_base();

-- Meta con motivo: el motivo queda en el historial.
create or replace function public.pasmu_meta_guardar_motivo(_unidad_id bigint, _codigo text, _valor numeric, _motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('pasmu.motivo', left(coalesce(_motivo, ''), 300), true);
  perform public.pasmu_meta_guardar(_unidad_id, _codigo, _valor);
end $$;

-- Las metas también pueden ser de los indicadores que se agreguen después.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.metas_operacion'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%asistencia%'
  loop execute format('alter table public.metas_operacion drop constraint %I', c.conname); end loop;
  if not exists (select 1 from pg_constraint where conname = 'chk_metas_codigo_formato') then
    alter table public.metas_operacion add constraint chk_metas_codigo_formato check (codigo ~ '^[a-z][a-z0-9_]{2,40}$');
  end if;
end $$;

alter table public.historial_metas enable row level security;
revoke all on public.historial_metas from public, anon, authenticated;
grant select on public.historial_metas to authenticated;
drop policy if exists historial_metas_leer on public.historial_metas;
create policy historial_metas_leer on public.historial_metas for select to authenticated
  using (private.pasmu_es_direccion() or unidad_id is null or private.pasmu_has_permission('dashboard.ver', unidad_id));

-- ——— catálogo de indicadores y los que mide cada unidad ———
create table if not exists public.indicadores_catalogo (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]{2,40}$'),
  nombre text not null check (char_length(nombre) between 5 and 100),
  unidad_medida text not null default 'valor',
  sentido text not null default 'min' check (sentido in ('min', 'max')),
  definicion text not null default '',
  tipo text not null default 'manual' check (tipo in ('calculado', 'manual')),
  informativo boolean not null default false,
  alta_en date not null default current_date,
  alta_por uuid references public.personas(id) on delete set null
);
insert into public.indicadores_catalogo (codigo, nombre, unidad_medida, sentido, tipo, informativo, definicion) values
  ('asistencia', 'Asistencia a sesiones', '%', 'min', 'calculado', false, 'Realizadas ÷ (realizadas + no asistió)'),
  ('cancelacion', 'Cancelaciones', '%', 'max', 'calculado', false, 'Canceladas ÷ sesiones ocurridas o canceladas'),
  ('espera_maxima', 'Espera máxima sin terapeuta', 'días', 'max', 'calculado', false, 'Días del expediente más antiguo sin terapeuta'),
  ('primer_contacto', 'Días a la primera sesión', 'días', 'max', 'calculado', false, 'Promedio entre apertura y primera sesión'),
  ('sin_seguimiento', 'Casos sin seguimiento', 'casos', 'max', 'calculado', false, 'Activos sin sesión en 14 días ni cita próxima'),
  ('notas_pendientes', 'Notas por firmar', 'notas', 'max', 'calculado', false, 'Sesiones realizadas con nota sin firmar'),
  ('pases_pendientes', 'Pases sin registrar', 'sesiones', 'max', 'calculado', false, 'Sesiones programadas con fecha pasada'),
  ('tamizaje', 'Cobertura de tamizaje', '%', 'min', 'calculado', false, 'Casos con todos los instrumentos obligatorios'),
  ('revision', 'Notas firmadas con revisión', '%', 'min', 'calculado', false, 'Notas de la muestra que ya tienen checklist'),
  ('historia', 'Historias clínicas completas', '%', 'min', 'calculado', false, 'Historias con todos los campos obligatorios'),
  ('capacidad', 'Ocupación semanal de la agenda', '%', 'min', 'calculado', true, 'Sesiones de la semana ÷ capacidad ofrecida'),
  ('intervalo_sesiones', 'Días entre sesiones', 'días', 'max', 'calculado', true, 'Promedio entre sesiones consecutivas'),
  ('abandono', 'Cierres por abandono', '%', 'max', 'calculado', true, 'Cerrados por abandono ÷ cerrados con motivo'),
  ('talleres', 'Ocupación de talleres', '%', 'min', 'calculado', false, 'Participantes ÷ cupo')
on conflict (codigo) do nothing;

create table if not exists public.unidad_indicadores (
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  indicador_codigo text not null references public.indicadores_catalogo(codigo) on delete restrict,
  activado_en date not null default current_date,
  primary key (unidad_id, indicador_codigo)
);
-- Las unidades que ya existían siguen midiendo todo lo calculado.
insert into public.unidad_indicadores (unidad_id, indicador_codigo)
select u.id, c.codigo from public.unidades u cross join public.indicadores_catalogo c where c.tipo = 'calculado'
on conflict do nothing;

create table if not exists public.valores_indicadores_manuales (
  id bigserial primary key,
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  indicador_codigo text not null references public.indicadores_catalogo(codigo) on delete restrict,
  periodo date not null check (periodo = date_trunc('month', periodo)::date),
  valor numeric not null check (valor >= 0 and valor <= 100000),
  capturado_por uuid references public.personas(id) on delete set null,
  capturado_en timestamptz not null default now(),
  unique (unidad_id, indicador_codigo, periodo)
);

alter table public.unidades add column if not exists padre_id bigint references public.unidades(id) on delete set null;
alter table public.unidades add column if not exists nombre_unidad_atencion text;

create or replace function public.pasmu_indicador_agregar(_nombre text, _unidad_medida text, _sentido text, _definicion text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_codigo text; v_base text; v_n integer := 2;
begin
  if not private.pasmu_es_direccion() then raise exception 'Solo Dirección PASMU agrega indicadores al catálogo.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(_nombre, ''))) < 5 then raise exception 'Escribe el nombre del indicador (mínimo 5 caracteres).' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_definicion, ''))) < 10 then raise exception 'Describe cómo se mide (mínimo 10 caracteres).' using errcode = '22023'; end if;
  if _sentido not in ('min', 'max') then raise exception 'Sentido no válido.' using errcode = '22023'; end if;
  if exists (select 1 from public.indicadores_catalogo where lower(nombre) = lower(btrim(_nombre))) then raise exception 'Ya existe un indicador con ese nombre.' using errcode = '22023'; end if;
  v_base := left(regexp_replace(lower(translate(btrim(_nombre), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '_', 'g'), 36);
  v_base := trim(both '_' from v_base);
  if v_base !~ '^[a-z]' then v_base := 'i_' || v_base; end if;
  v_codigo := v_base;
  while exists (select 1 from public.indicadores_catalogo where codigo = v_codigo) loop v_codigo := v_base || '_' || v_n; v_n := v_n + 1; end loop;
  insert into public.indicadores_catalogo (codigo, nombre, unidad_medida, sentido, definicion, tipo, alta_por)
  values (v_codigo, btrim(_nombre), coalesce(nullif(btrim(_unidad_medida), ''), 'valor'), _sentido, btrim(_definicion), 'manual', private.pasmu_current_persona_id());
  perform private.pasmu_auditar(null, 'indicadores_catalogo', v_codigo, 'INSERT', jsonb_build_object('nombre', _nombre));
  return v_codigo;
end $$;

create or replace function public.pasmu_unidad_indicadores_guardar(_unidad_id bigint, _codigos text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pasmu_es_direccion() then raise exception 'Solo Dirección PASMU elige los indicadores de cada unidad.' using errcode = '42501'; end if;
  if not exists (select 1 from public.unidades where id = _unidad_id) then raise exception 'La unidad no existe.' using errcode = '22023'; end if;
  if coalesce(array_length(_codigos, 1), 0) = 0 or exists (select 1 from unnest(_codigos) c where c not in (select codigo from public.indicadores_catalogo)) then
    raise exception 'Elige al menos un indicador del catálogo.' using errcode = '22023';
  end if;
  delete from public.unidad_indicadores where unidad_id = _unidad_id and not (indicador_codigo = any (_codigos));
  insert into public.unidad_indicadores (unidad_id, indicador_codigo) select _unidad_id, c from unnest(_codigos) c on conflict do nothing;
  perform private.pasmu_auditar(_unidad_id, 'unidad_indicadores', _unidad_id::text, 'UPDATE', jsonb_build_object('indicadores', _codigos));
end $$;

create or replace function public.pasmu_indicador_valor_registrar(_unidad_id bigint, _codigo text, _periodo date, _valor numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_mes date := date_trunc('month', _periodo)::date;
begin
  if not (private.pasmu_es_direccion() or private.pasmu_has_permission('unidad.configurar', _unidad_id) or private.pasmu_has_permission('casos.asignar', _unidad_id)) then
    raise exception 'Tu perfil no captura indicadores de esta unidad.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.indicadores_catalogo where codigo = _codigo and tipo = 'manual') then raise exception 'Ese indicador no es de captura manual.' using errcode = '22023'; end if;
  if not exists (select 1 from public.unidad_indicadores where unidad_id = _unidad_id and indicador_codigo = _codigo) then raise exception 'Ese indicador no está activo para la unidad.' using errcode = '22023'; end if;
  if v_mes > date_trunc('month', current_date)::date then raise exception 'El periodo no puede ser futuro.' using errcode = '22023'; end if;
  insert into public.valores_indicadores_manuales (unidad_id, indicador_codigo, periodo, valor, capturado_por)
  values (_unidad_id, _codigo, v_mes, _valor, private.pasmu_current_persona_id())
  on conflict (unidad_id, indicador_codigo, periodo) do update set valor = excluded.valor, capturado_por = excluded.capturado_por, capturado_en = now();
end $$;

-- Alta de una dependencia o unidad con los indicadores que se le medirán (de todo el catálogo vigente ese día).
create or replace function public.pasmu_unidad_alta(_nombre text, _codigo text, _tipo text, _padre_id bigint, _nombre_unidad text, _indicadores text[], _fase text default 'linea_base')
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_inst bigint;
begin
  if not private.pasmu_es_direccion() then raise exception 'Solo Dirección PASMU da de alta dependencias y unidades.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(_nombre, ''))) < 3 then raise exception 'Escribe el nombre (mínimo 3 caracteres).' using errcode = '22023'; end if;
  if _fase not in ('linea_base', 'metas') then raise exception 'Fase no válida.' using errcode = '22023'; end if;
  if coalesce(array_length(_indicadores, 1), 0) = 0 or exists (select 1 from unnest(_indicadores) c where c not in (select codigo from public.indicadores_catalogo)) then
    raise exception 'Elige al menos un indicador del catálogo.' using errcode = '22023';
  end if;
  if exists (select 1 from public.unidades where lower(nombre) = lower(btrim(_nombre)) or codigo = _codigo) then raise exception 'Ya existe una unidad con ese nombre o código.' using errcode = '22023'; end if;
  select coalesce((select institucion_id from public.unidades where id = _padre_id), (select id from public.instituciones order by id limit 1)) into v_inst;
  insert into public.unidades (institucion_id, nombre, codigo, tipo, padre_id, nombre_unidad_atencion)
  values (v_inst, btrim(_nombre), _codigo, coalesce(nullif(btrim(_tipo), ''), 'instituto'), _padre_id, nullif(btrim(_nombre_unidad), '')) returning id into v_id;
  insert into public.unidad_ajustes (unidad_id, fase, actualizado_por) values (v_id, _fase, private.pasmu_current_persona_id());
  insert into public.unidad_indicadores (unidad_id, indicador_codigo) select v_id, c from unnest(_indicadores) c;
  perform private.pasmu_historial_registrar(v_id, 'alta_unidad', 'alta', 'Alta de la unidad', null, btrim(_nombre));
  perform private.pasmu_auditar(v_id, 'unidades', v_id::text, 'INSERT', jsonb_build_object('indicadores', _indicadores));
  return v_id;
end $$;

-- ——— riesgo durante la espera ———
create table if not exists public.casos_riesgo_espera (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  fecha date not null default current_date,
  etapa text not null check (etapa in ('Solicitud', 'Evaluación inicial', 'Primera entrevista', 'Contacto durante la espera', 'Sesión')),
  nivel text not null check (nivel in ('Bajo', 'Moderado', 'Alto', 'Inminente')),
  nota text check (nota is null or char_length(nota) <= 200),
  por uuid references public.personas(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists idx_riesgo_espera_caso on public.casos_riesgo_espera (caso_id, fecha desc, id desc);
drop trigger if exists trg_riesgo_espera_inalterable on public.casos_riesgo_espera;
create trigger trg_riesgo_espera_inalterable before update or delete on public.casos_riesgo_espera
  for each row execute function private.pasmu_bloquear_modificacion();

create or replace function public.pasmu_riesgo_espera_registrar(_caso_id bigint, _nivel text, _etapa text, _nota text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint; v_id bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('riesgo.valorar', v_unidad) then raise exception 'Tu perfil no valora el riesgo.' using errcode = '42501'; end if;
  if _nivel in ('Alto', 'Inminente') and char_length(btrim(coalesce(_nota, ''))) < 5 then raise exception 'Con riesgo alto o inminente escribe el motivo de la valoración.' using errcode = '22023'; end if;
  insert into public.casos_riesgo_espera (caso_id, etapa, nivel, nota, por)
  values (_caso_id, _etapa, _nivel, left(btrim(_nota), 200), private.pasmu_current_persona_id()) returning id into v_id;
  if _nivel = 'Inminente' then perform private.pasmu_incidente_abrir(_caso_id, 'Riesgo suicida inminente'); end if;
  perform private.pasmu_auditar(v_unidad, 'casos_riesgo_espera', v_id::text, 'INSERT', jsonb_build_object('nivel', _nivel, 'etapa', _etapa));
  return v_id;
end $$;

-- Canalización a taller (bajo o moderado, mismo instituto y con cupo).
create table if not exists public.canalizaciones_taller (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  taller_id bigint not null references public.talleres(id) on delete restrict,
  fecha date not null default current_date,
  por uuid references public.personas(id) on delete set null,
  activa boolean not null default true
);
create unique index if not exists uq_canalizacion_activa on public.canalizaciones_taller (caso_id) where activa;

-- Lista de espera priorizada. Mismo orden que la aplicación: riesgo (inminente 100, alto 60, sin valorar 40, moderado 30, bajo 10)
-- + 1 por día de espera + 15 si tiene prioridad administrativa + 20 si la valoración tiene más de 7 días (salvo riesgo bajo).
create or replace function public.pasmu_lista_espera(_unidad_id bigint default null, _hoy date default current_date)
returns table (caso_id bigint, unidad_id bigint, nivel text, etapa text, fecha_valoracion date, dias_espera integer, prioritaria boolean, valoracion_vencida boolean, puntos integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.pasmu_es_direccion() or (_unidad_id is not null and (private.pasmu_has_permission('casos.ver', _unidad_id) or private.pasmu_has_permission('dashboard.ver', _unidad_id)))) then
    raise exception 'Sin permiso para ver la lista de espera.' using errcode = '42501';
  end if;
  return query
  with espera as (
    select c.id, c.unidad_id, (_hoy - r.solicitada_en) as dias,
           coalesce((select p.nivel = 'prioritaria' from public.casos_prioridad p where p.caso_id = c.id), false) as prio,
           (select x.nivel from public.casos_riesgo_espera x where x.caso_id = c.id order by x.fecha desc, x.id desc limit 1) as nivel,
           (select x.etapa from public.casos_riesgo_espera x where x.caso_id = c.id order by x.fecha desc, x.id desc limit 1) as etapa,
           (select x.fecha from public.casos_riesgo_espera x where x.caso_id = c.id order by x.fecha desc, x.id desc limit 1) as fecha_val
    from public.casos c join public.casos_ruta r on r.caso_id = c.id
    where c.estado <> 'cerrado' and c.responsable_actual_id is null
      and not exists (select 1 from public.canalizaciones_taller t where t.caso_id = c.id and t.activa)
      and (_unidad_id is null or c.unidad_id = _unidad_id)
  )
  select e.id, e.unidad_id, coalesce(e.nivel, 'Sin valorar'), e.etapa, e.fecha_val, e.dias, e.prio,
         (coalesce(e.nivel, 'Sin valorar') <> 'Bajo' and (e.fecha_val is null or _hoy - e.fecha_val > 7)) as vencida,
         (case coalesce(e.nivel, 'Sin valorar') when 'Inminente' then 100 when 'Alto' then 60 when 'Sin valorar' then 40 when 'Moderado' then 30 else 10 end
          + e.dias + (case when e.prio then 15 else 0 end)
          + (case when coalesce(e.nivel, 'Sin valorar') <> 'Bajo' and (e.fecha_val is null or _hoy - e.fecha_val > 7) then 20 else 0 end))::integer as puntos
  from espera e order by puntos desc, e.dias desc, e.id;
end $$;

create or replace function public.pasmu_canalizar_taller(_caso_id bigint, _taller_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c public.casos%rowtype; t public.talleres%rowtype; v_nivel text; v_id bigint;
begin
  select * into c from public.casos where id = _caso_id;
  select * into t from public.talleres where id = _taller_id;
  if c.id is null or t.id is null then raise exception 'El expediente o el taller no existe.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('casos.asignar', c.unidad_id) then raise exception 'Tu perfil no canaliza a talleres: esa decisión es de la unidad.' using errcode = '42501'; end if;
  if c.responsable_actual_id is not null then raise exception 'La persona ya tiene terapeuta.' using errcode = '22023'; end if;
  select nivel into v_nivel from public.casos_riesgo_espera where caso_id = _caso_id order by fecha desc, id desc limit 1;
  if v_nivel is null then raise exception 'Primero registra la valoración de riesgo.' using errcode = '22023'; end if;
  if v_nivel not in ('Bajo', 'Moderado') then raise exception 'Con riesgo % se requiere atención individual: no se canaliza a taller.', lower(v_nivel) using errcode = '22023'; end if;
  if t.unidad_id <> c.unidad_id then raise exception 'El taller debe ser del mismo instituto.' using errcode = '22023'; end if;
  if t.estado = 'realizado' then raise exception 'Ese taller ya concluyó.' using errcode = '22023'; end if;
  if t.inscritos >= t.cupo then raise exception 'El taller ya no tiene lugares disponibles.' using errcode = '22023'; end if;
  if exists (select 1 from public.canalizaciones_taller where caso_id = _caso_id and activa) then raise exception 'La persona ya está canalizada a un taller.' using errcode = '22023'; end if;
  insert into public.canalizaciones_taller (caso_id, taller_id, por) values (_caso_id, _taller_id, private.pasmu_current_persona_id()) returning id into v_id;
  update public.talleres set inscritos = inscritos + 1 where id = _taller_id;
  perform private.pasmu_auditar(c.unidad_id, 'canalizaciones_taller', v_id::text, 'INSERT', jsonb_build_object('taller', _taller_id));
  return v_id;
end $$;

create or replace function public.pasmu_canalizacion_revertir(_caso_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare k public.canalizaciones_taller%rowtype; v_unidad bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if not private.pasmu_has_permission('casos.asignar', v_unidad) then raise exception 'Tu perfil no cambia esta canalización.' using errcode = '42501'; end if;
  select * into k from public.canalizaciones_taller where caso_id = _caso_id and activa;
  if k.id is null then raise exception 'La persona no está canalizada a un taller.' using errcode = '22023'; end if;
  update public.canalizaciones_taller set activa = false where id = k.id;
  update public.talleres set inscritos = greatest(inscritos - 1, 0) where id = k.taller_id;
end $$;

-- ——— solicitudes de seguimiento ———
create table if not exists public.solicitudes_seguimiento (
  id bigserial primary key,
  caso_id bigint not null references public.casos(id) on delete cascade,
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  solicitada_en date not null default current_date,
  solicitada_por uuid references public.personas(id) on delete set null,
  nota text not null check (char_length(nota) between 5 and 300),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'respondida')),
  motivo text check (motivo is null or motivo in ('Horarios de la persona usuaria', 'Horarios de la persona terapeuta', 'Disponibilidad de espacios', 'Saturación del servicio',
    'Falta de personas terapeutas en la unidad', 'Sin respuesta de la persona usuaria', 'Canalizada a taller', 'Otro motivo')),
  respuesta text check (respuesta is null or char_length(respuesta) <= 400),
  respondida_en date,
  respondida_por uuid references public.personas(id) on delete set null,
  siguiente_fecha date
);
create unique index if not exists uq_seguimiento_pendiente on public.solicitudes_seguimiento (caso_id) where estado = 'pendiente';

create or replace function public.pasmu_seguimiento_solicitar(_caso_id bigint, _nota text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_unidad bigint; v_id bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_es_direccion() or private.pasmu_has_permission('seguimientos.solicitar', v_unidad)) then raise exception 'Tu perfil no solicita seguimiento.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(_nota, ''))) < 5 then raise exception 'Escribe qué necesitas saber (mínimo 5 caracteres).' using errcode = '22023'; end if;
  if exists (select 1 from public.solicitudes_seguimiento where caso_id = _caso_id and estado = 'pendiente') then raise exception 'Ya hay una solicitud pendiente para este expediente.' using errcode = '22023'; end if;
  insert into public.solicitudes_seguimiento (caso_id, unidad_id, solicitada_por, nota) values (_caso_id, v_unidad, private.pasmu_current_persona_id(), btrim(_nota)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.pasmu_seguimiento_responder(_id bigint, _motivo text, _respuesta text, _siguiente date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_seguimiento%rowtype;
begin
  select * into s from public.solicitudes_seguimiento where id = _id;
  if s.id is null then raise exception 'La solicitud no existe.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('seguimientos.responder', s.unidad_id) then raise exception 'Tu perfil no responde solicitudes de seguimiento de esta unidad.' using errcode = '42501'; end if;
  if s.estado <> 'pendiente' then raise exception 'Esa solicitud ya fue respondida.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(_respuesta, ''))) < 5 then raise exception 'Explica brevemente la situación (mínimo 5 caracteres).' using errcode = '22023'; end if;
  if _siguiente is not null and _siguiente < current_date then raise exception 'La fecha de la siguiente acción no puede ser pasada.' using errcode = '22023'; end if;
  update public.solicitudes_seguimiento set estado = 'respondida', motivo = _motivo, respuesta = btrim(_respuesta), respondida_en = current_date,
    respondida_por = private.pasmu_current_persona_id(), siguiente_fecha = _siguiente where id = _id;
end $$;

-- ——— visto bueno a las altas de las personas responsables ———
create table if not exists public.politica_visto_bueno (
  id smallint primary key default 1 check (id = 1),
  activo boolean not null default true,
  meses integer not null default 3 check (meses between 0 and 24)
);
insert into public.politica_visto_bueno (id) values (1) on conflict (id) do nothing;
create table if not exists public.persona_visto_bueno (
  persona_id uuid primary key references public.personas(id) on delete cascade,
  modo text not null default 'auto' check (modo in ('auto', 'siempre', 'nunca'))
);
create table if not exists public.solicitudes_visto_bueno (
  id bigserial primary key,
  tipo text not null default 'alta' check (tipo in ('alta')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  unidad_id bigint not null references public.unidades(id) on delete cascade,
  solicitada_por uuid not null references public.personas(id) on delete cascade,
  solicitada_en date not null default current_date,
  resumen text not null,
  email text not null, nombre text not null, rol_codigo text not null,
  decidida_en date, decidida_por uuid references public.personas(id) on delete set null, comentario text check (comentario is null or char_length(comentario) <= 300)
);

create or replace function private.pasmu_requiere_visto_bueno(_persona uuid default null)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_persona uuid := coalesce(_persona, private.pasmu_current_persona_id()); p public.politica_visto_bueno%rowtype; v_modo text; v_inicio date;
begin
  select * into p from public.politica_visto_bueno where id = 1;
  if not p.activo then return false; end if;
  if not exists (select 1 from public.miembros m join public.roles r on r.id = m.rol_id where m.persona_id = v_persona and m.activo and r.codigo = 'responsable_unidad') then return false; end if;
  select modo into v_modo from public.persona_visto_bueno where persona_id = v_persona;
  if v_modo = 'nunca' then return false; end if;
  if v_modo = 'siempre' then return true; end if;
  select min(m.fecha_inicio) into v_inicio from public.miembros m join public.roles r on r.id = m.rol_id where m.persona_id = v_persona and r.codigo = 'responsable_unidad';
  return v_inicio is null or (current_date - v_inicio) < (p.meses * 30);
end $$;

create or replace function public.pasmu_visto_bueno_politica_guardar(_activo boolean, _meses integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pasmu_es_direccion() then raise exception 'Solo Dirección PASMU define cuándo se exige visto bueno.' using errcode = '42501'; end if;
  if _meses not between 0 and 24 then raise exception 'Los meses deben estar entre 0 y 24.' using errcode = '22023'; end if;
  update public.politica_visto_bueno set activo = coalesce(_activo, true), meses = _meses where id = 1;
end $$;

create or replace function public.pasmu_visto_bueno_persona_guardar(_persona uuid, _modo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pasmu_es_direccion() then raise exception 'Solo Dirección PASMU define el visto bueno por persona.' using errcode = '42501'; end if;
  if _modo not in ('auto', 'siempre', 'nunca') then raise exception 'Modo no válido.' using errcode = '22023'; end if;
  insert into public.persona_visto_bueno (persona_id, modo) values (_persona, _modo) on conflict (persona_id) do update set modo = excluded.modo;
end $$;

-- Si la persona que da de alta necesita visto bueno, queda una solicitud; si no, se registra la pre-alta de inmediato.
create or replace function public.pasmu_alta_equipo_solicitar(_email text, _nombre text, _rol text, _unidad bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare v_yo uuid := private.pasmu_current_persona_id();
begin
  if v_yo is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if not private.pasmu_requiere_visto_bueno(v_yo) then
    perform public.pasmu_prealta_equipo(_email, _nombre, _rol, _unidad);
    return 'registrada';
  end if;
  if _rol not in ('clinico_administrativo', 'practicante', 'tallerista', 'terapeuta') or not private.pasmu_has_permission('altas.personal', _unidad) then
    raise exception 'Solo en tus unidades y con los roles de tu equipo.' using errcode = '42501';
  end if;
  insert into public.solicitudes_visto_bueno (unidad_id, solicitada_por, resumen, email, nombre, rol_codigo)
  values (_unidad, v_yo, 'Alta de ' || btrim(_nombre) || ' como ' || _rol, lower(btrim(_email)), btrim(_nombre), _rol);
  return 'pendiente_de_visto_bueno';
end $$;

create or replace function public.pasmu_visto_bueno_decidir(_id bigint, _aprobar boolean, _comentario text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_visto_bueno%rowtype;
begin
  if not private.pasmu_es_direccion() then raise exception 'Solo Dirección PASMU da el visto bueno.' using errcode = '42501'; end if;
  select * into s from public.solicitudes_visto_bueno where id = _id;
  if s.id is null then raise exception 'La solicitud no existe.' using errcode = '22023'; end if;
  if s.estado <> 'pendiente' then raise exception 'Esa solicitud ya fue resuelta.' using errcode = '22023'; end if;
  if not _aprobar and char_length(btrim(coalesce(_comentario, ''))) < 5 then raise exception 'Al rechazar, explica el motivo (mínimo 5 caracteres).' using errcode = '22023'; end if;
  if _aprobar then
    insert into public.prealtas_equipo (email, nombre, rol_codigo, unidad_id, creada_por) values (s.email, s.nombre, s.rol_codigo, s.unidad_id, s.solicitada_por);
  end if;
  update public.solicitudes_visto_bueno set estado = case when _aprobar then 'aprobada' else 'rechazada' end, decidida_en = current_date,
    decidida_por = private.pasmu_current_persona_id(), comentario = left(btrim(_comentario), 300) where id = _id;
  perform private.pasmu_auditar(s.unidad_id, 'solicitudes_visto_bueno', _id::text, 'UPDATE', jsonb_build_object('aprobada', _aprobar));
end $$;

-- ——— RLS y permisos de ejecución ———
alter table public.indicadores_catalogo enable row level security;
alter table public.unidad_indicadores enable row level security;
alter table public.valores_indicadores_manuales enable row level security;
alter table public.casos_riesgo_espera enable row level security;
alter table public.canalizaciones_taller enable row level security;
alter table public.solicitudes_seguimiento enable row level security;
alter table public.politica_visto_bueno enable row level security;
alter table public.persona_visto_bueno enable row level security;
alter table public.solicitudes_visto_bueno enable row level security;
revoke all on public.indicadores_catalogo, public.unidad_indicadores, public.valores_indicadores_manuales, public.casos_riesgo_espera,
  public.canalizaciones_taller, public.solicitudes_seguimiento, public.politica_visto_bueno, public.persona_visto_bueno, public.solicitudes_visto_bueno
  from public, anon, authenticated;
grant select on public.indicadores_catalogo, public.unidad_indicadores, public.valores_indicadores_manuales, public.casos_riesgo_espera,
  public.canalizaciones_taller, public.solicitudes_seguimiento, public.politica_visto_bueno, public.persona_visto_bueno, public.solicitudes_visto_bueno to authenticated;

drop policy if exists catalogo_leer on public.indicadores_catalogo;
create policy catalogo_leer on public.indicadores_catalogo for select to authenticated using (true);
drop policy if exists unidad_indicadores_leer on public.unidad_indicadores;
create policy unidad_indicadores_leer on public.unidad_indicadores for select to authenticated using (private.pasmu_es_direccion() or private.pasmu_is_unit_member(unidad_id));
drop policy if exists valores_manuales_leer on public.valores_indicadores_manuales;
create policy valores_manuales_leer on public.valores_indicadores_manuales for select to authenticated using (private.pasmu_es_direccion() or private.pasmu_has_permission('dashboard.ver', unidad_id));
drop policy if exists riesgo_espera_leer on public.casos_riesgo_espera;
create policy riesgo_espera_leer on public.casos_riesgo_espera for select to authenticated
  using (private.pasmu_ver_clinico_caso(caso_id) or private.pasmu_case_has_permission(caso_id, 'casos.asignar') or private.pasmu_es_direccion());
drop policy if exists canalizaciones_leer on public.canalizaciones_taller;
create policy canalizaciones_leer on public.canalizaciones_taller for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'casos.asignar') or private.pasmu_ver_clinico_caso(caso_id) or private.pasmu_es_direccion());
drop policy if exists seguimientos_leer on public.solicitudes_seguimiento;
create policy seguimientos_leer on public.solicitudes_seguimiento for select to authenticated
  using (private.pasmu_es_direccion() or private.pasmu_has_permission('seguimientos.responder', unidad_id));
drop policy if exists politica_vb_leer on public.politica_visto_bueno;
create policy politica_vb_leer on public.politica_visto_bueno for select to authenticated using (true);
drop policy if exists persona_vb_leer on public.persona_visto_bueno;
create policy persona_vb_leer on public.persona_visto_bueno for select to authenticated using (private.pasmu_es_direccion() or persona_id = private.pasmu_current_persona_id());
drop policy if exists solicitudes_vb_leer on public.solicitudes_visto_bueno;
create policy solicitudes_vb_leer on public.solicitudes_visto_bueno for select to authenticated
  using (private.pasmu_es_direccion() or solicitada_por = private.pasmu_current_persona_id());

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'pasmu_meta_guardar_motivo', 'pasmu_indicador_agregar', 'pasmu_unidad_indicadores_guardar', 'pasmu_indicador_valor_registrar', 'pasmu_unidad_alta',
    'pasmu_riesgo_espera_registrar', 'pasmu_lista_espera', 'pasmu_canalizar_taller', 'pasmu_canalizacion_revertir', 'pasmu_seguimiento_solicitar',
    'pasmu_seguimiento_responder', 'pasmu_visto_bueno_politica_guardar', 'pasmu_visto_bueno_persona_guardar', 'pasmu_alta_equipo_solicitar', 'pasmu_visto_bueno_decidir')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
revoke all on function private.pasmu_es_direccion(), private.pasmu_requiere_visto_bueno(uuid), private.pasmu_historial_registrar(bigint, text, text, text, text, text) from public, anon;
-- Las políticas de lectura la llaman con la sesión de quien consulta.
grant execute on function private.pasmu_es_direccion() to authenticated;

commit;
