-- =============================================================
--  ESQUEMA BASE · generado el 2026-10-09
--
--  PARA QUE SIRVE
--  Reconstruir la forma de la base desde cero. Hasta ahora no
--  existia: las tablas originales (cursos, acceso, perfiles,
--  modulos, recursos) se crearon a mano en el panel de Supabase y
--  los scripts de supabase/ solo las han ido ampliando. Si
--  perdieras el proyecto, no habia de donde sacar la estructura.
--
--  QUE **NO** ES
--  · No es un respaldo de los datos. No trae ni una fila: ni
--    alumnos, ni cursos, ni calificaciones. Para los datos usa
--    Supabase -> Database -> Backups, que es diario y automatico.
--  · No trae las politicas de seguridad ni las funciones. Esas
--    las crean los scripts numerados de supabase/, que SI estan
--    versionados. Este archivo es el cimiento; ellos, lo demas.
--
--  COMO SE USA EN UNA RECUPERACION
--  1. Proyecto nuevo de Supabase.
--  2. Correr este archivo.
--  3. Correr los scripts de supabase/ en el orden de ESTADO.sql.
--  4. Restaurar los datos desde el respaldo de Supabase.
--
--  NO HACE FALTA CORRERLO EN UNA BASE QUE YA FUNCIONA
--  Tu base ya tiene todo esto. Correrlo ahi no aporta nada.
--  Dicho eso, es seguro: todo va con "if not exists", asi que no
--  borra, no reemplaza y no toca ningun dato. Si lo corres por
--  curiosidad, no pasa nada.
--
--  NO LO EDITES A MANO: se genera leyendo el catalogo. Si cambias
--  la base, vuelve a generarlo.
-- =============================================================

-- -------------------------------------------------------------
--  SECUENCIAS
--  Van primero: las columnas de id las usan en su valor por
--  omision, y una tabla no se puede crear si su secuencia no
--  existe todavia.
-- -------------------------------------------------------------
create sequence if not exists public.acceso_id_seq;
create sequence if not exists public.asistencia_id_seq;
create sequence if not exists public.auditoria_id_seq;
create sequence if not exists public.banco_preguntas_id_seq;
create sequence if not exists public.categorias_id_seq;
create sequence if not exists public.constancias_id_seq;
create sequence if not exists public.cursos_id_seq;
create sequence if not exists public.entregas_id_seq;
create sequence if not exists public.examenes_id_seq;
create sequence if not exists public.facilitadores_id_seq;
create sequence if not exists public.foro_hilos_id_seq;
create sequence if not exists public.foro_respuestas_id_seq;
create sequence if not exists public.generaciones_id_seq;
create sequence if not exists public.intentos_examen_id_seq;
create sequence if not exists public.leads_talleres_id_seq;
create sequence if not exists public.mensajes_id_seq;
create sequence if not exists public.modulos_id_seq;
create sequence if not exists public.organizaciones_id_seq;
create sequence if not exists public.pagos_suscripcion_id_seq;
create sequence if not exists public.planes_id_seq;
create sequence if not exists public.plantillas_documento_id_seq;
create sequence if not exists public.progreso_usuario_id_seq;
create sequence if not exists public.prorrogas_id_seq;
create sequence if not exists public.recursos_id_seq;
create sequence if not exists public.rubrica_criterios_id_seq;
create sequence if not exists public.sedes_id_seq;
create sequence if not exists public.sesiones_id_seq;
create sequence if not exists public.tareas_id_seq;

-- -------------------------------------------------------------
create table if not exists public.acceso (
  id integer default nextval('acceso_id_seq'::regclass) not null,
  usuario_id uuid not null,
  curso_id integer not null,
  created_at timestamp with time zone default now(),
  grupo text,
  generacion_id bigint
);

-- -------------------------------------------------------------
create table if not exists public.admins (
  email text not null,
  created_at timestamp with time zone default now(),
  organizacion_id bigint
);

