-- =============================================================
--  EXÁMENES 2 · servir_examen, corregido
--
--  QUÉ ARREGLA
--  servir_examen estaba declarada `stable` y sin embargo hace un
--  INSERT (abre el intento pendiente del alumno). La documentación
--  de PostgreSQL es tajante: "PostgreSQL requires that STABLE and
--  IMMUTABLE functions contain no SQL commands other than SELECT to
--  prevent data modification". Con `stable` la función corre con el
--  snapshot de la consulta que la llama, así que el INSERT es
--  ilegal y el SELECT posterior ni vería la fila recién creada.
--
--  Lo que veía el alumno: la vista caía al modo viejo (el catch del
--  navegador se tragaba el error) y mostraba el examen del editor;
--  respondía, y al enviar la base le contestaba
--      new row violates row-level security policy for table
--      "intentos_examen"
--  porque el insert directo del navegador ya está vetado a propósito
--  (EXAMENES_ALEATORIOS dejó intentos_insert_own en with check false).
--
--  Segundo arreglo, mismo síntoma: la puerta de acceso solo dejaba
--  pasar a quien está inscrito en `acceso`. Quien imparte el curso
--  no está inscrito (da clase), así que al probar su propio examen
--  recibía "No tienes acceso a este examen" y caía al mismo modo
--  viejo. Ahora también pasa quien gestiona el curso, igual que ya
--  hace puede_entregar().
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run. Es
--  idempotente: se puede correr las veces que haga falta.
-- =============================================================

create or replace function public.servir_examen(p_examen bigint)
returns jsonb
language plpgsql
volatile                   -- escribe el intento pendiente: no puede ser stable
security definer
set search_path = public
as $$
declare
  v_examen   public.examenes%rowtype;
  v_todas    jsonb;
  v_total    int;
  v_n        int;
  v_orden    int[];
  v_i        int;
  v_j        int;
  v_tmp      int;
  v_elegidas jsonb := '[]'::jsonb;
  v_p        jsonb;
  v_ops      jsonb;
  v_pares    jsonb;
  v_usados   int;
  v_limite   int;
  v_intento  bigint;
  v_limpias  jsonb;
  v_curso    bigint;
begin
  select * into v_examen from public.examenes e where e.id = p_examen;
  if not found then
    raise exception 'No existe el examen %', p_examen
      using errcode = 'no_data_found';
  end if;
  if not coalesce(v_examen.activo, true) then
    raise exception 'Este examen no está activo.'
      using errcode = 'check_violation';
  end if;

  v_curso := public.curso_del_examen(v_examen.curso_id, v_examen.modulo_id);
  -- Inscrito en el curso, o quien lo gestiona. Antes solo entraba el
  -- inscrito, y el docente que quería probar su examen se quedaba
  -- fuera con un "no tienes acceso" que la vista no distinguía de
  -- una base sin migrar.
  if not (public.puede_gestionar_curso(v_curso)
       or public.tiene_acceso_al_curso(v_curso)) then
    raise exception 'No tienes acceso a este examen.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.puede_entregar('examen', p_examen, auth.uid()) then
    raise exception 'El plazo de este examen ya cerró.'
      using errcode = 'check_violation';
  end if;


  -- Los pendientes no cuentan: son sorteos abiertos, no intentos.
  select i.id into v_intento
    from public.intentos_examen i
   where i.examen_id = p_examen
     and i.usuario_id = auth.uid()
     and coalesce(i.pendiente, false) = true
   order by i.fecha desc
   limit 1;
  select count(*) into v_usados
    from public.intentos_examen i
   where i.examen_id = p_examen
     and i.usuario_id = auth.uid()
     and coalesce(i.pendiente, false) = false;
  v_limite := coalesce(v_examen.max_intentos, 0);
  if v_limite > 0 and v_usados >= v_limite then
    raise exception 'Ya usaste tus % intentos.', v_limite
      using errcode = 'check_violation';
  end if;
  if v_intento is null then
    v_todas := coalesce(v_examen.preguntas, '[]'::jsonb);
    v_total := jsonb_array_length(v_todas);
    v_n := coalesce(nullif(v_examen.aleatorio_n, 0), v_total);
    v_n := least(greatest(v_n, 0), v_total);
    v_orden := array(select g from generate_series(0, v_total - 1) g);
    if coalesce(nullif(v_examen.aleatorio_n, 0), 0) > 0 then
      v_i := v_total - 1;
      while v_i > 0 loop
        v_j := floor(random() * (v_i + 1))::int;
        v_tmp := v_orden[v_i + 1];
        v_orden[v_i + 1] := v_orden[v_j + 1];
        v_orden[v_j + 1] := v_tmp;
        v_i := v_i - 1;
      end loop;
    end if;
    for v_i in 1 .. v_n loop
      v_p := v_todas -> v_orden[v_i];
      -- Se guarda el juego YA mezclado: la corrección lee la
      -- posición correcta ahí, no en el examen original.
      if v_examen.mezclar_opciones
         and coalesce(v_p ->> 'tipo', 'opcion') in ('opcion', 'vf') then
        select coalesce(jsonb_agg(o order by random()), '[]'::jsonb)
          into v_ops
          from jsonb_array_elements(coalesce(v_p -> 'opciones', '[]'::jsonb)) o;
        v_p := jsonb_set(v_p, '{opciones}', v_ops);
      end if;
      if v_examen.mezclar_opciones
         and coalesce(v_p ->> 'tipo', 'opcion') = 'emparejar' then
        select coalesce(jsonb_agg(x order by random()), '[]'::jsonb)
          into v_pares
          from jsonb_array_elements(coalesce(v_p -> 'pares', '[]'::jsonb)) x;
        v_p := jsonb_set(v_p, '{pares}', v_pares);
      end if;
      v_elegidas := v_elegidas || jsonb_build_array(v_p);
    end loop;
    insert into public.intentos_examen
      (usuario_id, examen_id, respuestas, calificacion, aprobado, preguntas, pendiente)
    values
      (auth.uid(), p_examen, '{}'::jsonb, 0, false, v_elegidas, true)
    returning id into v_intento;
  end if;
  select coalesce(jsonb_agg(
      public.limpiar_pregunta(x) order by s.n), '[]'::jsonb)
    into v_limpias
    from public.intentos_examen i,
         jsonb_array_elements(coalesce(i.preguntas, '[]'::jsonb))
           with ordinality as s(x, n)
   where i.id = v_intento;
  return jsonb_build_object(
    'intento_id', v_intento,
    'examen_id', v_examen.id,
    'titulo', v_examen.titulo,
    'descripcion', v_examen.descripcion,
    'umbral_aprobacion', v_examen.umbral_aprobacion,
    'max_intentos', v_examen.max_intentos,
    'preguntas', coalesce(v_limpias, '[]'::jsonb),
    'intentos_usados', v_usados,
    'intentos_limite', case when v_limite > 0 then v_limite else null end
  );
end $$;

revoke all on function public.servir_examen(bigint) from public;
grant execute on function public.servir_examen(bigint)
  to authenticated, service_role;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
--  COMPROBACIÓN (solo lectura)
--  Debe decir 'ok - volatile'. Si dice 'MAL - sigue en stable',
--  el parche no se aplicó.
-- -------------------------------------------------------------
select p.proname as funcion,
       case p.provolatile
         when 'v' then 'ok - volatile'
         when 's' then 'MAL - sigue en stable'
         when 'i' then 'MAL - immutable'
       end as volatilidad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'servir_examen';
