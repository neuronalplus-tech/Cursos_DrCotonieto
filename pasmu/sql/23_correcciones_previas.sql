-- PASMU 23: correcciones a objetos anteriores detectadas al revisar el esquema. RECOMENDADA.
-- Solo PRUEBAS. Idempotente. Cada bloque se omite si las tablas que corrige todavía no existen.
--
-- Hallazgos (se comprobaron ejecutándolos en un PostgreSQL real):
--  1. 21_chat_interno: salas_chat y participantes_chat se leían con `using (true)`.
--  2. 21_chat_interno: mensajes_chat comparaba `current_setting('request.jwt.claims')::uuid`; ese valor es un JSON
--     y la conversión falla.
--  3. 21a_chat_rpcs: pasmu_chat_mensajes_listar comprobaba la pertenencia de quien ENVIÓ cada mensaje y no la de quien
--     lee: cualquier persona autenticada podía leer cualquier sala. pasmu_chat_participantes_listar y
--     pasmu_chat_mensaje_crear no comprobaban nada (cualquiera podía escribir en cualquier sala).
--  4. 16_rls_soap_supervision: las políticas de notas_soap y revisiones_supervision se referencian entre sí
--     («infinite recursion detected in policy») y además usan el mismo `request.jwt.claims::uuid`.
begin;

-- Ayuda para las políticas: ¿soy participante activo de la sala? (SECURITY DEFINER evita recursión de RLS).
create or replace function private.pasmu_es_participante_sala(_sala_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.participantes_chat pc
    where pc.sala_id = _sala_id
      and pc.persona_id = private.pasmu_current_persona_id()
      and pc.activo = true);
end;
$$;

do $$
begin
  if to_regclass('public.salas_chat') is not null then
    revoke all on function private.pasmu_es_participante_sala(bigint) from public, anon;
    grant execute on function private.pasmu_es_participante_sala(bigint) to authenticated;

    drop policy if exists salas_chat_read on public.salas_chat;
    create policy salas_chat_read on public.salas_chat for select to authenticated
      using (private.pasmu_es_participante_sala(id));

    drop policy if exists participantes_chat_read on public.participantes_chat;
    create policy participantes_chat_read on public.participantes_chat for select to authenticated
      using (private.pasmu_es_participante_sala(sala_id));

    drop policy if exists mensajes_chat_read_by_participant on public.mensajes_chat;
    create policy mensajes_chat_read_by_participant on public.mensajes_chat for select to authenticated
      using (private.pasmu_es_participante_sala(sala_id));
  end if;
end $$;

-- ——— 3. Chat: las funciones públicas no comprobaban que quien llama participe en la sala ———
-- pasmu_chat_mensajes_listar revisaba la pertenencia de quien ENVIÓ cada mensaje, no de quien lee: cualquier persona
-- autenticada podía leer cualquier sala. pasmu_chat_participantes_listar y pasmu_chat_mensaje_crear tampoco validaban.
do $correccion$
begin
  if to_regclass('public.salas_chat') is not null then
    drop function if exists public.pasmu_chat_participantes_listar(bigint);
    execute $f$
      create function public.pasmu_chat_participantes_listar(p_sala_id bigint)
      returns table (persona_id uuid, nombre text, rol_en_sala text)
      language plpgsql stable security definer set search_path = ''
      as $body$
      begin
        if not private.pasmu_es_participante_sala(p_sala_id) then
          raise exception 'No participas en esta sala.' using errcode = '42501';
        end if;
        return query
          select p.persona_id, u.nombre, p.rol_en_sala
          from public.participantes_chat p join public.personas u on u.id = p.persona_id
          where p.sala_id = p_sala_id and p.activo = true;
      end;
      $body$ $f$;

    drop function if exists public.pasmu_chat_mensajes_listar(bigint, int);
    execute $f$
      create function public.pasmu_chat_mensajes_listar(p_sala_id bigint, p_limite int default 50)
      returns table (id bigint, contenido text, tipo text, enlace text, enviado_por uuid, creado_en timestamptz, usuario text)
      language plpgsql stable security definer set search_path = ''
      as $body$
      begin
        if not private.pasmu_es_participante_sala(p_sala_id) then
          raise exception 'No participas en esta sala.' using errcode = '42501';
        end if;
        return query
          select m.id, m.contenido, m.tipo, m.enlace, m.enviado_por, m.creado_en, u.nombre
          from public.mensajes_chat m left join public.personas u on u.id = m.enviado_por
          where m.sala_id = p_sala_id
          order by m.creado_en desc
          limit greatest(1, least(coalesce(p_limite, 50), 200));
      end;
      $body$ $f$;

    drop function if exists public.pasmu_chat_mensaje_crear(bigint, text, text, text);
    execute $f$
      create function public.pasmu_chat_mensaje_crear(p_sala_id bigint, p_contenido text, p_tipo text default 'texto', p_enlace text default null)
      returns table (id bigint, contenido text, tipo text, usuario text, creado_en timestamptz)
      language plpgsql security definer set search_path = ''
      as $body$
      declare
        v_persona uuid := private.pasmu_current_persona_id();
        v_id bigint;
      begin
        if v_persona is null or not private.pasmu_es_participante_sala(p_sala_id) then
          raise exception 'No participas en esta sala.' using errcode = '42501';
        end if;
        if p_contenido is null or char_length(btrim(p_contenido)) not between 1 and 5000 then
          raise exception 'El mensaje debe tener de 1 a 5000 caracteres.' using errcode = '22023';
        end if;
        if p_enlace is not null and p_enlace !~* '^https://' then
          raise exception 'El enlace debe empezar con https://.' using errcode = '22023';
        end if;
        insert into public.mensajes_chat (sala_id, enviado_por, contenido, tipo, enlace)
        values (p_sala_id, v_persona, btrim(p_contenido), coalesce(p_tipo, 'texto'), p_enlace)
        returning public.mensajes_chat.id into v_id;
        return query
          select m.id, m.contenido, m.tipo, u.nombre, m.creado_en
          from public.mensajes_chat m join public.personas u on u.id = m.enviado_por where m.id = v_id;
      end;
      $body$ $f$;

    -- pasmu_chat_salas_listar quedó ejecutable por anon (permiso por omisión de PUBLIC).
    if to_regprocedure('public.pasmu_chat_salas_listar()') is not null then
      revoke all on function public.pasmu_chat_salas_listar() from public, anon;
      grant execute on function public.pasmu_chat_salas_listar() to authenticated;
    end if;
    revoke all on function public.pasmu_chat_participantes_listar(bigint) from public, anon;
    revoke all on function public.pasmu_chat_mensajes_listar(bigint, int) from public, anon;
    revoke all on function public.pasmu_chat_mensaje_crear(bigint, text, text, text) from public, anon;
    grant execute on function public.pasmu_chat_participantes_listar(bigint) to authenticated;
    grant execute on function public.pasmu_chat_mensajes_listar(bigint, int) to authenticated;
    grant execute on function public.pasmu_chat_mensaje_crear(bigint, text, text, text) to authenticated;
  end if;
