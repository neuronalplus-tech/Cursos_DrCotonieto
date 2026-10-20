-- PASMU 30: verificación (solo lectura) de los scripts 23 a 29. Ejecútalo después de aplicarlos.
-- Devuelve una fila por comprobación; todas deben mostrar ok = true.

with tablas as (
  select unnest(array[
    'unidad_ajustes', 'ajustes_globales', 'metas_operacion', 'lineas_base', 'perfiles_terapeuta', 'casos_ruta',
    'casos_asignaciones', 'criterios_prioridad', 'casos_prioridad', 'preferencias_recordatorio', 'mensajes_entre_sesiones',
    'bitacora_consultas_expediente', 'actividades', 'actividad_audiencia', 'actividad_unidades', 'revisiones_cumplimiento',
    'familiogramas', 'constancias', 'instrumentos_obligatorios', 'hojas_membretadas']) as nombre
), estado_tablas as (
  select t.nombre, c.oid,
         coalesce(c.relrowsecurity, false) as rls,
         case when c.oid is null then false else
           has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
           or has_table_privilege('authenticated', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'SELECT')
           or has_table_privilege('anon', c.oid, 'INSERT') end as abierta
  from tablas t left join pg_class c on c.relname = t.nombre and c.relnamespace = 'public'::regnamespace
), publicas as (
  select p.oid, p.proname, p.prosecdef, p.proconfig
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in (
    'pasmu_ajustes_unidad_guardar', 'pasmu_ajustes_admin_guardar', 'pasmu_meta_guardar', 'pasmu_capacidad_guardar',
    'pasmu_ruta_registrar', 'pasmu_caso_asignar', 'pasmu_caso_prioridad', 'pasmu_caso_cerrar', 'pasmu_caso_reabrir',
    'pasmu_agenda_reprogramar', 'pasmu_recordatorios_guardar', 'pasmu_recordatorios_pendientes',
    'pasmu_mensaje_entre_sesiones_crear', 'pasmu_mensaje_entre_sesiones_marcar', 'pasmu_canalizacion_crear',
    'pasmu_mis_canalizaciones', 'pasmu_consulta_registrar', 'pasmu_bitacora_auditoria', 'pasmu_actividad_crear',
    'pasmu_actividad_eliminar', 'pasmu_mis_citas', 'pasmu_notas_del_caso', 'pasmu_nota_guardar_campos', 'pasmu_nota_firmar',
    'pasmu_historia_guardar', 'pasmu_familiograma_guardar', 'pasmu_revision_registrar', 'pasmu_revision_confirmar',
    'pasmu_constancia_emitir', 'pasmu_constancia_verificar', 'pasmu_instrumento_obligatorio_guardar', 'pasmu_kpis_operacion',
    'pasmu_ruta_estadisticas', 'pasmu_actividad_serie', 'pasmu_alertas_operacion', 'pasmu_linea_base_registrar',
    'pasmu_linea_base_aplicar_metas', 'pasmu_membrete_registrar', 'pasmu_membrete_resolver')
)
select 'tablas nuevas existen' as comprobacion,
       (select count(*) from estado_tablas where oid is not null) = 20 as ok,
       (select count(*) from estado_tablas where oid is not null) || ' de 20' as detalle
union all
select 'RLS activa en todas las tablas nuevas',
       not exists (select 1 from estado_tablas where oid is not null and not rls),
       coalesce((select string_agg(nombre, ', ') from estado_tablas where oid is not null and not rls), 'todas')
union all
select 'sin escritura directa para authenticated ni acceso para anon',
       not exists (select 1 from estado_tablas where oid is not null and abierta),
       coalesce((select string_agg(nombre, ', ') from estado_tablas where oid is not null and abierta), 'cerradas')
union all
select 'funciones públicas existen (39)', (select count(*) from publicas) = 39, (select count(*) from publicas) || ' de 39'
union all
select 'funciones públicas son SECURITY DEFINER con search_path vacío',
       not exists (select 1 from publicas where not prosecdef or not coalesce(proconfig @> array['search_path=""'], false)),
       coalesce((select string_agg(proname, ', ') from publicas where not prosecdef or not coalesce(proconfig @> array['search_path=""'], false)), 'todas')
union all
select 'anon solo ejecuta la verificación de constancias',
       (select coalesce(array_agg(proname::text order by proname), '{}'::text[]) from pg_proc
         where pronamespace = 'public'::regnamespace and proname like 'pasmu\_%'
           and has_function_privilege('anon', oid, 'EXECUTE')) = array['pasmu_constancia_verificar'],
       coalesce((select string_agg(proname, ', ') from pg_proc
         where pronamespace = 'public'::regnamespace and proname like 'pasmu\_%'
           and has_function_privilege('anon', oid, 'EXECUTE')), 'ninguna')
union all
select 'ninguna política usa request.jwt.claims como uuid (error de 16, 20 y 21)',
       not exists (select 1 from pg_policies where schemaname = 'public' and (coalesce(qual, '') like '%request.jwt.claims%' or coalesce(with_check, '') like '%request.jwt.claims%')),
       coalesce((select string_agg(tablename || '.' || policyname, ', ') from pg_policies
                  where schemaname = 'public' and (coalesce(qual, '') like '%request.jwt.claims%' or coalesce(with_check, '') like '%request.jwt.claims%')), 'ninguna')
union all
select 'bucket «membretes» privado con límite de 1.5 MB',
       exists (select 1 from storage.buckets where id = 'membretes' and not public and file_size_limit = 1500000),
       coalesce((select 'public=' || public || ', límite=' || file_size_limit from storage.buckets where id = 'membretes'), 'no existe')
union all
select 'políticas de Storage del bucket (4)',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'membretes\_%') = 4,
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'membretes\_%') || ' de 4'
union all
select 'permisos nuevos sembrados (14)',
       (select count(*) from public.permisos where codigo in ('calendario.ver', 'calendario.global', 'calendario.unidad', 'membrete.global',
          'membrete.unidad', 'unidad.configurar', 'plataforma.configurar', 'revision.contenido', 'revision.formal', 'revision.recibir',
          'casos.asignar', 'ruta.registrar', 'constancias.emitir', 'canalizacion.crear')) = 14,
       (select count(*) from public.permisos where categoria in ('calendario', 'documentos', 'admin', 'clinico')) || ' permisos en categorías afectadas'
union all
select 'roles nuevos (administracion_global, tutoria)',
       (select count(*) from public.roles where codigo in ('administracion_global', 'tutoria')) = 2, 'roles'
union all
select 'metas globales sembradas (16)',
       (select count(*) from public.metas_operacion where unidad_id is null) = 16,
       (select count(*) from public.metas_operacion where unidad_id is null) || ' de 16'
union all
select 'ajustes globales (1 fila)', (select count(*) from public.ajustes_globales) = 1, 'fila única'
union all
select 'registros inalterables (bitácora, asignaciones, notas firmadas)',
       (select count(*) from pg_trigger where tgname in ('trg_bitacora_consultas_inalterable', 'trg_casos_asignaciones_inalterable', 'trg_notas_soap_inalterable') and not tgisinternal) = 3,
       'triggers'
union all
select 'personas con rol de administración global (informativo)',
       true,
       (select count(distinct m.persona_id) || ' persona(s) con rol administracion_global' from public.miembros m
         join public.roles r on r.id = m.rol_id where r.codigo = 'administracion_global' and m.activo);
