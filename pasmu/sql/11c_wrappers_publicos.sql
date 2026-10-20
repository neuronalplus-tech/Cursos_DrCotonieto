-- 11c: wrappers públicos para RPCs controladas. Solo PRUEBAS. Sin datos reales.
begin;
create or replace function public.pasmu_caso_crear(_unidad_id bigint, _programa_id bigint default null, _motivo text default 'Registro inicial pendiente de admisión')
returns bigint language sql security definer set search_path = '' as $$
  select private.pasmu_caso_crear(_unidad_id, _programa_id, _motivo)
$$;
create or replace function public.pasmu_agenda_programar(_caso_id bigint, _inicio timestamptz, _fin timestamptz, _tipo text default 'cita')
returns bigint language sql security definer set search_path = '' as $$
  select private.pasmu_agenda_programar(_caso_id, _inicio, _fin, _tipo)
$$;
create or replace function public.pasmu_nota_crear(_caso_id bigint, _tipo text default 'general', _contenido text default 'Nota inicial de seguimiento')
returns bigint language sql security definer set search_path = '' as $$
  select private.pasmu_nota_crear(_caso_id, _tipo, _contenido)
$$;
revoke all on function public.pasmu_caso_crear(bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.pasmu_nota_crear(bigint, text, text) from public, anon, authenticated;
grant execute on function public.pasmu_caso_crear(bigint, bigint, text) to authenticated;
grant execute on function public.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.pasmu_nota_crear(bigint, text, text) to authenticated;
-- Revoca acceso directo a privadas: solo vía wrapper público auditado.
revoke all on function private.pasmu_caso_crear(bigint, bigint, text) from authenticated;
revoke all on function private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text) from authenticated;
revoke all on function private.pasmu_nota_crear(bigint, text, text) from authenticated;
commit;
