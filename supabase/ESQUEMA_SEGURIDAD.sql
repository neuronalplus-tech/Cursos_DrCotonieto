-- =============================================================
--  SEGURIDAD Y LOGICA · generado el 2026-10-08
--
--  QUE ES
--  Todas las funciones, politicas de acceso y disparadores de la
--  base, tal y como estan ahora mismo. Es la segunda mitad del
--  respaldo de estructura: ESQUEMA_BASE.sql pone las tablas,
--  esto pone quien puede hacer que con ellas.
--
--  POR QUE HACE FALTA AUNQUE EXISTAN LOS SCRIPTS NUMERADOS
--  Los scripts de supabase/ crean la mayoria, pero no todas: las
--  politicas mas antiguas se escribieron a mano en el panel y
--  nunca se versionaron. Hasta este archivo, la unica copia de
--  varias de ellas vivia dentro de Supabase.
--
--  ORDEN EN UNA RECUPERACION
--    1. ESQUEMA_BASE.sql   (tablas)
--    2. este archivo       (funciones, politicas, disparadores)
--    3. restaurar los datos
--
--  NO LO EDITES A MANO: se genera leyendo el catalogo.
-- =============================================================

-- -------------------------------------------------------------
--  1) FUNCIONES
--  Van primero: las politicas las usan en sus condiciones.
-- -------------------------------------------------------------

