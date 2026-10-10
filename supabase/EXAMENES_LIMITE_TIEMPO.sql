-- Límite por intento para exámenes con temporizador.
-- Ejecutar una vez en Supabase SQL Editor antes de guardar exámenes con duración.

alter table public.examenes
  add column if not exists limite_minutos integer;

alter table public.examenes
  drop constraint if exists examenes_limite_minutos_positivo;
alter table public.examenes
  add constraint examenes_limite_minutos_positivo
  check (limite_minutos is null or limite_minutos between 1 and 600);

-- La interfaz envía las respuestas al vencer el reloj. Esta validación deja
-- 30 segundos para latencia de red; después rechaza entregas fuera de tiempo.
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
  v_vencimiento timestamptz;
begin
  select * into v_intento
    from public.intentos_examen i where i.id = p_intento;
  if not found then
    raise exception 'No existe el intento %', p_intento using errcode = 'no_data_found';
  end if;
  if v_intento.usuario_id is distinct from auth.uid() then
    raise exception 'Ese intento no es tuyo.' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(v_intento.pendiente, false) then
    raise exception 'Ese intento ya fue entregado.' using errcode = 'check_violation';
  end if;
  select * into v_examen from public.examenes e where e.id = v_intento.examen_id;
  if v_examen.limite_minutos is not null then
    v_vencimiento := v_intento.fecha + make_interval(mins => v_examen.limite_minutos);
    if clock_timestamp() > v_vencimiento + interval '30 seconds' then
      raise exception 'El tiempo de este examen terminó.' using errcode = 'check_violation';
    end if;
  end if;
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
