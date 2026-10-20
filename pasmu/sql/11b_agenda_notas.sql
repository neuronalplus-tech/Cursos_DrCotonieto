-- 11b: agenda programar + nota clínica mínima, con permiso y asignación al caso.
-- Solo PRUEBAS aprobado. Sin datos reales. Requiere 11a aplicado.
begin;
create or replace function private.pasmu_agenda_programar(
  _caso_id bigint,
  _inicio timestamptz,
  _fin timestamptz,
  _tipo text default 'cita'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_unidad bigint;
  v_usuaria bigint;
  v_id bigint;
begin
  if v_persona is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  select unidad_id, persona_usuaria_id into v_unidad, v_usuaria from public.casos where id = _caso_id;
  if v_unidad is null then raise exception 'Caso inexistente.' using errcode = '22023'; end if;
  if not private.pasmu_has_permission('agenda.programar', v_unidad) then
    raise exception 'Sin permiso agenda.programar.' using errcode = '42501';
  end if;
  if _fin <= _inicio then raise exception 'Rango de agenda inválido.' using errcode = '22023'; end if;
  insert into public.agenda (caso_id, persona_usuaria_id, unidad_id, profesional_id, fecha_inicio, fecha_fin, tipo)
  values (_caso_id, v_usuaria, v_unidad, v_persona, _inicio, _fin, _tipo)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text) to authenticated;

create or replace function private.pasmu_nota_crear(
  _caso_id bigint,
  _tipo text default 'general',
  _contenido text default 'Nota inicial de seguimiento'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid := private.pasmu_current_persona_id();
  v_id bigint;
begin
  if v_persona is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if not private.pasmu_case_has_permission(_caso_id, 'expediente.editar') then
    raise exception 'Sin permiso expediente.editar en el caso.' using errcode = '42501';
  end if;
  if not private.pasmu_is_case_professional(_caso_id) then
    raise exception 'Solo profesional asignado al caso.' using errcode = '42501';
  end if;
  if char_length(btrim(_contenido)) not between 5 and 2000 then
    raise exception 'Contenido de 5 a 2000 caracteres.' using errcode = '22023';
  end if;
  insert into public.notas_clinicas (caso_id, autor_id, tipo, contenido)
  values (_caso_id, v_persona, _tipo, btrim(_contenido))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.pasmu_nota_crear(bigint, text, text) from public, anon, authenticated;
grant execute on function private.pasmu_nota_crear(bigint, text, text) to authenticated;
commit;
-- PRUEBA negativa: sin permiso debe fallar 42501; fuera de asignación 42501; rango inválido 22023.
