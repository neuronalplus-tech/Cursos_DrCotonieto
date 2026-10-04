-- =============================================================
--  ROLES · PASO 2 de 2  ·  EL ROL FACILITADOR
--
--  QUÉ ES UN FACILITADOR
--  Alguien que gestiona UNO O VARIOS cursos concretos, no la
--  plataforma entera. Dentro de sus cursos puede abrir y moderar
--  el foro y editar los exámenes. Fuera de ellos no puede nada:
--  es un alumno más.
--
--  POR QUÉ ESTO VIVE EN SQL Y NO EN REACT
--  Ocultar un botón no es un permiso. La app usa la clave pública
--  desde el navegador, así que cualquiera puede llamar a la API
--  directamente. Si el permiso no está en estas políticas, no
--  existe. La interfaz solo refleja lo que aquí se decide.
--
--  ALCANCE DE ESTE PASO
--  Solo toca tablas cuyo RLS ya conocemos (foro y exámenes), y
--  siempre AMPLIANDO: donde decía "admin", ahora dice "admin o
--  facilitador de ese curso". Nadie pierde acceso.
--
--  Cursos, módulos y recursos quedan FUERA a propósito: todavía
--  no sabemos si tienen RLS activo, y activarlo a ciegas puede
--  dejar la portada sin cursos. Eso es el paso 3, después de ver
--  la salida de ROLES_1_DIAGNOSTICO.sql.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente: puedes volver a correrlo sin romper nada.
-- =============================================================

-- -------------------------------------------------------------
-- 1) QUIÉN FACILITA QUÉ
--
--    Se indexa por CORREO, no por usuario_id, por dos razones:
--    · Es la misma llave que ya usa `admins`, así que hay una sola
--      forma de nombrar a una persona en todo el sistema.
--    · Permite asignar un curso a alguien que todavía no ha
--      entrado nunca (aún no existe su auth.uid).
-- -------------------------------------------------------------
create table if not exists public.facilitadores (
  id        bigserial primary key,
  email     text   not null,
  curso_id  bigint not null references public.cursos(id) on delete cascade,
  creado_en timestamptz not null default now()
);

-- El correo se compara siempre en minúsculas; el índice lo impone
-- para que no entren "Ana@x.com" y "ana@x.com" como dos personas.
create unique index if not exists facilitadores_email_curso_idx
  on public.facilitadores (lower(email), curso_id);

create index if not exists facilitadores_curso_idx
  on public.facilitadores (curso_id);

-- -------------------------------------------------------------
-- 2) ¿PUEDE ESTA PERSONA GESTIONAR ESTE CURSO?
--
--    Es la pregunta que sustituye a es_admin() en todo lo que sea
--    "editar contenido de un curso". El admin pasa siempre; el
--    facilitador solo en los suyos.
--
--    security definer: si no, la consulta a `facilitadores`
--    quedaría bloqueada por el RLS de la propia tabla.
-- -------------------------------------------------------------
create or replace function public.puede_gestionar_curso(p_curso bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin() or exists (
    select 1 from public.facilitadores f
    where f.curso_id = p_curso
      and lower(f.email) = lower(auth.jwt() ->> 'email')
  )
$$;

revoke all on function public.puede_gestionar_curso(bigint) from public;
grant execute on function public.puede_gestionar_curso(bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 3) ¿ES FACILITADOR DE ALGO?
--
--    Para la interfaz: decide si enseñar o no las herramientas de
--    gestión, sin tener un curso concreto en la mano. NO sustituye
--    a puede_gestionar_curso() en las políticas.
-- -------------------------------------------------------------
create or replace function public.es_facilitador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.facilitadores f
    where lower(f.email) = lower(auth.jwt() ->> 'email')
  )
$$;

revoke all on function public.es_facilitador() from public;
grant execute on function public.es_facilitador() to authenticated, service_role;

-- -------------------------------------------------------------
-- 4) ¿A QUÉ CURSO PERTENECE ESTE EXAMEN?
--
--    `examenes` cuelga de un curso (curso_id) o de un módulo
--    (modulo_id), y uno de los dos viene en null. Esta función
--    resuelve el curso en ambos casos para poder preguntarle a
--    puede_gestionar_curso().
--
--    Si no se puede resolver devuelve null, y entonces
--    puede_gestionar_curso(null) solo deja pasar al admin: ante la
--    duda, el facilitador NO entra.
-- -------------------------------------------------------------
create or replace function public.curso_del_examen(p_curso bigint, p_modulo bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_curso,
    (select m.curso_id from public.modulos m where m.id = p_modulo)
  )
$$;

revoke all on function public.curso_del_examen(bigint, bigint) from public;
grant execute on function public.curso_del_examen(bigint, bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 5) RLS DE LA PROPIA TABLA `facilitadores`
--
--    Lo más importante de todo el script: SOLO el admin asigna.
--    Si un facilitador pudiera escribir aquí, se daría de alta en
--    cualquier curso y el rol no valdría nada.
-- -------------------------------------------------------------
alter table public.facilitadores enable row level security;

