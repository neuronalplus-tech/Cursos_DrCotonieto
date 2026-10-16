-- =============================================================
--  ESTRUCTURA 1 — CATEGORÍA DE CADA MATERIAL
--
--  QUÉ RESUELVE
--  Un recurso solo decía su FORMATO (pdf, video, enlace…). El
--  alumno no busca «el PDF»: busca la lectura, la grabación o la
--  actividad. Esta columna guarda PARA QUÉ sirve cada material, y
--  la página del módulo los agrupa en secciones fijas:
--
--    lectura      Materiales de lectura
--    grabacion    Grabaciones y videos
--    actividad    Actividades
--    descargable  Plantillas y descargables
--    enlace       Enlaces de interés
--
--  (La lista vive en src/lib/estructura.js, CATEGORIAS_MATERIAL.)
--
--  POR QUÉ ADITIVO Y SEGURO
--  Columna nueva, vacía. Vacía = «la de su formato» (pdf → lectura,
--  video → grabación…), así que al correrlo nada cambia de sitio
--  hasta que alguien elija otra categoría. Sin este script la app
--  funciona igual: agrupa por formato y no deja elegir.
--
--  Las políticas de `recursos` no cambian: quien ya podía editar un
--  recurso puede elegir su categoría.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente: se puede correr varias veces.
-- =============================================================

alter table public.recursos
  add column if not exists categoria_material text;

alter table public.recursos
  drop constraint if exists recursos_categoria_material_check;
alter table public.recursos
  add constraint recursos_categoria_material_check
  check (categoria_material is null or categoria_material in
    ('lectura', 'grabacion', 'actividad', 'descargable', 'enlace'));

notify pgrst, 'reload schema';

-- PRUEBA: debe devolver 1.
select count(*) as columna_creada
  from information_schema.columns
 where table_schema = 'public' and table_name = 'recursos'
   and column_name = 'categoria_material';