end $correccion$;

-- ——— 4. SOAP: políticas con recursión infinita y con identidad mal obtenida ———
-- notas_soap lee revisiones_supervision y revisiones_supervision lee notas_soap: PostgreSQL responde
-- «infinite recursion detected in policy» al consultar cualquiera de las dos. Además comparaban con
-- current_setting('request.jwt.claims')::uuid (un JSON, no un uuid). Se rompe el ciclo con funciones
-- SECURITY DEFINER y se usa la persona autenticada.
create or replace function private.pasmu_es_revisor_del_caso(_caso_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.revisiones_supervision v
    where v.caso_id = _caso_id and v.revisada_por = private.pasmu_current_persona_id());
end;
$$;

create or replace function private.pasmu_es_autor_de_nota(_nota_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.notas_soap n
    where n.id = _nota_id and n.creada_por = private.pasmu_current_persona_id());
end;
$$;

revoke all on function private.pasmu_es_revisor_del_caso(bigint) from public, anon;
revoke all on function private.pasmu_es_autor_de_nota(bigint) from public, anon;
grant execute on function private.pasmu_es_revisor_del_caso(bigint) to authenticated;
grant execute on function private.pasmu_es_autor_de_nota(bigint) to authenticated;

do $correccion$
begin
  if to_regclass('public.notas_soap') is not null and to_regclass('public.revisiones_supervision') is not null then
    drop policy if exists notas_soap_read_by_creator_or_reviewed on public.notas_soap;
    create policy notas_soap_read_by_creator_or_reviewed on public.notas_soap for select to authenticated
      using (creada_por = private.pasmu_current_persona_id() or private.pasmu_es_revisor_del_caso(caso_id));

    drop policy if exists notas_addendum_read_by_creator on public.notas_addendum;
    create policy notas_addendum_read_by_creator on public.notas_addendum for select to authenticated
      using (creada_por = private.pasmu_current_persona_id());

    drop policy if exists revisiones_supervision_read_by_reviewer on public.revisiones_supervision;
    create policy revisiones_supervision_read_by_reviewer on public.revisiones_supervision for select to authenticated
      using (revisada_por = private.pasmu_current_persona_id() or private.pasmu_es_autor_de_nota(nota_id));
  end if;
end $correccion$;

commit;

-- Nota sobre 20a/20b (no modificadas aquí):
--  * Las funciones pasmu_notas_soap_crear, pasmu_notas_addendum_crear y pasmu_revisiones_crear usan
--    `current_setting('request.jwt.claims')::uuid` y deberían usar private.pasmu_current_persona_id().
--  * pasmu_revisiones_crear inserta sin `revisada_por`, por lo que su SELECT final no devuelve la fila.
--  * pasmu_notas_soap_crear es un SELECT, no un alta.
--  El flujo de firma, revisión y addendum de 27_revisiones_familiograma_constancias.sql lo reemplaza.
