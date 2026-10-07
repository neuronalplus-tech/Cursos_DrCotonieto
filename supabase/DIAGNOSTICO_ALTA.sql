-- =============================================================
--  DIAGNÓSTICO: ¿POR QUÉ NO SE ESTÁ CREANDO LA CUENTA?
--
--  EL SÍNTOMA
--  Das de alta a alguien, el panel no se queja, y esa persona no
--  aparece en `auth.users`. La cuenta no existe, así que al entrar
--  falla con "credenciales incorrectas", que es literalmente cierto.
--
--  LA SOSPECHA PRINCIPAL
--  El alta la hace una función del servidor (`crear-usuario`), que
--  antes de crear nada comprueba que quien la llama sea
--  administrador mirando la tabla `admins`.
--
--  El multi-inquilino cambió esa tabla: ahora una persona puede
--  tener VARIAS filas en `admins` —una sin organización, que es el
--  administrador de la plataforma, y una por cada cliente que
--  administre—. El código del navegador ya se adaptó a eso. Si la
--  función del servidor todavía espera UNA sola fila, desde ese
--  cambio estaría fallando en cada alta.
--
--  Esta consulta no arregla nada: dice si esa sospecha encaja.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Solo lee.
-- =============================================================

select 'filas en admins con tu correo' as que,
       count(*)::text as valor,
       case when count(*) > 1
            then 'SOSPECHOSO: mas de una fila'
            else 'una sola' end as pista
from public.admins
where lower(email) = 'cotonietoe@gmail.com'

union all

select 'cuentas creadas en los ultimos 30 dias',
       count(*)::text,
       case when count(*) = 0
            then 'CONFIRMA: el alta lleva tiempo sin funcionar'
            else 'se han creado cuentas' end
from auth.users
where created_at > now() - interval '30 days'

union all

select 'fecha de la cuenta mas reciente',
       coalesce(max(created_at)::date::text, 'ninguna'),
       'compara con cuando empezo a fallar'
from auth.users

union all

-- Si el alta llegara a crear la cuenta pero fallara al inscribir,
-- la persona existiria sin acceso a nada. Descarta ese escenario.
select 'cuentas sin ningun curso',
       count(*)::text,
       case when count(*) > 0
            then 'hay cuentas creadas a medias'
            else 'ninguna a medias' end
from auth.users u
where not exists (select 1 from public.acceso a where a.usuario_id = u.id)

union all

-- El tope de alumnos que añadimos con las suscripciones corta las
-- inscripciones nuevas cuando una organizacion se llena. Tu
-- organizacion deberia estar exenta.
select 'tu organizacion esta exenta de topes',
       coalesce((select case when exenta_de_limites then 'si' else 'NO' end
                   from public.organizaciones where slug = 'cotonieto'), 'no existe'),
       'si dice NO, el tope puede estar bloqueando inscripciones'

union all

select 'disparadores que vigilan la tabla acceso',
       count(*)::text,
       'deberia ser 1 (el del tope de alumnos)'
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'acceso' and not t.tgisinternal;

-- =============================================================
--  CÓMO LEERLO
--
--  · "filas en admins" mayor que 1 -> es casi seguro la causa. La
--    funcion del servidor hay que ajustarla para aceptar varias
--    filas, igual que ya hicimos en el navegador.
--
--  · "cuentas creadas en los ultimos 30 dias" = 0 -> confirma que no
--    es cosa de hoy ni de un correo concreto: el alta lleva semanas
--    sin funcionar y no nos habiamos enterado.
--
--  · "cuentas sin ningun curso" mayor que 0 -> entonces las cuentas
--    SI se crean y lo que falla es la inscripcion. Es otro problema
--    distinto y se arregla en otro sitio.
--
--  · "tu organizacion esta exenta" = NO -> corre SUSCRIPCIONES.sql
--    otra vez; es idempotente y vuelve a marcarla.
--
--  LO QUE NO PUEDO VER DESDE AQUI
--  Las funciones del servidor (`crear-usuario`, `crear-usuarios-bulk`)
--  viven en Supabase y no estan en el repositorio, asi que no puedo
--  leer su codigo ni corregirlo a ciegas. Para verlas:
--  Supabase -> Edge Functions -> crear-usuario -> y ahi esta su
--  codigo y, en "Logs", el error real de cada intento.
--
--  ESE REGISTRO ES LA PRUEBA DEFINITIVA: entra a Logs justo despues
--  de intentar un alta y mandame lo que diga.
-- =============================================================
