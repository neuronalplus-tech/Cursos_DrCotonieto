-- =============================================================
--  ¿QUÉ ME FALTA CORRER?
--
--  Solo lectura. Compara lo que hay en tu base con lo que cada
--  script deja instalado, y te dice cuáles faltan y en qué orden.
--
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Córrelo siempre que dudes: es más fiable que llevar la cuenta.
-- =============================================================

with esperado(orden, script, objeto, tipo) as (
  values
    (1,  'FORO.sql',                    'foro_hilos',        'tabla'),
    (2,  'ROLES_2_APLICAR.sql',         'facilitadores',     'tabla'),
    (3,  'ROLES_3_APLICAR.sql',         'curso_del_modulo',  'funcion'),
    (4,  'ROLES_4_ALUMNOS.sql',         'es_alumno_mio',     'funcion'),
    (5,  'SEGURIDAD_1.sql',             'puede_escribir_a',  'funcion'),
    (6,  'CURSOS_ALTA.sql',             'cursos_insert_admin', 'politica'),
    (7,  'BITACORA.sql',                'auditoria',         'tabla'),
    (8,  'CURSOS_PLANTILLA.sql',        'duplicar_curso',    'funcion'),
    (9,  'CATEGORIAS.sql',              'categorias',        'tabla'),
    (10, 'TAREAS_1_BASE.sql',           'tareas',            'tabla'),
    (11, 'FORO_CALIFICACION.sql',       'promedio_foro',     'funcion'),
    (12, 'FORO_RAMAS.sql',              'validar_rama_foro', 'funcion'),
    (13, 'CONSTANCIAS_VERIFICABLES.sql','constancias',       'tabla'),
    (14, 'CONSTANCIAS_2_EMISION.sql',   'emitir_constancia', 'funcion'),
    (15, 'GENERACIONES.sql',            'generaciones',      'tabla'),
    (16, 'ORGANIZACIONES_1_BASE.sql',   'organizaciones',    'tabla'),
    (17, 'SUSCRIPCIONES.sql',           'registrar_pago',    'funcion'),
    (18, 'BANCO_PREGUNTAS.sql',         'banco_preguntas',   'tabla'),
    (19, 'PONDERACION.sql',             'cursos_ponderacion_check', 'restriccion'),
    (20, 'PADRON.sql',                  'perfil_update_admin',      'politica'),
    (21, 'TABLERO_ORG.sql',             'tablero_organizacion',     'funcion'),
    (22, 'USUARIOS_ALTA.sql',           'usuario_id_por_correo',    'funcion'),
    (23, 'SEGURIDAD_2_ACCESO.sql',      'acceso_update_admin',      'politica')
),
hay as (
  select e.orden, e.script, e.objeto, e.tipo,
    case e.tipo
      when 'tabla' then exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = e.objeto)
      when 'funcion' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto)
      when 'politica' then exists (
        select 1 from pg_policies
        where schemaname = 'public' and policyname = e.objeto)
      when 'restriccion' then exists (
        select 1 from pg_constraint
        where conname = e.objeto)
    end as instalado
  from esperado e
)
select
  orden,
  case when instalado then '✅ ya está' else '❌ FALTA CORRER' end as estado,
  script,
  objeto || ' (' || tipo || ')' as comprueba
from hay
order by orden;

-- =============================================================
--  CÓMO LEERLO
--  Corre los que digan FALTA, de arriba abajo. El orden importa:
--  varios se apoyan en funciones que crea el anterior.
--
--  Todos son idempotentes: volver a correr uno que ya está no
--  rompe nada, así que ante la duda, córrelo.
--
--  NO ESTÁN EN ESTA LISTA, Y NO HACE FALTA CORRERLOS:
--  · ESQUEMA_BASE.sql y ESQUEMA_SEGURIDAD.sql son el respaldo para
--    reconstruir la base en un proyecto NUEVO. Se generan leyendo
--    la base; no se editan ni se corren aquí.
--  · DIAGNOSTICO_*.sql solo leen y sirven para investigar algo
--    concreto.
--  · ACCESO_REVISION.sql crea un usuario de revisión temporal.
-- =============================================================
