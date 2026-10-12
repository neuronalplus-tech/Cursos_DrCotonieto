-- =============================================================
--  CONFIGURACIÓN DEL FORMULARIO DE REGISTRO PÚBLICO
--
--  QUÉ RESUELVE
--  La pantalla /registro (la de "Crear mi cuenta" de los talleres
--  gratuitos) tenía sus textos y sus campos escritos en el código.
--  Esta tabla deja que el admin los cambie desde el panel, sin
--  depender de nadie para, por ejemplo, quitar el "Repite tu correo"
--  o reescribir la descripción.
--
--  UNA FILA POR ORGANIZACIÓN
--  Van varias instituciones en la misma app; cada una edita la suya.
--  `organizacion_id` es único.
--
--  POR QUÉ LAS COLUMNAS DE TEXTO SON NULL
--  El valor por defecto de verdad vive en el código (REGISTRO_DEFECTO,
--  en src/config.js). Si aquí hubiera un default, quedarían dos sitios
--  con el mismo texto y tarde o temprano se desincronizarían. Aquí se
--  guarda SOLO lo que el admin cambió; lo demás lo rellena el front.
--  Mientras no haya fila, la pantalla usa los valores por defecto.
--
--  SEGURIDAD
--  Lectura pública (anon): es solo texto de pantalla, igual que
--  `categorias` u `organizaciones`. Escritura: únicamente el admin de
--  ESA organización, con es_admin_de().
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente: volver a correrlo no rompe nada.
-- =============================================================

create table if not exists public.config_registro (
  id bigint generated always as identity primary key,
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,

  -- Textos de la pantalla
  titulo                     text,
  descripcion                text,
  texto_boton                text,
  texto_cargando             text,

  -- Campos que se piden (y sus etiquetas)
  pedir_nombre               boolean not null default true,
  etiqueta_nombre            text,
  etiqueta_email             text,
  pedir_repeticion_email     boolean not null default true,
  etiqueta_email2            text,
  etiqueta_contrasena        text,
  etiqueta_contrasena2       text,
  pedir_repeticion_contrasena boolean not null default true,

  -- Mensaje que se muestra tras enviar el registro
  confirmacion_intro         text,
  confirmacion_cierre        text,
  confirmacion_nota          text,

  actualizado_el timestamptz not null default now(),
  unique (organizacion_id)
);

alter table public.config_registro enable row level security;

-- Lectura pública: solo texto de pantalla (patrón de `categorias`).
drop policy if exists "config_registro_select" on public.config_registro;
create policy "config_registro_select" on public.config_registro
  for select to anon, authenticated
  using (true);

-- Escritura: únicamente el administrador de ESA organización.
drop policy if exists "config_registro_escribir" on public.config_registro;
create policy "config_registro_escribir" on public.config_registro
  as permissive
  for all to authenticated
  using (public.es_admin_de(organizacion_id))
  with check (public.es_admin_de(organizacion_id));

create index if not exists config_registro_org_idx
  on public.config_registro(organizacion_id);
