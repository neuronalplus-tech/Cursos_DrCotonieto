-- =============================================================
--  PLANTILLAS DE DOCUMENTOS
--
--  QUÉ RESUELVE
--  Cada institución pide sus actas, constancias y listas con su
--  formato, su membrete y su redacción. Hoy el único documento que
--  emite la plataforma es la constancia, y está escrita en el
--  código: cambiarle una coma a un cliente obliga a un despliegue.
--
--  QUÉ DEJA
--  Plantillas por organización, escritas y editadas desde el panel.
--  El motor que las rellena vive en src/lib/plantillas.js y solo
--  sustituye texto: no evalúa nada, porque quien escribe la
--  plantilla es el cliente y dejarle ejecutar código sería dejarle
--  ejecutarlo dentro de la sesión de sus propios alumnos.
--
--  POR QUÉ ESTO IMPORTA MÁS DE LO QUE PARECE
--  La directora que usa Teams dijo que «nadie lo utiliza». El
--  problema de Teams no son las funciones: es que nada obliga a
--  entrar. Si el acta del grupo SALE DE AQUÍ, el docente tiene que
--  capturar aquí. La adopción deja de depender del entusiasmo.
--
--  SOBRE LA FIRMA
--  Se guarda la imagen y DÓNDE va, en porcentaje de la hoja y no en
--  milímetros: así la misma plantilla sirve en carta y en A4, que es
--  justo donde se descuadran estas cosas.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ORGANIZACIONES_1_BASE.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA TABLA
--
--    `tipo` agrupa para poder ofrecer «la plantilla de acta de esta
--    institución» sin que quien la usa tenga que elegir de una lista
--    de veinte.
-- -------------------------------------------------------------
create table if not exists public.plantillas_documento (
  id              bigserial primary key,
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,
  tipo            text   not null,
  nombre          text   not null,
  descripcion     text,
  contenido       text   not null default '',
  -- Imagen de encabezado (membrete) y de firma.
  membrete_url    text,
  firma_url       text,
  firma_nombre    text,
  firma_cargo     text,
  -- Posición de la firma en PORCENTAJE de la hoja, no en milímetros.
  firma_x         numeric not null default 50,
  firma_y         numeric not null default 80,
  firma_ancho     numeric not null default 25,
  orientacion     text   not null default 'vertical',
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

alter table public.plantillas_documento drop constraint if exists plantillas_tipo_check;
alter table public.plantillas_documento add constraint plantillas_tipo_check
  check (tipo in ('constancia', 'acta', 'lista', 'boleta', 'informe', 'libre'));

alter table public.plantillas_documento drop constraint if exists plantillas_orientacion_check;
alter table public.plantillas_documento add constraint plantillas_orientacion_check
  check (orientacion in ('vertical', 'horizontal'));

-- Fuera de la hoja no hay dónde firmar.
alter table public.plantillas_documento drop constraint if exists plantillas_firma_check;
alter table public.plantillas_documento add constraint plantillas_firma_check
  check (firma_x between 0 and 100
     and firma_y between 0 and 100
     and firma_ancho between 1 and 100);

create index if not exists plantillas_org_idx
  on public.plantillas_documento (organizacion_id, tipo);

-- -------------------------------------------------------------
-- 2) LA FECHA DE CAMBIO, PUESTA POR LA BASE
--
--    Si la pusiera la pantalla, bastaría olvidarla en un sitio para
--    que la columna mintiera. En un documento oficial, saber cuándo
--    se cambió la plantilla puede importar.
-- -------------------------------------------------------------
create or replace function public.tocar_plantilla()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists plantillas_tocar on public.plantillas_documento;
create trigger plantillas_tocar
  before update on public.plantillas_documento
  for each row execute function public.tocar_plantilla();

-- -------------------------------------------------------------
-- 3) QUIÉN VE Y QUIÉN EDITA
--
--    Verlas: quien administra la organización y quien imparte algo
--    suyo, porque el docente es quien genera el acta de su grupo.
--    Editarlas: solo quien administra. El formato de un documento
--    oficial no lo cambia cada docente por su cuenta; esa es la
--    diferencia entre un formato institucional y un volante.
-- -------------------------------------------------------------
alter table public.plantillas_documento enable row level security;

