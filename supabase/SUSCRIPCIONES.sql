-- =============================================================
--  SUSCRIPCIONES Y LÍMITES POR ORGANIZACIÓN
--
--  QUÉ RESUELVE
--  Hoy puedes dar de alta una organización, pero nada registra qué
--  te paga ni cuánto puede consumir. Si le vendes a la Federación
--  un plan de 150 alumnos, nada impide que inscriban 600 al mismo
--  precio. Esto es lo único del sistema que protege tu negocio y no
--  el de tus alumnos.
--
--  QUÉ HACE
--  1. Un catálogo de planes (lo que vendes, con sus topes).
--  2. El contrato de cada organización: plan, precio acordado,
--     periodo y fecha de vencimiento.
--  3. Un libro de pagos. Registrar uno corre el vencimiento.
--  4. Topes que se imponen en la base de datos, no en la pantalla.
--  5. Cierra un hueco que abrió el multi-inquilino: hasta ahora el
--     administrador de un cliente podía editar su propia fila de
--     `organizaciones`, o sea subirse él mismo el límite.
--
--  POR QUÉ EL CONTRATO VIVE EN `organizaciones` Y LOS PAGOS APARTE
--  De contrato hay uno vigente por cliente: guardarlo en una tabla
--  propia obliga a preguntar siempre "¿cuál de estas filas es la de
--  ahora?", y esa pregunta se contesta mal tarde o temprano. De
--  pagos, en cambio, el historial ES el dato: ahí sí hace falta una
--  tabla. La regla: historia donde hay dinero, estado actual donde
--  hay una sola respuesta posible.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ORGANIZACIONES_1_BASE y CATEGORIAS.
-- =============================================================

-- -------------------------------------------------------------
-- 1) EL CATÁLOGO DE PLANES
--
--    Un límite en NULL significa "sin tope". Así el plan a medida
--    no necesita un número inventado y grande, que es la forma
--    habitual de equivocarse aquí.
--
--    `max_almacenamiento_gb` se declara pero NO se impone: medir lo
--    que ocupa cada cliente en el almacén exige una convención de
--    rutas que hoy no existe. Sirve para la conversación comercial
--    y para que el día que haga falta, el dato ya esté donde va.
-- -------------------------------------------------------------
create table if not exists public.planes (
  id                    bigserial primary key,
  clave                 text    not null,
  nombre                text    not null,
  descripcion           text,
  precio_mensual        numeric(10,2),
  precio_anual          numeric(10,2),
  max_alumnos           int,
  max_cursos            int,
  max_facilitadores     int,
  max_almacenamiento_gb int,
  orden                 int     not null default 0,
  activo                boolean not null default true,
  creado_en             timestamptz not null default now()
);

create unique index if not exists planes_clave_idx on public.planes (lower(clave));

-- Precios de arranque, NO definitivos: edítalos desde tu panel
-- cuando cierres las primeras ventas y sepas qué aguanta el mercado.
-- El anual equivale a 10 meses (dos de regalo), que es la práctica
-- común y te adelanta el flujo de efectivo.
insert into public.planes
  (clave, nombre, descripcion, precio_mensual, precio_anual,
   max_alumnos, max_cursos, max_facilitadores, max_almacenamiento_gb, orden)
select * from (values
  ('semilla', 'Semilla',
   'Para una asociación pequeña o un despacho que arranca.',
   1500.00, 15000.00, 30, 5, 1, 5, 10),
  ('institucional', 'Institucional',
   'Para un colegio o institución con programa propio y varios docentes.',
   4500.00, 45000.00, 150, 25, 10, 25, 20),
  ('federacion', 'Federación',
   'Para una federación o universidad con varias sedes y generaciones.',
   9900.00, 99000.00, 600, 100, 40, 100, 30),
  ('medida', 'A medida',
   'Sin topes. Precio y condiciones negociados caso por caso.',
   null, null, null, null, null, null, 40)
) as nuevos(clave, nombre, descripcion, precio_mensual, precio_anual,
            max_alumnos, max_cursos, max_facilitadores, max_almacenamiento_gb, orden)
where not exists (
  select 1 from public.planes p where lower(p.clave) = lower(nuevos.clave)
);

-- -------------------------------------------------------------
-- 2) EL CONTRATO DE CADA ORGANIZACIÓN
--
--    `precio_acordado` existe porque vas a negociar: el plan dice
--    cuánto cuesta de lista, esta columna cuánto te paga ESTE
--    cliente. Sin ella acabarías creando un plan por cliente y el
--    catálogo dejaría de servir para vender.
--
--    Los `max_*` de aquí son excepciones puntuales: "te dejo 200
--    alumnos aunque tu plan diga 150". En NULL, manda el plan.
-- -------------------------------------------------------------
alter table public.organizaciones
  add column if not exists plan_id bigint
    references public.planes(id) on delete set null;

