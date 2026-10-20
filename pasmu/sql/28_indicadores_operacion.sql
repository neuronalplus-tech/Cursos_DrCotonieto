-- PASMU 28: indicadores de operación calculados en la base (paridad con src/lib/operacion.js, ruta.js y actividad.js),
-- alertas con escalamiento, ruta de atención, series de actividad y línea base → metas.
-- Solo PRUEBAS. Idempotente. Requiere 24, 25 y 27. Solo lectura sobre datos clínicos: devuelve agregados.
--
-- Convención de agenda.estado: programada, realizada, no_asistio, cancelada.
-- Convención de casos.estado: abierto (activo) o cerrado.
begin;

-- Instrumentos obligatorios (tamizaje): global (unidad nula) o por unidad.
create table if not exists public.instrumentos_obligatorios (
  id bigserial primary key,
  unidad_id bigint references public.unidades(id) on delete cascade,
  instrumento_id bigint not null references public.catalogo_instrumentos(id) on delete cascade
);
create unique index if not exists uq_instrumentos_obligatorios
  on public.instrumentos_obligatorios (coalesce(unidad_id, 0), instrumento_id);
alter table public.instrumentos_obligatorios enable row level security;
revoke all on table public.instrumentos_obligatorios from public, anon, authenticated;
grant select on table public.instrumentos_obligatorios to authenticated;
drop policy if exists instrumentos_obligatorios_read on public.instrumentos_obligatorios;
create policy instrumentos_obligatorios_read on public.instrumentos_obligatorios for select to authenticated
  using (unidad_id is null or private.pasmu_es_admin_global() or private.pasmu_is_unit_member(unidad_id));

