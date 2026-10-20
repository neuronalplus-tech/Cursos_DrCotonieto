-- PASMU 18: expediente NOM-004 (parte 1: catálogos precargados + historia/plan).
-- Solo PRUEBAS. Sin datos reales. Mejoras NOM: folio único, consentimiento versionado,
-- addendum en vez de sobrescribir, aviso de riesgo con responsable humano (no automatiza crisis).
begin;
create table if not exists public.expediente_catalogos (
  clave text primary key, valores jsonb not null);
insert into public.expediente_catalogos (clave, valores) values
  ('modalidad', '["Presencial","Online"]'),
  ('plataforma', '["Zoom","Meet","Teams","Skype","Teléfono","Otra"]'),
  ('estado_caso', '["Activo","Inactivo","Alta","Derivado","Suspendido"]'),
  ('sintomas', '["Ansiedad","Depresión","Estrés","Pánico","Fobias","Obsesiones","Compulsiones","Trauma","Duelo","Ira","Insomnio","Apetito","Fatiga","Dolores","Digestivos"]'),
  ('areas_afectadas', '["Trabajo","Estudio","Familia","Pareja","Amigos","Sexual","Económica","Legal","Salud","Autoestima"]'),
  ('factores_riesgo', '["Aislamiento","Desempleo","Enfermedad física","Dolor crónico","Trauma reciente","Adicciones"]'),
  ('factoresprotectores', '["Apoyo familiar","Amigos","Estabilidad laboral","Recursos económicos","Motivación","Insight"]'),
  ('apariencia', '["Adecuada","Descuidada","Informal","Higiene deficiente","Postura encorvada","Evita contacto visual","Inquietud psicomotora"]'),
  ('actitud', '["Cooperadora","Reservada","Ansiosa","Hostil","Apática","Motivada","Colaborativa"]'),
  ('afecto', '["Congruente","Incongruente","Lábil","Aplanado","Irritable","Ansioso","Deprimido"]'),
  ('intervenciones', '["Psicoeducación","Reestructuración cognitiva","Respiración","Mindfulness","Exposición gradual","Activación conductual","Regulación emocional (DBT)","Defusión cognitiva (ACT)","Clarificación de valores (ACT)"]'),
  ('tareas', '["Autorregistro","Diario de gratitud","Planificación de actividades","Lectura psicoeducativa","Mindfulness","Monitoreo de emociones"]'),
  ('evolucion', '["Mejoría evidente","Mejoría parcial","Sin cambios","Empeoramiento","Cumple tareas","Resistencia","Adherencia irregular","Alto riesgo emocional","Bajo riesgo actual"]')
on conflict (clave) do update set valores = excluded.valores;
alter table public.expediente_catalogos enable row level security;
revoke all on table public.expediente_catalogos from public, anon, authenticated;
grant select (clave, valores) on table public.expediente_catalogos to authenticated;
drop policy if exists expediente_catalogos_read on public.expediente_catalogos;
create policy expediente_catalogos_read on public.expediente_catalogos for select to authenticated using (true);
commit;
