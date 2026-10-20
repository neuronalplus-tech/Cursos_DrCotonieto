-- PASMU 37: verificación (solo lectura) del script 36. Todas las filas deben mostrar ok = true.
select 'roles definitivos activos (9)' as comprobacion,
       (select count(*) from public.roles where activo and codigo in ('direccion_pasmu', 'responsable_unidad', 'coordinador_clinico', 'supervisor_clinico',
         'clinico_administrativo', 'practicante', 'tallerista', 'terapeuta', 'persona_usuaria')) = 9 as ok,
       (select count(*)::text from public.roles where activo) || ' roles activos en total' as detalle
union all
select 'permisos nuevos (5)',
       (select count(*) from public.permisos where codigo in ('altas.personal', 'talleres.gestionar', 'correos.enviar', 'perfil.editar', 'chat.leer')) = 5, ''
union all
select 'todas las cuentas con rol activo pueden editar su perfil',
       not exists (select 1 from public.roles r where r.activo and not exists (
         select 1 from public.rol_permisos rp join public.permisos p on p.id = rp.permiso_id where rp.rol_id = r.id and p.codigo = 'perfil.editar')),
       coalesce((select string_agg(r.codigo, ', ') from public.roles r where r.activo and not exists (
         select 1 from public.rol_permisos rp join public.permisos p on p.id = rp.permiso_id where rp.rol_id = r.id and p.codigo = 'perfil.editar')), 'todas')
union all
select 'tablas nuevas con RLS y sin escritura directa',
       (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('comunicaciones', 'talleres', 'taller_sesiones')
          and c.relrowsecurity and not has_table_privilege('authenticated', c.oid, 'INSERT') and not has_table_privilege('authenticated', c.oid, 'UPDATE')
          and not has_table_privilege('anon', c.oid, 'SELECT')) = 3, ''
union all
select 'funciones nuevas sin acceso anónimo',
       (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
          and p.proname in ('pasmu_perfil_guardar', 'pasmu_prealta_equipo', 'pasmu_comunicacion_registrar', 'pasmu_taller_guardar', 'pasmu_taller_sesion_registrar')
          and not has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 5, ''
union all
select 'la pre-alta acepta solo los roles definitivos',
       position('coterapeuta' in pg_get_functiondef('public.pasmu_preAlta_equipo(text,text,text,bigint,bigint)'::regprocedure)) = 0
       and position('practicante' in pg_get_functiondef('public.pasmu_preAlta_equipo(text,text,text,bigint,bigint)'::regprocedure)) > 0, '';
