-- =============================================================
--  LOS ADJUNTOS DE LOS MENSAJES, PRIVADOS
--
--  QUE SE ENCONTRO
--  El bucket `chat_adjuntos` es PUBLICO. Un bucket publico sirve sus
--  archivos a cualquiera que tenga la direccion: sin sesion, sin
--  pasar por ninguna politica, sin dejar rastro.
--
--  Ahi van los archivos que se adjuntan en los mensajes privados
--  entre tu y tus alumnos. Las direcciones son dificiles de
--  adivinar, pero quedan guardadas en la base, en el historial del
--  navegador y en cualquier sitio donde se hayan pegado. Para
--  material clinico, eso no es lo que nadie entiende por "privado".
--
--  QUE HACE ESTE SCRIPT
--  Deja las politicas para que, con el bucket en privado, cada quien
--  pueda ver UNICAMENTE los adjuntos que envio o que recibio.
--
--  ORDEN IMPORTANTE
--    1. Correr este script.
--    2. Subir el codigo (git push) y esperar el despliegue.
--    3. SOLO ENTONCES, poner el bucket en privado:
--       Storage -> chat_adjuntos -> los tres puntos -> Make private.
--
--  Si se pone en privado antes de que el codigo nuevo este arriba,
--  los adjuntos dejan de verse hasta que termine el despliegue.
--  Nada se pierde, pero se ve roto un rato.
--
--  SOBRE LOS MENSAJES ANTIGUOS
--  No hay que migrar nada. Los de antes guardan la direccion publica
--  completa y los nuevos guardan la ruta; la aplicacion saca la ruta
--  de ambas formas y firma igual. Por eso la politica compara con
--  `like`, para que le valgan las dos.
-- =============================================================

-- -------------------------------------------------------------
-- 1) QUIEN PUEDE VER UN ADJUNTO
--
--    Dos casos, y solo dos: lo subiste tu, o te lo mandaron.
--
--    "Lo subiste tu" se sabe por la ruta: los archivos se guardan
--    como `<id de quien sube>/<momento>_<nombre>`, asi que la
--    primera carpeta es su dueño.
--
--    "Te lo mandaron" se comprueba contra la tabla `mensajes`. Es
--    una consulta dentro de una politica, que no es gratis, pero
--    esto se ejecuta al abrir un adjunto y no en cada mensaje de la
--    lista.
-- -------------------------------------------------------------
drop policy if exists "chat_adjuntos_ver" on storage.objects;
create policy "chat_adjuntos_ver" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat_adjuntos'
    and (
      -- Lo subí yo.
      (storage.foldername(name))[1] = auth.uid()::text
      -- O me lo mandaron. El `like` cubre los mensajes antiguos,
      -- que guardan la dirección completa y no solo la ruta.
      or exists (
        select 1 from public.mensajes m
        where m.para_id = auth.uid()
          and m.adjunto_url is not null
          and (m.adjunto_url = name or m.adjunto_url like '%' || name)
      )
    )
  );

-- -------------------------------------------------------------
-- 2) QUIEN PUEDE SUBIR
--
--    Cada quien a su propia carpeta. Sin esto, alguien podria subir
--    dentro de la carpeta de otra persona y colarle un archivo que
--    pareceria suyo.
-- -------------------------------------------------------------
drop policy if exists "chat_adjuntos_subir" on storage.objects;
create policy "chat_adjuntos_subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat_adjuntos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -------------------------------------------------------------
-- 3) QUIEN PUEDE BORRAR
--
--    Quien lo subió, y la administración de la plataforma. El
--    destinatario no: borrar el adjunto de una conversación ajena
--    no le corresponde.
-- -------------------------------------------------------------
drop policy if exists "chat_adjuntos_borrar" on storage.objects;
create policy "chat_adjuntos_borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat_adjuntos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.es_admin()
    )
  );

-- -------------------------------------------------------------
-- 4) COMPROBACION
-- -------------------------------------------------------------
select 'politicas del bucket chat_adjuntos' as que,
  (select count(*)::text from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'chat_adjuntos%') as valor
union all
select 'adjuntos guardados como direccion completa (los antiguos)',
  (select count(*)::text from public.mensajes
    where adjunto_url like 'http%')
union all
select 'adjuntos guardados como ruta (los nuevos)',
  (select count(*)::text from public.mensajes
    where adjunto_url is not null and adjunto_url not like 'http%');

-- =============================================================
--  RESULTADO ESPERADO
--  · politicas del bucket chat_adjuntos = 3
--  · direccion completa = los que ya tenias (es normal)
--  · ruta               = 0 por ahora; subira con los nuevos
--
--  SI DA ERROR DE PERMISOS al crear las politicas, hazlas desde el
--  panel: Storage -> Policies -> chat_adjuntos -> New policy. El
--  contenido de cada `using` es el mismo que esta aqui arriba.
--
--  ANTES DE PONER EL BUCKET EN PRIVADO, sube el codigo. Mientras el
--  codigo viejo este arriba, pide direcciones publicas y dejaria de
--  encontrarlas.
--
--  COMO SE COMPRUEBA QUE FUNCIONO
--  1. Manda un mensaje con un adjunto a un alumno de prueba.
--  2. Abrelo desde su cuenta: debe verse.
--  3. Copia la direccion del adjunto y abrela en una ventana de
--     incognito: NO debe verse. Si se ve, el bucket sigue publico.
-- =============================================================
