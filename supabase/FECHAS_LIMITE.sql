-- =============================================================
--  FECHAS LÍMITE, CIERRE AUTOMÁTICO Y PRÓRROGAS
--
--  QUÉ HAY HOY
--  Solo las tareas tienen `fecha_limite`, y es puramente
--  informativa: se enseña, y quien entrega tarde entrega igual. Los
--  exámenes y los temas del foro no tienen fecha de ninguna clase.
--
--  QUÉ DEJA ESTE SCRIPT
--  1. Fecha límite en las tres actividades evaluables.
--  2. Cierre automático al vencer, imponiéndolo en la BASE.
--  3. Prórrogas: a un alumno concreto o a una generación entera.
--
--  POR QUÉ EL CIERRE VA EN LA BASE Y NO EN LA PANTALLA
--  Esconder el botón de entregar no cierra nada: la aplicación habla
--  con la base desde el navegador, y quien sepa abrir la consola
--  entrega igual tres días después. Si una fecha límite se puede
--  saltar, no es una fecha límite, y el día que un alumno reclame
--  por qué a otro le contó una entrega tardía no vas a tener
--  respuesta.
--
--  DOS COSAS DISTINTAS: VENCER Y CERRAR
--  `fecha_limite` dice cuándo se esperaba. `cierra_al_vencer` dice
--  si al pasar esa fecha se bloquea o solo se marca como tardía.
--  Separarlas importa: hay trabajos donde llegar tarde resta y hay
--  exámenes donde llegar tarde no existe, y un solo campo obliga a
--  elegir la misma política para todo.
--
--  QUIÉN NO TIENE FECHA LÍMITE
--  Quien gestiona el curso. Un facilitador que entra a comentar en
--  el foro un mes después no está entregando nada tarde: está dando
--  clase.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ROLES_3, TAREAS_1_BASE y GENERACIONES.
--
--  NADA CAMBIA HASTA QUE PONGAS UNA FECHA. Sin `fecha_limite`, todo
--  sigue abierto igual que hoy.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LAS COLUMNAS
-- -------------------------------------------------------------
alter table public.tareas
  add column if not exists cierra_al_vencer boolean not null default true;

alter table public.examenes
  add column if not exists fecha_limite timestamptz;
alter table public.examenes
  add column if not exists cierra_al_vencer boolean not null default true;

alter table public.foro_hilos
  add column if not exists fecha_limite timestamptz;
alter table public.foro_hilos
  add column if not exists cierra_al_vencer boolean not null default true;

-- -------------------------------------------------------------
-- 2) LAS PRÓRROGAS
--
--    Una prórroga es para UN alumno o para UNA generación, nunca
--    para los dos a la vez y nunca para ninguno. Ampliar el plazo a
--    todo el mundo no necesita una fila: es cambiar la fecha de la
--    actividad, que es más claro de leer dentro de un año.
--
--    `nueva_fecha` sustituye a la original solo si es POSTERIOR.
--    Una prórroga que acorta el plazo sería una trampa, no una
--    prórroga, y se impide más abajo tomando siempre la mayor.
-- -------------------------------------------------------------
create table if not exists public.prorrogas (
  id            bigserial primary key,
  tipo          text   not null,
  actividad_id  bigint not null,
  usuario_id    uuid,
  generacion_id bigint references public.generaciones(id) on delete cascade,
  nueva_fecha   timestamptz not null,
  motivo        text,
  creado_por    text,
  creado_en     timestamptz not null default now()
);

alter table public.prorrogas drop constraint if exists prorrogas_tipo_check;
alter table public.prorrogas add constraint prorrogas_tipo_check
  check (tipo in ('tarea', 'examen', 'foro'));

alter table public.prorrogas drop constraint if exists prorrogas_destino_check;
alter table public.prorrogas add constraint prorrogas_destino_check
  check ((usuario_id is not null) <> (generacion_id is not null));

-- Una prórroga por persona y actividad, y una por generación y
-- actividad. Sin esto, dos clics seguidos dejan dos filas y la que
-- manda es un azar.
create unique index if not exists prorrogas_usuario_idx
  on public.prorrogas (tipo, actividad_id, usuario_id)
  where usuario_id is not null;
create unique index if not exists prorrogas_generacion_idx
  on public.prorrogas (tipo, actividad_id, generacion_id)
  where generacion_id is not null;

