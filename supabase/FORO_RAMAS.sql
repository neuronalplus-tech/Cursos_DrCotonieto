-- =============================================================
--  FORO · Respuestas anidadas (ramas)
--
--  QUÉ CAMBIA
--  Hasta aquí todas las respuestas colgaban del tema, en una sola
--  lista cronológica. Ahora una respuesta puede responder a otra,
--  que es como realmente conversa un grupo: alguien plantea algo y
--  tres personas le contestan a él, no al tema.
--
--  POR QUÉ `on delete set null` Y NO `cascade`
--  Con cascade, borrar una aportación se llevaría todas las que
--  cuelgan de ella. Eso destruiría trabajo de OTRAS personas, y con
--  el foro evaluable también sus calificaciones. Con set null, las
--  respuestas huérfanas suben al nivel del tema: se pierde el hilo
--  de la conversación, pero no el contenido ni las notas.
--
--  LA CALIFICACIÓN NO CAMBIA
--  Una respuesta anidada sigue siendo una aportación de su autor y
--  cuenta igual en su promedio. No hace falta tocar nada de eso.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere FORO_CALIFICACION.sql aplicado.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA COLUMNA
-- -------------------------------------------------------------
alter table public.foro_respuestas
  add column if not exists responde_a bigint
  references public.foro_respuestas(id) on delete set null;

create index if not exists foro_respuestas_rama_idx
  on public.foro_respuestas (responde_a);

-- -------------------------------------------------------------
-- 2) QUE UNA RAMA NO SALTE DE TEMA
--
--    Sin esto, nada impediría colgar una respuesta de otra que
--    pertenece a un hilo distinto: la conversación quedaría partida
--    entre dos temas y el árbol no se podría pintar.
--
--    Va como disparador y no como `check`, porque la comprobación
--    necesita consultar otra fila de la misma tabla.
-- -------------------------------------------------------------
create or replace function public.validar_rama_foro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hilo_padre bigint;
begin
  if NEW.responde_a is null then
    return NEW;
  end if;

  if NEW.responde_a = NEW.id then
    raise exception 'Una respuesta no puede responderse a sí misma';
  end if;

  select r.hilo_id into v_hilo_padre
  from public.foro_respuestas r where r.id = NEW.responde_a;

  if v_hilo_padre is null then
    raise exception 'La respuesta a la que contestas ya no existe';
  end if;

  if v_hilo_padre <> NEW.hilo_id then
    raise exception 'No se puede responder a una aportación de otro tema';
  end if;

  return NEW;
end
$$;

drop trigger if exists validar_rama on public.foro_respuestas;
create trigger validar_rama
  before insert or update on public.foro_respuestas
  for each row execute function public.validar_rama_foro();

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 3) COMPROBACIÓN
-- -------------------------------------------------------------
select 'columna responde_a' as que, count(*) as n, '1' as esperado
from information_schema.columns
where table_schema = 'public' and table_name = 'foro_respuestas'
  and column_name = 'responde_a'

union all
select 'disparador validar_rama', count(*), '1'
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relname = 'foro_respuestas' and t.tgname = 'validar_rama';

-- =============================================================
--  NOTA SOBRE LA PROFUNDIDAD
--  La base admite ramas tan hondas como se quiera. La interfaz las
--  pinta hasta cierto nivel y a partir de ahí deja de sangrar, para
--  que en un móvil no acaben en una columna de dos palabras. Los
--  datos siguen completos; es solo cómo se dibujan.
-- =============================================================
