-- PASMU 42: rol «experiencia_demo» — exploración guiada solo-lectura por invitación.
-- Solo PRUEBAS. Idempotente. Requiere 17, 24, 32 y 36 aplicados. No borra ni modifica roles existentes.
-- Principios (ver docs/SEGURIDAD_PASMU.md, PLAN_MAESTRO §2 fuera de alcance, MATRIZ_ACEPTACION ACC-09):
--   * Solo permisos .ver + perfil.editar. Nada .crear/.editar/.exportar/.admin/.configuracion.
--   * Ámbito 'unidad' sobre la unidad DEMO (codigo 'DEMO'). Sin acceso a UAP ni a otras unidades.
--   * La defensa real es RLS + chequeos de permiso dentro de cada RPC (fallan 42501).
--     Por eso NO se revocan EXECUTE: el patrón del proyecto es fail-closed dentro de la función.
--   * Vigencia: al dar de alta, crear el miembro con fecha_fin (p. ej. +15 días). La base lo auto-revoca.
--   * Datos: usar SOLO casos sintéticos SIN-xxxxxxxx en la unidad DEMO. Nunca PII real.
begin;

-- ——— unidad DEMO (misma institución que UAP) ———
insert into public.unidades (institucion_id, nombre, codigo, tipo)
select i.id, 'Unidad de demostración', 'DEMO', 'demostracion'
from public.instituciones i
where i.siglas = 'UE'
  and not exists (select 1 from public.unidades u where u.codigo = 'DEMO')
on conflict (codigo) do update set nombre = excluded.nombre, activo = true;

-- ——— rol ———
insert into public.roles (codigo, nombre, descripcion) values
  ('experiencia_demo', 'Experiencia DEMO', 'Exploración guiada solo-lectura por invitación; sin edición ni exportación masiva')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = true;

-- ——— permisos de lectura (deben existir desde 05/17/36; se crean si faltaran) ———
insert into public.permisos (codigo, descripcion, categoria) values
  ('dashboard.ver', 'Ver dashboard institucional', 'general'),
  ('casos.ver', 'Consultar casos', 'atencion'),
  ('agenda.ver', 'Ver agenda', 'operacion'),
  ('expediente.ver', 'Ver expediente', 'clinico'),
  ('reportes.ver', 'Ver reportes', 'indicadores'),
  ('perfil.editar', 'Editar los datos de contacto del propio perfil', 'general')
on conflict (codigo) do update set descripcion = excluded.descripcion, activo = true;

-- ——— asignación mínima solo-lectura, ámbito unidad ———
insert into public.rol_permisos (rol_id, permiso_id, ambito)
select r.id, p.id, 'unidad'
from public.roles r, public.permisos p
where r.codigo = 'experiencia_demo'
  and p.codigo in ('dashboard.ver', 'casos.ver', 'agenda.ver', 'expediente.ver', 'reportes.ver', 'perfil.editar')
on conflict (rol_id, permiso_id) do nothing;

-- ——— blindaje: el rol demo NUNCA debe acumular escritura aunque otro script lo toque ———
-- Se eliminan asignaciones de escritura si alguna vez se colaran (idempotente, no toca otros roles).
delete from public.rol_permisos rp
using public.roles r, public.permisos p
where rp.rol_id = r.id and rp.permiso_id = p.id
  and r.codigo = 'experiencia_demo'
  and p.codigo not in ('dashboard.ver', 'casos.ver', 'agenda.ver', 'expediente.ver', 'reportes.ver', 'perfil.editar');

-- ——— pre-alta: permitir invitar experiencia_demo (se conserva la lista definitiva de 36) ———
-- 36 definió: responsable_unidad, coordinador_clinico, supervisor_clinico, clinico_administrativo,
-- practicante, tallerista, terapeuta. Aquí se reinstala la misma función + experiencia_demo.
-- Se conservan: validación de correo, regla «solo Dirección da de alta responsables»,
-- alcance por unidad vía altas.personal y auditoría. La verificación 37 sigue pasando:
-- no contiene 'coterapeuta' y sí contiene 'practicante'.
create or replace function public.pasmu_preAlta_equipo(_email text, _nombre text, _rol text, _unidad bigint, _programa bigint default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_yo uuid := private.pasmu_current_persona_id(); v_id uuid;
begin
  if v_yo is null then raise exception 'Perfil requerido.' using errcode = '42501'; end if;
  if _rol not in ('responsable_unidad', 'coordinador_clinico', 'supervisor_clinico', 'clinico_administrativo', 'practicante', 'tallerista', 'terapeuta', 'experiencia_demo') then
    raise exception 'Rol de equipo no permitido.' using errcode = '22023'; end if;
  if lower(btrim(_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then raise exception 'El correo no es válido.' using errcode = '22023'; end if;
  -- Experiencia DEMO solo en la unidad DEMO: evita invitar exploradores a unidades operativas.
  if _rol = 'experiencia_demo' and not exists (select 1 from public.unidades u where u.id = _unidad and u.codigo = 'DEMO') then
    raise exception 'La experiencia DEMO solo puede invitarse a la unidad DEMO.' using errcode = '22023'; end if;
  -- Dirección da de alta a responsables; la persona responsable, al resto y solo en sus unidades.
  if _rol = 'responsable_unidad' then
    if not (private.pasmu_es_admin_global() or 'direccion_pasmu' = any (private.pasmu_mis_roles())) then
      raise exception 'Solo Dirección PASMU da de alta a personas responsables de unidad.' using errcode = '42501'; end if;
  elsif not (private.pasmu_es_admin_global() or private.pasmu_has_permission('altas.personal', _unidad)) then
    raise exception 'Solo en tus unidades.' using errcode = '42501'; end if;
  end if;
  insert into public.prealtas_equipo (email, nombre, rol_codigo, unidad_id, programa_id, creada_por)
  values (lower(btrim(_email)), btrim(_nombre), _rol, _unidad, _programa, v_yo)
  returning id into v_id;
  perform private.pasmu_auditar(_unidad, 'prealtas_equipo', v_id::text, 'invitar', jsonb_build_object('rol', _rol));
  return v_id;
end $$;

revoke all on function public.pasmu_preAlta_equipo(text,text,text,bigint,bigint) from public, anon;
grant execute on function public.pasmu_preAlta_equipo(text,text,text,bigint,bigint) to authenticated;

commit;
