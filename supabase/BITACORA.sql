-- =============================================================
--  BITÁCORA DE CAMBIOS
--
--  QUÉ PROBLEMA RESUELVE
--  Desde que existe el rol Facilitador hay más de una persona
--  editando tu contenido. Si mañana desaparece un recurso o un
--  módulo cambia de nombre, hoy no hay forma de saber quién lo
--  hizo ni qué decía antes.
--
--  POR QUÉ CON DISPARADORES Y NO DESDE LA APP
--  Si el registro lo escribiera el navegador, bastaría con no
--  llamarlo para que el cambio quedara sin rastro. Un disparador
--  vive en la base: se dispara pase lo que pase, venga el cambio
--  de tu panel, de un script o del SQL Editor.
--
--  QUÉ SE GUARDA
--  La fila completa antes y después, y la lista de columnas que
--  cambiaron. Así la bitácora no solo dice "alguien tocó esto",
--  dice exactamente qué decía antes: sirve para deshacer a mano.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA TABLA
--
--    `registro_id` es texto y no bigint a propósito: así vale
--    para tablas con id numérico y para las que usan uuid.
-- -------------------------------------------------------------
create table if not exists public.auditoria (
  id          bigserial primary key,
  tabla       text not null,
  registro_id text,
  operacion   text not null,
  autor_id    uuid,
  autor_email text,
  antes       jsonb,
  despues     jsonb,
  cambios     text[],
  creado_en   timestamptz not null default now()
);

create index if not exists auditoria_creado_idx
  on public.auditoria (creado_en desc);

create index if not exists auditoria_tabla_idx
  on public.auditoria (tabla, registro_id);

-- -------------------------------------------------------------
-- 2) EL DISPARADOR
--
--    security definer para que pueda escribir en `auditoria`
--    aunque quien provoque el cambio no tenga permiso de escribir
--    ahí (que es justo lo que queremos: nadie escribe la bitácora
--    a mano).
-- -------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes   jsonb;
  v_despues jsonb;
  v_cambios text[];
  v_id      text;
begin
  if TG_OP = 'DELETE' then
    v_antes := to_jsonb(OLD);
    v_id    := v_antes ->> 'id';

  elsif TG_OP = 'INSERT' then
    v_despues := to_jsonb(NEW);
    v_id      := v_despues ->> 'id';

  else
    v_antes   := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    v_id      := v_despues ->> 'id';

    select array_agg(e.key)
      into v_cambios
      from jsonb_each(v_despues) e
     where v_antes -> e.key is distinct from v_despues -> e.key;

    -- Un UPDATE que no cambia nada no es noticia. Sin esto la
    -- bitácora se llenaría de ruido: la app reescribe filas
    -- enteras aunque solo toques una casilla.
    if v_cambios is null then
      return NEW;
    end if;
  end if;

  insert into public.auditoria
    (tabla, registro_id, operacion, autor_id, autor_email, antes, despues, cambios)
  values
    (TG_TABLE_NAME, v_id, TG_OP, auth.uid(),
     lower(auth.jwt() ->> 'email'), v_antes, v_despues, v_cambios);

  return coalesce(NEW, OLD);
end
$$;

-- -------------------------------------------------------------
-- 3) A QUÉ TABLAS SE LE PONE
--
--    Solo contenido y permisos, que es lo que se edita a mano y
--    lo que duele perder.
--
--    Quedan FUERA a propósito: `mensajes`, `intentos_examen` y
--    `progreso_usuario`. Son actividad de los alumnos, no
--    decisiones de gestión: registrarlas multiplicaría el tamaño
--    de la bitácora y enterraría lo que de verdad quieres ver.
-- -------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'cursos', 'modulos', 'recursos', 'examenes',
    'foro_hilos', 'facilitadores', 'acceso'
  ] loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('drop trigger if exists auditar_%1$s on public.%1$I', t);
      execute format(
        'create trigger auditar_%1$s
           after insert or update or delete on public.%1$I
           for each row execute function public.registrar_auditoria()', t);
      raise notice 'bitacora activada en %', t;
    else
      raise notice 'tabla % no existe: se omite', t;
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------
-- 4) QUIÉN LA LEE
--
--    Solo el admin. Y NADIE la escribe ni la borra desde el
--    navegador: al no haber políticas de insert/update/delete,
--    RLS lo niega todo. El disparador puede porque es security
--    definer. Una bitácora que su autor puede editar no sirve.
-- -------------------------------------------------------------
alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select_admin" on public.auditoria;
create policy "auditoria_select_admin" on public.auditoria
  for select to authenticated
  using (public.es_admin());

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 5) COMPROBACIÓN
-- -------------------------------------------------------------
select
  c.relname as tabla_vigilada,
  t.tgname  as disparador
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and t.tgname like 'auditar_%'
order by c.relname;

-- =============================================================
--  RESULTADO ESPERADO
--  Siete filas: acceso, cursos, examenes, facilitadores,
--  foro_hilos, modulos y recursos.
--
--  PARA PROBARLO
--  Cambia el título de un curso desde el panel y luego:
--      select tabla, operacion, autor_email, cambios, creado_en
--      from public.auditoria order by creado_en desc limit 5;
--
--  SOBRE EL TAMAÑO
--  Cada fila guarda el antes y el después completos. A tu escala
--  eso es despreciable, pero no crece solo hacia abajo: si algún
--  día pesa, se recortan los registros viejos con
--      delete from public.auditoria where creado_en < now() - interval '1 year';
--  Dime y lo dejamos programado.
-- =============================================================