create or replace function public.pasmu_instrumento_obligatorio_guardar(_unidad_id bigint, _instrumento_id bigint, _activo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _unidad_id is null then
    if not private.pasmu_es_admin_global() then
      raise exception 'Solo la administración global define los instrumentos obligatorios globales.' using errcode = '42501';
    end if;
  elsif not (private.pasmu_es_admin_global() or private.pasmu_has_permission('unidad.configurar', _unidad_id)) then
    raise exception 'Sin permiso unidad.configurar.' using errcode = '42501';
  end if;
  if coalesce(_activo, false) then
    insert into public.instrumentos_obligatorios (unidad_id, instrumento_id) values (_unidad_id, _instrumento_id) on conflict do nothing;
  else
    delete from public.instrumentos_obligatorios where coalesce(unidad_id, 0) = coalesce(_unidad_id, 0) and instrumento_id = _instrumento_id;
  end if;
end;
$$;

-- ——— utilidades ———
create or replace function private.pasmu_fecha_local(_ts timestamptz)
returns date
language sql
stable
as $$ select (_ts at time zone 'America/Mexico_City')::date $$;

create or replace function private.pasmu_semaforo(_valor numeric, _meta numeric, _direccion text)
returns text
language sql
immutable
as $$
  select case
    when _valor is null or _meta is null then 'sin_dato'
    when (case when _direccion = 'min' then _valor >= _meta else _valor <= _meta end) then 'verde'
    when (case when _direccion = 'min'
               then _valor >= _meta - (case when _meta = 0 then 3 else abs(_meta) * 0.2 end)
               else _valor <= _meta + (case when _meta = 0 then 3 else abs(_meta) * 0.2 end) end) then 'ambar'
    else 'rojo'
  end
$$;

-- Meta vigente: la de la unidad si existe y, si no, la global.
create or replace function private.pasmu_meta(_unidad_id bigint, _codigo text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select m.valor from public.metas_operacion m
  where m.codigo = _codigo and (m.unidad_id = _unidad_id or m.unidad_id is null)
  order by (m.unidad_id is null) asc
  limit 1
$$;

create or replace function private.pasmu_fase(_unidad_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when _unidad_id is null
    then (select g.fase from public.ajustes_globales g where g.id = 1)
    else coalesce((select a.fase from public.unidad_ajustes a where a.unidad_id = _unidad_id), 'linea_base') end
$$;

-- Quién puede consultar un ámbito: global (administración global o dirección), unidad (dashboard.ver) o la propia persona.
create or replace function private.pasmu_puede_ver_operacion(_unidad_id bigint, _persona_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.pasmu_es_admin_global()
    or 'direccion_pasmu' = any (private.pasmu_mis_roles())
    or (_unidad_id is not null and private.pasmu_has_permission('dashboard.ver', _unidad_id))
    or (_persona_id is not null and _persona_id = private.pasmu_current_persona_id())
$$;

-- Casos del ámbito consultado: una unidad, una persona terapeuta o todo.
create or replace function private.pasmu_casos_alcance(_unidad_id bigint, _persona_id uuid)
returns table (id bigint, unidad_id bigint, estado text, responsable uuid, solicitada date)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.unidad_id, c.estado, c.responsable_actual_id, r.solicitada_en
  from public.casos c
  join public.casos_ruta r on r.caso_id = c.id
  where (_unidad_id is null or c.unidad_id = _unidad_id)
    and (_persona_id is null or c.responsable_actual_id = _persona_id)
$$;

-- ——— indicadores ———
create or replace function public.pasmu_kpis_operacion(
  _unidad_id bigint default null,
  _hoy date default current_date,
  _persona_id uuid default null)
returns table (codigo text, valor numeric, meta numeric, direccion text, fase text, estado text, informativo boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fase text := private.pasmu_fase(_unidad_id);
  v_semana date := date_trunc('week', _hoy)::date;
  v_asist numeric; v_cancel numeric; v_espera numeric; v_primer numeric; v_sinseg numeric; v_notas numeric;
  v_pases numeric; v_tamiz numeric; v_hist numeric; v_rev numeric; v_cap numeric; v_interv numeric; v_aband numeric;
  v_ofrecidas numeric; v_usadas numeric;
  v_claves_historia text[] := array['sexo', 'estudios', 'laboral', 'civil', 'sintomas', 'areas', 'descarga', 'eva',
                                    'apoyo', 'protectores', 'riesgo', 'estado'];
begin
  if not private.pasmu_puede_ver_operacion(_unidad_id, _persona_id) then
    raise exception 'Sin permiso para consultar estos indicadores.' using errcode = '42501';
  end if;

  -- asistencia y cancelación
  select round(100.0 * count(*) filter (where a.estado = 'realizada') / nullif(count(*) filter (where a.estado in ('realizada', 'no_asistio')), 0), 1),
         round(100.0 * count(*) filter (where a.estado = 'cancelada')
               / nullif(count(*) filter (where a.estado in ('realizada', 'no_asistio', 'cancelada')), 0), 1),
         count(*) filter (where a.estado = 'programada' and private.pasmu_fecha_local(a.fecha_inicio) < _hoy)
    into v_asist, v_cancel, v_pases
  from public.agenda a join private.pasmu_casos_alcance(_unidad_id, _persona_id) cs on cs.id = a.caso_id;

  -- espera máxima (casos activos sin terapeuta)
  select coalesce(max(_hoy - cs.solicitada), 0) into v_espera from private.pasmu_casos_alcance(_unidad_id, _persona_id) cs where cs.estado <> 'cerrado' and cs.responsable is null;

  -- días a la primera sesión
  select round(avg(p.primera - cs.solicitada), 1) into v_primer
  from private.pasmu_casos_alcance(_unidad_id, _persona_id) cs
  join lateral (select min(private.pasmu_fecha_local(a.fecha_inicio)) as primera from public.agenda a
                where a.caso_id = cs.id and a.estado = 'realizada') p on p.primera is not null;

  -- sin seguimiento: activo, con terapeuta, sin cita próxima y sin sesión realizada en 14 días
  select count(*) into v_sinseg
  from private.pasmu_casos_alcance(_unidad_id, _persona_id) cs
  where cs.estado <> 'cerrado' and cs.responsable is not null
    and not exists (select 1 from public.agenda a where a.caso_id = cs.id and a.estado = 'programada' and private.pasmu_fecha_local(a.fecha_inicio) >= _hoy)
    and _hoy - coalesce((select max(private.pasmu_fecha_local(a.fecha_inicio)) from public.agenda a where a.caso_id = cs.id and a.estado = 'realizada'), cs.solicitada) >= 14;

  -- notas por firmar: sesiones realizadas sin nota firmada
  select count(*) into v_notas
  from public.agenda a join private.pasmu_casos_alcance(_unidad_id, _persona_id) cs on cs.id = a.caso_id
  where a.estado = 'realizada'
    and not exists (select 1 from public.notas_soap n where n.agenda_id = a.id and n.estado = 'firmada');

  -- tamizaje: instrumentos obligatorios (globales + de la unidad) con resultado
  select round(100.0 * count(*) filter (where not exists (
      select 1 from public.instrumentos_obligatorios io
      where (io.unidad_id is null or io.unidad_id = cs.unidad_id)
        and not exists (select 1 from public.evaluaciones_psicologicas e where e.caso_id = cs.id and e.instrumento_id = io.instrumento_id)))
    / nullif(count(*), 0), 1)
    into v_tamiz
  from private.pasmu_casos_alcance(_unidad_id, _persona_id) cs where cs.estado <> 'cerrado' and cs.responsable is not null;

  -- historias completas (última versión con todos los campos obligatorios)
  select round(100.0 * count(*) filter (where h.campos is not null and h.campos ?& v_claves_historia
      and not exists (select 1 from unnest(v_claves_historia) k
                      where jsonb_typeof(h.campos -> k) = 'array' and jsonb_array_length(h.campos -> k) = 0))
    / nullif(count(*), 0), 1)
    into v_hist
  from private.pasmu_casos_alcance(_unidad_id, _persona_id) cs
  left join lateral (select campos from public.historia_integral hi where hi.caso_id = cs.id order by hi.creada_en desc, hi.id desc limit 1) h on true
  where cs.estado <> 'cerrado' and cs.responsable is not null;

  -- revisión: notas firmadas que están en la muestra o ya fueron revisadas
  select round(100.0 * count(*) filter (where rv.id is not null) / nullif(count(*), 0), 1) into v_rev
  from public.agenda a
  join private.pasmu_casos_alcance(_unidad_id, _persona_id) cs on cs.id = a.caso_id
  join public.notas_soap n on n.agenda_id = a.id and n.estado = 'firmada'
  left join public.revisiones_cumplimiento rv on rv.tipo = 'nota' and rv.nota_id = n.id
  where a.estado = 'realizada'
    and (rv.id is not null
         or ((a.id * 37 + 11) % 100) < coalesce((select u.muestreo_revision_pct from public.unidad_ajustes u where u.unidad_id = cs.unidad_id), 20));

  -- capacidad semanal
  select count(*) into v_usadas
  from public.agenda a join private.pasmu_casos_alcance(_unidad_id, _persona_id) cs on cs.id = a.caso_id
  where a.estado <> 'cancelada' and private.pasmu_fecha_local(a.fecha_inicio) between v_semana and v_semana + 6;
  select coalesce(sum(coalesce(pt.capacidad_semanal, 4)), 0) into v_ofrecidas
  from (
    select distinct m.persona_id
    from public.miembros m join public.roles r on r.id = m.rol_id
    where r.codigo = 'terapeuta' and m.activo and (_unidad_id is null or m.unidad_id = _unidad_id)
      and (_persona_id is null or m.persona_id = _persona_id)
      and m.fecha_inicio <= _hoy and (m.fecha_fin is null or m.fecha_fin >= _hoy)
  ) t left join public.perfiles_terapeuta pt on pt.persona_id = t.persona_id;
  v_cap := case when v_ofrecidas > 0 then round(100.0 * v_usadas / v_ofrecidas, 1) end;

  -- días entre sesiones realizadas consecutivas
  select round(avg(g.dias), 1) into v_interv
  from (
    select private.pasmu_fecha_local(a.fecha_inicio)
           - lag(private.pasmu_fecha_local(a.fecha_inicio)) over (partition by a.caso_id order by a.fecha_inicio) as dias
    from public.agenda a join private.pasmu_casos_alcance(_unidad_id, _persona_id) cs on cs.id = a.caso_id
    where a.estado = 'realizada'
  ) g where g.dias is not null;

  -- cierres por abandono
  select round(100.0 * count(*) filter (where c.motivo_cierre = 'abandono') / nullif(count(*), 0), 1) into v_aband
  from public.casos c join private.pasmu_casos_alcance(_unidad_id, _persona_id) cs on cs.id = c.id
  where c.estado = 'cerrado' and c.motivo_cierre is not null;

  return query
  select k.codigo, k.valor,
         case when k.info then null else private.pasmu_meta(_unidad_id, k.codigo) end,
         k.dir, v_fase,
         case when k.info then 'informativo'
              when v_fase = 'linea_base' then 'linea_base'
              else private.pasmu_semaforo(k.valor, private.pasmu_meta(_unidad_id, k.codigo), k.dir) end,
         k.info
  from (values
    ('asistencia', v_asist, 'min', false), ('cancelacion', v_cancel, 'max', false),
    ('espera_maxima', v_espera, 'max', false), ('primer_contacto', v_primer, 'max', false),
    ('sin_seguimiento', v_sinseg, 'max', false), ('notas_pendientes', v_notas, 'max', false),
    ('pases_pendientes', v_pases, 'max', false), ('tamizaje', v_tamiz, 'min', false),
    ('historia', v_hist, 'min', false), ('revision', v_rev, 'min', false),
    ('capacidad', v_cap, 'min', true), ('intervalo_sesiones', v_interv, 'max', true), ('abandono', v_aband, 'max', true)
  ) as k(codigo, valor, dir, info);
end;
$$;

-- ——— ruta de atención: promedio y máximo de días entre etapas ———
create or replace function public.pasmu_ruta_estadisticas(_unidad_id bigint default null, _hoy date default current_date)
returns table (tramo text, promedio numeric, maximo integer, casos integer, meta numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pasmu_puede_ver_operacion(_unidad_id, null) then
    raise exception 'Sin permiso para consultar estos indicadores.' using errcode = '42501';
  end if;
  return query
  with base as (
    select r.solicitada_en as sol, r.evaluacion_en as ev, r.entrevista_en as en, r.asignacion_en as asi,
           (select min(private.pasmu_fecha_local(a.fecha_inicio)) from public.agenda a where a.caso_id = c.id and a.estado = 'realizada') as ses
    from public.casos c join public.casos_ruta r on r.caso_id = c.id
    where _unidad_id is null or c.unidad_id = _unidad_id
  ), tramos as (
    select 'evaluacion'::text as t, (ev - sol) as d from base where ev is not null
    union all select 'entrevista', (en - ev) from base where en is not null and ev is not null
    union all select 'asignacion', (asi - en) from base where asi is not null and en is not null
    union all select 'sesion', (ses - asi) from base where ses is not null and asi is not null
    union all select 'total', (ses - sol) from base where ses is not null
  )
  select t.t, round(avg(t.d), 1), max(t.d)::integer, count(*)::integer,
         private.pasmu_meta(_unidad_id, case t.t when 'total' then 'etapa_total' else 'etapa_' || t.t end)
  from tramos t group by t.t
  order by array_position(array['evaluacion', 'entrevista', 'asignacion', 'sesion', 'total'], t.t);
end;
$$;

-- ——— series de actividad (día, semana, quincena, mes, año) ———
create or replace function public.pasmu_actividad_serie(
  _unidad_id bigint default null, _granularidad text default 'semana', _hoy date default current_date)
returns table (clave date, realizadas integer, no_asistio integer, canceladas integer, programadas integer, solicitudes integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not private.pasmu_puede_ver_operacion(_unidad_id, null) then
    raise exception 'Sin permiso para consultar estos indicadores.' using errcode = '42501';
  end if;
  if _granularidad not in ('dia', 'semana', 'quincena', 'mes', 'anio') then
    raise exception 'Granularidad no válida.' using errcode = '22023';
  end if;
  v_n := case _granularidad when 'dia' then 14 when 'semana' then 8 when 'quincena' then 8 when 'mes' then 12 else 2 end;
  return query
  with claves as (
    select distinct case _granularidad
      when 'dia' then _hoy - i
      when 'semana' then date_trunc('week', (_hoy - 7 * i))::date
      when 'quincena' then (select make_date((q.idx / 24)::int, ((q.idx % 24) / 2 + 1)::int, case when q.idx % 2 = 0 then 1 else 16 end)
                            from (select (extract(year from _hoy)::int * 24 + (extract(month from _hoy)::int - 1) * 2
                                          + case when extract(day from _hoy) <= 15 then 0 else 1 end - i) as idx) q)
      when 'mes' then (date_trunc('month', _hoy) - make_interval(months => i))::date
      else (date_trunc('year', _hoy) - make_interval(years => i))::date
    end as k
    from generate_series(0, v_n - 1) i
  ), ag as (
    select case _granularidad
             when 'dia' then private.pasmu_fecha_local(a.fecha_inicio)
             when 'semana' then date_trunc('week', private.pasmu_fecha_local(a.fecha_inicio))::date
             when 'quincena' then make_date(extract(year from private.pasmu_fecha_local(a.fecha_inicio))::int,
                                            extract(month from private.pasmu_fecha_local(a.fecha_inicio))::int,
                                            case when extract(day from private.pasmu_fecha_local(a.fecha_inicio)) <= 15 then 1 else 16 end)
             when 'mes' then date_trunc('month', private.pasmu_fecha_local(a.fecha_inicio))::date
             else date_trunc('year', private.pasmu_fecha_local(a.fecha_inicio))::date end as k,
           a.estado
    from public.agenda a join public.casos c on c.id = a.caso_id
    where _unidad_id is null or c.unidad_id = _unidad_id
  ), so as (
    select case _granularidad
             when 'dia' then r.solicitada_en
             when 'semana' then date_trunc('week', r.solicitada_en)::date
             when 'quincena' then make_date(extract(year from r.solicitada_en)::int, extract(month from r.solicitada_en)::int,
                                            case when extract(day from r.solicitada_en) <= 15 then 1 else 16 end)
             when 'mes' then date_trunc('month', r.solicitada_en)::date
             else date_trunc('year', r.solicitada_en)::date end as k
    from public.casos_ruta r join public.casos c on c.id = r.caso_id
    where _unidad_id is null or c.unidad_id = _unidad_id
  )
  select cl.k,
         (select count(*) from ag where ag.k = cl.k and ag.estado = 'realizada')::integer,
         (select count(*) from ag where ag.k = cl.k and ag.estado = 'no_asistio')::integer,
         (select count(*) from ag where ag.k = cl.k and ag.estado = 'cancelada')::integer,
         (select count(*) from ag where ag.k = cl.k and ag.estado = 'programada')::integer,
         (select count(*) from so where so.k = cl.k)::integer
  from claves cl order by cl.k;
end;
$$;

-- ——— alertas con responsable, plazo y escalamiento ———
create or replace function public.pasmu_alertas_operacion(_unidad_id bigint default null, _hoy date default current_date)
returns table (clave text, tipo text, caso_id bigint, severidad text, texto text, responsable text, escalada boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.pasmu_puede_ver_operacion(_unidad_id, null) then
    raise exception 'Sin permiso para consultar estas alertas.' using errcode = '42501';
  end if;
  return query
  with cs as (
    select c.id, c.unidad_id, c.responsable_actual_id as resp, r.solicitada_en,
           coalesce((select pr.nivel = 'prioritaria' from public.casos_prioridad pr where pr.caso_id = c.id), false) as prioritaria,
           coalesce((select u.plazo_firma_dias from public.unidad_ajustes u where u.unidad_id = c.unidad_id), 3) as plazo,
           coalesce((select u.modo_agenda from public.unidad_ajustes u where u.unidad_id = c.unidad_id), 'terapeuta') as modo
    from public.casos c join public.casos_ruta r on r.caso_id = c.id
    where c.estado <> 'cerrado' and (_unidad_id is null or c.unidad_id = _unidad_id)
  ), espera as (
    select cs.*, (_hoy - cs.solicitada_en) as dias, private.pasmu_meta(cs.unidad_id, 'espera_maxima') as meta
    from cs where cs.resp is null
  )
  select 'espera:' || e.id, 'espera', e.id, case when e.dias > 14 then 'alta' else 'media' end,
         'Caso ' || e.id || ' lleva ' || e.dias || ' días sin terapeuta'
           || case when e.prioritaria then ' (prioridad administrativa)' else '' end || '.'
           || case when e.dias > e.meta * 2 then ' Escalada por superar el doble de la meta.' else '' end,
         case when e.dias > e.meta * 3 then 'Dirección PASMU'
              when e.dias > e.meta * 2 then 'Responsable de la unidad'
              else 'Coordinación clínica' end,
         e.dias > e.meta * 2
  from espera e where e.dias > e.meta
  union all
  select 'seguimiento:' || cs.id, 'seguimiento', cs.id, 'alta',
         'Caso ' || cs.id || ' no tiene sesión realizada en 14 días ni cita próxima.',
         case when cs.modo = 'administrativo' then 'Personal administrativo de la unidad' else 'Persona terapeuta del caso' end,
         false
  from cs
  where cs.resp is not null
    and not exists (select 1 from public.agenda a where a.caso_id = cs.id and a.estado = 'programada' and private.pasmu_fecha_local(a.fecha_inicio) >= _hoy)
    and _hoy - coalesce((select max(private.pasmu_fecha_local(a.fecha_inicio)) from public.agenda a where a.caso_id = cs.id and a.estado = 'realizada'), cs.solicitada_en) >= 14
  union all
  select 'nota:' || a.id, 'nota', cs.id, 'media',
         'Nota sin firmar de la sesión del ' || private.pasmu_fecha_local(a.fecha_inicio) || '; el plazo de la unidad es de ' || cs.plazo || ' días.',
         'Persona terapeuta del caso', false
  from public.agenda a join cs on cs.id = a.caso_id
  where a.estado = 'realizada'
    and not exists (select 1 from public.notas_soap n where n.agenda_id = a.id and n.estado = 'firmada')
    and _hoy - private.pasmu_fecha_local(a.fecha_inicio) > cs.plazo
  union all
  select 'pase:' || a.id, 'pase', cs.id, 'media',
         'Sin pase registrado: sesión del ' || private.pasmu_fecha_local(a.fecha_inicio) || '.',
         'Persona terapeuta del caso', false
  from public.agenda a join cs on cs.id = a.caso_id
  where a.estado = 'programada' and private.pasmu_fecha_local(a.fecha_inicio) < _hoy
  union all
  select 'etapa:' || cs.id || ':' || e.etapa, 'ruta', cs.id, 'media',
         'Caso ' || cs.id || ' lleva ' || (_hoy - e.desde) || ' días esperando: ' || e.etapa || '.',
         case when (_hoy - e.desde) > private.pasmu_meta(cs.unidad_id, 'etapa_' || e.etapa) * 3 then 'Dirección PASMU'
              when (_hoy - e.desde) > private.pasmu_meta(cs.unidad_id, 'etapa_' || e.etapa) * 2 then 'Responsable de la unidad'
              else 'Coordinación clínica' end,
         (_hoy - e.desde) > private.pasmu_meta(cs.unidad_id, 'etapa_' || e.etapa) * 2
  from cs
  cross join lateral private.pasmu_etapa_actual(cs.id) e
  where cs.resp is not null and e.etapa <> 'sesion'
     or (cs.resp is not null and e.etapa = 'sesion' and (_hoy - e.desde) > private.pasmu_meta(cs.unidad_id, 'etapa_sesion')
         and not exists (select 1 from public.agenda a where a.caso_id = cs.id and a.estado = 'programada'))
  ;
end;
$$;

-- ——— línea base y metas de partida (solo administración global) ———
create or replace function public.pasmu_linea_base_registrar(_unidad_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valores jsonb;
  v_id bigint;
begin
  if not private.pasmu_es_admin_global() then
    raise exception 'Solo la administración global registra la línea base.' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(k.codigo, k.valor), '{}'::jsonb) into v_valores
  from public.pasmu_kpis_operacion(_unidad_id, current_date, null) k;
  v_valores := v_valores || coalesce((
    select jsonb_object_agg('etapa_' || t.tramo, t.promedio) from public.pasmu_ruta_estadisticas(_unidad_id, current_date) t), '{}'::jsonb);
  insert into public.lineas_base (unidad_id, valores, creada_por)
  values (_unidad_id, v_valores, private.pasmu_current_persona_id()) returning id into v_id;
  return v_id;
end;
$$;

-- Lo que se quiere subir se redondea hacia abajo; lo que se quiere bajar, hacia arriba.
create or replace function public.pasmu_linea_base_aplicar_metas(_unidad_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base public.lineas_base%rowtype;
  v_n integer := 0;
  r record;
begin
  if not private.pasmu_es_admin_global() then
    raise exception 'Solo la administración global fija las metas.' using errcode = '42501';
  end if;
  select * into v_base from public.lineas_base
    where coalesce(unidad_id, 0) = coalesce(_unidad_id, 0) order by fecha desc, id desc limit 1;
  if v_base.id is null then raise exception 'Primero registra la línea base de ese ámbito.' using errcode = '22023'; end if;
  for r in
    select d.codigo, d.dir, (v_base.valores ->> d.codigo)::numeric as valor
    from (values ('asistencia', 'min'), ('tamizaje', 'min'), ('historia', 'min'), ('revision', 'min'),
                 ('cancelacion', 'max'), ('espera_maxima', 'max'), ('primer_contacto', 'max'), ('sin_seguimiento', 'max'),
                 ('notas_pendientes', 'max'), ('pases_pendientes', 'max'), ('etapa_evaluacion', 'max'), ('etapa_entrevista', 'max'),
                 ('etapa_asignacion', 'max'), ('etapa_sesion', 'max'), ('etapa_total', 'max')) as d(codigo, dir)
    where v_base.valores ? d.codigo and jsonb_typeof(v_base.valores -> d.codigo) = 'number'
  loop
    insert into public.metas_operacion (unidad_id, codigo, valor, actualizado_por)
    values (_unidad_id, r.codigo, case when r.dir = 'min' then floor(r.valor) else ceil(r.valor) end, private.pasmu_current_persona_id())
    on conflict (coalesce(unidad_id, 0), codigo) do update set valor = excluded.valor, actualizado_por = excluded.actualizado_por, actualizado_en = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function private.pasmu_casos_alcance(bigint, uuid) from public, anon;
revoke all on function private.pasmu_fecha_local(timestamptz) from public, anon;
revoke all on function private.pasmu_semaforo(numeric, numeric, text) from public, anon;
revoke all on function private.pasmu_meta(bigint, text) from public, anon;
revoke all on function private.pasmu_fase(bigint) from public, anon;
revoke all on function private.pasmu_puede_ver_operacion(bigint, uuid) from public, anon;
grant execute on function private.pasmu_casos_alcance(bigint, uuid) to authenticated;
grant execute on function private.pasmu_fecha_local(timestamptz) to authenticated;
grant execute on function private.pasmu_semaforo(numeric, numeric, text) to authenticated;
grant execute on function private.pasmu_meta(bigint, text) to authenticated;
grant execute on function private.pasmu_fase(bigint) to authenticated;
grant execute on function private.pasmu_puede_ver_operacion(bigint, uuid) to authenticated;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pasmu_instrumento_obligatorio_guardar(bigint, bigint, boolean)',
    'public.pasmu_kpis_operacion(bigint, date, uuid)',
    'public.pasmu_ruta_estadisticas(bigint, date)',
    'public.pasmu_actividad_serie(bigint, text, date)',
    'public.pasmu_alertas_operacion(bigint, date)',
    'public.pasmu_linea_base_registrar(bigint)',
    'public.pasmu_linea_base_aplicar_metas(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;
