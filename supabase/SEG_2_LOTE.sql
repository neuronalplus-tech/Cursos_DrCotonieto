-- =============================================================
--  SEGURIDAD 2 — LOTE DE ARREGLOS PEQUEÑOS
--
--  Tres cosas sueltas, todas de bajo riesgo, en un solo script:
--
--  M1 · Una política permisiva deja a cualquier VISITANTE listar los
--       módulos (títulos, descripciones, orden) de TODOS los cursos de
--       pago de TODAS las organizaciones. Las políticas se suman con
--       OR, así que `modulos_lectura_publica (using activo = true)`
--       anula a `leer_modulos`, que sí distingue gratuito de pago.
--       (El contenido en sí ya está a salvo; esto es la lista de módulos.)
--
--  A6 · Seis funciones SECURITY DEFINER sin `search_path` fijo. Una
--       función definer sin search_path es el escalón que convierte un
--       acceso limitado en ejecución con los privilegios del dueño.
--       Se les fija aquí. (Si alguna ya no existe en tu base, su línea
--       dará error inofensivo: bórrala y vuelve a correr.)
--
--  NOTA sobre RLS_EXAMENES.sql (M4): ese script se renombró a
--  OBSOLETO_RLS_EXAMENES.sql en el repo. NO lo corras: redefine
--  es_admin() sin el filtro de organización (convertiría a todo admin
--  de cliente en admin de plataforma) y reabre la inserción directa de
--  intentos. No hay nada que correr aquí por M4: solo no correr aquello.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente.
-- =============================================================

-- -------------------------------------------------------------
-- M1 · Quitar la lectura pública de la lista de módulos
-- -------------------------------------------------------------
drop policy if exists "modulos_lectura_publica" on public.modulos;
-- Queda actuando `leer_modulos`, que ya permite ver los módulos de un
-- curso gratuito o de uno en el que la persona está inscrita, y oculta
-- el resto. Si tu base la nombró distinto, revisa:
--   select policyname from pg_policies where tablename = 'modulos';

-- -------------------------------------------------------------
-- A6 · Fijar search_path en las funciones SECURITY DEFINER que faltan
--
--   Antes de correr, confirma CUÁLES te faltan de verdad con:
--     select proname from pg_proc p
--       join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and prosecdef
--        and (proconfig is null
--             or not ('search_path=public' = any(proconfig)));
--   y ajusta la lista de abajo a lo que esa consulta devuelva.
-- -------------------------------------------------------------
alter function public.alumnos_de_curso(bigint)                    set search_path = public;
alter function public.bulk_grant_course_access(uuid[], integer)   set search_path = public;
alter function public.bulk_remove_course_access(uuid[], integer)  set search_path = public;
alter function public.get_admin_id()                              set search_path = public;
alter function public.obtener_usuario_por_email(text)             set search_path = public;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   · Sin sesión, pedir módulos de un curso de pago no debe devolver filas.
--   · La consulta de A6 de arriba debe devolver 0 filas tras correr esto.
-- -------------------------------------------------------------
