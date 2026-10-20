-- PASMU 22: catálogos NOM-004 completos + RPC de guardado real de nota SOAP.
-- Solo PRUEBAS. Idempotente. Requiere 18a (expediente_catalogos), 18b (notas_soap),
-- 20b y los helpers private.pasmu_case_has_permission / private.pasmu_is_case_professional.
begin;

-- 1) Catálogos completos (características precargadas del template institucional).
insert into public.expediente_catalogos (clave, valores) values
  ('modalidad', '["Presencial","Online"]'),
  ('plataforma', '["Zoom","Meet","Teams","Skype","Teléfono","Otra"]'),
  ('estado_caso', '["Activo","Inactivo","Alta","Derivado","Suspendido"]'),
  ('sintomas', '["Ansiedad","Depresión","Estrés","Pánico","Fobias","Obsesiones","Compulsiones","Trauma","Duelo","Ira","Insomnio","Apetito","Fatiga","Dolores","Digestivos"]'),
  ('areas_afectadas', '["Trabajo","Estudio","Familia","Pareja","Amigos","Sexual","Económica","Legal","Salud","Autoestima"]'),
  ('factores_desencadenantes', '["Laboral","Familiar","Económico","Salud","Pareja","Duelo","Trauma","Acoso","Cambio vida","Sin claro"]'),
  ('factores_riesgo', '["Aislamiento","Desempleo","Enfermedad física","Dolor crónico","Trauma reciente","Adicciones"]'),
  ('factoresprotectores', '["Apoyo familiar","Amigos","Estabilidad laboral","Recursos económicos","Motivación","Insight"]'),
  ('documentos_legales', '["Consentimiento Informado General","Consentimiento Terapia Online","Autorización Contacto Emergencias","Autorización Intercambio Información","Hoja de Privacidad","Reglas del Terapeuta"]'),
  ('apariencia', '["Adecuada","Descuidada","Informal","Higiene deficiente","Vestimenta llamativa","Demasiado arreglada","Sudoración visible","Ojeras marcadas","Postura encorvada","Evidencia de cansancio","Mirada apagada","Evita contacto visual","Expresiva/gesticuladora","Movimientos nerviosos","Inquietud psicomotora","Rigidez corporal","Sonrisa forzada","Vestimenta inapropiada al clima","Aspecto desaliñado","Exceso de maquillaje/peinado","Lloroso","Fatigado","Agitado","Lenguaje corporal defensivo","Movimiento repetitivo","Rigidez postural","Tics visibles","Expresividad reducida","Piel pálida","Rubor facial","Otro"]'),
  ('actitud', '["Cooperadora","Reservada","Ansiosa","Hostil","Apática","Desafiante","Evitativa","Motivada","Desorganizada","Insegura","Retraída","Evasiva","Dependiente","Colaborativa","Confiada","Desconfiada","Entusiasta","Defensiva","Escéptica","Impulsiva","Seductora","Desmotivada","Irónica","Proactiva","Crítica","Persuasiva","Cerrada","Abierta","Introvertida","Extrovertida","Otro"]'),
  ('afecto', '["Congruente","Incongruente","Lábil","Aplanado","Irritable","Alegre","Ansioso","Deprimido","Fluctuante","Restringido","Inadecuado","Amortiguado","Eufórico","Tenso","Preocupado","Distante","Ambivalente","Expansivo","Nervioso","Vulnerable","Melancólico","Indiferente","Culpógeno","Sosegado","Entusiasta","Apesadumbrado","Inquieto","Otro"]'),
  ('evolucion', '["Mejoría clínica evidente","Mejoría parcial","Sin cambios significativos","Empeoramiento","Cumple tareas asignadas","Presenta resistencia","Incrementa insight","Dificultad para autorregularse","Síntomas fluctuantes","Adherencia irregular","Alto riesgo emocional","Bajo riesgo actual","Cumple con psicoeducación","Relata crisis recientes","Identifica patrones desadaptativos","Reconoce valores personales","Mayor conciencia corporal","Aumenta motivación","Presenta recaídas","Desarrolla habilidades de afrontamiento","Expresa esperanza","Dificultad con tareas cognitivas","Mayor apertura a terapia","Mejora en calidad de sueño","Uso de habilidades DBT/ACT","Regulación afectiva","Reconocimiento de fortalezas","Capacidad de planificación","Otro"]'),
  ('intervenciones', '["Psicoeducación","Reestructuración cognitiva","Identificación de distorsiones","Resolución de problemas","Entrenamiento en respiración","Técnicas de relajación","Técnicas de mindfulness","Exposición gradual","Prevención de recaídas","Activación conductual","Entrenamiento en habilidades sociales","Role playing","Regulación emocional (DBT)","Tolerancia al malestar (DBT)","Efectividad interpersonal (DBT)","Atención plena (DBT)","Defusión cognitiva (ACT)","Clarificación de valores (ACT)","Compromiso con la acción (ACT)","Aceptación (ACT)","Diario de gratitud (Psicología Positiva)","Identificación de fortalezas","Técnicas de perdón","Ejercicios de compasión","Técnicas de autoaceptación","Visualización positiva","Análisis funcional de conducta","Prevención de conductas autolesivas","Reforzamiento positivo","Ensayo conductual","Regulación atencional","Trabajo con metáforas (ACT)","Anclaje en el presente","Ejercicios de amabilidad","Técnicas de exposición interoceptiva","Construcción de plan de seguridad","Intervención centrada en valores","Técnica de autoobservación","Entrenamiento en resiliencia","Intervenciones narrativas","Intervenciones de psicología positiva avanzada","Técnicas de gratificación retardada","Prácticas de autocuidado guiadas","Otro"]'),
  ('tareas', '["Autorregistro (pensamientos/emociones)","Diario de gratitud","Planificación de actividades","Práctica de fortalezas personales","Ejercicios de autoaceptación","Práctica de compasión","Ejercicios de afrontamiento","Exposición en vivo","Lectura psicoeducativa","Técnica de relajación diaria","Practicar habilidades DBT","Práctica de mindfulness","Plan de acción basado en valores (ACT)","Revisión de distorsiones cognitivas","Actividades placenteras","Monitoreo de emociones","Estrategias de autocuidado","Preparar lista de logros","Redacción de carta de autoapoyo","Práctica de metáforas (ACT)","Entrenamiento en gratitud en pareja/familia","Práctica de autocompasión guiada","Ejercicios de atención plena en rutina","Plan de afrontamiento para crisis","Técnicas de visualización futura","Registro de emociones con colores","Registro de logros diarios","Planificación de reforzadores positivos","Otro"]')
