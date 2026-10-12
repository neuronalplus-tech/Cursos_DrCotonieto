-- =============================================================
--  ALTA PUBLICA 2 — QUE LAS TANDAS SE VEAN (Y SE INSCRIBA EL TALLER)
--
--  EL SÍNTOMA
--  Alguien se registra por el enlace de un taller gratuito, la
--  cuenta se crea… y en el panel aparece como una fila más «sin
--  curso»: ni se sabe que vino de un taller, ni en qué tanda quedó.
--  Con dos pruebas ya no se distinguen; con doscientas es imposible.
--
--  POR QUÉ PASABA
--  1. La tanda SÍ se calculaba (ALTA_PUBLICA.sql), pero vivía
--     escondida: la única pantalla que la leía era Comunicados ->
--     «por tanda». `listar_usuarios_con_accesos` —la que alimenta
--     Gestión de usuarios— nunca devolvió esa columna, así que el
--     panel no tenía con qué pintarla.
--  2. Un taller gratuito se abre sin fila en `acceso` (CursoView lo
--     deja pasar por ser gratuito). Como el alta pública tampoco
--     creaba esa fila, el autoinscrito quedaba con CERO cursos: no
--     salía al filtrar por el taller, ni en Inscripciones, ni en las
--     métricas. Existía, pero no pertenecía a nada.
--  3. Si por lo que fuera el disparador no llegó a poner la tanda
--     (se registraron antes de instalarlo, o falló), nada la ponía
--     después: no había manera de recuperarlos.
--
--  QUÉ HACE ESTE ARCHIVO
--  · Disparador v2: además de perfil + tanda, inscribe a la persona
--    en el taller del que venía (`curso_id` en la metadata del
--    registro), si ese curso existe, está activo y es gratuito.
--  · `asignar_tandas_faltantes()`: reparte tanda a los autoinscritos
--    que se quedaron sin ella, por orden de alta y continuando la
--    numeración (no reabre tandas ya cerradas de 50). Se ejecuta una
--    vez al instalar y queda disponible por si hiciera falta.
--  · `listar_usuarios_con_accesos` ahora devuelve `tanda`,
--    `autoinscrito` y `alta_el`, que es lo que el panel necesita
--    para marcar la fila y para filtrar «autoinscritos».
--  · `listar_inscritos_gratuitos` ahora incluye también a los que
--    aún no tienen tanda y dice si confirmaron el correo (un alta
--    sin confirmar no recibe nada: conviene verla).
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente: volver a correrlo no duplica inscripciones ni
--  renumera tandas ya asignadas.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Disparador v2: perfil + tanda + inscripción al taller
-- -------------------------------------------------------------
create or replace function public.manejar_alta_publica()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_nombre text;
  v_tanda integer;
  v_curso integer;
begin
  v_nombre := nullif(btrim(new.raw_user_meta_data ->> 'nombre_completo'), '');

  -- Cada paso va en su propio bloque con `exception`. Dos razones:
  --   · Un error sin capturar aquí hace que el signUp entero conteste
  --     «Database error saving new user»: la persona se queda sin
  --     cuenta por no haber podido numerarla. La cuenta vale más.
  --   · Capturar en un bloque deshace SOLO ese bloque. Si estuviera
  --     todo bajo un único `exception`, un fallo al inscribir el
  --     taller borraría también el perfil y la tanda ya calculados.
  begin
    -- `do update` y no `do nothing`: si la fila de perfil ya existiera
    -- (un alta repetida, una migración), conviene rellenar el nombre
    -- en vez de dejarlo en blanco. Nunca pisa uno que ya hubiera:
    -- solo cubre el hueco.
    insert into public.perfiles (id, nombre_completo)
    values (new.id, v_nombre)
    on conflict (id) do update
      set nombre_completo = coalesce(nullif(btrim(perfiles.nombre_completo), ''),
                                     excluded.nombre_completo);
  exception when others then
    raise warning 'manejar_alta_publica/perfil: % (usuario %)', sqlerrm, new.id;
  end;

  if new.raw_user_meta_data ->> 'origen' = 'autoinscripcion' then
    begin
      -- Serializa altas simultáneas: sin este candado, dos registros a
      -- la vez podrían leer el mismo conteo y quedar en la misma tanda
      -- con más de 50 personas.
      perform pg_advisory_xact_lock(hashtext('tanda_inscritos_gratuitos'));
      select (count(*) / 50) + 1 into v_tanda
        from public.perfiles where tanda is not null;
      update public.perfiles set tanda = v_tanda where id = new.id;
    exception when others then
      -- Sin tanda la persona no se pierde: `asignar_tandas_faltantes()`
      -- la recoge después.
      raise warning 'manejar_alta_publica/tanda: % (usuario %)', sqlerrm, new.id;
    end;

    -- El taller del que viene el enlace (/registro?redirigir=/curso/12).
    -- Sin esta fila la persona no aparece inscrita en NADA, que es
    -- justo lo que hacía invisibles a los autoinscritos en el panel.
    -- Solo para cursos gratuitos: un curso de pago no se regala por
    -- manipular la metadata del registro.
    begin
      if new.raw_user_meta_data ->> 'curso_id' ~ '^[0-9]+$' then
        v_curso := (new.raw_user_meta_data ->> 'curso_id')::integer;
        insert into public.acceso (usuario_id, curso_id)
        select new.id, c.id
          from public.cursos c
         where c.id = v_curso
           and coalesce(c.activo, true)
           and coalesce(c.gratuito, false)
           and not exists (
             select 1 from public.acceso a
              where a.usuario_id = new.id and a.curso_id = c.id
           );
      end if;
    exception when others then
      raise warning 'manejar_alta_publica/acceso: % (usuario %)', sqlerrm, new.id;
    end;
  end if;

  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.manejar_alta_publica();

