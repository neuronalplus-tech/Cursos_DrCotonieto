-- =============================================================
--  BUSCAR UNA CUENTA POR CORREO (para el alta de usuarios)
--
--  QUÉ RESUELVE
--  La función del servidor que da de alta necesita, cuando el
--  correo ya existe, saber el id de esa cuenta para inscribirla en
--  los cursos. La API de Supabase no tiene "búscame por correo":
--  solo sabe listar usuarios de página en página, lo que con mil
--  cuentas significa recorrerlas todas en cada alta repetida.
--
--  Esta función lo contesta de una vez, con el índice que ya
--  existe sobre el correo.
--
--  POR QUÉ NO LA PUEDE LLAMAR UN USUARIO NORMAL
--  `auth.users` es la tabla de cuentas: correos, fechas y
--  contraseñas cifradas. El permiso de ejecución se le da SOLO a
--  `service_role`, que es la identidad con la que corren las
--  funciones del servidor. Desde el navegador no se puede llamar
--  ni teniendo sesión de administrador, porque el navegador nunca
--  tiene esa clave.
--
--  No devuelve nada sensible: solo el identificador interno.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Córrelo ANTES de desplegar la función
--  `crear-usuarios`.
-- =============================================================

create or replace function public.usuario_id_por_correo(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1
$$;

-- Nadie más. Ni `authenticated`, ni `anon`.
revoke all on function public.usuario_id_por_correo(text) from public;
revoke all on function public.usuario_id_por_correo(text) from anon;
revoke all on function public.usuario_id_por_correo(text) from authenticated;
grant execute on function public.usuario_id_por_correo(text) to service_role;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
--  COMPROBACIÓN
-- -------------------------------------------------------------
select 'la funcion existe' as que,
  (select count(*)::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'usuario_id_por_correo') as valor
union all
select 'quien puede ejecutarla',
  coalesce((select string_agg(distinct grantee, ', ')
    from information_schema.routine_privileges
   where routine_schema = 'public'
     and routine_name = 'usuario_id_por_correo'), 'nadie')
union all
select 'prueba: tu propia cuenta',
  coalesce(public.usuario_id_por_correo('cotonietoe@gmail.com')::text, 'NO ENCONTRADA');

-- =============================================================
--  RESULTADO ESPERADO
--  · la funcion existe        = 1
--  · quien puede ejecutarla   = postgres, service_role
--                               (NO debe aparecer authenticated)
--  · prueba: tu propia cuenta = un identificador largo con guiones
--
--  SIGUIENTE PASO
--  Supabase -> Edge Functions -> Deploy a new function
--    · Nombre EXACTO: crear-usuarios
--    · Pega el contenido de
--      supabase/functions/crear-usuarios/index.ts
--
--  No hay que configurar ninguna clave: SUPABASE_URL y
--  SUPABASE_SERVICE_ROLE_KEY ya existen dentro de las funciones.
--
--  Las funciones viejas (`crear-usuario` y `crear-usuarios-bulk`)
--  pueden quedarse donde estan: la aplicacion deja de llamarlas.
--  Borralas cuando compruebes que el alta nueva funciona, no antes.
-- =============================================================
