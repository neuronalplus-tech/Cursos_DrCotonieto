-- PASMU 19a: expediente NOM-004 (núcleo). solo PRUEBAS + idempotente.
begin;
create table if not exists public.expediente_caso (
  id bigserial primary key,
  folio text not null unique check (char_length(btrim(folio)) between 3 and 20),
  institucion_id bigint not null,
  unidad_id bigint,
  nombre_completo text not null check (char_length(btrim(nombre_completo)) between 3 and 150),
  psicologo_tratante text,
  modalidad text,
  plataforma text,
  estado_actual text,
  fecha_apertura date not null,
  historico_estado text,
  creado_por uuid references public.personas(id) on delete set null,
  creado_en timestamptz not null default now(),
  check (char_length(btrim(folio)) >= 3)
);
create table if not exists public.expediente_demografia (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  edad integer, fecha_nacimiento date, lugar_nacimiento text,
  nacionalidad text default 'Mexicano',
  idiomas text[],
  sexo text,
  estudios text, situacion_laboral text, ocupacion text,
  situacion_actual text,
  domicilio text, telefono_principal text, telefono_alternativo text, correo text,
  facturacion jsonb,
  notas_observaciones_clinicas text,
  creado_por uuid references public.personas(id) on delete set null,
  check (edad is null or edad > 0)
);
create table if not exists public.expediente_documentos_legales (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  tipo text not null check (char_length(btrim(tipo)) between 3 and 80),
  documento text,
  archivado_en text,
  check (char_length(btrim(tipo)) >= 3)
);
create table if not exists public.expediente_historial (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  area text not null, detalle text not null check (char_length(btrim(detalle)) between 5 and 4000),
  creado_por uuid references public.personas(id) on delete set null,
  check (char_length(btrim(area)) >= 3)
);
create table if not exists public.expediente_antecedentes (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  area text not null, detalle text not null check (char_length(btrim(detalle)) between 5 and 4000)
);
create table if not exists public.expediente_evaluacion (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  area text not null, detalle text not null check (char_length(btrim(detalle)) between 5 and 4000)
);
create table if not exists public.expediente_plan (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  breve_plazo text not null check (char_length(btrim(breve_plazo)) between 5 and 1000),
  mediano_plazo text not null check (char_length(btrim(mediano_plazo)) between 5 and 1000),
  largo_plazo text not null check (char_length(btrim(largo_plazo)) between 5 and 1000)
);
create table if not exists public.expediente_consentimiento (
  id bigserial primary key, caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  tipo text not null, documento bytea, firmado_por uuid references public.personas(id) on delete set null,
  recibido_en timestamptz not null default now(), check (char_length(btrim(tipo)) >= 3)
);
create table if not exists public.expediente_addendum (
  id bigserial primary key, expediente_caso_id bigint not null references public.expediente_caso(id) on delete cascade,
  tipo text not null, descripcion text not null check (char_length(btrim(descripcion)) between 5 and 1000),
  documento bytea, creado_en timestamptz not null default now(),
  check (char_length(btrim(tipo)) >= 3)
);
alter table public.expediente_caso enable row level security;
alter table public.expediente_demografia enable row level security;
alter table public.expediente_documentos_legales enable row level security;
alter table public.expediente_historial enable row level security;
alter table public.expediente_antecedentes enable row level security;
alter table public.expediente_evaluacion enable row level security;
alter table public.expediente_plan enable row level security;
alter table public.expediente_consentimiento enable row level security;
alter table public.expediente_addendum enable row level security;
revoke all on table public.expediente_caso, public.expediente_demografia,
  public.expediente_documentos_legales, public.expediente_historial,
  public.expediente_antecedentes, public.expediente_evaluacion,
  public.expediente_plan, public.expediente_consentimiento,
  public.expediente_addendum from public, anon, authenticated;
commit;

-- 19b: RPC expediente (ver solo casos asignados + estado propietario).
create or replace function public.pasmu_expediente_caso(p_folio text default null)
returns table (
  id bigint, folio text, nombre_completo text, psicologo_tratante text,
  modalidad text, estado_actual text, fecha_apertura date,
  deducible boolean
) language sql security definer set search_path = public, pg_temp as $$
  select e.id, e.folio, e.nombre_completo, e.psicologo_tratante,
         e.modalidad, e.estado_actual, e.fecha_apertura, false
  from public.expediente_caso e
  where (p_folio is null or e.folio = p_folio)
    and (e.creado_por = current_setting('request.jwt.claims')::uuid
         or exists (select 1 from public.expediente_demografia d where d.caso_id = e.id and d.creado_por = current_setting('request.jwt.claims')::uuid))
$$;