alter table public.organizaciones
  add column if not exists estado_suscripcion text not null default 'prueba';
alter table public.organizaciones
  add column if not exists periodo text not null default 'mensual';
alter table public.organizaciones
  add column if not exists precio_acordado numeric(10,2);
alter table public.organizaciones
  add column if not exists vence_en date;
alter table public.organizaciones
  add column if not exists max_alumnos int;
alter table public.organizaciones
  add column if not exists max_cursos int;
alter table public.organizaciones
  add column if not exists max_facilitadores int;
alter table public.organizaciones
  add column if not exists exenta_de_limites boolean not null default false;
alter table public.organizaciones
  add column if not exists notas_comerciales text;

-- Los estados son cuatro y los decides tú. Lo de "vencida" no se
-- guarda: se deduce de `vence_en` al leer, para no depender de una
-- tarea programada que un día no corra y te deje cobrando de menos.
alter table public.organizaciones
  drop constraint if exists organizaciones_estado_check;
alter table public.organizaciones
  add constraint organizaciones_estado_check
  check (estado_suscripcion in ('prueba', 'activa', 'suspendida', 'cancelada'));

alter table public.organizaciones
  drop constraint if exists organizaciones_periodo_check;
alter table public.organizaciones
  add constraint organizaciones_periodo_check
  check (periodo in ('mensual', 'anual'));

-- Tu propia aula no se cobra ni se limita a sí misma.
update public.organizaciones
   set exenta_de_limites = true,
       estado_suscripcion = 'activa'
 where slug = 'cotonieto';

-- -------------------------------------------------------------
-- 3) EL LIBRO DE PAGOS
--
--    Se llama `pagos_suscripcion` y no `pagos` a propósito: el día
--    que cobres cursos a alumnos sueltos harán falta las dos cosas,
--    y un nombre genérico garantiza confundirlas.
-- -------------------------------------------------------------
create table if not exists public.pagos_suscripcion (
  id              bigserial primary key,
  organizacion_id bigint  not null references public.organizaciones(id) on delete cascade,
  monto           numeric(10,2) not null,
  moneda          text    not null default 'MXN',
  pagado_en       date    not null default current_date,
  periodo_desde   date,
  periodo_hasta   date,
  metodo          text,
  referencia      text,
  nota            text,
  registrado_por  text,
  creado_en       timestamptz not null default now()
);

create index if not exists pagos_suscripcion_org_idx
  on public.pagos_suscripcion (organizacion_id, pagado_en desc);

-- -------------------------------------------------------------
-- 4) QUÉ TOPES LE APLICAN A UNA ORGANIZACIÓN
--
--    Excepción de la organización -> plan -> sin tope. Devuelve una
--    sola fila para que quien pregunte no tenga que repetir la
--    cascada de `coalesce` y arriesgarse a escribirla distinta.
-- -------------------------------------------------------------
create or replace function public.limites_organizacion(p_org bigint)
returns table (max_alumnos int, max_facilitadores int, max_cursos int, exenta boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(o.max_alumnos,       p.max_alumnos),
    coalesce(o.max_facilitadores, p.max_facilitadores),
    coalesce(o.max_cursos,        p.max_cursos),
    o.exenta_de_limites or o.plan_id is null
  from public.organizaciones o
  left join public.planes p on p.id = o.plan_id
  where o.id = p_org
$$;

revoke all on function public.limites_organizacion(bigint) from public;
grant execute on function public.limites_organizacion(bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 5) CUÁNTO CONSUME CADA UNA
--
--    Una sola llamada devuelve el consumo de todas las que
--    administras: el panel necesita la tabla completa y pedirla
--    organización por organización sería una consulta por fila.
--
--    Es `security definer` para poder contar por encima de las
--    políticas de lectura, y por eso filtra por `es_admin_de` aquí
--    dentro. Sin ese filtro, cualquiera vería el tamaño de tu
--    cartera de clientes, que es información de tu negocio.
--
--    Los alumnos se cuentan como PERSONAS, no como inscripciones:
--    quien está en tres cursos del mismo cliente es uno. Cobrar
--    tres veces por la misma persona haría que el cliente evitara
--    inscribirla, que es lo contrario de lo que quieres.
-- -------------------------------------------------------------
create or replace function public.consumo_organizaciones()
returns table (organizacion_id bigint, alumnos int, cursos int, facilitadores int)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    (select count(distinct ac.usuario_id)::int
       from public.acceso ac
       join public.cursos c on c.id = ac.curso_id
      where c.organizacion_id = o.id),
    (select count(*)::int
       from public.cursos c
      where c.organizacion_id = o.id),
    (select count(distinct lower(f.email))::int
       from public.facilitadores f
      where exists (select 1 from public.cursos c
                     where c.id = f.curso_id and c.organizacion_id = o.id)
         or exists (select 1 from public.categorias k
                     where k.id = f.categoria_id and k.organizacion_id = o.id))
  from public.organizaciones o
  where public.es_admin_de(o.id)
$$;

revoke all on function public.consumo_organizaciones() from public;
grant execute on function public.consumo_organizaciones() to authenticated;

-- -------------------------------------------------------------
-- 6) LOS TOPES, IMPUESTOS EN LA BASE
--
--    Van como disparadores y no como políticas RLS por dos razones.
--    Una: la política de alta de `acceso` se creó hace tiempo y
--    fuera de estos scripts; reemplazarla a ciegas es la mejor
--    forma de romper las inscripciones. Dos: un disparador vale
--    para cualquier camino de escritura, incluida una carga masiva
--    hecha desde el editor SQL.
--
--    Un aviso honesto: dos altas EXACTAMENTE simultáneas podrían
--    colarse las dos sobre el último hueco. Con un puñado de
--    clientes inscribiendo a mano eso no va a pasar, y la cerradura
--    que lo evitaría (bloquear la fila del cliente en cada alta)
--    cuesta más de lo que protege.
-- -------------------------------------------------------------
create or replace function public.verificar_limite_alumnos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    bigint;
  v_max    int;
  v_exenta boolean;
  v_actual int;
