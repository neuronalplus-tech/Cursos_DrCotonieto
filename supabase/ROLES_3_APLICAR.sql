-- =============================================================
--  ROLES · PASO 3  ·  EL FACILITADOR GESTIONA SU CURSO
--
--  QUÉ AÑADE SOBRE EL PASO 2
--  El paso 2 le dio foro y exámenes. Este le da lo que faltaba
--  para gestionar de verdad un curso:
--    · editar el curso (botones de ruta, textos, disponibilidad)
--    · crear y editar módulos
--    · subir, editar y borrar recursos
--    · VER lo que está oculto o inactivo en sus cursos
--
--  CORRIGE UN FALLO DEL PASO 2
--  El paso 2 dejó al facilitador pudiendo ESCRIBIR en el foro pero
--  no LEERLO: `foro_hilos_select` seguía pidiendo es_admin() o
--  estar inscrito como alumno. Un facilitador no inscrito abría un
--  tema y no lo veía. Aquí se arregla.
--
--  CRITERIO DE TODO EL SCRIPT
--  Donde decía "es_admin()" ahora dice "puede_gestionar_curso(...)",
--  que ya incluye al admin. Nadie pierde acceso; el facilitador
--  gana el suyo, y SOLO en los cursos que le asignaste.
--
--  Requiere haber corrido antes ROLES_2_APLICAR.sql.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente: puedes volver a correrlo sin romper nada.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿A QUÉ CURSO PERTENECE ESTE MÓDULO?
--
--    `recursos` no guarda curso_id: cuelga de un módulo, y el
--    módulo del curso. Esta función hace ese salto para poder
--    preguntarle a puede_gestionar_curso().
--
--    Si el módulo no existe devuelve null, y entonces
--    puede_gestionar_curso(null) solo deja pasar al admin: ante la
--    duda, el facilitador NO entra.
-- -------------------------------------------------------------
create or replace function public.curso_del_modulo(p_modulo bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select m.curso_id from public.modulos m where m.id = p_modulo
$$;

revoke all on function public.curso_del_modulo(bigint) from public;
grant execute on function public.curso_del_modulo(bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) FORO · LECTURA  (corrige el fallo del paso 2)
--
--    Un facilitador no tiene por qué estar inscrito como alumno en
--    el curso que facilita. Sin esto, abre un tema y no lo ve.
-- -------------------------------------------------------------
drop policy if exists "foro_hilos_select" on public.foro_hilos;
create policy "foro_hilos_select" on public.foro_hilos
  for select to authenticated
  using (
    public.puede_gestionar_curso(curso_id)
    or public.tiene_acceso_al_curso(curso_id)
  );

drop policy if exists "foro_respuestas_select" on public.foro_respuestas;
create policy "foro_respuestas_select" on public.foro_respuestas
  for select to authenticated
  using (exists (
    select 1 from public.foro_hilos h
    where h.id = hilo_id
      and (public.puede_gestionar_curso(h.curso_id)
           or public.tiene_acceso_al_curso(h.curso_id))
  ));

-- Responder en su propio curso sin estar inscrito como alumno.
drop policy if exists "foro_respuestas_insert" on public.foro_respuestas;
create policy "foro_respuestas_insert" on public.foro_respuestas
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.foro_hilos h
      where h.id = hilo_id
        and h.cerrado = false
        and (public.puede_gestionar_curso(h.curso_id)
             or public.tiene_acceso_al_curso(h.curso_id))
    )
  );

-- -------------------------------------------------------------
-- 3) CURSOS · EDICIÓN
--
--    Sustituye la política que comprobaba `admins` en línea.
--    OJO: RLS protege FILAS, no columnas. El facilitador podrá
--    cambiar cualquier campo de SU curso, incluido `activo`. Si
--    quieres acotarlo a ciertos campos hace falta un disparador;
--    dilo y lo añadimos.
--
--    La lectura no se toca aquí (ver el aviso del final).
-- -------------------------------------------------------------
drop policy if exists "admins pueden actualizar cursos" on public.cursos;
drop policy if exists "cursos_update_gestion" on public.cursos;
create policy "cursos_update_gestion" on public.cursos
  for update to authenticated
  using (public.puede_gestionar_curso(id))
  with check (public.puede_gestionar_curso(id));

