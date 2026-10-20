-- PASMU 00c: ¿qué scripts SQL están aplicados? SOLO LECTURA (no crea nada). Pégalo en el SQL Editor de Supabase y ejecútalo.
-- Cada fila busca un objeto que el script crea; "aplicado" = existe. Los scripts procedurales (06, 17b) y de solo lectura
-- (08, 08b, 30, 33) no dejan huella y no se listan. Devuelve el resultado completo (copia la tabla y mándala).
with f as (select p.proname as n, ns.nspname as s from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace),
t as (select tablename as n from pg_tables where schemaname = 'public'),
chk(orden, archivo, aplicado) as (values
  (1,  '01_catalogos.sql',                 exists (select 1 from t where n = 'instituciones') and exists (select 1 from t where n = 'competencias')),
  (2,  '02_atencion.sql',                  exists (select 1 from t where n = 'casos') and exists (select 1 from t where n = 'horas_practica')),
  (3,  '03_reportes.sql',                  exists (select 1 from t where n = 'auditoria_actividad')),
  (4,  '04_rls.sql',                       exists (select 1 from f where s = 'private' and n = 'pasmu_case_has_permission')),
  (5,  '05_seed_roles.sql',                coalesce((select count(*) from public.roles) > 0, false)),
  (9,  '09_gobierno_configuracion.sql',    exists (select 1 from t where n = 'solicitudes_cambio_configuracion')),
  (10, '10_payloads_tipados.sql',          exists (select 1 from t where n = 'configuracion_contratos')),
  (12, '10c_validador_contrato.sql',       exists (select 1 from f where n = 'pasmu_payload_contrato_valido')),
  (14, '11a_casos_controlados.sql',        exists (select 1 from f where s = 'private' and n = 'pasmu_caso_crear')),
  (15, '11b_agenda_notas.sql',             exists (select 1 from f where s = 'private' and n = 'pasmu_agenda_programar')),
  (16, '11c_wrappers_publicos.sql',        exists (select 1 from f where s = 'public' and n = 'pasmu_caso_crear')),
  (17, '11c_3_rpc_permisos_extras.sql',    exists (select 1 from f where s = 'public' and n = 'pasmu_mis_permisos_pasmu')),
  (19, '13_altas_bitacora.sql',            exists (select 1 from t where n = 'prealtas_equipo')),
  (21, '14_expediente_modular.sql',        exists (select 1 from t where n = 'historia_clinica')),
  (22, '14b_banco_recursos.sql',           exists (select 1 from t where n = 'banco_recursos')),
  (23, '16_avisos_asistencia.sql',         exists (select 1 from t where n = 'avisos_cita')),
  (26, '17_roles_reales.sql',              coalesce(exists (select 1 from public.roles where codigo = 'supervisor_clinico'), false)),
  (28, '18a_expediente_catalogos.sql',     exists (select 1 from t where n = 'expediente_catalogos')),
  (29, '18b_historia_soap.sql',            exists (select 1 from t where n = 'historia_integral') and exists (select 1 from t where n = 'notas_soap')),
  (30, '19a_expediente_nom.sql',           exists (select 1 from t where n = 'expediente_caso')),
  (33, '20b_soap_rpc_fixed.sql',           exists (select 1 from f where s = 'public' and n = 'pasmu_notas_soap_crear')),
  (34, '21_chat_interno.sql',              exists (select 1 from t where n = 'salas_chat')),
  (35, '21a_chat_rpcs.sql',                exists (select 1 from f where s = 'public' and n = 'pasmu_chat_mensaje_crear')),
  (36, '22_catalogos_completos_nom.sql',   exists (select 1 from f where s = 'public' and n = 'pasmu_notas_soap_guardar')),
  (37, '23_correcciones_previas.sql',      exists (select 1 from f where s = 'private' and n = 'pasmu_es_revisor_del_caso')),
  (38, '24_gobierno_operacion.sql',        exists (select 1 from t where n = 'unidad_ajustes') and exists (select 1 from t where n = 'metas_operacion')),
  (39, '25_ruta_asignaciones_agenda.sql',  exists (select 1 from t where n = 'casos_ruta') and exists (select 1 from t where n = 'casos_asignaciones')),
  (40, '26_calendario_actividades.sql',    exists (select 1 from t where n = 'actividades')),
  (41, '27_revisiones_familiograma_constancias.sql', exists (select 1 from t where n = 'revisiones_cumplimiento') and exists (select 1 from t where n = 'constancias')),
  (42, '28_indicadores_operacion.sql',     exists (select 1 from f where s = 'public' and n = 'pasmu_kpis_operacion')),
  (43, '29_hojas_membretadas_storage.sql', exists (select 1 from t where n = 'hojas_membretadas')),
  (46, '36_roles_definitivos_altas_correos.sql', exists (select 1 from t where n = 'comunicaciones') and exists (select 1 from t where n = 'talleres')),
  (47, '39_gobernanza_espera_seguimiento.sql', exists (select 1 from t where n = 'historial_metas') and exists (select 1 from t where n = 'casos_riesgo_espera')),
  (44, '32_atencion_segura.sql',           exists (select 1 from t where n = 'incidentes_criticos') and exists (select 1 from f where s = 'public' and n = 'pasmu_registrar_riesgo'))
)
select orden, archivo, case when aplicado then '✅ aplicado' else '❌ falta' end as estado
from chk order by orden;
