-- =============================================================
--  MÓDULOS ACTIVABLES POR CLIENTE
--
--  QUÉ RESUELVE
--  El panel va por diecisiete secciones. Un despacho de dos personas
--  no necesita «carga docente» ni «sedes», y enseñárselas no es
--  neutro: cada sección que sobra es una decisión más que tomar
--  antes de encontrar la que buscaba.
--
--  Y hay una segunda razón, menos visible y más importante: sin
--  esto, cada módulo nuevo que se construya le complica el panel
--  TAMBIÉN a quien nunca lo va a usar. El producto se vuelve más
--  pesado para todos cada vez que crece para uno.
--
--  QUÉ DEJA
--  Un catálogo de módulos, qué módulos trae cada plan, y
--  excepciones por organización. Lo activo de un cliente es lo de
--  su plan, más lo que se le haya concedido aparte, menos lo que se
--  le haya quitado.
--
--  ESTO ES TAMBIÉN LA LISTA DE PRECIOS
--  `planes` ya existe. Al colgar los módulos de ahí, vender deja de
--  ser una conversación sobre topes de alumnos y pasa a ser una
--  sobre lo que la plataforma hace: el plan Semilla trae el aula; el
--  Institucional añade control escolar; los documentos oficiales se
--  cobran aparte. Un módulo nuevo se vende sin tocar a quien no lo
--  quiere.
--
--  NADIE PIERDE NADA AL CORRERLO
--  Una organización sin plan tiene TODOS los módulos, igual que no
--  tiene topes. Tu aula y la de cualquier cliente actual siguen
--  exactamente como están.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere SUSCRIPCIONES.
-- =============================================================

-- -------------------------------------------------------------
-- 1) EL CATÁLOGO
--
--    Lo decide la plataforma: el código tiene que saber qué
--    comprobar, igual que con los permisos.
--
--    `esencial` marca lo que no se puede apagar. Un aula sin cursos
--    no es un aula más sencilla: es una pantalla vacía.
-- -------------------------------------------------------------
create table if not exists public.modulos_plataforma (
  clave       text primary key,
  nombre      text not null,
  descripcion text,
  esencial    boolean not null default false,
  orden       int not null default 100
);

insert into public.modulos_plataforma (clave, nombre, descripcion, esencial, orden)
select * from (values
  ('aula', 'Aula virtual',
   'Cursos, módulos, recursos, exámenes, tareas y foro. El cimiento.', true, 10),
  ('mensajeria', 'Mensajería interna',
   'Conversaciones entre docentes y alumnos, y comunicados por correo.', false, 20),
  ('evaluacion', 'Evaluación avanzada',
   'Banco de preguntas, exámenes aleatorios y ponderación de la nota final.', false, 30),
  ('constancias', 'Constancias verificables',
   'Con folio público que cualquiera puede comprobar.', false, 40),
  ('control_escolar', 'Control escolar',
   'Sedes, grupos con modalidad, sesiones y pase de lista.', false, 50),
  ('documentos', 'Documentos oficiales',
   'Plantillas propias de actas, constancias y listas, con firma.', false, 60),
  ('roles', 'Roles y permisos',
   'Definir sus propias figuras: dirección, coordinación, jefaturas.', false, 70),
  ('indicadores', 'Tablero de dirección',
   'Matrícula, retención, avance medio y cursos detenidos.', false, 80)
) as nuevos(clave, nombre, descripcion, esencial, orden)
where not exists (select 1 from public.modulos_plataforma m where m.clave = nuevos.clave);

-- -------------------------------------------------------------
-- 2) QUÉ TRAE CADA PLAN
-- -------------------------------------------------------------
create table if not exists public.plan_modulos (
  plan_id bigint not null references public.planes(id) on delete cascade,
  modulo  text   not null references public.modulos_plataforma(clave) on delete cascade,
  primary key (plan_id, modulo)
);

-- -------------------------------------------------------------
-- 3) EXCEPCIONES POR ORGANIZACIÓN
--
--    `activo` en vez de solo «añadir»: hace falta poder QUITAR algo
--    que trae el plan. Si no, al cliente que pide «quítame el foro,
--    confunde a mi gente» habría que bajarle el plan entero.
-- -------------------------------------------------------------
create table if not exists public.organizacion_modulos (
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,
  modulo          text   not null references public.modulos_plataforma(clave) on delete cascade,
  activo          boolean not null default true,
  nota            text,
  primary key (organizacion_id, modulo)
);

-- -------------------------------------------------------------
-- 4) QUÉ TIENE ACTIVO UNA ORGANIZACIÓN
--
--    El orden de resolución, y por qué:
--      1. Lo esencial, siempre. No se apaga.
--      2. Sin plan asignado -> todo. Igual que con los topes: una
--         organización recién creada no debe quedarse a oscuras
--         mientras se le arma el contrato.
--      3. Con plan -> lo que trae el plan.
--      4. Y encima, las excepciones de esa organización, que pueden
--         añadir o quitar.
-- -------------------------------------------------------------
create or replace function public.modulos_activos(p_org bigint)
returns table (modulo text)
language sql
stable
security definer
set search_path = public
as $$
  with org as (
    select o.id, o.plan_id, o.exenta_de_limites
      from public.organizaciones o where o.id = p_org
  ),
  base as (
    select m.clave
      from public.modulos_plataforma m, org
     where m.esencial
        or org.plan_id is null
        or org.exenta_de_limites
        or exists (select 1 from public.plan_modulos pm
                    where pm.plan_id = org.plan_id and pm.modulo = m.clave)
  ),
  -- Las excepciones mandan sobre el plan, en los dos sentidos.
  concedidos as (
    select om.modulo from public.organizacion_modulos om
     where om.organizacion_id = p_org and om.activo
  ),
  quitados as (
    select om.modulo from public.organizacion_modulos om
     where om.organizacion_id = p_org and not om.activo
  )
  select clave from (
    select clave from base
    union
    select modulo from concedidos
  ) todo
  where clave not in (select modulo from quitados)
     or clave in (select clave from public.modulos_plataforma where esencial)
