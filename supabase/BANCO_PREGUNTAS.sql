-- =============================================================
--  BANCO DE PREGUNTAS
--
--  QUÉ RESUELVE
--  Hoy cada examen guarda sus preguntas y nada más. Si escribes
--  veinte buenas preguntas sobre duelo prolongado para el curso A y
--  luego quieres usar diez en el curso B, las vuelves a escribir o
--  las copias a mano desde Excel. Para una organización con varios
--  facilitadores eso es peor: cada uno reinventa el mismo examen y
--  nadie sabe qué preguntas ya existen.
--
--  QUÉ HACE
--  Una biblioteca de preguntas por organización, con tema y
--  dificultad, de la que los exámenes sacan copias.
--
--  POR QUÉ COPIAS Y NO REFERENCIAS
--  Si el examen apuntara al banco, corregir una pregunta cambiaría
--  el examen que ya respondieron doscientas personas: sus respuestas
--  guardadas dejarían de corresponder al enunciado y una
--  calificación ya comunicada se volvería indefendible. Un examen
--  aplicado es un registro de evaluación y queda congelado.
--
--  QUIÉN ESCRIBE EN ÉL
--  El admin de la organización y sus facilitadores, porque ya
--  editan exámenes de sus cursos. Borrar es distinto: un
--  facilitador solo puede borrar lo que él escribió. El banco de
--  una institución es patrimonio compartido y no debe poder
--  vaciarlo quien pasó por ahí un semestre.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ORGANIZACIONES_1_BASE y CATEGORIAS.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA TABLA
--
--    `pregunta` y `tipo` salen a columnas propias aunque también
--    estén implícitos en el JSON: así se puede listar, buscar y
--    filtrar sin abrir `contenido` en cada fila.
--
--    `contenido` guarda lo que cambia según el tipo —opciones,
--    respuesta esperada o pares— con la misma forma que ya usan los
--    exámenes. Si fuera otra, habría que traducir en dos sentidos y
--    cada traducción es una oportunidad de perder una opción.
-- -------------------------------------------------------------
create table if not exists public.banco_preguntas (
  id              bigserial primary key,
  organizacion_id bigint  not null references public.organizaciones(id) on delete cascade,
  tema            text,
  tipo            text    not null,
  pregunta        text    not null,
  contenido       jsonb   not null default '{}'::jsonb,
  dificultad      int,
  creado_por      text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  activa          boolean not null default true
);

alter table public.banco_preguntas
  drop constraint if exists banco_preguntas_tipo_check;
alter table public.banco_preguntas
  add constraint banco_preguntas_tipo_check
  check (tipo in ('opcion', 'vf', 'corta', 'emparejar'));

alter table public.banco_preguntas
  drop constraint if exists banco_preguntas_dificultad_check;
alter table public.banco_preguntas
  add constraint banco_preguntas_dificultad_check
  check (dificultad is null or dificultad between 1 and 3);

create index if not exists banco_preguntas_org_idx
  on public.banco_preguntas (organizacion_id, tema);
create index if not exists banco_preguntas_tipo_idx
  on public.banco_preguntas (organizacion_id, tipo);

-- -------------------------------------------------------------
-- 2) LA FECHA DE CAMBIO, SIN CONFIAR EN LA PANTALLA
--
--    Si `actualizado_en` lo pusiera el navegador, bastaría olvidarlo
--    en una sola pantalla para que la columna mintiera. Lo pone la
--    base en cada UPDATE.
-- -------------------------------------------------------------
create or replace function public.tocar_banco_pregunta()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists banco_preguntas_tocar on public.banco_preguntas;
create trigger banco_preguntas_tocar
  before update on public.banco_preguntas
  for each row execute function public.tocar_banco_pregunta();

