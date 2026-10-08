-- =============================================================
--  UN USUARIO DE SOLO LECTURA PARA REVISAR LA ESTRUCTURA
--
--  PARA QUÉ
--  Los errores de SQL que te han llegado a producción —una columna
--  varchar donde se declaró text, un nombre de columna que no
--  existe— son errores de ESTRUCTURA. Se previenen consultando qué
--  tablas y columnas hay y de qué tipo son, antes de escribir la
--  función.
--
--  LO QUE ESTE USUARIO **NO** PUEDE HACER
--  · No puede leer ni una fila de ninguna tabla tuya. No se le da
--    SELECT sobre nada. Ni alumnos, ni correos, ni calificaciones,
--    ni entregas, ni mensajes.
--  · No puede escribir, ni crear, ni borrar nada.
--  · No puede entrar al esquema `auth`, donde están las cuentas.
--
--  LO QUE SÍ PUEDE
--  Leer el catálogo de Postgres (`pg_catalog`), que es público para
--  cualquier usuario de cualquier base y solo contiene la FORMA de
--  la base: nombres de tablas, de columnas, tipos, funciones,
--  índices y políticas. Ningún contenido.
--
--  CÓMO USARLO
--  1. Cambia la contraseña de la línea marcada por una larga y al
--     azar. No reutilices ninguna tuya.
--  2. Supabase -> SQL Editor -> pega esto -> Run.
--  3. Pásame la cadena de conexión (más abajo dice cómo armarla).
--
--  CÓMO QUITARLO, EN CUALQUIER MOMENTO
--      drop role revision_estructura;
--  Una línea. Si se te olvida, al final de este archivo está otra
--  vez.
-- =============================================================

-- -------------------------------------------------------------
-- 1) EL USUARIO
--
--    `nologin` primero y `login` después no hace falta: se crea ya
--    con permiso de entrar, pero sin poder ver nada. El orden
--    importa poco porque no se le concede ningún privilegio.
-- -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'revision_estructura') then
    -- <<< CAMBIA ESTA CONTRASEÑA POR UNA LARGA Y AL AZAR
    create role revision_estructura login password 'PON-AQUI-UNA-CONTRASENA-LARGA';
  end if;
end $$;

-- -------------------------------------------------------------
-- 2) QUITARLE TODO LO QUE PUDIERA HEREDAR
--
--    En Postgres, el rol `public` es un grupo al que pertenecen
--    todos. Si alguna vez se le concedió algo a `public`, este
--    usuario lo heredaría. Se le quita explícitamente.
-- -------------------------------------------------------------
revoke all on schema public from revision_estructura;
revoke all on all tables in schema public from revision_estructura;
revoke all on all sequences in schema public from revision_estructura;
revoke all on all functions in schema public from revision_estructura;

-- Para poder NOMBRAR los objetos hace falta ver el esquema. Esto no
-- da acceso a su contenido: sin SELECT sobre las tablas, `usage`
-- solo permite saber que existen.
grant usage on schema public to revision_estructura;

-- El esquema de las cuentas queda fuera, explícitamente.
revoke all on schema auth from revision_estructura;
revoke all on all tables in schema auth from revision_estructura;

-- Y que no herede nada de lo que se cree en el futuro.
alter default privileges in schema public
  revoke all on tables from revision_estructura;

-- -------------------------------------------------------------
-- 3) DOS CERROJOS MÁS
--
--    Por si alguna vez se le concede algo por error: aunque
--    tuviera permiso, no podría escribir, y ninguna consulta suya
--    puede dejar la base ocupada más de quince segundos.
-- -------------------------------------------------------------
alter role revision_estructura set default_transaction_read_only = on;
alter role revision_estructura set statement_timeout = '15s';

-- -------------------------------------------------------------
-- 4) COMPROBACIÓN
-- -------------------------------------------------------------
select 'el usuario existe' as que,
  (select count(*)::text from pg_roles where rolname = 'revision_estructura') as valor
union all
select 'tablas que puede leer (debe ser 0)',
  (select count(*)::text
     from information_schema.table_privileges
    where grantee = 'revision_estructura' and privilege_type = 'SELECT')
union all
select 'puede escribir en algo (debe ser 0)',
  (select count(*)::text
     from information_schema.table_privileges
    where grantee = 'revision_estructura'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
union all
select 'es superusuario (debe ser false)',
  (select rolsuper::text from pg_roles where rolname = 'revision_estructura')
union all
select 'puede crear bases o roles (debe ser false, false)',
  (select rolcreatedb::text || ', ' || rolcreaterole::text
     from pg_roles where rolname = 'revision_estructura');

-- =============================================================
--  RESULTADO ESPERADO
--  · el usuario existe                  = 1
--  · tablas que puede leer              = 0
--  · puede escribir en algo             = 0
--  · es superusuario                    = false
--  · puede crear bases o roles          = false, false
--
--  SI "tablas que puede leer" NO ES 0, no me pases la contraseña y
--  avisame: significa que heredo algo que no deberia.
--
--  LA CADENA DE CONEXION
--  Supabase -> Settings -> Database -> Connection string -> URI.
--  Sale algo como:
--
--    postgresql://postgres.<ref>:[TU-PASSWORD]@aws-0-...:5432/postgres
--
--  Cambia DOS cosas antes de pasarmela:
--    · `postgres.<ref>`  ->  `revision_estructura`
--    · `[TU-PASSWORD]`   ->  la contraseña que pusiste arriba
--
--  NUNCA me pases la cadena del usuario `postgres`, ni la clave de
--  servicio (`service_role`): esas pueden todo.
--
--  PARA QUITARLO
--      drop role revision_estructura;
--
--  Hazlo en cuanto deje de hacer falta. Un acceso que ya no se usa
--  es solo una puerta abierta.
-- =============================================================
