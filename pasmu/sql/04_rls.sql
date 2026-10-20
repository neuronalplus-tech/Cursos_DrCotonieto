-- PASMU: RLS base para Supabase
-- Ejecutar después de 01_catalogos.sql, 02_atencion.sql y 03_reportes.sql.
-- Las políticas son conservadoras: las escrituras administrativas y de auditoría
-- requieren RPCs controladas que aún no forman parte del prototipo.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.pasmu_current_persona_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.personas p
  where p.auth_user_id = (select auth.uid())
    and p.activo = true
  limit 1
$$;

create or replace function private.pasmu_has_unit_permission(
  _codigo_permiso text,
  _unidad_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros m
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    join public.rol_permisos rp on rp.rol_id = m.rol_id
    join public.permisos pe on pe.id = rp.permiso_id
    where p.auth_user_id = (select auth.uid())
      and p.activo = true
      and m.activo = true
      and m.fecha_inicio <= current_date
      and (m.fecha_fin is null or m.fecha_fin >= current_date)
      and m.unidad_id = _unidad_id
      and r.activo = true
      and pe.codigo = _codigo_permiso
      and pe.activo = true
      and rp.ambito in ('institucion', 'unidad')
  )
$$;

create or replace function private.pasmu_is_unit_member(_unidad_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros m
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    where p.auth_user_id = (select auth.uid())
      and p.activo = true
      and r.activo = true
      and m.unidad_id = _unidad_id
      and m.activo = true
      and m.fecha_inicio <= current_date
      and (m.fecha_fin is null or m.fecha_fin >= current_date)
  )
$$;

create or replace function private.pasmu_has_permission(
  _codigo_permiso text,
  _unidad_id bigint default null,
  _programa_id bigint default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros m
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    join public.rol_permisos rp on rp.rol_id = m.rol_id
    join public.permisos pe on pe.id = rp.permiso_id
    where p.auth_user_id = (select auth.uid())
      and p.activo = true
      and m.activo = true
      and m.fecha_inicio <= current_date
      and (m.fecha_fin is null or m.fecha_fin >= current_date)
      and r.activo = true
      and (_unidad_id is null or m.unidad_id = _unidad_id)
      and (_programa_id is null or m.programa_id is null or m.programa_id = _programa_id)
      and (
        (_unidad_id is null and _programa_id is null)
        or _programa_id is not null
        or m.programa_id is null
      )
      and pe.codigo = _codigo_permiso
      and pe.activo = true
      and rp.ambito in ('institucion', 'unidad')
  )
$$;

create or replace function private.pasmu_case_has_permission(
  _caso_id bigint,
  _codigo_permiso text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.casos c
    join public.miembros m on m.unidad_id = c.unidad_id
    join public.personas p on p.id = m.persona_id
    join public.roles r on r.id = m.rol_id
    join public.rol_permisos rp on rp.rol_id = m.rol_id
    join public.permisos pe on pe.id = rp.permiso_id
    where c.id = _caso_id
      and p.auth_user_id = (select auth.uid())
      and p.activo = true
      and m.activo = true
      and m.fecha_inicio <= current_date
      and (m.fecha_fin is null or m.fecha_fin >= current_date)
      and (m.programa_id is null or m.programa_id = c.programa_id)
      and r.activo = true
      and pe.codigo = _codigo_permiso
      and pe.activo = true
      and (
        rp.ambito in ('institucion', 'unidad')
        or (
          rp.ambito = 'caso'
          and exists (
            select 1
            from public.caso_profesionales cp
            where cp.caso_id = c.id
              and cp.persona_id = p.id
              and cp.activo = true
          )
        )
      )
  )
$$;

create or replace function private.pasmu_is_case_professional(_caso_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.caso_profesionales cp
    join public.personas p on p.id = cp.persona_id
    where cp.caso_id = _caso_id
      and cp.activo = true
      and p.auth_user_id = (select auth.uid())
      and p.activo = true
  )
$$;

