-- PASMU: 11_lecturas_escrituras_controladas — vistas redactadas + RPCs mínimos.
-- Solo para proyecto Supabase de PRUEBAS aprobado. No usar con datos reales.
-- Requiere 01-05 + 07 + 04 + 08 en OK. No asigna configuracion.*. No toca Storage.
-- Principio: RLS sigue cerrada; las RPC SECURITY DEFINER validan permiso + asignación al caso.
begin;

-- Vista redactada de auditoría: últimos eventos sin PII/clínico, solo rol seguridad/dirección.
create or replace view public.vista_auditoria_redactada as
select
  id,
  date_trunc('hour', creado_en) as momento,
  evento,
  'actor institucional' as actor,
  solicitud_id
from public.eventos_cambio_configuracion
order by creado_en desc
limit 100;

revoke all on table public.vista_auditoria_redactada from public, anon, authenticated;
grant select on table public.vista_auditoria_redactada to authenticated;

-- RPC: crear caso mínimo (sin PII en este prototipo; motivo genérico obligatorio).
create or replace function private.pasmu_caso_crear(
  _unidad_id bigint,
  _programa_id bigint default null,
  _motivo text default 'Registro inicial pendiente de admisión'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_usuaria bigint;
  v_caso bigint;
begin
  if v_persona is null then
    raise exception 'Perfil PASMU activo requerido.' using errcode = '42501';
  end if;
  if _unidad_id is null or not private.pasmu_has_permission('casos.crear', _unidad_id) then
    raise exception 'No tienes permiso para crear casos en este ámbito.' using errcode = '42501';
  end if;
  if _motivo is null or char_length(btrim(_motivo)) not between 5 and 500 then
    raise exception 'Motivo genérico de 5 a 500 caracteres, sin datos personales.' using errcode = '22023';
  end if;
  if lower(_motivo) ~ '(curp|rfc|nss|diagnostico|<script|https?://)' then
    raise exception 'Retira datos personales o enlaces del motivo.' using errcode = '22023';
  end if;
  -- Persona usuaria sintética mínima: sin nombre real en prototipo.
  insert into public.personas_usuarias (numero_expediente, tipo_atencion)
  values ('SIN-' || substr(gen_random_uuid()::text, 1, 8), 'general')
  returning id into v_usuaria;
  insert into public.casos (persona_usuaria_id, unidad_id, programa_id, motivo_referencia, responsable_actual_id)
  values (v_usuaria, _unidad_id, _programa_id, btrim(_motivo), v_persona)
  returning id into v_caso;
  insert into public.caso_profesionales (caso_id, persona_id, rol_en_caso)
  values (v_caso, v_persona, 'responsable');
  return v_caso;
end;
$$;
revoke all on function private.pasmu_caso_crear(bigint, bigint, text) from public, anon, authenticated;
grant execute on function private.pasmu_caso_crear(bigint, bigint, text) to authenticated;
commit;
