-- =============================================================
--  EXÁMENES ALEATORIOS POR ALUMNO
--
--  QUÉ RESUELVE
--  Hoy el sorteo ocurre AL ARMAR el examen: todos los alumnos ven
--  las mismas preguntas. Que a cada uno le toque un juego distinto
--  reduce la copia, que es la queja habitual de un examen en línea.
--
--  QUÉ DEJA ESTE SCRIPT
--  Columnas examenes.aleatorio_n / examenes.mezclar_opciones,
--  columna intentos_examen.preguntas con el juego servido a ese
--  intento, y dos funciones security definer: servir_examen (sortea
--  y devuelve preguntas LIMPIAS) y entregar_examen (califica en la
--  base contra el juego guardado).
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere FECHAS_LIMITE y ROLES_2_APLICAR.
--
--  NADA CAMBIA HASTA QUE LO PIDAS. Sin aleatorio_n, servir_examen
--  devuelve todas las preguntas en su orden, igual que hoy.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LAS COLUMNAS
-- -------------------------------------------------------------
alter table public.examenes
  add column if not exists aleatorio_n integer;
alter table public.examenes
  add column if not exists mezclar_opciones boolean not null default false;

alter table public.examenes
  drop constraint if exists examenes_aleatorio_n_check;
alter table public.examenes
  add constraint examenes_aleatorio_n_check
  check (aleatorio_n is null or aleatorio_n >= 0);

alter table public.intentos_examen
  add column if not exists preguntas jsonb;

alter table public.intentos_examen
  add column if not exists pendiente boolean not null default false;
-- 2) LIMPIAR UNA PREGUNTA PARA EL ALUMNO
--
--    Lo que sale por servir_examen no puede traer la respuesta:
--    opcion/vf sale con opciones de solo `texto` (sin `correcta`);
--    corta sale sin `respuesta`; emparejar sale con pares de solo
--    `id` y `premisa`, más `respuestas_posibles` aparte para poder
--    armar el selector sin adivinar escribiendo.
--    El `id` se conserva tal cual: las respuestas se guardan
--    indexadas por él y la entrega califica contra el juego
--    guardado, no contra posiciones.
-- -------------------------------------------------------------
create or replace function public.limpiar_pregunta(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p -> 'id',
    'tipo', coalesce(p ->> 'tipo', 'opcion'),
    'pregunta', p -> 'pregunta',
    'opciones', case
      when coalesce(p ->> 'tipo', 'opcion') in ('opcion', 'vf') then
        (select coalesce(jsonb_agg(
           jsonb_build_object('texto', o -> 'texto')
           order by s.n), '[]'::jsonb)
         from jsonb_array_elements(coalesce(p -> 'opciones', '[]'::jsonb))
           with ordinality as s(o, n))
      else null end,
    'pares', case
      when coalesce(p ->> 'tipo', 'opcion') = 'emparejar' then
        (select coalesce(jsonb_agg(
           jsonb_build_object('id', x -> 'id', 'premisa', x -> 'premisa')
           order by s.n), '[]'::jsonb)
         from jsonb_array_elements(coalesce(p -> 'pares', '[]'::jsonb))
           with ordinality as s(x, n))
      else null end,
    'respuestas_posibles', case
      when coalesce(p ->> 'tipo', 'opcion') = 'emparejar' then
        (select coalesce(jsonb_agg(x -> 'respuesta' order by s.n), '[]'::jsonb)
         from jsonb_array_elements(coalesce(p -> 'pares', '[]'::jsonb))
           with ordinality as s(x, n))
      else null end
  ))
$$;