-- -------------------------------------------------------------
create table if not exists public.asistencia (
  id bigint default nextval('asistencia_id_seq'::regclass) not null,
  sesion_id bigint not null,
  usuario_id uuid not null,
  estado text default 'presente'::text not null,
  justificada boolean default false not null,
  motivo text,
  nota text,
  registrado_por text,
  registrado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint default nextval('auditoria_id_seq'::regclass) not null,
  tabla text not null,
  registro_id text,
  operacion text not null,
  autor_id uuid,
  autor_email text,
  antes jsonb,
  despues jsonb,
  cambios text[],
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.banco_preguntas (
  id bigint default nextval('banco_preguntas_id_seq'::regclass) not null,
  organizacion_id bigint not null,
  tema text,
  tipo text not null,
  pregunta text not null,
  contenido jsonb default '{}'::jsonb not null,
  dificultad integer,
  creado_por text,
  creado_en timestamp with time zone default now() not null,
  actualizado_en timestamp with time zone default now() not null,
  activa boolean default true not null
);

-- -------------------------------------------------------------
create table if not exists public.categorias (
  id bigint default nextval('categorias_id_seq'::regclass) not null,
  nombre text not null,
  descripcion text,
  motivo text,
  orden integer default 100 not null,
  activa boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  organizacion_id bigint
);

-- -------------------------------------------------------------
create table if not exists public.constancias (
  id bigint default nextval('constancias_id_seq'::regclass) not null,
  usuario_id uuid not null,
  curso_id bigint not null,
  folio text not null,
  nombre_completo text not null,
  profesion text,
  fecha_emision timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.cursos (
  id integer default nextval('cursos_id_seq'::regclass) not null,
  titulo text not null,
  descripcion text,
  imagen_portada text,
  orden integer default 0,
  activo boolean default true,
  created_at timestamp with time zone default now(),
  gratuito boolean default false,
  info_curso text,
  proximamente boolean default false,
  caratula text,
  linea text,
  link_sesion_vivo text,
  link_grabacion text,
  fecha_sesion text,
  constancia boolean default true,
  fecha_inicio timestamp with time zone,
  fecha_fin timestamp with time zone,
  link_materiales text,
  sesion_vivo_activo boolean default true not null,
  sesion_vivo_texto text,
  grabacion_activo boolean default true not null,
  grabacion_texto text,
  rutas_botones jsonb default '{}'::jsonb not null,
  botones_extra jsonb default '[]'::jsonb,
  link_registro text,
  registro_texto text,
  registro_activo boolean default true,
  grabacion_activa boolean default false,
  materiales_texto text,
  materiales_activo boolean default false,
  proxima_sesion text,
  categoria_id bigint,
  organizacion_id bigint,
  ponderacion jsonb
);

-- -------------------------------------------------------------
create table if not exists public.entregas (
  id bigint default nextval('entregas_id_seq'::regclass) not null,
  tarea_id bigint not null,
  usuario_id uuid not null,
  archivo_path text,
  archivo_nombre text,
  comentario text,
  entregado_en timestamp with time zone default now() not null,
  calificacion numeric,
  retroalimentacion text,
  rubrica_detalle jsonb,
  calificado_por uuid,
  calificado_en timestamp with time zone
);

-- -------------------------------------------------------------
create table if not exists public.examenes (
  id bigint generated by default as identity not null,
  modulo_id bigint,
  titulo text not null,
  descripcion text,
  umbral_aprobacion integer default 70,
  preguntas jsonb default '[]'::jsonb not null,
  activo boolean default true,
  created_at timestamp with time zone default now(),
  curso_id bigint,
  max_intentos integer default 3 not null,
  fecha_limite timestamp with time zone,
  cierra_al_vencer boolean default true not null,
  aleatorio_n integer,
  mezclar_opciones boolean default false not null
);

-- -------------------------------------------------------------
create table if not exists public.facilitadores (
  id bigint default nextval('facilitadores_id_seq'::regclass) not null,
  email text not null,
  curso_id bigint,
  creado_en timestamp with time zone default now() not null,
  categoria_id bigint
);

-- -------------------------------------------------------------
create table if not exists public.foro_hilos (
  id bigint default nextval('foro_hilos_id_seq'::regclass) not null,
  curso_id bigint not null,
  autor_id uuid not null,
  autor_nombre text not null,
  autor_email text not null,
  titulo text not null,
  cuerpo text default ''::text not null,
  fijado boolean default false not null,
  cerrado boolean default false not null,
  creado_en timestamp with time zone default now() not null,
  actualizado_en timestamp with time zone default now() not null,
  califica boolean default false not null,
  puntos_max numeric default 10 not null,
  fecha_limite timestamp with time zone,
  cierra_al_vencer boolean default true not null
);

-- -------------------------------------------------------------
create table if not exists public.foro_respuestas (
  id bigint default nextval('foro_respuestas_id_seq'::regclass) not null,
  hilo_id bigint not null,
  autor_id uuid not null,
  autor_nombre text not null,
  autor_email text not null,
  cuerpo text not null,
  editado boolean default false not null,
  borrada boolean default false not null,
  creado_en timestamp with time zone default now() not null,
  calificacion numeric,
  calificado_por uuid,
  calificado_en timestamp with time zone,
  responde_a bigint
);

-- -------------------------------------------------------------
create table if not exists public.generaciones (
  id bigint default nextval('generaciones_id_seq'::regclass) not null,
  curso_id bigint not null,
  nombre text not null,
  fecha_inicio date,
  fecha_fin date,
  cupo integer,
  activa boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  sede_id bigint,
  modalidad text default 'linea'::text not null
);

-- -------------------------------------------------------------
create table if not exists public.intentos_examen (
  id bigint generated by default as identity not null,
  usuario_id uuid,
  examen_id bigint,
  respuestas jsonb not null,
  calificacion integer not null,
  aprobado boolean not null,
  fecha timestamp with time zone default now(),
  preguntas jsonb,
  pendiente boolean default false not null
);

-- -------------------------------------------------------------
create table if not exists public.leads_talleres (
  id bigint generated always as identity not null,
  curso_id integer,
  email text not null,
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.mensajes (
  id bigint default nextval('mensajes_id_seq'::regclass) not null,
  de_id uuid not null,
  para_id uuid not null,
  contenido text not null,
  leido boolean default false,
  created_at timestamp with time zone default now(),
  adjunto_url text,
  adjunto_nombre text,
  adjunto_tipo text
);

-- -------------------------------------------------------------
create table if not exists public.modulos (
  id integer default nextval('modulos_id_seq'::regclass) not null,
  curso_id integer,
  titulo text not null,
  descripcion text,
  orden integer default 0,
  activo boolean default true,
  created_at timestamp with time zone default now(),
  grupo text,
  disponible boolean default true,
  botones_extra jsonb default '[]'::jsonb not null
);

-- -------------------------------------------------------------
create table if not exists public.organizaciones (
  id bigint default nextval('organizaciones_id_seq'::regclass) not null,
  slug text not null,
  nombre text not null,
  dominio text,
  logo_url text,
  color_primario text,
  color_acento text,
  contacto_email text,
  activa boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  plan_id bigint,
  estado_suscripcion text default 'prueba'::text not null,
  periodo text default 'mensual'::text not null,
  precio_acordado numeric(10,2),
  vence_en date,
  max_alumnos integer,
  max_cursos integer,
  max_facilitadores integer,
  exenta_de_limites boolean default false not null,
  notas_comerciales text
);

-- -------------------------------------------------------------
create table if not exists public.pagos_suscripcion (
  id bigint default nextval('pagos_suscripcion_id_seq'::regclass) not null,
  organizacion_id bigint not null,
  monto numeric(10,2) not null,
  moneda text default 'MXN'::text not null,
  pagado_en date default CURRENT_DATE not null,
  periodo_desde date,
  periodo_hasta date,
  metodo text,
  referencia text,
  nota text,
  registrado_por text,
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid not null,
  nombre_completo text,
  profesion text,
  updated_at timestamp with time zone default now(),
  descripcion text,
  ubicacion text,
  avatar_url text,
  notas_admin text
);

-- -------------------------------------------------------------
create table if not exists public.planes (
  id bigint default nextval('planes_id_seq'::regclass) not null,
  clave text not null,
  nombre text not null,
  descripcion text,
  precio_mensual numeric(10,2),
  precio_anual numeric(10,2),
  max_alumnos integer,
  max_cursos integer,
  max_facilitadores integer,
  max_almacenamiento_gb integer,
  orden integer default 0 not null,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.plantillas_documento (
  id bigint default nextval('plantillas_documento_id_seq'::regclass) not null,
  organizacion_id bigint not null,
  tipo text not null,
  nombre text not null,
  descripcion text,
  contenido text default ''::text not null,
  membrete_url text,
  firma_url text,
  firma_nombre text,
  firma_cargo text,
  firma_x numeric default 50 not null,
  firma_y numeric default 80 not null,
  firma_ancho numeric default 25 not null,
  orientacion text default 'vertical'::text not null,
  activa boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  actualizado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.progreso_usuario (
  id integer default nextval('progreso_usuario_id_seq'::regclass) not null,
  usuario_id uuid,
  recurso_id integer,
  completado boolean default false,
  intentos integer default 0,
  ultimo_acceso timestamp with time zone default now()
);

-- -------------------------------------------------------------
create table if not exists public.prorrogas (
  id bigint default nextval('prorrogas_id_seq'::regclass) not null,
  tipo text not null,
  actividad_id bigint not null,
  usuario_id uuid,
  generacion_id bigint,
  nueva_fecha timestamp with time zone not null,
  motivo text,
  creado_por text,
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.recursos (
  id integer default nextval('recursos_id_seq'::regclass) not null,
  modulo_id integer,
  tipo text not null,
  titulo text not null,
  descripcion text,
  archivo text,
  url text,
  contenido text,
  orden integer default 0,
  created_at timestamp with time zone default now(),
  disponible boolean default true not null
);

-- -------------------------------------------------------------
create table if not exists public.rubrica_criterios (
  id bigint default nextval('rubrica_criterios_id_seq'::regclass) not null,
  tarea_id bigint not null,
  titulo text not null,
  descripcion text,
  peso numeric default 0 not null,
  niveles jsonb default '[]'::jsonb not null,
  orden integer default 100 not null
);

-- -------------------------------------------------------------
create table if not exists public.sedes (
  id bigint default nextval('sedes_id_seq'::regclass) not null,
  organizacion_id bigint not null,
  nombre text not null,
  ciudad text,
  direccion text,
  responsable text,
  activa boolean default true not null,
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.sesiones (
  id bigint default nextval('sesiones_id_seq'::regclass) not null,
  generacion_id bigint not null,
  modulo_id bigint,
  titulo text,
  fecha date not null,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  lugar text,
  impartida_por text,
  notas text,
  cancelada boolean default false not null,
  creado_en timestamp with time zone default now() not null
);

-- -------------------------------------------------------------
create table if not exists public.tareas (
  id bigint default nextval('tareas_id_seq'::regclass) not null,
  curso_id bigint,
  modulo_id bigint,
  grupo text,
  titulo text not null,
  instrucciones text,
  fecha_limite timestamp with time zone,
  puntos_max numeric default 100 not null,
  permite_reentrega boolean default true not null,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  cierra_al_vencer boolean default true not null
);

-- -------------------------------------------------------------
--  CLAVES, UNICIDAD Y COMPROBACIONES
--  Van despues de todas las tablas: una clave foranea no se
--  puede crear si la tabla a la que apunta todavia no existe.
-- -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'acceso_pkey'
                    and conrelid = 'public.acceso'::regclass) then
    alter table public.acceso add constraint acceso_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'admins_pkey'
                    and conrelid = 'public.admins'::regclass) then
    alter table public.admins add constraint admins_pkey PRIMARY KEY (email);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'asistencia_pkey'
                    and conrelid = 'public.asistencia'::regclass) then
    alter table public.asistencia add constraint asistencia_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'auditoria_pkey'
                    and conrelid = 'public.auditoria'::regclass) then
    alter table public.auditoria add constraint auditoria_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'banco_preguntas_pkey'
                    and conrelid = 'public.banco_preguntas'::regclass) then
    alter table public.banco_preguntas add constraint banco_preguntas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'categorias_pkey'
                    and conrelid = 'public.categorias'::regclass) then
    alter table public.categorias add constraint categorias_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'constancias_pkey'
                    and conrelid = 'public.constancias'::regclass) then
    alter table public.constancias add constraint constancias_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'cursos_pkey'
                    and conrelid = 'public.cursos'::regclass) then
    alter table public.cursos add constraint cursos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'entregas_pkey'
                    and conrelid = 'public.entregas'::regclass) then
    alter table public.entregas add constraint entregas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'examenes_pkey'
                    and conrelid = 'public.examenes'::regclass) then
    alter table public.examenes add constraint examenes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'facilitadores_pkey'
                    and conrelid = 'public.facilitadores'::regclass) then
    alter table public.facilitadores add constraint facilitadores_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'foro_hilos_pkey'
                    and conrelid = 'public.foro_hilos'::regclass) then
    alter table public.foro_hilos add constraint foro_hilos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'foro_respuestas_pkey'
                    and conrelid = 'public.foro_respuestas'::regclass) then
    alter table public.foro_respuestas add constraint foro_respuestas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'generaciones_pkey'
                    and conrelid = 'public.generaciones'::regclass) then
    alter table public.generaciones add constraint generaciones_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'intentos_examen_pkey'
                    and conrelid = 'public.intentos_examen'::regclass) then
    alter table public.intentos_examen add constraint intentos_examen_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'leads_talleres_pkey'
                    and conrelid = 'public.leads_talleres'::regclass) then
    alter table public.leads_talleres add constraint leads_talleres_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'mensajes_pkey'
                    and conrelid = 'public.mensajes'::regclass) then
    alter table public.mensajes add constraint mensajes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'modulos_pkey'
                    and conrelid = 'public.modulos'::regclass) then
    alter table public.modulos add constraint modulos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'organizaciones_pkey'
                    and conrelid = 'public.organizaciones'::regclass) then
    alter table public.organizaciones add constraint organizaciones_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'pagos_suscripcion_pkey'
                    and conrelid = 'public.pagos_suscripcion'::regclass) then
    alter table public.pagos_suscripcion add constraint pagos_suscripcion_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'perfiles_pkey'
                    and conrelid = 'public.perfiles'::regclass) then
    alter table public.perfiles add constraint perfiles_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'planes_pkey'
                    and conrelid = 'public.planes'::regclass) then
    alter table public.planes add constraint planes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'plantillas_documento_pkey'
                    and conrelid = 'public.plantillas_documento'::regclass) then
    alter table public.plantillas_documento add constraint plantillas_documento_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'progreso_usuario_pkey'
                    and conrelid = 'public.progreso_usuario'::regclass) then
    alter table public.progreso_usuario add constraint progreso_usuario_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prorrogas_pkey'
                    and conrelid = 'public.prorrogas'::regclass) then
    alter table public.prorrogas add constraint prorrogas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'recursos_pkey'
                    and conrelid = 'public.recursos'::regclass) then
    alter table public.recursos add constraint recursos_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'rubrica_criterios_pkey'
                    and conrelid = 'public.rubrica_criterios'::regclass) then
    alter table public.rubrica_criterios add constraint rubrica_criterios_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sedes_pkey'
                    and conrelid = 'public.sedes'::regclass) then
    alter table public.sedes add constraint sedes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sesiones_pkey'
                    and conrelid = 'public.sesiones'::regclass) then
    alter table public.sesiones add constraint sesiones_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'tareas_pkey'
                    and conrelid = 'public.tareas'::regclass) then
    alter table public.tareas add constraint tareas_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'acceso_usuario_id_curso_id_key'
                    and conrelid = 'public.acceso'::regclass) then
    alter table public.acceso add constraint acceso_usuario_id_curso_id_key UNIQUE (usuario_id, curso_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'progreso_usuario_usuario_id_recurso_id_key'
                    and conrelid = 'public.progreso_usuario'::regclass) then
    alter table public.progreso_usuario add constraint progreso_usuario_usuario_id_recurso_id_key UNIQUE (usuario_id, recurso_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'progreso_usuario_usuario_recurso_key'
                    and conrelid = 'public.progreso_usuario'::regclass) then
    alter table public.progreso_usuario add constraint progreso_usuario_usuario_recurso_key UNIQUE (usuario_id, recurso_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'asistencia_estado_check'
                    and conrelid = 'public.asistencia'::regclass) then
    alter table public.asistencia add constraint asistencia_estado_check CHECK ((estado = ANY (ARRAY['presente'::text, 'retardo'::text, 'ausente'::text, 'permiso'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'banco_preguntas_dificultad_check'
                    and conrelid = 'public.banco_preguntas'::regclass) then
    alter table public.banco_preguntas add constraint banco_preguntas_dificultad_check CHECK (((dificultad IS NULL) OR ((dificultad >= 1) AND (dificultad <= 3))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'banco_preguntas_tipo_check'
                    and conrelid = 'public.banco_preguntas'::regclass) then
    alter table public.banco_preguntas add constraint banco_preguntas_tipo_check CHECK ((tipo = ANY (ARRAY['opcion'::text, 'vf'::text, 'corta'::text, 'emparejar'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'cursos_ponderacion_check'
                    and conrelid = 'public.cursos'::regclass) then
    alter table public.cursos add constraint cursos_ponderacion_check CHECK (((ponderacion IS NULL) OR (jsonb_typeof(ponderacion) = 'object'::text)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'examenes_aleatorio_n_check'
                    and conrelid = 'public.examenes'::regclass) then
    alter table public.examenes add constraint examenes_aleatorio_n_check CHECK (((aleatorio_n IS NULL) OR (aleatorio_n >= 0)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'facilitadores_destino_check'
                    and conrelid = 'public.facilitadores'::regclass) then
    alter table public.facilitadores add constraint facilitadores_destino_check CHECK (((curso_id IS NOT NULL) <> (categoria_id IS NOT NULL)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'generaciones_modalidad_check'
                    and conrelid = 'public.generaciones'::regclass) then
    alter table public.generaciones add constraint generaciones_modalidad_check CHECK ((modalidad = ANY (ARRAY['linea'::text, 'presencial'::text, 'mixta'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'organizaciones_estado_check'
                    and conrelid = 'public.organizaciones'::regclass) then
    alter table public.organizaciones add constraint organizaciones_estado_check CHECK ((estado_suscripcion = ANY (ARRAY['prueba'::text, 'activa'::text, 'suspendida'::text, 'cancelada'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'organizaciones_periodo_check'
                    and conrelid = 'public.organizaciones'::regclass) then
    alter table public.organizaciones add constraint organizaciones_periodo_check CHECK ((periodo = ANY (ARRAY['mensual'::text, 'anual'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'plantillas_firma_check'
                    and conrelid = 'public.plantillas_documento'::regclass) then
    alter table public.plantillas_documento add constraint plantillas_firma_check CHECK ((((firma_x >= (0)::numeric) AND (firma_x <= (100)::numeric)) AND ((firma_y >= (0)::numeric) AND (firma_y <= (100)::numeric)) AND ((firma_ancho >= (1)::numeric) AND (firma_ancho <= (100)::numeric))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'plantillas_orientacion_check'
                    and conrelid = 'public.plantillas_documento'::regclass) then
    alter table public.plantillas_documento add constraint plantillas_orientacion_check CHECK ((orientacion = ANY (ARRAY['vertical'::text, 'horizontal'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'plantillas_tipo_check'
                    and conrelid = 'public.plantillas_documento'::regclass) then
    alter table public.plantillas_documento add constraint plantillas_tipo_check CHECK ((tipo = ANY (ARRAY['constancia'::text, 'acta'::text, 'lista'::text, 'boleta'::text, 'informe'::text, 'libre'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prorrogas_destino_check'
                    and conrelid = 'public.prorrogas'::regclass) then
    alter table public.prorrogas add constraint prorrogas_destino_check CHECK (((usuario_id IS NOT NULL) <> (generacion_id IS NOT NULL)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prorrogas_tipo_check'
                    and conrelid = 'public.prorrogas'::regclass) then
    alter table public.prorrogas add constraint prorrogas_tipo_check CHECK ((tipo = ANY (ARRAY['tarea'::text, 'examen'::text, 'foro'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'recursos_tipo_check'
                    and conrelid = 'public.recursos'::regclass) then
    alter table public.recursos add constraint recursos_tipo_check CHECK ((tipo = ANY (ARRAY['pdf'::text, 'video'::text, 'texto'::text, 'enlace'::text, 'word'::text, 'autoevaluacion'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'tareas_destino_check'
                    and conrelid = 'public.tareas'::regclass) then
    alter table public.tareas add constraint tareas_destino_check CHECK (((curso_id IS NOT NULL) <> (modulo_id IS NOT NULL)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'acceso_curso_id_fkey'
                    and conrelid = 'public.acceso'::regclass) then
    alter table public.acceso add constraint acceso_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'acceso_generacion_id_fkey'
                    and conrelid = 'public.acceso'::regclass) then
    alter table public.acceso add constraint acceso_generacion_id_fkey FOREIGN KEY (generacion_id) REFERENCES generaciones(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'acceso_usuario_id_fkey'
                    and conrelid = 'public.acceso'::regclass) then
    alter table public.acceso add constraint acceso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'admins_organizacion_id_fkey'
                    and conrelid = 'public.admins'::regclass) then
    alter table public.admins add constraint admins_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'asistencia_sesion_id_fkey'
                    and conrelid = 'public.asistencia'::regclass) then
    alter table public.asistencia add constraint asistencia_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES sesiones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'banco_preguntas_organizacion_id_fkey'
                    and conrelid = 'public.banco_preguntas'::regclass) then
    alter table public.banco_preguntas add constraint banco_preguntas_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'categorias_organizacion_id_fkey'
                    and conrelid = 'public.categorias'::regclass) then
    alter table public.categorias add constraint categorias_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'constancias_curso_id_fkey'
                    and conrelid = 'public.constancias'::regclass) then
    alter table public.constancias add constraint constancias_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'cursos_categoria_id_fkey'
                    and conrelid = 'public.cursos'::regclass) then
    alter table public.cursos add constraint cursos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'cursos_organizacion_id_fkey'
                    and conrelid = 'public.cursos'::regclass) then
    alter table public.cursos add constraint cursos_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'entregas_tarea_id_fkey'
                    and conrelid = 'public.entregas'::regclass) then
    alter table public.entregas add constraint entregas_tarea_id_fkey FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'examenes_curso_id_fkey'
                    and conrelid = 'public.examenes'::regclass) then
    alter table public.examenes add constraint examenes_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'examenes_modulo_id_fkey'
                    and conrelid = 'public.examenes'::regclass) then
    alter table public.examenes add constraint examenes_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'facilitadores_categoria_id_fkey'
                    and conrelid = 'public.facilitadores'::regclass) then
    alter table public.facilitadores add constraint facilitadores_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'facilitadores_curso_id_fkey'
                    and conrelid = 'public.facilitadores'::regclass) then
    alter table public.facilitadores add constraint facilitadores_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'foro_hilos_curso_id_fkey'
                    and conrelid = 'public.foro_hilos'::regclass) then
    alter table public.foro_hilos add constraint foro_hilos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'foro_respuestas_hilo_id_fkey'
                    and conrelid = 'public.foro_respuestas'::regclass) then
    alter table public.foro_respuestas add constraint foro_respuestas_hilo_id_fkey FOREIGN KEY (hilo_id) REFERENCES foro_hilos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'foro_respuestas_responde_a_fkey'
                    and conrelid = 'public.foro_respuestas'::regclass) then
    alter table public.foro_respuestas add constraint foro_respuestas_responde_a_fkey FOREIGN KEY (responde_a) REFERENCES foro_respuestas(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'generaciones_curso_id_fkey'
                    and conrelid = 'public.generaciones'::regclass) then
    alter table public.generaciones add constraint generaciones_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'generaciones_sede_id_fkey'
                    and conrelid = 'public.generaciones'::regclass) then
    alter table public.generaciones add constraint generaciones_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'intentos_examen_examen_id_fkey'
                    and conrelid = 'public.intentos_examen'::regclass) then
    alter table public.intentos_examen add constraint intentos_examen_examen_id_fkey FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'intentos_examen_usuario_id_fkey'
                    and conrelid = 'public.intentos_examen'::regclass) then
    alter table public.intentos_examen add constraint intentos_examen_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'leads_talleres_curso_id_fkey'
                    and conrelid = 'public.leads_talleres'::regclass) then
    alter table public.leads_talleres add constraint leads_talleres_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'mensajes_de_id_fkey'
                    and conrelid = 'public.mensajes'::regclass) then
    alter table public.mensajes add constraint mensajes_de_id_fkey FOREIGN KEY (de_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'mensajes_para_id_fkey'
                    and conrelid = 'public.mensajes'::regclass) then
    alter table public.mensajes add constraint mensajes_para_id_fkey FOREIGN KEY (para_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'modulos_curso_id_fkey'
                    and conrelid = 'public.modulos'::regclass) then
    alter table public.modulos add constraint modulos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'organizaciones_plan_id_fkey'
                    and conrelid = 'public.organizaciones'::regclass) then
    alter table public.organizaciones add constraint organizaciones_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'pagos_suscripcion_organizacion_id_fkey'
                    and conrelid = 'public.pagos_suscripcion'::regclass) then
    alter table public.pagos_suscripcion add constraint pagos_suscripcion_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'perfiles_id_fkey'
                    and conrelid = 'public.perfiles'::regclass) then
    alter table public.perfiles add constraint perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'plantillas_documento_organizacion_id_fkey'
                    and conrelid = 'public.plantillas_documento'::regclass) then
    alter table public.plantillas_documento add constraint plantillas_documento_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'progreso_usuario_recurso_id_fkey'
                    and conrelid = 'public.progreso_usuario'::regclass) then
    alter table public.progreso_usuario add constraint progreso_usuario_recurso_id_fkey FOREIGN KEY (recurso_id) REFERENCES recursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'progreso_usuario_usuario_id_fkey'
                    and conrelid = 'public.progreso_usuario'::regclass) then
    alter table public.progreso_usuario add constraint progreso_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prorrogas_generacion_id_fkey'
                    and conrelid = 'public.prorrogas'::regclass) then
    alter table public.prorrogas add constraint prorrogas_generacion_id_fkey FOREIGN KEY (generacion_id) REFERENCES generaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'recursos_modulo_id_fkey'
                    and conrelid = 'public.recursos'::regclass) then
    alter table public.recursos add constraint recursos_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'rubrica_criterios_tarea_id_fkey'
                    and conrelid = 'public.rubrica_criterios'::regclass) then
    alter table public.rubrica_criterios add constraint rubrica_criterios_tarea_id_fkey FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sedes_organizacion_id_fkey'
                    and conrelid = 'public.sedes'::regclass) then
    alter table public.sedes add constraint sedes_organizacion_id_fkey FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sesiones_generacion_id_fkey'
                    and conrelid = 'public.sesiones'::regclass) then
    alter table public.sesiones add constraint sesiones_generacion_id_fkey FOREIGN KEY (generacion_id) REFERENCES generaciones(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sesiones_modulo_id_fkey'
                    and conrelid = 'public.sesiones'::regclass) then
    alter table public.sesiones add constraint sesiones_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'tareas_curso_id_fkey'
                    and conrelid = 'public.tareas'::regclass) then
    alter table public.tareas add constraint tareas_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'tareas_modulo_id_fkey'
                    and conrelid = 'public.tareas'::regclass) then
    alter table public.tareas add constraint tareas_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE;
  end if;
