-- =============================================================
--  CONSTANCIAS · que el folio signifique algo
--
--  EL PROBLEMA QUE CIERRA
--  CONSTANCIAS_VERIFICABLES.sql dejaba que el navegador insertara
--  la constancia directamente (`usuario_id = auth.uid()`), y la
--  comprobación de requisitos vivía solo en React. Es decir:
--  cualquiera con la consola abierta podía crearse una constancia
--  de un curso que nunca cursó, con el nombre que quisiera, y la
--  URL pública la daría por auténtica.
--
--  Para un cliente institucional eso no es un detalle: es la
--  diferencia entre un documento verificable y un adorno.
--
--  CÓMO SE CIERRA
--  La emisión pasa a ser una función que recomprueba los
--  requisitos EN LA BASE y solo entonces genera el folio. El
--  navegador deja de poder insertar.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere CONSTANCIAS_VERIFICABLES.sql y
--  TAREAS_1_BASE.sql aplicados.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿ESTA PERSONA TERMINÓ ESTE CURSO?
--
--    Misma regla que enseña la pantalla, pero aquí es la que
--    manda. Si alguna vez discrepan, la de verdad es esta.
--
--    Cuenta solo lo que existe: un curso sin tareas no las exige.
--    Y uno sin nada de nada no bloquea por un tecnicismo.
-- -------------------------------------------------------------
create or replace function public.completo_el_curso(p_usuario uuid, p_curso bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mods   bigint[];
  v_recs   bigint[];
  v_tareas bigint[];
  v_exs    bigint[];
  v_n      integer;
begin
  select coalesce(array_agg(m.id), '{}')
    into v_mods
    from public.modulos m
   where m.curso_id = p_curso and m.disponible is distinct from false;

  -- --- Material ---
  select coalesce(array_agg(r.id), '{}')
    into v_recs
    from public.recursos r
   where r.modulo_id = any(v_mods);

  if array_length(v_recs, 1) > 0 then
    select count(*) into v_n
      from public.progreso_usuario p
     where p.usuario_id = p_usuario
       and p.recurso_id = any(v_recs)
       and p.completado = true;
    if v_n < array_length(v_recs, 1) then return false; end if;
  end if;

  -- --- Entregas: tienen que estar calificadas, no solo subidas ---
  select coalesce(array_agg(t.id), '{}')
    into v_tareas
    from public.tareas t
   where t.activo = true
     and (t.curso_id = p_curso or t.modulo_id = any(v_mods));

  if array_length(v_tareas, 1) > 0 then
    select count(*) into v_n
      from public.entregas e
     where e.usuario_id = p_usuario
       and e.tarea_id = any(v_tareas)
       and e.calificado_en is not null;
    if v_n < array_length(v_tareas, 1) then return false; end if;
  end if;

  -- --- Exámenes: basta un intento aprobado de cada uno ---
  select coalesce(array_agg(x.id), '{}')
    into v_exs
    from public.examenes x
   where x.activo = true
     and (x.curso_id = p_curso or x.modulo_id = any(v_mods));

  if array_length(v_exs, 1) > 0 then
    select count(distinct i.examen_id) into v_n
      from public.intentos_examen i
     where i.usuario_id = p_usuario
       and i.examen_id = any(v_exs)
       and i.aprobado = true;
    if v_n < array_length(v_exs, 1) then return false; end if;
  end if;

  return true;
end
$$;

revoke all on function public.completo_el_curso(uuid, bigint) from public;
grant execute on function public.completo_el_curso(uuid, bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) EMITIR
--
--    Devuelve el folio. Si ya se emitió antes, devuelve el MISMO:
--    reemitir con folio nuevo invalidaría los impresos que esa
--    persona ya repartió.
--
--    El nombre sale de `perfiles`, no de lo que mande el
--    navegador. La plataforma no puede saber si un nombre es el
--    legal, pero sí puede impedir que el documento diga una cosa
--    y el perfil otra.
-- -------------------------------------------------------------
create or replace function public.emitir_constancia(p_curso bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_folio  text;
  v_nombre text;
  v_prof   text;
  v_pref   text;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select c.folio into v_folio
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;
  if v_folio is not null then
    return v_folio;
  end if;

  if not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  if not public.completo_el_curso(v_uid, p_curso) then
    raise exception 'Todavía no cumples los requisitos del curso';
  end if;

  select p.nombre_completo, p.profesion into v_nombre, v_prof
    from public.perfiles p where p.id = v_uid;

  if coalesce(btrim(v_nombre), '') = '' then
    raise exception 'Completa tu nombre en el perfil antes de emitir';
  end if;

  -- Prefijo legible del curso + año + azar. El azar sale de la
  -- base y no del navegador: así nadie elige su propio folio.
  select upper(substring(regexp_replace(
           translate(cu.titulo, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
           '[^A-Za-z]', '', 'g') from 1 for 3))
    into v_pref
    from public.cursos cu where cu.id = p_curso;
  v_pref := coalesce(nullif(v_pref, ''), 'CUR');

  v_folio := v_pref || '-' || to_char(now(), 'YYYY') || '-' ||
             upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  insert into public.constancias
    (usuario_id, curso_id, folio, nombre_completo, profesion)
  values
    (v_uid, p_curso, v_folio, btrim(v_nombre), nullif(btrim(coalesce(v_prof, '')), ''));

  return v_folio;
end
$$;

revoke all on function public.emitir_constancia(bigint) from public;
grant execute on function public.emitir_constancia(bigint) to authenticated;

-- -------------------------------------------------------------
-- 3) CERRAR LA PUERTA DE ATRÁS
--
--    Sin esto lo anterior no sirve de nada: el navegador podría
--    seguir insertando a mano y saltarse la función.
--
--    Tampoco se deja actualizar: cambiarle el nombre a una
--    constancia ya emitida la convertiría en otra cosa, con el
--    mismo folio ya repartido.
-- -------------------------------------------------------------
drop policy if exists "constancias_insert" on public.constancias;
drop policy if exists "constancias_update" on public.constancias;

-- La lectura se queda: cada quien ve las suyas, el admin todas.
-- (`verificar_constancia` sigue sirviendo a los de fuera.)

-- La bitácora, si está instalada, también las vigila.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'registrar_auditoria'
  ) then
    drop trigger if exists auditar_constancias on public.constancias;
    create trigger auditar_constancias
      after insert or update or delete on public.constancias
      for each row execute function public.registrar_auditoria();
  end if;
end $$;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 4) COMPROBACIÓN
-- -------------------------------------------------------------
select 'funciones' as que, count(*) as n, '2' as esperado
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('completo_el_curso', 'emitir_constancia')

union all
select 'politicas de escritura que quedan', count(*), '1'
from pg_policies
where schemaname = 'public' and tablename = 'constancias'
  and cmd in ('INSERT', 'UPDATE', 'DELETE');

-- =============================================================
--  RESULTADO ESPERADO
--  · funciones = 2
--  · politicas de escritura = 1  (solo el borrado del admin)
--
--  La prueba de verdad: desde la consola del navegador, intenta
--      await supabase.from('constancias').insert({ ... })
--  Debe fallar por RLS. Emitir solo funciona por la función.
-- =============================================================
