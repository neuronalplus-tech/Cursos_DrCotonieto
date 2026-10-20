-- PASMU 41: DESHACER el script 39. ADVERTENCIA: borra el historial de metas, el catálogo de indicadores, las valoraciones de
-- riesgo en espera, canalizaciones, solicitudes de seguimiento y de visto bueno CON SUS DATOS. Haz respaldo antes. Solo PRUEBAS.
-- No se revierten: las columnas padre_id y nombre_unidad_atencion de unidades, ni los permisos nuevos (quita las asignaciones a mano).
begin;
drop trigger if exists trg_metas_historial on public.metas_operacion;
drop trigger if exists trg_unidad_ajustes_historial on public.unidad_ajustes;
drop trigger if exists trg_ajustes_globales_historial on public.ajustes_globales;
drop trigger if exists trg_lineas_base_historial on public.lineas_base;
drop function if exists public.pasmu_meta_guardar_motivo(bigint, text, numeric, text) cascade;
drop function if exists public.pasmu_indicador_agregar(text, text, text, text) cascade;
drop function if exists public.pasmu_unidad_indicadores_guardar(bigint, text[]) cascade;
drop function if exists public.pasmu_indicador_valor_registrar(bigint, text, date, numeric) cascade;
drop function if exists public.pasmu_unidad_alta(text, text, text, bigint, text, text[], text) cascade;
drop function if exists public.pasmu_riesgo_espera_registrar(bigint, text, text, text) cascade;
drop function if exists public.pasmu_lista_espera(bigint, date) cascade;
drop function if exists public.pasmu_canalizar_taller(bigint, bigint) cascade;
drop function if exists public.pasmu_canalizacion_revertir(bigint) cascade;
drop function if exists public.pasmu_seguimiento_solicitar(bigint, text) cascade;
drop function if exists public.pasmu_seguimiento_responder(bigint, text, text, date) cascade;
drop function if exists public.pasmu_visto_bueno_politica_guardar(boolean, integer) cascade;
drop function if exists public.pasmu_visto_bueno_persona_guardar(uuid, text) cascade;
drop function if exists public.pasmu_alta_equipo_solicitar(text, text, text, bigint) cascade;
drop function if exists public.pasmu_visto_bueno_decidir(bigint, boolean, text) cascade;
drop function if exists private.pasmu_trg_historial_metas() cascade;
drop function if exists private.pasmu_trg_historial_fase() cascade;
drop function if exists private.pasmu_trg_historial_linea_base() cascade;
drop function if exists private.pasmu_historial_registrar(bigint, text, text, text, text, text) cascade;
drop function if exists private.pasmu_requiere_visto_bueno(uuid) cascade;
drop table if exists public.solicitudes_visto_bueno, public.persona_visto_bueno, public.politica_visto_bueno, public.solicitudes_seguimiento,
  public.canalizaciones_taller, public.casos_riesgo_espera, public.valores_indicadores_manuales, public.unidad_indicadores,
  public.indicadores_catalogo, public.historial_metas cascade;
-- private.pasmu_es_direccion se conserva: la usan las políticas de otros scripts.
commit;
