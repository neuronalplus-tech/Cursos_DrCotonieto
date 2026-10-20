-- PASMU: 16_rls_soap_supervision.sql
-- Políticas RLS para notas SOAP, addenda, supervisión y catálogos de roles/permisos.
-- Ejecutar después de 17_roles_reales.sql y 18b_historia_soap.sql.
begin;

-- 17: roles, permisos, rol_permisos (solo lectura para roles autorizados).
drop policy if exists roles_read_by_authenticated on public.roles;
create policy roles_read_by_authenticated on public.roles for select to authenticated
  using (true);

drop policy if exists permisos_read_by_authenticated on public.permisos;
create policy permisos_read_by_authenticated on public.permisos for select to authenticated
  using (true);

drop policy if exists rol_permisos_read_by_authenticated on public.rol_permisos;
create policy rol_permisos_read_by_authenticated on public.rol_permisos for select to authenticated
  using (true);

-- notas_soap: lectura solo del propio autor o con revisión pendiente/terminada.
drop policy if exists notas_soap_read_by_creator_or_reviewed on public.notas_soap;
create policy notas_soap_read_by_creator_or_reviewed on public.notas_soap for select to authenticated
  using (
    creada_por = current_setting('request.jwt.claims')::uuid
    or exists (select 1 from public.revisiones_supervision v
               where v.caso_id = notas_soap.caso_id
                 and v.revisada_por = current_setting('request.jwt.claims')::uuid)
  );

drop policy if exists notas_addendum_read_by_creator on public.notas_addendum;
create policy notas_addendum_read_by_creator on public.notas_addendum for select to authenticated
  using (creada_por = current_setting('request.jwt.claims')::uuid);

drop policy if exists revisiones_supervision_read_by_reviewer on public.revisiones_supervision;
create policy revisiones_supervision_read_by_reviewer on public.revisiones_supervision for select to authenticated
  using (revisada_por = current_setting('request.jwt.claims')::uuid
         or exists (select 1 from public.notas_soap n
                    where n.id = revisiones_supervision.nota_id
                      and n.creada_por = current_setting('request.jwt.claims')::uuid));

-- notas_soap: escritura solo por el terapeuta asignado.
drop policy if exists notas_soap_insert_by_creator on public.notas_soap;
create policy notas_soap_insert_by_creator on public.notas_soap for insert to authenticated
  with check (creada_por = private.pasmu_current_persona_id()
              and private.pasmu_case_has_permission(caso_id, 'expediente.editar')
              and private.pasmu_is_case_professional(caso_id));

drop policy if exists notas_addendum_insert_by_creator on public.notas_addendum;
create policy notas_addendum_insert_by_creator on public.notas_addendum for insert to authenticated
  with check (creada_por = private.pasmu_current_persona_id()
              and private.pasmu_case_has_permission((select caso_id from public.notas_soap where id = nota_id), 'expediente.editar')
              and private.pasmu_is_case_professional((select caso_id from public.notas_soap where id = nota_id)));

-- revisiones_supervision: insert solo por terapeuta; update por supervisor/coordinador.
drop policy if exists revisiones_supervision_insert_by_creator on public.revisiones_supervision;
create policy revisiones_supervision_insert_by_creator on public.revisiones_supervision for insert to authenticated
  with check (private.pasmu_current_persona_id() is not null
              and private.pasmu_case_has_permission(caso_id, 'supervision.revisar')
              and private.pasmu_is_case_professional(caso_id));

drop policy if exists revisiones_supervision_update_by_reviewer on public.revisiones_supervision;
create policy revisiones_supervision_update_by_reviewer on public.revisiones_supervision for update to authenticated
  using (revisada_por = private.pasmu_current_persona_id()
         and private.pasmu_case_has_permission(caso_id, 'supervision.comentar')
         and private.pasmu_is_case_professional(caso_id));

commit;