revoke all on function private.pasmu_current_persona_id() from public, anon;
revoke all on function private.pasmu_is_unit_member(bigint) from public, anon;
revoke all on function private.pasmu_has_permission(text, bigint, bigint) from public, anon;
revoke all on function private.pasmu_has_unit_permission(text, bigint) from public, anon;
revoke all on function private.pasmu_case_has_permission(bigint, text) from public, anon;
revoke all on function private.pasmu_is_case_professional(bigint) from public, anon;
grant execute on function private.pasmu_current_persona_id() to authenticated;
grant execute on function private.pasmu_is_unit_member(bigint) to authenticated;
grant execute on function private.pasmu_has_permission(text, bigint, bigint) to authenticated;
grant execute on function private.pasmu_has_unit_permission(text, bigint) to authenticated;
grant execute on function private.pasmu_case_has_permission(bigint, text) to authenticated;
grant execute on function private.pasmu_is_case_professional(bigint) to authenticated;

alter table public.instituciones enable row level security;
alter table public.unidades enable row level security;
alter table public.programas enable row level security;
alter table public.personas enable row level security;
alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.miembros enable row level security;
alter table public.personas_usuarias enable row level security;
alter table public.catalogo_instrumentos enable row level security;
alter table public.competencias enable row level security;
alter table public.casos enable row level security;
alter table public.caso_profesionales enable row level security;
alter table public.episodios enable row level security;
alter table public.notas_clinicas enable row level security;
alter table public.agenda enable row level security;
alter table public.evaluaciones_psicologicas enable row level security;
alter table public.documentos enable row level security;
alter table public.documento_archivos enable row level security;
alter table public.consentimientos enable row level security;
alter table public.practicantes enable row level security;
alter table public.horas_practica enable row level security;
alter table public.practicante_competencias enable row level security;
alter table public.indicadores enable row level security;
alter table public.metas_indicadores enable row level security;
alter table public.mediciones_indicadores enable row level security;
alter table public.auditoria_actividad enable row level security;
alter table public.auditoria_seguridad enable row level security;

-- La app cliente es de solo lectura. Las políticas de escritura por sí solas
-- no conceden acceso, pero privilegios globales/defaults podrían hacerlo.
revoke insert, update, delete, truncate, references, trigger on table
  public.instituciones,
  public.unidades,
  public.programas,
  public.personas,
  public.roles,
  public.permisos,
  public.rol_permisos,
  public.miembros,
  public.personas_usuarias,
  public.catalogo_instrumentos,
  public.competencias,
  public.casos,
  public.caso_profesionales,
  public.episodios,
  public.notas_clinicas,
  public.agenda,
  public.evaluaciones_psicologicas,
  public.documentos,
  public.documento_archivos,
  public.consentimientos,
  public.practicantes,
  public.horas_practica,
  public.practicante_competencias,
  public.indicadores,
  public.metas_indicadores,
  public.mediciones_indicadores,
  public.auditoria_actividad,
  public.auditoria_seguridad
from public, anon, authenticated;

-- Revocar también privilegios DML concedidos por columna en instalaciones previas.
do $$
declare
  v_table_name text;
  v_columns text;
begin
  for v_table_name in
    select table_name
    from (values
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
      ('auditoria_seguridad')
    ) as expected(table_name)
  loop
    select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
      into v_columns
    from pg_attribute attribute
    where attribute.attrelid = to_regclass(format('public.%I', v_table_name))
      and attribute.attnum > 0
      and not attribute.attisdropped;

    if v_columns is not null then
      execute format(
        'revoke insert (%1$s), update (%1$s), references (%1$s) on table public.%2$I from public, anon, authenticated',
        v_columns,
        v_table_name
      );
    end if;
  end loop;
end
$$;

-- RLS limita filas; estos privilegios limitan además qué columnas del cliente
-- pueden consultarse. Motivos, identidades y observaciones requieren flujos
-- clínicos con autorización específica, no el listado general de módulos.
revoke select on table public.casos from public, anon, authenticated;
grant select (id, unidad_id, programa_id, estado, fecha_apertura, fecha_cierre, created_at)
  on table public.casos to authenticated;

revoke select on table public.agenda from public, anon, authenticated;
grant select (id, unidad_id, fecha_inicio, fecha_fin, tipo, estado)
  on table public.agenda to authenticated;

revoke select on table public.notas_clinicas from public, anon, authenticated;
grant select (id, caso_id, tipo, contenido, created_at)
  on table public.notas_clinicas to authenticated;

revoke select on table public.indicadores from public, anon, authenticated;
grant select (id, codigo, nombre, descripcion, tipo, unidad_medida, activo)
  on table public.indicadores to authenticated;

revoke select on table public.metas_indicadores from public, anon, authenticated;
grant select (indicador_id, unidad_id, programa_id, periodo, meta)
  on table public.metas_indicadores to authenticated;