create or replace function public.alumnos_de_curso(p_curso_id bigint)
 RETURNS TABLE(email text, nombre_completo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_email text;
begin
  v_email := auth.jwt() ->> 'email';

  if v_email is not null then
    if not exists (select 1 from admins where admins.email = v_email) then
      raise exception 'No autorizado';
    end if;
  end if;

  return query
    select distinct
      u.email::text,
      coalesce(p.nombre_completo, split_part(u.email, '@', 1))::text as nombre_completo
    from acceso a
    join auth.users u on u.id = a.usuario_id
    left join perfiles p on p.id = a.usuario_id
    where a.curso_id = p_curso_id
    order by 1;
end;
$function$;

create or replace function public.bulk_grant_course_access(user_ids uuid[], target_course_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO acceso (usuario_id, curso_id, grupo, created_at)
    SELECT unnest(user_ids), target_course_id, NULL, NOW()
    ON CONFLICT (usuario_id, curso_id) DO NOTHING;
END;
$function$;

create or replace function public.bulk_remove_course_access(user_ids uuid[], target_course_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    DELETE FROM acceso
    WHERE curso_id = target_course_id
      AND usuario_id = ANY(user_ids);
END;
$function$;

create or replace function public.completo_el_curso(p_usuario uuid, p_curso bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mods   bigint[];
  v_recs   bigint[];
  v_tareas bigint[];
  v_exs    bigint[];
  v_n      integer;
begin
  select coalesce(array_agg(m.id), '{}')
    into v_mods
    from public.modulos m
   where m.curso_id = p_curso and m.disponible is distinct from false;

  -- --- Material ---
  select coalesce(array_agg(r.id), '{}')
    into v_recs
    from public.recursos r
   where r.modulo_id = any(v_mods);

  if array_length(v_recs, 1) > 0 then
    select count(*) into v_n
      from public.progreso_usuario p
     where p.usuario_id = p_usuario
       and p.recurso_id = any(v_recs)
       and p.completado = true;
    if v_n < array_length(v_recs, 1) then return false; end if;
  end if;

  -- --- Entregas: tienen que estar calificadas, no solo subidas ---
  select coalesce(array_agg(t.id), '{}')
    into v_tareas
    from public.tareas t
   where t.activo = true
     and (t.curso_id = p_curso or t.modulo_id = any(v_mods));

  if array_length(v_tareas, 1) > 0 then
    select count(*) into v_n
      from public.entregas e
     where e.usuario_id = p_usuario
       and e.tarea_id = any(v_tareas)
       and e.calificado_en is not null;
    if v_n < array_length(v_tareas, 1) then return false; end if;
  end if;

  -- --- Exámenes: basta un intento aprobado de cada uno ---
  select coalesce(array_agg(x.id), '{}')
    into v_exs
    from public.examenes x
   where x.activo = true
     and (x.curso_id = p_curso or x.modulo_id = any(v_mods));

  if array_length(v_exs, 1) > 0 then
    select count(distinct i.examen_id) into v_n
      from public.intentos_examen i
     where i.usuario_id = p_usuario
       and i.examen_id = any(v_exs)
       and i.aprobado = true;
    if v_n < array_length(v_exs, 1) then return false; end if;
  end if;

  return true;
end
$function$;

create or replace function public.consumo_organizaciones()
 RETURNS TABLE(organizacion_id bigint, alumnos integer, cursos integer, facilitadores integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    o.id,
    (select count(distinct ac.usuario_id)::int
       from public.acceso ac
       join public.cursos c on c.id = ac.curso_id
      where c.organizacion_id = o.id),
    (select count(*)::int
       from public.cursos c
      where c.organizacion_id = o.id),
    (select count(distinct lower(f.email))::int
       from public.facilitadores f
      where exists (select 1 from public.cursos c
                     where c.id = f.curso_id and c.organizacion_id = o.id)
         or exists (select 1 from public.categorias k
                     where k.id = f.categoria_id and k.organizacion_id = o.id))
  from public.organizaciones o
  where public.es_admin_de(o.id)
$function$;

create or replace function public.correo_de(p_usuario uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select lower(u.email) from auth.users u where u.id = p_usuario
$function$;

create or replace function public.curso_de_tarea(p_tarea bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(t.curso_id, m.curso_id)
  from public.tareas t
  left join public.modulos m on m.id = t.modulo_id
  where t.id = p_tarea
$function$;

create or replace function public.curso_del_examen(p_curso bigint, p_modulo bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    p_curso,
    (select m.curso_id from public.modulos m where m.id = p_modulo)
  )
$function$;

create or replace function public.curso_del_modulo(p_modulo bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.curso_id from public.modulos m where m.id = p_modulo
$function$;

create or replace function public.duplicar_curso(p_curso bigint, p_titulo text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_fila        jsonb;
  v_nuevo_curso bigint;
  v_nuevo_mod   bigint;
  v_titulo      text;
  r             record;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede duplicar cursos';
  end if;

  select c.titulo into v_titulo from public.cursos c where c.id = p_curso;
  if v_titulo is null then
    raise exception 'El curso % no existe', p_curso;
  end if;
  v_titulo := coalesce(nullif(btrim(p_titulo), ''), v_titulo || ' (copia)');

  -- --- El curso ---
  select to_jsonb(c) into v_fila from public.cursos c where c.id = p_curso;
  v_nuevo_curso := nextval(pg_get_serial_sequence('public.cursos', 'id'));
  v_fila := v_fila || jsonb_build_object(
    'id', v_nuevo_curso,
    'titulo', v_titulo,
    'activo', false
  );
  insert into public.cursos select * from jsonb_populate_record(null::public.cursos, v_fila);

  -- --- Sus módulos, y dentro de cada uno sus recursos ---
  for r in select * from public.modulos where curso_id = p_curso order by orden loop
    v_fila := to_jsonb(r);
    v_nuevo_mod := nextval(pg_get_serial_sequence('public.modulos', 'id'));
    v_fila := v_fila || jsonb_build_object('id', v_nuevo_mod, 'curso_id', v_nuevo_curso);
    insert into public.modulos select * from jsonb_populate_record(null::public.modulos, v_fila);

    insert into public.recursos
    select nuevo.*
    from public.recursos rec
    cross join lateral jsonb_populate_record(
      null::public.recursos,
      to_jsonb(rec) || jsonb_build_object(
        'id', nextval(pg_get_serial_sequence('public.recursos', 'id')),
        'modulo_id', v_nuevo_mod
      )
    ) as nuevo
    where rec.modulo_id = r.id;

    -- Exámenes colgados de ESTE módulo.
    insert into public.examenes
    select nuevo.*
    from public.examenes ex
    cross join lateral jsonb_populate_record(
      null::public.examenes,
      to_jsonb(ex) || jsonb_build_object(
        'id', nextval(pg_get_serial_sequence('public.examenes', 'id')),
        'modulo_id', v_nuevo_mod
      )
    ) as nuevo
    where ex.modulo_id = r.id;
  end loop;

  -- --- Exámenes del curso (los que no cuelgan de un módulo) ---
  insert into public.examenes
  select nuevo.*
  from public.examenes ex
  cross join lateral jsonb_populate_record(
    null::public.examenes,
    to_jsonb(ex) || jsonb_build_object(
      'id', nextval(pg_get_serial_sequence('public.examenes', 'id')),
      'curso_id', v_nuevo_curso
    )
  ) as nuevo
  where ex.curso_id = p_curso and ex.modulo_id is null;

  return v_nuevo_curso;
end
$function$;

create or replace function public.emitir_constancia(p_curso bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_folio  text;
  v_nombre text;
  v_prof   text;
  v_pref   text;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select c.folio into v_folio
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;
  if v_folio is not null then
    return v_folio;
  end if;

  if not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  if not public.completo_el_curso(v_uid, p_curso) then
    raise exception 'Todavía no cumples los requisitos del curso';
  end if;

  select p.nombre_completo, p.profesion into v_nombre, v_prof
    from public.perfiles p where p.id = v_uid;

  if coalesce(btrim(v_nombre), '') = '' then
    raise exception 'Completa tu nombre en el perfil antes de emitir';
  end if;

  -- Prefijo legible del curso + año + azar. El azar sale de la
  -- base y no del navegador: así nadie elige su propio folio.
  select upper(substring(regexp_replace(
           translate(cu.titulo, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
           '[^A-Za-z]', '', 'g') from 1 for 3))
    into v_pref
    from public.cursos cu where cu.id = p_curso;
  v_pref := coalesce(nullif(v_pref, ''), 'CUR');

  v_folio := v_pref || '-' || to_char(now(), 'YYYY') || '-' ||
             upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 6));

  insert into public.constancias
    (usuario_id, curso_id, folio, nombre_completo, profesion)
  values
    (v_uid, p_curso, v_folio, btrim(v_nombre), nullif(btrim(coalesce(v_prof, '')), ''));

  return v_folio;
end
$function$;

create or replace function public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
      and a.organizacion_id is null
  )
$function$;

create or replace function public.es_admin_de(p_org bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.es_admin() or exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
      and a.organizacion_id = p_org
  )
$function$;

create or replace function public.es_alumno_de_org_que_administro(p_usuario uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.acceso ac
    join public.cursos c on c.id = ac.curso_id
    where ac.usuario_id = p_usuario
      and public.es_admin_de(c.organizacion_id)
  )
$function$;

create or replace function public.es_alumno_mio(p_usuario uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.acceso ac
    where ac.usuario_id = p_usuario
      and public.puede_gestionar_curso(ac.curso_id)
  )
$function$;

create or replace function public.es_facilitador()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.facilitadores f
    where lower(f.email) = lower(auth.jwt() ->> 'email')
  )
$function$;

create or replace function public.es_facilitador_de_org(p_org bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.facilitadores f
    where lower(f.email) = lower(auth.jwt() ->> 'email')
      and (
        exists (select 1 from public.cursos c
                 where c.id = f.curso_id and c.organizacion_id = p_org)
        or exists (select 1 from public.categorias k
                 where k.id = f.categoria_id and k.organizacion_id = p_org)
      )
  )
$function$;

create or replace function public.get_admin_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT u.id
  FROM auth.users u
  JOIN admins a ON a.email = u.email
  LIMIT 1;
$function$;

create or replace function public.inscritos_en_generacion(p_gen bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer from public.acceso a where a.generacion_id = p_gen
$function$;

create or replace function public.limites_organizacion(p_org bigint)
 RETURNS TABLE(max_alumnos integer, max_facilitadores integer, max_cursos integer, exenta boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    coalesce(o.max_alumnos,       p.max_alumnos),
    coalesce(o.max_facilitadores, p.max_facilitadores),
    coalesce(o.max_cursos,        p.max_cursos),
    o.exenta_de_limites or o.plan_id is null
  from public.organizaciones o
  left join public.planes p on p.id = o.plan_id
  where o.id = p_org
$function$;

create or replace function public.listar_usuarios_con_accesos()
 RETURNS TABLE(usuario_id uuid, email text, nombre_completo text, profesion text, notas_admin text, cursos_inscritos bigint, ultimo_ingreso timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_email text;
begin
  -- Obtener el email del JWT (null si se llama desde el SQL Editor)
  v_email := auth.jwt() ->> 'email';

  -- Si hay email (llamada desde el navegador), verificar admin
  -- Si es null (SQL Editor / service role), permitir
  if v_email is not null then
    if not exists (
      select 1 from admins where admins.email = v_email
    ) then
      raise exception 'No autorizado';
    end if;
  end if;

  return query
    select
      u.id as usuario_id,
      u.email::text,
      p.nombre_completo,
      p.profesion,
      p.notas_admin,
      coalesce(
        (select count(*) from acceso a where a.usuario_id = u.id),
        0
      )::bigint as cursos_inscritos,
      (
        select max(pu.ultimo_acceso)
        from progreso_usuario pu
        where pu.usuario_id = u.id
      ) as ultimo_ingreso
    from auth.users u
    left join perfiles p on p.id = u.id
    order by u.email;
end;
$function$;

create or replace function public.mover_hilo_al_responder()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.foro_hilos
     set actualizado_en = now()
   where id = NEW.hilo_id;
  return NEW;
end
$function$;

create or replace function public.obtener_usuario_por_email(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE email = lower(trim(p_email))
  LIMIT 1;
  RETURN v_id;
END;
$function$;

create or replace function public.promedio_foro(p_hilo bigint, p_usuario uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select round(avg(r.calificacion), 2)
  from public.foro_respuestas r
  where r.hilo_id = p_hilo
    and r.autor_id = p_usuario
    and r.borrada = false
    and r.calificacion is not null
$function$;

create or replace function public.proteger_calificacion_foro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_curso bigint;
begin
  -- Si no se tocan esas columnas, no hay nada que vigilar.
  if NEW.calificacion is not distinct from OLD.calificacion
     and NEW.calificado_por is not distinct from OLD.calificado_por
     and NEW.calificado_en is not distinct from OLD.calificado_en then
    return NEW;
  end if;

  select h.curso_id into v_curso
  from public.foro_hilos h where h.id = NEW.hilo_id;

  if not public.puede_gestionar_curso(v_curso) then
    raise exception 'Solo quien gestiona el curso puede calificar aportaciones';
  end if;

  return NEW;
end
$function$;

create or replace function public.proteger_contrato_organizacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.es_admin() then return new; end if;

  if new.plan_id            is distinct from old.plan_id
  or new.estado_suscripcion is distinct from old.estado_suscripcion
  or new.periodo            is distinct from old.periodo
  or new.precio_acordado    is distinct from old.precio_acordado
  or new.vence_en           is distinct from old.vence_en
  or new.max_alumnos        is distinct from old.max_alumnos
  or new.max_cursos         is distinct from old.max_cursos
  or new.max_facilitadores  is distinct from old.max_facilitadores
  or new.exenta_de_limites  is distinct from old.exenta_de_limites
  or new.notas_comerciales  is distinct from old.notas_comerciales
  or new.slug               is distinct from old.slug
  or new.dominio            is distinct from old.dominio
  or new.activa             is distinct from old.activa
  then
    raise exception
      'El plan y la dirección de la organización los administra la plataforma. Puedes editar tu nombre, tu logo, tus colores y tu correo de contacto.'
      using errcode = '42501';
  end if;

  return new;
end $function$;

create or replace function public.puede_escribir_a(p_destino uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    -- Escribirte a ti mismo (borradores, notas) no se bloquea.
    p_destino = auth.uid()

    -- El admin escribe a cualquiera.
    or public.es_admin()

    -- Cualquiera puede escribir al admin: es el canal de soporte.
    or exists (
      select 1 from public.admins a
      where lower(a.email) = public.correo_de(p_destino)
    )

    -- Un alumno escribe a quien facilita alguno de SUS cursos.
    or exists (
      select 1
      from public.facilitadores f
      join public.acceso ac on ac.curso_id = f.curso_id
      where ac.usuario_id = auth.uid()
        and lower(f.email) = public.correo_de(p_destino)
    )

    -- Un facilitador escribe a los inscritos de los cursos que facilita.
    or exists (
      select 1
      from public.facilitadores f
      join public.acceso ac on ac.curso_id = f.curso_id
      where ac.usuario_id = p_destino
        and lower(f.email) = lower(auth.jwt() ->> 'email')
    )
$function$;

create or replace function public.puede_gestionar_curso(p_curso bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.es_admin_de((select c.organizacion_id from public.cursos c where c.id = p_curso))
    or exists (
      select 1
      from public.facilitadores f
      where lower(f.email) = lower(auth.jwt() ->> 'email')
        and (
          f.curso_id = p_curso
          or (
            f.categoria_id is not null
            and f.categoria_id = (select c.categoria_id from public.cursos c where c.id = p_curso)
          )
        )
    )
$function$;

create or replace function public.registrar_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_antes   jsonb;
  v_despues jsonb;
  v_cambios text[];
  v_id      text;
begin
  if TG_OP = 'DELETE' then
    v_antes := to_jsonb(OLD);
    v_id    := v_antes ->> 'id';

  elsif TG_OP = 'INSERT' then
    v_despues := to_jsonb(NEW);
    v_id      := v_despues ->> 'id';

  else
    v_antes   := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    v_id      := v_despues ->> 'id';

    select array_agg(e.key)
      into v_cambios
      from jsonb_each(v_despues) e
     where v_antes -> e.key is distinct from v_despues -> e.key;

    -- Un UPDATE que no cambia nada no es noticia. Sin esto la
    -- bitácora se llenaría de ruido: la app reescribe filas
    -- enteras aunque solo toques una casilla.
    if v_cambios is null then
      return NEW;
    end if;
  end if;

  insert into public.auditoria
    (tabla, registro_id, operacion, autor_id, autor_email, antes, despues, cambios)
  values
    (TG_TABLE_NAME, v_id, TG_OP, auth.uid(),
     lower(auth.jwt() ->> 'email'), v_antes, v_despues, v_cambios);

  return coalesce(NEW, OLD);
end
$function$;

create or replace function public.registrar_pago(p_org bigint, p_monto numeric, p_meses integer, p_metodo text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_nota text DEFAULT NULL::text)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_desde date;
  v_hasta date;
begin
  if not public.es_admin() then
    raise exception 'Solo la plataforma registra pagos.' using errcode = '42501';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 36 then
    raise exception 'Los meses tienen que estar entre 1 y 36.' using errcode = 'check_violation';
  end if;
  if p_monto is null or p_monto < 0 then
    raise exception 'El monto no puede ser negativo.' using errcode = 'check_violation';
  end if;

  select greatest(coalesce(o.vence_en, current_date), current_date)
    into v_desde
    from public.organizaciones o
   where o.id = p_org
     for update;

  if not found then
    raise exception 'No existe esa organización.' using errcode = 'no_data_found';
  end if;

  v_hasta := (v_desde + (p_meses || ' months')::interval)::date;

  insert into public.pagos_suscripcion
    (organizacion_id, monto, pagado_en, periodo_desde, periodo_hasta,
     metodo, referencia, nota, registrado_por)
  values
    (p_org, p_monto, current_date, v_desde, v_hasta,
     nullif(trim(coalesce(p_metodo, '')), ''),
     nullif(trim(coalesce(p_referencia, '')), ''),
     nullif(trim(coalesce(p_nota, '')), ''),
     lower(auth.jwt() ->> 'email'));

  -- Cobrar reactiva. Un cliente suspendido que paga vuelve a estar
  -- activo sin que tengas que acordarte de cambiarle el estado.
  update public.organizaciones
     set vence_en = v_hasta,
         estado_suscripcion = 'activa'
   where id = p_org;

  return v_hasta;
end $function$;

create or replace function public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

create or replace function public.tablero_cursos(p_org bigint)
 RETURNS TABLE(curso_id bigint, titulo text, alumnos integer, avance_medio numeric, terminados integer, por_calificar integer, constancias integer, ultima_actividad timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.es_admin_de(p_org) then
    raise exception 'No administras esa organización.' using errcode = '42501';
  end if;

  return query
  with cursos_org as (
    select c.id, c.titulo from public.cursos c where c.organizacion_id = p_org
  ),
  recursos_curso as (
    select m.curso_id, count(r.id)::numeric as total
    from public.modulos m
    join public.recursos r on r.modulo_id = m.id
    where m.curso_id in (select id from cursos_org)
      and coalesce(m.activo, true)
    group by m.curso_id
  ),
  avance_inscripcion as (
    select
      ac.curso_id,
      ac.usuario_id,
      case when rc.total > 0
           then least(1.0, count(distinct pu.recurso_id)::numeric / rc.total)
           else 0 end as fraccion
    from public.acceso ac
    left join recursos_curso rc on rc.curso_id = ac.curso_id
    left join public.modulos m on m.curso_id = ac.curso_id
    left join public.recursos r on r.modulo_id = m.id
    left join public.progreso_usuario pu
           on pu.recurso_id = r.id
          and pu.usuario_id = ac.usuario_id
          and pu.completado
    where ac.curso_id in (select id from cursos_org)
    group by ac.curso_id, ac.usuario_id, rc.total
  )
  -- Cada columna se convierte al tipo declarado de forma explicita.
  -- PL/pgSQL compara los tipos uno a uno y no convierte nada por su
  -- cuenta: basta con que `titulo` sea varchar y no text para que la
  -- funcion entera falle con "structure of query does not match
  -- function result type", sin decir cual columna.
  select
    co.id::bigint,
    co.titulo::text,
    (select count(distinct ac.usuario_id)::int from public.acceso ac
      where ac.curso_id = co.id),
    (select round(coalesce(avg(ai.fraccion), 0) * 100, 1)::numeric
       from avance_inscripcion ai where ai.curso_id = co.id),
    (select count(*)::int from avance_inscripcion ai
      where ai.curso_id = co.id and ai.fraccion >= 1),
    (select count(*)::int
       from public.entregas e
       join public.tareas t on t.id = e.tarea_id
      where e.calificado_en is null
        and (t.curso_id = co.id
          or exists (select 1 from public.modulos m
                      where m.id = t.modulo_id and m.curso_id = co.id))),
    (select count(*)::int from public.constancias c2 where c2.curso_id = co.id),
    (select max(pu.ultimo_acceso)::timestamptz
       from public.progreso_usuario pu
       join public.recursos r on r.id = pu.recurso_id
       join public.modulos m on m.id = r.modulo_id
      where m.curso_id = co.id)
  from cursos_org co
  order by co.titulo;
end $function$;

create or replace function public.tablero_organizacion(p_org bigint)
 RETURNS TABLE(alumnos integer, alumnos_activos integer, inscripciones integer, cursos integer, facilitadores integer, generaciones integer, por_calificar integer, constancias integer, avance_medio numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.es_admin_de(p_org) then
    raise exception 'No administras esa organización.' using errcode = '42501';
  end if;

  return query
  with cursos_org as (
    select c.id from public.cursos c where c.organizacion_id = p_org
  ),
  -- Recursos que cuentan para el avance de cada curso.
  recursos_curso as (
    select m.curso_id, count(r.id)::numeric as total
    from public.modulos m
    join public.recursos r on r.modulo_id = m.id
    where m.curso_id in (select id from cursos_org)
      and coalesce(m.activo, true)
    group by m.curso_id
  ),
  -- Avance de cada inscripción: lo visto sobre lo que hay.
  avance_inscripcion as (
    select
      ac.usuario_id,
      ac.curso_id,
      case when rc.total > 0
           then least(1.0, count(distinct pu.recurso_id)::numeric / rc.total)
           else null end as fraccion
    from public.acceso ac
    join recursos_curso rc on rc.curso_id = ac.curso_id
    left join public.modulos m on m.curso_id = ac.curso_id
    left join public.recursos r on r.modulo_id = m.id
    left join public.progreso_usuario pu
           on pu.recurso_id = r.id
          and pu.usuario_id = ac.usuario_id
          and pu.completado
    where ac.curso_id in (select id from cursos_org)
    group by ac.usuario_id, ac.curso_id, rc.total
  )
  select
    (select count(distinct ac.usuario_id)::int from public.acceso ac
      where ac.curso_id in (select id from cursos_org)),

    (select count(distinct pu.usuario_id)::int
       from public.progreso_usuario pu
       join public.recursos r on r.id = pu.recurso_id
       join public.modulos m on m.id = r.modulo_id
      where m.curso_id in (select id from cursos_org)
        and pu.ultimo_acceso > now() - interval '30 days'),

    (select count(*)::int from public.acceso ac
      where ac.curso_id in (select id from cursos_org)),

    (select count(*)::int from cursos_org),

    (select count(distinct lower(f.email))::int
       from public.facilitadores f
      where f.curso_id in (select id from cursos_org)
         or exists (select 1 from public.categorias k
                     where k.id = f.categoria_id and k.organizacion_id = p_org)),

    (select count(*)::int from public.generaciones g
      where g.curso_id in (select id from cursos_org)),

    (select count(*)::int
       from public.entregas e
       join public.tareas t on t.id = e.tarea_id
      where e.calificado_en is null
        and (t.curso_id in (select id from cursos_org)
          or exists (select 1 from public.modulos m
                      where m.id = t.modulo_id
                        and m.curso_id in (select id from cursos_org)))),

    (select count(*)::int from public.constancias co
      where co.curso_id in (select id from cursos_org)),

    (select round(coalesce(avg(fraccion), 0) * 100, 1)::numeric
       from avance_inscripcion);
end $function$;

create or replace function public.tiene_acceso_al_curso(p_curso bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.acceso a
    where a.usuario_id = auth.uid() and a.curso_id = p_curso
  )
$function$;

create or replace function public.tocar_banco_pregunta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.actualizado_en := now();
  return new;
end $function$;

create or replace function public.usuario_id_por_correo(p_email text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1
$function$;

create or replace function public.validar_rama_foro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hilo_padre bigint;
begin
  if NEW.responde_a is null then
    return NEW;
  end if;

  if NEW.responde_a = NEW.id then
    raise exception 'Una respuesta no puede responderse a sí misma';
  end if;

  select r.hilo_id into v_hilo_padre
  from public.foro_respuestas r where r.id = NEW.responde_a;

  if v_hilo_padre is null then
    raise exception 'La respuesta a la que contestas ya no existe';
  end if;

  if v_hilo_padre <> NEW.hilo_id then
    raise exception 'No se puede responder a una aportación de otro tema';
  end if;

  return NEW;
end
$function$;

create or replace function public.verificar_constancia(p_folio text)
 RETURNS TABLE(folio text, nombre_completo text, profesion text, curso_titulo text, fecha_emision timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.folio, c.nombre_completo, c.profesion, cu.titulo, c.fecha_emision
  from public.constancias c
  join public.cursos cu on cu.id = c.curso_id
  where c.folio = upper(trim(p_folio)) or c.folio = trim(p_folio)
  limit 1
$function$;

create or replace function public.verificar_limite_alumnos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org    bigint;
  v_max    int;
  v_exenta boolean;
  v_actual int;
begin
  select c.organizacion_id into v_org
    from public.cursos c where c.id = new.curso_id;
  if v_org is null then return new; end if;

  select l.max_alumnos, l.exenta into v_max, v_exenta
    from public.limites_organizacion(v_org) l;
  if v_exenta or v_max is null then return new; end if;

  -- Si ya es alumno de esta organización en otro curso, no suma:
  -- el tope cuenta personas.
  if exists (
    select 1 from public.acceso ac
    join public.cursos c on c.id = ac.curso_id
    where c.organizacion_id = v_org and ac.usuario_id = new.usuario_id
  ) then return new; end if;

  select count(distinct ac.usuario_id) into v_actual
    from public.acceso ac
    join public.cursos c on c.id = ac.curso_id
   where c.organizacion_id = v_org;

  if v_actual >= v_max then
    raise exception
      'Esta organización llegó a su tope de % alumnos. Amplía el plan para inscribir a más personas.',
      v_max using errcode = 'check_violation';
  end if;

  return new;
end $function$;

create or replace function public.verificar_limite_cursos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_max    int;
  v_exenta boolean;
  v_actual int;
begin
  if new.organizacion_id is null then return new; end if;

  select l.max_cursos, l.exenta into v_max, v_exenta
    from public.limites_organizacion(new.organizacion_id) l;
  if v_exenta or v_max is null then return new; end if;

  select count(*) into v_actual
    from public.cursos where organizacion_id = new.organizacion_id;

  if v_actual >= v_max then
    raise exception
      'Esta organización llegó a su tope de % cursos. Amplía el plan para crear más.',
      v_max using errcode = 'check_violation';
  end if;

  return new;
end $function$;

create or replace function public.verificar_limite_facilitadores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org    bigint;
  v_max    int;
  v_exenta boolean;
  v_actual int;
begin
  -- La fila es de un curso O de una categoría, nunca de las dos
  -- (lo impone facilitadores_destino_check).
  if new.curso_id is not null then
    select c.organizacion_id into v_org from public.cursos c where c.id = new.curso_id;
  else
    select k.organizacion_id into v_org from public.categorias k where k.id = new.categoria_id;
  end if;
  if v_org is null then return new; end if;

  select l.max_facilitadores, l.exenta into v_max, v_exenta
    from public.limites_organizacion(v_org) l;
  if v_exenta or v_max is null then return new; end if;

  -- Mismo criterio que con los alumnos: cuentan personas. Quien ya
  -- facilita un curso del cliente no vuelve a contar al asignarle
  -- otro.
  if exists (
    select 1 from public.facilitadores f
    where lower(f.email) = lower(new.email)
      and (exists (select 1 from public.cursos c
                    where c.id = f.curso_id and c.organizacion_id = v_org)
        or exists (select 1 from public.categorias k
                    where k.id = f.categoria_id and k.organizacion_id = v_org))
  ) then return new; end if;

  select count(distinct lower(f.email)) into v_actual
    from public.facilitadores f
   where exists (select 1 from public.cursos c
                  where c.id = f.curso_id and c.organizacion_id = v_org)
      or exists (select 1 from public.categorias k
                  where k.id = f.categoria_id and k.organizacion_id = v_org);

  if v_actual >= v_max then
    raise exception
      'Esta organización llegó a su tope de % facilitadores. Amplía el plan para asignar más.',
      v_max using errcode = 'check_violation';
  end if;

  return new;
end $function$;

-- -------------------------------------------------------------
--  2) PROTECCION DE FILAS
-- -------------------------------------------------------------
alter table public.acceso enable row level security;
alter table public.admins enable row level security;
alter table public.auditoria enable row level security;
alter table public.banco_preguntas enable row level security;
alter table public.categorias enable row level security;
alter table public.constancias enable row level security;
alter table public.cursos enable row level security;
alter table public.entregas enable row level security;
alter table public.examenes enable row level security;
alter table public.facilitadores enable row level security;
alter table public.foro_hilos enable row level security;
alter table public.foro_respuestas enable row level security;
alter table public.generaciones enable row level security;
alter table public.intentos_examen enable row level security;
alter table public.leads_talleres enable row level security;
alter table public.mensajes enable row level security;
alter table public.modulos enable row level security;
alter table public.organizaciones enable row level security;
alter table public.pagos_suscripcion enable row level security;
alter table public.perfiles enable row level security;
alter table public.planes enable row level security;
alter table public.progreso_usuario enable row level security;
alter table public.recursos enable row level security;
alter table public.rubrica_criterios enable row level security;
alter table public.tareas enable row level security;

-- -------------------------------------------------------------
--  3) POLITICAS
--  Cada una se borra y se vuelve a crear: una politica no tiene
--  nada colgando, asi que aqui reemplazar si es seguro.
-- -------------------------------------------------------------

-- acceso
drop policy if exists "Admins pueden eliminar acceso" on public.acceso;
create policy "Admins pueden eliminar acceso" on public.acceso
  as permissive
  for delete
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.email = (auth.jwt() ->> 'email'::text)))));
drop policy if exists "Admins pueden insertar acceso" on public.acceso;
create policy "Admins pueden insertar acceso" on public.acceso
  as permissive
  for insert
  to authenticated
  with check ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.email = (auth.jwt() ->> 'email'::text)))));
drop policy if exists "acceso_select_propio" on public.acceso;
create policy "acceso_select_propio" on public.acceso
  as permissive
  for select
  to authenticated
  using (((usuario_id = auth.uid()) OR puede_gestionar_curso((curso_id)::bigint)));

-- admins
drop policy if exists "admin_ver_propio" on public.admins;
create policy "admin_ver_propio" on public.admins
  as permissive
  for select
  to authenticated
  using ((email = (auth.jwt() ->> 'email'::text)));

-- auditoria
drop policy if exists "auditoria_select_admin" on public.auditoria;
create policy "auditoria_select_admin" on public.auditoria
  as permissive
  for select
  to authenticated
  using (es_admin());

-- banco_preguntas
drop policy if exists "banco_delete" on public.banco_preguntas;
create policy "banco_delete" on public.banco_preguntas
  as permissive
  for delete
  to authenticated
  using ((es_admin_de(organizacion_id) OR (lower(creado_por) = lower((auth.jwt() ->> 'email'::text)))));
drop policy if exists "banco_insert" on public.banco_preguntas;
create policy "banco_insert" on public.banco_preguntas
  as permissive
  for insert
  to authenticated
  with check ((es_admin_de(organizacion_id) OR es_facilitador_de_org(organizacion_id)));
drop policy if exists "banco_select" on public.banco_preguntas;
create policy "banco_select" on public.banco_preguntas
  as permissive
  for select
  to authenticated
  using ((es_admin_de(organizacion_id) OR es_facilitador_de_org(organizacion_id)));
drop policy if exists "banco_update" on public.banco_preguntas;
create policy "banco_update" on public.banco_preguntas
  as permissive
  for update
  to authenticated
  using ((es_admin_de(organizacion_id) OR (lower(creado_por) = lower((auth.jwt() ->> 'email'::text)))))
  with check ((es_admin_de(organizacion_id) OR (lower(creado_por) = lower((auth.jwt() ->> 'email'::text)))));

-- categorias
drop policy if exists "categorias_delete_admin" on public.categorias;
create policy "categorias_delete_admin" on public.categorias
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "categorias_insert_admin" on public.categorias;
create policy "categorias_insert_admin" on public.categorias
  as permissive
  for insert
  to authenticated
  with check (es_admin());
drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias
  as permissive
  for select
  to anon, authenticated
  using (true);
drop policy if exists "categorias_update_admin" on public.categorias;
create policy "categorias_update_admin" on public.categorias
  as permissive
  for update
  to authenticated
  using (es_admin())
  with check (es_admin());

-- constancias
drop policy if exists "constancias_delete_admin" on public.constancias;
create policy "constancias_delete_admin" on public.constancias
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "constancias_select" on public.constancias;
create policy "constancias_select" on public.constancias
  as permissive
  for select
  to authenticated
  using (((usuario_id = auth.uid()) OR es_admin()));

-- cursos
drop policy if exists "cursos_insert_admin" on public.cursos;
create policy "cursos_insert_admin" on public.cursos
  as permissive
  for insert
  to authenticated
  with check (es_admin_de(organizacion_id));
drop policy if exists "cursos_select" on public.cursos;
create policy "cursos_select" on public.cursos
  as permissive
  for select
  to anon, authenticated
  using (((activo = true) OR puede_gestionar_curso((id)::bigint)));
drop policy if exists "cursos_update_gestion" on public.cursos;
create policy "cursos_update_gestion" on public.cursos
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso((id)::bigint))
  with check (puede_gestionar_curso((id)::bigint));

-- entregas
drop policy if exists "entregas_delete" on public.entregas;
create policy "entregas_delete" on public.entregas
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso(curso_de_tarea(tarea_id)));
drop policy if exists "entregas_insert" on public.entregas;
create policy "entregas_insert" on public.entregas
  as permissive
  for insert
  to authenticated
  with check (((usuario_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM tareas t
  WHERE ((t.id = entregas.tarea_id) AND (t.activo = true) AND tiene_acceso_al_curso(curso_de_tarea(t.id)))))));
drop policy if exists "entregas_select" on public.entregas;
create policy "entregas_select" on public.entregas
  as permissive
  for select
  to authenticated
  using (((usuario_id = auth.uid()) OR puede_gestionar_curso(curso_de_tarea(tarea_id))));
drop policy if exists "entregas_update" on public.entregas;
create policy "entregas_update" on public.entregas
  as permissive
  for update
  to authenticated
  using ((((usuario_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM tareas t
  WHERE ((t.id = entregas.tarea_id) AND (t.activo = true) AND (t.permite_reentrega = true))))) OR puede_gestionar_curso(curso_de_tarea(tarea_id))));

-- examenes
drop policy if exists "Exámenes visibles para autenticados" on public.examenes;
create policy "Exámenes visibles para autenticados" on public.examenes
  as permissive
  for select
  to authenticated
  using ((activo = true));
drop policy if exists "examenes_delete_admin" on public.examenes;
create policy "examenes_delete_admin" on public.examenes
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso(curso_del_examen(curso_id, modulo_id)));
drop policy if exists "examenes_insert_admin" on public.examenes;
create policy "examenes_insert_admin" on public.examenes
  as permissive
  for insert
  to authenticated
  with check (puede_gestionar_curso(curso_del_examen(curso_id, modulo_id)));
drop policy if exists "examenes_select" on public.examenes;
create policy "examenes_select" on public.examenes
  as permissive
  for select
  to authenticated
  using (((activo = true) OR puede_gestionar_curso(curso_del_examen(curso_id, modulo_id))));
drop policy if exists "examenes_update_admin" on public.examenes;
create policy "examenes_update_admin" on public.examenes
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso(curso_del_examen(curso_id, modulo_id)))
  with check (puede_gestionar_curso(curso_del_examen(curso_id, modulo_id)));

-- facilitadores
drop policy if exists "facilitadores_delete_admin" on public.facilitadores;
create policy "facilitadores_delete_admin" on public.facilitadores
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "facilitadores_insert_admin" on public.facilitadores;
create policy "facilitadores_insert_admin" on public.facilitadores
  as permissive
  for insert
  to authenticated
  with check (es_admin());
drop policy if exists "facilitadores_select" on public.facilitadores;
create policy "facilitadores_select" on public.facilitadores
  as permissive
  for select
  to authenticated
  using ((es_admin() OR (lower(email) = lower((auth.jwt() ->> 'email'::text)))));
drop policy if exists "facilitadores_update_admin" on public.facilitadores;
create policy "facilitadores_update_admin" on public.facilitadores
  as permissive
  for update
  to authenticated
  using (es_admin())
  with check (es_admin());

-- foro_hilos
drop policy if exists "foro_hilos_delete_admin" on public.foro_hilos;
create policy "foro_hilos_delete_admin" on public.foro_hilos
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso(curso_id));
drop policy if exists "foro_hilos_insert_admin" on public.foro_hilos;
create policy "foro_hilos_insert_admin" on public.foro_hilos
  as permissive
  for insert
  to authenticated
  with check (puede_gestionar_curso(curso_id));
drop policy if exists "foro_hilos_select" on public.foro_hilos;
create policy "foro_hilos_select" on public.foro_hilos
  as permissive
  for select
  to authenticated
  using ((puede_gestionar_curso(curso_id) OR tiene_acceso_al_curso(curso_id)));
drop policy if exists "foro_hilos_update_admin" on public.foro_hilos;
create policy "foro_hilos_update_admin" on public.foro_hilos
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso(curso_id))
  with check (puede_gestionar_curso(curso_id));

