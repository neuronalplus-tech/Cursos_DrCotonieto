-- =============================================================
--  SEDES, MODALIDAD, SESIONES Y PASE DE LISTA
--
--  DE DÓNDE SALE ESTO
--  De cuatro decisiones ya tomadas:
--    · Hay organizaciones 100% en línea (la Federación) y programas
--      presenciales que usan la misma aula. La modalidad NO es de la
--      organización: es de cada grupo.
--    · Un cliente puede tener varias sedes.
--    · El periodo se trabaja por módulos, no por semestres.
--    · Pasar lista es lo primero que hace falta.
--
--  POR QUÉ SE EXTIENDE `generaciones` Y NO SE CREA «GRUPOS»
--  `generaciones` ya es exactamente eso: un conjunto de alumnos que
--  cursa lo mismo en las mismas fechas, con su cupo, y `acceso` ya
--  apunta a ella. Crear una tabla `grupos` al lado dejaría dos
--  nombres para la misma idea y la pregunta «¿en cuál está este
--  alumno?» pasaría a tener dos respuestas posibles. Se le añaden
--  las columnas que le faltan y ya.
--
--  POR QUÉ EL PERIODO NO SE MODELA COMO SEMESTRE
--  Porque hoy todas las instituciones que conoces trabajan por
--  módulos, y un `modulo` ya existe y ya cuelga de un curso. La
--  sesión apunta al módulo cuando toca; si un día aparece un cliente
--  con semestres, se añade la capa entonces y no antes.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere GENERACIONES y ORGANIZACIONES_1_BASE.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LAS SEDES
--
--    Una sede puede ser física o no: «En línea» es una sede
--    perfectamente válida, y tenerla evita que la mitad de los
--    grupos se queden sin asignar.
-- -------------------------------------------------------------
create table if not exists public.sedes (
  id              bigserial primary key,
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,
  nombre          text   not null,
  ciudad          text,
  direccion       text,
  responsable     text,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now()
);

create index if not exists sedes_org_idx on public.sedes (organizacion_id);
create unique index if not exists sedes_nombre_idx
  on public.sedes (organizacion_id, lower(nombre));

-- -------------------------------------------------------------
-- 2) EL GRUPO: SEDE Y MODALIDAD
--
--    `modalidad` decide si tiene sentido pasar lista. Un grupo en
--    línea sin sesiones en vivo no tiene asistencia que registrar, y
--    enseñar un pase de lista vacío en esa pantalla solo confunde.
-- -------------------------------------------------------------
alter table public.generaciones
  add column if not exists sede_id bigint references public.sedes(id) on delete set null;
alter table public.generaciones
  add column if not exists modalidad text not null default 'linea';

alter table public.generaciones drop constraint if exists generaciones_modalidad_check;
alter table public.generaciones add constraint generaciones_modalidad_check
  check (modalidad in ('linea', 'presencial', 'mixta'));

create index if not exists generaciones_sede_idx on public.generaciones (sede_id);

-- -------------------------------------------------------------
-- 3) LAS SESIONES
--
--    Una sesión es una clase concreta: fecha, hora y a qué módulo
--    pertenece.
--
--    POR QUÉ HACE FALTA, Y NO BASTA CON UNA FECHA SUELTA
--    Porque «faltas del módulo 2» es la pregunta que de verdad se
--    hace al cerrar un módulo. Si la asistencia colgara solo de una
--    fecha, habría que adivinar a qué pertenece cada día, y eso se
--    adivina mal en cuanto se reprograma una clase.
-- -------------------------------------------------------------
create table if not exists public.sesiones (
  id             bigserial primary key,
  generacion_id  bigint not null references public.generaciones(id) on delete cascade,
  modulo_id      bigint references public.modulos(id) on delete set null,
  titulo         text,
  fecha          date not null,
  hora_inicio    time,
  hora_fin       time,
  lugar          text,
  impartida_por  text,
  notas          text,
  cancelada      boolean not null default false,
  creado_en      timestamptz not null default now()
);

