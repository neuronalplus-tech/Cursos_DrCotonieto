-- =============================================================
--  DIAGNÓSTICO: ¿POR QUÉ NO PUEDE ENTRAR ESTA PERSONA?
--
--  PARA QUÉ SIRVE
--  Cuando alguien dice "la contraseña es la correcta y no me deja",
--  casi nunca es la contraseña. Esta consulta mira el estado real
--  de la cuenta en `auth.users` y te dice qué le pasa.
--
--  LAS CAUSAS, POR FRECUENCIA
--  1. La cuenta existe pero SIN CONFIRMAR. Si el proyecto exige
--     confirmación de correo, iniciar sesión falla aunque la
--     contraseña sea correcta.
--  2. El correo quedó guardado con una mayúscula o un espacio, así
--     que la dirección que se teclea no es la misma que se guardó.
--  3. Hay DOS cuentas con correos casi iguales y se está probando
--     la contraseña de una en la otra.
--  4. La contraseña, de verdad, no es esa.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Sale el estado de las 30 cuentas más recientes, que son las que
--  suelen dar problema.
--
--  Solo lee. No modifica nada. Y no enseña contraseñas: están
--  guardadas cifradas con un algoritmo que no se puede revertir,
--  así que no existe ninguna consulta que las muestre.
-- =============================================================

select
  u.email,

  case
    when u.email <> lower(u.email) then '⚠️ TIENE MAYÚSCULAS'
    when u.email <> trim(u.email)  then '⚠️ TIENE ESPACIOS'
    else 'ok'
  end as el_correo,

  case
    when u.email_confirmed_at is not null then 'confirmada'
    when u.confirmation_sent_at is not null then '⚠️ SIN CONFIRMAR (se le envió correo)'
    else '⚠️ SIN CONFIRMAR'
  end as la_cuenta,

  case
    when u.encrypted_password is null or u.encrypted_password = ''
      then '⚠️ NO TIENE CONTRASEÑA'
    else 'tiene contraseña'
  end as la_clave,

  case
    when u.banned_until is not null and u.banned_until > now()
      then '⚠️ BLOQUEADA hasta ' || u.banned_until::date
    else 'ok'
  end as el_estado,

  u.last_sign_in_at as ultimo_ingreso,
  u.created_at      as creada_el

from auth.users u
order by u.created_at desc
limit 30;

-- =============================================================
--  CÓMO LEERLO
--
--  · "SIN CONFIRMAR" es la causa mas comun y NO depende de la
--    contraseña. Se arregla de dos formas:
--
--      a) Apagando la exigencia de confirmacion, si no la quieres:
--         Supabase -> Authentication -> Sign In / Providers ->
--         Email -> "Confirm email" en OFF.
--
--      b) O confirmando esa cuenta a mano. En el panel:
--         Authentication -> Users -> abre la persona -> hay una
--         opcion para confirmar su correo.
--
--  · "TIENE MAYUSCULAS" o "TIENE ESPACIOS" significa que la cuenta
--    se creo con una direccion que no coincide con la que se teclea
--    al entrar (el formulario de acceso siempre envia en minusculas
--    y sin espacios). Lo mas limpio es borrar esa cuenta y volver a
--    crearla; el alta ya normaliza, asi que no volvera a pasar.
--
--  · "NO TIENE CONTRASEÑA" pasa cuando la cuenta se creo por
--    invitacion y la persona nunca eligio una. Mandale el enlace
--    con el boton 🔑 de Gestion de usuarios.
--
--  · Si todo sale "ok" y "confirmada", y aun asi no entra, entonces
--    si es la contraseña: mandale el enlace con el boton 🔑 y que
--    elija una nueva.
--
--  PARA BUSCAR A UNA PERSONA EN CONCRETO
--  Cambia el final por:
--      where u.email ilike '%prueba%'
--      order by u.created_at desc;
--  (quitando el limit)
-- =============================================================