-- foro_respuestas
drop policy if exists "foro_respuestas_delete" on public.foro_respuestas;
create policy "foro_respuestas_delete" on public.foro_respuestas
  as permissive
  for delete
  to authenticated
  using (((autor_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM foro_hilos h
  WHERE ((h.id = foro_respuestas.hilo_id) AND puede_gestionar_curso(h.curso_id))))));
drop policy if exists "foro_respuestas_insert" on public.foro_respuestas;
create policy "foro_respuestas_insert" on public.foro_respuestas
  as permissive
  for insert
  to authenticated
  with check (((autor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM foro_hilos h
  WHERE ((h.id = foro_respuestas.hilo_id) AND (h.cerrado = false) AND (puede_gestionar_curso(h.curso_id) OR tiene_acceso_al_curso(h.curso_id)))))));
drop policy if exists "foro_respuestas_select" on public.foro_respuestas;
create policy "foro_respuestas_select" on public.foro_respuestas
  as permissive
  for select
  to authenticated
  using ((EXISTS ( SELECT 1
   FROM foro_hilos h
  WHERE ((h.id = foro_respuestas.hilo_id) AND (puede_gestionar_curso(h.curso_id) OR tiene_acceso_al_curso(h.curso_id))))));
drop policy if exists "foro_respuestas_update" on public.foro_respuestas;
create policy "foro_respuestas_update" on public.foro_respuestas
  as permissive
  for update
  to authenticated
  using (((autor_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM foro_hilos h
  WHERE ((h.id = foro_respuestas.hilo_id) AND puede_gestionar_curso(h.curso_id))))));

