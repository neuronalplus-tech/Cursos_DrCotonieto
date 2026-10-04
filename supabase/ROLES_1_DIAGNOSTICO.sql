-- =============================================================
--  ROLES · PASO 1  ·  DIAGNÓSTICO (solo lectura)
--
--  QUÉ HACE
--  Nada. Solo mira y reporta. No crea, no borra, no cambia
--  políticas. Puedes correrlo con total tranquilidad.
--
--  PARA QUÉ
--  Antes de ampliar el rol Facilitador a cursos, módulos y
--  recursos hay que saber cómo está protegida hoy cada tabla. El
--  riesgo concreto: si activamos RLS sobre `cursos` sin una
--  política de lectura para visitantes ANÓNIMOS, la portada deja
--  de listar cursos y el sitio público se cae.
--
--  POR QUÉ ES UNA SOLA CONSULTA
--  El SQL Editor de Supabase solo enseña el resultado de la
--  ÚLTIMA sentencia. Con varias consultas sueltas se pierde todo
--  lo anterior. Aquí va todo unido en una sola tabla.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Copia la tabla completa de resultados y pásasela a Claude.
-- =============================================================

with tablas_vigiladas as (
  select unnest(array[
    'cursos','modulos','recursos','examenes','intentos_examen',
    'foro_hilos','foro_respuestas','acceso','admins','perfiles',
    'mensajes','progreso_usuario','leads_talleres','facilitadores'
  ]) as nombre
),

-- 1) ¿Tiene RLS activo?
--    "RLS APAGADO" significa que cualquiera con la clave pública
--    puede escribir en esa tabla desde el navegador.
estado_rls as (
  select
    '1 · RLS'                                   as seccion,
    c.relname::text                             as tabla,
    case when c.relrowsecurity
         then 'RLS activo'
         else '>>> RLS APAGADO <<<'
    end                                         as detalle,
    (select count(*)::text from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = c.relname) || ' politica(s)' as condicion
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (select nombre from tablas_vigiladas)
),

-- 2) Las políticas que existen, con su condición completa.
--    `roles` importa tanto como la condición: si una lectura es
--    solo {authenticated}, quien no tiene cuenta no ve nada.
politicas as (
  select
    '2 · Politica'                              as seccion,
    tablename::text                             as tabla,
    (cmd || ' · ' || policyname)::text          as detalle,
    ('roles=' || array_to_string(roles, ',') ||
     ' | using: '  || coalesce(qual, '-') ||
     ' | check: '  || coalesce(with_check, '-'))::text as condicion
  from pg_policies
  where schemaname = 'public'
    and tablename in (select nombre from tablas_vigiladas)
),

-- 3) Funciones de permiso ya disponibles.
funciones as (
  select
    '3 · Funcion'                               as seccion,
    p.proname::text                             as tabla,
    ('(' || pg_get_function_identity_arguments(p.oid) || ')')::text as detalle,
    ''::text                                    as condicion
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'es_admin','tiene_acceso_al_curso',
      'puede_gestionar_curso','es_facilitador','curso_del_examen'
    )
)

select * from estado_rls
union all
select * from politicas
union all
select * from funciones
order by seccion, tabla, detalle;

-- =============================================================
--  QUÉ MIRAR
--  En la sección "1 · RLS", cualquier tabla de contenido que diga
--  ">>> RLS APAGADO <<<" es un agujero que ya existe hoy,
--  independientemente de los roles: cualquier alumno autenticado
--  puede escribir en ella desde la consola del navegador.
--
--  Pásale la tabla completa a Claude para escribir el paso 3.
-- =============================================================
