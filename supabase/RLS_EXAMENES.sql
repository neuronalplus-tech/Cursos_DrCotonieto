-- =============================================================
--  RLS para la tabla `examenes` (y `intentos_examen`)
--
--  PROBLEMA QUE RESUELVE
--  Al crear/editar un examen desde el panel, Supabase responde:
--      new row violates row-level security policy for table "examenes"
--  Porque la tabla tiene RLS activo y NO hay ninguna política que permita
--  INSERT/UPDATE/DELETE. La app usa la clave pública de Supabase desde el
--  navegador, así que CUALQUIER escritura pasa por RLS (y no hay excepción
--  para "admin": RLS no sabe qué es admin, solo ve el JWT).
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run. Es idempotente.
--
--  IMPORTANTE (seguridad):
--  Los permisos se dan SOLO a quienes están en la tabla `admins` (por email),
--  que es la misma fuente que usa la app para mostrar el panel. Un alumno
--  normal no puede crear, editar ni borrar exámenes.
-- =============================================================

-- -------------------------------------------------------------
-- 0) DIAGNÓSTICO — qué políticas hay hoy (solo lectura, no cambia nada)
-- -------------------------------------------------------------
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('examenes', 'intentos_examen', 'admins')
order by tablename, policyname;

-- -------------------------------------------------------------
-- 1) Función auxiliar: ¿este usuario es admin?
--    "security definer" para que la consulta a `admins` no quede
--    bloqueada por el RLS de la propia tabla `admins`.
-- -------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) EXÁMENES
-- -------------------------------------------------------------
alter table public.examenes enable row level security;

-- Lectura: cualquier alumno autenticado puede ver los exámenes activos.
-- (El admin además ve los inactivos, para poder reactivarlos.)
drop policy if exists "examenes_select" on public.examenes;
create policy "examenes_select" on public.examenes
  for select to authenticated
  using (activo = true or public.es_admin());

-- Escritura: solo admins.
drop policy if exists "examenes_insert_admin" on public.examenes;
create policy "examenes_insert_admin" on public.examenes
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "examenes_update_admin" on public.examenes;
create policy "examenes_update_admin" on public.examenes
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "examenes_delete_admin" on public.examenes;
create policy "examenes_delete_admin" on public.examenes
  for delete to authenticated
  using (public.es_admin());

-- -------------------------------------------------------------
-- 3) INTENTOS DE EXAMEN
--    Cada alumno solo ve y escribe los suyos; el admin ve todos.
-- -------------------------------------------------------------
alter table public.intentos_examen enable row level security;

drop policy if exists "intentos_select_own" on public.intentos_examen;
create policy "intentos_select_own" on public.intentos_examen
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

drop policy if exists "intentos_insert_own" on public.intentos_examen;
create policy "intentos_insert_own" on public.intentos_examen
  for insert to authenticated
  with check (usuario_id = auth.uid());

-- Los intentos son parte del historial académico: no se dejan borrar
-- desde el navegador. Solo se borran con SQL (p. ej. al eliminar un examen).
drop policy if exists "intentos_delete_admin" on public.intentos_examen;
create policy "intentos_delete_admin" on public.intentos_examen
  for delete to authenticated
  using (public.es_admin());

-- -------------------------------------------------------------
-- 4) COMPROBACIÓN — debe devolver "true" con tu sesión de admin
-- -------------------------------------------------------------
select public.es_admin() as soy_admin;

-- =============================================================
--  RESULTADO ESPERADO
--  · "soy_admin" = true  (si sale false, tu correo no está en `admins`)
--  · Con eso, el panel → 📝 Exámenes ya puede crear y guardar.
--
--  Si "soy_admin" sale false, agrega tu correo:
--    insert into public.admins (email) values ('TU-CORREO@GMAIL.COM');
-- =============================================================