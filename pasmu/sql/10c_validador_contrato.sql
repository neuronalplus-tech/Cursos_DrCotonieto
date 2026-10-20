-- Parte 3/3: validador transversal anti-PII/clínico/SQL/scripts/exfiltración.
-- No asigna permisos. No publica. Solo lectura + prueba en PRUEBAS.
begin;
create or replace function private.pasmu_payload_contrato_valido(_dominio text, _propuesta jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_texto text := lower(coalesce(_propuesta::text, ''));
  v_ok boolean := false;
begin
  if _propuesta is null or jsonb_typeof(_propuesta) <> 'object' then
    return false;
  end if;
  if v_texto ~ '(curp|rfc|nss|telefono|domicilio|diagnostico|nota_clinica|<script|insert\s+into|service_role|https?://)' then
    return false;
  end if;
  select true into v_ok from public.configuracion_contratos where dominio = _dominio;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function private.pasmu_payload_contrato_valido(text, jsonb) from public, anon;
grant execute on function private.pasmu_payload_contrato_valido(text, jsonb) to authenticated;
commit;
-- PRUEBA: select private.pasmu_payload_contrato_valido('service_flow', '{"a":"b"}'::jsonb); -- true si existe contrato.
-- PRUEBA: con CURP en texto -- esperado false. Luego re-correr 08, esperado OK/0.
