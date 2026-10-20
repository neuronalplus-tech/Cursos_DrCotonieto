-- PASMU 17: roles reales gestión clínica + cuenta auditora multi-rol.
-- Solo PRUEBAS. Idempotente. Requiere 05 aplicado. No borra roles legados.
begin;
insert into public.roles (codigo, nombre, descripcion) values
  ('direccion_pasmu', 'Dirección PASMU', 'Revisa resultados institucionales agregados'),
  ('responsable_unidad', 'Responsable de unidad', 'Da altas en sus unidades; ve expedientes asignados'),
  ('coordinador_clinico', 'Coordinador clínico', 'Coordina casos, agenda e indicadores operativos'),
  ('supervisor_clinico', 'Supervisor clínico', 'Revisa y comenta expedientes; audita con metas'),
  ('terapeuta', 'Terapeuta', 'Atiende casos; llena expediente y notas SOAP'),
  ('coterapeuta', 'Co-terapeuta', 'Atiende bajo terapeuta responsable'),
  ('clinico_administrativo', 'Clínico-administrativo', 'Agenda, primer contacto y apoyo; sin expediente clínico, solo estado/asistencia'),
  ('tallerista', 'Tallerista', 'Apoya con talleres internos/externos; sin expediente clínico'),
  ('persona_usuaria', 'Persona usuaria', 'Portal propio: tareas, notas para siguiente sesión, material asignado')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = true;

insert into public.permisos (codigo, descripcion, categoria) values
  ('supervision.revisar', 'Solicitar y registrar revisión de expediente', 'clinico'),
  ('supervision.comentar', 'Comentar expedientes como supervisor', 'clinico'),
  ('expediente.estado', 'Ver solo estado/etapa/asistencia, sin contenido clínico', 'clinico'),
  ('miportal.ver', 'Ver portal propio', 'portal'),
  ('miportal.tareas', 'Ver tareas y material asignado', 'portal'),
  ('miportal.notas', 'Subir nota para siguiente sesión', 'portal')
on conflict (codigo) do nothing;

-- Asignación mínima (auditable; ajustar tras matriz aprobada).
insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, 'unidad' from public.roles r, public.permisos p
where (r.codigo, p.codigo) in (
  ('direccion_pasmu','dashboard.ver'), ('direccion_pasmu','reportes.ver'),
  ('direccion_pasmu','reportes.exportar'), ('direccion_pasmu','admin.auditoria'),
  ('responsable_unidad','dashboard.ver'), ('responsable_unidad','casos.ver'),
  ('responsable_unidad','casos.crear'), ('responsable_unidad','casos.editar'),
  ('responsable_unidad','agenda.ver'), ('responsable_unidad','agenda.programar'),
  ('responsable_unidad','expediente.ver'), ('responsable_unidad','reportes.ver'),
  ('responsable_unidad','admin.roles'),
  ('coordinador_clinico','dashboard.ver'), ('coordinador_clinico','casos.ver'),
  ('coordinador_clinico','casos.crear'), ('coordinador_clinico','agenda.ver'),
  ('coordinador_clinico','expediente.ver'), ('coordinador_clinico','reportes.ver'),
  ('supervisor_clinico','casos.ver'), ('supervisor_clinico','expediente.ver'),
  ('supervisor_clinico','supervision.revisar'), ('supervisor_clinico','supervision.comentar'),
  ('terapeuta','casos.ver'), ('terapeuta','expediente.ver'),
  ('terapeuta','expediente.editar'), ('terapeuta','expediente.documentos'),
  ('coterapeuta','casos.ver'), ('coterapeuta','expediente.ver'), ('coterapeuta','expediente.editar'),
  ('clinico_administrativo','agenda.ver'), ('clinico_administrativo','agenda.programar'),
  ('clinico_administrativo','expediente.estado'),
  ('tallerista','agenda.ver'), ('tallerista','expediente.estado'),
  ('persona_usuaria','miportal.ver'), ('persona_usuaria','miportal.tareas'), ('persona_usuaria','miportal.notas'))
on conflict (rol_id, permiso_id) do nothing;
commit;
