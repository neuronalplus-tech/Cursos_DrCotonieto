-- =============================================================
--  MULTI-INQUILINO · ETAPA 1 de 2 (los datos)
--
--  QUÉ RESUELVE
--  Hoy todo vive en una sola instalación con una sola tabla
--  `admins`. Si metieras a una organización aquí dentro, sus
--  cursos aparecerían en tu portada y los tuyos en la suya: no hay
--  separación entre clientes porque nunca hizo falta.
--
--  QUÉ HACE ESTA ETAPA
--  Crea las organizaciones, cuelga de ellas el catálogo y amplía
--  las funciones de permiso. NO cambia ninguna pantalla: al
--  terminar, tu aula funciona exactamente igual que ahora, con
--  todo tu contenido dentro de una organización llamada como tú.
--
--  POR QUÉ SE CUELGA DE `cursos` Y NO DE CADA TABLA
--  Módulos, recursos, exámenes, tareas, foro y generaciones ya
--  cuelgan de un curso. Repetir `organizacion_id` en todas sería
--  un dato duplicado que puede contradecirse: bastaría un UPDATE
--  descuidado para tener un módulo de una organización dentro de
--  un curso de otra. Se guarda una vez, en la raíz.
--
--  CÓMO USARLO
--  Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente. Requiere ROLES_2, ROLES_3 y CATEGORIAS.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LAS ORGANIZACIONES
--
--    `slug` es lo que identifica a cada una en su dirección web
--    (fmp.tuaula.com, o /o/fmp). `dominio` permite además darle
--    su propio dominio cuando lo pidan.
--
--    La marca vive aquí para que la etapa 2 solo tenga que leerla:
--    cambiar el logo de un cliente no debe ser un despliegue.
-- -------------------------------------------------------------
create table if not exists public.organizaciones (
  id             bigserial primary key,
  slug           text not null,
  nombre         text not null,
  dominio        text,
  logo_url       text,
  color_primario text,
  color_acento   text,
  contacto_email text,
  activa         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create unique index if not exists organizaciones_slug_idx
  on public.organizaciones (lower(slug));
create unique index if not exists organizaciones_dominio_idx
  on public.organizaciones (lower(dominio)) where dominio is not null;

-- -------------------------------------------------------------
-- 2) LA TUYA, CON TODO LO QUE YA EXISTE
--
--    Se crea primero para poder asignarle el contenido actual. El
--    id 1 no se fuerza: se busca por slug, que es estable.
-- -------------------------------------------------------------
insert into public.organizaciones (slug, nombre, contacto_email)
values ('cotonieto', 'Dr. Ernesto Cotonieto', 'cotonietoe@gmail.com')
on conflict do nothing;

-- -------------------------------------------------------------
-- 3) EL CATÁLOGO CUELGA DE UNA ORGANIZACIÓN
-- -------------------------------------------------------------
alter table public.cursos
  add column if not exists organizacion_id bigint
  references public.organizaciones(id) on delete restrict;

alter table public.categorias
  add column if not exists organizacion_id bigint
  references public.organizaciones(id) on delete restrict;

create index if not exists cursos_org_idx on public.cursos (organizacion_id);
create index if not exists categorias_org_idx on public.categorias (organizacion_id);

-- Todo lo que existe hoy es tuyo.
do $$
declare v_org bigint;
begin
  select id into v_org from public.organizaciones where slug = 'cotonieto';
  update public.cursos     set organizacion_id = v_org where organizacion_id is null;
  update public.categorias set organizacion_id = v_org where organizacion_id is null;
end $$;

-- -------------------------------------------------------------
-- 4) LOS ADMINISTRADORES, POR ORGANIZACIÓN
--
--    `admins` pasa a tener dueño. Una fila SIN organizacion_id es
--    un administrador de la plataforma entera: tú. Con ella, es
--    el administrador de ese cliente y no ve nada de los demás.
--
--    Se deja nullable a propósito: no hay forma de expresar "de
--    todas" con una clave foránea, y añadir una columna booleana
--    aparte daría dos maneras de decir lo mismo.
-- -------------------------------------------------------------
alter table public.admins
  add column if not exists organizacion_id bigint
  references public.organizaciones(id) on delete cascade;

