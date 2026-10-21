-- ============================================================
-- CONSTANCIAS 7 · texto editable por curso (Gestión → Constancia)
-- ============================================================
-- Correr en Supabase SQL Editor. Es seguro repetirlo.
--
-- Incluye las columnas de horas (CONSTANCIAS_6) por si aún no se
-- corrieron, y añade el texto que el docente elige por curso:
--   · constancia_titulo         «CONSTANCIA DE ASISTENCIA», etc.
--   · constancia_texto          «por haber asistido al taller», etc.
--   · constancia_mostrar_nota   imprimir o no la calificación final.
-- Vacío = el texto de siempre («acreditado satisfactoriamente»).
-- ============================================================

alter table public.cursos add column if not exists constancia_incluir_horas boolean default true;
alter table public.cursos add column if not exists constancia_horas integer;
alter table public.cursos add column if not exists constancia_titulo text;
alter table public.cursos add column if not exists constancia_texto text;
alter table public.cursos add column if not exists constancia_mostrar_nota boolean default true;

notify pgrst, 'reload schema';
