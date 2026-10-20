-- ============================================================================
-- PASMU — Script de verificación de migraciones SQL aplicadas
-- Ejecutar en el SQL Editor de Supabase (proyecto de destino).
-- ============================================================================
-- Propósito:
--   1. Crear tabla de control pasmu_schema_migraciones (si no existe).
--   2. Registrar los archivos SQL esperados en orden de ejecución.
--   3. Auto-detectar qué archivos ya fueron aplicados (verificando objetos clave).
--   4. Reportar cuáles están ✅ ejecutados y cuáles ❌ faltan, con orden.
-- ============================================================================

-- 1. Tabla de control de migraciones -----------------------------------------
create table if not exists public.pasmu_schema_migraciones (
  archivo text primary key,
  orden integer not null,
  ejecutado boolean not null default false,
  ejecutado_en timestamptz,
  observaciones text
);

-- 2. Catálogo de archivos esperados (orden de ejecución) ---------------------
-- Nota: este bloque inserta los archivos como "pendiente" si aún no están
-- registrados. Si ya existían, no los toca (on conflict do nothing).
insert into public.pasmu_schema_migraciones (archivo, orden, ejecutado, observaciones) values

  ('01_catalogos.sql',            1, false, 'Tablas base: instituciones, unidades, programas, personas, roles, permisos, rol_permisos, miembros, personas_usuarias, catalogo_instrumentos, competencias.'),
  ('02_atencion.sql',             2, false, 'Tablas: casos, caso_profesionales, episodios, notas_clinicas, agenda, evaluaciones_psicologicas, documentos, documento_archivos, consentimientos, practicantes, horas_practica, practicante_competencias.'),
  ('03_reportes.sql',             3, false, 'Tablas: indicadores, metas_indicadores, mediciones_indicadores, auditoria_actividad, auditoria_seguridad.'),
  ('04_rls.sql',                  4, false, 'Schema private + funciones pasmu_current_persona_id, pasmu_has_permission, pasmu_case_has_permission, pasmu_is_case_professional y políticas RLS base.'),
  ('05_seed_roles.sql',           5, false, 'Seed institucional: instituciones, unidades, programas, roles, permisos, rol_permisos.'),
  ('06_vincular_primera_cuenta.sql', 6, false, 'Script procedural: vincula cuenta Auth a personas/miembros (requiere email real).'),
  ('07_actualizar_esquema_inicial.sql', 7, false, 'Índices y columnas adicionales (unidad_id, programa_id) en mediciones_indicadores y auditoría.'),
  ('08_verificar_rls.sql',        8, false, 'Solo lectura: verificación de RLS y privilegios. No crea objetos persistentes.'),
  ('08b_verificar_extendido.sql', 9, false, 'Solo lectura: verificación de contratos y wrappers (10/11). No crea objetos persistentes.'),
  ('09_gobierno_configuracion.sql', 10, false, 'Tablas solicitudes_cambio_configuracion, revisiones_cambio_configuracion, eventos_cambio_configuracion + permisos configuracion.* y RPCs privadas.'),
  ('10_payloads_tipados.sql',     11, false, 'Tabla configuracion_contratos + RLS.'),
  ('10b_contratos_seed.sql',      12, false, 'Seed de contratos v1 por dominio (9 filas).'),
  ('10c_validador_contrato.sql',  13, false, 'Función private.pasmu_payload_contrato_valido.'),
  ('11a_casos_controlados.sql',   14, false, 'Vista vista_auditoria_redactada + función private.pasmu_caso_crear.'),
  ('11b_agenda_notas.sql',        15, false, 'Funciones private.pasmu_agenda_programar, private.pasmu_nota_crear.'),
  ('11c_wrappers_publicos.sql',   16, false, 'Wrappers públicos: public.pasmu_caso_crear, public.pasmu_agenda_programar, public.pasmu_nota_crear.'),
  ('11c_3_rpc_permisos_extras.sql', 17, false, 'RPCs públicas: pasmu_mis_permisos_pasmu, pasmu_notas_soap_listar_caso, pasmu_notas_addendum_listar, pasmu_revisiones_listar, pasmu_supervision_solicitar.'),
  ('12_endurecer_borrador.sql',   18, false, 'Refuerza private.pasmu_configuracion_crear_borrador con chequeo de contrato tipado.'),
  ('13_altas_bitacora.sql',       19, false, 'Función public.mis_permisos_pasmu + tabla prealtas_equipo.'),
  ('13b_triggers_preAlta.sql',    20, false, 'Función private.pasmu_auditar, triggers de bitácora + función public.pasmu_preAlta_equipo.'),
  ('14_expediente_modular.sql',   21, false, 'Tablas: historia_clinica, examen_mental, tareas_sesion, asistencia_sesion (con RLS).'),
  ('14b_banco_recursos.sql',      22, false, 'Tablas: banco_recursos, recurso_asignaciones + función public.material_del_caso.'),
  ('16_avisos_asistencia.sql',    23, false, 'Tablas: avisos_cita, autoevaluaciones_resultados + función public.pasmu_aviso_programar.'),
  ('16_rls_soap_supervision.sql', 24, false, 'Políticas RLS para roles/permisos, notas_soap, notas_addendum, revisiones_supervision.'),
  ('16b_rls_expediente.sql',      25, false, 'Políticas RLS para tablas expediente_* (19a).'),
  ('17_roles_reales.sql',         26, false, 'Roles clínicos reales + permisos adicionales (supervision.*, expediente.estado, miportal.*) y rol_permisos.'),
  ('17b_cuenta_auditora.sql',     27, false, 'Script procedural: asigna los 9 roles clínicos a la cuenta auditora (UAP).'),
  ('18a_expediente_catalogos.sql', 28, false, 'Tabla expediente_catalogos (catálogos NOM-004 precargados).'),
  ('18b_historia_soap.sql',       29, false, 'Tablas: historia_integral, notas_soap, notas_addendum, revisiones_supervision (con RLS).'),
  ('19a_expediente_nom.sql',      30, false, 'Tablas núcleo expediente NOM-004: expediente_caso, demografia, documentos_legales, historial, antecedentes, evaluacion, plan, consentimiento, addendum + función pasmu_expediente_caso.'),
  ('20a_soap_rpc.sql',            31, false, 'RPCs SOAP: pasmu_notas_soap_crear, pasmu_notas_addendum_crear, pasmu_revisiones_crear (primera versión).'),
  ('20b_expediente_rpc_extra.sql', 32, false, 'RPCs: pasmu_expediente_estado, pasmu_casos_del_usuario.'),
  ('20b_soap_rpc_fixed.sql',      33, false, 'RPCs SOAP corregidas y consolidadas (sobrescribe 20a).'),
  ('21_chat_interno.sql',         34, false, 'Tablas chat: salas_chat, participantes_chat, mensajes_chat + RLS.'),
  ('21a_chat_rpcs.sql',           35, false, 'RPCs chat: pasmu_chat_salas_listar, pasmu_chat_participantes_listar, pasmu_chat_mensajes_listar, pasmu_chat_mensaje_crear.')
