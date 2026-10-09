-- =============================================================
--  ROLES CON PERMISOS CONFIGURABLES
--
--  QUÉ RESUELVE
--  Hoy hay cuatro roles fijos en el código: administrador de
--  plataforma, administrador de organización, facilitador y alumno.
--  Hace falta «Coordinación», y después hará falta otro, y cada uno
--  obliga a tocar código.
--
--  Peor: un coordinador tendría que ser administrador de la
--  organización para armar grupos, y eso le daría acceso al contrato
--  y a lo que la institución paga.
--
--  Y cada cliente llama distinto a lo mismo: «coordinación
--  académica», «jefatura de carrera», «subdirección». Con roles
--  fijos, o se inventan todos o alguien usa uno que no es el suyo.
--
--  QUÉ DEJA
--  Un catálogo de permisos (lo que se puede hacer) y roles por
--  organización que agrupan permisos. Cada cliente nombra los suyos.
--
--  ESTO NO SUSTITUYE NADA
--  `admins`, `facilitadores` y todas las políticas que existen
--  siguen funcionando igual. Reemplazarlas de golpe significaría
--  reescribir noventa y nueve políticas a la vez, y un error ahí
--  deja a alguien sin acceso o se lo da de más. Lo nuevo se SUMA:
--  quien administra la organización conserva todo, y los roles
--  nuevos conceden permisos a quien antes no tenía ninguno.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ORGANIZACIONES_1_BASE y ASISTENCIA.
-- =============================================================

-- -------------------------------------------------------------
-- 1) EL CATÁLOGO DE PERMISOS
--
--    Lo decide la plataforma, no el cliente: si cada organización
--    pudiera inventar permisos, el código no sabría qué comprobar.
--    Lo que el cliente decide es qué permisos tiene cada rol suyo.
-- -------------------------------------------------------------
create table if not exists public.permisos (
  clave       text primary key,
  grupo       text not null,
  nombre      text not null,
  descripcion text,
  orden       int  not null default 100
);

insert into public.permisos (clave, grupo, nombre, descripcion, orden)
select * from (values
  ('cursos.ver',            'Contenido',  'Ver los cursos',          'Entrar al contenido sin poder cambiarlo', 10),
  ('cursos.editar',         'Contenido',  'Editar cursos',           'Crear y modificar cursos, módulos y recursos', 20),
  ('examenes.editar',       'Contenido',  'Editar exámenes',         'Incluye el banco de preguntas', 30),
  ('foro.moderar',          'Contenido',  'Moderar el foro',         'Abrir, cerrar y calificar temas', 40),

  ('alumnos.ver',           'Personas',   'Ver alumnos',             'La lista y su avance', 50),
  ('alumnos.inscribir',     'Personas',   'Inscribir y dar de baja', 'Altas, bajas y cambios de grupo', 60),
  ('facilitadores.asignar', 'Personas',   'Asignar docentes',        'Decidir quién imparte qué', 70),

  ('grupos.gestionar',      'Operación',  'Gestionar grupos',        'Generaciones, cupos, modalidad y sede', 80),
  ('asistencia.pasar',      'Operación',  'Pasar lista',             'Registrar la asistencia de una sesión', 90),
  ('asistencia.justificar', 'Operación',  'Justificar faltas',       'Distinto de pasar lista a propósito', 100),
  ('sedes.gestionar',       'Operación',  'Gestionar sedes',         'Dar de alta planteles', 110),

  ('calificaciones.ver',    'Evaluación', 'Ver calificaciones',      'De todo el grupo', 120),
  ('calificaciones.capturar','Evaluación','Capturar calificaciones', 'Calificar entregas y exámenes', 130),
  ('ponderacion.definir',   'Evaluación', 'Definir la ponderación',  'Cuánto pesa cada actividad en la nota final', 140),

  ('documentos.generar',    'Documentos', 'Generar documentos',      'Actas, constancias y listas', 150),
  ('documentos.plantillas', 'Documentos', 'Editar plantillas',       'El formato oficial de la institución', 160),
  ('constancias.emitir',    'Documentos', 'Emitir constancias',      'Con folio verificable', 170),

  ('indicadores.ver',       'Dirección',  'Ver indicadores',         'El tablero de la institución', 180),
  ('datos.exportar',        'Dirección',  'Exportar datos',          'Llevarse todo en CSV', 190),
  ('marca.editar',          'Dirección',  'Editar la marca',         'Nombre, logo y colores', 200)
) as nuevos(clave, grupo, nombre, descripcion, orden)
where not exists (select 1 from public.permisos p where p.clave = nuevos.clave);

