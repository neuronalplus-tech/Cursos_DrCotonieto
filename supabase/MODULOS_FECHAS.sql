-- =============================================================
--  MÓDULOS: FECHA DE APERTURA Y DE CIERRE
--
--  QUÉ RESUELVE
--  Hasta ahora abrir un módulo era un clic manual en el momento
--  exacto. Con esto se puede programar: «este módulo se abre el
--  lunes a las 8» y «se cierra el viernes». Es el control de fechas
--  que faltaba (solo las generaciones lo tenían).
--
--  CÓMO FUNCIONA (y por qué es seguro de instalar)
--  Las dos columnas admiten nulo y nacen en nulo. Un módulo SIN
--  fechas se comporta EXACTAMENTE como hoy: lo decide `disponible`.
--  La fecha solo restringe cuando tú la pones:
--    · `abre_el` en el futuro  -> el alumno aún no entra (aunque
--      `disponible` esté en true), hasta esa fecha.
--    · `cierra_el` en el pasado -> el módulo queda cerrado.
--  El administrador y el facilitador ven el módulo siempre, con o
--  sin fechas: esto solo afecta la vista del alumno.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Después, regenera ESTRUCTURA.md.
-- =============================================================

alter table public.modulos
  add column if not exists abre_el   timestamptz,
  add column if not exists cierra_el timestamptz;

comment on column public.modulos.abre_el is
  'Si está puesta y es futura, el módulo no es accesible al alumno hasta esa fecha (aunque disponible=true). Null = sin restricción. La comprobación vive en el front (helpers.moduloAbiertoPorFecha); el gestor ve el módulo siempre.';
comment on column public.modulos.cierra_el is
  'Si está puesta y ya pasó, el módulo queda cerrado para el alumno. Null = sin restricción.';

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   1. Edita un módulo y ponle fecha de apertura mañana.
--   2. Con una cuenta de alumno, ese módulo debe aparecer cerrado
--      ("se abre el …"); con tu cuenta de admin, abierto.
--   3. Quita la fecha: vuelve a decidirlo `disponible`, como antes.
-- -------------------------------------------------------------
