-- PASMU 45: verificación de solo lectura del script 44. Todas las filas deben dar ok = true.
select 'tabla plataforma_estado con RLS' as comprobacion,
       exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = 'plataforma_estado' and c.relrowsecurity) as ok
union all
select 'pasmu_guardar_plataforma existe', to_regprocedure('public.pasmu_guardar_plataforma(jsonb,bigint)') is not null
union all
select 'pasmu_registrar_acceso_demo existe', to_regprocedure('public.pasmu_registrar_acceso_demo(text,text,integer,text[])') is not null
union all
select 'pasmu_listar_accesos_demo existe', to_regprocedure('public.pasmu_listar_accesos_demo()') is not null
union all
select 'pasmu_revocar_acceso_demo existe', to_regprocedure('public.pasmu_revocar_acceso_demo(bigint)') is not null
union all
select 'pasmu_mis_perfiles_demo existe', to_regprocedure('public.pasmu_mis_perfiles_demo()') is not null
union all
select 'anon no ejecuta pasmu_guardar_plataforma',
       not has_function_privilege('anon', 'public.pasmu_guardar_plataforma(jsonb,bigint)', 'execute')
union all
select 'unidad DEMO y rol experiencia_demo (script 42)',
       exists (select 1 from public.unidades where codigo = 'DEMO') and exists (select 1 from public.roles where codigo = 'experiencia_demo');