revoke all on function public.limpiar_pregunta(jsonb) from public;
grant execute on function public.limpiar_pregunta(jsonb)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 3) LA CORRECCIÓN, EN LA BASE
--
--    Replica esCorrecta() de src/lib/examenes.js:
--    opcion/vf mira `correcta` en la posición respondida; corta
--    acepta la esperada o una variante separada por | o ;; emparejar
--    exige todos los pares iguales (comparación exacta, como en la
--    pantalla: aquí no se inventa tolerancia nueva).
--    Si algún día cambian las reglas, cambian en los dos sitios a
--    la vez o volverán a discrepar, que ya pasó con la calificación
--    del curso y hubo que unificarla.
-- -------------------------------------------------------------
create or replace function public.es_correcta_examen(p jsonb, r jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_tipo     text := coalesce(p ->> 'tipo', 'opcion');
  v_txt      text;
  v_idx      int;
  v_esperado text;
  v_dada     text;
begin
  if r is null then return false; end if;
  if v_tipo = 'opcion' or v_tipo = 'vf' then
    v_txt := r #>> '{}';
    if v_txt is null or v_txt !~ '^-?[0-9]+$' then return false; end if;
    v_idx := v_txt::int;
    return coalesce(((p -> 'opciones' -> v_idx) ->> 'correcta')::boolean, false);
  elsif v_tipo = 'corta' then
    v_esperado := nullif(btrim(lower(coalesce(p ->> 'respuesta', ''))), '');
    if v_esperado is null then return false; end if;
    v_dada := btrim(lower(r #>> '{}'));
    if v_dada is null or v_dada = '' then return false; end if;
    if v_dada = v_esperado then return true; end if;
    return exists (
      select 1
        from unnest(string_to_array(replace(v_esperado, ';', '|'), '|')) x
       where nullif(btrim(x), '') = v_dada);
  elsif v_tipo = 'emparejar' then
    if jsonb_typeof(r) is distinct from 'object' then return false; end if;
    if jsonb_array_length(coalesce(p -> 'pares', '[]'::jsonb)) = 0 then return false; end if;
    return coalesce((select bool_and(
             btrim(coalesce(r ->> (x ->> 'id'), '')) = btrim(coalesce(x ->> 'respuesta', ''))
           )
           from jsonb_array_elements(p -> 'pares') x), false);
  else
    return false;
  end if;
end $$;

revoke all on function public.es_correcta_examen(jsonb, jsonb) from public;
grant execute on function public.es_correcta_examen(jsonb, jsonb)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 4) SERVIR EL JUEGO DE UN ALUMNO (firma y puertas de entrada)
-- -------------------------------------------------------------
-- Sortea, guarda el juego completo en un intento PENDIENTE y
-- devuelve solo preguntas limpias más los datos del examen.
-- Si el examen no pide aleatoriedad (aleatorio_n nulo o 0),
-- devuelve todas en su orden: el mismo juego de hoy.
-- La mezcla usa Fisher-Yates sobre los índices, igual que
-- tomarAlAzar() en src/lib/banco.js: las dos versiones deben
-- repartir igual y la probada es Fisher-Yates.
-- Quien gestiona el curso no presenta exámenes: puede_entregar()
-- ya lo contempla. El pendiente ata el sorteo a la entrega y no
-- cuenta como presentado (ni en el límite ni en historiales).
-- Si el alumno recarga a medio examen, recupera SU juego en vez
-- de abrir otro: recargar hasta pescar el juego fácil no enseña.
-- PARTE 4A: cabecera y puertas; el sorteo viene en la PARTE 4B.
create or replace function public.servir_examen(p_examen bigint)
returns jsonb
language plpgsql
stable
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
  if not public.tiene_acceso_al_curso(
    public.curso_del_examen(v_examen.curso_id, v_examen.modulo_id)) then
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

-- -------------------------------------------------------------
-- 5) ENTREGAR Y CALIFICAR EN LA BASE
-- -------------------------------------------------------------
-- Recibe el intento pendiente que abrió servir_examen y las
-- respuestas { id_de_pregunta: respuesta }. Califica contra el
-- juego GUARDADO en ese intento, no contra lo que mande el
-- navegador ni contra el examen actual (que el editor pudo haber
-- cambiado mientras el alumno respondía).
-- El intento es de quien lo abrió: el admin no presenta exámenes
-- por otros; si necesita corregir algo, lo hace con SQL.
create or replace function public.entregar_examen(p_intento bigint, p_respuestas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intento   public.intentos_examen%rowtype;
  v_examen    public.examenes%rowtype;
  v_juego     jsonb;
  v_total     int;
  v_correctas int := 0;
  v_nota      int;
  v_aprobado  boolean;
  v_p         jsonb;
begin
  select * into v_intento
    from public.intentos_examen i where i.id = p_intento;
  if not found then
    raise exception 'No existe el intento %', p_intento
      using errcode = 'no_data_found';
  end if;
  if v_intento.usuario_id is distinct from auth.uid() then
    raise exception 'Ese intento no es tuyo.'
      using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(v_intento.pendiente, false) then
    raise exception 'Ese intento ya fue entregado.'
      using errcode = 'check_violation';
  end if;
  select * into v_examen from public.examenes e where e.id = v_intento.examen_id;
  -- El juego guardado manda; el examen actual es el respaldo para
  -- los intentos de antes de la aleatorización, que no traen juego.
  v_juego := coalesce(v_intento.preguntas, v_examen.preguntas, '[]'::jsonb);
  v_total := jsonb_array_length(v_juego);
  for v_p in select x from jsonb_array_elements(v_juego) x loop
    if public.es_correcta_examen(v_p, (p_respuestas -> (v_p ->> 'id'))) then
      v_correctas := v_correctas + 1;
    end if;
  end loop;
  v_nota := case when v_total > 0
    then round((v_correctas::numeric / v_total) * 100)::int else 0 end;
  v_aprobado := v_nota >= coalesce(v_examen.umbral_aprobacion, 0);
  update public.intentos_examen i
     set respuestas = coalesce(p_respuestas, '{}'::jsonb),
         calificacion = v_nota,
         aprobado = v_aprobado,
         pendiente = false
   where i.id = p_intento;
  return jsonb_build_object(
    'calificacion', v_nota,
    'aprobado', v_aprobado,
    'correctas', v_correctas,
    'total', v_total
  );
end $$;

revoke all on function public.entregar_examen(bigint, jsonb) from public;
grant execute on function public.entregar_examen(bigint, jsonb)
  to authenticated, service_role;
-- -------------------------------------------------------------
-- 6) EL CIERRE: EL NAVEGADOR YA NO ESCRIBE LA NOTA
-- Quien entrega ya no inserta directo: el insert lo hace
-- servir_examen (security definer) y la nota la pone
-- entregar_examen. Sin este cambio, el navegador podria seguir
-- insertando su propia calificacion como hoy.
-- -------------------------------------------------------------
drop policy if exists "intentos_insert_own" on public.intentos_examen;
create policy "intentos_insert_own" on public.intentos_examen
  for insert to authenticated
  with check (false);

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 7) COMPROBACION
-- -------------------------------------------------------------
select 'columnas de aleatoriedad' as que,
  (select count(*)::text from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'examenes'
        and column_name in ('aleatorio_n', 'mezclar_opciones'))
        or (table_name = 'intentos_examen'
        and column_name in ('preguntas', 'pendiente')))) as valor
