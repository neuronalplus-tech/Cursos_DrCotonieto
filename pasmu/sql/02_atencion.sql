-- PASMU: atención, casos, agenda y expediente

create table if not exists casos (
  id bigserial primary key,
  persona_usuaria_id bigint not null references personas_usuarias(id) on delete restrict,
  unidad_id bigint not null references unidades(id) on delete restrict,
  programa_id bigint references programas(id) on delete set null,
  responsable_actual_id uuid references personas(id) on delete set null,
  motivo_referencia text,
  estado text not null default 'abierto',
  fecha_apertura timestamptz not null default now(),
  fecha_cierre timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists caso_profesionales (
  id bigserial primary key,
  caso_id bigint not null references casos(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  rol_en_caso text not null,
  activo boolean not null default true,
  asignado_en timestamptz not null default now()
);

create table if not exists episodios (
  id bigserial primary key,
  caso_id bigint not null references casos(id) on delete cascade,
  tipo text not null,
  descripcion text not null,
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  creado_por uuid not null references personas(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists notas_clinicas (
  id bigserial primary key,
  caso_id bigint not null references casos(id) on delete cascade,
  episodio_id bigint references episodios(id) on delete set null,
  autor_id uuid not null references personas(id) on delete restrict,
  tipo text not null default 'general',
  contenido text not null,
  confidencialidad text not null default 'nivel_1',
  created_at timestamptz not null default now()
);

create table if not exists agenda (
  id bigserial primary key,
  caso_id bigint references casos(id) on delete set null,
  persona_usuaria_id bigint not null references personas_usuarias(id) on delete restrict,
  unidad_id bigint not null references unidades(id) on delete restrict,
  profesional_id uuid not null references personas(id) on delete restrict,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  tipo text not null default 'cita',
  estado text not null default 'programada',
  motivo text,
  observaciones text,
  created_at timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);

create table if not exists evaluaciones_psicologicas (
  id bigserial primary key,
  caso_id bigint not null references casos(id) on delete cascade,
  instrumento_id bigint not null references catalogo_instrumentos(id) on delete restrict,
  aplicado_por uuid not null references personas(id) on delete restrict,
  fecha_aplicacion timestamptz not null default now(),
  resultado_json jsonb,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists documentos (
  id bigserial primary key,
  caso_id bigint references casos(id) on delete set null,
  tipo_documento text not null,
  titulo text not null,
  descripcion text,
  creado_por uuid not null references personas(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists documento_archivos (
  id bigserial primary key,
  documento_id bigint not null references documentos(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  tamano_bytes bigint,
  categoria text not null default 'general',
  hash_sha256 text,
  uploaded_by uuid not null references personas(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists consentimientos (
  id bigserial primary key,
  caso_id bigint not null references casos(id) on delete cascade,
  tipo text not null,
  estado text not null default 'pendiente',
  firmado_por uuid not null references personas(id) on delete restrict,
  fecha_firma timestamptz,
  documento_id bigint references documentos(id) on delete set null,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists practicantes (
  id bigserial primary key,
  persona_id uuid not null references personas(id) on delete cascade,
  institucion_formadora text,
  programa_academico text,
  supervisor_id uuid references personas(id) on delete set null,
  estado text not null default 'activo',
  created_at timestamptz not null default now()
);

create table if not exists horas_practica (
  id bigserial primary key,
  practicante_id bigint not null references practicantes(id) on delete cascade,
  caso_id bigint references casos(id) on delete set null,
  fecha date not null,
  horas numeric(4,2) not null default 0,
  tipo_actividad text not null,
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists practicante_competencias (
  id bigserial primary key,
  practicante_id bigint not null references practicantes(id) on delete cascade,
  competencia_id bigint not null references competencias(id) on delete restrict,
  nivel text,
  fecha_evaluacion timestamptz not null default now(),
  supervisado_por uuid references personas(id) on delete set null
);

create index if not exists idx_casos_persona on casos(persona_usuaria_id);
create index if not exists idx_casos_unidad on casos(unidad_id);
create index if not exists idx_casos_unidad_programa on casos(unidad_id, programa_id);
create index if not exists idx_caso_profesionales_case_persona
  on caso_profesionales(caso_id, persona_id)
  where activo = true;
create index if not exists idx_agenda_profesional on agenda(profesional_id, fecha_inicio);
create index if not exists idx_agenda_estado on agenda(estado);
create index if not exists idx_notas_caso on notas_clinicas(caso_id);