begin
  select c.organizacion_id into v_org
    from public.cursos c where c.id = new.curso_id;
  if v_org is null then return new; end if;

  select l.max_alumnos, l.exenta into v_max, v_exenta
    from public.limites_organizacion(v_org) l;
  if v_exenta or v_max is null then return new; end if;

  -- Si ya es alumno de esta organización en otro curso, no suma:
  -- el tope cuenta personas.
  if exists (
    select 1 from public.acceso ac
    join public.cursos c on c.id = ac.curso_id
    where c.organizacion_id = v_org and ac.usuario_id = new.usuario_id
  ) then return new; end if;

  select count(distinct ac.usuario_id) into v_actual
    from public.acceso ac
    join public.cursos c on c.id = ac.curso_id
   where c.organizacion_id = v_org;

  if v_actual >= v_max then
    raise exception
      'Esta organización llegó a su tope de % alumnos. Amplía el plan para inscribir a más personas.',
      v_max using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists acceso_limite_alumnos on public.acceso;
create trigger acceso_limite_alumnos
  before insert on public.acceso
  for each row execute function public.verificar_limite_alumnos();

create or replace function public.verificar_limite_cursos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max    int;
  v_exenta boolean;
  v_actual int;
begin
  if new.organizacion_id is null then return new; end if;

  select l.max_cursos, l.exenta into v_max, v_exenta
    from public.limites_organizacion(new.organizacion_id) l;
  if v_exenta or v_max is null then return new; end if;

  select count(*) into v_actual
    from public.cursos where organizacion_id = new.organizacion_id;

  if v_actual >= v_max then
    raise exception
      'Esta organización llegó a su tope de % cursos. Amplía el plan para crear más.',
      v_max using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists cursos_limite on public.cursos;
create trigger cursos_limite
  before insert on public.cursos
  for each row execute function public.verificar_limite_cursos();

create or replace function public.verificar_limite_facilitadores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    bigint;
  v_max    int;
  v_exenta boolean;
  v_actual int;
begin
  -- La fila es de un curso O de una categoría, nunca de las dos
  -- (lo impone facilitadores_destino_check).
  if new.curso_id is not null then
    select c.organizacion_id into v_org from public.cursos c where c.id = new.curso_id;
  else
    select k.organizacion_id into v_org from public.categorias k where k.id = new.categoria_id;
  end if;
  if v_org is null then return new; end if;

  select l.max_facilitadores, l.exenta into v_max, v_exenta
    from public.limites_organizacion(v_org) l;
  if v_exenta or v_max is null then return new; end if;

  -- Mismo criterio que con los alumnos: cuentan personas. Quien ya
  -- facilita un curso del cliente no vuelve a contar al asignarle
  -- otro.
  if exists (
    select 1 from public.facilitadores f
    where lower(f.email) = lower(new.email)
      and (exists (select 1 from public.cursos c
                    where c.id = f.curso_id and c.organizacion_id = v_org)
        or exists (select 1 from public.categorias k
                    where k.id = f.categoria_id and k.organizacion_id = v_org))
  ) then return new; end if;

  select count(distinct lower(f.email)) into v_actual
    from public.facilitadores f
   where exists (select 1 from public.cursos c
                  where c.id = f.curso_id and c.organizacion_id = v_org)
      or exists (select 1 from public.categorias k
                  where k.id = f.categoria_id and k.organizacion_id = v_org);

  if v_actual >= v_max then
    raise exception
      'Esta organización llegó a su tope de % facilitadores. Amplía el plan para asignar más.',
      v_max using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists facilitadores_limite on public.facilitadores;
