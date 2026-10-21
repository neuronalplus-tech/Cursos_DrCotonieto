-- ============================================================
-- BOTONES CON PDF · almacén privado `botones_pdf`
-- ============================================================
-- Correr en Supabase SQL Editor. Es seguro repetirlo.
--
-- Los botones de rutas, módulos y talleres pueden llevar un PDF que
-- se lee dentro de la plataforma. El PDF vive en un bucket PRIVADO:
--   · Suben y borran: la administración y quien facilita cursos.
--   · Leen: cualquier persona con sesión iniciada.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('botones_pdf', 'botones_pdf', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 26214400, allowed_mime_types = array['application/pdf'];

drop policy if exists "botones_pdf_ver" on storage.objects;
create policy "botones_pdf_ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'botones_pdf');

drop policy if exists "botones_pdf_subir" on storage.objects;
create policy "botones_pdf_subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'botones_pdf' and (public.es_admin() or public.es_facilitador()));

drop policy if exists "botones_pdf_borrar" on storage.objects;
create policy "botones_pdf_borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'botones_pdf' and (public.es_admin() or public.es_facilitador()));

select 'politicas botones_pdf' as que, count(*)::text as valor
from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'botones_pdf%';
