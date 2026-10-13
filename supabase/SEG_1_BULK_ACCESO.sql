-- =============================================================
--  SEGURIDAD 1 — CERRAR LA INSCRIPCIÓN LIBRE A CURSOS DE PAGO
--
--  EL AGUJERO (bloqueante)
--  `bulk_grant_course_access` y `bulk_remove_course_access` son
--  SECURITY DEFINER, no comprueban NINGÚN permiso, no fijan
--  search_path y NADIE les puso `revoke`, así que conservan el
--  EXECUTE por defecto para PUBLIC.
--
--  Consecuencia: cualquier alumno con cuenta —incluido un
--  autoinscrito de un taller gratuito— puede, desde la consola del
--  navegador, llamar:
--      supabase.rpc('bulk_grant_course_access',
--        { user_ids: ['<su uuid>'], target_course_id: <curso de pago> })
--  y quedar inscrito en cualquier curso de pago de cualquier
--  organización. La variante `remove` es destructiva: con un id de
--  curso ajeno deja sin acceso a una clase entera.
--
--  EL ARREGLO
--  Se exige `puede_gestionar_curso(target_course_id)` (que ya va por
--  es_admin_de de la organización del curso), se fija el search_path
--  y se revoca el acceso a PUBLIC dejándolo solo a authenticated.
--  La firma y el comportamiento para quien SÍ puede no cambian, así
--  que el panel (Admin.jsx) sigue funcionando igual.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Después, prueba de aceptación al final.
-- =============================================================

create or replace function public.bulk_grant_course_access(
  user_ids uuid[], target_course_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.puede_gestionar_curso(target_course_id) then
    raise exception 'No autorizado para gestionar el acceso a este curso'
      using errcode = '42501';
  end if;

  insert into public.acceso (usuario_id, curso_id, grupo, created_at)
  select unnest(user_ids), target_course_id, null, now()
  on conflict (usuario_id, curso_id) do nothing;
end;
$$;

create or replace function public.bulk_remove_course_access(
  user_ids uuid[], target_course_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.puede_gestionar_curso(target_course_id) then
    raise exception 'No autorizado para gestionar el acceso a este curso'
      using errcode = '42501';
  end if;

  delete from public.acceso
   where curso_id = target_course_id
     and usuario_id = any(user_ids);
end;
$$;

revoke all on function public.bulk_grant_course_access(uuid[], integer) from public;
revoke all on function public.bulk_remove_course_access(uuid[], integer) from public;
grant execute on function public.bulk_grant_course_access(uuid[], integer) to authenticated;
grant execute on function public.bulk_remove_course_access(uuid[], integer) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   Desde una sesión de ALUMNO (consola del navegador en la app):
--     await supabase.rpc('bulk_grant_course_access',
--       { user_ids:['<su uuid>'], target_course_id:<curso de pago> })
--   Debe devolver error "No autorizado…". Desde el panel del admin
--   del curso, la asignación masiva sigue funcionando igual.
-- -------------------------------------------------------------