-- -------------------------------------------------------------
-- 3) ¿DE QUÉ CURSO ES UNA ACTIVIDAD?
--
--    Hace falta para saber quién la gestiona, y por tanto quién no
--    tiene fecha límite.
-- -------------------------------------------------------------
create or replace function public.curso_de_actividad(p_tipo text, p_id bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_curso bigint;
begin
  if p_tipo = 'tarea' then
    select coalesce(t.curso_id, m.curso_id) into v_curso
      from public.tareas t
      left join public.modulos m on m.id = t.modulo_id
     where t.id = p_id;
  elsif p_tipo = 'examen' then
    select coalesce(e.curso_id, m.curso_id) into v_curso
      from public.examenes e
      left join public.modulos m on m.id = e.modulo_id
     where e.id = p_id;
  elsif p_tipo = 'foro' then
    select h.curso_id into v_curso from public.foro_hilos h where h.id = p_id;
  end if;
  return v_curso;
end $$;

revoke all on function public.curso_de_actividad(text, bigint) from public;
grant execute on function public.curso_de_actividad(text, bigint)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 4) LA FECHA QUE DE VERDAD APLICA A ESTA PERSONA
--
--    La de la actividad, o la de su prórroga si es posterior. Se
--    toma siempre la MAYOR: así una prórroga nunca puede acortar un
--    plazo, ni siquiera por error de dedo al teclear la fecha.
-- -------------------------------------------------------------
create or replace function public.fecha_limite_efectiva(
  p_tipo text, p_id bigint, p_usuario uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base     timestamptz;
  v_prorroga timestamptz;
begin
  if p_tipo = 'tarea' then
    select t.fecha_limite into v_base from public.tareas t where t.id = p_id;
  elsif p_tipo = 'examen' then
    select e.fecha_limite into v_base from public.examenes e where e.id = p_id;
  elsif p_tipo = 'foro' then
    select h.fecha_limite into v_base from public.foro_hilos h where h.id = p_id;
  else
    return null;
  end if;

  select max(p.nueva_fecha) into v_prorroga
    from public.prorrogas p
   where p.tipo = p_tipo
     and p.actividad_id = p_id
     and (
       p.usuario_id = p_usuario
       or (p.generacion_id is not null and exists (
             select 1 from public.acceso a
              where a.usuario_id = p_usuario
                and a.generacion_id = p.generacion_id))
     );

  if v_base is null then return v_prorroga; end if;
  if v_prorroga is null then return v_base; end if;
  return greatest(v_base, v_prorroga);
end $$;

revoke all on function public.fecha_limite_efectiva(text, bigint, uuid) from public;
grant execute on function public.fecha_limite_efectiva(text, bigint, uuid)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 5) ¿PUEDE ESTA PERSONA ENTREGAR AHORA?
-- -------------------------------------------------------------
create or replace function public.puede_entregar(
  p_tipo text, p_id bigint, p_usuario uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cierra boolean;
  v_fecha  timestamptz;
begin
  -- Quien gestiona el curso no entrega: da clase.
  if public.puede_gestionar_curso(public.curso_de_actividad(p_tipo, p_id)) then
    return true;
  end if;

  if p_tipo = 'tarea' then
    select t.cierra_al_vencer into v_cierra from public.tareas t where t.id = p_id;
  elsif p_tipo = 'examen' then
    select e.cierra_al_vencer into v_cierra from public.examenes e where e.id = p_id;
  elsif p_tipo = 'foro' then
    select h.cierra_al_vencer into v_cierra from public.foro_hilos h where h.id = p_id;
  else
    return true;
  end if;

  -- Si no cierra, la fecha es un aviso y no una puerta.
  if not coalesce(v_cierra, true) then return true; end if;

  v_fecha := public.fecha_limite_efectiva(p_tipo, p_id, p_usuario);
  if v_fecha is null then return true; end if;   -- sin fecha, siempre abierto
  return now() <= v_fecha;
end $$;

revoke all on function public.puede_entregar(text, bigint, uuid) from public;
grant execute on function public.puede_entregar(text, bigint, uuid)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 6) EL CIERRE, IMPUESTO
--
--    Solo se bloquea a quien actúa SOBRE SÍ MISMO. El docente que
--    califica una entrega modifica esa misma fila, y bloquearlo
--    sería impedirle calificar lo que llegó a tiempo.
-- -------------------------------------------------------------
create or replace function public.verificar_plazo_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is distinct from auth.uid() then
    return new;              -- lo está tocando otra persona: calificando
  end if;
  -- En un UPDATE solo importa si cambia LO ENTREGADO.
  if tg_op = 'UPDATE'
     and new.archivo_path is not distinct from old.archivo_path
     and new.comentario   is not distinct from old.comentario then
    return new;
  end if;
  if not public.puede_entregar('tarea', new.tarea_id, new.usuario_id) then
    raise exception 'El plazo de esta tarea ya cerró. Pídele una prórroga a quien imparte el curso.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists entregas_plazo on public.entregas;
