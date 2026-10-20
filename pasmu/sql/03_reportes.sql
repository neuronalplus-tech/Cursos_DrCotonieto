-- PASMU: indicadores y reportes

create table if not exists indicadores (
  id bigserial primary key,
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  tipo text not null default 'operativo',
  unidad_medida text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists metas_indicadores (
  id bigserial primary key,
  indicador_id bigint not null references indicadores(id) on delete cascade,
  periodo text not null,
  meta numeric,
  unidad_id bigint references unidades(id) on delete set null,
  programa_id bigint references programas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists mediciones_indicadores (
  id bigserial primary key,
  indicador_id bigint not null references indicadores(id) on delete cascade,
  unidad_id bigint not null references unidades(id) on delete restrict,
  programa_id bigint references programas(id) on delete set null,
  periodo text not null,
  valor numeric not null,
  observaciones text,
  capturado_por uuid references personas(id) on delete set null,
  capturado_en timestamptz not null default now()
);

create table if not exists auditoria_actividad (
  id bigserial primary key,
  unidad_id bigint references unidades(id) on delete set null,
  tabla text not null,
  registro_id text,
  operacion text not null,
  usuario_id uuid,
  usuario_email text,
  antes jsonb,
  despues jsonb,
  cambios text[],
  created_at timestamptz not null default now()
);

create table if not exists auditoria_seguridad (
  id bigserial primary key,
  unidad_id bigint references unidades(id) on delete set null,
  usuario_id uuid,
  accion text not null,
  recurso text,
  resultado text not null,
  ip_origen text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mediciones_periodo on mediciones_indicadores(periodo);
create index if not exists idx_mediciones_unidad_programa
  on mediciones_indicadores(unidad_id, programa_id, periodo);
create index if not exists idx_auditoria_tabla on auditoria_actividad(tabla, created_at desc);
create index if not exists idx_seguridad_usuario on auditoria_seguridad(usuario_id, created_at desc);