drop policy if exists "plantillas_select" on public.plantillas_documento;
create policy "plantillas_select" on public.plantillas_documento
  for select to authenticated
  using (
    public.es_admin_de(organizacion_id)
    or public.es_facilitador_de_org(organizacion_id)
  );

drop policy if exists "plantillas_escribir" on public.plantillas_documento;
create policy "plantillas_escribir" on public.plantillas_documento
  for all to authenticated
  using (public.es_admin_de(organizacion_id))
  with check (public.es_admin_de(organizacion_id));

-- -------------------------------------------------------------
-- 4) TODO LO QUE NECESITA UN DOCUMENTO DE UN GRUPO
--
--    Una sola llamada en vez de seis. Devuelve, por alumno del
--    grupo: su nombre, su calificación y su asistencia, que es lo
--    que piden el acta y la lista.
--
--    POR QUÉ LA CALIFICACIÓN NO SE CALCULA AQUÍ
--    Porque ya se calcula en src/lib/calificacion.js, y una segunda
--    implementación en SQL acabaría dando otro número. Esto devuelve
--    las PIEZAS —exámenes, tareas, foro— y la pantalla las pasa por
--    la misma función que usa todo lo demás.
-- -------------------------------------------------------------
create or replace function public.datos_de_grupo(p_generacion bigint)
returns table (
  usuario_id      uuid,
  nombre          text,
  profesion       text,
  asistencia_pct  numeric,
  faltas          int,
  sesiones        int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_curso bigint;
begin
  select g.curso_id into v_curso from public.generaciones g where g.id = p_generacion;
  if not public.puede_gestionar_curso(v_curso) then
    raise exception 'No impartes este grupo.' using errcode = '42501';
  end if;

  return query
  with sesiones_validas as (
    select s.id from public.sesiones s
     where s.generacion_id = p_generacion and not s.cancelada
  ),
  inscritos as (
    select distinct a.usuario_id as uid from public.acceso a
     where a.generacion_id = p_generacion
  )
  select
    i.uid,
    coalesce(pe.nombre_completo, '(sin nombre)')::text,
    pe.profesion::text,
    case when (select count(*) from sesiones_validas) > 0
         then round(
           count(asi.id) filter (where asi.estado in ('presente', 'retardo'))::numeric
           / (select count(*) from sesiones_validas) * 100, 1)
         else null end,
    count(asi.id) filter (where asi.estado = 'ausente')::int,
    (select count(*)::int from sesiones_validas)
  from inscritos i
  left join public.perfiles pe on pe.id = i.uid
  left join public.asistencia asi
         on asi.usuario_id = i.uid
        and asi.sesion_id in (select id from sesiones_validas)
  group by i.uid, pe.nombre_completo, pe.profesion
  order by coalesce(pe.nombre_completo, '');
end $$;

revoke all on function public.datos_de_grupo(bigint) from public;
grant execute on function public.datos_de_grupo(bigint) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 5) COMPROBACIÓN
-- -------------------------------------------------------------
select 'tabla de plantillas' as que,
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name = 'plantillas_documento') as valor
union all
select 'politicas',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'plantillas_documento')
union all
select 'funcion de datos del grupo',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'datos_de_grupo')
union all
select 'plantillas creadas',
  (select count(*)::text from public.plantillas_documento);

-- =============================================================
--  RESULTADO ESPERADO
--  · tabla de plantillas        = 1
--  · politicas                  = 2
--  · funcion de datos del grupo = 1
--  · plantillas creadas         = 0
--
--  NO SE CREA NINGUNA PLANTILLA DE EJEMPLO a proposito: las que
--  trae el panel al pulsar "partir de un ejemplo" son un punto de
--  partida para EDITAR, no algo que ninguna institucion deba usar
--  tal cual. Sembrarlas en la base las haria parecer oficiales.
--
--  LA CONSTANCIA QUE YA EXISTE SIGUE IGUAL. Esto no la toca; es un
--  camino nuevo al lado. Cuando una institucion tenga su plantilla
--  propia, usara esta; mientras tanto, la de siempre.
-- =============================================================
