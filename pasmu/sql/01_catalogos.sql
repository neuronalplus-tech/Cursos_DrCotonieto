-- PASMU: catálogo institucional y permisos
-- Este archivo es una base inicial para crear el proyecto independiente.

create extension if not exists pgcrypto;

create table if not exists instituciones (
  id bigserial primary key,
  nombre text not null,
  siglas text,
  tipo text not null default 'universidad',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists unidades (
  id bigserial primary key,
  institucion_id bigint not null references instituciones(id) on delete cascade,
  nombre text not null,
  codigo text not null unique,
  tipo text not null,
  responsable_persona_id uuid,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists programas (
  id bigserial primary key,
  unidad_id bigint not null references unidades(id) on delete cascade,
  nombre text not null,
  codigo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  nombre text not null,
  apellidos text not null,
  fecha_nacimiento date,
  genero text,
  curp text,
  telefono text,
  email text,
  estado_civil text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id bigserial primary key,
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists permisos (
  id bigserial primary key,
  codigo text not null unique,
  descripcion text,
  categoria text not null default 'general',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists rol_permisos (
  rol_id bigint not null references roles(id) on delete cascade,
  permiso_id bigint not null references permisos(id) on delete cascade,
  ambito text not null default 'institucion',
  primary key (rol_id, permiso_id)
);

create table if not exists miembros (
  id bigserial primary key,
  persona_id uuid not null references personas(id) on delete cascade,
  unidad_id bigint not null references unidades(id) on delete cascade,
  programa_id bigint references programas(id) on delete set null,
  rol_id bigint not null references roles(id) on delete restrict,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists personas_usuarias (
  id bigserial primary key,
  persona_id uuid references personas(id) on delete set null,
  numero_expediente text not null unique,
  tipo_atencion text not null default 'general',
  estatus text not null default 'activo',
  origen_referencia text,
  admitido_en timestamptz not null default now(),
  estado_actual text not null default 'en_proceso',
  created_at timestamptz not null default now()
);

create table if not exists catalogo_instrumentos (
  id bigserial primary key,
  nombre text not null,
  tipo text not null,
  version text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists competencias (
  id bigserial primary key,
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_unidades_institucion on unidades(institucion_id);
create index if not exists idx_programas_unidad on programas(unidad_id);
create index if not exists idx_personas_email on personas(email);
create unique index if not exists idx_personas_auth_user_id
  on personas(auth_user_id)
  where auth_user_id is not null;
create index if not exists idx_miembros_persona on miembros(persona_id);
create index if not exists idx_miembros_unidad on miembros(unidad_id);
create index if not exists idx_miembros_unidad_programa on miembros(unidad_id, programa_id);
