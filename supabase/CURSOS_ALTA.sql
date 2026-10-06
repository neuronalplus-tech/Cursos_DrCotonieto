-- =============================================================
--  CURSOS · Crear desde el panel
--
--  QUÉ PROBLEMA RESUELVE
--  `cursos` solo tenía políticas de SELECT y UPDATE. No había
--  INSERT, así que crear un curso obligaba a entrar a Supabase.
--  Todo lo estructural dependía de una sesión de trabajo contigo
--  en vez de ser una tarea de dos minutos en tu panel.
--
--  POR QUÉ NO SE AÑADE DELETE
--  Un curso no está solo: de él cuelgan módulos, recursos,
--  exámenes, intentos, hilos de foro, inscripciones y progreso.
--  Borrarlo desde el navegador es irreversible y se llevaría por
--  delante el historial académico de quien lo cursó.
--
--  Para retirar un curso ya existe `activo = false`, que la app
--  respeta en todas sus consultas: desaparece de la portada y del
--  catálogo, pero conserva sus datos y se puede reactivar. Eso es
--  archivar, y es lo que se quiere el 99% de las veces.
--
--  Si alguna vez hay que borrar uno de verdad, se hace con SQL,
--  a conciencia y con respaldo. No es una operación de interfaz.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 aplicado.
-- =============================================================

-- -------------------------------------------------------------
-- 1) CREAR CURSOS · solo el admin
--
--    Un facilitador EDITA los cursos que se le asignan (eso lo
--    dio ROLES_3), pero no crea cursos nuevos: eso es decidir el
--    catálogo, y el catálogo es tuyo.
-- -------------------------------------------------------------
drop policy if exists "cursos_insert_admin" on public.cursos;
create policy "cursos_insert_admin" on public.cursos
  for insert to authenticated
  with check (public.es_admin());

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 2) COMPROBACIÓN
-- -------------------------------------------------------------
select cmd as operacion, policyname as politica
from pg_policies
where schemaname = 'public' and tablename = 'cursos'
order by cmd;

-- =============================================================
--  RESULTADO ESPERADO
--  · INSERT  → cursos_insert_admin
--  · SELECT  → cursos_select
--  · UPDATE  → cursos_update_gestion
--
--  Si falta SELECT o UPDATE, corre antes SEGURIDAD_1.sql y
--  ROLES_3_APLICAR.sql.
-- =============================================================
