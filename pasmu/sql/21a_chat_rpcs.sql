-- PASMU: 21a_chat_rpcs.sql
-- RPCs para chat clínico (enviar, listar, permisos).
begin;

-- RPC: listar salas de chat disponibles (solo clínico)
drop function if exists public.pasmu_chat_salas_listar();

create or replace function public.pasmu_chat_salas_listar()
returns table (id bigint, nombre text, tipo text, creado_en timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select s.id, s.nombre, s.tipo, s.creado_en
  from public.salas_chat s
  where s.tipo = 'clinico'
    and exists (select 1 from public.participantes_chat p
                where p.sala_id = s.id
                  and p.persona_id = private.pasmu_current_persona_id()
                  and p.activo = true);
$$;

drop function if exists public.pasmu_chat_participantes_listar(bigint);

create or replace function public.pasmu_chat_participantes_listar(p_sala_id bigint)
returns table (persona_id uuid, nombre text, rol_en_sala text)
language sql security definer set search_path = public, pg_temp as $$
  select p.persona_id, u.nombre, p.rol_en_sala
  from public.participantes_chat p
  join public.personas u on u.id = p.persona_id
  where p.sala_id = p_sala_id
    and p.activo = true;
$$;

drop function if exists public.pasmu_chat_mensajes_listar(bigint, int);

create or replace function public.pasmu_chat_mensajes_listar(p_sala_id bigint, p_limite int default 50)
returns table (id bigint, contenido text, tipo text, enlace text, enviado_por uuid, creado_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  select m.id, m.contenido, m.tipo, m.enlace, m.enviado_por, m.creado_en, u.nombre
  from public.mensajes_chat m
  join public.personas u on u.id = m.enviado_por
  where m.sala_id = p_sala_id
    and exists (select 1 from public.participantes_chat p
                where p.sala_id = m.sala_id
                  and p.persona_id = m.enviado_por
                  and p.activo = true)
  order by m.creado_en desc
  limit p_limite;
$$;

drop function if exists public.pasmu_chat_mensaje_crear(bigint, text, text, text);

create or replace function public.pasmu_chat_mensaje_crear(p_sala_id bigint, p_contenido text, p_tipo text default 'texto', p_enlace text default null)
returns table (id bigint, contenido text, tipo text, usuario text, creado_en timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  insert into public.mensajes_chat (sala_id, enviado_por, contenido, tipo, enlace)
  values (p_sala_id, private.pasmu_current_persona_id(), p_contenido, p_tipo, p_enlace);
  select m.id, m.contenido, m.tipo, u.nombre, m.creado_en
  from public.mensajes_chat m
  join public.personas u on u.id = m.enviado_por
  where m.id = lastval();
$$;

grant execute on function public.pasmu_chat_salas_listar() to authenticated;
grant execute on function public.pasmu_chat_participantes_listar(bigint) to authenticated;
grant execute on function public.pasmu_chat_mensajes_listar(bigint, int) to authenticated;
grant execute on function public.pasmu_chat_mensaje_crear(bigint, text, text, text) to authenticated;
commit;
