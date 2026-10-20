-- PASMU 33: verificación (solo lectura) del script 32. Una fila por comprobación; todas deben mostrar ok = true.
with tablas as (
  select unnest(array['caso_plan_seguridad', 'caso_valoraciones_riesgo', 'incidentes_criticos', 'plantillas_consentimiento',
    'consentimientos_aceptados', 'mediciones_resultado', 'tareas_caso', 'diario_caso', 'credenciales_personal', 'derivaciones',
    'encuestas_satisfaccion', 'encuestas_control', 'caso_practicantes']) as nombre
), estado as (
  select t.nombre, coalesce(c.relrowsecurity, false) as rls,
         case when c.oid is null then true else
           has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
           or has_table_privilege('authenticated', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'SELECT') end as abierta
  from tablas t left join pg_class c on c.relname = t.nombre and c.relnamespace = 'public'::regnamespace
), funciones as (
  select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'pasmu_guardar_plan_seguridad', 'pasmu_abrir_incidente', 'pasmu_registrar_riesgo', 'pasmu_completar_seguimiento_riesgo',
    'pasmu_atender_incidente', 'pasmu_cerrar_incidente', 'pasmu_aceptar_consentimiento', 'pasmu_revocar_consentimiento',
    'pasmu_registrar_medicion', 'pasmu_asignar_tarea', 'pasmu_entregar_tarea', 'pasmu_revisar_tarea', 'pasmu_diario_agregar',
    'pasmu_guardar_credencial', 'pasmu_verificar_credencial', 'pasmu_crear_derivacion', 'pasmu_actualizar_derivacion',
    'pasmu_enviar_encuesta', 'pasmu_resumen_encuesta', 'pasmu_registrar_horas_practica', 'pasmu_firmar_horas_practica',
    'pasmu_evaluar_competencia', 'pasmu_alertas_atencion')
)
select 'tablas existentes con RLS' as comprobacion, count(*) filter (where rls) = 13 as ok, count(*) filter (where rls)::text || ' de 13' as detalle from estado
union all select 'ninguna tabla con escritura directa ni lectura anónima', not bool_or(abierta), coalesce(string_agg(nombre, ', ') filter (where abierta), 'ninguna') from estado
union all select 'funciones creadas (23)', count(*) = 23, count(*)::text from funciones
union all select 'funciones SECURITY DEFINER con search_path fijo', bool_and(prosecdef and proconfig::text like '%search_path%'), coalesce(string_agg(proname, ', ') filter (where not (prosecdef and proconfig::text like '%search_path%')), 'todas') from funciones
union all select 'ninguna función ejecutable por anon', not bool_or(anon_exec), coalesce(string_agg(proname, ', ') filter (where anon_exec), 'ninguna') from funciones
union all select 'plantillas de consentimiento sembradas (5, 2 obligatorias)',
  (select count(*) from public.plantillas_consentimiento) >= 5 and (select count(*) from public.plantillas_consentimiento where obligatoria) >= 2, (select count(*)::text from public.plantillas_consentimiento)
union all select 'permisos nuevos (7)', (select count(*) from public.permisos where codigo in ('seguridad.registrar', 'resultados.registrar', 'incidentes.gestionar', 'consentimientos.registrar', 'derivaciones.gestionar', 'personal.gestionar', 'practicantes.gestionar')) = 7, ''
union all select 'agenda_programar exige consentimientos', position('pasmu_consentimientos_faltantes' in pg_get_functiondef('private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text)'::regprocedure)) > 0, ''
union all select 'los indicadores incluyen casos con practicante en la muestra de revisión',
  exists (select 1 from pg_proc where proname = 'pasmu_kpis_operacion' and pronamespace = 'public'::regnamespace and prosrc like '%caso_practicantes%'), '';