create index if not exists sesiones_generacion_idx
  on public.sesiones (generacion_id, fecha);
create index if not exists sesiones_modulo_idx on public.sesiones (modulo_id);

-- -------------------------------------------------------------
-- 4) LA ASISTENCIA
--
--    Cuatro estados y no dos. «Presente / ausente» obliga a decidir
--    qué es un retardo y qué es una falta justificada, y cada
--    docente decidiría distinto.
--
--    `justificada` es aparte del estado a propósito: una falta
--    justificada sigue siendo una falta para el conteo de clases, y
--    deja de serlo para el reglamento. Mezclarlas en un solo campo
--    obliga a elegir una de las dos verdades.
-- -------------------------------------------------------------
create table if not exists public.asistencia (
  id            bigserial primary key,
  sesion_id     bigint not null references public.sesiones(id) on delete cascade,
  usuario_id    uuid   not null,
  estado        text   not null default 'presente',
  justificada   boolean not null default false,
  motivo        text,
  nota          text,
  registrado_por text,
  registrado_en timestamptz not null default now()
);

alter table public.asistencia drop constraint if exists asistencia_estado_check;
alter table public.asistencia add constraint asistencia_estado_check
  check (estado in ('presente', 'retardo', 'ausente', 'permiso'));

-- Una marca por persona y sesión. Sin esto, pasar lista dos veces
-- deja dos filas y el porcentaje de asistencia sale mal sin que nada
-- lo delate.
create unique index if not exists asistencia_sesion_usuario_idx
  on public.asistencia (sesion_id, usuario_id);

-- -------------------------------------------------------------
-- 5) ¿DE QUÉ CURSO ES UNA SESIÓN?
--
--    Las políticas lo necesitan: quien gestiona el curso pasa lista,
--    y el alumno ve la suya.
-- -------------------------------------------------------------
create or replace function public.curso_de_sesion(p_sesion bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select g.curso_id
  from public.sesiones s
  join public.generaciones g on g.id = s.generacion_id
  where s.id = p_sesion
$$;

revoke all on function public.curso_de_sesion(bigint) from public;
grant execute on function public.curso_de_sesion(bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 6) QUIÉN VE Y QUIÉN REGISTRA
--
--    El alumno VE su asistencia. No es cortesía: enterarse de que
--    lleva cuatro faltas cuando ya no puede acreditar es el reclamo
--    más común y el más evitable.
--
--    Registrarla es de quien imparte. Justificarla, también: el
--    disparador de abajo impide que un alumno se justifique solo.
-- -------------------------------------------------------------
alter table public.sedes enable row level security;

drop policy if exists "sedes_select" on public.sedes;
create policy "sedes_select" on public.sedes
  for select to authenticated using (true);

drop policy if exists "sedes_escribir" on public.sedes;
create policy "sedes_escribir" on public.sedes
  for all to authenticated
  using (public.es_admin_de(organizacion_id))
  with check (public.es_admin_de(organizacion_id));

alter table public.sesiones enable row level security;

drop policy if exists "sesiones_select" on public.sesiones;
create policy "sesiones_select" on public.sesiones
  for select to authenticated
  using (
    public.puede_gestionar_curso(
      (select g.curso_id from public.generaciones g where g.id = generacion_id))
    or exists (
      select 1 from public.acceso a
      join public.generaciones g on g.id = a.generacion_id
      where a.usuario_id = auth.uid() and g.id = generacion_id)
  );

drop policy if exists "sesiones_escribir" on public.sesiones;
create policy "sesiones_escribir" on public.sesiones
  for all to authenticated
  using (public.puede_gestionar_curso(
    (select g.curso_id from public.generaciones g where g.id = generacion_id)))
  with check (public.puede_gestionar_curso(
    (select g.curso_id from public.generaciones g where g.id = generacion_id)));

alter table public.asistencia enable row level security;

drop policy if exists "asistencia_select" on public.asistencia;
create policy "asistencia_select" on public.asistencia
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.puede_gestionar_curso(public.curso_de_sesion(sesion_id))
  );

