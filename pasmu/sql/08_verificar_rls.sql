-- PASMU: verificación de solo lectura para privilegios y políticas RLS.
-- Ejecutar después de 04_rls.sql y, si se instalará gobierno de cambios,
-- 09_gobierno_configuracion.sql. No modifica datos ni esquema.

-- 1. Todas las tablas PASMU deben existir y tener RLS habilitado.
with expected_tables(table_name) as (
  values
    ('instituciones'),
    ('unidades'),
    ('programas'),
    ('personas'),
    ('roles'),
    ('permisos'),
    ('rol_permisos'),
    ('miembros'),
    ('personas_usuarias'),
    ('catalogo_instrumentos'),
    ('competencias'),
    ('casos'),
    ('caso_profesionales'),
    ('episodios'),
    ('notas_clinicas'),
    ('agenda'),
    ('evaluaciones_psicologicas'),
    ('documentos'),
    ('documento_archivos'),
    ('consentimientos'),
    ('practicantes'),
    ('horas_practica'),
    ('practicante_competencias'),
    ('indicadores'),
    ('metas_indicadores'),
    ('mediciones_indicadores'),
    ('auditoria_actividad'),
    ('auditoria_seguridad'),
    ('solicitudes_cambio_configuracion'),
    ('revisiones_cambio_configuracion'),
    ('eventos_cambio_configuracion')
)
select
  expected.table_name,
  relation.oid is not null as table_exists,
  coalesce(relation.relrowsecurity, false) as rls_enabled,
  coalesce(relation.relforcerowsecurity, false) as rls_forced
from expected_tables expected
left join pg_class relation
  on relation.relname = expected.table_name
 and relation.relnamespace = 'public'::regnamespace
 and relation.relkind in ('r', 'p')
order by expected.table_name;

-- 2. authenticated no debe tener DML directo en ninguna tabla PASMU.
with expected_tables(table_name) as (
  values
    ('instituciones'),
    ('unidades'),
    ('programas'),
    ('personas'),
    ('roles'),
    ('permisos'),
    ('rol_permisos'),
    ('miembros'),
    ('personas_usuarias'),
    ('catalogo_instrumentos'),
    ('competencias'),
    ('casos'),
    ('caso_profesionales'),
    ('episodios'),
    ('notas_clinicas'),
    ('agenda'),
    ('evaluaciones_psicologicas'),
    ('documentos'),
    ('documento_archivos'),
    ('consentimientos'),
    ('practicantes'),
    ('horas_practica'),
    ('practicante_competencias'),
    ('indicadores'),
    ('metas_indicadores'),
    ('mediciones_indicadores'),
    ('auditoria_actividad'),
    ('auditoria_seguridad'),
    ('solicitudes_cambio_configuracion'),
    ('revisiones_cambio_configuracion'),
    ('eventos_cambio_configuracion')
)
select
  expected.table_name,
  coalesce(has_table_privilege('authenticated', relation.oid, 'SELECT'), false) as can_select_table,
  coalesce(has_table_privilege('authenticated', relation.oid, 'INSERT'), false) as can_insert,
  coalesce(has_table_privilege('authenticated', relation.oid, 'UPDATE'), false) as can_update,
  coalesce(has_table_privilege('authenticated', relation.oid, 'DELETE'), false) as can_delete,
  coalesce(has_table_privilege('authenticated', relation.oid, 'TRUNCATE'), false) as can_truncate,
  coalesce(has_table_privilege('authenticated', relation.oid, 'REFERENCES'), false) as can_reference,
  coalesce(has_table_privilege('authenticated', relation.oid, 'TRIGGER'), false) as can_create_trigger
from expected_tables expected
left join pg_class relation
  on relation.relname = expected.table_name
 and relation.relnamespace = 'public'::regnamespace
 and relation.relkind in ('r', 'p')
order by expected.table_name;

