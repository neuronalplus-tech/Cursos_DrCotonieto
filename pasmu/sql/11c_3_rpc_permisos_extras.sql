-- PASMU: 11c_3_rpc_permisos_extras.sql
-- RPC complementarias: permisos, SOAP, addenda, supervisión.
-- Ejecutar después de 11c_wrappers_publicos.sql.
begin;

-- RPC: lista de permisos con alcance de rol (usada por cargarPermisosPasmu).
create or replace function public.pasmu_mis_permisos_pasmu()
returns table (permiso text, unidad_id bigint, programa_id bigint)
language sql security definer set search_path = public, pg_temp as $$
  select pe.codigo, m.unidad_id, m.programa_id
  from public.miembros m
  join public.roles r on r.id = m.rol_id
  join public.rol_permisos rp on rp.rol_id = r.id
  join public.permisos pe on pe.id = rp.permiso_id
  where m.persona_id = private.pasmu_current_persona_id()
    and m.activo = true
    and r.activo = true
    and pe.activo = true
    and m.fecha_inicio <= current_date
    and (m.fecha_fin is null or m.fecha_fin >= current_date)
  union all
  select pe.codigo, null::bigint, null::bigint
  from public.permisos pe
  where pe.codigo = 'dashboard.ver' and pe.activo = true;
$$;

-- RPC: listar notas SOAP de un caso (solo las del caso, con datos de autor).
create or replace function public.pasmu_notas_soap_listar_caso(p_caso_id bigint)
returns table (id bigint, sesion int, subjetivo text, objetivo jsonb,
               analisis text, plan jsonb, creada_por uuid, creada_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  select n.id, n.sesion, n.subjetivo, n.objetivo, n.analisis, n.plan,
         n.creada_por, n.creada_en, u.nombre
  from public.notas_soap n
  join public.personas u on u.id = n.creada_por
  where n.caso_id = p_caso_id
    and (n.creada_por = current_setting('request.jwt.claims')::uuid
         or exists (select 1 from public.revisiones_supervision v
                    where v.caso_id = n.caso_id and v.revisada_por = current_setting('request.jwt.claims')::uuid));
$$;

-- RPC: listar addenda de una nota SOAP.
create or replace function public.pasmu_notas_addendum_listar(p_caso_id bigint, p_sesion int)
returns table (id bigint, texto text, creada_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  select a.id, a.texto, a.creada_en, u.nombre
  from public.notas_addendum a
  join public.notas_soap n on n.id = a.nota_id
  join public.personas u on u.id = a.creada_por
  where n.caso_id = p_caso_id and n.sesion = p_sesion;
$$;

-- RPC: listar revisiones de supervisión de un caso.
create or replace function public.pasmu_revisiones_listar(p_caso_id bigint)
returns table (id bigint, nota_id bigint, comentario text, estado text,
               respuesta text, revisada_por uuid, creada_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  select v.id, v.nota_id, v.comentario, v.estado, v.respuesta,
         v.revisada_por, v.creada_en, u.nombre
  from public.revisiones_supervision v
  join public.personas u on u.id = v.revisada_por
  where v.caso_id = p_caso_id;
$$;

-- RPC: solicitar revisión de una nota SOAP por parte del terapeuta.
create or replace function public.pasmu_supervision_solicitar(p_caso_id bigint, p_nota_id bigint)
returns table (id bigint, estado text, creada_en timestamptz, usuario text)
language sql security definer set search_path = public, pg_temp as $$
  insert into public.revisiones_supervision (caso_id, nota_id, estado, comentario, revisada_por)
  values (p_caso_id, p_nota_id, 'pendiente', 'Solicitud de revisión de expediente', private.pasmu_current_persona_id())
  returning id, estado, creada_en,
    (select u.nombre from public.personas u where u.id = revisada_por) as usuario;
$$;

grant execute on function public.pasmu_mis_permisos_pasmu() to authenticated;
grant execute on function public.pasmu_notas_soap_listar_caso(bigint) to authenticated;
grant execute on function public.pasmu_notas_addendum_listar(bigint, int) to authenticated;
grant execute on function public.pasmu_revisiones_listar(bigint) to authenticated;
grant execute on function public.pasmu_supervision_solicitar(bigint, bigint) to authenticated;
commit;
