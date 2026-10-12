-- =============================================================
--  ALTA PUBLICA DE INSCRITOS GRATUITOS
--
--  OJO: este archivo quedó AMPLIADO por ALTA_PUBLICA_2_TANDAS.sql,
--  que redefine el disparador y las dos funciones de listado (la
--  tanda no se veía en el panel y el autoinscrito quedaba sin
--  curso). Corre los dos, en orden.
--
--  QUÉ RESUELVE
--  Hasta ahora las cuentas solo las creaba el admin desde el panel.
--  Ahora quien llega de un taller gratuito puede darse de alta solo
--  (pantalla /registro). Esto añade las piezas de base que ese flujo
--  necesita:
--
--  1. COLUMNAS NUEVAS
--     · cursos.constancia_gratuita_activa (default false)
--       Un taller gratuito NO emite constancia por el mero hecho de
--       ser gratuito: el docente la habilita con esta casilla cuando
--       el taller ya terminó. Default false = no se promete nada sin
--       que nadie lo decida.
--     · perfiles.tanda (integer, nullable)
--       Grupo de 50 por orden de autoinscripción (inscrito 1-50 ->
--       tanda 1, 51-100 -> tanda 2, ...). Sirve para enviar los
--       comunicados por tandas y no pasar el tope de CCO de una sola
--       vez. Los alumnos que dio de alta el admin NO llevan tanda.
--
--  2. DISPARADOR EN auth.users (manejar_alta_publica)
--     Cada cuenta nueva crea su fila en `perfiles` con el nombre que
--     se dio al registrarse (raw_user_meta_data->>'nombre_completo').
--     Así la constancia sale con el nombre correcto sin depender de
--     que la persona encuentre después dónde cambiar su perfil.
--     Solo quien se registra SOLO (metadata origen='autoinscripcion')
--     recibe tanda; el alta del panel no la lleva.
--
--  3. estado_constancia / preparar_descarga_constancia REDEFINIDAS
--     Antes: un curso gratuito devolvía "no emite constancia" y
--     exigía fila en `acceso` y calificación mínima. Ahora, para un
--     gratuito con constancia_gratuita_activa basta tener cuenta y
--     nombre de perfil; no hay nota ni mínimo (un taller no califica).
--     Los cursos de pago quedan EXACTAMENTE igual.
--
--  4. listar_inscritos_gratuitos()
--     Devuelve los autoinscritos con su tanda, para que el panel de
--     Comunicados pueda filtrar por tanda. Solo admins.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente: volver a correrlo no rompe nada.
--  Después: regenera ESTRUCTURA.md y comprueba con ESTADO.sql.
--
--  OJO
--  El registro público usa signUp de Supabase, que con "Confirm
--  email" activado (tu configuración actual) exige abrir el correo
--  de confirmación antes de entrar. Eso es a propósito: verifica que
--  el correo es de quien dice ser, y la constancia vive ahí.
-- =============================================================

alter table public.cursos
  add column if not exists constancia_gratuita_activa boolean default false;

alter table public.perfiles
  add column if not exists tanda integer;

-- -------------------------------------------------------------
-- 1) Disparador: cada cuenta nueva nace con su perfil
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
begin
  v_nombre := nullif(btrim(new.raw_user_meta_data ->> 'nombre_completo'), '');

  insert into public.perfiles (id, nombre_completo)
  values (new.id, v_nombre)
  on conflict (id) do nothing;

  -- Tandas de 50 SOLO para autoinscripciones. El alta del panel no
  -- la pide, y mezclarla haría que las tandas no sean "los que se
  -- registraron solos por el enlace del taller".
  if new.raw_user_meta_data ->> 'origen' = 'autoinscripcion' then
    -- Serializa altas simultáneas: sin este candado, dos registros a
    -- la vez podrían leer el mismo conteo y quedar en la misma tanda
    -- con más de 50 personas.
    perform pg_advisory_xact_lock(hashtext('tanda_inscritos_gratuitos'));
    select (count(*) / 50) + 1 into v_tanda
      from public.perfiles where tanda is not null;
    update public.perfiles set tanda = v_tanda where id = new.id;
  end if;

  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.manejar_alta_publica();

