-- PASMU 34: DESHACER el script 32. ADVERTENCIA: borra plan de seguridad, valoraciones, incidentes, consentimientos, mediciones,
-- tareas, diario, credenciales, derivaciones, encuestas y vínculos de practicantes CON SUS DATOS. Haz respaldo antes. Solo PRUEBAS.
-- Ejecútalo ANTES de 31 si vas a deshacer también la operación.
-- Queda sin revertir: las columnas firmada_por/firmada_en en horas_practica, horas_requeridas en practicantes, y los cambios a
-- pasmu_agenda_programar y pasmu_kpis_operacion (vuelve a ejecutar 25 y 28 para restaurarlas).
begin;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as firma from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'pasmu_guardar_plan_seguridad', 'pasmu_abrir_incidente', 'pasmu_registrar_riesgo', 'pasmu_completar_seguimiento_riesgo',
    'pasmu_atender_incidente', 'pasmu_cerrar_incidente', 'pasmu_aceptar_consentimiento', 'pasmu_revocar_consentimiento',
    'pasmu_registrar_medicion', 'pasmu_asignar_tarea', 'pasmu_entregar_tarea', 'pasmu_revisar_tarea', 'pasmu_diario_agregar',
    'pasmu_guardar_credencial', 'pasmu_verificar_credencial', 'pasmu_crear_derivacion', 'pasmu_actualizar_derivacion',
    'pasmu_enviar_encuesta', 'pasmu_resumen_encuesta', 'pasmu_registrar_horas_practica', 'pasmu_firmar_horas_practica',
    'pasmu_evaluar_competencia', 'pasmu_alertas_atencion')
  loop execute 'drop function if exists ' || f.firma || ' cascade'; end loop;
end $$;
-- La función de agenda llama a pasmu_consentimientos_faltantes; se restaura antes de borrarla.
do $$
declare v_def text;
begin
  select pg_get_functiondef('private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text)'::regprocedure) into v_def;
  if position('pasmu_consentimientos_faltantes' in v_def) > 0 then
    v_def := regexp_replace(v_def, 'if coalesce\(array_length\(private\.pasmu_consentimientos_faltantes\(_caso_id\), 1\), 0\) > 0 then\s+raise exception [^;]+;\s+end if;\s+', '');
    execute v_def;
  end if;
end $$;
drop table if exists public.caso_plan_seguridad, public.caso_valoraciones_riesgo, public.incidentes_criticos,
  public.consentimientos_aceptados, public.plantillas_consentimiento, public.mediciones_resultado, public.tareas_caso,
  public.diario_caso, public.credenciales_personal, public.derivaciones, public.encuestas_satisfaccion,
  public.encuestas_control, public.caso_practicantes cascade;
drop function if exists private.pasmu_ver_clinico_caso(bigint) cascade;
drop function if exists private.pasmu_exigir_profesional(bigint, text) cascade;
drop function if exists private.pasmu_incidente_abrir(bigint, text) cascade;
drop function if exists private.pasmu_consentimientos_faltantes(bigint) cascade;
drop function if exists private.pasmu_consentimiento_estado(bigint, text, date) cascade;
drop function if exists private.pasmu_consentimiento_inalterable() cascade;
drop function if exists private.pasmu_credencial_estado(uuid, date) cascade;
drop function if exists private.pasmu_practicante_unidad(bigint) cascade;
drop function if exists private.pasmu_atencion_fecha(timestamptz) cascade;
delete from public.rol_permisos where permiso_id in (select id from public.permisos where codigo in
  ('seguridad.registrar', 'resultados.registrar', 'incidentes.gestionar', 'consentimientos.registrar', 'derivaciones.gestionar', 'personal.gestionar', 'practicantes.gestionar'));
delete from public.permisos where codigo in
  ('seguridad.registrar', 'resultados.registrar', 'incidentes.gestionar', 'consentimientos.registrar', 'derivaciones.gestionar', 'personal.gestionar', 'practicantes.gestionar');
commit;