on conflict (archivo) do nothing;

-- 3. Auto-detección de objetos ya presentes ----------------------------------
-- Se marca como ejecutado (true) si el objeto clave existe en la base de datos.

-- 01_catalogos: tablas base
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: instituciones existe]'
where m.archivo = '01_catalogos.sql' and to_regclass('public.instituciones') is not null;

-- 02_atencion: tabla casos
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: casos existe]'
where m.archivo = '02_atencion.sql' and to_regclass('public.casos') is not null;

-- 03_reportes: tabla indicadores
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: indicadores existe]'
where m.archivo = '03_reportes.sql' and to_regclass('public.indicadores') is not null;

-- 04_rls: función private.pasmu_has_permission
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: private.pasmu_has_permission existe]'
where m.archivo = '04_rls.sql' and to_regprocedure('private.pasmu_has_permission(text, bigint, bigint)') is not null;

-- 05_seed_roles: rol coordinador_pasu existe
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: rol coordinador_pasu existe]'
where m.archivo = '05_seed_roles.sql' and exists (select 1 from public.roles where codigo = 'coordinador_pasu');

-- 06_vincular_primera_cuenta: script procedural, no objeto verificable
-- (se deja como pendiente hasta que el usuario lo ejecute manualmente)

-- 07_actualizar_esquema_inicial: columna unidad_id en mediciones_indicadores
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: mediciones_indicadores.unidad_id existe]'
where m.archivo = '07_actualizar_esquema_inicial.sql'
  and exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='mediciones_indicadores' and column_name='unidad_id');