drop policy if exists "asistencia_escribir" on public.asistencia;
create policy "asistencia_escribir" on public.asistencia
  for all to authenticated
  using (public.puede_gestionar_curso(public.curso_de_sesion(sesion_id)))
  with check (public.puede_gestionar_curso(public.curso_de_sesion(sesion_id)));

-- -------------------------------------------------------------
-- 7) PORCENTAJE DE ASISTENCIA
--
--    Se calcula en la base porque lo piden tres sitios distintos —el
--    pase de lista, el informe y el acta— y porque hacerlo en cada
--    uno garantiza que acaben contando diferente.
--
--    LAS DOS REGLAS DE CONTEO, Y POR QUÉ
--    · Una sesión CANCELADA no cuenta para nadie: no hubo clase.
--    · Un retardo cuenta como asistencia. Si no, el porcentaje
--      castiga igual a quien llegó diez minutos tarde que a quien no
--      fue, y el número deja de servir para decidir nada.
--    Si la institución pide otra regla, se cambia AQUÍ, una vez.
-- -------------------------------------------------------------
create or replace function public.asistencia_de_generacion(p_generacion bigint)
returns table (
  usuario_id  uuid,
  sesiones    int,
  presentes   int,
  retardos    int,
  ausencias   int,
  justificadas int,
  porcentaje  numeric
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
    select distinct a.usuario_id from public.acceso a
     where a.generacion_id = p_generacion
  )
  select
    i.usuario_id,
    (select count(*)::int from sesiones_validas),
    count(*) filter (where asi.estado = 'presente')::int,
    count(*) filter (where asi.estado = 'retardo')::int,
    count(*) filter (where asi.estado = 'ausente')::int,
    count(*) filter (where asi.justificada)::int,
    case when (select count(*) from sesiones_validas) > 0
         then round(
           count(*) filter (where asi.estado in ('presente', 'retardo'))::numeric
           / (select count(*) from sesiones_validas) * 100, 1)
         else null end
  from inscritos i
  left join public.asistencia asi
         on asi.usuario_id = i.usuario_id
        and asi.sesion_id in (select id from sesiones_validas)
  group by i.usuario_id;
end $$;

revoke all on function public.asistencia_de_generacion(bigint) from public;
grant execute on function public.asistencia_de_generacion(bigint) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 8) COMPROBACIÓN
-- -------------------------------------------------------------
select 'tablas nuevas' as que,
  (select count(*)::text from information_schema.tables
    where table_schema = 'public'
      and table_name in ('sedes', 'sesiones', 'asistencia')) as valor
union all
select 'columnas nuevas en generaciones',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'generaciones'
      and column_name in ('sede_id', 'modalidad'))
union all
select 'grupos por modalidad',
  (select coalesce(string_agg(modalidad || ': ' || n, ' · '), 'ninguno')
     from (select modalidad, count(*)::text n from public.generaciones
            group by modalidad) x)
union all
select 'funcion de porcentaje',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'asistencia_de_generacion');

-- =============================================================
--  RESULTADO ESPERADO
--  · tablas nuevas                   = 3
--  · columnas nuevas en generaciones = 2
--  · grupos por modalidad            = linea: N
--  · funcion de porcentaje           = 1
--
--  TODOS TUS GRUPOS QUEDAN COMO "EN LINEA", que es lo que son hoy.
--  El de tu maestria lo cambias a presencial desde el panel, y ahi
--  aparece el pase de lista.
--
--  LO QUE NO HACE
--  · No genera las sesiones solo. Un calendario que repite "todos
--    los martes" se añade despues; primero conviene ver como las
--    creas a mano, porque un generador que supone mal el patron
--    estorba mas que no tenerlo.
--  · No avisa de las faltas. Eso necesita el SMTP pendiente, y es
--    la mitad del valor: una falta que el alumno no sabe que tiene
--    no corrige nada.
-- =============================================================
