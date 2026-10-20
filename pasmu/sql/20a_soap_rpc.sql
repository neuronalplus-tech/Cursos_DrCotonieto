-- PASMU 20a: SOAP + addendum + supervisión (RPCs autorizados, no lectura cruzada).
begin;
drop function if exists public.pasmu_notas_soap_crear(bigint);

create or replace function public.pasmu_notas_soap_crear(p_caso_id bigint)
returns table (id bigint, sesion int, subjetivo text, objetivo jsonb,
               analisis text, plan jsonb, creada_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  select n.id, n.sesion, n.subjetivo, n.objetivo, n.analisis, n.plan,
         n.creada_en, u.nombre
  from public.notas_soap n
  join public.personas u on u.id = n.creada_por
  where n.caso_id = p_caso_id
    and (n.creada_por = current_setting('request.jwt.claims')::uuid
         or exists (select 1 from public.revisiones_supervision v where v.caso_id = n.caso_id and v.revisada_por = current_setting('request.jwt.claims')::uuid))
$$;

drop function if exists public.pasmu_notas_addendum_crear(bigint, int, text, text);

create or replace function public.pasmu_notas_addendum_crear(p_caso_id bigint, p_sesion int, p_texto text, p_motivo text)
returns table (id bigint, creada_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notas_addendum (nota_id, texto, motivo)
  select n.id, p_texto, p_motivo
  from public.notas_soap n
  where n.caso_id = p_caso_id and n.sesion = p_sesion
    and (n.creada_por = current_setting('request.jwt.claims')::uuid
         or exists (select 1 from public.revisiones_supervision v
                    where v.caso_id = n.caso_id and v.revisada_por = current_setting('request.jwt.claims')::uuid));
  select n.id, now(), u.nombre
  from public.notas_soap n
  join public.personas u on u.id = n.creada_por
  where n.caso_id = p_caso_id and n.sesion = p_sesion
  limit 1;
$$;

drop function if exists public.pasmu_revisiones_crear(bigint, bigint, text, text);

create or replace function public.pasmu_revisiones_crear(p_caso_id bigint, p_nota_id bigint, p_comentario text, pestado text)
returns table (id bigint, estado text, creada_en timestamptz, revisada_por text)
language sql security definer set search_path = public, pg_temp as $$
  insert into public.revisiones_supervision (caso_id, nota_id, comentario, estado, respuesta)
  values (p_caso_id, p_nota_id, p_comentario, pestado, null);
  select v.id, v.estado, v.creada_en, u.nombre
  from public.revisiones_supervision v
  join public.personas u on u.id = v.revisada_por
  where v.caso_id = p_caso_id and v.nota_id = p_nota_id
$$;
commit;
