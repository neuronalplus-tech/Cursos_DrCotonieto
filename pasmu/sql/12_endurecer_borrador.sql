-- PASMU: 12_endurecer_borrador — crear_borrador exige contrato tipado 10c.
-- Requiere 09 + 10/10b/10c aplicados. Solo PRUEBAS. Sin datos reales.
-- Reinstala private.pasmu_configuracion_crear_borrador con chequeo extra;
-- el resto de 09 queda intacto. Después re-correr 08 (debe seguir OK) + 08b.
begin;
create or replace function private.pasmu_configuracion_crear_borrador(
  _dominio text,
  _unidad_id bigint,
  _titulo text,
  _motivo text,
  _propuesta jsonb,
  _sustituye_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_change_id uuid;
  v_version integer := 1;
  v_previous public.solicitudes_cambio_configuracion%rowtype;
  v_request_id uuid;
begin
  v_actor := private.pasmu_current_persona_id();
  if v_actor is null then
    raise exception 'Perfil PASMU activo requerido.' using errcode = '42501';
  end if;
  if _unidad_id is null then
    raise exception 'Ámbito de unidad requerido.' using errcode = '22023';
  end if;
  if not private.pasmu_has_permission('configuracion.proponer', _unidad_id) then
    raise exception 'Sin permiso para proponer.' using errcode = '42501';
  end if;
  if _titulo is null or char_length(btrim(_titulo)) not between 3 and 120
    or _motivo is null or char_length(btrim(_motivo)) not between 10 and 1000 then
    raise exception 'Título/motivo fuera de límites.' using errcode = '22023';
  end if;
  if _propuesta is null or jsonb_typeof(_propuesta) <> 'object'
    or octet_length(_propuesta::text) > 65536 then
    raise exception 'Propuesta inválida.' using errcode = '22023';
  end if;
  if not private.pasmu_payload_contrato_valido(_dominio, _propuesta) then
    raise exception 'Payload fuera de contrato o con contenido prohibido.' using errcode = '22023';
  end if;
  if _sustituye_id is not null then
    select * into v_previous from public.solicitudes_cambio_configuracion
    where id = _sustituye_id for update;
    if not found or v_previous.dominio <> _dominio
      or v_previous.unidad_id is distinct from _unidad_id
      or v_previous.estado = 'in_review' then
      raise exception 'Versión anterior no versionable.' using errcode = '22023';
    end if;
    v_change_id := v_previous.cambio_id;
    select coalesce(max(version), 0) + 1 into v_version
    from public.solicitudes_cambio_configuracion where cambio_id = v_change_id;
  else
    v_change_id := gen_random_uuid();
  end if;
  insert into public.solicitudes_cambio_configuracion
    (cambio_id, version, sustituye_id, dominio, unidad_id, titulo, motivo, propuesta, creada_por)
  values (v_change_id, v_version, _sustituye_id, _dominio, _unidad_id,
    btrim(_titulo), btrim(_motivo), _propuesta, v_actor)
  returning id into v_request_id;
  insert into public.eventos_cambio_configuracion (solicitud_id, evento, actor_id)
  values (v_request_id, 'draft_created', v_actor);
  return v_request_id;
end;
$$;
revoke all on function private.pasmu_configuracion_crear_borrador(text, bigint, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function private.pasmu_configuracion_crear_borrador(text, bigint, text, text, jsonb, uuid) to authenticated;
commit;
-- PRUEBA: crear borrador con CURP en propuesta debe fallar 22023.
