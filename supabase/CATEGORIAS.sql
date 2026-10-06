-- =============================================================
--  CATEGORÍAS DE CURSO
--
--  QUÉ RESUELVE
--  1. Asignar un facilitador era curso por curso. Con categorías
--     se asigna de una vez a toda una línea ("Duelo y pérdida"),
--     y los cursos que entren después quedan cubiertos solos.
--  2. Las líneas eran texto libre en `cursos.linea`, y su
--     descripción estaba escrita a mano en `src/config.js`
--     (LINEA_COPY). Cambiar un texto obligaba a tocar código.
--
--  EL ESCALÓN QUE FALTABA
--  Es lo que Moodle tiene entre el sitio y el curso: un nivel
--  intermedio donde colgar permisos y presentación.
--
--  QUÉ NO SE ROMPE
--  `cursos.linea` se queda y se sigue llenando. La app la usa para
--  agrupar en la portada y no se toca en este paso: `categoria_id`
--  se añade al lado y se rellena a partir de ella. Migrar la
--  interfaz es el paso siguiente, no este.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2 y ROLES_4 aplicados.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA TABLA
--
--    `motivo` es el patrón visual que PortadaCurso dibuja cuando
--    un curso no tiene imagen propia (red, ondas, malla, escudo,
--    prisma, circulos, arcos).
-- -------------------------------------------------------------
create table if not exists public.categorias (
  id          bigserial primary key,
  nombre      text not null,
  descripcion text,
  motivo      text,
  orden       integer not null default 100,
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create unique index if not exists categorias_nombre_idx
  on public.categorias (lower(nombre));

-- -------------------------------------------------------------
-- 2) SEMILLA desde lo que ya existe
--
--    Se crean las categorías a partir de las líneas que ya usan
--    tus cursos, para no empezar de cero. Los textos y motivos
--    vienen de LINEA_COPY, que es de donde salían hasta ahora.
-- -------------------------------------------------------------
insert into public.categorias (nombre, descripcion, motivo, orden)
values
  ('Formulación y terapias contextuales',
   'Formulación de caso, ACT, DBT, mindfulness y análisis funcional para decidir con criterio clínico.',
   'red', 10),
  ('Duelo y pérdida',
   'Duelo normativo, complicado, infantil y escritura emocional reflexiva.',
   'ondas', 20),
  ('Neurodivergencia',
   'Detección, diagnóstico diferencial y acompañamiento afirmativo, con criterios DSM-5-TR.',
   'malla', 30),
  ('Riesgo, documentación y ética',
   'Evaluación de riesgo suicida, documentación clínica y límites éticos en la práctica.',
   'escudo', 40),
  ('Peritaje psicológico',
   'Fundamentos del peritaje y revisión metodológica de entrevistas forenses.',
   'prisma', 50),
  ('Ciclo vital y bienestar',
   'Mindfulness clínico, ansiedad y pánico, y bienestar en la adultez y la vejez.',
   'circulos', 60),
  ('Práctica profesional',
   'Supervisión clínica grupal, psicometría aplicada y prevención del desgaste profesional.',
   'arcos', 70),
  ('Talleres gratuitos',
   'Formación breve y de acceso libre para empezar a formarte hoy mismo.',
   'arcos', 80),
  ('Educación',
   'Debates contemporáneos y herramientas aplicables para profesionales de la educación.',
   'prisma', 90)
on conflict do nothing;

-- Cualquier línea que exista en `cursos` y no esté arriba se crea
-- igual, para que ningún curso se quede sin categoría.
insert into public.categorias (nombre, orden)
select distinct c.linea, 500
from public.cursos c
where c.linea is not null
  and btrim(c.linea) <> ''
  and not exists (
    select 1 from public.categorias k where lower(k.nombre) = lower(c.linea)
  )
on conflict do nothing;

-- -------------------------------------------------------------
-- 3) EL VÍNCULO DESDE LOS CURSOS
--
--    on delete set null: borrar una categoría no se lleva los
--    cursos por delante, solo los deja sin clasificar.
-- -------------------------------------------------------------
alter table public.cursos
  add column if not exists categoria_id bigint
  references public.categorias(id) on delete set null;