-- 3. Lista de privilegios por columna concedidos a authenticated.
select
  table_name,
  column_name,
  privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'instituciones',
    'unidades',
    'programas',
    'personas',
    'roles',
    'permisos',
    'rol_permisos',
    'miembros',
    'personas_usuarias',
    'catalogo_instrumentos',
    'competencias',
    'casos',
    'caso_profesionales',
    'episodios',
    'notas_clinicas',
    'agenda',
    'evaluaciones_psicologicas',
    'documentos',
    'documento_archivos',
    'consentimientos',
    'practicantes',
    'horas_practica',
    'practicante_competencias',
    'indicadores',
    'metas_indicadores',
    'mediciones_indicadores',
    'auditoria_actividad',
    'auditoria_seguridad',
    'solicitudes_cambio_configuracion',
    'revisiones_cambio_configuracion',
    'eventos_cambio_configuracion'
  )
order by table_name, column_name, privilege_type;

-- 4. Políticas RLS instaladas en las tablas PASMU.
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'instituciones',
    'unidades',
    'programas',
    'personas',
    'roles',
    'permisos',
    'rol_permisos',
    'miembros',
    'personas_usuarias',
    'catalogo_instrumentos',
    'competencias',
    'casos',
    'caso_profesionales',
    'episodios',
    'notas_clinicas',
    'agenda',
    'evaluaciones_psicologicas',
    'documentos',
    'documento_archivos',
    'consentimientos',
    'practicantes',
    'horas_practica',
    'practicante_competencias',
    'indicadores',
    'metas_indicadores',
    'mediciones_indicadores',
    'auditoria_actividad',
    'auditoria_seguridad',
    'solicitudes_cambio_configuracion',
    'revisiones_cambio_configuracion',
    'eventos_cambio_configuracion'
  )
order by tablename, policyname;

-- 5. Las funciones SECURITY DEFINER deben ser ejecutables por authenticated,
-- pero no por anon ni por PUBLIC.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  acl.public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace ns
  on ns.oid = p.pronamespace