end $$;

-- -------------------------------------------------------------
--  INDICES
--  Los de clave primaria y unicidad ya los creo el bloque de
--  arriba, asi que aqui solo van los demas.
-- -------------------------------------------------------------
create index if not exists acceso_generacion_idx ON public.acceso USING btree (generacion_id);
create unique index if not exists asistencia_sesion_usuario_idx ON public.asistencia USING btree (sesion_id, usuario_id);
create index if not exists auditoria_creado_idx ON public.auditoria USING btree (creado_en DESC);
create index if not exists auditoria_tabla_idx ON public.auditoria USING btree (tabla, registro_id);
create index if not exists banco_preguntas_org_idx ON public.banco_preguntas USING btree (organizacion_id, tema);
create index if not exists banco_preguntas_tipo_idx ON public.banco_preguntas USING btree (organizacion_id, tipo);
create unique index if not exists categorias_nombre_idx ON public.categorias USING btree (lower(nombre));
create index if not exists categorias_org_idx ON public.categorias USING btree (organizacion_id);
create index if not exists constancias_curso_idx ON public.constancias USING btree (curso_id);
create unique index if not exists constancias_folio_idx ON public.constancias USING btree (folio);
create unique index if not exists constancias_usuario_curso_idx ON public.constancias USING btree (usuario_id, curso_id);
create index if not exists cursos_categoria_idx ON public.cursos USING btree (categoria_id);
create index if not exists cursos_org_idx ON public.cursos USING btree (organizacion_id);
create index if not exists entregas_tarea_idx ON public.entregas USING btree (tarea_id);
create unique index if not exists entregas_tarea_usuario_idx ON public.entregas USING btree (tarea_id, usuario_id);
create index if not exists examenes_curso_id_idx ON public.examenes USING btree (curso_id);
create index if not exists examenes_modulo_id_idx ON public.examenes USING btree (modulo_id);
create index if not exists idx_examenes_modulo ON public.examenes USING btree (modulo_id);
create index if not exists facilitadores_curso_idx ON public.facilitadores USING btree (curso_id);
create unique index if not exists facilitadores_email_categoria_idx ON public.facilitadores USING btree (lower(email), categoria_id) WHERE (categoria_id IS NOT NULL);
create unique index if not exists facilitadores_email_curso_idx ON public.facilitadores USING btree (lower(email), curso_id);
create index if not exists foro_hilos_curso_idx ON public.foro_hilos USING btree (curso_id, fijado DESC, actualizado_en DESC);
create index if not exists foro_respuestas_hilo_idx ON public.foro_respuestas USING btree (hilo_id, creado_en);
create index if not exists foro_respuestas_rama_idx ON public.foro_respuestas USING btree (responde_a);
create index if not exists generaciones_curso_idx ON public.generaciones USING btree (curso_id, fecha_inicio DESC);
create unique index if not exists generaciones_curso_nombre_idx ON public.generaciones USING btree (curso_id, lower(nombre));
create index if not exists generaciones_sede_idx ON public.generaciones USING btree (sede_id);
create index if not exists idx_intentos_usuario ON public.intentos_examen USING btree (usuario_id, examen_id);
create index if not exists idx_mensajes_de_para ON public.mensajes USING btree (de_id, para_id, created_at DESC);
create index if not exists idx_mensajes_para_leido ON public.mensajes USING btree (para_id, leido);
create unique index if not exists organizaciones_dominio_idx ON public.organizaciones USING btree (lower(dominio)) WHERE (dominio IS NOT NULL);
create unique index if not exists organizaciones_slug_idx ON public.organizaciones USING btree (lower(slug));
create index if not exists pagos_suscripcion_org_idx ON public.pagos_suscripcion USING btree (organizacion_id, pagado_en DESC);
create unique index if not exists planes_clave_idx ON public.planes USING btree (lower(clave));
create index if not exists plantillas_org_idx ON public.plantillas_documento USING btree (organizacion_id, tipo);
create unique index if not exists prorrogas_generacion_idx ON public.prorrogas USING btree (tipo, actividad_id, generacion_id) WHERE (generacion_id IS NOT NULL);
create unique index if not exists prorrogas_usuario_idx ON public.prorrogas USING btree (tipo, actividad_id, usuario_id) WHERE (usuario_id IS NOT NULL);
create index if not exists rubrica_tarea_idx ON public.rubrica_criterios USING btree (tarea_id, orden);
create unique index if not exists sedes_nombre_idx ON public.sedes USING btree (organizacion_id, lower(nombre));
create index if not exists sedes_org_idx ON public.sedes USING btree (organizacion_id);
create index if not exists sesiones_generacion_idx ON public.sesiones USING btree (generacion_id, fecha);
create index if not exists sesiones_modulo_idx ON public.sesiones USING btree (modulo_id);
create index if not exists tareas_curso_idx ON public.tareas USING btree (curso_id);
create index if not exists tareas_modulo_idx ON public.tareas USING btree (modulo_id);

