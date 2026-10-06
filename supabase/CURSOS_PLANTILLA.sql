-- =============================================================
--  CURSOS · Duplicar como plantilla, y borrar módulos
--
--  DOS COSAS QUE FALTABAN
--  1. Armar un curso parecido a otro obligaba a recrear módulo
--     por módulo y recurso por recurso a mano.
--  2. `modulos` no tenía política de DELETE: un módulo creado por
--     error se quedaba ahí para siempre.
--
--  POR QUÉ DUPLICAR ES UNA FUNCIÓN Y NO CÓDIGO DEL NAVEGADOR
--  Copiar un curso son decenas de inserciones encadenadas: el
--  curso, sus módulos, los recursos de cada módulo y los exámenes.
--  Hecho desde el navegador, un fallo a mitad deja un curso a
--  medio copiar que hay que limpiar a mano. Dentro de una función
--  todo ocurre en una transacción: o sale completo, o no sale.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 aplicado.
-- =============================================================

-- -------------------------------------------------------------
-- 1) BORRAR MÓDULOS
--
--    Se permite a quien gestiona el curso. Es menos grave que
--    borrar un curso: un módulo es una unidad de trabajo, y
--    equivocarse creando uno es común.
--
--    La red de seguridad es la BITÁCORA: al borrar queda guardada
--    la fila completa, así que siempre se puede ver qué decía y
--    rehacerla. Si no has corrido BITACORA.sql, corre ese antes
--    que este.
-- -------------------------------------------------------------
drop policy if exists "modulos_delete_gestion" on public.modulos;
create policy "modulos_delete_gestion" on public.modulos
  for delete to authenticated
  using (public.puede_gestionar_curso(curso_id));

-- -------------------------------------------------------------
-- 2) DUPLICAR UN CURSO COMPLETO
--
--    Copia el curso, sus módulos, los recursos de cada módulo y
--    los exámenes (los del curso y los de cada módulo).
--
--    NO copia: inscripciones, progreso, intentos de examen ni
--    foro. Eso es historia de las personas que cursaron el
--    original; una plantilla nueva nace vacía de gente.
--
--    La copia nace SIEMPRE archivada (`activo = false`), para que
--    no aparezca en la portada antes de que la revises.
--
--    La técnica: se pasa cada fila a jsonb, se le quita el `id`,
--    se le pone uno nuevo de la secuencia y se vuelve a convertir
--    en fila. Así no hay que enumerar columnas, y añadir un campo
--    a `cursos` mañana no rompe esta función.
-- -------------------------------------------------------------
create or replace function public.duplicar_curso(
  p_curso  bigint,
  p_titulo text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila        jsonb;
  v_nuevo_curso bigint;
  v_nuevo_mod   bigint;
  v_titulo      text;
  r             record;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede duplicar cursos';
  end if;

  select c.titulo into v_titulo from public.cursos c where c.id = p_curso;
  if v_titulo is null then
    raise exception 'El curso % no existe', p_curso;
  end if;
  v_titulo := coalesce(nullif(btrim(p_titulo), ''), v_titulo || ' (copia)');

  -- --- El curso ---
  select to_jsonb(c) into v_fila from public.cursos c where c.id = p_curso;
  v_nuevo_curso := nextval(pg_get_serial_sequence('public.cursos', 'id'));
  v_fila := v_fila || jsonb_build_object(
    'id', v_nuevo_curso,
    'titulo', v_titulo,
    'activo', false
  );
  insert into public.cursos select * from jsonb_populate_record(null::public.cursos, v_fila);

  -- --- Sus módulos, y dentro de cada uno sus recursos ---
  for r in select * from public.modulos where curso_id = p_curso order by orden loop
    v_fila := to_jsonb(r);
    v_nuevo_mod := nextval(pg_get_serial_sequence('public.modulos', 'id'));
    v_fila := v_fila || jsonb_build_object('id', v_nuevo_mod, 'curso_id', v_nuevo_curso);
    insert into public.modulos select * from jsonb_populate_record(null::public.modulos, v_fila);

    insert into public.recursos
    select * from jsonb_populate_record(
      null::public.recursos,
      to_jsonb(rec) || jsonb_build_object(
        'id', nextval(pg_get_serial_sequence('public.recursos', 'id')),
        'modulo_id', v_nuevo_mod
      )
    )
    from public.recursos rec
    where rec.modulo_id = r.id;

    -- Exámenes colgados de ESTE módulo.
    insert into public.examenes
    select * from jsonb_populate_record(
      null::public.examenes,
      to_jsonb(ex) || jsonb_build_object(
        'id', nextval(pg_get_serial_sequence('public.examenes', 'id')),
        'modulo_id', v_nuevo_mod
      )
    )
    from public.examenes ex
    where ex.modulo_id = r.id;
  end loop;

  -- --- Exámenes del curso (los que no cuelgan de un módulo) ---
  insert into public.examenes
  select * from jsonb_populate_record(
    null::public.examenes,
    to_jsonb(ex) || jsonb_build_object(
      'id', nextval(pg_get_serial_sequence('public.examenes', 'id')),
      'curso_id', v_nuevo_curso
    )
  )
  from public.examenes ex
  where ex.curso_id = p_curso and ex.modulo_id is null;

  return v_nuevo_curso;
end
$$;

revoke all on function public.duplicar_curso(bigint, text) from public;
grant execute on function public.duplicar_curso(bigint, text) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 3) COMPROBACIÓN
-- -------------------------------------------------------------
select 'politica de borrado de modulos' as que, count(*) as n, '1' as esperado
from pg_policies
where schemaname = 'public' and tablename = 'modulos' and cmd = 'DELETE'

union all
select 'funcion duplicar_curso', count(*), '1'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'duplicar_curso';

-- =============================================================
--  PARA PROBARLO
--  Desde el panel: Cursos → el botón "Duplicar" de cualquier
--  curso. Aparecerá una copia archivada al final de la lista.
--
--  O a mano, si prefieres verlo aquí:
--      select public.duplicar_curso(36, 'Mi plantilla');
--  (devuelve false en el SQL Editor porque es_admin() no ve
--  sesión; pruébalo desde la app.)
-- =============================================================