union all
select 'funciones de sorteo y entrega',
  (select count(*)::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('servir_examen', 'entregar_examen',
        'limpiar_pregunta', 'es_correcta_examen'))
union all
select 'inserts directos bloqueados',
  (select case when with_check = 'false' then 'si'
    else 'NO - SIGUE ABIERTO' end
     from pg_policies
    where schemaname = 'public' and tablename = 'intentos_examen'
      and policyname = 'intentos_insert_own');

-- =============================================================
--  RESULTADO ESPERADO
--  columnas de aleatoriedad = 4
--  funciones de sorteo y entrega = 4
--  inserts directos bloqueados = si
--  QUE PROBAR (con cuenta de alumno, no con la tuya)
--  1. Examen sin aleatorio_n: sirve todas en su orden, igual que hoy.
--  2. Con aleatorio_n = 2 en examen de 5: cada servir trae 2
--     distintas, y NUNCA con `correcta` ni `respuesta` a la vista.
--  3. Entrega: la nota la calcula la base y el intento guarda su
--     juego en intentos_examen.preguntas.
-- =============================================================



-- -------------------------------------------------------------
-- 8) REGISTRO DEL ORDEN (ESTADO.sql lo lee el dueño)
--    Queda agregado en ESTADO.sql como orden 26, después de
--    FECHAS_LIMITE (25), que es el que este script requiere.
-- -------------------------------------------------------------