-- 08_verificar_rls / 08b_verificar_extendido: solo verificación, sin objetos
-- (se dejan como pendiente; el usuario las ejecuta para validar)

-- 09_gobierno_configuracion: tabla solicitudes_cambio_configuracion
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: solicitudes_cambio_configuracion existe]'
where m.archivo = '09_gobierno_configuracion.sql'
  and to_regclass('public.solicitudes_cambio_configuracion') is not null;

-- 10_payloads_tipados: tabla configuracion_contratos
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: configuracion_contratos existe]'
where m.archivo = '10_payloads_tipados.sql'
  and to_regclass('public.configuracion_contratos') is not null;

-- 10b_contratos_seed: 9 contratos insertados
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: 9 contratos en configuracion_contratos]'
where m.archivo = '10b_contratos_seed.sql'
  and (select count(*) from public.configuracion_contratos) = 9;

-- 10c_validador_contrato: función validador
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: private.pasmu_payload_contrato_valido existe]'
where m.archivo = '10c_validador_contrato.sql'
  and to_regprocedure('private.pasmu_payload_contrato_valido(text, jsonb)') is not null;

-- 11a_casos_controlados: vista auditoría redactada
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: vista_auditoria_redactada existe]'
where m.archivo = '11a_casos_controlados.sql'
  and to_regclass('public.vista_auditoria_redactada') is not null;

-- 11b_agenda_notas: función private.pasmu_agenda_programar
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: private.pasmu_agenda_programar existe]'
where m.archivo = '11b_agenda_notas.sql'
  and to_regprocedure('private.pasmu_agenda_programar(bigint, timestamptz, timestamptz, text)') is not null;

-- 11c_wrappers_publicos: función public.pasmu_caso_crear
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.pasmu_caso_crear existe]'
where m.archivo = '11c_wrappers_publicos.sql'
  and to_regprocedure('public.pasmu_caso_crear(bigint, bigint, text)') is not null;

-- 11c_3_rpc_permisos_extras: función pasmu_mis_permisos_pasmu
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.pasmu_mis_permisos_pasmu existe]'
where m.archivo = '11c_3_rpc_permisos_extras.sql'
  and to_regprocedure('public.pasmu_mis_permisos_pasmu()') is not null;

-- 12_endurecer_borrador: función borrador endurecida
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: private.pasmu_configuracion_crear_borrador existe]'
where m.archivo = '12_endurecer_borrador.sql'
  and to_regprocedure('private.pasmu_configuracion_crear_borrador(text, bigint, text, text, jsonb, uuid)') is not null;

-- 13_altas_bitacora: función public.mis_permisos_pasmu
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.mis_permisos_pasmu existe]'
where m.archivo = '13_altas_bitacora.sql'
  and to_regprocedure('public.mis_permisos_pasmu()') is not null;

-- 13b_triggers_preAlta: función private.pasmu_auditar
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: private.pasmu_auditar existe]'
where m.archivo = '13b_triggers_preAlta.sql'
  and to_regprocedure('private.pasmu_auditar()') is not null;

-- 14_expediente_modular: tabla historia_clinica
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: historia_clinica existe]'
where m.archivo = '14_expediente_modular.sql'
  and to_regclass('public.historia_clinica') is not null;

-- 14b_banco_recursos: tabla banco_recursos
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: banco_recursos existe]'
where m.archivo = '14b_banco_recursos.sql'
  and to_regclass('public.banco_recursos') is not null;

-- 16_avisos_asistencia: tabla avisos_cita
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: avisos_cita existe]'
where m.archivo = '16_avisos_asistencia.sql'
  and to_regclass('public.avisos_cita') is not null;

-- 16_rls_soap_supervision: política notas_soap_read_by_creator_or_reviewed
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: política RLS notas_soap existe]'
where m.archivo = '16_rls_soap_supervision.sql'
  and exists (select 1 from pg_policies
              where schemaname='public' and tablename='notas_soap'
                and policyname='notas_soap_read_by_creator_or_reviewed');

