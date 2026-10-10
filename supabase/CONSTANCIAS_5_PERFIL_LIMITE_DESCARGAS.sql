-- Apply after CONSTANCIAS_3_APROBACION.sql in Supabase SQL Editor.
-- Replaces the old folio RPC with a profile-name snapshot and a server-side
-- limit of two certificate generations per student and course.

alter table public.constancias
  add column if not exists descargas integer not null default 0;

update public.constancias set descargas = 0 where descargas is null;
alter table public.constancias alter column descargas set default 0;
alter table public.constancias alter column descargas set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.constancias'::regclass
       and conname = 'constancias_descargas_rango_check'
  ) then
    alter table public.constancias
      add constraint constancias_descargas_rango_check
      check (descargas between 0 and 2);
  end if;
end
$$;

-- The counter and name snapshot may only be changed by the protected RPC.
drop policy if exists "constancias_insert" on public.constancias;
drop policy if exists "constancias_update" on public.constancias;
revoke insert, update on public.constancias from authenticated;

create or replace function public.estado_constancia(p_curso bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_curso public.cursos%rowtype;
  v_folio text;
  v_nombre text;
  v_nombre_perfil text;
  v_nota_guardada numeric(4,2);
  v_minimo_guardado numeric(4,2);
  v_descargas integer := 0;
  v_nota jsonb;
  v_puede boolean := false;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  if not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;

  select c.folio, c.nombre_completo, c.calificacion_final,
         c.minimo_aprobacion, coalesce(c.descargas, 0)
    into v_folio, v_nombre, v_nota_guardada, v_minimo_guardado, v_descargas
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;

  select p.nombre_completo into v_nombre_perfil
    from public.perfiles p where p.id = v_uid;

  v_nota := public.nota_curso_para_constancia(v_uid, p_curso);
  v_puede := (v_folio is not null and v_descargas < 2) or (
    v_folio is null
    and not coalesce(v_curso.gratuito, false)
    and coalesce(v_curso.constancia, true)
    and coalesce((v_nota->>'aprobado')::boolean, false)
  );

  return jsonb_build_object(
    'emite', not coalesce(v_curso.gratuito, false) and coalesce(v_curso.constancia, true),
    'disponible', v_puede,
    'limiteAlcanzado', v_folio is not null and v_descargas >= 2,
    'descargas', coalesce(v_descargas, 0),
    'descargasRestantes', greatest(0, 2 - coalesce(v_descargas, 0)),
    'folio', v_folio,
    'nombre', case when coalesce(v_descargas, 0) > 0 then v_nombre else v_nombre_perfil end,
    'nota10', coalesce(v_nota_guardada, nullif(v_nota->>'nota10', '')::numeric),
    'minima10', coalesce(v_minimo_guardado, nullif(v_nota->>'minima10', '')::numeric, 7),
    'pesoEvaluado', coalesce(nullif(v_nota->>'pesoEvaluado', '')::numeric, 0),
    'pendientes', coalesce(v_nota->'pendientes', '[]'::jsonb),
    'alcanzaMinimo', coalesce((v_nota->>'alcanzaMinimo')::boolean, false) or v_folio is not null,
    'aprobado', coalesce((v_nota->>'aprobado')::boolean, false) or v_folio is not null,
    'requisitos', jsonb_build_array(
      jsonb_build_object('titulo', 'Calificación mínima',
        'cumple', coalesce((v_nota->>'alcanzaMinimo')::boolean, false) or v_folio is not null,
        'detalle', format('%s/10 · mínimo %s/10',
          coalesce(v_nota_guardada, nullif(v_nota->>'nota10', '')::numeric, 0),
          coalesce(v_minimo_guardado, nullif(v_nota->>'minima10', '')::numeric, 7)))
    )
  );
end
$$;

revoke all on function public.estado_constancia(bigint) from public;
grant execute on function public.estado_constancia(bigint) to authenticated;

create or replace function public.preparar_descarga_constancia(p_curso bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_curso public.cursos%rowtype;
  v_folio text;
  v_nombre text;
  v_nombre_perfil text;
  v_pref text;
  v_nota jsonb;
  v_grado numeric(4,2);
  v_minimo numeric(4,2);
  v_descargas integer := 0;
  v_fecha timestamptz;
  v_existente boolean := false;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  if not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;
  if coalesce(v_curso.gratuito, false) or not coalesce(v_curso.constancia, true) then
    raise exception 'Este curso no emite constancia';
  end if;

  -- Serializa intentos simultáneos del mismo alumno en el mismo curso.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_curso::text, 0));

  select c.folio, c.nombre_completo, c.fecha_emision, c.calificacion_final,
         c.minimo_aprobacion, coalesce(c.descargas, 0)
    into v_folio, v_nombre, v_fecha, v_grado, v_minimo, v_descargas
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso
   for update;
  v_existente := found;

  if v_existente and v_descargas >= 2 then
    raise exception 'Ya utilizaste las 2 descargas permitidas para esta constancia.';
  end if;

  if not v_existente and not public.completo_el_curso(v_uid, p_curso) then
    raise exception 'Aún no alcanzas la calificación mínima del curso';
  end if;

  v_nota := public.nota_curso_para_constancia(v_uid, p_curso);
  v_grado := coalesce(v_grado, nullif(v_nota->>'nota10', '')::numeric);
  v_minimo := coalesce(v_minimo, nullif(v_nota->>'minima10', '')::numeric, 7);

  if not v_existente or v_descargas = 0 then
    select p.nombre_completo into v_nombre_perfil
      from public.perfiles p where p.id = v_uid;
    if coalesce(btrim(v_nombre_perfil), '') = '' then
      raise exception 'Agrega tu nombre completo en Mi perfil antes de generar la constancia.';
    end if;
  end if;

  if v_existente then
    if v_descargas > 0 and coalesce(btrim(v_nombre), '') = '' then
      raise exception 'No se encontró el nombre guardado en la constancia. Contacta al administrador.';
    end if;
    if v_descargas = 0 then v_nombre := btrim(v_nombre_perfil);
    else v_nombre := btrim(v_nombre);
    end if;

    update public.constancias c
       set nombre_completo = v_nombre,
           profesion = null,
           calificacion_final = coalesce(c.calificacion_final, v_grado),
           minimo_aprobacion = coalesce(c.minimo_aprobacion, v_minimo),
           descargas = c.descargas + 1
     where c.usuario_id = v_uid and c.curso_id = p_curso
     returning c.folio, c.fecha_emision, c.calificacion_final,
               c.minimo_aprobacion, c.descargas
          into v_folio, v_fecha, v_grado, v_minimo, v_descargas;
  else
    select upper(substring(regexp_replace(
             translate(v_curso.titulo, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
             '[^A-Za-z]', '', 'g') from 1 for 3)) into v_pref;
    v_pref := coalesce(nullif(v_pref, ''), 'CUR');

    loop
      v_folio := v_pref || '-' || to_char(now(), 'YYYY') || '-' ||
        upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
      exit when not exists (select 1 from public.constancias c where c.folio = v_folio);
    end loop;

    v_nombre := btrim(v_nombre_perfil);
    insert into public.constancias
      (usuario_id, curso_id, folio, nombre_completo, profesion,
       calificacion_final, minimo_aprobacion, descargas)
    values
      (v_uid, p_curso, v_folio, v_nombre, null, v_grado, v_minimo, 1)
    returning fecha_emision, descargas into v_fecha, v_descargas;
  end if;

  return jsonb_build_object(
    'folio', v_folio,
    'nombre', v_nombre,
    'nota10', v_grado,
    'minima10', v_minimo,
    'fechaEmision', v_fecha,
    'descargas', v_descargas,
    'descargasRestantes', greatest(0, 2 - v_descargas)
  );
end
$$;

revoke all on function public.preparar_descarga_constancia(bigint) from public;
grant execute on function public.preparar_descarga_constancia(bigint) to authenticated;

-- Old clients rendered the student's name from editable browser fields.
-- Disable that RPC so only the new server-snapshotted name can be printed.
revoke all on function public.emitir_constancia(bigint)
  from public, authenticated, anon;

-- Public verification exposes the student's name only; profession is omitted.
create or replace function public.verificar_constancia(p_folio text)
returns table (
  folio text,
  nombre_completo text,
  profesion text,
  curso_titulo text,
  fecha_emision timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.folio, c.nombre_completo, null::text, cu.titulo, c.fecha_emision
    from public.constancias c
    join public.cursos cu on cu.id = c.curso_id
   where c.folio = upper(trim(p_folio)) or c.folio = trim(p_folio)
   limit 1
$$;

revoke all on function public.verificar_constancia(text) from public;
grant execute on function public.verificar_constancia(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