-- Lo mismo para quien facilita: su alcance ya es por curso o
-- categoría, y ambos pertenecen a una organización. No hace falta
-- tocar `facilitadores`.

-- -------------------------------------------------------------
-- 5) LAS FUNCIONES DE PERMISO
--
--    `es_admin()` se queda como estaba —administrador de la
--    plataforma— para no romper las decenas de políticas que ya la
--    usan. Se añade la pregunta nueva al lado.
-- -------------------------------------------------------------

-- ¿Soy administrador de la plataforma? (fila sin organización)
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
      and a.organizacion_id is null
  )
$$;

-- ¿Administro ESTA organización? El de plataforma, todas.
create or replace function public.es_admin_de(p_org bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin() or exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
      and a.organizacion_id = p_org
  )
$$;

revoke all on function public.es_admin_de(bigint) from public;
grant execute on function public.es_admin_de(bigint) to authenticated, service_role;

-- Gestionar un curso: el admin de su organización, o quien lo
-- facilite (por curso o por categoría, como ya estaba).
create or replace function public.puede_gestionar_curso(p_curso bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.es_admin_de((select c.organizacion_id from public.cursos c where c.id = p_curso))
    or exists (
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

-- -------------------------------------------------------------
-- 6) QUIÉN VE LAS ORGANIZACIONES
--
--    Leerlas: cualquiera, también sin sesión. La portada necesita
--    la marca (nombre, logo, colores) antes de que nadie entre.
--    No hay nada sensible ahí: es lo que el cliente enseña.
--
--    Escribirlas: solo tú. Dar de alta un cliente es cosa de la
--    plataforma, no del cliente.
-- -------------------------------------------------------------
alter table public.organizaciones enable row level security;

drop policy if exists "organizaciones_select" on public.organizaciones;
create policy "organizaciones_select" on public.organizaciones
  for select to anon, authenticated using (true);

drop policy if exists "organizaciones_insert" on public.organizaciones;
create policy "organizaciones_insert" on public.organizaciones
  for insert to authenticated with check (public.es_admin());

drop policy if exists "organizaciones_update" on public.organizaciones;
create policy "organizaciones_update" on public.organizaciones
  for update to authenticated
  using (public.es_admin_de(id)) with check (public.es_admin_de(id));

drop policy if exists "organizaciones_delete" on public.organizaciones;
create policy "organizaciones_delete" on public.organizaciones
  for delete to authenticated using (public.es_admin());

-- -------------------------------------------------------------
-- 7) CREAR CURSOS: EL ADMIN DE SU ORGANIZACIÓN
-- -------------------------------------------------------------
drop policy if exists "cursos_insert_admin" on public.cursos;
create policy "cursos_insert_admin" on public.cursos
  for insert to authenticated
  with check (public.es_admin_de(organizacion_id));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 8) COMPROBACIÓN
-- -------------------------------------------------------------
select 'organizaciones' as que, count(*)::text as n from public.organizaciones
union all
select 'cursos sin organizacion', count(*)::text from public.cursos where organizacion_id is null
union all
select 'categorias sin organizacion', count(*)::text from public.categorias where organizacion_id is null
union all
select 'admins de plataforma', count(*)::text from public.admins where organizacion_id is null;

-- =============================================================
--  RESULTADO ESPERADO
--  · organizaciones = 1
--  · cursos sin organizacion = 0
--  · categorias sin organizacion = 0
--  · admins de plataforma = los que ya tenias (tu correo)
--
--  TU AULA SIGUE IGUAL. Esta etapa no cambia ninguna pantalla:
--  todo tu contenido quedo dentro de tu organizacion y las
--  funciones de permiso responden lo mismo que antes.
--
--  LO QUE FALTA (etapa 2)
--  Que la aplicacion sepa en que organizacion esta (por dominio o
--  subdominio), filtre el catalogo por ella y pinte su marca.
--
--  UN LIMITE QUE CONVIENE SABER
--  El catalogo publico seguira siendo legible por cualquiera que
--  consulte la API directamente: son titulos y descripciones de
--  venta, lo mismo que hay en la portada. Si algun cliente exige
--  que ni eso se vea desde fuera, hace falta resolver la
--  organizacion en el servidor y no en el navegador. Dilo y lo
--  vemos; no esta incluido aqui.
-- =============================================================