-- -------------------------------------------------------------
-- 2) Reparación: tandas que nunca se asignaron
--
--    Continúa la numeración desde las que ya existen, por orden de
--    alta. Devuelve cuántas repartió, para verlo al correrlo.
-- -------------------------------------------------------------
create or replace function public.asignar_tandas_faltantes()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_ya bigint;
  v_n integer;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is not null and not exists (
    select 1 from public.admins a where a.email = v_email
  ) then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext('tanda_inscritos_gratuitos'));
  select count(*) into v_ya from public.perfiles where tanda is not null;

  with pendientes as (
    select p.id, row_number() over (order by u.created_at, u.id) as rn
      from public.perfiles p
      join auth.users u on u.id = p.id
     where p.tanda is null
       and u.raw_user_meta_data ->> 'origen' = 'autoinscripcion'
  )
  update public.perfiles p
     set tanda = ((v_ya + pendientes.rn - 1) / 50 + 1)::integer
    from pendientes
   where p.id = pendientes.id;

  get diagnostics v_n = row_count;
  return v_n;
end
$$;

revoke all on function public.asignar_tandas_faltantes() from public;
grant execute on function public.asignar_tandas_faltantes() to authenticated;

select public.asignar_tandas_faltantes() as tandas_reparadas;

-- -------------------------------------------------------------
-- 3) Gestión de usuarios: que la tanda llegue al panel
--
--    Cambia el tipo devuelto, así que hay que soltar la función
--    antes (create or replace no puede cambiar la firma de salida).
-- -------------------------------------------------------------
drop function if exists public.listar_usuarios_con_accesos();
create function public.listar_usuarios_con_accesos()
returns table (
  usuario_id uuid,
  email text,
  nombre_completo text,
  profesion text,
  notas_admin text,
  cursos_inscritos bigint,
  ultimo_ingreso timestamp with time zone,
  tanda integer,
  autoinscrito boolean,
  alta_el timestamp with time zone
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  -- Mismo criterio de siempre: desde el navegador se exige admin;
  -- desde el SQL Editor (sin JWT) se deja pasar.
  v_email := auth.jwt() ->> 'email';
  if v_email is not null then
    if not exists (select 1 from public.admins a where a.email = v_email) then
      raise exception 'No autorizado';
    end if;
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.nombre_completo,
      p.profesion,
      p.notas_admin,
      coalesce((select count(*) from public.acceso a where a.usuario_id = u.id), 0)::bigint,
      (select max(pu.ultimo_acceso) from public.progreso_usuario pu where pu.usuario_id = u.id),
      p.tanda,
      -- La tanda es la huella del alta pública; la metadata es la
      -- fuente. Se miran las dos para que una cuenta a la que solo
      -- le quedó la tanda siga contando como autoinscrita.
      (u.raw_user_meta_data ->> 'origen' = 'autoinscripcion' or p.tanda is not null),
      u.created_at
    from auth.users u
    left join public.perfiles p on p.id = u.id
    order by u.email;
end
$$;

revoke all on function public.listar_usuarios_con_accesos() from public;
grant execute on function public.listar_usuarios_con_accesos() to authenticated;

-- -------------------------------------------------------------
-- 4) Listado de autoinscritos: también los que aún no tienen tanda
--    y si confirmaron el correo (sin confirmar no reciben nada).
-- -------------------------------------------------------------
drop function if exists public.listar_inscritos_gratuitos();
create function public.listar_inscritos_gratuitos()
returns table (
  usuario_id uuid,
  email text,
  nombre_completo text,
  tanda integer,
  alta_el timestamp with time zone,
  confirmado boolean,
  cursos_inscritos bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is not null and not exists (
    select 1 from public.admins a where a.email = v_email
  ) then
    raise exception 'No autorizado';
  end if;

  return query
    select u.id, u.email::text, p.nombre_completo, p.tanda, u.created_at,
           u.email_confirmed_at is not null,
           coalesce((select count(*) from public.acceso a where a.usuario_id = u.id), 0)::bigint
      from public.perfiles p
      join auth.users u on u.id = p.id
     where p.tanda is not null
        or u.raw_user_meta_data ->> 'origen' = 'autoinscripcion'
     order by p.tanda nulls last, u.created_at;
end
$$;

revoke all on function public.listar_inscritos_gratuitos() from public;
grant execute on function public.listar_inscritos_gratuitos() to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 5) Comprobación (opcional): quién hay y en qué tanda quedó
-- -------------------------------------------------------------
-- select tanda, count(*) as personas
--   from public.listar_inscritos_gratuitos()
--  group by tanda order by tanda nulls last;
