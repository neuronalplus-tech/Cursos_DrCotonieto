-- PASMU: 16b_rls_expediente.sql
-- Políticas RLS para tablas expediente_nom (19a): solo lectura para profesionales asignados.
-- Ejecutar después de 19a_expediente_nom.sql.
begin;

drop policy if exists expediente_caso_read_by_assigned on public.expediente_caso;
create policy expediente_caso_read_by_assigned on public.expediente_caso for select to authenticated
  using (private.pasmu_case_has_permission(id, 'expediente.ver') and private.pasmu_is_case_professional(id));

drop policy if exists expediente_demografia_read_by_assigned on public.expediente_demografia;
create policy expediente_demografia_read_by_assigned on public.expediente_demografia for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_documentos_legales_read_by_assigned on public.expediente_documentos_legales;
create policy expediente_documentos_legales_read_by_assigned on public.expediente_documentos_legales for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_historial_read_by_assigned on public.expediente_historial;
create policy expediente_historial_read_by_assigned on public.expediente_historial for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_antecedentes_read_by_assigned on public.expediente_antecedentes;
create policy expediente_antecedentes_read_by_assigned on public.expediente_antecedentes for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_evaluacion_read_by_assigned on public.expediente_evaluacion;
create policy expediente_evaluacion_read_by_assigned on public.expediente_evaluacion for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_plan_read_by_assigned on public.expediente_plan;
create policy expediente_plan_read_by_assigned on public.expediente_plan for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_consentimiento_read_by_assigned on public.expediente_consentimiento;
create policy expediente_consentimiento_read_by_assigned on public.expediente_consentimiento for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'expediente.ver') and private.pasmu_is_case_professional(caso_id));

drop policy if exists expediente_addendum_read_by_assigned on public.expediente_addendum;
create policy expediente_addendum_read_by_assigned on public.expediente_addendum for select to authenticated
  using (private.pasmu_case_has_permission(expediente_caso_id, 'expediente.ver') and private.pasmu_is_case_professional(expediente_caso_id));

commit;
