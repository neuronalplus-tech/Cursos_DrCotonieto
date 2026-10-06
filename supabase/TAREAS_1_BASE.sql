-- =============================================================
--  TAREAS · Entregas calificables  ·  ETAPA 1 de 2 (los datos)
--
--  QUÉ ES
--  Un apartado donde el alumno sube un documento y tú lo
--  calificas, con rúbrica o con una nota simple. Es la pieza que
--  convierte la plataforma de "material para consultar" en un
--  curso donde se entrega y se evalúa.
--
--  DÓNDE SE CUELGA UNA TAREA
--  De un MÓDULO o de un CURSO, igual que los exámenes, para no
--  inventar una segunda forma de colgar contenido. Y con un
--  `grupo` opcional, que es como la app ya restringe módulos a una
--  ruta concreta: si lo pones, solo la ven los de esa ruta.
--
--  POR QUÉ EL ARCHIVO VA EN BUCKET PRIVADO
--  Los otros buckets del proyecto sirven material público y usan
--  getPublicUrl. Una entrega NO puede ser pública: cualquiera con
--  el enlace leería el trabajo de un alumno. Este bucket es
--  privado y se lee con URLs firmadas que caducan.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 y ROLES_3 aplicados.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LAS TAREAS
--
--    `puntos_max` permite calificar sobre 10, sobre 100 o sobre lo
--    que uses. La rúbrica reparte ese total entre sus criterios.
-- -------------------------------------------------------------
create table if not exists public.tareas (
  id            bigserial primary key,
  curso_id      bigint references public.cursos(id) on delete cascade,
  modulo_id     bigint references public.modulos(id) on delete cascade,
  grupo         text,
  titulo        text not null,
  instrucciones text,
  fecha_limite  timestamptz,
  puntos_max    numeric not null default 100,
  permite_reentrega boolean not null default true,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- Una tarea cuelga de un módulo O de un curso, nunca de los dos ni
-- de ninguno. Igual que `facilitadores` con curso/categoría.
alter table public.tareas drop constraint if exists tareas_destino_check;
alter table public.tareas add constraint tareas_destino_check
  check ((curso_id is not null) <> (modulo_id is not null));

create index if not exists tareas_curso_idx  on public.tareas (curso_id);
create index if not exists tareas_modulo_idx on public.tareas (modulo_id);

-- -------------------------------------------------------------
-- 2) ¿A QUÉ CURSO PERTENECE UNA TAREA?
--
--    Una tarea de módulo hereda el curso del módulo. Se resuelve
--    aquí para que las políticas no tengan que repetir el salto.
-- -------------------------------------------------------------
create or replace function public.curso_de_tarea(p_tarea bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.curso_id, m.curso_id)
  from public.tareas t
  left join public.modulos m on m.id = t.modulo_id
  where t.id = p_tarea
$$;

revoke all on function public.curso_de_tarea(bigint) from public;
grant execute on function public.curso_de_tarea(bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 3) LA RÚBRICA
--
--    Criterios con peso, como el de tu aula virtual:
--    "Dominio del contenido (20%)". Una tarea sin criterios se
--    califica con una nota simple; no es obligatorio tener rúbrica.
--
--    `niveles` es jsonb y no otra tabla a propósito: un criterio
--    tiene tres o cuatro descriptores que se escriben de una vez y
--    se leen juntos. Partirlos en filas complicaría la edición sin
--    ganar nada, porque nunca se consultan por separado.
--      [{"etiqueta":"Excelente","puntos":20,"descripcion":"…"}, …]
-- -------------------------------------------------------------
create table if not exists public.rubrica_criterios (
  id          bigserial primary key,
  tarea_id    bigint not null references public.tareas(id) on delete cascade,
  titulo      text not null,
  descripcion text,
  peso        numeric not null default 0,
  niveles     jsonb not null default '[]'::jsonb,
  orden       integer not null default 100
);

create index if not exists rubrica_tarea_idx on public.rubrica_criterios (tarea_id, orden);