-- -------------------------------------------------------------
--  CADA SECUENCIA, ATADA A SU COLUMNA
--  Sin esto quedan sueltas: no se borran al borrar la tabla y no
--  se reinician al vaciarla.
-- -------------------------------------------------------------
alter sequence public.acceso_id_seq owned by public.acceso.id;
alter sequence public.asistencia_id_seq owned by public.asistencia.id;
alter sequence public.auditoria_id_seq owned by public.auditoria.id;
alter sequence public.banco_preguntas_id_seq owned by public.banco_preguntas.id;
alter sequence public.categorias_id_seq owned by public.categorias.id;
alter sequence public.constancias_id_seq owned by public.constancias.id;
alter sequence public.cursos_id_seq owned by public.cursos.id;
alter sequence public.entregas_id_seq owned by public.entregas.id;
alter sequence public.facilitadores_id_seq owned by public.facilitadores.id;
alter sequence public.foro_hilos_id_seq owned by public.foro_hilos.id;
alter sequence public.foro_respuestas_id_seq owned by public.foro_respuestas.id;
alter sequence public.generaciones_id_seq owned by public.generaciones.id;
alter sequence public.mensajes_id_seq owned by public.mensajes.id;
alter sequence public.modulos_id_seq owned by public.modulos.id;
alter sequence public.organizaciones_id_seq owned by public.organizaciones.id;
alter sequence public.pagos_suscripcion_id_seq owned by public.pagos_suscripcion.id;
alter sequence public.planes_id_seq owned by public.planes.id;
alter sequence public.plantillas_documento_id_seq owned by public.plantillas_documento.id;
alter sequence public.progreso_usuario_id_seq owned by public.progreso_usuario.id;
alter sequence public.prorrogas_id_seq owned by public.prorrogas.id;
alter sequence public.recursos_id_seq owned by public.recursos.id;
alter sequence public.rubrica_criterios_id_seq owned by public.rubrica_criterios.id;
alter sequence public.sedes_id_seq owned by public.sedes.id;
alter sequence public.sesiones_id_seq owned by public.sesiones.id;
alter sequence public.tareas_id_seq owned by public.tareas.id;

-- =============================================================
--  COMPROBACION
-- =============================================================
select 'tablas' as que, count(*)::text as n from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r';
-- Esperado: 30
