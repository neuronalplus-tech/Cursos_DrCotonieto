-- PASMU 38: DESHACER el script 36. ADVERTENCIA: borra comunicaciones, talleres y sus sesiones CON SUS DATOS. Solo PRUEBAS.
-- No se revierten: los roles/permisos nuevos (quita las asignaciones a mano si ya no se usan), las columnas de personas
-- (correo_contacto, disponibilidad, enfoque) ni la versión de pasmu_preAlta_equipo (ejecuta de nuevo 13b para restaurarla).
begin;
drop function if exists public.pasmu_perfil_guardar(text, text, text, text) cascade;
drop function if exists public.pasmu_comunicacion_registrar(bigint, text, text, text, text, integer, integer) cascade;
drop function if exists public.pasmu_taller_guardar(bigint, integer, text) cascade;
drop function if exists public.pasmu_taller_sesion_registrar(bigint, date, integer) cascade;
drop function if exists private.pasmu_taller_gestiona(bigint) cascade;
drop table if exists public.taller_sesiones, public.talleres, public.comunicaciones cascade;
commit;
