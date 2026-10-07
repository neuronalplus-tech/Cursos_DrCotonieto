-- =============================================================
--  CONSTANCIAS VERIFICABLES · folio publico + URL de verificacion
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente: puedes volver a correrlo sin romper nada.
-- =============================================================

create table if not exists public.constancias (
  id              bigserial primary key,
  usuario_id      uuid   not null,
  curso_id        bigint not null references public.cursos(id) on delete cascade,
  folio           text   not null,
  nombre_completo text   not null,
  profesion       text,
  fecha_emision   timestamptz not null default now()
);

alter table public.constancias add column if not exists usuario_id uuid;
alter table public.constancias add column if not exists curso_id bigint;
alter table public.constancias add column if not exists folio text;
alter table public.constancias add column if not exists nombre_completo text;
alter table public.constancias add column if not exists profesion text;
alter table public.constancias add column if not exists fecha_emision timestamptz not null default now();

do $$
begin
  if exists (select 1 from public.constancias where folio is null limit 1) then
    raise notice 'constancias: hay filas sin folio, no se pone NOT NULL ni unique';
  else
    alter table public.constancias alter column folio set not null;
  end if;
end $$;

create unique index if not exists constancias_folio_idx
  on public.constancias (folio);
create unique index if not exists constancias_usuario_curso_idx
  on public.constancias (usuario_id, curso_id);
create index if not exists constancias_curso_idx
  on public.constancias (curso_id);

alter table public.constancias enable row level security;

drop policy if exists "constancias_select" on public.constancias;
create policy "constancias_select" on public.constancias
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

drop policy if exists "constancias_insert" on public.constancias;
create policy "constancias_insert" on public.constancias
  for insert to authenticated
  with check (usuario_id = auth.uid());

drop policy if exists "constancias_update" on public.constancias;
create policy "constancias_update" on public.constancias
  for update to authenticated
  using (usuario_id = auth.uid() or public.es_admin())
  with check (usuario_id = auth.uid() or public.es_admin());

drop policy if exists "constancias_delete_admin" on public.constancias;
create policy "constancias_delete_admin" on public.constancias
  for delete to authenticated
  using (public.es_admin());

create or replace function public.verificar_constancia(p_folio text)
returns table (
  folio           text,
  nombre_completo text,
  profesion       text,
  curso_titulo    text,
  fecha_emision   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.folio, c.nombre_completo, c.profesion, cu.titulo, c.fecha_emision
  from public.constancias c
  join public.cursos cu on cu.id = c.curso_id
  where c.folio = upper(trim(p_folio)) or c.folio = trim(p_folio)
  limit 1
$$;

revoke all on function public.verificar_constancia(text) from public;
grant execute on function public.verificar_constancia(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