-- -------------------------------------------------------------
-- 4) MÓDULOS · CREAR, EDITAR Y VER LOS OCULTOS
-- -------------------------------------------------------------
drop policy if exists "admins pueden crear modulos" on public.modulos;
drop policy if exists "modulos_insert_gestion" on public.modulos;
create policy "modulos_insert_gestion" on public.modulos
  for insert to authenticated
  with check (public.puede_gestionar_curso(curso_id));

drop policy if exists "Admins pueden actualizar modulos" on public.modulos;
drop policy if exists "modulos_update_gestion" on public.modulos;
create policy "modulos_update_gestion" on public.modulos
  for update to authenticated
  using (public.puede_gestionar_curso(curso_id))
  with check (public.puede_gestionar_curso(curso_id));

-- Ver los módulos inactivos u ocultos de sus cursos. Las políticas
-- de lectura existentes solo muestran los activos o los del curso
-- en el que estás inscrito; sin esta, el facilitador no vería lo
-- que todavía no ha abierto a sus alumnos.
drop policy if exists "modulos_select_gestion" on public.modulos;
create policy "modulos_select_gestion" on public.modulos
  for select to authenticated
  using (public.puede_gestionar_curso(curso_id));

-- -------------------------------------------------------------
-- 5) RECURSOS · SUBIR, EDITAR, BORRAR Y VER LOS NO DISPONIBLES
-- -------------------------------------------------------------
drop policy if exists "recursos_admin_insert" on public.recursos;
drop policy if exists "recursos_insert_gestion" on public.recursos;
create policy "recursos_insert_gestion" on public.recursos
  for insert to authenticated
  with check (public.puede_gestionar_curso(public.curso_del_modulo(modulo_id)));

drop policy if exists "recursos_admin_update" on public.recursos;
drop policy if exists "recursos_update_gestion" on public.recursos;
create policy "recursos_update_gestion" on public.recursos
  for update to authenticated
  using (public.puede_gestionar_curso(public.curso_del_modulo(modulo_id)))
  with check (public.puede_gestionar_curso(public.curso_del_modulo(modulo_id)));

drop policy if exists "recursos_admin_delete" on public.recursos;
drop policy if exists "recursos_delete_gestion" on public.recursos;
create policy "recursos_delete_gestion" on public.recursos
  for delete to authenticated
  using (public.puede_gestionar_curso(public.curso_del_modulo(modulo_id)));

drop policy if exists "recursos_admin_select" on public.recursos;
drop policy if exists "recursos_select_gestion" on public.recursos;
create policy "recursos_select_gestion" on public.recursos
  for select to authenticated
  using (public.puede_gestionar_curso(public.curso_del_modulo(modulo_id)));

-- -------------------------------------------------------------
-- 6) EXÁMENES · VER LOS INACTIVOS DE SUS CURSOS
--
--    La escritura ya la dio el paso 2. Faltaba la lectura: con
--    `activo = true or es_admin()`, un facilitador no podía abrir
--    un examen que aún no ha publicado.
-- -------------------------------------------------------------
drop policy if exists "examenes_select" on public.examenes;
create policy "examenes_select" on public.examenes
  for select to authenticated
  using (
    activo = true
    or public.puede_gestionar_curso(public.curso_del_examen(curso_id, modulo_id))
  );

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 7) COMPROBACIÓN
--
--  Lo de siempre: aquí no hay sesión, así que las funciones de
--  permiso devuelven false. No prueba nada por sí solo.
-- -------------------------------------------------------------
select
  tablename  as tabla,
  cmd        as operacion,
  policyname as politica
from pg_policies
where schemaname = 'public'
  and (qual like '%puede_gestionar_curso%' or with_check like '%puede_gestionar_curso%')
order by tablename, cmd;

-- =============================================================
--  RESULTADO ESPERADO
--  Una lista de ~16 políticas repartidas entre cursos, modulos,
--  recursos, examenes, foro_hilos y foro_respuestas. Si una tabla
--  de contenido NO aparece, el facilitador no podrá tocarla.
--
--  CÓMO PROBARLO DE VERDAD
--  1. Asigna un facilitador a un curso:
--       insert into public.facilitadores (email, curso_id)
--       values ('persona@correo.com', 36);
--  2. Entra con ESA cuenta (no con la tuya) y comprueba que puede
--     abrir un tema en el curso 36 y NO en ningún otro.
--
--  Mientras la interfaz no distinga el rol, esa cuenta no verá los
--  botones de gestión aunque el permiso ya exista. Eso es el
--  siguiente paso, en React.
-- =============================================================
