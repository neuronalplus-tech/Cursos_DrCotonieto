-- PASMU: 10_payloads_tipados — contratos JSON por dominio (parte 1/3: tabla + RLS).
-- No publica ni activa. Ejecutar solo en Supabase de PRUEBAS tras 04 y 09.
-- Requiere 08 en OK antes y después. Sin datos clínicos reales.

begin;

create table if not exists public.configuracion_contratos (
  dominio text primary key check (dominio in (
    'institutional_scope',
    'service_flow',
    'catalogs',
    'indicator_definitions',
    'public_content',
    'roles_permissions',
    'clinical_protocols',
    'privacy_retention',
    'security_platform'
  )),
  version integer not null default 1 check (version > 0),
  esquema jsonb not null check (jsonb_typeof(esquema) = 'object'),
  actualizado_en timestamptz not null default now()
);

alter table public.configuracion_contratos enable row level security;
revoke all on table public.configuracion_contratos from public, anon, authenticated;
grant select (dominio, version, esquema, actualizado_en)
  on table public.configuracion_contratos to authenticated;
drop policy if exists configuracion_contratos_read on public.configuracion_contratos;
create policy configuracion_contratos_read
  on public.configuracion_contratos
  for select to authenticated
  using (true);

commit;