create index if not exists cursos_categoria_idx on public.cursos (categoria_id);

update public.cursos c
   set categoria_id = k.id
  from public.categorias k
 where c.categoria_id is null
   and c.linea is not null
   and lower(k.nombre) = lower(c.linea);

-- -------------------------------------------------------------
-- 4) FACILITADORES POR CATEGORÍA
--
--    Una fila de `facilitadores` pasa a ser O de un curso O de una
--    categoría, nunca de los dos ni de ninguno. La restricción lo
--    impone en la base, no en la interfaz.
-- -------------------------------------------------------------
alter table public.facilitadores
  add column if not exists categoria_id bigint
  references public.categorias(id) on delete cascade;

alter table public.facilitadores
  alter column curso_id drop not null;

alter table public.facilitadores
  drop constraint if exists facilitadores_destino_check;
alter table public.facilitadores
  add constraint facilitadores_destino_check
  check ((curso_id is not null) <> (categoria_id is not null));

create unique index if not exists facilitadores_email_categoria_idx
  on public.facilitadores (lower(email), categoria_id)
  where categoria_id is not null;

-- -------------------------------------------------------------
-- 5) LA PREGUNTA DE SIEMPRE, AHORA CON DOS CAMINOS
--
--    Se gestiona un curso si se te asignó ESE curso, o si se te
--    asignó la categoría a la que pertenece. Lo segundo es lo que
--    hace que un curso nuevo dentro de la categoría quede cubierto
--    sin tener que acordarse de nada.
-- -------------------------------------------------------------
create or replace function public.puede_gestionar_curso(p_curso bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin() or exists (
    select 1
    from public.facilitadores f
    where lower(f.email) = lower(auth.jwt() ->> 'email')
      and (
        f.curso_id = p_curso
        or (
          f.categoria_id is not null
          and f.categoria_id = (select c.categoria_id from public.cursos c where c.id = p_curso)
        )
      )
  )
$$;

-- `es_alumno_mio` unía con facilitadores por curso_id, así que
-- ignoraba las asignaciones por categoría. Se reescribe apoyándose
-- en la función de arriba para que haya una sola definición de
-- "curso que gestiono".
create or replace function public.es_alumno_mio(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.acceso ac
    where ac.usuario_id = p_usuario
      and public.puede_gestionar_curso(ac.curso_id)
  )
$$;

-- -------------------------------------------------------------
-- 6) QUIÉN TOCA LAS CATEGORÍAS
--
--    Leerlas: cualquiera, también sin sesión. La portada las
--    necesita para agrupar los cursos del catálogo público.
--    Escribirlas: solo el admin. Son la estructura del catálogo.
-- -------------------------------------------------------------
alter table public.categorias enable row level security;

drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias
  for select to anon, authenticated
  using (true);

drop policy if exists "categorias_insert_admin" on public.categorias;
create policy "categorias_insert_admin" on public.categorias
  for insert to authenticated with check (public.es_admin());

drop policy if exists "categorias_update_admin" on public.categorias;
create policy "categorias_update_admin" on public.categorias
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "categorias_delete_admin" on public.categorias;
create policy "categorias_delete_admin" on public.categorias
  for delete to authenticated using (public.es_admin());

-- La bitácora también vigila las categorías, si ya está instalada.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'registrar_auditoria'
  ) then
    drop trigger if exists auditar_categorias on public.categorias;
    create trigger auditar_categorias
      after insert or update or delete on public.categorias
      for each row execute function public.registrar_auditoria();
    raise notice 'bitacora activada en categorias';
  end if;
end $$;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 7) COMPROBACIÓN
-- -------------------------------------------------------------
select k.nombre as categoria, count(c.id) as cursos
from public.categorias k
left join public.cursos c on c.categoria_id = k.id
group by k.nombre
order by k.nombre;

select 'cursos sin categoria' as que, count(*) as n
from public.cursos where categoria_id is null;

-- =============================================================
--  RESULTADO ESPERADO
--  La primera tabla lista tus líneas con cuántos cursos tiene
--  cada una. La segunda debería dar 0, o el número de cursos a
--  los que nunca les pusiste línea (esos se clasifican a mano
--  desde el panel).
-- =============================================================
