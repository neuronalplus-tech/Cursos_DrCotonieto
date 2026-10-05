-- =============================================================
--  SEGURIDAD · Tres huecos encontrados en el diagnóstico de roles
--
--  Ninguno lo introdujeron los roles: estaban desde antes. Salieron
--  al revisar política por política para el rol Facilitador.
--
--  1. Un alumno puede BORRAR sus propios intentos de examen.
--  2. Los cursos inactivos son visibles para cualquier visitante.
--  3. Cualquier alumno puede escribirle a cualquier otro alumno.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente: puedes volver a correrlo sin romper nada.
--
--  Requiere ROLES_2 y ROLES_3 aplicados (usa puede_gestionar_curso).
-- =============================================================

-- -------------------------------------------------------------
-- 1) LOS INTENTOS DE EXAMEN NO SE BORRAN DESDE EL NAVEGADOR
--
--    RLS_EXAMENES.sql ya decía la regla: "Los intentos son parte
--    del historial académico: no se dejan borrar desde el
--    navegador". Pero convivía con una política más antigua,
--    `Usuarios ven e insertan sus intentos`, de tipo ALL.
--
--    ALL incluye DELETE. Y como las políticas permisivas se SUMAN
--    con OR, la vieja ganaba: hoy un alumno que reprueba puede
--    borrar el intento desde la consola del navegador y volver a
--    presentar.
--
--    Se elimina esa política. Las otras tres (select/insert/delete)
--    ya cubren lo que debe poder hacer cada quien, y son explícitas.
-- -------------------------------------------------------------
drop policy if exists "Usuarios ven e insertan sus intentos" on public.intentos_examen;

-- Se rehacen por si acaso, para que el reparto quede completo
-- aunque esta parte se corra sobre una base a medio migrar.
drop policy if exists "intentos_select_own" on public.intentos_examen;
create policy "intentos_select_own" on public.intentos_examen
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

drop policy if exists "intentos_insert_own" on public.intentos_examen;
create policy "intentos_insert_own" on public.intentos_examen
  for insert to authenticated
  with check (usuario_id = auth.uid());

drop policy if exists "intentos_delete_admin" on public.intentos_examen;
create policy "intentos_delete_admin" on public.intentos_examen
  for delete to authenticated
  using (public.es_admin());

-- -------------------------------------------------------------
-- 2) LOS CURSOS INACTIVOS DEJAN DE SER PÚBLICOS
--
--    `cursos` tenía DOS políticas de lectura:
--      · cursos_lectura_publica → activo = true
--      · leer_cursos           → using: true   (!!)
--
--    La segunda anulaba a la primera: cualquier visitante, sin
--    cuenta, podía listar TODOS los cursos, incluidos los que
--    tengas en borrador o despublicados.
--
--    Se dejan en una sola política que sí distingue: el curso
--    activo lo ve cualquiera (la portada lo necesita, también sin
--    sesión), y el inactivo solo quien lo gestiona.
-- -------------------------------------------------------------
drop policy if exists "leer_cursos" on public.cursos;
drop policy if exists "cursos_lectura_publica" on public.cursos;
drop policy if exists "cursos_select" on public.cursos;

create policy "cursos_select" on public.cursos
  for select to anon, authenticated
  using (
    activo = true
    or public.puede_gestionar_curso(id)
  );

-- -------------------------------------------------------------
-- 3) QUIÉN PUEDE ESCRIBIRLE A QUIÉN
--
--    La política de envío solo comprobaba `de_id = auth.uid()`,
--    es decir "no suplantes a otro al firmar". Nada sobre el
--    destinatario: cualquier alumno podía escribirle a cualquier
--    otro alumno sabiendo su id.
--
--    La regla que queremos:
--      · El admin escribe a cualquiera.
--      · Cualquiera puede escribir al admin.
--      · Un alumno escribe a quien FACILITA alguno de sus cursos.
--      · Un facilitador escribe a los inscritos de los cursos que
--        facilita.
--
--    El correo del destinatario se lee de auth.users porque las
--    tablas de roles (`admins`, `facilitadores`) se indexan por
--    correo. Por eso la función es security definer: auth.users no
--    es accesible desde el navegador, y así no hace falta que lo sea.
-- -------------------------------------------------------------
create or replace function public.correo_de(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(u.email) from auth.users u where u.id = p_usuario
$$;

revoke all on function public.correo_de(uuid) from public;
grant execute on function public.correo_de(uuid) to authenticated, service_role;

create or replace function public.puede_escribir_a(p_destino uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.puede_escribir_a(uuid) from public;
grant execute on function public.puede_escribir_a(uuid) to authenticated, service_role;

-- Las políticas de `mensajes` estaban con el rol `public`, que
-- incluye a los visitantes sin cuenta. Se acotan a `authenticated`:
-- sin sesión, auth.uid() es null y no hay nada que leer ni enviar.
drop policy if exists "Enviar mensajes" on public.mensajes;
drop policy if exists "mensajes_insert" on public.mensajes;
create policy "mensajes_insert" on public.mensajes
  for insert to authenticated
  with check (
    de_id = auth.uid()
    and public.puede_escribir_a(para_id)
  );

drop policy if exists "Ver mis mensajes" on public.mensajes;
drop policy if exists "mensajes_select" on public.mensajes;
create policy "mensajes_select" on public.mensajes
  for select to authenticated
  using (de_id = auth.uid() or para_id = auth.uid());

drop policy if exists "Marcar leído" on public.mensajes;
drop policy if exists "mensajes_update" on public.mensajes;
create policy "mensajes_update" on public.mensajes
  for update to authenticated
  using (para_id = auth.uid())
  with check (para_id = auth.uid());

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 4) COMPROBACIÓN
-- -------------------------------------------------------------
select
  'intentos: politicas ALL que quedan' as que,
  count(*) as n,
  '0' as esperado
from pg_policies
where schemaname = 'public' and tablename = 'intentos_examen' and cmd = 'ALL'

union all
select
  'cursos: politicas de lectura',
  count(*),
  '1'
from pg_policies
where schemaname = 'public' and tablename = 'cursos' and cmd = 'SELECT'

union all
select
  'mensajes: politicas con rol public',
  count(*),
  '0'
from pg_policies
where schemaname = 'public' and tablename = 'mensajes'
  and 'public' = any(roles)

union all
select
  'funciones nuevas',
  count(*),
  '2'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('correo_de', 'puede_escribir_a');

-- =============================================================
--  CÓMO COMPROBARLO DE VERDAD
--
--  1. Intentos: entra como alumno, presenta un examen y trata de
--     borrar el intento desde la consola. Debe fallar.
--
--  2. Cursos inactivos: abre tu sitio en una ventana privada (sin
--     sesión). Solo deben aparecer los cursos activos.
--
--  3. Mensajes: desde una cuenta de alumno, intenta enviar un
--     mensaje al id de OTRO alumno. Debe fallar. A ti, no.
--
--  OJO: si la bandeja deja de dejar enviar algo que SÍ debería,
--  dímelo con el mensaje de error: significa que la regla de
--  arriba se quedó corta para un caso real y hay que ampliarla.
-- =============================================================