create trigger facilitadores_limite
  before insert on public.facilitadores
  for each row execute function public.verificar_limite_facilitadores();

-- -------------------------------------------------------------
-- 7) UN HUECO QUE HAY QUE CERRAR AHORA
--
--    `organizaciones_update` deja escribir a `es_admin_de(id)`, o
--    sea también al administrador del cliente. Eso estaba bien
--    cuando la fila solo guardaba el logo y los colores; con el
--    contrato dentro, significa que el cliente puede subirse el
--    tope de alumnos o moverse el vencimiento.
--
--    No se arregla con RLS: las políticas deciden por FILA, no por
--    columna, y la fila sí es suya. Va con un disparador, igual que
--    la protección de las calificaciones del foro.
--
--    `slug` y `dominio` entran en la lista por el mismo motivo: son
--    la dirección en la que vive su aula, y eso lo asignas tú.
-- -------------------------------------------------------------
create or replace function public.proteger_contrato_organizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_admin() then return new; end if;

  if new.plan_id            is distinct from old.plan_id
  or new.estado_suscripcion is distinct from old.estado_suscripcion
  or new.periodo            is distinct from old.periodo
  or new.precio_acordado    is distinct from old.precio_acordado
  or new.vence_en           is distinct from old.vence_en
  or new.max_alumnos        is distinct from old.max_alumnos
  or new.max_cursos         is distinct from old.max_cursos
  or new.max_facilitadores  is distinct from old.max_facilitadores
  or new.exenta_de_limites  is distinct from old.exenta_de_limites
  or new.notas_comerciales  is distinct from old.notas_comerciales
  or new.slug               is distinct from old.slug
  or new.dominio            is distinct from old.dominio
  or new.activa             is distinct from old.activa
  then
    raise exception
      'El plan y la dirección de la organización los administra la plataforma. Puedes editar tu nombre, tu logo, tus colores y tu correo de contacto.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists organizaciones_protege_contrato on public.organizaciones;
create trigger organizaciones_protege_contrato
  before update on public.organizaciones
  for each row execute function public.proteger_contrato_organizacion();

-- -------------------------------------------------------------
-- 8) REGISTRAR UN PAGO
--
--    Va en la base y no en el navegador por la misma razón que la
--    emisión de constancias: anotar el pago y correr el
--    vencimiento son UNA cosa. Si lo hiciera la pantalla en dos
--    pasos, un corte de red entre ambos deja un cliente que pagó y
--    aparece vencido, o al revés.
--
--    El periodo nuevo arranca en el vencimiento vigente, no en hoy:
--    quien paga con una semana de adelanto no regala esa semana.
--    Pero si venció hace meses, arranca hoy: tampoco le vas a
--    cobrar el tiempo en que no usó nada.
-- -------------------------------------------------------------
create or replace function public.registrar_pago(
  p_org        bigint,
  p_monto      numeric,
  p_meses      int,
  p_metodo     text default null,
  p_referencia text default null,
  p_nota       text default null)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desde date;
  v_hasta date;
begin
  if not public.es_admin() then
    raise exception 'Solo la plataforma registra pagos.' using errcode = '42501';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 36 then
    raise exception 'Los meses tienen que estar entre 1 y 36.' using errcode = 'check_violation';
  end if;
  if p_monto is null or p_monto < 0 then
    raise exception 'El monto no puede ser negativo.' using errcode = 'check_violation';
  end if;

  select greatest(coalesce(o.vence_en, current_date), current_date)
    into v_desde
    from public.organizaciones o
   where o.id = p_org
     for update;

  if not found then
    raise exception 'No existe esa organización.' using errcode = 'no_data_found';
  end if;

  v_hasta := (v_desde + (p_meses || ' months')::interval)::date;

  insert into public.pagos_suscripcion
    (organizacion_id, monto, pagado_en, periodo_desde, periodo_hasta,
     metodo, referencia, nota, registrado_por)
  values
    (p_org, p_monto, current_date, v_desde, v_hasta,
     nullif(trim(coalesce(p_metodo, '')), ''),
     nullif(trim(coalesce(p_referencia, '')), ''),
     nullif(trim(coalesce(p_nota, '')), ''),
     lower(auth.jwt() ->> 'email'));

  -- Cobrar reactiva. Un cliente suspendido que paga vuelve a estar
  -- activo sin que tengas que acordarte de cambiarle el estado.
  update public.organizaciones
     set vence_en = v_hasta,
         estado_suscripcion = 'activa'
   where id = p_org;

  return v_hasta;
