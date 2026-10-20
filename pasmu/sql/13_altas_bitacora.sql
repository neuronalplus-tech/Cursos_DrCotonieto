-- PASMU 13: altas con alcance + bitácora inmutable por instituto.
-- Solo PRUEBAS. Requiere 01-05+04+09 en OK. Sin datos reales.
begin;
-- RPC: mis permisos efectivos (para hook useMisPermisosPasmu).
create or replace function public.mis_permisos_pasmu()
returns table (permiso text, unidad_id bigint, programa_id bigint)
language sql stable security definer set search_path = '' as $$
  select pe.codigo, m.unidad_id, m.programa_id
  from public.miembros m
  join public.personas p on p.id = m.persona_id
  join public.roles r on r.id = m.rol_id
  join public.rol_permisos rp on rp.rol_id = m.rol_id
  join public.permisos pe on pe.id = rp.permiso_id
  where p.auth_user_id = (select auth.uid())
    and p.activo and m.activo and r.activo and pe.activo
    and m.fecha_inicio <= current_date
    and (m.fecha_fin is null or m.fecha_fin >= current_date)
$$;
revoke all on function public.mis_permisos_pasmu() from public, anon;
grant execute on function public.mis_permisos_pasmu() to authenticated;

-- Pre-alta de equipo: valida que quien invita solo opere en sus unidades.
create table if not exists public.prealtas_equipo (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  rol_codigo text not null,
  unidad_id bigint not null references public.unidades(id) on delete restrict,
  programa_id bigint references public.programas(id) on delete set null,
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente','vinculada','revocada'))
);
alter table public.prealtas_equipo enable row level security;
revoke all on table public.prealtas_equipo from public, anon, authenticated;
grant select (id, email, nombre, rol_codigo, unidad_id, programa_id, creada_en, estado)
  on table public.prealtas_equipo to authenticated;
drop policy if exists prealtas_equipo_read on public.prealtas_equipo;
create policy prealtas_equipo_read on public.prealtas_equipo
  for select to authenticated
  using (private.pasmu_has_permission('admin.roles', unidad_id));
commit;
