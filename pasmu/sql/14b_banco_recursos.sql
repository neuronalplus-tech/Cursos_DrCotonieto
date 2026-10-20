-- 14b: banco recursos + autoevaluaciones + RPC material_del_caso. Solo PRUEBAS.
begin;
create table if not exists public.banco_recursos (
  id bigserial primary key,
  tipo text not null check (tipo in ('pdf','video','formato','guia_tecnica','psicoeducativo','ludica','autoevaluacion')),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 200),
  objetivo text not null check (objetivo in ('estres','procrastinacion','rumiacion','ansiedad','animo','sueno','habilidades','duelo','otro')),
  descripcion text, storage_path text, activo boolean not null default true,
  creado_en timestamptz not null default now());
create table if not exists public.recurso_asignaciones (
  id bigserial primary key, recurso_id bigint not null references public.banco_recursos(id) on delete cascade,
  caso_id bigint not null references public.casos(id) on delete cascade,
  asignado_por uuid references public.personas(id) on delete set null,
  asignado_en timestamptz not null default now());
alter table public.banco_recursos enable row level security;
alter table public.recurso_asignaciones enable row level security;
revoke all on table public.banco_recursos, public.recurso_asignaciones from public, anon, authenticated;
grant select (id, tipo, titulo, objetivo, descripcion, activo)
  on table public.banco_recursos to authenticated;
drop policy if exists banco_recursos_activos on public.banco_recursos;
create policy banco_recursos_activos on public.banco_recursos
  for select to authenticated using (activo = true);

-- RPC: material del caso (metadatos + asignados, nunca storage crudo sin permiso).
create or replace function public.material_del_caso(_caso bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total int;
begin
  if not private.pasmu_case_has_permission(_caso, 'expediente.ver') then
    return '{"asignados":[]}'::jsonb; end if;
  if not private.pasmu_is_case_professional(_caso) then
    return '{"asignados":[]}'::jsonb; end if;
  select count(*) into v_total from public.recurso_asignaciones where caso_id = _caso;
  return jsonb_build_object('asignados', v_total);
end; $$;
revoke all on function public.material_del_caso(bigint) from public, anon;
grant execute on function public.material_del_caso(bigint) to authenticated;
commit;