-- -------------------------------------------------------------
-- 4) LAS ENTREGAS
--
--    Una fila por alumno y tarea: al reentregar se sobrescribe, no
--    se acumulan versiones. Es lo que esperan tus alumnos ("subí
--    el archivo equivocado") y evita decidir cuál versión cuenta.
--
--    La calificación vive AQUÍ y no en otra tabla: es un dato de
--    la entrega, siempre se lee con ella, y separarla obligaría a
--    unir dos tablas en cada consulta sin ganar nada.
--
--    `rubrica_detalle` guarda los puntos por criterio:
--      {"12": 18, "13": 25}   (id de criterio → puntos)
-- -------------------------------------------------------------
create table if not exists public.entregas (
  id               bigserial primary key,
  tarea_id         bigint not null references public.tareas(id) on delete cascade,
  usuario_id       uuid not null,
  archivo_path     text,
  archivo_nombre   text,
  comentario       text,
  entregado_en     timestamptz not null default now(),

  calificacion     numeric,
  retroalimentacion text,
  rubrica_detalle  jsonb,
  calificado_por   uuid,
  calificado_en    timestamptz
);

create unique index if not exists entregas_tarea_usuario_idx
  on public.entregas (tarea_id, usuario_id);

create index if not exists entregas_tarea_idx on public.entregas (tarea_id);

-- -------------------------------------------------------------
-- 5) QUIÉN VE Y TOCA QUÉ
-- -------------------------------------------------------------
alter table public.tareas            enable row level security;
alter table public.rubrica_criterios enable row level security;
alter table public.entregas          enable row level security;

-- --- Tareas: las ve quien tiene acceso al curso; las crea quien
--     lo gestiona. Las inactivas solo las ve quien gestiona. ---
drop policy if exists "tareas_select" on public.tareas;
create policy "tareas_select" on public.tareas
  for select to authenticated
  using (
    public.puede_gestionar_curso(public.curso_de_tarea(id))
    or (activo = true and public.tiene_acceso_al_curso(public.curso_de_tarea(id)))
  );

drop policy if exists "tareas_insert" on public.tareas;
create policy "tareas_insert" on public.tareas
  for insert to authenticated
  with check (public.puede_gestionar_curso(coalesce(curso_id, public.curso_del_modulo(modulo_id))));

drop policy if exists "tareas_update" on public.tareas;
create policy "tareas_update" on public.tareas
  for update to authenticated
  using (public.puede_gestionar_curso(public.curso_de_tarea(id)))
  with check (public.puede_gestionar_curso(coalesce(curso_id, public.curso_del_modulo(modulo_id))));

drop policy if exists "tareas_delete" on public.tareas;
create policy "tareas_delete" on public.tareas
  for delete to authenticated
  using (public.puede_gestionar_curso(public.curso_de_tarea(id)));

-- --- Rúbrica: se lee con la tarea, se escribe con ella. ---
drop policy if exists "rubrica_select" on public.rubrica_criterios;
create policy "rubrica_select" on public.rubrica_criterios
  for select to authenticated
  using (
    public.puede_gestionar_curso(public.curso_de_tarea(tarea_id))
    or public.tiene_acceso_al_curso(public.curso_de_tarea(tarea_id))
  );

drop policy if exists "rubrica_escribir" on public.rubrica_criterios;
create policy "rubrica_escribir" on public.rubrica_criterios
  for all to authenticated
  using (public.puede_gestionar_curso(public.curso_de_tarea(tarea_id)))
  with check (public.puede_gestionar_curso(public.curso_de_tarea(tarea_id)));

-- --- Entregas: cada quien la suya; quien gestiona, todas. ---
drop policy if exists "entregas_select" on public.entregas;
create policy "entregas_select" on public.entregas
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.puede_gestionar_curso(public.curso_de_tarea(tarea_id))
  );

-- Entregar: solo lo tuyo, solo si estás inscrito y la tarea sigue
-- activa. `usuario_id = auth.uid()` impide entregar en nombre ajeno.
drop policy if exists "entregas_insert" on public.entregas;
create policy "entregas_insert" on public.entregas
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.tareas t
      where t.id = tarea_id
        and t.activo = true
        and public.tiene_acceso_al_curso(public.curso_de_tarea(t.id))
    )
  );