-- -------------------------------------------------------------
-- 2) Listado de autoinscritos por tanda (solo admins)
--    auth.users no es legible desde el navegador: por eso security
--    definer, igual que listar_usuarios_con_accesos.
-- -------------------------------------------------------------
create or replace function public.listar_inscritos_gratuitos()
returns table (
  usuario_id uuid,
  email text,
  nombre_completo text,
  tanda integer,
  alta_el timestamp with time zone
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
    select u.id, u.email::text, p.nombre_completo, p.tanda, u.created_at
      from public.perfiles p
      join auth.users u on u.id = p.id
     where p.tanda is not null
     order by p.tanda, u.created_at;
end
$$;

revoke all on function public.listar_inscritos_gratuitos() from public;
grant execute on function public.listar_inscritos_gratuitos() to authenticated;

-- -------------------------------------------------------------
-- 3) estado_constancia (redefinición: admite talleres gratuitos)
-- -------------------------------------------------------------
create or replace function public.estado_constancia(p_curso bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_curso public.cursos%rowtype;
  v_folio text;
  v_nombre text;
  v_nombre_perfil text;
  v_nota_guardada numeric(4,2);
  v_minimo_guardado numeric(4,2);
  v_descargas integer := 0;
  v_nota jsonb;
  v_puede boolean := false;
  v_gratuito boolean := false;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;
  v_gratuito := coalesce(v_curso.gratuito, false);

  if v_gratuito then
    -- Un taller gratuito no pide fila en `acceso`: la cuenta basta.
    -- Pero la constancia no se promete hasta que el docente la habilita.
    if not coalesce(v_curso.constancia_gratuita_activa, false) then
      raise exception 'La constancia de este taller aún no está habilitada';
    end if;
  elsif not public.tiene_acceso_al_curso(p_curso) then
    raise exception 'No estás inscrito en este curso';
  end if;

  select c.folio, c.nombre_completo, c.calificacion_final,
         c.minimo_aprobacion, coalesce(c.descargas, 0)
    into v_folio, v_nombre, v_nota_guardada, v_minimo_guardado, v_descargas
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso;

  select p.nombre_completo into v_nombre_perfil
    from public.perfiles p where p.id = v_uid;

  v_nota := public.nota_curso_para_constancia(v_uid, p_curso);

  if v_gratuito then
    -- Sin nota ni mínimo: un taller no califica. Basta la cuenta con
    -- nombre; si falta el nombre, no está disponible todavía.
    v_puede := (v_folio is not null and v_descargas < 2)
            or (v_folio is null and coalesce(btrim(v_nombre_perfil), '') <> '');
  else
    v_puede := (v_folio is not null and v_descargas < 2) or (
      v_folio is null
      and coalesce(v_curso.constancia, true)
      and coalesce((v_nota->>'aprobado')::boolean, false)
    );
  end if;

  return jsonb_build_object(
    'emite', case when v_gratuito
                  then coalesce(v_curso.constancia_gratuita_activa, false)
                  else coalesce(v_curso.constancia, true) end,
    'disponible', v_puede,
    'limiteAlcanzado', v_folio is not null and v_descargas >= 2,
    'descargas', coalesce(v_descargas, 0),
    'descargasRestantes', greatest(0, 2 - coalesce(v_descargas, 0)),
    'folio', v_folio,
    'nombre', case when coalesce(v_descargas, 0) > 0 then v_nombre else v_nombre_perfil end,
    'nota10', case when v_gratuito then null
                   else coalesce(v_nota_guardada, nullif(v_nota->>'nota10', '')::numeric) end,
    'minima10', case when v_gratuito then null
                     else coalesce(v_minimo_guardado, nullif(v_nota->>'minima10', '')::numeric, 7) end,
    'pesoEvaluado', case when v_gratuito then 0
                         else coalesce(nullif(v_nota->>'pesoEvaluado', '')::numeric, 0) end,
    'pendientes', case when v_gratuito then '[]'::jsonb
                       else coalesce(v_nota->'pendientes', '[]'::jsonb) end,
    'alcanzaMinimo', case when v_gratuito then v_puede
                          else coalesce((v_nota->>'alcanzaMinimo')::boolean, false) or v_folio is not null end,
    'aprobado', case when v_gratuito then v_puede
                     else coalesce((v_nota->>'aprobado')::boolean, false) or v_folio is not null end,
    'requisitos', case when v_gratuito then
      jsonb_build_array(jsonb_build_object(
        'titulo', 'Cuenta registrada',
        'cumple', v_puede or v_folio is not null,
        'detalle', 'Se habilita cuando se publica la constancia, al terminar el taller'))
      else
      jsonb_build_array(jsonb_build_object(
        'titulo', 'Calificación mínima',
        'cumple', coalesce((v_nota->>'alcanzaMinimo')::boolean, false) or v_folio is not null,
        'detalle', format('%s/10 · mínimo %s/10',
          coalesce(v_nota_guardada, nullif(v_nota->>'nota10', '')::numeric, 0),
          coalesce(v_minimo_guardado, nullif(v_nota->>'minima10', '')::numeric, 7))))
      end
  );
end
$$;

revoke all on function public.estado_constancia(bigint) from public;
grant execute on function public.estado_constancia(bigint) to authenticated;

-- -------------------------------------------------------------
-- 4) preparar_descarga_constancia (redefinición)
-- -------------------------------------------------------------
create or replace function public.preparar_descarga_constancia(p_curso bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_curso public.cursos%rowtype;
  v_folio text;
  v_nombre text;
  v_nombre_perfil text;
  v_pref text;
  v_nota jsonb;
  v_grado numeric(4,2);
  v_minimo numeric(4,2);
  v_descargas integer := 0;
  v_fecha timestamptz;
  v_existente boolean := false;
  v_gratuito boolean := false;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión'; end if;

  select * into v_curso from public.cursos c where c.id = p_curso;
  if not found then raise exception 'Curso no encontrado'; end if;
  v_gratuito := coalesce(v_curso.gratuito, false);

  if v_gratuito then
    if not coalesce(v_curso.constancia_gratuita_activa, false) then
      raise exception 'La constancia de este taller aún no está habilitada';
    end if;
  else
    if not public.tiene_acceso_al_curso(p_curso) then
      raise exception 'No estás inscrito en este curso';
    end if;
    if not coalesce(v_curso.constancia, true) then
      raise exception 'Este curso no emite constancia';
    end if;
  end if;

  -- Serializa intentos simultáneos del mismo alumno en el mismo curso.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_curso::text, 0));

  select c.folio, c.nombre_completo, c.fecha_emision, c.calificacion_final,
         c.minimo_aprobacion, coalesce(c.descargas, 0)
    into v_folio, v_nombre, v_fecha, v_grado, v_minimo, v_descargas
    from public.constancias c
   where c.usuario_id = v_uid and c.curso_id = p_curso
   for update;
  v_existente := found;

  if v_existente and v_descargas >= 2 then
    raise exception 'Ya utilizaste las 2 descargas permitidas para esta constancia.';
  end if;

  -- Un taller no califica: no se exige completar nada, solo tener
  -- cuenta con nombre (lo pide la rama del insert más abajo).
  if not v_existente and not v_gratuito
     and not public.completo_el_curso(v_uid, p_curso) then
    raise exception 'Aún no alcanzas la calificación mínima del curso';
  end if;

  if not v_gratuito then
    v_nota := public.nota_curso_para_constancia(v_uid, p_curso);
    v_grado := coalesce(v_grado, nullif(v_nota->>'nota10', '')::numeric);
    v_minimo := coalesce(v_minimo, nullif(v_nota->>'minima10', '')::numeric, 7);
  end if;

  if not v_existente or v_descargas = 0 then
    select p.nombre_completo into v_nombre_perfil
      from public.perfiles p where p.id = v_uid;
    if coalesce(btrim(v_nombre_perfil), '') = '' then
      raise exception 'Agrega tu nombre completo en Mi perfil antes de generar la constancia.';
    end if;
  end if;

  if v_existente then
    if v_descargas > 0 and coalesce(btrim(v_nombre), '') = '' then
      raise exception 'No se encontró el nombre guardado en la constancia. Contacta al administrador.';
    end if;
    if v_descargas = 0 then v_nombre := btrim(v_nombre_perfil);
    else v_nombre := btrim(v_nombre);
    end if;

    update public.constancias c
       set nombre_completo = v_nombre,
           profesion = null,
           calificacion_final = coalesce(c.calificacion_final, v_grado),
           minimo_aprobacion = coalesce(c.minimo_aprobacion, v_minimo),
           descargas = c.descargas + 1
     where c.usuario_id = v_uid and c.curso_id = p_curso
     returning c.folio, c.fecha_emision, c.calificacion_final,
              c.minimo_aprobacion, c.descargas
          into v_folio, v_fecha, v_grado, v_minimo, v_descargas;
  else
    select upper(substring(regexp_replace(
             translate(v_curso.titulo, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
             '[^A-Za-z]', '', 'g') from 1 for 3)) into v_pref;
    v_pref := coalesce(nullif(v_pref, ''), 'CUR');

    loop
      v_folio := v_pref || '-' || to_char(now(), 'YYYY') || '-' ||
        upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
      exit when not exists (select 1 from public.constancias c where c.folio = v_folio);
    end loop;

    v_nombre := btrim(v_nombre_perfil);
    insert into public.constancias
      (usuario_id, curso_id, folio, nombre_completo, profesion,
       calificacion_final, minimo_aprobacion, descargas)
    values
      (v_uid, p_curso, v_folio, v_nombre, null, v_grado, v_minimo, 1)
    returning fecha_emision, descargas into v_fecha, v_descargas;
  end if;

  return jsonb_build_object(
    'folio', v_folio,
    'nombre', v_nombre,
    'nota10', v_grado,
    'minima10', v_minimo,
    'fechaEmision', v_fecha,
    'descargas', v_descargas,
    'descargasRestantes', greatest(0, 2 - v_descargas)
  );
end
$$;

revoke all on function public.preparar_descarga_constancia(bigint) from public;
grant execute on function public.preparar_descarga_constancia(bigint) to authenticated;

notify pgrst, 'reload schema';


