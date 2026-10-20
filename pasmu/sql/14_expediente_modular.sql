-- PASMU 14: expediente modular + banco recursos por objetivo. Solo PRUEBAS.
begin;
create table if not exists public.historia_clinica (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  resumen text not null check (char_length(btrim(resumen)) between 10 and 4000),
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now());
create table if not exists public.examen_mental (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  apariencia text, atencion text, afecto text, pensamiento text, juicio text,
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now());
create table if not exists public.tareas_sesion (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 200),
  detalle text, estado text not null default 'asignada'
  check (estado in ('asignada','en_proceso','entregada','revisada')),
  creada_por uuid references public.personas(id) on delete set null,
  creada_en timestamptz not null default now());
create table if not exists public.asistencia_sesion (
  id bigserial primary key, agenda_id bigint references public.agenda(id) on delete set null,
  caso_id bigint not null references public.casos(id) on delete cascade,
  estado text not null default 'presente' check (estado in ('presente','retardo','ausente','permiso')),
  justificada boolean not null default false,
  registrada_por uuid references public.personas(id) on delete set null,
  registrada_en timestamptz not null default now());
alter table public.historia_clinica enable row level security;
alter table public.examen_mental enable row level security;
alter table public.tareas_sesion enable row level security;
alter table public.asistencia_sesion enable row level security;
revoke all on table public.historia_clinica, public.examen_mental,
  public.tareas_sesion, public.asistencia_sesion from public, anon, authenticated;
commit;
