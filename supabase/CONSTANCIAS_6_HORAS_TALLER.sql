-- ============================================================
-- CONSTANCIAS 6 · horas en constancia de talleres gratuitos
-- ============================================================
-- Aplicar en Supabase SQL Editor después de CONSTANCIAS_5_PERFIL_LIMITE_DESCARGAS.sql
--
-- QUÉ RESUELVE
-- El docente puede definir, por cada taller gratuito con constancia
-- habilitada, si la constancia impresa incluye o no el número de horas.
-- Para eso se añaden dos columnas a `cursos`:
--   · constancia_incluir_horas (boolean, default true)
--         Si se muestra el bloque de horas en la constancia.
--   · constancia_horas (integer, nullable)
--         Número de horas del taller (se imparte). Solo se usa si
--         constancia_incluir_horas = true.
--
-- Estas columnas también son útiles para cursos de pago, pero el
-- toggle se muestra principalmente en la ficha de taller gratuito.
-- ============================================================

alter table public.cursos
  add column if not exists constancia_incluir_horas boolean default true;

alter table public.cursos
  add column if not exists constancia_horas integer;

-- Comentarios para documentar
comment on column public.cursos.constancia_incluir_horas
  is 'Si la constancia del curso muestra el bloque de horas.';
comment on column public.cursos.constancia_horas
  is 'Numero de horas del taller/curso, para imprimir en la constancia.';

notify pgrst, 'reload schema';