revoke select on table public.mediciones_indicadores from public, anon, authenticated;
grant select (id, indicador_id, unidad_id, programa_id, periodo, valor)
  on table public.mediciones_indicadores to authenticated;

revoke select on table public.personas from public, anon, authenticated;
grant select (id, auth_user_id, nombre, apellidos)
  on table public.personas to authenticated;

revoke select on table public.miembros from public, anon, authenticated;
grant select (
  id, persona_id, unidad_id, programa_id, rol_id,
  fecha_inicio, fecha_fin, activo
)
  on table public.miembros to authenticated;

revoke select on table public.unidades from public, anon, authenticated;
grant select (id, codigo, nombre)
  on table public.unidades to authenticated;

revoke select on table public.programas from public, anon, authenticated;
grant select (id, codigo, nombre)
  on table public.programas to authenticated;

revoke select on table public.roles from public, anon, authenticated;
grant select (id, codigo, nombre, activo)
  on table public.roles to authenticated;

revoke select on table public.rol_permisos from public, anon, authenticated;
grant select (rol_id, permiso_id)
  on table public.rol_permisos to authenticated;

revoke select on table public.permisos from public, anon, authenticated;
grant select (id, codigo, activo)
  on table public.permisos to authenticated;

-- Tablas sin una pantalla cliente aprobada: requieren grants por columna
-- cuando se habilite una interfaz que las consuma.
revoke select on table public.instituciones,
  public.personas_usuarias,
  public.catalogo_instrumentos,
  public.competencias,
  public.caso_profesionales,
  public.episodios,
  public.evaluaciones_psicologicas,
  public.documentos,
  public.documento_archivos,
  public.consentimientos,
  public.practicantes,
  public.horas_practica,
  public.practicante_competencias,
  public.auditoria_actividad,
  public.auditoria_seguridad
from public, anon, authenticated;

drop policy if exists instituciones_authenticated_read on public.instituciones;
create policy instituciones_authenticated_read on public.instituciones
  for select to authenticated using (true);

drop policy if exists unidades_member_read on public.unidades;
create policy unidades_member_read on public.unidades
  for select to authenticated
  using (private.pasmu_is_unit_member(id));

drop policy if exists programas_member_read on public.programas;
create policy programas_member_read on public.programas
  for select to authenticated
  using (private.pasmu_is_unit_member(unidad_id));

drop policy if exists personas_self_read on public.personas;
create policy personas_self_read on public.personas
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles
  for select to authenticated using (activo = true);

drop policy if exists permisos_authenticated_read on public.permisos;
create policy permisos_authenticated_read on public.permisos
  for select to authenticated using (activo = true);

drop policy if exists rol_permisos_authenticated_read on public.rol_permisos;
create policy rol_permisos_authenticated_read on public.rol_permisos
  for select to authenticated using (true);

drop policy if exists miembros_self_or_admin_read on public.miembros;
create policy miembros_self_or_admin_read on public.miembros
  for select to authenticated
  using (
    persona_id = (select private.pasmu_current_persona_id())
    or private.pasmu_has_permission('admin.roles', unidad_id)
  );

drop policy if exists personas_usuarias_case_read on public.personas_usuarias;
create policy personas_usuarias_case_read on public.personas_usuarias
  for select to authenticated
  using (
    exists (
      select 1
      from public.casos c
      where c.persona_usuaria_id = personas_usuarias.id
        and private.pasmu_case_has_permission(c.id, 'casos.ver')
        and private.pasmu_is_case_professional(c.id)
    )
  );

drop policy if exists catalogo_instrumentos_authenticated_read on public.catalogo_instrumentos;
create policy catalogo_instrumentos_authenticated_read on public.catalogo_instrumentos
  for select to authenticated using (activo = true);

drop policy if exists competencias_authenticated_read on public.competencias;
create policy competencias_authenticated_read on public.competencias
  for select to authenticated using (activo = true);

drop policy if exists casos_read_by_unit_permission on public.casos;
create policy casos_read_by_unit_permission on public.casos
  for select to authenticated
  using (private.pasmu_case_has_permission(id, 'casos.ver'));

drop policy if exists casos_insert_with_permission on public.casos;
create policy casos_insert_with_permission on public.casos
  for insert to authenticated
  with check (private.pasmu_has_permission('casos.crear', unidad_id, programa_id));