create trigger entregas_plazo
  before insert or update on public.entregas
  for each row execute function public.verificar_plazo_entrega();

create or replace function public.verificar_plazo_examen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is distinct from auth.uid() then return new; end if;
  if not public.puede_entregar('examen', new.examen_id, new.usuario_id) then
    raise exception 'El plazo de este examen ya cerró. Pídele una prórroga a quien imparte el curso.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists intentos_plazo on public.intentos_examen;
create trigger intentos_plazo
  before insert on public.intentos_examen
  for each row execute function public.verificar_plazo_examen();

create or replace function public.verificar_plazo_foro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.autor_id is distinct from auth.uid() then return new; end if;
  if not public.puede_entregar('foro', new.hilo_id, new.autor_id) then
    raise exception 'El plazo de participación en este tema ya cerró.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists foro_plazo on public.foro_respuestas;
create trigger foro_plazo
  before insert on public.foro_respuestas
  for each row execute function public.verificar_plazo_foro();

-- -------------------------------------------------------------
-- 7) QUIÉN VE Y QUIÉN DA PRÓRROGAS
--
--    El alumno VE las suyas: saber que tiene plazo hasta el viernes
--    es la mitad de para qué sirve una prórroga.
--    Darlas es de quien gestiona el curso, que es quien conoce el
--    caso. Un facilitador sí puede: es su grupo.
-- -------------------------------------------------------------
alter table public.prorrogas enable row level security;

drop policy if exists "prorrogas_select" on public.prorrogas;
create policy "prorrogas_select" on public.prorrogas
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.puede_gestionar_curso(public.curso_de_actividad(tipo, actividad_id))
  );

drop policy if exists "prorrogas_insert" on public.prorrogas;
create policy "prorrogas_insert" on public.prorrogas
  for insert to authenticated
  with check (public.puede_gestionar_curso(public.curso_de_actividad(tipo, actividad_id)));

drop policy if exists "prorrogas_update" on public.prorrogas;
create policy "prorrogas_update" on public.prorrogas
  for update to authenticated
  using (public.puede_gestionar_curso(public.curso_de_actividad(tipo, actividad_id)))
  with check (public.puede_gestionar_curso(public.curso_de_actividad(tipo, actividad_id)));

drop policy if exists "prorrogas_delete" on public.prorrogas;
create policy "prorrogas_delete" on public.prorrogas
  for delete to authenticated
  using (public.puede_gestionar_curso(public.curso_de_actividad(tipo, actividad_id)));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 8) COMPROBACIÓN
-- -------------------------------------------------------------
select 'columnas de fecha nuevas' as que,
  (select count(*)::text from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'examenes'   and column_name in ('fecha_limite', 'cierra_al_vencer'))
        or (table_name = 'foro_hilos' and column_name in ('fecha_limite', 'cierra_al_vencer'))
        or (table_name = 'tareas'     and column_name = 'cierra_al_vencer'))) as valor
union all
select 'tabla de prorrogas',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public' and table_name = 'prorrogas')
union all
select 'disparadores de plazo',
  (select count(*)::text from pg_trigger
    where tgname in ('entregas_plazo', 'intentos_plazo', 'foro_plazo'))
union all
select 'actividades con fecha puesta',
  ((select count(*) from public.tareas where fecha_limite is not null)
 + (select count(*) from public.examenes where fecha_limite is not null)
 + (select count(*) from public.foro_hilos where fecha_limite is not null))::text;

-- =============================================================
--  RESULTADO ESPERADO
--  · columnas de fecha nuevas   = 5
--  · tabla de prorrogas         = 1
--  · disparadores de plazo      = 3
--  · actividades con fecha      = las tareas a las que ya se la
--                                 habias puesto (puede ser 0)
--
--  NADA SE CIERRA TODAVIA. Una actividad sin `fecha_limite` sigue
--  abierta para siempre, igual que hoy. El cierre empieza a actuar
--  en cuanto le pongas fecha desde el panel.
--
--  QUE PROBAR
--  1. Ponle a una tarea una fecha de AYER, con cierre activado.
--  2. Entra con la cuenta de prueba e intenta entregar: debe
--     negarse con el mensaje del plazo.
--  3. Dale una prorroga a esa cuenta para mañana.
--  4. Vuelve a intentar: ahora debe dejar.
--
--  El paso 2 es el que importa. Si deja entregar, el cierre no esta
--  actuando y hay que mirarlo antes de anunciar fechas a nadie.
-- =============================================================
