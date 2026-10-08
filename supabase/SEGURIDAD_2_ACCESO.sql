-- =============================================================
--  CERRAR UN HUECO ENTRE ORGANIZACIONES
--
--  QUE SE ENCONTRO
--  Las dos politicas que deciden quien puede inscribir y dar de
--  baja (`acceso`) son de las mas antiguas: se escribieron a mano,
--  antes de que existiera el multi-inquilino, y dicen esto:
--
--      exists (select 1 from admins
--               where admins.email = auth.jwt() ->> 'email')
--
--  O sea: "¿esta esta persona en la tabla admins?". Cuando solo
--  habia un administrador —tu— la respuesta era correcta. Desde
--  que una organizacion cliente puede tener el suyo, esa misma
--  condicion la cumple tambien el administrador de la Federacion.
--
--  CONSECUENCIA: el administrador de un cliente podria inscribir o
--  dar de baja alumnos en los cursos de OTRO cliente, o en los
--  tuyos. No es teorico; es lo que esa condicion autoriza.
--
--  POR QUE NO HA PASADO NADA TODAVIA
--  Porque hoy la tabla `admins` solo te tiene a ti. El agujero se
--  abre el dia que des de alta al primer administrador de cliente,
--  asi que conviene cerrarlo ANTES de vender, no despues.
--
--  COMO SE CIERRA
--  Preguntando por la organizacion del curso en vez de por la mera
--  existencia de una fila en `admins`. `es_admin_de` ya contesta
--  eso: cierto para ti en todas, y para el administrador de un
--  cliente solo en la suya.
--
--  POR QUE NO SE USA `puede_gestionar_curso`
--  Porque esa tambien dice que si a los facilitadores, y un
--  facilitador da clase: no inscribe ni da de baja. Esa linea ya
--  estaba decidida en ROLES_4_ALUMNOS.sql y aqui se respeta.
--
--  COMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente.
-- =============================================================

-- -------------------------------------------------------------
-- 1) INSCRIBIR
--
--    Se conserva el nombre original de la politica para no dejar
--    dos haciendo lo mismo: en Postgres las politicas permisivas se
--    SUMAN, asi que crear una nueva sin quitar la vieja no cierra
--    nada. Es el error clasico al endurecer permisos.
-- -------------------------------------------------------------
drop policy if exists "Admins pueden insertar acceso" on public.acceso;
create policy "Admins pueden insertar acceso" on public.acceso
  for insert to authenticated
  with check (
    public.es_admin_de(
      (select c.organizacion_id from public.cursos c where c.id = curso_id)
    )
  );

-- -------------------------------------------------------------
-- 2) DAR DE BAJA
-- -------------------------------------------------------------
drop policy if exists "Admins pueden eliminar acceso" on public.acceso;
create policy "Admins pueden eliminar acceso" on public.acceso
  for delete to authenticated
  using (
    public.es_admin_de(
      (select c.organizacion_id from public.cursos c where c.id = curso_id)
    )
  );

-- -------------------------------------------------------------
-- 3) MODIFICAR UNA INSCRIPCION
--
--    Cambiar la generacion o la ruta de alguien es tan sensible
--    como inscribirlo. Si no habia politica de UPDATE, esta es la
--    primera; si la habia con otro nombre, se suma a ella y habria
--    que revisarla, cosa que avisa la comprobacion del final.
-- -------------------------------------------------------------
drop policy if exists "acceso_update_admin" on public.acceso;
create policy "acceso_update_admin" on public.acceso
  for update to authenticated
  using (
    public.es_admin_de(
      (select c.organizacion_id from public.cursos c where c.id = curso_id)
    )
  )
  with check (
    public.es_admin_de(
      (select c.organizacion_id from public.cursos c where c.id = curso_id)
    )
  );

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 4) COMPROBACION
-- -------------------------------------------------------------
select 'politicas de escritura en acceso' as que,
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'acceso'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')) as valor
union all
select 'de esas, cuantas siguen sin acotar por organizacion',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'acceso'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%FROM admins%'
      and (coalesce(qual, '') || coalesce(with_check, '')) not like '%organizacion%')
union all
select 'otras tablas con el mismo patron',
  (select coalesce(string_agg(distinct tablename, ', '), 'ninguna')
     from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%FROM admins%'
      and (coalesce(qual, '') || coalesce(with_check, '')) not like '%organizacion%');

-- =============================================================
--  RESULTADO ESPERADO
--  · politicas de escritura en acceso            = 3
--  · de esas, sin acotar por organizacion        = 0
--  · otras tablas con el mismo patron            = ninguna
--
--  SI LA SEGUNDA NO ES 0, hay otra politica con el nombre distinto
--  haciendo lo mismo. Las permisivas se suman, asi que una sola que
--  quede abierta anula todo esto. Mandame el nombre y la quitamos.
--
--  QUE PROBAR DESPUES
--  Inscribe y da de baja a alguien desde tu panel. Debe seguir
--  funcionando igual: tu eres administrador de plataforma y
--  `es_admin_de` te dice que si en todas las organizaciones.
--
--  Lo que cambia es lo que NO se ve: el dia que des de alta al
--  administrador de un cliente, ya no podra tocar lo que no es
--  suyo.
-- =============================================================
