-- PASMU 43: verificación (solo lectura) del script 42. Todas las filas deben mostrar ok = true.
select 'rol experiencia_demo activo' as comprobacion,
       exists (select 1 from public.roles where codigo = 'experiencia_demo' and activo) as ok,
       '' as detalle
union all
select 'unidad DEMO activa',
       exists (select 1 from public.unidades where codigo = 'DEMO' and activo), ''
union all
select 'solo 6 permisos de lectura (+perfil)',
       (select count(*) from public.rol_permisos rp join public.roles r on r.id = rp.rol_id
         join public.permisos p on p.id = rp.permiso_id
        where r.codigo = 'experiencia_demo') = 6
       and not exists (select 1 from public.rol_permisos rp join public.roles r on r.id = rp.rol_id
         join public.permisos p on p.id = rp.permiso_id
        where r.codigo = 'experiencia_demo'
          and p.codigo not in ('dashboard.ver', 'casos.ver', 'agenda.ver', 'expediente.ver', 'reportes.ver', 'perfil.editar')), ''
union all
select 'sin escritura: casos.crear/agenda.programar/expediente.editar/reportes.exportar/admin.*',
       not exists (select 1 from public.rol_permisos rp join public.roles r on r.id = rp.rol_id
         join public.permisos p on p.id = rp.permiso_id
        where r.codigo = 'experiencia_demo'
          and (p.codigo like '%.crear' or p.codigo like '%.editar' or p.codigo like '%.exportar'
               or p.codigo like 'admin.%' or p.codigo like 'configuracion.%'
               or p.codigo in ('agenda.programar', 'expediente.documentos', 'seguridad.ver',
                               'supervision.revisar', 'supervision.comentar', 'chat.leer',
                               'correos.enviar', 'altas.personal', 'talleres.gestionar'))), ''
union all
select 'ámbito unidad en las 6 asignaciones',
       not exists (select 1 from public.rol_permisos rp join public.roles r on r.id = rp.rol_id
        where r.codigo = 'experiencia_demo' and rp.ambito <> 'unidad'), ''
union all
select 'pre-alta acepta experiencia_demo y conserva definitivos (sin coterapeuta)',
       position('experiencia_demo' in pg_get_functiondef('public.pasmu_preAlta_equipo(text,text,text,bigint,bigint)'::regprocedure)) > 0
       and position('coterapeuta' in pg_get_functiondef('public.pasmu_preAlta_equipo(text,text,text,bigint,bigint)'::regprocedure)) = 0
       and position('practicante' in pg_get_functiondef('public.pasmu_preAlta_equipo(text,text,text,bigint,bigint)'::regprocedure)) > 0, '';