-- 16b_rls_expediente: política expediente_caso_read_by_assigned
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: política RLS expediente_caso existe]'
where m.archivo = '16b_rls_expediente.sql'
  and exists (select 1 from pg_policies
              where schemaname='public' and tablename='expediente_caso'
                and policyname='expediente_caso_read_by_assigned');

-- 17_roles_reales: rol terapeuta existe
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: rol terapeuta existe]'
where m.archivo = '17_roles_reales.sql'
  and exists (select 1 from public.roles where codigo = 'terapeuta');

-- 17b_cuenta_auditora: script procedural (sin objeto verificable automáticamente)
-- (se deja como pendiente)

-- 18a_expediente_catalogos: tabla expediente_catalogos
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: expediente_catalogos existe]'
where m.archivo = '18a_expediente_catalogos.sql'
  and to_regclass('public.expediente_catalogos') is not null;

-- 18b_historia_soap: tabla notas_soap
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: notas_soap existe]'
where m.archivo = '18b_historia_soap.sql'
  and to_regclass('public.notas_soap') is not null;

-- 19a_expediente_nom: tabla expediente_caso
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: expediente_caso existe]'
where m.archivo = '19a_expediente_nom.sql'
  and to_regclass('public.expediente_caso') is not null;

-- 20a_soap_rpc: función pasmu_notas_soap_crear
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.pasmu_notas_soap_crear existe]'
where m.archivo = '20a_soap_rpc.sql'
  and to_regprocedure('public.pasmu_notas_soap_crear(bigint)') is not null;

-- 20b_expediente_rpc_extra: función pasmu_expediente_estado
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.pasmu_expediente_estado existe]'
where m.archivo = '20b_expediente_rpc_extra.sql'
  and to_regprocedure('public.pasmu_expediente_estado(bigint)') is not null;

-- 20b_soap_rpc_fixed: función pasmu_notas_soap_crear (sobrescribe 20a)
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.pasmu_notas_soap_crear (fixed) existe]'
where m.archivo = '20b_soap_rpc_fixed.sql'
  and to_regprocedure('public.pasmu_notas_soap_crear(bigint)') is not null;

-- 21_chat_interno: tabla salas_chat
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: salas_chat existe]'
where m.archivo = '21_chat_interno.sql'
  and to_regclass('public.salas_chat') is not null;

-- 21a_chat_rpcs: función pasmu_chat_salas_listar
update public.pasmu_schema_migraciones m
set ejecutado = true, ejecutado_en = coalesce(m.ejecutado_en, now()),
    observaciones = m.observaciones || ' [auto: public.pasmu_chat_salas_listar existe]'
where m.archivo = '21a_chat_rpcs.sql'
  and to_regprocedure('public.pasmu_chat_salas_listar()') is not null;

-- 4. Reporte final ------------------------------------------------------------
-- Ejecutar este SELECT para ver el estado de todas las migraciones.
select
  m.orden,
  m.archivo,
  case when m.ejecutado then '✅ EJECUTADO' else '❌ PENDIENTE' end as estado,
  m.ejecutado_en,
  m.observaciones
from public.pasmu_schema_migraciones m
order by m.orden;

-- Resumen rápido
select
  count(*) filter (where ejecutado) as ejecutadas,
  count(*) filter (where not ejecutado) as pendientes,
  count(*) as total
from public.pasmu_schema_migraciones;

-- Lista solo las pendientes en orden (ejecutar esos archivos en Supabase en este orden)
select
  m.orden,
  m.archivo,
  m.observaciones
from public.pasmu_schema_migraciones m
where not m.ejecutado
order by m.orden;

-- ============================================================================
-- Cómo marcar manualmente un archivo como ejecutado (opcional):
--   update public.pasmu_schema_migraciones
--   set ejecutado = true, ejecutado_en = now()
--   where archivo = 'XX_nombre.sql';
--
-- Cómo desmarcar (volver a pendiente):
--   update public.pasmu_schema_migraciones
--   set ejecutado = false, ejecutado_en = null
--   where archivo = 'XX_nombre.sql';
-- ============================================================================







