-- =============================================================
--  EXÁMENES: soporte de examen a nivel CURSO + examen de PRUEBA
--  Proyecto: Cursos_DrCotonieto
--  Cómo usarlo:
--    Supabase → SQL Editor → New query → pega esto → Run
--  Es idempotente: puedes correrlo más de una vez sin romper nada.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Columna nueva: examen a nivel curso (además del de módulo)
--    Los talleres NO tienen módulos, así que su evaluación vive aquí.
-- -------------------------------------------------------------
alter table public.examenes
  add column if not exists curso_id bigint
  references public.cursos(id) on delete cascade;

comment on column public.examenes.curso_id is
  'Examen del curso completo. NULL = el examen pertenece a un módulo.';

-- Índices para que la búsqueda del examen sea rápida
create index if not exists examenes_modulo_id_idx on public.examenes(modulo_id);
create index if not exists examenes_curso_id_idx  on public.examenes(curso_id);

-- -------------------------------------------------------------
-- 2) EXAMEN DE PRUEBA (autocontenido: crea su propio curso/módulo)
--    No toca tus cursos reales. Entrarás al portal y lo verás
--    como "PRUEBA — Exámenes".
-- -------------------------------------------------------------
do $$
declare
  v_curso_id  bigint;
  v_modulo_id bigint;
begin

  -- Curso de prueba (gratuito para que puedas verlo sin inscripción)
  insert into public.cursos (titulo, descripcion, activo, orden, gratuito)
  values ('PRUEBA — Exámenes',
          'Curso temporal para probar los tipos de pregunta. Bórralo cuando termines.',
          true, 999, true)
  returning id into v_curso_id;

  -- Módulo de prueba
  insert into public.modulos (curso_id, titulo, descripcion, orden, activo, disponible)
  values (v_curso_id,
          'Módulo 1 — Todos los tipos de pregunta',
          'Cuatro preguntas, una de cada tipo soportado.',
          1, true, true)
  returning id into v_modulo_id;

  -- Examen con los 4 tipos
  insert into public.examenes
    (modulo_id, titulo, descripcion, umbral_aprobacion, activo, preguntas)
  values (
    v_modulo_id,
    'Examen de prueba — 4 tipos',
    'Si llegas al final y ves tu calificación, todo funciona.',
    70,
    true,
    $jsonb$
    [
      { "id": "p1", "tipo": "opcion",
        "pregunta": "¿Cuál de estos NO es un criterio del duelo normativo?",
        "opciones": [
          { "texto": "Perder a una persona querible", "correcta": false },
          { "texto": "Que la tristeza disminuya en 6 meses", "correcta": true },
          { "texto": "Que el vínculo se reorganice", "correcta": false },
          { "texto": "Volver a la rutina quickly", "correcta": false }
        ] },

      { "id": "p2", "tipo": "vf",
        "pregunta": "El duelo normativo se distingue del prolongado principalmente por su intensidad, no por su duración.",
        "opciones": [
          { "texto": "Verdadero", "correcta": true },
          { "texto": "Falso", "correcta": false }
        ] },

      { "id": "p3", "tipo": "corta",
        "pregunta": "¿Qué siglas tiene el trastorno de estrés postraumático?",
        "respuesta": "TEPT|trastorno de estrés postraumático" },

      { "id": "p4", "tipo": "emparejar",
        "pregunta": "Relaciona cada enfoque con su objetivo principal",
        "pares": [
          { "id": "a", "premisa": "ACT",            "respuesta": "Aceptar" },
          { "id": "b", "premisa": "DBT",            "respuesta": "Regular" },
          { "id": "c", "premisa": "Proceso Dual",   "respuesta": "Restaurar" }
        ] }
    ]
    $jsonb$
  );

  raise notice 'PRUEBA creada: curso %, módulo %, examen listo.', v_curso_id, v_modulo_id;
end $$;

-- -------------------------------------------------------------
-- 3) CÓMO PROBARLO
--    1) Entra al portal con tu cuenta de admin.
--    2) Panel → 📝 Exámenes → debe verse el curso "PRUEBA — Exámenes".
--    3) Abre el módulo del curso y responde las 4 preguntas.
--    4) Debe salir tu calificación y el historial de intentos.
--
-- 4) CÓMO BORRAR LA PRUEBA (cuando ya no la necesites)
--    delete from public.cursos where titulo = 'PRUEBA — Exámenes';
--    (borrar el curso se lleva sus módulos y sus exámenes)
-- =============================================================
