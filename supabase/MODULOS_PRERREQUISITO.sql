-- =============================================================
--  MÓDULOS: PRERREQUISITO (desbloqueo condicional / drip)
--
--  QUÉ RESUELVE
--  Hasta ahora un módulo se abría a mano o por fecha. Esto añade la
--  tercera forma: «este módulo se desbloquea cuando el alumno COMPLETE
--  otro». Es el drip por avance, no por reloj: el alumno marca el
--  camino a su ritmo.
--
--  CÓMO FUNCIONA (y por qué es seguro de instalar)
--  Una columna que apunta al módulo que hay que completar antes. Nace
--  en nulo, así que TODOS los módulos de hoy siguen igual: sin
--  prerrequisito. «Completar» = tener marcados como vistos todos los
--  recursos de ese módulo. La comprobación vive en el front
--  (CursoView); el administrador y el facilitador ven todo siempre.
--
--  `on delete set null`: si se borra el módulo requerido, el que
--  dependía de él simplemente deja de tener prerrequisito, en vez de
--  quedar bloqueado para siempre apuntando a algo que ya no existe.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Después, regenera ESTRUCTURA.md.
-- =============================================================

alter table public.modulos
  add column if not exists requiere_modulo_id bigint
    references public.modulos(id) on delete set null;

comment on column public.modulos.requiere_modulo_id is
  'Si está puesto, el alumno no entra a este módulo hasta COMPLETAR ese otro (todos sus recursos vistos). Null = sin prerrequisito. La comprobación vive en el front (CursoView); el gestor ve el módulo siempre.';

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   1. En «Editar módulo», al módulo 2 ponle «Requiere completar: Módulo 1».
--   2. Con cuenta de alumno, el módulo 2 aparece bloqueado hasta marcar
--      como vistos todos los recursos del módulo 1.
--   3. Con tu cuenta de admin, el módulo 2 se ve siempre.
-- -------------------------------------------------------------