-- generaciones
drop policy if exists "generaciones_delete" on public.generaciones;
create policy "generaciones_delete" on public.generaciones
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso(curso_id));
drop policy if exists "generaciones_insert" on public.generaciones;
create policy "generaciones_insert" on public.generaciones
  as permissive
  for insert
  to authenticated
  with check (puede_gestionar_curso(curso_id));
drop policy if exists "generaciones_select" on public.generaciones;
create policy "generaciones_select" on public.generaciones
  as permissive
  for select
  to authenticated
  using ((puede_gestionar_curso(curso_id) OR tiene_acceso_al_curso(curso_id)));
drop policy if exists "generaciones_update" on public.generaciones;
create policy "generaciones_update" on public.generaciones
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso(curso_id))
  with check (puede_gestionar_curso(curso_id));

-- intentos_examen
drop policy if exists "intentos_delete_admin" on public.intentos_examen;
create policy "intentos_delete_admin" on public.intentos_examen
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "intentos_insert_own" on public.intentos_examen;
create policy "intentos_insert_own" on public.intentos_examen
  as permissive
  for insert
  to authenticated
  with check ((usuario_id = auth.uid()));
drop policy if exists "intentos_select_own" on public.intentos_examen;
create policy "intentos_select_own" on public.intentos_examen
  as permissive
  for select
  to authenticated
  using (((usuario_id = auth.uid()) OR es_admin() OR es_alumno_mio(usuario_id)));