on conflict (clave) do update set valores = excluded.valores;

commit;

-- 2) RPC de guardado real de nota SOAP (+ addendum opcional).
-- Valida permiso de edición del caso y asignación profesional; registra creada_por = persona.
create or replace function public.pasmu_notas_soap_guardar(
  p_caso_id bigint,
  p_sesion int,
  p_subjetivo text default null,
  p_objetivo jsonb default '{}'::jsonb,
  p_analisis text default null,
  p_plan jsonb default '{}'::jsonb,
  p_addenda_texto text default null,
  p_addenda_motivo text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_auth uuid := (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;
  v_persona uuid;
  v_nota_id bigint;
begin
  if v_auth is null then
    raise exception 'Sesión no autenticada.';
  end if;

  select id into v_persona from public.personas where auth_user_id = v_auth;
  if v_persona is null then
    raise exception 'Tu cuenta no tiene un perfil PASMU vinculado.';
  end if;

  if not private.pasmu_case_has_permission(p_caso_id, 'expediente.editar') then
    raise exception 'No tienes permiso para editar notas clínicas de este caso.';
  end if;

  if not private.pasmu_is_case_professional(p_caso_id) then
    raise exception 'No estás asignado a este caso.';
  end if;

  if p_sesion is null or p_sesion < 1 then
    raise exception 'El número de sesión debe ser un entero >= 1.';
  end if;

  insert into public.notas_soap (caso_id, sesion, subjetivo, objetivo, analisis, plan, creada_por)
  values (
    p_caso_id,
    p_sesion,
    nullif(btrim(coalesce(p_subjetivo, '')), ''),
    coalesce(p_objetivo, '{}'::jsonb),
    nullif(btrim(coalesce(p_analisis, '')), ''),
    coalesce(p_plan, '{}'::jsonb),
    v_persona
  )
  returning id into v_nota_id;

  if p_addenda_texto is not null and p_addenda_motivo is not null
     and char_length(btrim(p_addenda_texto)) between 5 and 2000
     and char_length(btrim(p_addenda_motivo)) between 5 and 500 then
    insert into public.notas_addendum (nota_id, texto, motivo, creada_por)
    values (v_nota_id, btrim(p_addenda_texto), btrim(p_addenda_motivo), v_persona);
  end if;

  return jsonb_build_object('nota_id', v_nota_id, 'caso_id', p_caso_id, 'sesion', p_sesion);
end;
$$;

revoke all on function public.pasmu_notas_soap_guardar(bigint, int, text, jsonb, text, jsonb, text, text) from public, anon;
grant execute on function public.pasmu_notas_soap_guardar(bigint, int, text, jsonb, text, jsonb, text, text) to authenticated;

