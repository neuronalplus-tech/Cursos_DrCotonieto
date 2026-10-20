-- 18b: historia integral + plan + SOAP + addendum + supervisión. Solo PRUEBAS.
begin;
create table if not exists public.historia_integral (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  motivo jsonb, antecedentes jsonb, evaluacion jsonb, plan jsonb,
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now());
create table if not exists public.notas_soap (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  sesion int not null check (sesion > 0), subjetivo text, objetivo jsonb,
  analisis text, plan jsonb,
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now(),
  unique (caso_id, sesion));
create table if not exists public.notas_addendum (
  id bigserial primary key, nota_id bigint not null references public.notas_soap(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 5 and 2000),
  motivo text not null check (char_length(btrim(motivo)) between 5 and 500),
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now());
create table if not exists public.revisiones_supervision (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  nota_id bigint references public.notas_soap(id) on delete set null,
  comentario text not null check (char_length(btrim(comentario)) between 5 and 2000),
  estado text not null default 'pendiente' check (estado in ('pendiente','atendida','justificada')),
  respuesta text, revisada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now());
alter table public.historia_integral enable row level security;
alter table public.notas_soap enable row level security;
alter table public.notas_addendum enable row level security;
alter table public.revisiones_supervision enable row level security;
revoke all on table public.historia_integral, public.notas_soap,
  public.notas_addendum, public.revisiones_supervision from public, anon, authenticated;
commit;