left join lateral (
  select coalesce(bool_or(
    expanded_acl.grantee = 0
    and expanded_acl.privilege_type = 'EXECUTE'
  ), false) as public_execute
  from aclexplode(coalesce(
    p.proacl,
    acldefault('f', p.proowner)
  )) expanded_acl
) acl on true
where (
  ns.nspname = 'private'
  and p.proname in (
    'pasmu_current_persona_id',
    'pasmu_is_unit_member',
    'pasmu_has_permission',
    'pasmu_has_unit_permission',
    'pasmu_case_has_permission',
    'pasmu_is_case_professional',
    'pasmu_configuracion_crear_borrador',
    'pasmu_configuracion_enviar_revision',
    'pasmu_configuracion_decidir_revision'
  )
) or (
  ns.nspname = 'public'
  and p.proname in (
    'pasmu_configuration_create_draft',
    'pasmu_configuration_submit_review',
    'pasmu_configuration_review'
  )
)
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 6. Resumen automático: debe devolver "OK" para terminar la verificación.
with expected_tables(table_name) as (
  values
    ('instituciones'),
    ('unidades'),
    ('programas'),
    ('personas'),
    ('roles'),
    ('permisos'),
    ('rol_permisos'),
    ('miembros'),
    ('personas_usuarias'),
    ('catalogo_instrumentos'),
    ('competencias'),
    ('casos'),
    ('caso_profesionales'),
    ('episodios'),
    ('notas_clinicas'),
    ('agenda'),
    ('evaluaciones_psicologicas'),
    ('documentos'),
    ('documento_archivos'),
    ('consentimientos'),
    ('practicantes'),
    ('horas_practica'),
    ('practicante_competencias'),
    ('indicadores'),
    ('metas_indicadores'),
    ('mediciones_indicadores'),
    ('auditoria_actividad'),
    ('auditoria_seguridad'),
    ('solicitudes_cambio_configuracion'),
    ('revisiones_cambio_configuracion'),
    ('eventos_cambio_configuracion')
),
expected_functions(function_signature) as (
  values
    ('private.pasmu_current_persona_id()'),
    ('private.pasmu_is_unit_member(bigint)'),
    ('private.pasmu_has_permission(text,bigint,bigint)'),
    ('private.pasmu_has_unit_permission(text,bigint)'),
    ('private.pasmu_case_has_permission(bigint,text)'),
    ('private.pasmu_is_case_professional(bigint)'),
    ('private.pasmu_configuracion_crear_borrador(text,bigint,text,text,jsonb,uuid)'),
    ('private.pasmu_configuracion_enviar_revision(uuid)'),
    ('private.pasmu_configuracion_decidir_revision(uuid,text,text)'),
    ('public.pasmu_configuration_create_draft(text,bigint,text,text,jsonb,uuid)'),
    ('public.pasmu_configuration_submit_review(uuid)'),
    ('public.pasmu_configuration_review(uuid,text,text)')
),
expected_select_columns(table_name, column_name) as (
  values
    ('casos', 'id'),
    ('casos', 'unidad_id'),
    ('casos', 'programa_id'),
    ('casos', 'estado'),
    ('casos', 'fecha_apertura'),
    ('casos', 'fecha_cierre'),
    ('casos', 'created_at'),
    ('agenda', 'id'),
    ('agenda', 'unidad_id'),
    ('agenda', 'fecha_inicio'),
    ('agenda', 'fecha_fin'),
    ('agenda', 'tipo'),
    ('agenda', 'estado'),
    ('notas_clinicas', 'id'),
    ('notas_clinicas', 'caso_id'),
    ('notas_clinicas', 'tipo'),
    ('notas_clinicas', 'contenido'),
    ('notas_clinicas', 'created_at'),
    ('indicadores', 'id'),
    ('indicadores', 'codigo'),
    ('indicadores', 'nombre'),
    ('indicadores', 'descripcion'),
    ('indicadores', 'tipo'),
    ('indicadores', 'unidad_medida'),
    ('indicadores', 'activo'),
    ('metas_indicadores', 'indicador_id'),
    ('metas_indicadores', 'unidad_id'),
    ('metas_indicadores', 'programa_id'),
    ('metas_indicadores', 'periodo'),
    ('metas_indicadores', 'meta'),
    ('mediciones_indicadores', 'id'),
    ('mediciones_indicadores', 'indicador_id'),
    ('mediciones_indicadores', 'unidad_id'),
    ('mediciones_indicadores', 'programa_id'),
    ('mediciones_indicadores', 'periodo'),
    ('mediciones_indicadores', 'valor'),
    ('personas', 'id'),
    ('personas', 'auth_user_id'),
    ('personas', 'nombre'),
    ('personas', 'apellidos'),
    ('miembros', 'id'),
    ('miembros', 'persona_id'),
    ('miembros', 'unidad_id'),
    ('miembros', 'programa_id'),
    ('miembros', 'rol_id'),
    ('miembros', 'fecha_inicio'),
    ('miembros', 'fecha_fin'),
    ('miembros', 'activo'),
    ('unidades', 'id'),
    ('unidades', 'codigo'),
    ('unidades', 'nombre'),
    ('programas', 'id'),
    ('programas', 'codigo'),
    ('programas', 'nombre'),
    ('roles', 'id'),
    ('roles', 'codigo'),
    ('roles', 'nombre'),
    ('roles', 'activo'),
    ('rol_permisos', 'rol_id'),
    ('rol_permisos', 'permiso_id'),
    ('permisos', 'id'),
    ('permisos', 'codigo'),
    ('permisos', 'activo'),
    ('solicitudes_cambio_configuracion', 'id'),
    ('solicitudes_cambio_configuracion', 'cambio_id'),
    ('solicitudes_cambio_configuracion', 'version'),
    ('solicitudes_cambio_configuracion', 'sustituye_id'),
    ('solicitudes_cambio_configuracion', 'dominio'),
    ('solicitudes_cambio_configuracion', 'unidad_id'),
    ('solicitudes_cambio_configuracion', 'titulo'),
    ('solicitudes_cambio_configuracion', 'motivo'),
    ('solicitudes_cambio_configuracion', 'propuesta'),
    ('solicitudes_cambio_configuracion', 'estado'),
    ('solicitudes_cambio_configuracion', 'creada_por'),
    ('solicitudes_cambio_configuracion', 'enviada_en'),
    ('solicitudes_cambio_configuracion', 'creada_en'),
    ('revisiones_cambio_configuracion', 'id'),
    ('revisiones_cambio_configuracion', 'solicitud_id'),
    ('revisiones_cambio_configuracion', 'decision'),
    ('revisiones_cambio_configuracion', 'comentario'),
    ('revisiones_cambio_configuracion', 'revisada_por'),
    ('revisiones_cambio_configuracion', 'revisada_en'),
    ('eventos_cambio_configuracion', 'id'),
    ('eventos_cambio_configuracion', 'solicitud_id'),
    ('eventos_cambio_configuracion', 'evento'),
    ('eventos_cambio_configuracion', 'actor_id'),
    ('eventos_cambio_configuracion', 'detalle'),
    ('eventos_cambio_configuracion', 'creado_en')
),
expected_policies(table_name, policy_name, command_name) as (
  values
    ('instituciones', 'instituciones_authenticated_read', 'SELECT'),
    ('unidades', 'unidades_member_read', 'SELECT'),
    ('programas', 'programas_member_read', 'SELECT'),
    ('personas', 'personas_self_read', 'SELECT'),
    ('roles', 'roles_read_by_authenticated', 'SELECT'),
    ('roles', 'roles_authenticated_read', 'SELECT'),
    ('permisos', 'permisos_read_by_authenticated', 'SELECT'),
    ('permisos', 'permisos_authenticated_read', 'SELECT'),
    ('rol_permisos', 'rol_permisos_read_by_authenticated', 'SELECT'),
    ('rol_permisos', 'rol_permisos_authenticated_read', 'SELECT'),
    ('miembros', 'miembros_self_or_admin_read', 'SELECT'),
    ('personas_usuarias', 'personas_usuarias_case_read', 'SELECT'),
    ('catalogo_instrumentos', 'catalogo_instrumentos_authenticated_read', 'SELECT'),
    ('competencias', 'competencias_authenticated_read', 'SELECT'),
    ('casos', 'casos_read_by_unit_permission', 'SELECT'),
    ('casos', 'casos_insert_with_permission', 'INSERT'),
    ('casos', 'casos_update_with_permission', 'UPDATE'),
    ('caso_profesionales', 'caso_profesionales_read_by_case_permission', 'SELECT'),
    ('episodios', 'episodios_read_by_assigned_professional', 'SELECT'),
    ('episodios', 'episodios_insert_by_assigned_professional', 'INSERT'),
    ('notas_clinicas', 'notas_read_by_assigned_professional', 'SELECT'),
    ('notas_clinicas', 'notas_insert_by_assigned_professional', 'INSERT'),
    ('agenda', 'agenda_read_by_unit_permission', 'SELECT'),
    ('agenda', 'agenda_insert_with_unit_permission', 'INSERT'),
    ('agenda', 'agenda_update_with_unit_permission', 'UPDATE'),
    ('evaluaciones_psicologicas', 'evaluaciones_read_by_assigned_professional', 'SELECT'),
    ('evaluaciones_psicologicas', 'evaluaciones_insert_by_assigned_professional', 'INSERT'),
    ('documentos', 'documentos_read_by_assigned_professional', 'SELECT'),
    ('documentos', 'documentos_insert_by_assigned_professional', 'INSERT'),
    ('documento_archivos', 'documento_archivos_read_by_assigned_professional', 'SELECT'),
    ('documento_archivos', 'documento_archivos_insert_by_assigned_professional', 'INSERT'),
    ('consentimientos', 'consentimientos_read_by_assigned_professional', 'SELECT'),
    ('consentimientos', 'consentimientos_insert_by_assigned_professional', 'INSERT'),
    ('practicantes', 'practicantes_self_or_supervisor_read', 'SELECT'),
    ('horas_practica', 'horas_practica_self_or_supervisor_read', 'SELECT'),
    ('practicante_competencias', 'practicante_competencias_self_or_supervisor_read', 'SELECT'),
    ('indicadores', 'indicadores_read_with_report_permission', 'SELECT'),
    ('metas_indicadores', 'metas_indicadores_read_with_report_permission', 'SELECT'),
    ('mediciones_indicadores', 'mediciones_indicadores_read_with_report_permission', 'SELECT'),
    ('solicitudes_cambio_configuracion', 'solicitudes_cambio_configuracion_read', 'SELECT'),
    ('revisiones_cambio_configuracion', 'revisiones_cambio_configuracion_read', 'SELECT'),
    ('eventos_cambio_configuracion', 'eventos_cambio_configuracion_read', 'SELECT')
),
table_relations as (
  select
    expected.table_name,
    relation.oid,
    relation.relrowsecurity
  from expected_tables expected
  left join pg_class relation
    on relation.relname = expected.table_name
   and relation.relnamespace = 'public'::regnamespace
   and relation.relkind in ('r', 'p')
),
function_privileges as (
  select
    expected.function_signature,
    p.oid,
    p.prosecdef,
    coalesce((
      select bool_or(
        expanded_acl.grantee = 0
        and expanded_acl.privilege_type = 'EXECUTE'
      )
      from aclexplode(coalesce(
        p.proacl,
        acldefault('f', p.proowner)
      )) expanded_acl
    ), false) as public_execute
  from expected_functions expected
  left join pg_proc p
    on p.oid = to_regprocedure(expected.function_signature)
),
checks(check_name, passed, detail) as (
  select
    'RLS en ' || table_name,
    oid is not null and relrowsecurity,
    case
      when oid is null then 'No existe la tabla public.' || table_name
      when not relrowsecurity then 'RLS está deshabilitado en public.' || table_name
      else 'OK'
    end
  from table_relations

  union all

  select
    'DML revocado en ' || table_name,
    oid is not null
      and not has_table_privilege('authenticated', oid, 'INSERT')
      and not has_table_privilege('authenticated', oid, 'UPDATE')
      and not has_table_privilege('authenticated', oid, 'DELETE')
      and not has_table_privilege('authenticated', oid, 'TRUNCATE')
      and not has_table_privilege('authenticated', oid, 'REFERENCES')
      and not has_table_privilege('authenticated', oid, 'TRIGGER')
      and not has_any_column_privilege('authenticated', oid, 'INSERT')
      and not has_any_column_privilege('authenticated', oid, 'UPDATE')
      and not has_any_column_privilege('authenticated', oid, 'REFERENCES')
      and not has_table_privilege('anon', oid, 'INSERT')
      and not has_table_privilege('anon', oid, 'UPDATE')
      and not has_table_privilege('anon', oid, 'DELETE')
      and not has_table_privilege('anon', oid, 'TRUNCATE')
      and not has_table_privilege('anon', oid, 'REFERENCES')
      and not has_table_privilege('anon', oid, 'TRIGGER')
      and not has_any_column_privilege('anon', oid, 'INSERT')
      and not has_any_column_privilege('anon', oid, 'UPDATE')
      and not has_any_column_privilege('anon', oid, 'REFERENCES'),
    case
      when oid is null then 'No existe la tabla public.' || table_name
      else 'authenticated conserva algún privilegio DML en public.' || table_name
    end
  from table_relations

  union all

  select
    'SELECT de tabla revocado en ' || table_name,
    oid is not null
      and not has_table_privilege('authenticated', oid, 'SELECT')
      and not has_table_privilege('anon', oid, 'SELECT'),
    'authenticated o anon conserva SELECT a nivel de tabla en public.' || table_name
  from table_relations

  union all

  select
    'SELECT requerido: ' || expected.table_name || '.' || expected.column_name,
    coalesce(has_column_privilege(
      'authenticated',
      relation.oid,
      attribute.attnum,
      'SELECT'
    ), false),
    'Falta SELECT en la columna necesaria public.'
      || expected.table_name || '.' || expected.column_name
  from expected_select_columns expected
  left join table_relations relation
    on relation.table_name = expected.table_name
  left join pg_attribute attribute
    on attribute.attrelid = relation.oid
   and attribute.attname = expected.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped

  union all

  select
    'SELECT no esperado: ' || relation.table_name || '.' || attribute.attname,
    not has_column_privilege(
      'authenticated',
      relation.oid,
      attribute.attnum,
      'SELECT'
    ),
    'authenticated tiene SELECT en una columna fuera de la lista aprobada: public.'
      || relation.table_name || '.' || attribute.attname
  from table_relations relation
  join pg_attribute attribute
    on attribute.attrelid = relation.oid
   and attribute.attnum > 0
   and not attribute.attisdropped
  where has_column_privilege(
    'authenticated',
    relation.oid,
    attribute.attnum,
    'SELECT'
  )
    and not exists (
      select 1
      from expected_select_columns expected
      where expected.table_name = relation.table_name
        and expected.column_name = attribute.attname
    )

  union all

  select
    'Política requerida: ' || expected.table_name || '.' || expected.policy_name,
    policy.policyname is not null
      and policy.cmd = expected.command_name
      and policy.permissive = 'PERMISSIVE'
      and cardinality(policy.roles) = 1
      and policy.roles[1] = 'authenticated',
    case
      when policy.policyname is null then 'No existe la política esperada.'
      else 'La política tiene comando, modo o roles distintos a los aprobados.'
    end
  from expected_policies expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name

  union all

  select
    'Política no esperada: ' || policy.tablename || '.' || policy.policyname,
    false,
    'Existe una política fuera de la allowlist aprobada.'
  from pg_policies policy
  join expected_tables expected
    on expected.table_name = policy.tablename
  where policy.schemaname = 'public'
    and not exists (
      select 1
      from expected_policies approved
      where approved.table_name = policy.tablename
        and approved.policy_name = policy.policyname
    )

  union all

  select
    'SELECT anónimo revocado: ' || relation.table_name || '.' || attribute.attname,
    not has_column_privilege(
      'anon',
      relation.oid,
      attribute.attnum,
      'SELECT'
    ),
    'anon conserva SELECT en public.'
      || relation.table_name || '.' || attribute.attname
  from table_relations relation
  join pg_attribute attribute
    on attribute.attrelid = relation.oid
   and attribute.attnum > 0
   and not attribute.attisdropped
  where has_column_privilege(
    'anon',
    relation.oid,
    attribute.attnum,
    'SELECT'
  )

  union all

  select
    'Función ' || function_signature,
    oid is not null
      and prosecdef
      and not public_execute
      and not has_function_privilege('anon', oid, 'EXECUTE')
      and has_function_privilege('authenticated', oid, 'EXECUTE'),
    case
      when oid is null then 'No existe la función.'
      when not prosecdef then 'La función no está marcada SECURITY DEFINER.'
      when public_execute
        or has_function_privilege('anon', oid, 'EXECUTE')
        then 'PUBLIC o anon conserva EXECUTE.'
      when not has_function_privilege('authenticated', oid, 'EXECUTE')
        then 'authenticated no tiene EXECUTE.'
      else 'OK'
    end
  from function_privileges
)
select
  case when bool_and(passed) then 'OK' else 'REVISAR' end as status,
  count(*) filter (where not passed) as failed_checks,
  coalesce(
    string_agg(check_name || ': ' || detail, E'\n' order by check_name)
      filter (where not passed),
    'Todas las comprobaciones automáticas pasaron.'
  ) as details
from checks;
