-- =============================================================
--  FORO · Calificar las aportaciones
--
--  QUÉ AÑADE
--  Un tema puede marcarse como evaluable. Entonces cada respuesta
--  recibe una nota del 1 al 10, y la calificación de esa persona
--  en el tema es el PROMEDIO de sus aportaciones calificadas.
--
--  Promedio y no suma: si pides tres aportaciones y alguien hace
--  cinco, sumar lo premiaría por cantidad. El promedio mide cómo
--  participa, no cuánto.
--
--  SIN RÚBRICA DESPLEGABLE
--  A diferencia de las tareas, aquí no hay criterios con niveles.
--  Lo que se espera se escribe en el cuerpo del tema, que es donde
--  el alumno ya está mirando cuando va a responder.
--
--  ARREGLA ADEMÁS UN FALLO DE ORDENACIÓN
--  La lista de temas ordena por `actualizado_en`, pero ese campo
--  solo cambiaba al editar el tema, nunca al responderlo. Un tema
--  con respuestas recientes quedaba por debajo de otro sin
--  movimiento. Ahora lo mueve un disparador.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 y ROLES_3 aplicados.
-- =============================================================

-- -------------------------------------------------------------
-- 1) EL TEMA DECIDE SI SE CALIFICA
-- -------------------------------------------------------------
alter table public.foro_hilos
  add column if not exists califica boolean not null default false;

alter table public.foro_hilos
  add column if not exists puntos_max numeric not null default 10;

-- -------------------------------------------------------------
-- 2) LA NOTA VIVE EN CADA APORTACIÓN
-- -------------------------------------------------------------
alter table public.foro_respuestas
  add column if not exists calificacion numeric;

alter table public.foro_respuestas
  add column if not exists calificado_por uuid;

alter table public.foro_respuestas
  add column if not exists calificado_en timestamptz;

-- -------------------------------------------------------------
-- 3) QUE NADIE SE PONGA SU PROPIA NOTA
--
--    Aquí RLS no basta. La política de UPDATE deja al autor editar
--    SU respuesta (para corregir lo que escribió), y RLS trabaja
--    por filas, no por columnas: nada le impediría mandar también
--    un `calificacion: 10` en esa misma petición.
--
--    Este disparador rechaza cualquier cambio en las columnas de
--    calificación hecho por quien no gestiona el curso. La regla
--    queda en la base, donde no se puede esquivar desde el
--    navegador.
-- -------------------------------------------------------------
create or replace function public.proteger_calificacion_foro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso bigint;
begin
  -- Si no se tocan esas columnas, no hay nada que vigilar.
  if NEW.calificacion is not distinct from OLD.calificacion
     and NEW.calificado_por is not distinct from OLD.calificado_por
     and NEW.calificado_en is not distinct from OLD.calificado_en then
    return NEW;
  end if;

  select h.curso_id into v_curso
  from public.foro_hilos h where h.id = NEW.hilo_id;

  if not public.puede_gestionar_curso(v_curso) then
    raise exception 'Solo quien gestiona el curso puede calificar aportaciones';
  end if;

  return NEW;
end
$$;

drop trigger if exists proteger_calificacion on public.foro_respuestas;
create trigger proteger_calificacion
  before update on public.foro_respuestas
  for each row execute function public.proteger_calificacion_foro();

-- -------------------------------------------------------------
-- 4) EL TEMA SUBE AL RESPONDER
--
--    security definer porque toca `foro_hilos`, donde un alumno no
--    tiene permiso de escritura. Solo mueve la marca de tiempo.
-- -------------------------------------------------------------
create or replace function public.mover_hilo_al_responder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.foro_hilos
     set actualizado_en = now()
   where id = NEW.hilo_id;
  return NEW;
end
$$;

drop trigger if exists mover_hilo on public.foro_respuestas;
create trigger mover_hilo
  after insert on public.foro_respuestas
  for each row execute function public.mover_hilo_al_responder();

-- -------------------------------------------------------------
-- 5) EL PROMEDIO DE CADA QUIEN
--
--    Se calcula aquí y no en el navegador para que la nota del
--    foro signifique lo mismo en todas las pantallas que la
--    muestren.
--
--    Las respuestas borradas no cuentan: lo contrario permitiría
--    bajar el promedio de alguien borrando su mejor aportación.
-- -------------------------------------------------------------
create or replace function public.promedio_foro(p_hilo bigint, p_usuario uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(r.calificacion), 2)
  from public.foro_respuestas r
  where r.hilo_id = p_hilo
    and r.autor_id = p_usuario
    and r.borrada = false
    and r.calificacion is not null
$$;

revoke all on function public.promedio_foro(bigint, uuid) from public;
grant execute on function public.promedio_foro(bigint, uuid) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 6) COMPROBACIÓN
-- -------------------------------------------------------------
select 'columnas en foro_hilos' as que, count(*) as n, '2' as esperado
from information_schema.columns
where table_schema = 'public' and table_name = 'foro_hilos'
  and column_name in ('califica', 'puntos_max')

union all
select 'columnas en foro_respuestas', count(*), '3'
from information_schema.columns
where table_schema = 'public' and table_name = 'foro_respuestas'
  and column_name in ('calificacion', 'calificado_por', 'calificado_en')

union all
select 'disparadores', count(*), '2'
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relname = 'foro_respuestas'
  and t.tgname in ('proteger_calificacion', 'mover_hilo');

-- =============================================================
--  SOBRE LAS RAMIFICACIONES
--  `foro_respuestas` no tiene columna de respuesta-a-respuesta:
--  todas cuelgan del tema, en orden cronológico. Añadir hilos
--  anidados es un cambio aparte (una columna `responde_a` y la
--  interfaz para pintar el árbol). Dilo si lo quieres y lo
--  hacemos; no está incluido aquí.
-- =============================================================