-- -------------------------------------------------------------
-- 3) ¿FACILITO ALGO DE ESTA ORGANIZACIÓN?
--
--    `puede_gestionar_curso` contesta por curso; aquí hace falta la
--    pregunta por organización, porque el banco no cuelga de un
--    curso concreto.
-- -------------------------------------------------------------
create or replace function public.es_facilitador_de_org(p_org bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.facilitadores f
    where lower(f.email) = lower(auth.jwt() ->> 'email')
      and (
        exists (select 1 from public.cursos c
                 where c.id = f.curso_id and c.organizacion_id = p_org)
        or exists (select 1 from public.categorias k
                 where k.id = f.categoria_id and k.organizacion_id = p_org)
      )
  )
$$;

revoke all on function public.es_facilitador_de_org(bigint) from public;
grant execute on function public.es_facilitador_de_org(bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 4) QUIÉN VE Y QUIÉN ESCRIBE
--
--    Leer y agregar: el admin de la organización y sus
--    facilitadores. Un alumno no entra aquí ni de lectura: el banco
--    contiene las respuestas correctas de todos los exámenes de la
--    institución. Esto es lo más sensible del script.
--
--    Editar y borrar: el admin de la organización, o el autor sobre
--    lo suyo.
-- -------------------------------------------------------------
alter table public.banco_preguntas enable row level security;

drop policy if exists "banco_select" on public.banco_preguntas;
create policy "banco_select" on public.banco_preguntas
  for select to authenticated
  using (
    public.es_admin_de(organizacion_id)
    or public.es_facilitador_de_org(organizacion_id)
  );

drop policy if exists "banco_insert" on public.banco_preguntas;
create policy "banco_insert" on public.banco_preguntas
  for insert to authenticated
  with check (
    public.es_admin_de(organizacion_id)
    or public.es_facilitador_de_org(organizacion_id)
  );

drop policy if exists "banco_update" on public.banco_preguntas;
create policy "banco_update" on public.banco_preguntas
  for update to authenticated
  using (
    public.es_admin_de(organizacion_id)
    or lower(creado_por) = lower(auth.jwt() ->> 'email')
  )
  with check (
    public.es_admin_de(organizacion_id)
    or lower(creado_por) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "banco_delete" on public.banco_preguntas;
create policy "banco_delete" on public.banco_preguntas
  for delete to authenticated
  using (
    public.es_admin_de(organizacion_id)
    or lower(creado_por) = lower(auth.jwt() ->> 'email')
  );

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 5) COMPROBACIÓN
-- -------------------------------------------------------------
select 'tabla del banco' as que,
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name = 'banco_preguntas') as n
union all
select 'politicas del banco',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'banco_preguntas')
union all
select 'preguntas guardadas', (select count(*)::text from public.banco_preguntas)
union all
select 'proteccion de filas activa',
  (select case when relrowsecurity then 'si' else 'NO — HAY UN HUECO' end
     from pg_class where oid = 'public.banco_preguntas'::regclass);

-- =============================================================
--  RESULTADO ESPERADO
--  · tabla del banco     = 1
--  · politicas del banco = 4
--  · preguntas guardadas = 0
--  · proteccion de filas = si
--
--  NADA CAMBIA PARA TUS ALUMNOS NI PARA TUS EXAMENES ACTUALES.
--  Esto solo agrega una biblioteca vacia; los examenes que ya
--  existen siguen con sus preguntas donde estaban.
--
--  LO QUE NO HACE
--  1. No aleatoriza por alumno. Puedes sacar 10 preguntas al azar
--     de 40 al ARMAR el examen, y todos los alumnos ven esas 10.
--     Que cada alumno reciba un sorteo distinto exige guardar el
--     juego de preguntas de cada intento, y eso cambia como se
--     responde y como se revisa un examen. Es la pieza grande que
--     queda; dimelo y la hacemos aparte.
--  2. No lleva estadistica de la pregunta (cuantos la fallan). Es lo
--     que de verdad distingue una pregunta mala de una dificil, y se
--     puede calcular despues sobre los intentos que ya guardas.
-- =============================================================
