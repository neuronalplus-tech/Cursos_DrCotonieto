-- PASMU 35: cierra el acceso anónimo a las funciones públicas pasmu_* (deja solo la verificación de constancias).
-- Corrige la comprobación «anon solo ejecuta la verificación de constancias» del script 30: las funciones de los scripts
-- 11c_3, 20a, 20b y 19a nacieron con EXECUTE para PUBLIC. Quien no inicia sesión no podía usarlas de todos modos (cada una
-- exige un perfil), pero se cierra la puerta. Las personas con sesión conservan su acceso. Idempotente.
begin;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma, p.proname
           from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and (p.proname like 'pasmu\_%' or p.proname in ('mis_permisos_pasmu', 'material_del_caso'))
             and p.proname <> 'pasmu_constancia_verificar'
             and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE') is true)
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;
commit;
