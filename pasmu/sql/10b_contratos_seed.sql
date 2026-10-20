-- Parte 2/3: contratos v1 por dominio. Sin PII/clínico/SQL en payloads.
begin;
insert into public.configuracion_contratos (dominio, version, esquema) values
  ('service_flow', 1, '{"permitidos": ["estados", "transiciones", "etiquetas"], "limite_estados": 20}'),
  ('catalogs', 1, '{"permitidos": ["termino", "definicion", "sinonimos"], "limite_terminos": 200}'),
  ('indicator_definitions', 1, '{"permitidos": ["codigo", "nombre", "unidad_medida", "meta", "periodo"], "periodo": "YYYY-MM"}'),
  ('public_content', 1, '{"permitidos": ["titulo", "cuerpo", "enlace_interno"], "prohibidos": ["script", "url_externa"]}'),
  ('institutional_scope', 1, '{"permitidos": ["unidad_codigo", "programa_codigo", "alcance"]}')
on conflict (dominio) do update set
  version = excluded.version,
  esquema = excluded.esquema,
  actualizado_en = now();
insert into public.configuracion_contratos (dominio, version, esquema) values
  ('roles_permissions', 1, '{"nota": "requiere aprobar_alto_riesgo; sin autoasignacion"}'),
  ('clinical_protocols', 1, '{"nota": "requiere responsable clinico; sin diagnostico automatico"}'),
  ('privacy_retention', 1, '{"nota": "requiere privacidad/juridico; sin reduccion sin fundamento"}'),
  ('security_platform', 1, '{"nota": "requiere tecnologia/seguridad; prohibido desactivar RLS"}')
on conflict (dominio) do update set
  version = excluded.version,
  esquema = excluded.esquema,
  actualizado_en = now();
commit;