$$;

revoke all on function public.modulos_activos(bigint) from public;
grant execute on function public.modulos_activos(bigint) to authenticated;

create or replace function public.modulo_activo(p_org bigint, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.modulos_activos(p_org) m where m.modulo = p_modulo)
$$;

revoke all on function public.modulo_activo(bigint, text) from public;
grant execute on function public.modulo_activo(bigint, text) to authenticated, service_role;

-- -------------------------------------------------------------
-- 5) UN REPARTO PARA EMPEZAR
--
--    Se aplica a los planes sembrados por SUSCRIPCIONES, y solo si
--    todavía no tienen módulos: así volver a correr esto no deshace
--    lo que ya hayas ajustado a mano.
-- -------------------------------------------------------------
do $$
declare v_plan bigint;
begin
  -- Semilla: el aula y poco más.
  select id into v_plan from public.planes where clave = 'semilla';
  if v_plan is not null and not exists (select 1 from public.plan_modulos where plan_id = v_plan) then
    insert into public.plan_modulos (plan_id, modulo)
    select v_plan, c from unnest(array['aula', 'mensajeria', 'constancias']) c;
  end if;

  -- Institucional: añade evaluación, control escolar y roles.
  select id into v_plan from public.planes where clave = 'institucional';
  if v_plan is not null and not exists (select 1 from public.plan_modulos where plan_id = v_plan) then
    insert into public.plan_modulos (plan_id, modulo)
    select v_plan, c from unnest(array[
      'aula', 'mensajeria', 'constancias', 'evaluacion',
      'control_escolar', 'roles', 'indicadores']) c;
  end if;

  -- Federación: todo.
  select id into v_plan from public.planes where clave = 'federacion';
  if v_plan is not null and not exists (select 1 from public.plan_modulos where plan_id = v_plan) then
    insert into public.plan_modulos (plan_id, modulo)
    select v_plan, clave from public.modulos_plataforma;
  end if;

  -- A medida: todo; el precio se negocia aparte.
  select id into v_plan from public.planes where clave = 'medida';
  if v_plan is not null and not exists (select 1 from public.plan_modulos where plan_id = v_plan) then
    insert into public.plan_modulos (plan_id, modulo)
    select v_plan, clave from public.modulos_plataforma;
  end if;
end $$;

-- -------------------------------------------------------------
-- 6) QUIÉN VE Y QUIÉN TOCA
--
--    El catálogo lo lee cualquiera con sesión: es la lista de lo
--    que la plataforma sabe hacer, y conviene que un cliente pueda
--    verla entera para saber qué más puede contratar.
--
--    Qué trae cada plan y qué tiene cada organización: lo escribe
--    solo la plataforma. Es el contrato, y ya hay un disparador que
--    impide que un cliente se edite el suyo.
-- -------------------------------------------------------------
alter table public.modulos_plataforma enable row level security;
drop policy if exists "modulos_select" on public.modulos_plataforma;
create policy "modulos_select" on public.modulos_plataforma
  for select to authenticated using (true);

alter table public.plan_modulos enable row level security;
drop policy if exists "plan_modulos_select" on public.plan_modulos;
create policy "plan_modulos_select" on public.plan_modulos
  for select to authenticated using (true);
drop policy if exists "plan_modulos_escribir" on public.plan_modulos;
create policy "plan_modulos_escribir" on public.plan_modulos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

alter table public.organizacion_modulos enable row level security;
drop policy if exists "org_modulos_select" on public.organizacion_modulos;
create policy "org_modulos_select" on public.organizacion_modulos
  for select to authenticated
  using (public.es_admin_de(organizacion_id));
drop policy if exists "org_modulos_escribir" on public.organizacion_modulos;
create policy "org_modulos_escribir" on public.organizacion_modulos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 7) COMPROBACIÓN
-- -------------------------------------------------------------
select 'modulos en el catalogo' as que, count(*)::text as valor
  from public.modulos_plataforma
union all
select 'esenciales (no se apagan)',
  (select count(*)::text from public.modulos_plataforma where esencial)
union all
select 'planes con modulos repartidos',
  (select count(distinct plan_id)::text from public.plan_modulos)
union all
select 'modulos activos en TU organizacion',
  (select count(*)::text from public.modulos_activos(
     (select id from public.organizaciones where slug = 'cotonieto')));

-- =============================================================
--  RESULTADO ESPERADO
--  · modulos en el catalogo            = 8
--  · esenciales                        = 1  (el aula)
--  · planes con modulos repartidos     = 4
--  · modulos activos en TU organizacion= 8
--
--  LOS OCHO, porque tu organizacion esta exenta. Nada cambia para
--  ti ni para ningun cliente que todavia no tenga plan.
--
--  DONDE SE AJUSTA
--  · Lo que trae cada plan: Panel -> Suscripciones -> Planes.
--  · Las excepciones de un cliente: Panel -> Organizaciones.
--
--  UNA ADVERTENCIA
--  Apagarle un modulo a un cliente NO borra sus datos: sus grupos y
--  su asistencia siguen ahi, solo deja de ver esas secciones. Si lo
--  vuelve a contratar, aparece todo donde estaba. Eso es
--  deliberado: apagar no es cancelar.
-- =============================================================