-- -------------------------------------------------------------
-- 2) LOS ROLES DE CADA ORGANIZACIÓN
-- -------------------------------------------------------------
create table if not exists public.roles (
  id              bigserial primary key,
  organizacion_id bigint not null references public.organizaciones(id) on delete cascade,
  nombre          text   not null,
  descripcion     text,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);

create unique index if not exists roles_nombre_idx
  on public.roles (organizacion_id, lower(nombre));

create table if not exists public.rol_permisos (
  rol_id  bigint not null references public.roles(id) on delete cascade,
  permiso text   not null references public.permisos(clave) on delete cascade,
  primary key (rol_id, permiso)
);

-- -------------------------------------------------------------
-- 3) A QUIÉN SE LE DA, Y SOBRE QUÉ
--
--    El ÁMBITO es lo que distingue «coordinador» de «coordinador de
--    esta sede». En blanco vale para toda la organización; con sede
--    o categoría, solo ahí.
--
--    Se guarda el CORREO y no el id de usuario, igual que en
--    `facilitadores`: así el rol puede asignarse antes de que la
--    persona se registre, y la espera cuando entre.
-- -------------------------------------------------------------
create table if not exists public.asignaciones_rol (
  id           bigserial primary key,
  rol_id       bigint not null references public.roles(id) on delete cascade,
  email        text   not null,
  sede_id      bigint references public.sedes(id) on delete cascade,
  categoria_id bigint references public.categorias(id) on delete cascade,
  asignado_por text,
  creado_en    timestamptz not null default now()
);

create unique index if not exists asignaciones_rol_idx
  on public.asignaciones_rol
     (rol_id, lower(email), coalesce(sede_id, 0), coalesce(categoria_id, 0));

create index if not exists asignaciones_email_idx
  on public.asignaciones_rol (lower(email));