end $$;

revoke all on function public.registrar_pago(bigint, numeric, int, text, text, text) from public;
grant execute on function public.registrar_pago(bigint, numeric, int, text, text, text) to authenticated;

-- -------------------------------------------------------------
-- 9) QUIÉN VE QUÉ
--
--    Planes: los lee cualquiera, incluso sin sesión. Son tu lista
--    de precios; esconderla no protege nada y te obliga a
--    mantenerla dos veces. Escribirlos, solo tú.
--
--    Pagos: el cliente ve los SUYOS -son sus recibos- y nadie más.
--    No hay política de alta: el único camino es registrar_pago().
-- -------------------------------------------------------------
alter table public.planes enable row level security;

drop policy if exists "planes_select" on public.planes;
create policy "planes_select" on public.planes
  for select to anon, authenticated using (true);

drop policy if exists "planes_insert" on public.planes;
create policy "planes_insert" on public.planes
  for insert to authenticated with check (public.es_admin());

drop policy if exists "planes_update" on public.planes;
create policy "planes_update" on public.planes
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "planes_delete" on public.planes;
create policy "planes_delete" on public.planes
  for delete to authenticated using (public.es_admin());

alter table public.pagos_suscripcion enable row level security;

drop policy if exists "pagos_select" on public.pagos_suscripcion;
create policy "pagos_select" on public.pagos_suscripcion
  for select to authenticated
  using (public.es_admin_de(organizacion_id));

-- Sin política de INSERT/UPDATE a propósito: una política de alta
-- aquí permitiría anotar un pago sin correr el vencimiento, que es
-- justo lo que registrar_pago() existe para evitar.
drop policy if exists "pagos_delete" on public.pagos_suscripcion;
create policy "pagos_delete" on public.pagos_suscripcion
  for delete to authenticated using (public.es_admin());

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 10) COMPROBACIÓN
-- -------------------------------------------------------------
select 'planes en catalogo' as que, count(*)::text as n from public.planes
union all
select 'organizaciones', count(*)::text from public.organizaciones
union all
select 'exentas de limites', count(*)::text
  from public.organizaciones where exenta_de_limites
union all
select 'sin plan asignado', count(*)::text
  from public.organizaciones where plan_id is null and not exenta_de_limites
union all
select 'disparadores de tope', count(*)::text
  from pg_trigger
 where tgname in ('acceso_limite_alumnos', 'cursos_limite',
                  'facilitadores_limite', 'organizaciones_protege_contrato')
union all
select 'pagos registrados', count(*)::text from public.pagos_suscripcion;

-- =============================================================
--  RESULTADO ESPERADO
--  · planes en catalogo   = 4
--  · organizaciones       = las que tengas (1 si solo esta la tuya)
--  · exentas de limites   = 1  (la tuya)
--  · sin plan asignado    = 0  mientras solo exista la tuya
--  · disparadores de tope = 4
--  · pagos registrados    = 0
--
--  NADA CAMBIA PARA TUS ALUMNOS. Tu organizacion queda exenta, asi
--  que sigues sin tope de nada.
--
--  LO QUE NO HACE, Y CONVIENE QUE SEPAS
--  1. No cobra. No hay pasarela: los pagos se anotan a mano, que es
--     lo que corresponde cuando facturas por transferencia a un
--     punado de instituciones. Integrar Stripe o Mercado Pago tiene
--     sentido cuando el alta sea autoservicio, no antes.
--  2. No factura. El CFDI lo sigues emitiendo donde lo emites hoy;
--     aqui se guarda la referencia para poder cruzarlo.
--  3. Vencer no cierra la puerta. Un cliente vencido aparece en
--     rojo en tu panel y ve el aviso en el suyo, pero sus alumnos
--     siguen entrando. Es deliberado: cortarle el acceso a 600
--     personas por una transferencia que tardo tres dias hace mas
--     dano a la relacion que el que evita. Si algun dia quieres el
--     corte duro, se hace; dimelo y te explico que implica.
--  4. No avisa por correo antes del vencimiento. Eso necesita el
--     SMTP que dejamos pendiente.
-- =============================================================