drop policy if exists casos_update_with_permission on public.casos;
create policy casos_update_with_permission on public.casos
  for update to authenticated
  using (private.pasmu_has_permission('casos.editar', unidad_id, programa_id))
  with check (private.pasmu_has_permission('casos.editar', unidad_id, programa_id));

drop policy if exists caso_profesionales_read_by_case_permission on public.caso_profesionales;
create policy caso_profesionales_read_by_case_permission on public.caso_profesionales
  for select to authenticated
  using (private.pasmu_case_has_permission(caso_id, 'casos.ver'));

drop policy if exists episodios_read_by_assigned_professional on public.episodios;
create policy episodios_read_by_assigned_professional on public.episodios
  for select to authenticated
  using (
    private.pasmu_case_has_permission(caso_id, 'expediente.ver')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists episodios_insert_by_assigned_professional on public.episodios;
create policy episodios_insert_by_assigned_professional on public.episodios
  for insert to authenticated
  with check (
    creado_por = (select private.pasmu_current_persona_id())
    and private.pasmu_case_has_permission(caso_id, 'expediente.editar')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists notas_read_by_assigned_professional on public.notas_clinicas;
create policy notas_read_by_assigned_professional on public.notas_clinicas
  for select to authenticated
  using (
    private.pasmu_case_has_permission(caso_id, 'expediente.ver')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists notas_insert_by_assigned_professional on public.notas_clinicas;
create policy notas_insert_by_assigned_professional on public.notas_clinicas
  for insert to authenticated
  with check (
    autor_id = (select private.pasmu_current_persona_id())
    and private.pasmu_case_has_permission(caso_id, 'expediente.editar')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists agenda_read_by_unit_permission on public.agenda;
create policy agenda_read_by_unit_permission on public.agenda
  for select to authenticated
  using (
    (caso_id is null and private.pasmu_has_permission('agenda.ver', unidad_id))
    or (
      caso_id is not null
      and private.pasmu_case_has_permission(caso_id, 'agenda.ver')
      and exists (
        select 1 from public.casos c
        where c.id = agenda.caso_id and c.unidad_id = agenda.unidad_id
      )
    )
  );

drop policy if exists agenda_insert_with_unit_permission on public.agenda;
create policy agenda_insert_with_unit_permission on public.agenda
  for insert to authenticated
  with check (
    (
      caso_id is null
      and private.pasmu_has_permission('agenda.programar', unidad_id)
    )
    or (
      caso_id is not null
      and private.pasmu_case_has_permission(caso_id, 'agenda.programar')
      and exists (
        select 1 from public.casos c
        where c.id = agenda.caso_id and c.unidad_id = agenda.unidad_id
      )
    )
  );

drop policy if exists agenda_update_with_unit_permission on public.agenda;
create policy agenda_update_with_unit_permission on public.agenda
  for update to authenticated
  using (
    (caso_id is null and private.pasmu_has_permission('agenda.programar', unidad_id))
    or (
      caso_id is not null
      and private.pasmu_case_has_permission(caso_id, 'agenda.programar')
      and exists (
        select 1 from public.casos c
        where c.id = agenda.caso_id and c.unidad_id = agenda.unidad_id
      )
    )
  )
  with check (
    (caso_id is null and private.pasmu_has_permission('agenda.programar', unidad_id))
    or (
      caso_id is not null
      and private.pasmu_case_has_permission(caso_id, 'agenda.programar')
      and exists (
        select 1 from public.casos c
        where c.id = agenda.caso_id and c.unidad_id = agenda.unidad_id
      )
    )
  );

drop policy if exists evaluaciones_read_by_assigned_professional on public.evaluaciones_psicologicas;
create policy evaluaciones_read_by_assigned_professional on public.evaluaciones_psicologicas
  for select to authenticated
  using (
    private.pasmu_case_has_permission(caso_id, 'expediente.ver')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists evaluaciones_insert_by_assigned_professional on public.evaluaciones_psicologicas;
create policy evaluaciones_insert_by_assigned_professional on public.evaluaciones_psicologicas
  for insert to authenticated
  with check (
    aplicado_por = (select private.pasmu_current_persona_id())
    and private.pasmu_case_has_permission(caso_id, 'expediente.editar')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists documentos_read_by_assigned_professional on public.documentos;
create policy documentos_read_by_assigned_professional on public.documentos
  for select to authenticated
  using (
    caso_id is not null
    and private.pasmu_case_has_permission(caso_id, 'expediente.ver')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists documentos_insert_by_assigned_professional on public.documentos;
create policy documentos_insert_by_assigned_professional on public.documentos
  for insert to authenticated
  with check (
    caso_id is not null
    and creado_por = (select private.pasmu_current_persona_id())
    and private.pasmu_case_has_permission(caso_id, 'expediente.documentos')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists documento_archivos_read_by_assigned_professional on public.documento_archivos;
create policy documento_archivos_read_by_assigned_professional on public.documento_archivos
  for select to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = documento_archivos.documento_id
        and d.caso_id is not null
        and private.pasmu_case_has_permission(d.caso_id, 'expediente.ver')
        and private.pasmu_is_case_professional(d.caso_id)
    )
  );

drop policy if exists documento_archivos_insert_by_assigned_professional on public.documento_archivos;
create policy documento_archivos_insert_by_assigned_professional on public.documento_archivos
  for insert to authenticated
  with check (
    uploaded_by = (select private.pasmu_current_persona_id())
    and exists (
      select 1
      from public.documentos d
      where d.id = documento_archivos.documento_id
        and d.caso_id is not null
        and private.pasmu_case_has_permission(d.caso_id, 'expediente.documentos')
        and private.pasmu_is_case_professional(d.caso_id)
    )
  );

drop policy if exists consentimientos_read_by_assigned_professional on public.consentimientos;
create policy consentimientos_read_by_assigned_professional on public.consentimientos
  for select to authenticated
  using (
    private.pasmu_case_has_permission(caso_id, 'expediente.ver')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists consentimientos_insert_by_assigned_professional on public.consentimientos;
create policy consentimientos_insert_by_assigned_professional on public.consentimientos
  for insert to authenticated
  with check (
    firmado_por = (select private.pasmu_current_persona_id())
    and private.pasmu_case_has_permission(caso_id, 'expediente.editar')
    and private.pasmu_is_case_professional(caso_id)
  );

drop policy if exists practicantes_self_or_supervisor_read on public.practicantes;
create policy practicantes_self_or_supervisor_read on public.practicantes
  for select to authenticated
  using (
    persona_id = (select private.pasmu_current_persona_id())
    or supervisor_id = (select private.pasmu_current_persona_id())
  );

drop policy if exists horas_practica_self_or_supervisor_read on public.horas_practica;
create policy horas_practica_self_or_supervisor_read on public.horas_practica
  for select to authenticated
  using (
    exists (
      select 1
      from public.practicantes pr
      where pr.id = horas_practica.practicante_id
        and (
          pr.persona_id = (select private.pasmu_current_persona_id())
          or pr.supervisor_id = (select private.pasmu_current_persona_id())
        )
    )
    or (
      caso_id is not null
      and private.pasmu_case_has_permission(caso_id, 'casos.ver')
      and private.pasmu_is_case_professional(caso_id)
    )
  );

drop policy if exists practicante_competencias_self_or_supervisor_read on public.practicante_competencias;
create policy practicante_competencias_self_or_supervisor_read on public.practicante_competencias
  for select to authenticated
  using (
    exists (
      select 1
      from public.practicantes pr
      where pr.id = practicante_competencias.practicante_id
        and (
          pr.persona_id = (select private.pasmu_current_persona_id())
          or pr.supervisor_id = (select private.pasmu_current_persona_id())
        )
    )
  );

drop policy if exists indicadores_read_with_report_permission on public.indicadores;
create policy indicadores_read_with_report_permission on public.indicadores
  for select to authenticated
  using (
    activo = true
    and private.pasmu_has_permission('reportes.ver')
  );

drop policy if exists metas_indicadores_read_with_report_permission on public.metas_indicadores;
create policy metas_indicadores_read_with_report_permission on public.metas_indicadores
  for select to authenticated
  using (
    unidad_id is not null
    and (
      private.pasmu_has_permission('reportes.ver', unidad_id, programa_id)
      or (
        programa_id is null
        and private.pasmu_has_unit_permission('reportes.ver', unidad_id)
      )
    )
  );

drop policy if exists mediciones_indicadores_read_with_report_permission on public.mediciones_indicadores;
create policy mediciones_indicadores_read_with_report_permission on public.mediciones_indicadores
  for select to authenticated
  using (
    private.pasmu_has_permission('reportes.ver', unidad_id, programa_id)
  );

-- Sin políticas deliberadamente: auditorías incluyen snapshots que pueden
-- contener datos clínicos. Exponerlas requiere vistas/RPCs redactadas y auditadas.
