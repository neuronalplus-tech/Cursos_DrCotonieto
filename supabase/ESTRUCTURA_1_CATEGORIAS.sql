-- =============================================================
--  ESTRUCTURA 1 — CATEGORÍA DE CADA MATERIAL
--
--  QUÉ RESUELVE
--  1) Un recurso solo decía su FORMATO (pdf, video, enlace…). El
--     alumno no busca «el PDF»: busca la lectura, la grabación o la
--     actividad. Esta columna guarda PARA QUÉ sirve cada material y
--     la página del módulo los agrupa en secciones fijas:
--
--       sesion       Sesiones en vivo
--       lectura      Materiales de lectura
--       grabacion    Grabaciones y videos
--       actividad    Actividades
--       juego        Juegos e interactivos
--       descargable  Plantillas y descargables
--       entregable   Entregables
--       enlace       Enlaces de interés
--
--     (La lista vive en src/lib/estructura.js, CATEGORIAS_MATERIAL.)
--
--  2) Tres bloques estaban escritos en el código para UN curso, por
--     su título: las diapositivas para presentar caso (rutas
--     Acompañamiento y Clínica), los entregables y el juego de la
--     sesión 4 (curso «Problemas contemporáneos»). La parte 2 los
--     crea como materiales normales de su módulo. Desde entonces se
--     editan, se ocultan y se borran como cualquier otro, y cualquier
--     curso puede tener los suyos.
--
--  POR QUÉ ADITIVO Y SEGURO
--  · La columna nace vacía. Vacía = «la de su formato» (pdf →
--    lectura, video → grabación…): nada cambia de sitio.
--  · La parte 2 solo INSERTA, y solo si el módulo aún no tiene ese
--    material: correrla dos veces no duplica nada. No borra ni cambia
--    los datos viejos (modulos.botones_extra sigue igual).
--  · La app muestra cada bloque viejo solo mientras su módulo no
--    tenga el material nuevo: no se ve nada repetido.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente: se puede correr varias veces.
-- =============================================================

-- -------------------------------------------------------------
-- PARTE 1 · LA COLUMNA
-- -------------------------------------------------------------
alter table public.recursos
  add column if not exists categoria_material text;

alter table public.recursos
  drop constraint if exists recursos_categoria_material_check;
alter table public.recursos
  add constraint recursos_categoria_material_check
  check (categoria_material is null or categoria_material in
    ('sesion', 'lectura', 'grabacion', 'actividad', 'juego',
     'descargable', 'entregable', 'enlace'));

-- -------------------------------------------------------------
-- PARTE 2 · LOS BLOQUES ESPECIALES PASAN A SER MATERIALES
--
-- `contenido` guarda el texto del botón (la app lo usa así para los
-- enlaces). `orden`: las diapositivas arriba; entregables y juego
-- abajo, como estaban en la página.
-- -------------------------------------------------------------

-- 2a) Diapositivas para presentar tu caso → Plantillas y descargables
insert into public.recursos
  (modulo_id, tipo, categoria_material, titulo, descripcion, url, contenido, orden, disponible)
select m.id, 'enlace', 'descargable',
       'Diapositivas para presentar tu caso',
       'Usa esta plantilla para estructurar la presentación de tu caso en la sesión de supervisión. '
         || 'Incluye los apartados que revisaremos juntos: motivo de consulta, análisis funcional, hipótesis y plan.',
       'https://1drv.ms/p/c/a43668d1cdc6e346/IQABiMuYL5oQQLuzj7m72L_FAR9JRwJCn52xxu9qaRKAENU?e=NA3oRy',
       '📽️ Abrir diapositivas en OneDrive', 5, true
  from public.modulos m
 where m.grupo in ('Acompañamiento', 'Clínica')
   and coalesce(m.activo, true)
   and not exists (
     select 1 from public.recursos r
      where r.modulo_id = m.id
        and r.url = 'https://1drv.ms/p/c/a43668d1cdc6e346/IQABiMuYL5oQQLuzj7m72L_FAR9JRwJCn52xxu9qaRKAENU?e=NA3oRy');

-- Los cursos «Problemas contemporáneos» (misma regla que la app:
-- el título contiene «problemas» y «contempor», sin tildes).
with problemas as (
  select m.*
    from public.modulos m
    join public.cursos c on c.id = m.curso_id
   where translate(lower(c.titulo), 'áéíóú', 'aeiou') like '%problemas%'
     and translate(lower(c.titulo), 'áéíóú', 'aeiou') like '%contempor%'
     and coalesce(m.activo, true)
),
-- 2b) Entregables → sección Entregables. Respeta lo que se hubiera
--     editado en el bloque (título, texto, enlace, descripción,
--     activo); si se había ELIMINADO, no se crea.
entregables as (
  select p.id as modulo_id,
         (select b from jsonb_array_elements(p.botones_extra) b
           where b->>'tipo' = 'entregables' limit 1) as b
    from problemas p
)
insert into public.recursos
  (modulo_id, tipo, categoria_material, titulo, descripcion, url, contenido, orden, disponible)
select e.modulo_id, 'enlace', 'entregable',
       coalesce(nullif(e.b->>'titulo', ''), 'Entregables / productos'),
       coalesce(nullif(e.b->>'descripcion', ''),
         'Las actividades de las sesiones 1 y 2 se realizan en equipo durante la sesión y se suben como entregables al final de cada una. '
         || 'Nombren cada archivo haciendo referencia al nombre de su región (ej. Región_Norte_S1_análisis.pdf).'),
       coalesce(nullif(e.b->>'url', ''),
         'https://1drv.ms/f/c/a43668d1cdc6e346/IgCxnJ6u1wjqSYKpW0N7eSgzAWc1XQw02u1GwWpkduAL9EI?e=h9CAvA'),
       coalesce(nullif(e.b->>'texto', ''), '📤 Subir mi entregable a OneDrive'),
       900,
       coalesce((e.b->>'activo')::boolean, true)
  from entregables e
 where coalesce((e.b->>'eliminado')::boolean, false) = false
   and not exists (
     select 1 from public.recursos r
      where r.modulo_id = e.modulo_id and r.categoria_material = 'entregable');

-- 2c) Juego de la sesión 4 → Juegos e interactivos
insert into public.recursos
  (modulo_id, tipo, categoria_material, titulo, descripcion, url, contenido, orden, disponible)
select m.id, 'enlace', 'juego',
       'Juego de la sesión 4', null, '/juegos/juego-s4.html', '🎮 Abrir juego de la sesión 4', 950, true
  from public.modulos m
  join public.cursos c on c.id = m.curso_id
 where translate(lower(c.titulo), 'áéíóú', 'aeiou') like '%problemas%'
   and translate(lower(c.titulo), 'áéíóú', 'aeiou') like '%contempor%'
   and coalesce(m.activo, true)
   and m.titulo ~* 'sesi[oó]n\s*4'
   and not exists (
     select 1 from public.recursos r
      where r.modulo_id = m.id and r.url = '/juegos/juego-s4.html');

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA: la columna (1) y cuántos materiales hay por categoría.
-- Tras correrlo deben aparecer «descargable», «entregable» y
-- «juego» si tu base tiene esos cursos.
-- -------------------------------------------------------------
select 'columna categoria_material' as que, count(*)::text as n
  from information_schema.columns
 where table_schema = 'public' and table_name = 'recursos'
   and column_name = 'categoria_material'
union all
select 'materiales con categoría ' || categoria_material, count(*)::text
  from public.recursos
 where categoria_material is not null
 group by categoria_material;