-- leads_talleres
drop policy if exists "cualquiera inserta su lead" on public.leads_talleres;
create policy "cualquiera inserta su lead" on public.leads_talleres
  as permissive
  for insert
  to anon, authenticated
  with check (true);
drop policy if exists "solo admin lee leads" on public.leads_talleres;
create policy "solo admin lee leads" on public.leads_talleres
  as permissive
  for select
  to authenticated
  using (es_admin());

-- mensajes
drop policy if exists "mensajes_insert" on public.mensajes;
create policy "mensajes_insert" on public.mensajes
  as permissive
  for insert
  to authenticated
  with check (((de_id = auth.uid()) AND puede_escribir_a(para_id)));
drop policy if exists "mensajes_select" on public.mensajes;
create policy "mensajes_select" on public.mensajes
  as permissive
  for select
  to authenticated
  using (((de_id = auth.uid()) OR (para_id = auth.uid())));
drop policy if exists "mensajes_update" on public.mensajes;
create policy "mensajes_update" on public.mensajes
  as permissive
  for update
  to authenticated
  using ((para_id = auth.uid()))
  with check ((para_id = auth.uid()));

-- modulos
drop policy if exists "leer_modulos" on public.modulos;
create policy "leer_modulos" on public.modulos
  as permissive
  for select
  to anon, authenticated
  using (((EXISTS ( SELECT 1
   FROM cursos c
  WHERE ((c.id = modulos.curso_id) AND (c.gratuito = true)))) OR (EXISTS ( SELECT 1
   FROM acceso a
  WHERE ((a.usuario_id = auth.uid()) AND (a.curso_id = modulos.curso_id))))));
