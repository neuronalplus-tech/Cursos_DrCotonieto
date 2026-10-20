-- PASMU 27: notas y historia por selección, firma inalterable, revisión de cumplimiento (contenido o formal),
-- familiograma y constancias verificables.
-- Solo PRUEBAS. Idempotente. Requiere 18b, 24, 25 (y 26 no es necesario). Sin texto libre clínico en lo nuevo:
-- todo lo que se guarda son opciones de listas (el contenido narrativo sigue en las tablas SOAP existentes).
begin;

-- ——— validación común: objeto plano con opciones cortas (nunca texto largo) ———
create or replace function private.pasmu_campos_validos(_campos jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(_campos) = 'object'
    and (select count(*) from jsonb_object_keys(_campos)) <= 80
    and not exists (
      select 1
      from jsonb_each(_campos) e
      where e.key !~ '^[a-z0-9_]{2,40}$'
        or not (
          (jsonb_typeof(e.value) = 'string' and char_length(e.value #>> '{}') <= 80)
          or (jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) <= 60
              and not exists (
                select 1 from jsonb_array_elements(e.value) a
                where jsonb_typeof(a) <> 'string' or char_length(a #>> '{}') > 80))))
$$;

-- ——— notas SOAP: campos por selección, firma y registro inalterable ———
alter table public.notas_soap add column if not exists campos jsonb not null default '{}'::jsonb;
alter table public.notas_soap add column if not exists estado text not null default 'borrador';
alter table public.notas_soap add column if not exists firmada_en timestamptz;
alter table public.notas_soap add column if not exists firmada_por uuid references public.personas(id) on delete set null;
alter table public.notas_soap add column if not exists agenda_id bigint references public.agenda(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_notas_soap_estado') then
    alter table public.notas_soap add constraint chk_notas_soap_estado check (estado in ('borrador', 'firmada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_notas_soap_campos') then
    alter table public.notas_soap add constraint chk_notas_soap_campos check (private.pasmu_campos_validos(campos)) not valid;
  end if;
end $$;
create unique index if not exists uq_notas_soap_agenda on public.notas_soap (agenda_id) where agenda_id is not null;

-- Una nota firmada no se modifica ni se borra: las correcciones van como addendum.
create or replace function private.pasmu_nota_firmada_inalterable()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'firmada' then
    raise exception 'La nota firmada es inalterable; registra un addendum.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists trg_notas_soap_inalterable on public.notas_soap;
create trigger trg_notas_soap_inalterable before update or delete on public.notas_soap
  for each row execute function private.pasmu_nota_firmada_inalterable();

-- notas_soap sigue sin SELECT directo para authenticated (como definió 18b): se lee con esta función, que solo
-- responde a la persona terapeuta del caso y a quien revisa el contenido.
create or replace function public.pasmu_notas_del_caso(_caso_id bigint)
returns table (id bigint, sesion integer, estado text, campos jsonb, firmada_en timestamptz, agenda_id bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.pasmu_case_has_permission(_caso_id, 'expediente.ver')
          and (private.pasmu_is_case_professional(_caso_id) or private.pasmu_case_has_permission(_caso_id, 'revision.contenido'))) then
    raise exception 'Sin acceso a las notas de este caso.' using errcode = '42501';
  end if;
  return query
    select n.id, n.sesion, n.estado, n.campos, n.firmada_en, n.agenda_id
    from public.notas_soap n where n.caso_id = _caso_id order by n.sesion;
end;
$$;

create or replace function public.pasmu_nota_guardar_campos(_caso_id bigint, _agenda_id bigint, _campos jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_nota public.notas_soap%rowtype;
  v_id bigint;
begin
  if v_persona is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if not (private.pasmu_case_has_permission(_caso_id, 'expediente.editar') and private.pasmu_is_case_professional(_caso_id)) then
    raise exception 'Solo la persona terapeuta asignada al caso redacta la nota.' using errcode = '42501';
  end if;
  if not private.pasmu_campos_validos(_campos) then
    raise exception 'La nota solo admite opciones de las listas.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.agenda a where a.id = _agenda_id and a.caso_id = _caso_id and a.estado = 'realizada') then
    raise exception 'Solo se redacta la nota de una sesión realizada del caso.' using errcode = '22023';
  end if;
  select * into v_nota from public.notas_soap where agenda_id = _agenda_id;
  if v_nota.id is not null then
    if v_nota.estado = 'firmada' then raise exception 'La nota firmada no se modifica.' using errcode = '42501'; end if;
    update public.notas_soap set campos = _campos where id = v_nota.id;
    return v_nota.id;
  end if;
  insert into public.notas_soap (caso_id, sesion, campos, agenda_id, creada_por)
  values (_caso_id, coalesce((select max(sesion) from public.notas_soap where caso_id = _caso_id), 0) + 1, _campos, _agenda_id, v_persona)
  returning id into v_id;
  return v_id;
end;
$$;

-- Para firmar deben estar los campos obligatorios: modalidad, duración, evolución, riesgo, intervenciones y próxima sesión.
create or replace function public.pasmu_nota_firmar(_nota_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.notas_soap%rowtype;
  v_clave text;
begin
  select * into n from public.notas_soap where id = _nota_id;
  if n.id is null then raise exception 'La nota no existe.' using errcode = '22023'; end if;
  if n.creada_por is distinct from private.pasmu_current_persona_id() or not private.pasmu_is_case_professional(n.caso_id) then
    raise exception 'Solo quien redactó la nota la firma.' using errcode = '42501';
  end if;
  if n.estado = 'firmada' then raise exception 'La nota ya está firmada.' using errcode = '22023'; end if;
  foreach v_clave in array array['modalidad', 'duracion', 'evolucion', 'riesgo', 'intervenciones', 'proxima'] loop
    if not (n.campos ? v_clave)
       or (jsonb_typeof(n.campos -> v_clave) = 'array' and jsonb_array_length(n.campos -> v_clave) = 0)
       or (jsonb_typeof(n.campos -> v_clave) = 'string' and btrim(n.campos ->> v_clave) = '') then
      raise exception 'Completa los campos obligatorios de la nota antes de firmar (falta: %).', v_clave using errcode = '22023';
    end if;
  end loop;
  update public.notas_soap set estado = 'firmada', firmada_en = now(), firmada_por = n.creada_por where id = _nota_id;
end;
$$;

-- ——— historia clínica por selección (versionada: cada guardado es una versión nueva) ———
alter table public.historia_integral add column if not exists campos jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_historia_integral_campos') then
    alter table public.historia_integral add constraint chk_historia_integral_campos
      check (private.pasmu_campos_validos(campos)) not valid;
  end if;
end $$;
grant select on table public.historia_integral to authenticated;
drop policy if exists historia_integral_read on public.historia_integral;
create policy historia_integral_read on public.historia_integral for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver')
         and (private.pasmu_is_case_professional(caso_id) or private.pasmu_case_has_permission(caso_id, 'revision.contenido')));

create or replace function public.pasmu_historia_guardar(_caso_id bigint, _campos jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if private.pasmu_current_persona_id() is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if not (private.pasmu_case_has_permission(_caso_id, 'expediente.editar') and private.pasmu_is_case_professional(_caso_id)) then
    raise exception 'Solo la persona terapeuta asignada al caso edita la historia.' using errcode = '42501';
  end if;
  if exists (select 1 from public.casos where id = _caso_id and estado = 'cerrado') then
    raise exception 'El expediente está cerrado.' using errcode = '22023';
  end if;
  if not private.pasmu_campos_validos(_campos) then
    raise exception 'La historia solo admite opciones de las listas.' using errcode = '22023';
  end if;
  insert into public.historia_integral (caso_id, campos, creada_por)
  values (_caso_id, _campos, private.pasmu_current_persona_id()) returning id into v_id;
  return v_id;
end;
$$;

-- ——— familiograma ———
create table if not exists public.familiogramas (
  caso_id bigint primary key references public.casos(id) on delete cascade,
  miembros jsonb not null default '[]'::jsonb check (jsonb_typeof(miembros) = 'array' and jsonb_array_length(miembros) <= 16),
  vinculos jsonb not null default '[]'::jsonb check (jsonb_typeof(vinculos) = 'array' and jsonb_array_length(vinculos) <= 24),
  actualizado_por uuid references public.personas(id) on delete set null,
  actualizado_en timestamptz not null default now()
);
alter table public.familiogramas enable row level security;
revoke all on table public.familiogramas from public, anon, authenticated;
grant select on table public.familiogramas to authenticated;
drop policy if exists familiogramas_read on public.familiogramas;
create policy familiogramas_read on public.familiogramas for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver')
         and (private.pasmu_is_case_professional(caso_id) or private.pasmu_case_has_permission(caso_id, 'revision.contenido')));

create or replace function public.pasmu_familiograma_guardar(_caso_id bigint, _miembros jsonb, _vinculos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb;
  l jsonb;
  v_ids text[] := '{}';
  v_rel text;
begin
  if private.pasmu_current_persona_id() is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if not (private.pasmu_case_has_permission(_caso_id, 'expediente.editar') and private.pasmu_is_case_professional(_caso_id)) then
    raise exception 'Solo la persona terapeuta asignada al caso edita el familiograma.' using errcode = '42501';
  end if;
  if exists (select 1 from public.casos where id = _caso_id and estado = 'cerrado') then
    raise exception 'El expediente está cerrado.' using errcode = '22023';
  end if;
  if jsonb_typeof(_miembros) <> 'array' or jsonb_typeof(_vinculos) <> 'array'
     or jsonb_array_length(_miembros) > 16 or jsonb_array_length(_vinculos) > 24 then
    raise exception 'El familiograma admite hasta 16 integrantes y 24 vínculos.' using errcode = '22023';
  end if;
  for m in select * from jsonb_array_elements(_miembros) loop
    if jsonb_typeof(m) <> 'object' or (m ->> 'id') !~ '^[A-Za-z0-9]{1,20}$' then
      raise exception 'Integrante no válido.' using errcode = '22023';
    end if;
    if (m ->> 'rel') not in ('Persona usuaria', 'Madre', 'Padre', 'Hermano/a', 'Pareja', 'Hijo/a',
                             'Abuelo/a materno/a', 'Abuelo/a paterno/a', 'Otro familiar')
       or (m ->> 'sex') not in ('H', 'M', 'NB')
       or (m ->> 'status') not in ('Vive', 'Falleció')
       or coalesce(m ->> 'age', '') not in ('', 'Menor de 12', '12-17', '18-29', '30-49', '50-69', '70 o más') then
      raise exception 'Integrante fuera de las listas.' using errcode = '22023';
    end if;
    if (m ->> 'id') = any (v_ids) then raise exception 'Integrante repetido.' using errcode = '22023'; end if;
    v_ids := v_ids || (m ->> 'id');
  end loop;
  foreach v_rel in array array['Persona usuaria', 'Madre', 'Padre'] loop
    if (select count(*) from jsonb_array_elements(_miembros) x where x ->> 'rel' = v_rel) > 1 then
      raise exception 'Solo puede haber una persona usuaria, una madre y un padre.' using errcode = '22023';
    end if;
  end loop;
  for l in select * from jsonb_array_elements(_vinculos) loop
    if jsonb_typeof(l) <> 'object' or not ((l ->> 'from') = any (v_ids) and (l ->> 'to') = any (v_ids))
       or (l ->> 'from') = (l ->> 'to')
       or (l ->> 'type') not in ('Cercano', 'Conflictivo', 'Distante', 'Fusionado', 'Roto') then
      raise exception 'Vínculo no válido.' using errcode = '22023';
    end if;
  end loop;
  insert into public.familiogramas (caso_id, miembros, vinculos, actualizado_por)
  values (_caso_id, _miembros, _vinculos, private.pasmu_current_persona_id())
  on conflict (caso_id) do update set miembros = excluded.miembros, vinculos = excluded.vinculos,
    actualizado_por = excluded.actualizado_por, actualizado_en = now();
end;
$$;

-- ——— revisión de cumplimiento (nota, historia, familiograma) ———
create table if not exists public.revisiones_cumplimiento (
  id bigserial primary key,
  tipo text not null check (tipo in ('nota', 'historia', 'familiograma')),
  caso_id bigint not null references public.casos(id) on delete cascade,
  nota_id bigint references public.notas_soap(id) on delete cascade,
  estado text not null check (estado in ('cumple', 'no_cumple')),
  nivel text not null check (nivel in ('contenido', 'formal')),
  comentario text check (comentario is null or char_length(comentario) <= 200),
  revisada_por uuid references public.personas(id) on delete set null,
  revisada_en date not null default current_date,
  confirmada boolean not null default false,
  comentario_confirmacion text check (comentario_confirmacion is null or char_length(comentario_confirmacion) <= 200),
  check ((tipo = 'nota') = (nota_id is not null)),
  check (nivel = 'contenido' or comentario is null)
);
create unique index if not exists uq_revision_cumplimiento
  on public.revisiones_cumplimiento (tipo, caso_id, coalesce(nota_id, 0));

alter table public.revisiones_cumplimiento enable row level security;
revoke all on table public.revisiones_cumplimiento from public, anon, authenticated;
grant select on table public.revisiones_cumplimiento to authenticated;
grant usage, select on sequence public.revisiones_cumplimiento_id_seq to authenticated;
drop policy if exists revisiones_cumplimiento_read on public.revisiones_cumplimiento;
create policy revisiones_cumplimiento_read on public.revisiones_cumplimiento for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'revision.contenido')
         or private.pasmu_case_has_permission(caso_id, 'revision.formal')
         or (private.pasmu_is_case_professional(caso_id) and private.pasmu_case_has_permission(caso_id, 'revision.recibir')));

create or replace function public.pasmu_revision_registrar(
  _tipo text, _caso_id bigint, _nota_id bigint, _estado text, _comentario text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidad bigint;
  v_nivel text;
  v_comentario text := nullif(btrim(coalesce(_comentario, '')), '');
  v_id bigint;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if _estado not in ('cumple', 'no_cumple') then raise exception 'Elige Cumple o No cumple.' using errcode = '22023'; end if;
  if _tipo = 'nota' then
    if not exists (select 1 from public.notas_soap n where n.id = _nota_id and n.caso_id = _caso_id and n.estado = 'firmada') then
      raise exception 'La nota debe estar firmada para revisarla.' using errcode = '22023';
    end if;
  elsif _tipo = 'historia' then
    _nota_id := null;
    if not exists (select 1 from public.historia_integral h where h.caso_id = _caso_id and h.campos <> '{}'::jsonb) then
      raise exception 'La historia clínica aún no tiene campos.' using errcode = '22023';
    end if;
  elsif _tipo = 'familiograma' then
    _nota_id := null;
    if not exists (select 1 from public.familiogramas f where f.caso_id = _caso_id and jsonb_array_length(f.miembros) > 0) then
      raise exception 'El familiograma aún no tiene integrantes.' using errcode = '22023';
    end if;
  else
    raise exception 'Tipo de revisión no válido.' using errcode = '22023';
  end if;

  -- Contenido: supervisión y coordinación clínica. Formal: responsable de unidad, o personal administrativo si la unidad lo habilita.
  if private.pasmu_has_permission('revision.contenido', v_unidad) then
    v_nivel := 'contenido';
  elsif private.pasmu_has_permission('revision.formal', v_unidad)
        and ('responsable_unidad' = any (private.pasmu_mis_roles(v_unidad))
             or coalesce((select a.admin_checklist from public.unidad_ajustes a where a.unidad_id = v_unidad), false)) then
    v_nivel := 'formal';
  else
    raise exception 'Tu perfil no revisa este elemento en esta unidad.' using errcode = '42501';
  end if;
  if v_comentario is not null and v_nivel <> 'contenido' then
    raise exception 'El personal administrativo registra el cumplimiento, no comentarios sobre el contenido.' using errcode = '22023';
  end if;
  if v_comentario is not null and char_length(v_comentario) > 200 then
    raise exception 'El comentario admite hasta 200 caracteres.' using errcode = '22023';
  end if;

  insert into public.revisiones_cumplimiento (tipo, caso_id, nota_id, estado, nivel, comentario, revisada_por)
  values (_tipo, _caso_id, _nota_id, _estado, v_nivel, v_comentario, private.pasmu_current_persona_id())
  on conflict (tipo, caso_id, (coalesce(nota_id, 0))) do update set
    estado = excluded.estado, nivel = excluded.nivel, comentario = excluded.comentario,
    revisada_por = excluded.revisada_por, revisada_en = current_date,
    confirmada = false, comentario_confirmacion = null
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.pasmu_revision_confirmar(_revision_id bigint, _comentario text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.revisiones_cumplimiento%rowtype;
  v_comentario text := nullif(btrim(coalesce(_comentario, '')), '');
begin
  select * into r from public.revisiones_cumplimiento where id = _revision_id;
  if r.id is null then raise exception 'Esa revisión no existe.' using errcode = '22023'; end if;
  if not (private.pasmu_is_case_professional(r.caso_id) and private.pasmu_case_has_permission(r.caso_id, 'revision.recibir')) then
    raise exception 'Solo la persona terapeuta del caso confirma la revisión.' using errcode = '42501';
  end if;
  if v_comentario is not null and char_length(v_comentario) > 200 then
    raise exception 'El comentario admite hasta 200 caracteres.' using errcode = '22023';
  end if;
  update public.revisiones_cumplimiento set confirmada = true, comentario_confirmacion = v_comentario where id = _revision_id;
end;
$$;

-- ——— constancias de asistencia con código de verificación (sin información clínica) ———
create table if not exists public.constancias (
  codigo text primary key check (codigo ~ '^PASMU-[0-9A-Z]{3}-[0-9A-Z]{4}$'),
  caso_id bigint not null references public.casos(id) on delete cascade,
  emitida_en date not null default current_date,
  sesiones integer not null check (sesiones > 0),
  desde date not null,
  hasta date not null,
  emitida_por uuid references public.personas(id) on delete set null
);
alter table public.constancias enable row level security;
revoke all on table public.constancias from public, anon, authenticated;
grant select on table public.constancias to authenticated;
drop policy if exists constancias_read on public.constancias;
create policy constancias_read on public.constancias for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'constancias.emitir') or private.pasmu_soy_persona_del_caso(caso_id));

create or replace function public.pasmu_constancia_emitir(_caso_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidad bigint;
  v_n integer;
  v_desde date;
  v_hasta date;
  v_codigo text;
begin
  select unidad_id into v_unidad from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not (private.pasmu_has_permission('constancias.emitir', v_unidad)
          and (private.pasmu_is_case_professional(_caso_id) or private.pasmu_has_permission('casos.asignar', v_unidad))) then
    raise exception 'Tu perfil no emite constancias de este caso.' using errcode = '42501';
  end if;
  select count(*), min((fecha_inicio at time zone 'America/Mexico_City')::date), max((fecha_inicio at time zone 'America/Mexico_City')::date)
    into v_n, v_desde, v_hasta
  from public.agenda where caso_id = _caso_id and estado = 'realizada';
  if v_n = 0 then raise exception 'La persona aún no tiene sesiones con asistencia.' using errcode = '22023'; end if;
  v_codigo := 'PASMU-' || right('000' || _caso_id::text, 3) || '-'
              || upper(substr(md5(_caso_id::text || '|' || v_n::text || '|' || current_date::text), 1, 4));
  insert into public.constancias (codigo, caso_id, sesiones, desde, hasta, emitida_por)
  values (v_codigo, _caso_id, v_n, v_desde, v_hasta, private.pasmu_current_persona_id())
  on conflict (codigo) do nothing;
  return v_codigo;
end;
$$;

-- Verificación pública: devuelve solo fecha, número de sesiones y unidad. Nunca nombres ni contenido clínico.
create or replace function public.pasmu_constancia_verificar(_codigo text)
returns table (emitida_en date, sesiones integer, desde date, hasta date, unidad text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.emitida_en, k.sesiones, k.desde, k.hasta, u.nombre
  from public.constancias k
  join public.casos c on c.id = k.caso_id
  join public.unidades u on u.id = c.unidad_id
  where k.codigo = upper(btrim(_codigo)) and char_length(_codigo) <= 30
$$;

revoke all on function private.pasmu_campos_validos(jsonb) from public, anon;
revoke all on function private.pasmu_nota_firmada_inalterable() from public, anon, authenticated;
grant execute on function private.pasmu_campos_validos(jsonb) to authenticated;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.pasmu_notas_del_caso(bigint)',
    'public.pasmu_nota_guardar_campos(bigint, bigint, jsonb)',
    'public.pasmu_nota_firmar(bigint)',
    'public.pasmu_historia_guardar(bigint, jsonb)',
    'public.pasmu_familiograma_guardar(bigint, jsonb, jsonb)',
    'public.pasmu_revision_registrar(text, bigint, bigint, text, text)',
    'public.pasmu_revision_confirmar(bigint, text)',
    'public.pasmu_constancia_emitir(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- La verificación sí puede llamarla una persona sin sesión (la usa la función edge `verificar-constancia`).
revoke all on function public.pasmu_constancia_verificar(text) from public;
grant execute on function public.pasmu_constancia_verificar(text) to anon, authenticated;

commit;
