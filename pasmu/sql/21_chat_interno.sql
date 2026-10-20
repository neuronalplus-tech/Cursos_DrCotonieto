-- PASMU: 21_chat_interno.sql
-- Chat clínico para personal de salud (terapeutas, supervisores, coordinadores).
-- Solo para profesionales asignados a casos o con permiso de chat clínico.
begin;

create table if not exists public.salas_chat (
  id bigserial primary key,
  nombre text not null check (char_length(btrim(nombre)) between 3 and 100),
  tipo text not null check (char_length(btrim(tipo)) between 3 and 50), -- 'clinico', 'taller', 'grupo'
  creado_en timestamptz not null default now(),
  creado_por uuid references public.personas(id) on delete set null
);

create table if not exists public.participantes_chat (
  id bigserial primary key,
  sala_id bigint not null references public.salas_chat(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete cascade,
  rol_en_sala text not null default 'miembro' check (char_length(btrim(rol_en_sala)) between 3 and 50),
  activo boolean not null default true,
  fecha_ingreso timestamptz not null default now(),
  unique (sala_id, persona_id)
);

create table if not exists public.mensajes_chat (
  id bigserial primary key,
  sala_id bigint not null references public.salas_chat(id) on delete cascade,
  enviado_por uuid references public.personas(id) on delete set null,
  contenido text not null check (char_length(btrim(contenido)) between 1 and 5000),
  tipo text not null default 'texto' check (char_length(btrim(tipo)) between 3 and 50),
  enlace text, -- opcional: URL adjunto
  creado_en timestamptz not null default now()
);

create index if not exists idx_mensajes_sala on public.mensajes_chat(sala_id, creado_en desc);
create index if not exists idx_participantes_chat_sala on public.participantes_chat(sala_id, persona_id);

-- RLS: solo lectura para roles autorizados
alter table public.salas_chat enable row level security;
alter table public.participantes_chat enable row level security;
alter table public.mensajes_chat enable row level security;

revoke all on table public.salas_chat, public.participantes_chat, public.mensajes_chat from public, anon, authenticated;

-- Políticas RLS simplificadas para el chat clínico
drop policy if exists salas_chat_read on public.salas_chat;
create policy salas_chat_read on public.salas_chat for select to authenticated
  using (true);

drop policy if exists participantes_chat_read on public.participantes_chat;
create policy participantes_chat_read on public.participantes_chat for select to authenticated
  using (true);

drop policy if exists mensajes_chat_send on public.mensajes_chat;
create policy mensajes_chat_send on public.mensajes_chat for insert to authenticated
  with check (enviado_por = private.pasmu_current_persona_id()
              and exists (select 1 from public.participantes_chat p
                          where p.sala_id = mensajes_chat.sala_id
                            and p.persona_id = private.pasmu_current_persona_id()
                            and p.activo = true));

drop policy if exists mensajes_chat_read_by_participant on public.mensajes_chat;
create policy mensajes_chat_read_by_participant on public.mensajes_chat for select to authenticated
  using (exists (select 1 from public.participantes_chat p
                  where p.sala_id = mensajes_chat.sala_id
                    and p.persona_id = current_setting('request.jwt.claims')::uuid
                    and p.activo = true));

commit;