drop policy if exists "modulos_delete_gestion" on public.modulos;
create policy "modulos_delete_gestion" on public.modulos
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso((curso_id)::bigint));
drop policy if exists "modulos_insert_gestion" on public.modulos;
create policy "modulos_insert_gestion" on public.modulos
  as permissive
  for insert
  to authenticated
  with check (puede_gestionar_curso((curso_id)::bigint));
drop policy if exists "modulos_lectura_publica" on public.modulos;
create policy "modulos_lectura_publica" on public.modulos
  as permissive
  for select
  to public
  using ((activo = true));
drop policy if exists "modulos_select_gestion" on public.modulos;
create policy "modulos_select_gestion" on public.modulos
  as permissive
  for select
  to authenticated
  using (puede_gestionar_curso((curso_id)::bigint));
drop policy if exists "modulos_update_gestion" on public.modulos;
create policy "modulos_update_gestion" on public.modulos
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso((curso_id)::bigint))
  with check (puede_gestionar_curso((curso_id)::bigint));

-- organizaciones
drop policy if exists "organizaciones_delete" on public.organizaciones;
create policy "organizaciones_delete" on public.organizaciones
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "organizaciones_insert" on public.organizaciones;
create policy "organizaciones_insert" on public.organizaciones
  as permissive
  for insert
  to authenticated
  with check (es_admin());
