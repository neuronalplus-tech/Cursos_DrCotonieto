-- =============================================================
--  FORO POR CURSO  ·  Esquema + RLS
--
--  REGLAS DE NEGOCIO (definidas por el Dr. Ernesto)
--  · Con nombre real: el autor es el de su perfil (o el correo de registro).
--  · Privado por curso: solo quien tiene acceso al curso entra.
--  · SOLO el administrador abre hilos. Cualquier inscrito responde sin
--    tener que ser autorizado antes.
--  · Texto libre y avanzado: formato con HTML, enlaces, etc.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run. Es idempotente:
--  puedes volver a correrlo sin romper nada.
-- =============================================================

-- -------------------------------------------------------------
-- 1) HILOS
-- -------------------------------------------------------------
create table if not exists public.foro_hilos (
  id             bigserial primary key,
  curso_id       bigint not null references public.cursos(id) on delete cascade,
  autor_id       uuid   not null,
  autor_nombre   text   not null,
  autor_email    text   not null,
  titulo         text   not null,
  cuerpo         text   not null default '',
  fijado         boolean not null default false,
  cerrado        boolean not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists foro_hilos_curso_idx
  on public.foro_hilos (curso_id, fijado desc, actualizado_en desc);

-- -------------------------------------------------------------
-- 2) RESPUESTAS
--    `borrada` conserva el hilo intacto aunque se elimine una respuesta.
-- -------------------------------------------------------------
create table if not exists public.foro_respuestas (
  id           bigserial primary key,
  hilo_id      bigint not null references public.foro_hilos(id) on delete cascade,
  autor_id     uuid   not null,
  autor_nombre text   not null,
  autor_email  text   not null,
  cuerpo       text   not null,
  editado      boolean not null default false,
  borrada      boolean not null default false,
  creado_en    timestamptz not null default now()
);

create index if not exists foro_respuestas_hilo_idx
  on public.foro_respuestas (hilo_id, creado_en);

-- -------------------------------------------------------------
-- 3) ¿ESTE USUARIO TIENE ACCESO AL CURSO?
--    Una sola función para las políticas, en vez de repetir el
--    `exists` sobre `acceso` en cada tabla.
-- -------------------------------------------------------------
create or replace function public.tiene_acceso_al_curso(p_curso bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.acceso a
    where a.usuario_id = auth.uid() and a.curso_id = p_curso
  )
$$;

grant execute on function public.tiene_acceso_al_curso(bigint) to authenticated;

-- -------------------------------------------------------------
-- 4) RLS — lo que hace que el foro sea privado de verdad
--
--    La app usa la clave pública desde el navegador, así que TODA
--    lectura y escritura pasa por estas políticas. Sin ellas, el
--    foro sería visible para cualquiera que se inscriba en cualquier
--    curso y podría abrir hilos sin ser admin.
-- -------------------------------------------------------------
alter table public.foro_hilos enable row level security;
alter table public.foro_respuestas enable row level security;

-- --- Ver hilos: inscritos del curso. El admin ve todos. ---
drop policy if exists "foro_hilos_select" on public.foro_hilos;
create policy "foro_hilos_select" on public.foro_hilos
  for select to authenticated
  using (public.es_admin() or public.tiene_acceso_al_curso(curso_id));

-- --- Abrir hilos: SOLO admin. ---
drop policy if exists "foro_hilos_insert_admin" on public.foro_hilos;
create policy "foro_hilos_insert_admin" on public.foro_hilos
  for insert to authenticated
  with check (public.es_admin());

-- --- Fijar, cerrar, editar el título: solo admin. ---
drop policy if exists "foro_hilos_update_admin" on public.foro_hilos;
create policy "foro_hilos_update_admin" on public.foro_hilos
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "foro_hilos_delete_admin" on public.foro_hilos;
create policy "foro_hilos_delete_admin" on public.foro_hilos
  for delete to authenticated
  using (public.es_admin());

-- --- Responder: cualquier inscrito del curso, SIN pedir permiso.
--     El `autor_id = auth.uid()` impide poner nombre ajeno, y el
--     `cerrado = false` impide escribir en hilos que cerraste. ---
drop policy if exists "foro_respuestas_insert" on public.foro_respuestas;
create policy "foro_respuestas_insert" on public.foro_respuestas
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.foro_hilos h
      where h.id = hilo_id
        and h.cerrado = false
        and (public.es_admin() or public.tiene_acceso_al_curso(h.curso_id))
    )
  );

-- --- Leer respuestas: solo los del mismo curso. ---
drop policy if exists "foro_respuestas_select" on public.foro_respuestas;
create policy "foro_respuestas_select" on public.foro_respuestas
  for select to authenticated
  using (exists (
    select 1 from public.foro_hilos h
    where h.id = hilo_id
      and (public.es_admin() or public.tiene_acceso_al_curso(h.curso_id))
  ));

-- --- Editar o borrar una respuesta: su autor, o el admin. ---
drop policy if exists "foro_respuestas_update" on public.foro_respuestas;
create policy "foro_respuestas_update" on public.foro_respuestas
  for update to authenticated
  using (public.es_admin() or autor_id = auth.uid());

drop policy if exists "foro_respuestas_delete" on public.foro_respuestas;
create policy "foro_respuestas_delete" on public.foro_respuestas
  for delete to authenticated
  using (public.es_admin() or autor_id = auth.uid());

-- -------------------------------------------------------------
-- 5) TIEMPO REAL — para que las respuestas aparezcan solas
-- -------------------------------------------------------------
alter table public.foro_hilos replica identity full;
alter table public.foro_respuestas replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- `add table` falla si la tabla ya está publicada, así que se
-- comprueba antes para que el script siga siendo idempotente.
do $$
declare t text;
begin
  foreach t in array array['foro_hilos','foro_respuestas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
-- -------------------------------------------------------------
-- 6) COMPROBACIÓN
--
-- OJO: `select public.es_admin()` SIEMPRE devuelve false en el SQL
-- Editor, porque ahí no hay sesión iniciada (lee auth.jwt()). No lo
-- tomes como señal de nada. La única prueba real es abrir un hilo
-- desde el panel → 💬 Foro.
-- -------------------------------------------------------------
select 'tablas' as que, count(*) as n
  from information_schema.tables
  where table_schema = 'public' and table_name in ('foro_hilos','foro_respuestas');

select 'politicas' as que, count(*) as n
  from pg_policies
  where schemaname = 'public' and tablename like 'foro_%';

select 'tiempo real' as que, count(*) as n
  from pg_publication_tables
  where pubname = 'supabase_realtime' and tablename like 'foro_%';

-- =============================================================
--  RESULTADO ESPERADO
--  · tablas     = 2
--  · politicas  = 6
--  · tiempo real= 2
-- =============================================================