-- Leer: el admin ve todo; cada quien ve sus propias asignaciones
-- (la interfaz las necesita para saber qué cursos gestionas).
drop policy if exists "facilitadores_select" on public.facilitadores;
create policy "facilitadores_select" on public.facilitadores
  for select to authenticated
  using (
    public.es_admin()
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

-- Asignar, cambiar y quitar: solo el admin. Sin excepciones.
drop policy if exists "facilitadores_insert_admin" on public.facilitadores;
create policy "facilitadores_insert_admin" on public.facilitadores
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "facilitadores_update_admin" on public.facilitadores;
create policy "facilitadores_update_admin" on public.facilitadores
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "facilitadores_delete_admin" on public.facilitadores;
create policy "facilitadores_delete_admin" on public.facilitadores
  for delete to authenticated
  using (public.es_admin());

-- -------------------------------------------------------------
-- 6) FORO — el facilitador modera sus cursos
--
--    Son las mismas políticas de FORO.sql con es_admin() cambiado
--    por puede_gestionar_curso(curso_id). El admin sigue pasando
--    igual, porque esa función ya lo contempla.
-- -------------------------------------------------------------

-- Abrir temas: admin o facilitador DE ESE CURSO.
drop policy if exists "foro_hilos_insert_admin" on public.foro_hilos;
create policy "foro_hilos_insert_admin" on public.foro_hilos
  for insert to authenticated
  with check (public.puede_gestionar_curso(curso_id));

-- Fijar, cerrar, editar.
drop policy if exists "foro_hilos_update_admin" on public.foro_hilos;
create policy "foro_hilos_update_admin" on public.foro_hilos
  for update to authenticated
  using (public.puede_gestionar_curso(curso_id))
  with check (public.puede_gestionar_curso(curso_id));

drop policy if exists "foro_hilos_delete_admin" on public.foro_hilos;
create policy "foro_hilos_delete_admin" on public.foro_hilos
  for delete to authenticated
  using (public.puede_gestionar_curso(curso_id));

-- Moderar respuestas ajenas: su autor, o quien gestione el curso.
drop policy if exists "foro_respuestas_update" on public.foro_respuestas;
create policy "foro_respuestas_update" on public.foro_respuestas
  for update to authenticated
  using (
    autor_id = auth.uid()
    or exists (
      select 1 from public.foro_hilos h
      where h.id = hilo_id and public.puede_gestionar_curso(h.curso_id)
    )
  );

drop policy if exists "foro_respuestas_delete" on public.foro_respuestas;
create policy "foro_respuestas_delete" on public.foro_respuestas
  for delete to authenticated
  using (
    autor_id = auth.uid()
    or exists (
      select 1 from public.foro_hilos h
      where h.id = hilo_id and public.puede_gestionar_curso(h.curso_id)
    )
  );

-- -------------------------------------------------------------
-- 7) EXÁMENES — el facilitador edita los de sus cursos
--
--    La lectura no se toca: sigue siendo la de RLS_EXAMENES.sql.
--    Solo cambia quién puede escribir.
-- -------------------------------------------------------------
drop policy if exists "examenes_insert_admin" on public.examenes;
create policy "examenes_insert_admin" on public.examenes
  for insert to authenticated
  with check (public.puede_gestionar_curso(public.curso_del_examen(curso_id, modulo_id)));

drop policy if exists "examenes_update_admin" on public.examenes;
create policy "examenes_update_admin" on public.examenes
  for update to authenticated
  using (public.puede_gestionar_curso(public.curso_del_examen(curso_id, modulo_id)))
  with check (public.puede_gestionar_curso(public.curso_del_examen(curso_id, modulo_id)));

drop policy if exists "examenes_delete_admin" on public.examenes;
create policy "examenes_delete_admin" on public.examenes
  for delete to authenticated
  using (public.puede_gestionar_curso(public.curso_del_examen(curso_id, modulo_id)));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 8) COMPROBACIÓN
--
--  OJO, lo de siempre: aquí no hay sesión iniciada, así que
--  es_admin() y puede_gestionar_curso() devuelven false SIEMPRE en
--  el SQL Editor. No es un fallo y no prueba nada.
-- -------------------------------------------------------------
select 'tabla facilitadores' as que, count(*) as n
  from information_schema.tables
  where table_schema = 'public' and table_name = 'facilitadores';

select 'funciones de rol' as que, count(*) as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('puede_gestionar_curso','es_facilitador','curso_del_examen');

select 'politicas de facilitadores' as que, count(*) as n
  from pg_policies where schemaname = 'public' and tablename = 'facilitadores';

-- =============================================================
--  RESULTADO ESPERADO
--  · tabla facilitadores        = 1
--  · funciones de rol           = 3
--  · politicas de facilitadores = 4
--
--  CÓMO ASIGNAR UN FACILITADOR (por ahora, a mano)
--    insert into public.facilitadores (email, curso_id)
--    values ('persona@correo.com', 36);
--
--  Para quitarlo:
--    delete from public.facilitadores
--    where lower(email) = 'persona@correo.com' and curso_id = 36;
--
--  La pantalla para hacerlo desde el panel viene después; primero
--  conviene probar el permiso con una fila puesta a mano.
-- =============================================================
