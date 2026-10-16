-- =============================================================
--  ROLES 8 — QUITA LA RECURSIÓN EN LAS POLÍTICAS DE ROLES
--
--  QUÉ RESUELVE
--  Al abrir «Permisos por perfil» la base contestaba:
--    infinite recursion detected in policy for relation "roles"
--
--  Por qué: las políticas de ROLES_5 se consultaban unas a otras.
--    · Para ver un ROL, la política de `roles` miraba las
--      ASIGNACIONES (`asignaciones_rol`).
--    · Para ver una ASIGNACIÓN, la política de `asignaciones_rol`
--      miraba los ROLES.
--  Cada consulta disparaba la otra, sin fin, y Postgres lo corta.
--
--  CÓMO SE ARREGLA
--  Dos funciones pequeñas `security definer` que leen esas tablas
--  SIN pasar por sus políticas (igual que ya hacen es_admin_de y
--  tiene_permiso), y las políticas las usan en vez de consultarse
--  entre sí:
--    · org_del_rol(rol)  → la organización de un rol
--    · rol_es_mio(rol)   → ¿tengo asignado este rol?
--
--  QUIÉN VE QUÉ NO CAMBIA
--  Exactamente las mismas reglas que antes:
--    · Roles, sus permisos y sus asignaciones: quien administra la
--      organización (lee y escribe).
--    · Además, cada persona ve los roles que tiene asignados, sus
--      permisos y sus propias asignaciones (solo lectura).
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Requiere ROLES_5_PERMISOS.sql.
-- =============================================================

create or replace function public.org_del_rol(p_rol bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select organizacion_id from public.roles where id = p_rol
$$;

create or replace function public.rol_es_mio(p_rol bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.asignaciones_rol a
     where a.rol_id = p_rol
       and lower(a.email) = lower(auth.jwt() ->> 'email'))
$$;

revoke all on function public.org_del_rol(bigint) from public;
revoke all on function public.rol_es_mio(bigint) from public;
grant execute on function public.org_del_rol(bigint) to authenticated;
grant execute on function public.rol_es_mio(bigint) to authenticated;

-- ROLES ------------------------------------------------------
drop policy if exists "roles_select" on public.roles;
create policy "roles_select" on public.roles
  for select to authenticated
  using (public.es_admin_de(organizacion_id) or public.rol_es_mio(id));

-- (roles_escribir no consultaba otras tablas: se queda igual.)

-- PERMISOS DE CADA ROL --------------------------------------
drop policy if exists "rol_permisos_select" on public.rol_permisos;
create policy "rol_permisos_select" on public.rol_permisos
  for select to authenticated
  using (public.es_admin_de(public.org_del_rol(rol_id)) or public.rol_es_mio(rol_id));

drop policy if exists "rol_permisos_escribir" on public.rol_permisos;
create policy "rol_permisos_escribir" on public.rol_permisos
  for all to authenticated
  using (public.es_admin_de(public.org_del_rol(rol_id)))
  with check (public.es_admin_de(public.org_del_rol(rol_id)));

-- ASIGNACIONES ----------------------------------------------
drop policy if exists "asignaciones_select" on public.asignaciones_rol;
create policy "asignaciones_select" on public.asignaciones_rol
  for select to authenticated
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or public.es_admin_de(public.org_del_rol(rol_id))
  );

drop policy if exists "asignaciones_escribir" on public.asignaciones_rol;
create policy "asignaciones_escribir" on public.asignaciones_rol
  for all to authenticated
  using (public.es_admin_de(public.org_del_rol(rol_id)))
  with check (public.es_admin_de(public.org_del_rol(rol_id)));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA: ya no debe dar error de recursión. Devuelve cuántos
-- roles hay (0 si aún no se crearon; se crean desde el Centro).
-- -------------------------------------------------------------
select count(*) as roles from public.roles;
