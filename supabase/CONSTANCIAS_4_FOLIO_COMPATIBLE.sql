-- Fix the folio generator used by the student-facing issuance RPC.
-- Apply once in Supabase SQL Editor after CONSTANCIAS_3_APROBACION.sql.
-- Uses PostgreSQL's built-in UUID generator; no pgcrypto byte function is needed.

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
             upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

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
