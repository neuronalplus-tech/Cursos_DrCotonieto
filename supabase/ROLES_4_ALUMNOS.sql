-- =============================================================
--  ROLES · PASO 4  ·  EL FACILITADOR VE A SUS ALUMNOS
--
--  QUÉ PROBLEMA RESUELVE
--  Un facilitador podía gestionar el contenido de su curso pero no
--  sabía quién estaba dentro. Las políticas de `acceso` y
--  `perfiles` solo se abrían al admin, así que no podía ver la
--  lista de inscritos ni, por tanto, escribirles.
--
--  Un facilitador que no puede contactar a su grupo es un rol a
--  medias: puede publicar en el foro y esperar, nada más.
--
--  EL LÍMITE
--  Ve a los inscritos de LOS CURSOS QUE FACILITA, y nada más. No
--  ve el resto de la plataforma, ni los correos de quien no está
--  en sus cursos.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 y ROLES_3 aplicados.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿ESTA PERSONA ESTÁ EN ALGUNO DE MIS CURSOS?
--
--    security definer porque consulta `acceso` y `facilitadores`,
--    y el RLS de esas tablas bloquearía la consulta desde dentro
--    de una política.
-- -------------------------------------------------------------
create or replace function public.es_alumno_mio(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.acceso ac
    join public.facilitadores f on f.curso_id = ac.curso_id
    where ac.usuario_id = p_usuario
      and lower(f.email) = lower(auth.jwt() ->> 'email')
  )
$$;

revoke all on function public.es_alumno_mio(uuid) from public;
grant execute on function public.es_alumno_mio(uuid) to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) INSCRIPCIONES DE LOS CURSOS QUE FACILITA
--
--    Se amplía la lectura de `acceso`: además de las propias, las
--    de los cursos que gestionas. Así la lista de inscritos existe
--    para el facilitador.
--
--    La ESCRITURA no se toca: inscribir y dar de baja siguen
--    siendo del admin. Un facilitador da clase, no gestiona altas.
-- -------------------------------------------------------------
drop policy if exists "acceso_select_propio" on public.acceso;
create policy "acceso_select_propio" on public.acceso
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.puede_gestionar_curso(curso_id)
  );

-- -------------------------------------------------------------
-- 3) PERFILES DE SUS ALUMNOS
--
--    Sin esto la lista sale con ids y sin nombres. Se abre solo a
--    quien está inscrito en un curso que facilitas.
-- -------------------------------------------------------------
drop policy if exists "perfil_select" on public.perfiles;
create policy "perfil_select" on public.perfiles
  for select to authenticated
  using (
    auth.uid() = id
    or public.es_admin()
    or public.es_alumno_mio(id)
  );

-- -------------------------------------------------------------
-- 4) PROGRESO DE SUS ALUMNOS
--
--    Para poder acompañar hace falta ver quién va por dónde. Mismo
--    límite: solo los inscritos en sus cursos.
-- -------------------------------------------------------------
drop policy if exists "progreso_select" on public.progreso_usuario;
create policy "progreso_select" on public.progreso_usuario
  for select to authenticated
  using (
    auth.uid() = usuario_id
    or public.es_admin()
    or public.es_alumno_mio(usuario_id)
  );

-- -------------------------------------------------------------
-- 5) INTENTOS DE EXAMEN DE SUS ALUMNOS
--
--    Un examen que nadie puede revisar no sirve de mucho. El
--    borrado sigue vetado a todos menos al admin (ver SEGURIDAD_1).
-- -------------------------------------------------------------
drop policy if exists "intentos_select_own" on public.intentos_examen;
create policy "intentos_select_own" on public.intentos_examen
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.es_admin()
    or public.es_alumno_mio(usuario_id)
  );

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 6) COMPROBACIÓN
-- -------------------------------------------------------------
select tablename as tabla, policyname as politica
from pg_policies
where schemaname = 'public'
  and qual like '%es_alumno_mio%'
order by tablename;

-- =============================================================
--  RESULTADO ESPERADO
--  Tres politicas: intentos_examen, perfiles y progreso_usuario.
--  (`acceso` usa puede_gestionar_curso, no es_alumno_mio, asi que
--  no sale en esta lista; se comprueba con ROLES_3.)
--
--  CÓMO PROBARLO
--  Entra con la cuenta de facilitador y abre Mensajes: deben
--  aparecer los inscritos de sus cursos, y SOLO esos.
-- =============================================================
