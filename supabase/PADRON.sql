-- =============================================================
--  PADRÓN: INSCRIPCIÓN EN LOTE CON COLUMNAS
--
--  QUÉ RESUELVE
--  El alta masiva ya existe, pero solo acepta correos sueltos: el
--  lector descarta todo lo que no lleve arroba. Una institución te
--  manda un padrón con nombre, correo, generación y ruta, y hoy hay
--  que tirar tres de esas cuatro columnas y capturarlas a mano
--  después, una por una.
--
--  QUÉ HACE ESTE SCRIPT
--  Nada del alta en sí: las cuentas las sigue creando la función
--  `crear-usuarios-bulk` que ya tienes desplegada. Lo único que
--  falta en la base es permitir que quien administra pueda escribir
--  el NOMBRE de sus alumnos, cosa que hasta ahora solo podía hacer
--  cada quien sobre su propio perfil.
--
--  POR QUÉ SE AÑADE UNA POLÍTICA EN VEZ DE CAMBIAR LA QUE HAY
--  La política de escritura de `perfiles` no se creó en estos
--  scripts —es de antes— y no sé con qué nombre ni con qué
--  condición quedó. Reemplazarla a ciegas podría dejar a tus
--  alumnos sin poder editar su propio perfil. En Postgres, dos
--  políticas permisivas sobre la misma tabla se SUMAN: basta con
--  añadir la nueva y la de siempre sigue funcionando igual.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ORGANIZACIONES_1_BASE.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿ESTA PERSONA ES ALUMNO DE UNA ORGANIZACIÓN QUE ADMINISTRO?
--
--    Distinta de `es_alumno_mio`, que contesta por facilitador.
--    Aquí la pregunta es por organización: el director de la
--    Federación puede corregirle el nombre a su gente, pero no a la
--    de otro cliente.
-- -------------------------------------------------------------
create or replace function public.es_alumno_de_org_que_administro(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.acceso ac
    join public.cursos c on c.id = ac.curso_id
    where ac.usuario_id = p_usuario
      and public.es_admin_de(c.organizacion_id)
  )
$$;

revoke all on function public.es_alumno_de_org_que_administro(uuid) from public;
grant execute on function public.es_alumno_de_org_que_administro(uuid)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) QUIEN ADMINISTRA PUEDE ESCRIBIR EL NOMBRE DE SUS ALUMNOS
--
--    Se suma a la política que ya existe, no la sustituye.
--
--    OJO CON EL ALCANCE: esto deja escribir la FILA entera del
--    perfil, no solo el nombre, porque RLS decide por fila y no por
--    columna. Es aceptable aquí —el perfil son nombre, profesión y
--    foto, datos que el propio alumno enseña— pero no lo extiendas
--    a una tabla donde la fila guarde algo que el administrador no
--    deba tocar. Para ese caso está el patrón del disparador que
--    usamos en el contrato de las organizaciones.
-- -------------------------------------------------------------
drop policy if exists "perfil_update_admin" on public.perfiles;
create policy "perfil_update_admin" on public.perfiles
  for update to authenticated
  using (
    public.es_admin()
    or public.es_alumno_de_org_que_administro(id)
  )
  with check (
    public.es_admin()
    or public.es_alumno_de_org_que_administro(id)
  );

-- Para poder rellenar el nombre de quien todavía no tiene fila de
-- perfil (una cuenta recién creada no siempre la trae).
drop policy if exists "perfil_insert_admin" on public.perfiles;
create policy "perfil_insert_admin" on public.perfiles
  for insert to authenticated
  with check (
    id = auth.uid()
    or public.es_admin()
    or public.es_alumno_de_org_que_administro(id)
  );

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 3) COMPROBACIÓN
-- -------------------------------------------------------------
select 'politicas de escritura en perfiles' as que,
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'perfiles'
      and cmd in ('UPDATE', 'INSERT')) as n
union all
select 'la nueva de admin existe',
  (select case when exists (
     select 1 from pg_policies
     where schemaname = 'public' and tablename = 'perfiles'
       and policyname = 'perfil_update_admin') then 'si' else 'NO' end)
union all
select 'funcion de alcance',
  (select count(*)::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'es_alumno_de_org_que_administro');

-- =============================================================
--  RESULTADO ESPERADO
--  · politicas de escritura en perfiles = 2 o mas
--      (la tuya de siempre, mas las dos nuevas; si sale 2 es que la
--       anterior se llamaba igual que alguna de estas y la
--       reemplazamos: comprueba que tus alumnos siguen pudiendo
--       editar su perfil)
--  · la nueva de admin existe = si
--  · funcion de alcance       = 1
--
--  COMO PROBAR QUE NO ROMPISTE NADA
--  Entra con una cuenta de alumno, ve a su perfil y cambia la
--  profesion. Si guarda, la politica de siempre sigue viva.
-- =============================================================
