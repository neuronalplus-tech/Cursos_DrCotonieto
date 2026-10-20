-- PASMU: 08b_verificar_extendido — checks para 10/11 sin modificar 08 base.
-- Ejecutar después de 10/10b/10c/11a/11b/11c. Solo lectura. PRUEBAS, sin datos reales.
-- 08 base debe seguir en OK para 01-09; este archivo valida lo nuevo por separado.

-- 1. Tabla contratos existe, RLS on, sin DML para authenticated/anon.
select
  'contratos_tabla' as check_name,
  (to_regclass('public.configuracion_contratos') is not null) as tabla_existe,
  coalesce((select relrowsecurity from pg_class where relname = 'configuracion_contratos' and relnamespace = 'public'::regnamespace), false) as rls_on,
  not coalesce(has_table_privilege('authenticated', 'public.configuracion_contratos', 'INSERT'), true) as sin_insert_auth,
  not coalesce(has_table_privilege('authenticated', 'public.configuracion_contratos', 'UPDATE'), true) as sin_update_auth,
  not coalesce(has_table_privilege('anon', 'public.configuracion_contratos', 'SELECT'), true) as sin_select_anon;

-- 2. Debe haber 9 contratos (uno por dominio).
select
  'contratos_seed' as check_name,
  count(*) as filas,
  count(*) = 9 as ok_9_dominios
from public.configuracion_contratos;

-- 3. Validador existe, SECURITY DEFINER, solo authenticated ejecuta.
select
  'validador_contrato' as check_name,
  (to_regprocedure('private.pasmu_payload_contrato_valido(text, jsonb)') is not null) as existe,
  coalesce((select prosecdef from pg_proc where oid = to_regprocedure('private.pasmu_payload_contrato_valido(text, jsonb)')), false) as es_definer,
  not coalesce(has_function_privilege('anon', to_regprocedure('private.pasmu_payload_contrato_valido(text, jsonb)'), 'EXECUTE'), true) as anon_no,
  coalesce(has_function_privilege('authenticated', to_regprocedure('private.pasmu_payload_contrato_valido(text, jsonb)'), 'EXECUTE'), false) as auth_si;

-- 4. Wrappers públicos 11c existen, DEFINER, authenticated sí / anon no.
select
  p.proname as funcion,
  p.prosecdef as es_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ejecuta,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_ejecuta
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('pasmu_caso_crear', 'pasmu_agenda_programar', 'pasmu_nota_crear')
order by p.proname;

-- 5. Privadas 11a/11b NO ejecutables por authenticated (solo vía wrapper).
select
  p.proname as privada,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ejecuta_directo,
  (not has_function_privilege('authenticated', p.oid, 'EXECUTE')) as ok_revocada
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in ('pasmu_caso_crear', 'pasmu_agenda_programar', 'pasmu_nota_crear')
order by p.proname;

-- 6. Vista redactada existe y no expone PII (columnas esperadas, sin email/nombre/contenido).
select
  'vista_redactada' as check_name,
  (to_regclass('public.vista_auditoria_redactada') is not null) as existe,
  (select count(*) = 0 from information_schema.columns
    where table_schema = 'public' and table_name = 'vista_auditoria_redactada'
    and column_name in ('usuario_email', 'nombre', 'apellidos', 'contenido', 'motivo')) as sin_pii;
