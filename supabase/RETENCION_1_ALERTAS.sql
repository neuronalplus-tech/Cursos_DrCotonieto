-- =============================================================
--  RETENCIÓN 1 — QUIÉN ESTÁ POR IRSE (F5-2)
--
--  QUÉ RESUELVE
--  El Tablero dice «cómo va la organización», pero no dice «a
--  quién llamo esta semana». Esta función devuelve una fila por
--  inscripción: alumno, curso, avance, último acceso y días sin
--  tocar nada.
--
--  QUÉ NO HACE
--  No decide el nivel de riesgo (alto/medio/bajo). Eso vive en
--  `src/lib/retencion.js`, para que un cambio de umbral no exija
--  tocar la base. Aquí solo van los hechos.
--
--  SEGURIDAD
--  `security definer` + comprobación `es_admin_de` ANTES de
--  devolver nada. Sin eso, cualquiera pediría la lista de otro
--  cliente.
--
--  TIPOS (trampa conocida de ESTRUCTURA.md)
--  `cursos.id` y `acceso.curso_id` son INTEGER;
--  `organizaciones.id` es BIGINT. Se convierte con `::bigint`
--  explícito o la función falla entera.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Requiere ORGANIZACIONES_1_BASE.
-- =============================================================

create or replace function public.alertas_retencion(p_org bigint)
returns table (
  curso_id       bigint,
  curso_titulo   text,
  usuario_id     uuid,
  nombre         text,
  email          text,
  avance_medio   numeric,
  ultimo_acceso  timestamptz,
  dias_inactivo  int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin_de(p_org) then
    raise exception 'No administras esa organización.' using errcode = '42501';
  end if;

  return query
  with cursos_org as (
    select c.id, c.titulo
      from public.cursos c
     where c.organizacion_id = p_org
  ),
  -- Misma medida de avance que TABLERO_ORG: recursos vistos
  -- sobre recursos que hay, solo módulos activos.
  recursos_curso as (
    select m.curso_id, count(r.id)::numeric as total
      from public.modulos m
      join public.recursos r on r.modulo_id = m.id
     where m.curso_id in (select id from cursos_org)
       and coalesce(m.activo, true)
     group by m.curso_id
  ),
  -- Una fila por persona+curso (si alguien tiene dos filas en
  -- `acceso` para el mismo curso, la llamada es a la persona).
  inscritos as (
    select distinct ac.usuario_id, ac.curso_id
      from public.acceso ac
     where ac.curso_id in (select id from cursos_org)
  )
  select
    co.id::bigint,
    co.titulo::text,
    ins.usuario_id,
    (select p.nombre_completo::text
       from public.perfiles p where p.id = ins.usuario_id),
    (select u.email::text
       from auth.users u where u.id = ins.usuario_id),
    -- Avance 0-100 con un decimal, igual que el tablero:
    -- vistos de ESA persona sobre el total del curso.
    (select round(
       case when coalesce(rc.total, 0) > 0
            then least(1.0,
              count(distinct pu.recurso_id)::numeric / rc.total)
            else 0 end * 100, 1)::numeric
       from recursos_curso rc
       left join public.modulos m on m.curso_id = rc.curso_id
       left join public.recursos r on r.modulo_id = m.id
       left join public.progreso_usuario pu
              on pu.recurso_id = r.id
             and pu.usuario_id = ins.usuario_id
             and pu.completado
      where rc.curso_id = ins.curso_id),
    -- Último movimiento de ESA persona en ESE curso. Null si
    -- nunca marcó nada: el front lo pinta «Sin datos», no como
    -- alerta, para no llenar de ruido los cursos nuevos.
    (select max(pu2.ultimo_acceso)::timestamptz
       from public.progreso_usuario pu2
       join public.recursos r2 on r2.id = pu2.recurso_id
       join public.modulos m2 on m2.id = r2.modulo_id
      where pu2.usuario_id = ins.usuario_id
        and m2.curso_id = ins.curso_id),
    -- Días desde ese último movimiento. Null si nunca hubo.
    (select case when max(pu3.ultimo_acceso) is null then null
            else (extract(epoch
              from (now() - max(pu3.ultimo_acceso))) / 86400)::int
            end
       from public.progreso_usuario pu3
       join public.recursos r3 on r3.id = pu3.recurso_id
       join public.modulos m3 on m3.id = r3.modulo_id
      where pu3.usuario_id = ins.usuario_id
        and m3.curso_id = ins.curso_id)
    from inscritos ins
    join cursos_org co on co.id = ins.curso_id
   order by co.titulo, 8 nulls last, 7 nulls last;
end $$;

revoke all on function public.alertas_retencion(bigint) from public;
grant execute on function public.alertas_retencion(bigint)
  to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   1. Corre ESTADO.sql: la fila 45 debe decir «ya está».
--   2. En el panel -> Tablero aparece «A quién llamar esta
--      semana». Si falta correr este script, esa sección avisa
--      qué falta en vez de romperse.
--   3. Con una cuenta que NO administra la organización, la
--      función niega con «No administras esa organización».
-- -------------------------------------------------------------
select 'alertas_retencion' as funcion,
  (select count(*)::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'alertas_retencion') as existe;
-- RESULTADO ESPERADO: alertas_retencion = 1

