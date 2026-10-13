-- =============================================================
--  MARCA 1 — CSS EXTRA POR ORGANIZACIÓN (F5-3, parte 2)
--
--  QUÉ RESUELVE
--  Cada cliente quiere su aula con sus colores finos y sus
--  detalles, más allá de los dos colores de marca. Esto le da un
--  campo de CSS propio que se aplica tras los tokens.
--
--  POR QUÉ ADITIVO Y SEGURO
--  Columna que nace en null: sin CSS extra todo se ve igual que
--  hoy. El front lo sanea antes de aplicarlo (sin url, import ni
--  javascript:), igual que los comunicados. Un CSS que rompa el
--  diseño se quita borrando el campo.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente.
-- =============================================================

alter table public.organizaciones
  add column if not exists css_extra text;

comment on column public.organizaciones.css_extra is
  'CSS propio del cliente, aplicado tras los tokens. Se sanea en el front (ver lib/encuestas.js sanearCss). Null = sin cambios.';

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   1. Corre ESTADO.sql: la fila 48 debe decir «ya está».
--   2. Panel -> Organizaciones -> editar: campo «CSS extra» que
--      sin contenido no cambia nada visible.
-- -------------------------------------------------------------
select 'css_extra (columna)' as que,
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'organizaciones'
      and column_name = 'css_extra') as n;
-- RESULTADO ESPERADO: 1