drop policy if exists "organizaciones_select" on public.organizaciones;
create policy "organizaciones_select" on public.organizaciones
  as permissive
  for select
  to anon, authenticated
  using (true);
drop policy if exists "organizaciones_update" on public.organizaciones;
create policy "organizaciones_update" on public.organizaciones
  as permissive
  for update
  to authenticated
  using (es_admin_de(id))
  with check (es_admin_de(id));

-- pagos_suscripcion
drop policy if exists "pagos_delete" on public.pagos_suscripcion;
create policy "pagos_delete" on public.pagos_suscripcion
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "pagos_select" on public.pagos_suscripcion;
create policy "pagos_select" on public.pagos_suscripcion
  as permissive
  for select
  to authenticated
  using (es_admin_de(organizacion_id));

-- perfiles
drop policy if exists "perfil_insert" on public.perfiles;
create policy "perfil_insert" on public.perfiles
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() = id));
drop policy if exists "perfil_insert_admin" on public.perfiles;
create policy "perfil_insert_admin" on public.perfiles
  as permissive
  for insert
  to authenticated
  with check (((id = auth.uid()) OR es_admin() OR es_alumno_de_org_que_administro(id)));
drop policy if exists "perfil_select" on public.perfiles;
create policy "perfil_select" on public.perfiles
  as permissive
  for select
  to authenticated
  using (((auth.uid() = id) OR es_admin() OR es_alumno_mio(id)));
drop policy if exists "perfil_update" on public.perfiles;
create policy "perfil_update" on public.perfiles
  as permissive
  for update
  to authenticated
  using ((auth.uid() = id))
  with check ((auth.uid() = id));
drop policy if exists "perfil_update_admin" on public.perfiles;
create policy "perfil_update_admin" on public.perfiles
  as permissive
  for update
  to authenticated
  using ((es_admin() OR es_alumno_de_org_que_administro(id)))
  with check ((es_admin() OR es_alumno_de_org_que_administro(id)));

-- planes
drop policy if exists "planes_delete" on public.planes;
create policy "planes_delete" on public.planes
  as permissive
  for delete
  to authenticated
  using (es_admin());
drop policy if exists "planes_insert" on public.planes;
create policy "planes_insert" on public.planes
  as permissive
  for insert
  to authenticated
  with check (es_admin());
drop policy if exists "planes_select" on public.planes;
create policy "planes_select" on public.planes
  as permissive
  for select
  to anon, authenticated
  using (true);
drop policy if exists "planes_update" on public.planes;
create policy "planes_update" on public.planes
  as permissive
  for update
  to authenticated
  using (es_admin())
  with check (es_admin());

-- progreso_usuario
drop policy if exists "progreso_insert" on public.progreso_usuario;
create policy "progreso_insert" on public.progreso_usuario
  as permissive
  for insert
  to authenticated
  with check ((auth.uid() = usuario_id));
drop policy if exists "progreso_select" on public.progreso_usuario;
create policy "progreso_select" on public.progreso_usuario
  as permissive
  for select
  to authenticated
  using (((auth.uid() = usuario_id) OR es_admin() OR es_alumno_mio(usuario_id)));
drop policy if exists "progreso_update" on public.progreso_usuario;
create policy "progreso_update" on public.progreso_usuario
  as permissive
  for update
  to authenticated
  using ((auth.uid() = usuario_id))
  with check ((auth.uid() = usuario_id));

-- recursos
drop policy if exists "leer_recursos" on public.recursos;
create policy "leer_recursos" on public.recursos
  as permissive
  for select
  to anon, authenticated
  using (((EXISTS ( SELECT 1
   FROM (modulos m
     JOIN cursos c ON ((c.id = m.curso_id)))
  WHERE ((m.id = recursos.modulo_id) AND (c.gratuito = true)))) OR (EXISTS ( SELECT 1
   FROM (acceso a
     JOIN modulos m ON ((m.id = recursos.modulo_id)))
  WHERE ((a.usuario_id = auth.uid()) AND (a.curso_id = m.curso_id))))));
