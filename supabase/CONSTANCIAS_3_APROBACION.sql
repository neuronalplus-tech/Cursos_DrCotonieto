-- =============================================================
-- CONSTANCIAS · mínimo de aprobación y cálculo ponderado
--
-- La emisión queda condicionada a la nota final del curso, calculada
-- en el servidor con cursos.ponderacion (v2 jerárquica o formato
-- plano anterior). La regla replica src/lib/calificacion.js.
--
-- Aplicar en Supabase SQL Editor después de:
--   CONSTANCIAS_VERIFICABLES.sql
--   CONSTANCIAS_2_EMISION.sql
--   PONDERACION.sql
-- =============================================================

alter table public.constancias
  add column if not exists calificacion_final numeric(4,2),
  add column if not exists minimo_aprobacion numeric(4,2);

-- El curso que el alumno está consultando debe emitir constancia.
update public.cursos
   set constancia = true
 where id = 35
   and titulo = 'Problemas contemporáneos en educación'
   and coalesce(gratuito, false) = false;

-- Devuelve la nota acumulada sobre 10, el porcentaje evaluado y si ya
-- alcanzó la mínima. Las actividades pendientes aportan cero a la nota.
create or replace function public.nota_curso_para_constancia(
  p_usuario uuid,
  p_curso bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config          jsonb;
  v_actividades     jsonb := '[]'::jsonb;
  v_candidatas      jsonb := '[]'::jsonb;
  v_pendientes      jsonb := '[]'::jsonb;
  v_grupo           jsonb;
  v_criterio        jsonb;
  v_actividad       jsonb;
  v_grupo_modulo    text;
  v_grupo_id        text;
  v_tipo            text;
  v_suma_grupos     numeric := 0;
  v_suma_criterios  numeric := 0;
  v_suma_actividades numeric := 0;
  v_peso_grupo      numeric := 0;
  v_peso_criterio   numeric := 0;
  v_peso_tipo       numeric := 0;
  v_peso_tipos      numeric := 0;
  v_peso_item       numeric := 0;
  v_peso_evaluado   numeric := 0;
  v_puntos          numeric := 0;
  v_minimo10        numeric := 7;
  v_valor           numeric;
  v_conteo          integer := 0;
  v_conteo_actividades integer := 0;
  v_ponderada       boolean := false;
begin
  select c.ponderacion into v_config
    from public.cursos c where c.id = p_curso;
  if not found then return null; end if;

  -- Cada pieza usa la misma escala que la pantalla del alumno: 0–100.
  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', 'examenes', 'id', q.id::text, 'moduloId', q.modulo_id,
           'titulo', q.titulo, 'valor', q.valor
         ) order by q.id), '[]'::jsonb)
    into v_actividades
    from (
      select x.id, x.modulo_id, x.titulo, max(i.calificacion)::numeric as valor
        from public.examenes x
        left join public.intentos_examen i
          on i.examen_id = x.id and i.usuario_id = p_usuario
       where x.activo = true
         and (x.curso_id = p_curso or x.modulo_id in (
           select m.id from public.modulos m where m.curso_id = p_curso
         ))
       group by x.id, x.modulo_id, x.titulo
    ) q;

  select v_actividades || coalesce(jsonb_agg(jsonb_build_object(
           'tipo', 'tareas', 'id', q.id::text, 'moduloId', q.modulo_id,
           'titulo', q.titulo, 'valor', q.valor
         ) order by q.id), '[]'::jsonb)
    into v_actividades
    from (
      select t.id, t.modulo_id, t.titulo,
             max(e.calificacion)::numeric
               / case when max(t.puntos_max) > 0 then max(t.puntos_max) else 100 end
               * 100 as valor
        from public.tareas t
        left join public.entregas e
          on e.tarea_id = t.id and e.usuario_id = p_usuario
         and e.calificado_en is not null
       where t.activo = true
         and (t.curso_id = p_curso or t.modulo_id in (
           select m.id from public.modulos m where m.curso_id = p_curso
         ))
       group by t.id, t.modulo_id, t.titulo
    ) q;

  select v_actividades || coalesce(jsonb_agg(jsonb_build_object(
           'tipo', 'foro', 'id', q.id::text, 'moduloId', null,
           'titulo', q.titulo, 'valor', q.valor
         ) order by q.id), '[]'::jsonb)
    into v_actividades
    from (
      select h.id, h.titulo,
             avg(r.calificacion / coalesce(nullif(h.puntos_max, 0), 10) * 100)::numeric as valor
        from public.foro_hilos h
        left join public.foro_respuestas r
          on r.hilo_id = h.id and r.autor_id = p_usuario
         and r.borrada = false and r.calificacion is not null
       where h.curso_id = p_curso and h.califica = true
       group by h.id, h.titulo
    ) q;

  -- Avance es una sola actividad del curso, y solo cuenta cuando está
  -- incluido en la ponderación configurada.
  select count(*)::integer,
         count(*) filter (where exists (
           select 1 from public.progreso_usuario p
            where p.usuario_id = p_usuario and p.recurso_id = r.id
              and p.completado = true
         ))::integer
    into v_conteo_actividades, v_conteo
    from public.recursos r
    join public.modulos m on m.id = r.modulo_id
   where m.curso_id = p_curso;
  if v_conteo_actividades > 0 then
    v_actividades := v_actividades || jsonb_build_array(jsonb_build_object(
      'tipo', 'avance', 'id', 'curso', 'moduloId', null,
      'titulo', 'Avance del material',
      'valor', v_conteo::numeric / v_conteo_actividades * 100
    ));
  end if;
  v_conteo := 0;

  if jsonb_typeof(v_config) = 'object'
     and coalesce((v_config->>'version')::integer, 0) = 2
     and jsonb_typeof(v_config->'grupos') = 'array' then
    select coalesce(sum(greatest(coalesce(nullif(g.value->>'peso', '')::numeric, 0), 0)), 0)
      into v_suma_grupos
      from jsonb_array_elements(v_config->'grupos') as g(value);

    if v_suma_grupos > 0 then
      for v_grupo in select value from jsonb_array_elements(v_config->'grupos') as g(value)
      loop
        v_peso_grupo := greatest(coalesce(nullif(v_grupo->>'peso', '')::numeric, 0), 0)
                        / v_suma_grupos * 100;
        v_grupo_modulo := v_grupo->>'moduloId';

        if v_grupo->>'modo' = 'entregable' then
          v_candidatas := '[]'::jsonb;
          select coalesce(jsonb_agg(a.value), '[]'::jsonb)
            into v_candidatas
            from jsonb_array_elements(v_actividades) as a(value)
           where a.value->>'tipo' = v_grupo->'entregable'->>'tipo'
             and a.value->>'id' = v_grupo->'entregable'->>'id';

          for v_actividad in select value from jsonb_array_elements(v_candidatas) as a(value)
          loop
            v_peso_item := v_peso_grupo;
            if jsonb_typeof(v_actividad->'valor') <> 'null'
               and v_actividad->'valor' is not null then
              v_peso_evaluado := v_peso_evaluado + v_peso_item;
              v_puntos := v_puntos + (v_actividad->>'valor')::numeric * v_peso_item / 100;
              v_conteo := v_conteo + 1;
            elsif v_peso_item > 0 then
              v_pendientes := v_pendientes || jsonb_build_array(jsonb_build_object(
                'tipo', v_actividad->>'tipo', 'id', v_actividad->>'id',
                'moduloId', v_actividad->>'moduloId', 'titulo', v_actividad->>'titulo',
                'pesoCurso', round(v_peso_item, 2)));
            end if;
          end loop;
        else
          select coalesce(sum(greatest(coalesce(nullif(c.value->>'peso', '')::numeric, 0), 0)), 0)
            into v_suma_criterios
            from jsonb_array_elements(coalesce(v_grupo->'criterios', '[]'::jsonb)) as c(value);

          if v_suma_criterios > 0 then
            for v_criterio in
              select value from jsonb_array_elements(coalesce(v_grupo->'criterios', '[]'::jsonb)) as c(value)
            loop
              v_peso_criterio := greatest(coalesce(nullif(v_criterio->>'peso', '')::numeric, 0), 0)
                                 / v_suma_criterios * 100;
              v_candidatas := '[]'::jsonb;

              if v_criterio->>'fuente' = 'tipos' then
                select coalesce(jsonb_agg(a.value), '[]'::jsonb)
                  into v_candidatas
                  from jsonb_array_elements(v_actividades) as a(value)
                 where exists (
                   select 1 from jsonb_array_elements_text(
                     coalesce(v_criterio->'tipos', '[]'::jsonb)
                   ) as t(tipo)
                   where t.tipo = a.value->>'tipo'
                 )
                   and ((v_grupo_modulo is null and a.value->>'moduloId' is null)
                     or (v_grupo_modulo is not null and a.value->>'moduloId' = v_grupo_modulo));

                v_conteo_actividades := jsonb_array_length(v_candidatas);
                for v_actividad in select value from jsonb_array_elements(v_candidatas) as a(value)
                loop
                  v_peso_item := v_peso_grupo * v_peso_criterio / 100
                                 * case when v_conteo_actividades > 0
                                   then 1::numeric / v_conteo_actividades else 0 end;
                  if jsonb_typeof(v_actividad->'valor') <> 'null'
                     and v_actividad->'valor' is not null then
                    v_peso_evaluado := v_peso_evaluado + v_peso_item;
                    v_puntos := v_puntos + (v_actividad->>'valor')::numeric * v_peso_item / 100;
                    v_conteo := v_conteo + 1;
                  elsif v_peso_item > 0 then
                    v_pendientes := v_pendientes || jsonb_build_array(jsonb_build_object(
                      'tipo', v_actividad->>'tipo', 'id', v_actividad->>'id',
                      'moduloId', v_actividad->>'moduloId', 'titulo', v_actividad->>'titulo',
                      'pesoCurso', round(v_peso_item, 2)));
                  end if;
                end loop;
              else
                select coalesce(jsonb_agg(jsonb_build_object(
                         'tipo', r.value->>'tipo', 'id', r.value->>'id',
                         'peso', r.value->'peso', 'valor', a.value->'valor'
                       )), '[]'::jsonb)
                  into v_candidatas
                  from jsonb_array_elements(coalesce(v_criterio->'actividades', '[]'::jsonb)) as r(value)
                  join jsonb_array_elements(v_actividades) as a(value)
                    on a.value->>'tipo' = r.value->>'tipo'
                   and a.value->>'id' = r.value->>'id';

                v_conteo_actividades := jsonb_array_length(v_candidatas);
                if v_criterio->>'distribucion' = 'manual' then
                  select coalesce(sum(greatest(coalesce(nullif(a.value->>'peso', '')::numeric, 0), 0)), 0)
                    into v_suma_actividades
                    from jsonb_array_elements(v_candidatas) as a(value);
                else
                  v_suma_actividades := v_conteo_actividades;
                end if;

                for v_actividad in select value from jsonb_array_elements(v_candidatas) as a(value)
                loop
                  if v_criterio->>'distribucion' = 'manual' then
                    v_peso_tipo := greatest(coalesce(nullif(v_actividad->>'peso', '')::numeric, 0), 0);
                  else
                    v_peso_tipo := 1;
                  end if;
                  v_peso_item := v_peso_grupo * v_peso_criterio / 100
                                 * case when v_suma_actividades > 0
                                   then v_peso_tipo / v_suma_actividades else 0 end;
                  if jsonb_typeof(v_actividad->'valor') <> 'null'
                     and v_actividad->'valor' is not null then
                    v_peso_evaluado := v_peso_evaluado + v_peso_item;
                    v_puntos := v_puntos + (v_actividad->>'valor')::numeric * v_peso_item / 100;
                    v_conteo := v_conteo + 1;
                  elsif v_peso_item > 0 then
                    v_pendientes := v_pendientes || jsonb_build_array(jsonb_build_object(
                      'tipo', v_actividad->>'tipo', 'id', v_actividad->>'id',
                      'moduloId', v_actividad->>'moduloId', 'titulo', v_actividad->>'titulo',
                      'pesoCurso', round(v_peso_item, 2)));
                  end if;
                end loop;
              end if;
            end loop;
          end if;
        end if;
      end loop;
    end if;

    v_minimo10 := coalesce(nullif(v_config->>'minima10', '')::numeric, 7);
  else
    v_ponderada := coalesce(nullif(v_config->>'examenes', '')::numeric, 0) > 0
      or coalesce(nullif(v_config->>'tareas', '')::numeric, 0) > 0
      or coalesce(nullif(v_config->>'foro', '')::numeric, 0) > 0
      or coalesce(nullif(v_config->>'avance', '')::numeric, 0) > 0;

    v_minimo10 := coalesce(nullif(v_config->>'minima', '')::numeric / 10, 7);
    if v_ponderada then
      v_peso_tipos := greatest(coalesce(nullif(v_config->>'examenes', '')::numeric, 0), 0)
        + greatest(coalesce(nullif(v_config->>'tareas', '')::numeric, 0), 0)
        + greatest(coalesce(nullif(v_config->>'foro', '')::numeric, 0), 0)
        + greatest(coalesce(nullif(v_config->>'avance', '')::numeric, 0), 0);

      if v_peso_tipos > 0 then
        for v_tipo in select unnest(array['examenes', 'tareas', 'foro', 'avance'])
        loop
          v_peso_tipo := greatest(coalesce(nullif(v_config->>v_tipo, '')::numeric, 0), 0);
          if v_peso_tipo <= 0 then continue; end if;
          select coalesce(jsonb_agg(a.value), '[]'::jsonb)
            into v_candidatas
            from jsonb_array_elements(v_actividades) as a(value)
           where a.value->>'tipo' = v_tipo;
          v_conteo_actividades := jsonb_array_length(v_candidatas);
          if v_conteo_actividades = 0 then continue; end if;
          v_peso_item := (v_peso_tipo / v_peso_tipos * 100) / v_conteo_actividades;
          for v_actividad in select value from jsonb_array_elements(v_candidatas) as a(value)
          loop
            if jsonb_typeof(v_actividad->'valor') <> 'null'
               and v_actividad->'valor' is not null then
              v_peso_evaluado := v_peso_evaluado + v_peso_item;
              v_puntos := v_puntos + (v_actividad->>'valor')::numeric * v_peso_item / 100;
              v_conteo := v_conteo + 1;
            elsif v_peso_item > 0 then
              v_pendientes := v_pendientes || jsonb_build_array(jsonb_build_object(
                'tipo', v_actividad->>'tipo', 'id', v_actividad->>'id',
                'moduloId', v_actividad->>'moduloId', 'titulo', v_actividad->>'titulo',
                'pesoCurso', round(v_peso_item, 2)));
            end if;
          end loop;
        end loop;
      end if;
    else
      select coalesce(jsonb_agg(a.value), '[]'::jsonb)
        into v_candidatas
        from jsonb_array_elements(v_actividades) as a(value)
       where a.value->>'tipo' in ('examenes', 'tareas', 'foro');
      v_conteo_actividades := jsonb_array_length(v_candidatas);
      if v_conteo_actividades > 0 then
        v_peso_item := 100::numeric / v_conteo_actividades;
        for v_actividad in select value from jsonb_array_elements(v_candidatas) as a(value)
        loop
          if jsonb_typeof(v_actividad->'valor') <> 'null'
             and v_actividad->'valor' is not null then
            v_peso_evaluado := v_peso_evaluado + v_peso_item;
            v_puntos := v_puntos + (v_actividad->>'valor')::numeric * v_peso_item / 100;
            v_conteo := v_conteo + 1;
          elsif v_peso_item > 0 then
            v_pendientes := v_pendientes || jsonb_build_array(jsonb_build_object(
              'tipo', v_actividad->>'tipo', 'id', v_actividad->>'id',
              'moduloId', v_actividad->>'moduloId', 'titulo', v_actividad->>'titulo',
              'pesoCurso', round(v_peso_item, 2)));
          end if;
        end loop;
      end if;
    end if;
  end if;

  v_minimo10 := greatest(0, least(10, v_minimo10));
  return jsonb_build_object(
    'nota10', case when v_conteo > 0 then round(round(v_puntos, 1) / 10, 2) else null end,
    'puntos', round(v_puntos, 2),
    'pesoEvaluado', round(v_peso_evaluado, 2),
    'minima10', v_minimo10,
    'evaluadas', v_conteo,
    'pendientes', v_pendientes,
    'alcanzaMinimo', v_conteo > 0 and round(v_puntos, 1) / 10 >= v_minimo10,
    'aprobado', v_conteo > 0 and round(v_puntos, 1) / 10 >= v_minimo10
  );
