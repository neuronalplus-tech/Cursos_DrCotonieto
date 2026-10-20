-- PASMU 40: verificación (solo lectura) del script 39. Todas las filas deben mostrar ok = true.
select 'tablas nuevas con RLS y sin escritura directa ni lectura anónima' as comprobacion,
       (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace
          and c.relname in ('historial_metas', 'indicadores_catalogo', 'unidad_indicadores', 'valores_indicadores_manuales', 'casos_riesgo_espera',
            'canalizaciones_taller', 'solicitudes_seguimiento', 'politica_visto_bueno', 'persona_visto_bueno', 'solicitudes_visto_bueno')
          and c.relrowsecurity and not has_table_privilege('authenticated', c.oid, 'INSERT') and not has_table_privilege('authenticated', c.oid, 'UPDATE')
          and not has_table_privilege('anon', c.oid, 'SELECT')) = 10 as ok, '' as detalle
union all
select 'funciones nuevas sin acceso anónimo (15)',
       (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
          'pasmu_meta_guardar_motivo', 'pasmu_indicador_agregar', 'pasmu_unidad_indicadores_guardar', 'pasmu_indicador_valor_registrar', 'pasmu_unidad_alta',
          'pasmu_riesgo_espera_registrar', 'pasmu_lista_espera', 'pasmu_canalizar_taller', 'pasmu_canalizacion_revertir', 'pasmu_seguimiento_solicitar',
          'pasmu_seguimiento_responder', 'pasmu_visto_bueno_politica_guardar', 'pasmu_visto_bueno_persona_guardar', 'pasmu_alta_equipo_solicitar', 'pasmu_visto_bueno_decidir')
          and not has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 15, ''
union all
select 'el historial de metas se llena solo (disparadores)',
       (select count(*) from pg_trigger where tgname in ('trg_metas_historial', 'trg_unidad_ajustes_historial', 'trg_ajustes_globales_historial', 'trg_lineas_base_historial') and not tgisinternal) = 4, ''
union all
select 'el catálogo trae los indicadores calculados',
       (select count(*) from public.indicadores_catalogo where tipo = 'calculado') >= 14, (select count(*)::text from public.indicadores_catalogo)
union all
select 'las metas admiten indicadores nuevos (sin lista fija de códigos)',
       not exists (select 1 from pg_constraint where conrelid = 'public.metas_operacion'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%asistencia%'), ''
union all
select 'Dirección ve incidentes pero no los atiende',
       not exists (select 1 from public.rol_permisos rp join public.roles r on r.id = rp.rol_id join public.permisos p on p.id = rp.permiso_id
                   where r.codigo = 'direccion_pasmu' and p.codigo = 'incidentes.gestionar')
       and exists (select 1 from public.rol_permisos rp join public.roles r on r.id = rp.rol_id join public.permisos p on p.id = rp.permiso_id
                   where r.codigo = 'direccion_pasmu' and p.codigo = 'incidentes.ver'), ''
union all
select 'la política de visto bueno existe', (select count(*) from public.politica_visto_bueno) = 1, '';
