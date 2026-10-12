/* ==============================================================
   MATERIAL DEL TALLER PROTEGIDO A NIVEL DE DATOS
   --------------------------------------------------------------
   Qué blindamos y por qué.
   Los enlaces sensibles del taller (grabación, cuadernillos,
   botones extra) vivían como columnas de `cursos`. La política
   cursos_select deja leer cualquier curso `activo` también a
   `anon`, y el front hace select('*'): con la llave pública
   —pública por diseño en Supabase— cualquiera leía esos enlaces
   por la API aunque la pantalla los ocultara. Ocultar en la
   interfaz no es proteger.

   La salida: mudar esas columnas a su propia tabla `curso_material`
   con RLS que NO da lectura directa, y servirlas SOLO por el RPC
   security definer material_de_taller(curso_id), que aplica la
   regla real:
     · admin o quien gestiona el curso ....... siempre
     · curso gratuito con sesión iniciada .... sí  (basta registrarse)
     · curso de pago ......................... solo con acceso (acceso)
     · sin sesión ............................ nada
   select('*') sobre `cursos` sigue funcionando: las columnas
   sensibles simplemente ya no viven ahí.

   QUÉ SE QUEDA PÚBLICO EN `cursos` (a propósito)
   link_registro, registro_texto, registro_activo, fecha_sesion,
   link_sesion_vivo, sesion_vivo_* y constancia_gratuita_activa:
   son el embudo (apartar lugar a la sesión en vivo), no material
   entregable. La sesión en vivo se difunde por ahí; lo que se
   protege es lo que se entrega DESPUÉS (grabación y cuadernillos).
   ============================================================== */

-- 1) Tabla del material sensible: una fila por curso.
create table if not exists public.curso_material (
  curso_id integer primary key
    references public.cursos(id) on delete cascade,
  link_grabacion     text,
  grabacion_texto    text,
  grabacion_activo   boolean default true,
  link_materiales    text,
  materiales_texto   text,
  materiales_activo  boolean default false,
  botones_extra      jsonb default '[]'::jsonb,
  actualizado_el     timestamp with time zone default now()
);
alter table public.curso_material enable row level security;
-- Sin lectura/escritura directa: todo pasa por los RPC de abajo.
revoke all on public.curso_material from anon, authenticated;

-- 2) Migración: copiar lo que haya y soltar las columnas viejas.
insert into public.curso_material (
  curso_id, link_grabacion, grabacion_texto, grabacion_activo,
  link_materiales, materiales_texto, materiales_activo, botones_extra
)
select c.id, c.link_grabacion, c.grabacion_texto,
       coalesce(c.grabacion_activo, true),
       c.link_materiales, c.materiales_texto, c.materiales_activo,
       coalesce(c.botones_extra, '[]'::jsonb)
from public.cursos c
on conflict (curso_id) do nothing;

alter table public.cursos drop column if exists link_grabacion;
alter table public.cursos drop column if exists grabacion_texto;
alter table public.cursos drop column if exists grabacion_activo;
alter table public.cursos drop column if exists link_materiales;
alter table public.cursos drop column if exists materiales_texto;
alter table public.cursos drop column if exists materiales_activo;
alter table public.cursos drop column if exists botones_extra;

-- 3) Lectura del material (security definer): aplica la regla de acceso.
--    Devuelve el jsonb del material o null si no hay permiso.
create or replace function public.material_de_taller(p_curso_id integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v jsonb; v_gratuito boolean;
begin
  select gratuito into v_gratuito from public.cursos where id = p_curso_id;
  if not found then return null; end if;

  if not (
    public.es_admin()
    or public.puede_gestionar_curso(p_curso_id)
    or (v_gratuito and auth.uid() is not null)
    or exists (select 1 from public.acceso a
               where a.usuario_id = auth.uid() and a.curso_id = p_curso_id)
  ) then
    return null;  -- sin sesión, o de pago sin inscripción
  end if;

  select to_jsonb(m) - 'curso_id' into v
    from public.curso_material m where m.curso_id = p_curso_id;
  return coalesce(v, '{}'::jsonb);
end $$;
revoke all on function public.material_de_taller(integer) from public;
grant execute on function public.material_de_taller(integer) to anon, authenticated;

-- 4) Escritura del material: admin o quien gestiona el curso.
--    Solo pisa las claves presentes en p_material (operador ?),
--    así el editor no borra por accidente lo que no tocó.
create or replace function public.guardar_material_taller(
  p_curso_id integer, p_material jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.es_admin() or public.puede_gestionar_curso(p_curso_id)) then
    raise exception 'Sin permiso para editar el material de este taller';
  end if;

  insert into public.curso_material (curso_id) values (p_curso_id)
    on conflict (curso_id) do nothing;

  update public.curso_material set
    link_grabacion    = case when p_material ? 'link_grabacion'    then nullif(p_material->>'link_grabacion','')    else link_grabacion end,
    grabacion_texto   = case when p_material ? 'grabacion_texto'   then nullif(p_material->>'grabacion_texto','')   else grabacion_texto end,
    grabacion_activo  = case when p_material ? 'grabacion_activo'  then (p_material->>'grabacion_activo')::boolean  else grabacion_activo end,
    link_materiales   = case when p_material ? 'link_materiales'   then nullif(p_material->>'link_materiales','')   else link_materiales end,
    materiales_texto  = case when p_material ? 'materiales_texto'  then nullif(p_material->>'materiales_texto','')  else materiales_texto end,
    materiales_activo = case when p_material ? 'materiales_activo' then (p_material->>'materiales_activo')::boolean else materiales_activo end,
    botones_extra     = case when p_material ? 'botones_extra'     then (p_material->'botones_extra')               else botones_extra end,
    actualizado_el    = now()
  where curso_id = p_curso_id;
end $$;
revoke all on function public.guardar_material_taller(integer, jsonb) from public;
grant execute on function public.guardar_material_taller(integer, jsonb) to authenticated;

-- 5) Cuadernillos en `recursos`: fuera el acceso de `anon`.
--    Un curso gratuito pide sesión; uno de pago, inscripción.
drop policy if exists "leer_recursos" on public.recursos;
create policy "leer_recursos" on public.recursos
  as permissive for select to authenticated
  using (
    exists (select 1 from public.modulos m
            join public.cursos c on c.id = m.curso_id
            where m.id = recursos.modulo_id and c.gratuito = true)
    or exists (select 1 from public.acceso a
               join public.modulos m on m.id = recursos.modulo_id
               where a.usuario_id = auth.uid() and a.curso_id = m.curso_id)
  );
