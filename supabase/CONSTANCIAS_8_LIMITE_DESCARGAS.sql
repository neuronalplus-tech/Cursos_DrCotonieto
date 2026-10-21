-- ============================================================
-- CONSTANCIAS 8 · número de descargas permitidas, por curso
-- ============================================================
-- Correr en Supabase SQL Editor DESPUÉS de ALTA_PUBLICA.sql y de
-- CONSTANCIAS_7_TEXTO_EDITABLE.sql. Es seguro repetirlo.
--
-- Antes toda constancia admitía exactamente 2 descargas. Ahora cada
-- curso o taller lo decide (Gestión → Constancia → «Descargas
-- permitidas»); sin dato, siguen siendo 2.
--   · Subir el número da más descargas a quien ya llegó al límite.
--   · Bajarlo no borra nada: solo cierra el paso a quien ya lo alcanzó.
--
-- Redefine estado_constancia y preparar_descarga_constancia: son las
-- de ALTA_PUBLICA.sql cambiando únicamente el «2» fijo por el límite
-- del curso (v_max) y devolviendo `maxDescargas`.
-- ============================================================

alter table public.cursos add column if not exists constancia_max_descargas integer default 2;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.cursos'::regclass
                    and conname = 'cursos_constancia_max_descargas_check') then
    alter table public.cursos add constraint cursos_constancia_max_descargas_check
      check (constancia_max_descargas is null or constancia_max_descargas between 1 and 20);
  end if;
end
$$;

-- El tope fijo de 2 en la tabla de constancias ya no aplica.
alter table public.constancias drop constraint if exists constancias_descargas_rango_check;
alter table public.constancias add constraint constancias_descargas_rango_check
  check (descargas between 0 and 20);

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
  v_gratuito boolean := false;
  v_max integer := 2;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;
  v_gratuito := coalesce(v_curso.gratuito, false);
  v_max := greatest(1, coalesce(v_curso.constancia_max_descargas, 2));

  if v_gratuito then
    -- Un taller gratuito no pide fila en `acceso`: la cuenta basta.
    -- Pero la constancia no se promete hasta que el docente la habilita.
    if not coalesce(v_curso.constancia_gratuita_activa, false) then
      raise exception 'La constancia de este taller aún no está habilitada';
    end if;
  elsif not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  select c.folio, c.nombre_completo, c.calificacion_final,
         c.minimo_aprobacion, coalesce(c.descargas, 0)
    into v_folio, v_nombre, v_nota_guardada, v_minimo_guardado, v_descargas
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;

  select p.nombre_completo into v_nombre_perfil
    from public.perfiles p where p.id = v_uid;

  v_nota := public.nota_curso_para_constancia(v_uid, p_curso);

  if v_gratuito then
    -- Sin nota ni mínimo: un taller no califica. Basta la cuenta con
    -- nombre; si falta el nombre, no está disponible todavía.
    v_puede := (v_folio is not null and v_descargas < v_max)
            or (v_folio is null and coalesce(btrim(v_nombre_perfil), '') <> '');
  else
    v_puede := (v_folio is not null and v_descargas < v_max) or (
      v_folio is null
      and coalesce(v_curso.constancia, true)
      and coalesce((v_nota->>'aprobado')::boolean, false)
    );
  end if;

  return jsonb_build_object(
    'emite', case when v_gratuito
                  then coalesce(v_curso.constancia_gratuita_activa, false)
                  else coalesce(v_curso.constancia, true) end,
    'disponible', v_puede,
    'limiteAlcanzado', v_folio is not null and v_descargas >= v_max,
    'maxDescargas', v_max,
    'descargas', coalesce(v_descargas, 0),
    'descargasRestantes', greatest(0, v_max - coalesce(v_descargas, 0)),
    'folio', v_folio,
    'nombre', case when coalesce(v_descargas, 0) > 0 then v_nombre else v_nombre_perfil end,
    'nota10', case when v_gratuito then null
                   else coalesce(v_nota_guardada, nullif(v_nota->>'nota10', '')::numeric) end,
    'minima10', case when v_gratuito then null
                     else coalesce(v_minimo_guardado, nullif(v_nota->>'minima10', '')::numeric, 7) end,
    'pesoEvaluado', case when v_gratuito then 0
                         else coalesce(nullif(v_nota->>'pesoEvaluado', '')::numeric, 0) end,
    'pendientes', case when v_gratuito then '[]'::jsonb
                       else coalesce(v_nota->'pendientes', '[]'::jsonb) end,
    'alcanzaMinimo', case when v_gratuito then v_puede
                          else coalesce((v_nota->>'alcanzaMinimo')::boolean, false) or v_folio is not null end,
    'aprobado', case when v_gratuito then v_puede
                     else coalesce((v_nota->>'aprobado')::boolean, false) or v_folio is not null end,
    'requisitos', case when v_gratuito then
      jsonb_build_array(jsonb_build_object(
        'titulo', 'Cuenta registrada',
        'cumple', v_puede or v_folio is not null,
        'detalle', 'Se habilita cuando se publica la constancia, al terminar el taller'))
      else
      jsonb_build_array(jsonb_build_object(
        'titulo', 'Calificación mínima',
        'cumple', coalesce((v_nota->>'alcanzaMinimo')::boolean, false) or v_folio is not null,
        'detalle', format('%s/10 · mínimo %s/10',
          coalesce(v_nota_guardada, nullif(v_nota->>'nota10', '')::numeric, 0),
          coalesce(v_minimo_guardado, nullif(v_nota->>'minima10', '')::numeric, 7))))
      end
  );
end
$$;

revoke all on function public.estado_constancia(bigint) from public;
grant execute on function public.estado_constancia(bigint) to authenticated;

-- -------------------------------------------------------------
-- 4) preparar_descarga_constancia (redefinición)
-- -------------------------------------------------------------
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
  v_gratuito boolean := false;
  v_max integer := 2;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;
  v_gratuito := coalesce(v_curso.gratuito, false);
  v_max := greatest(1, coalesce(v_curso.constancia_max_descargas, 2));

  if v_gratuito then
    if not coalesce(v_curso.constancia_gratuita_activa, false) then
      raise exception 'La constancia de este taller aún no está habilitada';
    end if;
  else
    if not public.tiene_acceso_al_curso(p_curso) then
      raise exception 'No estás inscrito en este curso';
    end if;
    if not coalesce(v_curso.constancia, true) then
      raise exception 'Este curso no emite constancia';
    end if;
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

  if v_existente and v_descargas >= v_max then
    raise exception 'Ya utilizaste las % descargas permitidas para esta constancia.', v_max;
  end if;

  -- Un taller no califica: no se exige completar nada, solo tener
  -- cuenta con nombre (lo pide la rama del insert más abajo).
  if not v_existente and not v_gratuito
     and not public.completo_el_curso(v_uid, p_curso) then
    raise exception 'Aún no alcanzas la calificación mínima del curso';
  end if;

  if not v_gratuito then
    v_nota := public.nota_curso_para_constancia(v_uid, p_curso);
    v_grado := coalesce(v_grado, nullif(v_nota->>'nota10', '')::numeric);
    v_minimo := coalesce(v_minimo, nullif(v_nota->>'minima10', '')::numeric, 7);
  end if;

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
    'maxDescargas', v_max,
    'descargas', v_descargas,
    'descargasRestantes', greatest(0, v_max - v_descargas)
  );
end
$$;

revoke all on function public.preparar_descarga_constancia(bigint) from public;
grant execute on function public.preparar_descarga_constancia(bigint) to authenticated;

notify pgrst, 'reload schema';
