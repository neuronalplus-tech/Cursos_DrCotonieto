-- =============================================================
--  ASISTENCIA VISIBLE PARA EL ALUMNO
--
--  QUÉ RESUELVE
--  El pase de lista ya funciona (PaseDeLista.jsx), pero el alumno
--  NUNCA ve su propia asistencia: las tablas `asistencia` y
--  `sesiones` no las puede leer por RLS (son de gestión). Para un
--  curso presencial o híbrido, "¿cuántas sesiones llevo?" es la
--  pregunta más repetida, y hoy no tiene respuesta del lado del
--  alumno.
--
--  QUÉ HACE
--  Una función `mi_asistencia(curso)` que devuelve SOLO la asistencia
--  de quien llama, para ese curso, sumando las sesiones de su(s)
--  generación(es). Es `security definer` (lee `asistencia`/`sesiones`
--  que el alumno no puede), pero está acotada a `auth.uid()`: nunca
--  devuelve la de otra persona, ni aunque se le pase otro curso.
--
--  El cálculo es EL MISMO que el del panel (asistencia_de_generacion):
--  presente y retardo cuentan para el porcentaje, sobre el total de
--  sesiones no canceladas.
--
--  CÓMO SE INSTALA
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Idempotente. Requiere ASISTENCIA.sql.
-- =============================================================

create or replace function public.mi_asistencia(p_curso bigint)
returns table (
  sesiones     int,
  presentes    int,
  retardos     int,
  ausencias    int,
  justificadas int,
  porcentaje   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with mis_gen as (
    -- Las generaciones de ESTE curso en las que estoy inscrito. Si no
    -- estoy inscrito, esto queda vacío y todo da 0 / null (sin fuga).
    select distinct a.generacion_id
      from public.acceso a
     where a.usuario_id = auth.uid()
       and a.curso_id = p_curso
       and a.generacion_id is not null
  ),
  sesiones_validas as (
    select s.id
      from public.sesiones s
      join mis_gen g on g.generacion_id = s.generacion_id
     where not s.cancelada
  )
  select
    (select count(*)::int from sesiones_validas),
    count(*) filter (where asi.estado = 'presente')::int,
    count(*) filter (where asi.estado = 'retardo')::int,
    count(*) filter (where asi.estado = 'ausente')::int,
    count(*) filter (where asi.justificada)::int,
    case when (select count(*) from sesiones_validas) > 0
         then round(
           count(*) filter (where asi.estado in ('presente', 'retardo'))::numeric
           / (select count(*) from sesiones_validas) * 100, 1)
         else null end
  from sesiones_validas sv
  left join public.asistencia asi
         on asi.usuario_id = auth.uid()
        and asi.sesion_id = sv.id;
$$;

revoke all on function public.mi_asistencia(bigint) from public;
grant execute on function public.mi_asistencia(bigint) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- PRUEBA DE ACEPTACIÓN
--   Con una cuenta de alumno inscrito en un curso CON sesiones y pase
--   de lista: en SQL Editor (o desde la app) `select * from
--   mi_asistencia(<curso>)` debe devolver sus números. Para un curso
--   en línea sin sesiones, devuelve sesiones = 0 (no se muestra nada).
-- -------------------------------------------------------------