drop policy if exists "recursos_delete_gestion" on public.recursos;
create policy "recursos_delete_gestion" on public.recursos
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso(curso_del_modulo((modulo_id)::bigint)));
drop policy if exists "recursos_insert_gestion" on public.recursos;
create policy "recursos_insert_gestion" on public.recursos
  as permissive
  for insert
  to authenticated
  with check (puede_gestionar_curso(curso_del_modulo((modulo_id)::bigint)));
drop policy if exists "recursos_select_gestion" on public.recursos;
create policy "recursos_select_gestion" on public.recursos
  as permissive
  for select
  to authenticated
  using (puede_gestionar_curso(curso_del_modulo((modulo_id)::bigint)));
drop policy if exists "recursos_update_gestion" on public.recursos;
create policy "recursos_update_gestion" on public.recursos
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso(curso_del_modulo((modulo_id)::bigint)))
  with check (puede_gestionar_curso(curso_del_modulo((modulo_id)::bigint)));

-- rubrica_criterios
drop policy if exists "rubrica_escribir" on public.rubrica_criterios;
create policy "rubrica_escribir" on public.rubrica_criterios
  as permissive
  for all
  to authenticated
  using (puede_gestionar_curso(curso_de_tarea(tarea_id)))
  with check (puede_gestionar_curso(curso_de_tarea(tarea_id)));
drop policy if exists "rubrica_select" on public.rubrica_criterios;
create policy "rubrica_select" on public.rubrica_criterios
  as permissive
  for select
  to authenticated
  using ((puede_gestionar_curso(curso_de_tarea(tarea_id)) OR tiene_acceso_al_curso(curso_de_tarea(tarea_id))));

-- tareas
drop policy if exists "tareas_delete" on public.tareas;
create policy "tareas_delete" on public.tareas
  as permissive
  for delete
  to authenticated
  using (puede_gestionar_curso(curso_de_tarea(id)));
drop policy if exists "tareas_insert" on public.tareas;
create policy "tareas_insert" on public.tareas
  as permissive
  for insert
  to authenticated
  with check (puede_gestionar_curso(COALESCE(curso_id, curso_del_modulo(modulo_id))));
drop policy if exists "tareas_select" on public.tareas;
create policy "tareas_select" on public.tareas
  as permissive
  for select
  to authenticated
  using ((puede_gestionar_curso(curso_de_tarea(id)) OR ((activo = true) AND tiene_acceso_al_curso(curso_de_tarea(id)))));
drop policy if exists "tareas_update" on public.tareas;
create policy "tareas_update" on public.tareas
  as permissive
  for update
  to authenticated
  using (puede_gestionar_curso(curso_de_tarea(id)))
  with check (puede_gestionar_curso(COALESCE(curso_id, curso_del_modulo(modulo_id))));

-- -------------------------------------------------------------
--  4) DISPARADORES
-- -------------------------------------------------------------
drop trigger if exists acceso_limite_alumnos on public.acceso;
create trigger acceso_limite_alumnos BEFORE INSERT ON public.acceso FOR EACH ROW EXECUTE FUNCTION verificar_limite_alumnos();
drop trigger if exists auditar_acceso on public.acceso;
create trigger auditar_acceso AFTER INSERT OR DELETE OR UPDATE ON public.acceso FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists banco_preguntas_tocar on public.banco_preguntas;
create trigger banco_preguntas_tocar BEFORE UPDATE ON public.banco_preguntas FOR EACH ROW EXECUTE FUNCTION tocar_banco_pregunta();
drop trigger if exists auditar_categorias on public.categorias;
create trigger auditar_categorias AFTER INSERT OR DELETE OR UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists auditar_constancias on public.constancias;
create trigger auditar_constancias AFTER INSERT OR DELETE OR UPDATE ON public.constancias FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists auditar_cursos on public.cursos;
create trigger auditar_cursos AFTER INSERT OR DELETE OR UPDATE ON public.cursos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists cursos_limite on public.cursos;
create trigger cursos_limite BEFORE INSERT ON public.cursos FOR EACH ROW EXECUTE FUNCTION verificar_limite_cursos();
drop trigger if exists auditar_examenes on public.examenes;
create trigger auditar_examenes AFTER INSERT OR DELETE OR UPDATE ON public.examenes FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists auditar_facilitadores on public.facilitadores;
create trigger auditar_facilitadores AFTER INSERT OR DELETE OR UPDATE ON public.facilitadores FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists facilitadores_limite on public.facilitadores;
create trigger facilitadores_limite BEFORE INSERT ON public.facilitadores FOR EACH ROW EXECUTE FUNCTION verificar_limite_facilitadores();
drop trigger if exists auditar_foro_hilos on public.foro_hilos;
create trigger auditar_foro_hilos AFTER INSERT OR DELETE OR UPDATE ON public.foro_hilos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists mover_hilo on public.foro_respuestas;
create trigger mover_hilo AFTER INSERT ON public.foro_respuestas FOR EACH ROW EXECUTE FUNCTION mover_hilo_al_responder();
drop trigger if exists proteger_calificacion on public.foro_respuestas;
create trigger proteger_calificacion BEFORE UPDATE ON public.foro_respuestas FOR EACH ROW EXECUTE FUNCTION proteger_calificacion_foro();
drop trigger if exists validar_rama on public.foro_respuestas;
create trigger validar_rama BEFORE INSERT OR UPDATE ON public.foro_respuestas FOR EACH ROW EXECUTE FUNCTION validar_rama_foro();
drop trigger if exists auditar_generaciones on public.generaciones;
create trigger auditar_generaciones AFTER INSERT OR DELETE OR UPDATE ON public.generaciones FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists auditar_modulos on public.modulos;
create trigger auditar_modulos AFTER INSERT OR DELETE OR UPDATE ON public.modulos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists organizaciones_protege_contrato on public.organizaciones;
create trigger organizaciones_protege_contrato BEFORE UPDATE ON public.organizaciones FOR EACH ROW EXECUTE FUNCTION proteger_contrato_organizacion();
drop trigger if exists auditar_recursos on public.recursos;
create trigger auditar_recursos AFTER INSERT OR DELETE OR UPDATE ON public.recursos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists auditar_rubrica_criterios on public.rubrica_criterios;
create trigger auditar_rubrica_criterios AFTER INSERT OR DELETE OR UPDATE ON public.rubrica_criterios FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
drop trigger if exists auditar_tareas on public.tareas;
create trigger auditar_tareas AFTER INSERT OR DELETE OR UPDATE ON public.tareas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

notify pgrst, 'reload schema';

-- =============================================================
--  COMPROBACION
-- =============================================================
select 'funciones' as que, count(*)::text as n from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
union all
select 'politicas', count(*)::text from pg_policies where schemaname='public'
union all
select 'disparadores', count(*)::text from pg_trigger t
  join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal;

-- Esperado: funciones 41 · politicas 86 · disparadores 20