end
$$;

revoke all on function public.nota_curso_para_constancia(uuid, bigint) from public;
grant execute on function public.nota_curso_para_constancia(uuid, bigint) to service_role;

-- La constancia se habilita solo por la nota final aprobatoria configurada.
create or replace function public.completo_el_curso(p_usuario uuid, p_curso bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_nota jsonb;
begin
  v_nota := public.nota_curso_para_constancia(p_usuario, p_curso);
  return coalesce((v_nota->>'aprobado')::boolean, false);
end
$$;

revoke all on function public.completo_el_curso(uuid, bigint) from public;
revoke all on function public.completo_el_curso(uuid, bigint) from authenticated, anon;
grant execute on function public.completo_el_curso(uuid, bigint) to service_role;

-- Estado que puede consultar el alumno: mismos motivos en pantalla y
-- en servidor. El folio ya emitido conserva acceso a su reimpresión.
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
  v_nota_guardada numeric(4,2);
  v_minimo_guardado numeric(4,2);
  v_nota jsonb;
  v_puede boolean := false;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  if not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;

  select c.folio, c.calificacion_final, c.minimo_aprobacion
    into v_folio, v_nota_guardada, v_minimo_guardado
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;

  v_nota := public.nota_curso_para_constancia(v_uid, p_curso);
  v_puede := v_folio is not null or (
    not coalesce(v_curso.gratuito, false)
    and coalesce(v_curso.constancia, true)
    and coalesce((v_nota->>'aprobado')::boolean, false)
  );

  return jsonb_build_object(
    'emite', not coalesce(v_curso.gratuito, false) and coalesce(v_curso.constancia, true),
    'disponible', v_puede,
    'folio', v_folio,
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

-- La emisión exige la nota mínima y registra una instantánea auditable.
create or replace function public.emitir_constancia(p_curso bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_folio text;
  v_nombre text;
  v_prof text;
  v_pref text;
  v_nota jsonb;
  v_grado numeric(4,2);
  v_minimo numeric(4,2);
  v_curso public.cursos%rowtype;
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

  select c.folio into v_folio from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;
  if v_folio is not null then return v_folio; end if;

  if not public.completo_el_curso(v_uid, p_curso) then
    raise exception 'Aún no alcanzas la calificación mínima del curso';
  end if;

  v_nota := public.nota_curso_para_constancia(v_uid, p_curso);
  v_grado := nullif(v_nota->>'nota10', '')::numeric;
  v_minimo := nullif(v_nota->>'minima10', '')::numeric;

  select p.nombre_completo, p.profesion into v_nombre, v_prof
    from public.perfiles p where p.id = v_uid;
  if coalesce(btrim(v_nombre), '') = '' then
    raise exception 'Completa tu nombre en el perfil antes de emitir';
  end if;

  select upper(substring(regexp_replace(
           translate(c.titulo, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
           '[^A-Za-z]', '', 'g') from 1 for 3))
    into v_pref from public.cursos c where c.id = p_curso;
  v_pref := coalesce(nullif(v_pref, ''), 'CUR');
  v_folio := v_pref || '-' || to_char(now(), 'YYYY') || '-' ||
             upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 6));

  insert into public.constancias
    (usuario_id, curso_id, folio, nombre_completo, profesion,
     calificacion_final, minimo_aprobacion)
  values
    (v_uid, p_curso, v_folio, btrim(v_nombre),
     nullif(btrim(coalesce(v_prof, '')), ''), v_grado, v_minimo);

  return v_folio;
end
$$;

revoke all on function public.emitir_constancia(bigint) from public;
grant execute on function public.emitir_constancia(bigint) to authenticated;

notify pgrst, 'reload schema';

select 'funciones de constancia' as que, count(*) as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('nota_curso_para_constancia', 'completo_el_curso',
                     'estado_constancia', 'emitir_constancia');
