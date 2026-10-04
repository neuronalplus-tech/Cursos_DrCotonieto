-- =============================================================
--  ROLES · PASO 1 de 2  ·  DIAGNÓSTICO (solo lectura)
--
--  QUÉ HACE
--  Nada. Solo mira y reporta. No crea, no borra, no cambia
--  políticas. Puedes correrlo con total tranquilidad.
--
--  PARA QUÉ
--  Antes de introducir el rol Facilitador hay que saber cómo está
--  protegida hoy cada tabla. El riesgo concreto: si activamos RLS
--  sobre `cursos` sin una política de lectura para visitantes
--  anónimos, la portada deja de listar cursos y el sitio público
--  se cae. Este script responde exactamente esa pregunta.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Luego pásale las CUATRO tablas de resultados a Claude.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿Qué tablas tienen RLS activo?
--
--    rls_activo = false significa que CUALQUIER usuario con la
--    clave pública puede escribir en esa tabla desde el navegador.
--    Si alguna tabla de contenido sale en false, es un agujero que
--    ya existe hoy, independientemente de los roles.
-- -------------------------------------------------------------
select
  c.relname                           as tabla,
  c.relrowsecurity                    as rls_activo,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'cursos','modulos','recursos','examenes','intentos_examen',
    'foro_hilos','foro_respuestas','acceso','admins','perfiles',
    'mensajes','progreso_usuario','leads_talleres'
  )
order by c.relrowsecurity, c.relname;

-- -------------------------------------------------------------
-- 2) Las políticas que existen hoy, con su condición completa
--
--    `roles` importa tanto como la condición: si una política de
--    lectura es solo `{authenticated}`, los visitantes sin cuenta
--    no ven nada.
-- -------------------------------------------------------------
select
  tablename  as tabla,
  policyname as politica,
  cmd        as operacion,
  roles,
  qual       as condicion_using,
  with_check as condicion_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cursos','modulos','recursos','examenes','intentos_examen',
    'foro_hilos','foro_respuestas','acceso','admins','perfiles',
    'mensajes','progreso_usuario','leads_talleres'
  )
order by tablename, cmd, policyname;

-- -------------------------------------------------------------
-- 3) ¿Qué funciones de permiso existen ya?
-- -------------------------------------------------------------
select
  p.proname                                as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'es_admin','tiene_acceso_al_curso',
    'puede_gestionar_curso','es_facilitador','curso_del_modulo'
  )
order by p.proname;

-- -------------------------------------------------------------
-- 4) Columnas reales de `examenes`
--
--    La app consulta `curso_id` y `modulo_id`. Hay que confirmar
--    cuáles existen y si admiten null, porque de eso depende cómo
--    se resuelve "¿a qué curso pertenece este examen?" en la
--    política del facilitador.
-- -------------------------------------------------------------
select column_name as columna, data_type as tipo, is_nullable as admite_null
from information_schema.columns
where table_schema = 'public' and table_name = 'examenes'
order by ordinal_position;

-- =============================================================
--  QUÉ HACER CON ESTO
--  Copia las cuatro tablas de resultados y pásaselas a Claude.
--  Con eso se escribe el paso 2 sin romper lo que ya funciona.
--
--  NO corras todavía ROLES_2_APLICAR.sql.
-- =============================================================
