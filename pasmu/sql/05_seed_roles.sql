-- PASMU: seed inicial de roles y permisos
-- Este archivo sirve como base para la primera validación con Supabase.

insert into instituciones (nombre, siglas, tipo)
select 'UAEH', 'UE', 'universidad'
where not exists (
  select 1 from instituciones where siglas = 'UE'
);

insert into unidades (institucion_id, nombre, codigo, tipo)
select i.id, 'Unidad de Atención Psicológica', 'UAP', 'atencion'
from instituciones i
where i.siglas = 'UE'
  and not exists (
    select 1 from unidades u where u.codigo = 'UAP'
  )
on conflict (codigo) do nothing;

insert into programas (unidad_id, nombre, codigo, descripcion)
select u.id, p.nombre, p.codigo, p.descripcion
from unidades u
cross join (values
  ('Atención Individual', 'AIND', 'Atención psicológica individual'),
  ('Talleres Preventivos', 'TALL', 'Actividades preventivas y promoción'),
  ('Canalización y Seguimiento', 'CANAL', 'Escalamiento y seguimiento institucional')
) as p(nombre, codigo, descripcion)
where u.codigo = 'UAP'
  and not exists (
    select 1
    from programas existing
    where existing.unidad_id = u.id
      and existing.codigo = p.codigo
  );

insert into roles (codigo, nombre, descripcion)
values
  ('coordinador_pasu', 'Coordinador PASMU', 'Administra la unidad y coordina indicadores'),
  ('psicologo', 'Psicólogo', 'Atiende casos y registra expediente'),
  ('supervisor', 'Supervisor', 'Supervisa casos y practicantes'),
  ('practicante', 'Practicante', 'Participa en atención y seguimiento bajo supervisión'),
  ('administrativo', 'Administrativo', 'Gestiona agenda y procesos administrativos'),
  ('analista_indicadores', 'Analista de indicadores', 'Consulta y reporta métricas'),
  ('direccion', 'Dirección', 'Revisa resultados institucionales'),
  ('seguridad', 'Seguridad', 'Revisa eventos de auditoría y seguridad')
on conflict (codigo) do nothing;

insert into permisos (codigo, descripcion, categoria)
values
  ('dashboard.ver', 'Ver dashboard institucional', 'general'),
  ('casos.ver', 'Consultar casos', 'atencion'),
  ('casos.crear', 'Crear casos', 'atencion'),
  ('casos.editar', 'Editar casos', 'atencion'),
  ('casos.cerrar', 'Cerrar casos', 'atencion'),
  ('agenda.ver', 'Ver agenda', 'operacion'),
  ('agenda.programar', 'Programar citas', 'operacion'),
  ('expediente.ver', 'Ver expediente', 'clinico'),
  ('expediente.editar', 'Editar expediente', 'clinico'),
  ('expediente.documentos', 'Gestionar documentos y archivos', 'clinico'),
  ('reportes.ver', 'Ver reportes', 'indicadores'),
  ('reportes.exportar', 'Exportar reportes', 'indicadores'),
  ('admin.unidades', 'Administrar unidades', 'admin'),
  ('admin.roles', 'Administrar roles y permisos', 'admin'),
  ('admin.auditoria', 'Ver auditoría institucional', 'admin'),
  ('seguridad.ver', 'Consultar eventos de seguridad', 'seguridad')
on conflict (codigo) do nothing;

-- Asignación de permisos por rol
insert into rol_permisos (rol_id, permiso_id, ambito)
select rr.id, pp.id, 'institucion'
from (
  values
    ('coordinador_pasu', 'dashboard.ver'),
    ('coordinador_pasu', 'casos.ver'),
    ('coordinador_pasu', 'casos.crear'),
    ('coordinador_pasu', 'casos.editar'),
    ('coordinador_pasu', 'agenda.ver'),
    ('coordinador_pasu', 'agenda.programar'),
    ('coordinador_pasu', 'expediente.ver'),
    ('coordinador_pasu', 'reportes.ver'),
    ('coordinador_pasu', 'reportes.exportar'),
    ('coordinador_pasu', 'admin.unidades'),
    ('coordinador_pasu', 'admin.roles'),
    ('coordinador_pasu', 'admin.auditoria'),

    ('psicologo', 'casos.ver'),
    ('psicologo', 'casos.editar'),
    ('psicologo', 'agenda.ver'),
    ('psicologo', 'agenda.programar'),
    ('psicologo', 'expediente.ver'),
    ('psicologo', 'expediente.editar'),
    ('psicologo', 'expediente.documentos'),

    ('supervisor', 'casos.ver'),
    ('supervisor', 'expediente.ver'),
    ('supervisor', 'agenda.ver'),
    ('supervisor', 'reportes.ver'),

    ('practicante', 'casos.ver'),
    ('practicante', 'agenda.ver'),
    ('practicante', 'expediente.ver'),

    ('administrativo', 'agenda.ver'),
    ('administrativo', 'agenda.programar'),
    ('administrativo', 'casos.ver'),

    ('analista_indicadores', 'reportes.ver'),
    ('analista_indicadores', 'reportes.exportar'),

    ('direccion', 'dashboard.ver'),
    ('direccion', 'reportes.ver'),
    ('direccion', 'reportes.exportar'),
    ('direccion', 'admin.auditoria'),

    ('seguridad', 'seguridad.ver'),
    ('seguridad', 'admin.auditoria')
) as asignaciones(codigo_rol, codigo_permiso)
join roles rr on rr.codigo = asignaciones.codigo_rol
join permisos pp on pp.codigo = asignaciones.codigo_permiso
on conflict (rol_id, permiso_id) do nothing;

-- Muestra la semilla de roles y permisos para validación
select codigo, nombre from roles order by id;
select codigo, categoria from permisos order by id;