-- Al actualizar hay dos caminos muy distintos y por eso la
-- condición es asimétrica: el alumno puede reemplazar su archivo
-- (si la tarea admite reentrega), y quien gestiona puede calificar.
drop policy if exists "entregas_update" on public.entregas;
create policy "entregas_update" on public.entregas
  for update to authenticated
  using (
    (usuario_id = auth.uid() and exists (
      select 1 from public.tareas t
      where t.id = tarea_id and t.activo = true and t.permite_reentrega = true
    ))
    or public.puede_gestionar_curso(public.curso_de_tarea(tarea_id))
  );

-- Borrar una entrega es cosa de quien gestiona: un alumno que
-- borra la suya tras la fecha límite deja un hueco sin rastro.
drop policy if exists "entregas_delete" on public.entregas;
create policy "entregas_delete" on public.entregas
  for delete to authenticated
  using (public.puede_gestionar_curso(public.curso_de_tarea(tarea_id)));

-- -------------------------------------------------------------
-- 6) EL ALMACÉN DE ARCHIVOS
--
--    Bucket PRIVADO. La ruta es  <tarea_id>/<usuario_id>/<archivo>
--    y las políticas se apoyan en esos dos primeros tramos.
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('entregas', 'entregas', false)
on conflict (id) do nothing;

-- Sube el alumno, en SU carpeta. El tramo con el id de usuario es
-- lo que impide dejar un archivo en la carpeta de otro.
drop policy if exists "entregas_subir" on storage.objects;
create policy "entregas_subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entregas'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "entregas_reemplazar" on storage.objects;
create policy "entregas_reemplazar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'entregas'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Lee su autor, y quien gestione el curso de esa tarea. La
-- comprobación del formato evita que una ruta rara reviente el
-- cast a bigint.
drop policy if exists "entregas_leer" on storage.objects;
create policy "entregas_leer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'entregas'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        (storage.foldername(name))[1] ~ '^[0-9]+$'
        and public.puede_gestionar_curso(
              public.curso_de_tarea(((storage.foldername(name))[1])::bigint))
      )
    )
  );

drop policy if exists "entregas_borrar" on storage.objects;
create policy "entregas_borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'entregas'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        (storage.foldername(name))[1] ~ '^[0-9]+$'
        and public.puede_gestionar_curso(
              public.curso_de_tarea(((storage.foldername(name))[1])::bigint))
      )
    )
  );

-- -------------------------------------------------------------
-- 7) LA BITÁCORA TAMBIÉN LAS VIGILA
-- -------------------------------------------------------------
do $$
declare t text;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'registrar_auditoria'
  ) then
    foreach t in array array['tareas', 'rubrica_criterios'] loop
      execute format('drop trigger if exists auditar_%1$s on public.%1$I', t);
      execute format(
        'create trigger auditar_%1$s
           after insert or update or delete on public.%1$I
           for each row execute function public.registrar_auditoria()', t);
    end loop;
    raise notice 'bitacora activada en tareas y rubrica_criterios';
  end if;
end $$;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 8) COMPROBACIÓN
-- -------------------------------------------------------------
select 'tablas' as que, count(*) as n, '3' as esperado
from information_schema.tables
where table_schema = 'public'
  and table_name in ('tareas', 'rubrica_criterios', 'entregas')

union all
select 'politicas', count(*), '12'
from pg_policies
where schemaname = 'public'
  and tablename in ('tareas', 'rubrica_criterios', 'entregas')

union all
select 'bucket privado', count(*), '1'
from storage.buckets where id = 'entregas' and public = false

union all
select 'politicas de archivos', count(*), '4'
from pg_policies
where schemaname = 'storage' and policyname like 'entregas_%';

-- =============================================================
--  LO QUE FALTA (etapa 2, en React)
--  · Crear tareas desde el módulo o el curso, con su rúbrica.
--  · Que el alumno suba su archivo y lo pueda reemplazar.
--  · La pantalla de calificar: alumno por alumno, con la rúbrica
--    al lado, como la de tu aula virtual.
--  · Importar una rúbrica desde Excel.
-- =============================================================
