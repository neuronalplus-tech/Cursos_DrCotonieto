-- PASMU 31: DESHACER los scripts 24 a 29 (no deshace 23, que son correcciones).
-- ADVERTENCIA: borra tablas y columnas nuevas CON SUS DATOS (actividades, revisiones, familiogramas, constancias,
-- ruta de atención, bitácora de consultas, hojas membretadas, metas…). Haz respaldo antes. Solo PRUEBAS.
--
-- Queda sin revertir (por diseño):
--   * private.pasmu_agenda_programar conserva la versión de 25 (profesional del caso, empalmes, agenda administrativa).
--     Para volver a la anterior ejecuta de nuevo 11b_agenda_notas.sql.
--   * Los archivos subidos al bucket «membretes» (bórralos desde el panel de Storage; un bucket con objetos no se elimina).
--   * La persona con rol administracion_global (quita su membresía en `miembros` si ya no se usa).
begin;

-- Storage
drop policy if exists membretes_read on storage.objects;
drop policy if exists membretes_insert on storage.objects;
drop policy if exists membretes_update on storage.objects;
drop policy if exists membretes_delete on storage.objects;
-- El bucket «membretes» NO se borra aquí: Supabase prohíbe borrar de storage.* con SQL. Bórralo desde Storage > membretes (Delete bucket).

-- Funciones públicas
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in (
      'pasmu_ajustes_unidad_guardar', 'pasmu_ajustes_admin_guardar', 'pasmu_meta_guardar', 'pasmu_capacidad_guardar',
      'pasmu_ruta_registrar', 'pasmu_caso_asignar', 'pasmu_caso_prioridad', 'pasmu_caso_cerrar', 'pasmu_caso_reabrir',
      'pasmu_agenda_reprogramar', 'pasmu_recordatorios_guardar', 'pasmu_recordatorios_pendientes',
      'pasmu_mensaje_entre_sesiones_crear', 'pasmu_mensaje_entre_sesiones_marcar', 'pasmu_canalizacion_crear',
      'pasmu_mis_canalizaciones', 'pasmu_consulta_registrar', 'pasmu_bitacora_auditoria', 'pasmu_actividad_crear',
      'pasmu_actividad_eliminar', 'pasmu_calendario', 'pasmu_mis_citas', 'pasmu_notas_del_caso', 'pasmu_nota_guardar_campos',
      'pasmu_nota_firmar', 'pasmu_historia_guardar', 'pasmu_familiograma_guardar', 'pasmu_revision_registrar',
      'pasmu_revision_confirmar', 'pasmu_constancia_emitir', 'pasmu_constancia_verificar',
      'pasmu_instrumento_obligatorio_guardar', 'pasmu_kpis_operacion', 'pasmu_ruta_estadisticas', 'pasmu_actividad_serie',
      'pasmu_alertas_operacion', 'pasmu_linea_base_registrar', 'pasmu_linea_base_aplicar_metas',
      'pasmu_membrete_registrar', 'pasmu_membrete_resolver')
  loop
    execute 'drop function if exists ' || f.firma || ' cascade';
  end loop;
end $$;

-- Tablas (de las que dependen hacia las que no)
drop table if exists public.hojas_membretadas cascade;
drop table if exists public.constancias cascade;
drop table if exists public.revisiones_cumplimiento cascade;
drop table if exists public.familiogramas cascade;
drop table if exists public.actividad_unidades cascade;
drop table if exists public.actividad_audiencia cascade;
drop table if exists public.actividades cascade;
drop table if exists public.instrumentos_obligatorios cascade;
drop table if exists public.bitacora_consultas_expediente cascade;
drop table if exists public.mensajes_entre_sesiones cascade;
drop table if exists public.preferencias_recordatorio cascade;
drop table if exists public.casos_prioridad cascade;
drop table if exists public.criterios_prioridad cascade;
drop table if exists public.casos_asignaciones cascade;
drop table if exists public.casos_ruta cascade;
drop table if exists public.perfiles_terapeuta cascade;
drop table if exists public.lineas_base cascade;
drop table if exists public.metas_operacion cascade;
drop table if exists public.ajustes_globales cascade;
drop table if exists public.unidad_ajustes cascade;

-- Columnas añadidas a tablas anteriores
alter table public.casos drop column if exists motivo_cierre;
alter table public.agenda drop column if exists reprogramada_desde;
alter table public.agenda drop column if exists motivo_reprogramacion;
alter table public.notas_soap drop column if exists campos;
alter table public.notas_soap drop column if exists estado;
alter table public.notas_soap drop column if exists firmada_en;
alter table public.notas_soap drop column if exists firmada_por;
alter table public.notas_soap drop column if exists agenda_id;
alter table public.historia_integral drop column if exists campos;

-- Ayudas privadas
drop function if exists private.pasmu_casos_ruta_alta() cascade;
drop function if exists private.pasmu_bloquear_modificacion() cascade;
drop function if exists private.pasmu_audiencia_valida() cascade;
drop function if exists private.pasmu_nota_firmada_inalterable() cascade;
drop function if exists private.pasmu_campos_validos(jsonb) cascade;
drop function if exists private.pasmu_margenes_validos(jsonb) cascade;
drop function if exists private.pasmu_membrete_ruta_permitida(text, boolean) cascade;
drop function if exists private.pasmu_actividad_visible(uuid) cascade;
drop function if exists private.pasmu_ve_todo_el_calendario() cascade;
drop function if exists private.pasmu_mis_grupos() cascade;
drop function if exists private.pasmu_puede_ver_operacion(bigint, uuid) cascade;
drop function if exists private.pasmu_casos_alcance(bigint, uuid) cascade;
drop function if exists private.pasmu_fase(bigint) cascade;
drop function if exists private.pasmu_meta(bigint, text) cascade;
drop function if exists private.pasmu_semaforo(numeric, numeric, text) cascade;
drop function if exists private.pasmu_fecha_local(timestamptz) cascade;
drop function if exists private.pasmu_etapa_actual(bigint) cascade;
drop function if exists private.pasmu_agenda_bloqueada(bigint) cascade;
drop function if exists private.pasmu_soy_persona_del_caso(bigint) cascade;
drop function if exists private.pasmu_auditar(bigint, text, text, text, jsonb) cascade;
drop function if exists private.pasmu_mis_roles(bigint) cascade;
drop function if exists private.pasmu_es_admin_global() cascade;

-- Permisos y roles nuevos (solo si nadie los usa todavía)
delete from public.rol_permisos rp using public.permisos p
  where p.id = rp.permiso_id and p.codigo in (
    'calendario.ver', 'calendario.global', 'calendario.unidad', 'membrete.global', 'membrete.unidad', 'unidad.configurar',
    'plataforma.configurar', 'revision.contenido', 'revision.formal', 'revision.recibir', 'casos.asignar', 'ruta.registrar',
    'constancias.emitir', 'canalizacion.crear');
delete from public.permisos where codigo in (
    'calendario.ver', 'calendario.global', 'calendario.unidad', 'membrete.global', 'membrete.unidad', 'unidad.configurar',
    'plataforma.configurar', 'revision.contenido', 'revision.formal', 'revision.recibir', 'casos.asignar', 'ruta.registrar',
    'constancias.emitir', 'canalizacion.crear');
delete from public.roles r where r.codigo in ('administracion_global', 'tutoria')
  and not exists (select 1 from public.miembros m where m.rol_id = r.id);

commit;
