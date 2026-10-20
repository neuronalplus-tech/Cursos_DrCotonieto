-- PASMU: vincular la primera cuenta administradora creada en Supabase Auth.
-- El UUID se obtiene de auth.users usando el correo indicado abajo.
-- Ejecutar después de actualizar el esquema, seed y RLS (pasos 07, 05 y 04).
-- No pegues aquí contraseñas ni claves de Supabase.

do $$
declare
  v_email text := 'ernesto_cotonieto@uaeh.edu.mx';
  v_nombre text := 'ERNESTO';
  v_apellidos text := 'COTONIETO MARTINEZ';
  v_auth_user_id uuid;
  v_auth_user_count bigint;
  v_persona_id uuid;
  v_unidad_id bigint;
  v_rol_id bigint;
begin
  if v_email like '%REEMPLAZAR%'
    or v_nombre like '%REEMPLAZAR%'
    or v_apellidos like '%REEMPLAZAR%'
    or btrim(v_email) = ''
    or btrim(v_nombre) = ''
    or btrim(v_apellidos) = '' then
    raise exception 'Reemplaza los valores de ejemplo antes de ejecutar este script.';
  end if;

  select count(*), min(u.id::text)::uuid
  into v_auth_user_count, v_auth_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(v_email));

  if v_auth_user_count = 0 then
    raise exception 'No existe una cuenta Auth con ese correo. Crea/confirma la cuenta en Authentication → Users y vuelve a ejecutar.';
  end if;

  if v_auth_user_count > 1 then
    raise exception 'Hay más de una cuenta Auth con ese correo. Revisa Authentication → Users antes de continuar.';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = v_auth_user_id
      and lower(u.email) = lower(btrim(v_email))
  ) then
    raise exception 'No existe una cuenta Auth con ese UUID y correo. Revisa ambos valores en Authentication → Users.';
  end if;

  select id into v_unidad_id
  from public.unidades
  where codigo = 'UAP' and activo = true;

  select id into v_rol_id
  from public.roles
  where codigo = 'coordinador_pasu' and activo = true;

  if v_unidad_id is null or v_rol_id is null then
    raise exception 'No se encontró la unidad UAP o el rol coordinador_pasu. Ejecuta 05_seed_roles.sql y revisa sus códigos.';
  end if;

  insert into public.personas (auth_user_id, nombre, apellidos, email)
  values (v_auth_user_id, v_nombre, v_apellidos, v_email)
  on conflict (auth_user_id) where auth_user_id is not null
  do update set
    nombre = excluded.nombre,
    apellidos = excluded.apellidos,
    email = excluded.email,
    activo = true,
    updated_at = now()
  returning id into v_persona_id;

  if not exists (
    select 1
    from public.miembros m
    where m.persona_id = v_persona_id
      and m.unidad_id = v_unidad_id
      and m.rol_id = v_rol_id
      and m.programa_id is null
      and m.activo = true
      and m.fecha_inicio <= current_date
      and (m.fecha_fin is null or m.fecha_fin >= current_date)
  ) then
    insert into public.miembros (persona_id, unidad_id, rol_id)
    values (v_persona_id, v_unidad_id, v_rol_id);
  end if;
end
$$;
