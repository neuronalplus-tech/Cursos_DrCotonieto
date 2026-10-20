-- PASMU: migración desde la primera versión de los archivos 01-05.
-- Ejecutar una vez antes de volver a aplicar 04_rls.sql.
-- La transacción se cancela si hay mediciones históricas sin unidad asignada;
-- esas filas requieren clasificación institucional antes de completar la migración.

begin;

create unique index if not exists idx_personas_auth_user_id
  on public.personas(auth_user_id)
  where auth_user_id is not null;

create index if not exists idx_miembros_unidad_programa
  on public.miembros(unidad_id, programa_id);

create index if not exists idx_casos_unidad_programa
  on public.casos(unidad_id, programa_id);

create index if not exists idx_caso_profesionales_case_persona
  on public.caso_profesionales(caso_id, persona_id)
  where activo = true;

alter table public.mediciones_indicadores
  add column if not exists unidad_id bigint
  references public.unidades(id) on delete restrict;

alter table public.mediciones_indicadores
  add column if not exists programa_id bigint
  references public.programas(id) on delete set null;

alter table public.auditoria_actividad
  add column if not exists unidad_id bigint
  references public.unidades(id) on delete set null;

alter table public.auditoria_seguridad
  add column if not exists unidad_id bigint
  references public.unidades(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from public.mediciones_indicadores
    where unidad_id is null
  ) then
    raise exception 'Hay mediciones sin unidad. Asígnales unidad_id manualmente y vuelve a ejecutar la migración.';
  end if;
end
$$;

alter table public.mediciones_indicadores
  alter column unidad_id set not null;

create index if not exists idx_mediciones_unidad_programa
  on public.mediciones_indicadores(unidad_id, programa_id, periodo);

commit;