-- -------------------------------------------------------------
-- 4) LA PREGUNTA: ¿PUEDO HACER ESTO?
--
--    El orden importa y es deliberado:
--      1. El administrador de la plataforma puede todo.
--      2. El administrador de la organización puede todo lo suyo.
--         Si no, al instalar esto se quedaría sin permisos hasta
--         que alguien le creara un rol, y ese alguien sería él.
--      3. Y si no, se miran sus roles.
--
--    El ámbito se comprueba así: una asignación SIN sede vale para
--    todas; una CON sede, solo para esa. Lo mismo con la categoría.
-- -------------------------------------------------------------
create or replace function public.tiene_permiso(
  p_permiso   text,
  p_org       bigint,
  p_sede      bigint default null,
  p_categoria bigint default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.es_admin_de(p_org)
    or exists (
      select 1
      from public.asignaciones_rol a
      join public.roles r on r.id = a.rol_id
      join public.rol_permisos rp on rp.rol_id = r.id
      where lower(a.email) = lower(auth.jwt() ->> 'email')
        and r.organizacion_id = p_org
        and r.activo
        and rp.permiso = p_permiso
        and (a.sede_id is null or a.sede_id = p_sede)
        and (a.categoria_id is null or a.categoria_id = p_categoria)
    )
$$;

revoke all on function public.tiene_permiso(text, bigint, bigint, bigint) from public;
grant execute on function public.tiene_permiso(text, bigint, bigint, bigint)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 5) MIS PERMISOS, DE UNA VEZ
--
--    Para que la pantalla no haga una llamada por cada botón que
--    tiene que decidir si enseñar.
-- -------------------------------------------------------------
create or replace function public.mis_permisos(p_org bigint)
returns table (permiso text, sede_id bigint, categoria_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  -- El administrador de la organización los tiene todos, sin ámbito.
  select p.clave, null::bigint, null::bigint
    from public.permisos p
   where public.es_admin_de(p_org)
  union
  select rp.permiso, a.sede_id, a.categoria_id
    from public.asignaciones_rol a
    join public.roles r on r.id = a.rol_id
    join public.rol_permisos rp on rp.rol_id = r.id
   where lower(a.email) = lower(auth.jwt() ->> 'email')
     and r.organizacion_id = p_org
     and r.activo
$$;

revoke all on function public.mis_permisos(bigint) from public;
grant execute on function public.mis_permisos(bigint) to authenticated;

-- -------------------------------------------------------------
-- 6) TRES ROLES PARA EMPEZAR
--
--    Se crean A PETICIÓN y no al dar de alta la organización: una
--    institución que no los quiera no debería encontrarse tres roles
--    que no pidió. Y los permisos son un punto de partida, no una
--    recomendación cerrada.
--
--    Nótese lo que Dirección NO lleva: capturar calificaciones ni
--    pasar lista. No es un descuido; dirigir no es dar clase, y un
--    rol que puede todo es un rol que no distingue nada.
-- -------------------------------------------------------------
create or replace function public.sembrar_roles_basicos(p_org bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol  bigint;
  v_hechos text := '';
begin
  if not public.es_admin_de(p_org) then
    raise exception 'No administras esa organización.' using errcode = '42501';
  end if;

  -- Dirección: mira, autoriza y se lleva los datos.
  if not exists (select 1 from public.roles where organizacion_id = p_org and lower(nombre) = 'dirección') then
    insert into public.roles (organizacion_id, nombre, descripcion)
    values (p_org, 'Dirección', 'Mira, autoriza y se lleva los datos. No imparte.')
    returning id into v_rol;
    insert into public.rol_permisos (rol_id, permiso)
    select v_rol, c from unnest(array[
      'cursos.ver', 'alumnos.ver', 'calificaciones.ver', 'indicadores.ver',
      'datos.exportar', 'marca.editar', 'documentos.generar',
      'documentos.plantillas', 'facilitadores.asignar'
    ]) c;
    v_hechos := v_hechos || 'Dirección ';
  end if;

  -- Coordinación: el trabajo diario.
  if not exists (select 1 from public.roles where organizacion_id = p_org and lower(nombre) = 'coordinación') then
    insert into public.roles (organizacion_id, nombre, descripcion)
    values (p_org, 'Coordinación', 'Arma grupos, inscribe, justifica faltas y genera documentos.')
    returning id into v_rol;
    insert into public.rol_permisos (rol_id, permiso)
    select v_rol, c from unnest(array[
      'cursos.ver', 'alumnos.ver', 'alumnos.inscribir', 'facilitadores.asignar',
      'grupos.gestionar', 'asistencia.justificar', 'sedes.gestionar',
      'calificaciones.ver', 'documentos.generar', 'indicadores.ver'
    ]) c;
    v_hechos := v_hechos || 'Coordinación ';
  end if;

  -- Docente: da clase.
  if not exists (select 1 from public.roles where organizacion_id = p_org and lower(nombre) = 'docente') then
    insert into public.roles (organizacion_id, nombre, descripcion)
    values (p_org, 'Docente', 'Imparte: contenido, asistencia y calificaciones de sus grupos.')
    returning id into v_rol;
    insert into public.rol_permisos (rol_id, permiso)
    select v_rol, c from unnest(array[
      'cursos.ver', 'cursos.editar', 'examenes.editar', 'foro.moderar',
      'alumnos.ver', 'asistencia.pasar', 'calificaciones.ver',
      'calificaciones.capturar', 'documentos.generar'
    ]) c;
    v_hechos := v_hechos || 'Docente ';
  end if;

  return case when v_hechos = '' then 'Ya existían los tres.' else 'Creados: ' || v_hechos end;
end $$;

revoke all on function public.sembrar_roles_basicos(bigint) from public;
grant execute on function public.sembrar_roles_basicos(bigint) to authenticated;

-- -------------------------------------------------------------
-- 7) QUIÉN VE Y QUIÉN TOCA
--
--    El catálogo lo lee cualquiera con sesión: son nombres de
--    permisos, no datos. Los roles y las asignaciones, solo quien
--    administra la organización: repartir permisos no es algo que
--    deba poder hacer quien los recibió.
-- -------------------------------------------------------------
alter table public.permisos enable row level security;
drop policy if exists "permisos_select" on public.permisos;
create policy "permisos_select" on public.permisos
  for select to authenticated using (true);

