-- =============================================================
--  MÓDULOS: LA COLUMNA `oculto` QUE EL CÓDIGO YA USA
--
--  EL PROBLEMA (bloqueante)
--  El código escribe `oculto` al CREAR un módulo (AdminModales.jsx) y
--  al DUPLICARLO (RecursosModulo.jsx), y lo lee en tres sitios
--  (helpers.js, CursoView.jsx, ModuloView.jsx)… pero la columna NO
--  existe en la tabla `modulos`. Resultado:
--    · Crear o duplicar un módulo falla con error de Postgres (PGRST204).
--    · "Módulo privado" es decoración muerta: `m.oculto` siempre es
--      undefined, así que nunca oculta nada y la etiqueta "🔒 Privado"
--      nunca aparece.
--
--  LA DECISIÓN
--  Se CREA la columna (en vez de borrar las referencias), porque el
--  control fino es justo lo que se quiere. Queda SEPARADA de
--  `disponible`, que significa otra cosa:
--    · oculto = true     -> el alumno no lo ve ni en la lista lateral.
--    · disponible = false -> visible pero cerrado ("próximamente").
--  Dos interruptores distintos para dos intenciones distintas.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Después, regenera ESTRUCTURA.md.
-- =============================================================

alter table public.modulos
  add column if not exists oculto boolean not null default false;

comment on column public.modulos.oculto is
  'true = el módulo no se muestra al alumno (ni en la lista). Distinto de `disponible` (visible pero cerrado). Lo lee helpers.js/CursoView/ModuloView y lo escribe el alta y la duplicación de módulos.';

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   · Crear un módulo nuevo desde "➕ Nuevo módulo" ya no da error.
--   · Duplicar un módulo ya no da error.
--   · Marcar un módulo como oculto lo quita de la vista del alumno.
-- -------------------------------------------------------------
