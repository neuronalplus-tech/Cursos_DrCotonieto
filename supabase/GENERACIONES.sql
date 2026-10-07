-- =============================================================
--  GENERACIONES
--
--  QUÉ RESUELVE
--  Una institución no da "un curso": da "Diplomado 2026-1", con
--  fechas, cupo y cierre. El mismo curso se imparte varias veces y
--  cada edición tiene su grupo, su calendario y sus resultados.
--
--  Sin esto, todos los alumnos que han pasado por un curso desde
--  que existe se mezclan en la misma lista, y la pregunta que de
--  verdad se hacen —"¿cómo salió la generación de marzo?"— no se
--  puede responder.
--
--  GENERACIÓN NO ES LO MISMO QUE RUTA
--  `acceso.grupo` ya existe y es la RUTA dentro de un curso
--  (Acompañamiento / Clínica): dos caminos en paralelo, a la vez.
--  La generación es CUÁNDO lo cursaste. Son ejes distintos y se
--  combinan: alguien es de la generación 2026-1, ruta Clínica.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 y ROLES_3 aplicados.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA TABLA
--
--    `cupo` en null = sin límite. Es lo más común, y obligar a
--    poner un número inventado solo genera datos falsos.
-- -------------------------------------------------------------
create table if not exists public.generaciones (
  id           bigserial primary key,
  curso_id     bigint not null references public.cursos(id) on delete cascade,
  nombre       text not null,
  fecha_inicio date,
  fecha_fin    date,
  cupo         integer,
  activa       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create index if not exists generaciones_curso_idx
  on public.generaciones (curso_id, fecha_inicio desc);

-- Dos generaciones del mismo curso no pueden llamarse igual: si no,
-- los reportes mezclarían dos cosas con el mismo nombre.
create unique index if not exists generaciones_curso_nombre_idx
  on public.generaciones (curso_id, lower(nombre));

-- -------------------------------------------------------------
-- 2) A QUÉ GENERACIÓN PERTENECE CADA INSCRIPCIÓN
--
--    `on delete set null`: borrar una generación no desinscribe a
--    nadie. Pierden la etiqueta, no el acceso ni su progreso.
-- -------------------------------------------------------------
alter table public.acceso
  add column if not exists generacion_id bigint
  references public.generaciones(id) on delete set null;

create index if not exists acceso_generacion_idx
  on public.acceso (generacion_id);

-- -------------------------------------------------------------
-- 3) QUIÉN LAS TOCA
--
--    Las lee cualquiera con sesión: el alumno necesita saber de
--    qué generación es y cuándo termina. Las escribe quien
--    gestiona el curso, igual que todo lo demás del curso.
-- -------------------------------------------------------------
alter table public.generaciones enable row level security;

drop policy if exists "generaciones_select" on public.generaciones;
create policy "generaciones_select" on public.generaciones
  for select to authenticated
  using (
    public.puede_gestionar_curso(curso_id)
    or public.tiene_acceso_al_curso(curso_id)
  );

drop policy if exists "generaciones_insert" on public.generaciones;
create policy "generaciones_insert" on public.generaciones
  for insert to authenticated
  with check (public.puede_gestionar_curso(curso_id));

drop policy if exists "generaciones_update" on public.generaciones;
create policy "generaciones_update" on public.generaciones
  for update to authenticated
  using (public.puede_gestionar_curso(curso_id))
  with check (public.puede_gestionar_curso(curso_id));

drop policy if exists "generaciones_delete" on public.generaciones;
create policy "generaciones_delete" on public.generaciones
  for delete to authenticated
  using (public.puede_gestionar_curso(curso_id));

-- -------------------------------------------------------------
-- 4) CUÁNTA GENTE LLEVA UNA GENERACIÓN
--
--    Para enseñar "18 de 25" sin traerse la lista entera, y para
--    que el cupo se compruebe contra el mismo número en todas las
--    pantallas.
-- -------------------------------------------------------------
create or replace function public.inscritos_en_generacion(p_gen bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.acceso a where a.generacion_id = p_gen
$$;

revoke all on function public.inscritos_en_generacion(bigint) from public;
grant execute on function public.inscritos_en_generacion(bigint) to authenticated;

-- La bitácora también las vigila, si está instalada.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'registrar_auditoria'
  ) then
    drop trigger if exists auditar_generaciones on public.generaciones;
    create trigger auditar_generaciones
      after insert or update or delete on public.generaciones
      for each row execute function public.registrar_auditoria();
  end if;
end $$;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 5) COMPROBACIÓN
-- -------------------------------------------------------------
select 'tabla generaciones' as que, count(*) as n, '1' as esperado
from information_schema.tables
where table_schema = 'public' and table_name = 'generaciones'

union all
select 'columna en acceso', count(*), '1'
from information_schema.columns
where table_schema = 'public' and table_name = 'acceso'
  and column_name = 'generacion_id'

union all
select 'politicas', count(*), '4'
from pg_policies
where schemaname = 'public' and tablename = 'generaciones';

-- =============================================================
--  SOBRE LAS CERTIFICACIONES
--  Una certificación que agrupa VARIOS cursos es otra cosa: un
--  "programa" con sus propios requisitos y su propio documento
--  final. No se modela aquí a propósito, porque meterlo dentro de
--  generaciones acabaría con una tabla que significa dos cosas.
--  Es el paso siguiente si lo necesitas.
-- =============================================================