alter table public.roles enable row level security;

drop policy if exists "roles_select" on public.roles;
create policy "roles_select" on public.roles
  for select to authenticated
  using (
    public.es_admin_de(organizacion_id)
    or exists (select 1 from public.asignaciones_rol a
                where a.rol_id = id
                  and lower(a.email) = lower(auth.jwt() ->> 'email'))
  );

drop policy if exists "roles_escribir" on public.roles;
create policy "roles_escribir" on public.roles
  for all to authenticated
  using (public.es_admin_de(organizacion_id))
  with check (public.es_admin_de(organizacion_id));

alter table public.rol_permisos enable row level security;

drop policy if exists "rol_permisos_select" on public.rol_permisos;
create policy "rol_permisos_select" on public.rol_permisos
  for select to authenticated
  using (exists (select 1 from public.roles r
                  where r.id = rol_id
                    and (public.es_admin_de(r.organizacion_id)
                      or exists (select 1 from public.asignaciones_rol a
                                  where a.rol_id = r.id
                                    and lower(a.email) = lower(auth.jwt() ->> 'email')))));

drop policy if exists "rol_permisos_escribir" on public.rol_permisos;
create policy "rol_permisos_escribir" on public.rol_permisos
  for all to authenticated
  using (exists (select 1 from public.roles r
                  where r.id = rol_id and public.es_admin_de(r.organizacion_id)))
  with check (exists (select 1 from public.roles r
                       where r.id = rol_id and public.es_admin_de(r.organizacion_id)));

alter table public.asignaciones_rol enable row level security;

drop policy if exists "asignaciones_select" on public.asignaciones_rol;
create policy "asignaciones_select" on public.asignaciones_rol
  for select to authenticated
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or exists (select 1 from public.roles r
                where r.id = rol_id and public.es_admin_de(r.organizacion_id))
  );

drop policy if exists "asignaciones_escribir" on public.asignaciones_rol;
create policy "asignaciones_escribir" on public.asignaciones_rol
  for all to authenticated
  using (exists (select 1 from public.roles r
                  where r.id = rol_id and public.es_admin_de(r.organizacion_id)))
  with check (exists (select 1 from public.roles r
                       where r.id = rol_id and public.es_admin_de(r.organizacion_id)));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 8) COMPROBACIÓN
-- -------------------------------------------------------------
select 'permisos en el catalogo' as que, count(*)::text as valor from public.permisos
union all
select 'tablas nuevas',
  (select count(*)::text from information_schema.tables
    where table_schema = 'public'
      and table_name in ('permisos', 'roles', 'rol_permisos', 'asignaciones_rol'))
union all
select 'roles creados', (select count(*)::text from public.roles)
union all
select 'funciones', (select count(*)::text from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('tiene_permiso', 'mis_permisos', 'sembrar_roles_basicos'));

-- =============================================================
--  RESULTADO ESPERADO
--  · permisos en el catalogo = 21
--  · tablas nuevas           = 4
--  · roles creados           = 0  (se siembran desde el panel)
--  · funciones               = 3
--
--  NADA CAMBIA PARA NADIE TODAVIA. Quien administra sigue
--  administrando y quien facilita sigue facilitando: lo nuevo SUMA
--  permisos a quien no tenia, no se los quita a nadie.
--
--  SIGUIENTE PASO
--  Panel -> Roles -> "Crear los tres roles basicos", y despues
--  asignar personas. Revisa los permisos de cada rol antes de
--  asignar a nadie: son un punto de partida, no una recomendacion.
--
--  LO QUE TODAVIA NO HACE
--  Las politicas de las tablas siguen mirando `admins` y
--  `facilitadores`. Un rol nuevo concede permisos en la PANTALLA;
--  llevarlos tambien a la base es el paso siguiente y hay que
--  hacerlo tabla por tabla, con cuidado: son noventa y nueve
--  politicas y un error ahi deja a alguien fuera o le abre de mas.
-- =============================================================
