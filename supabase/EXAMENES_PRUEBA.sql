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
--
--  ⚠️ IMPORTANTE — por qué `gratuito = false`:
--    En el código, `esTallerIndividual()` clasifica como "taller"
--    a TODO curso con `gratuito = true` que NO tenga `linea`, y la
--    página principal los filtra con `.filter(c => !esTallerIndividual(c))`.
--    Por eso un curso de prueba "gratuito" se crea pero NO se ve
--    en la portada. Aquí va como curso normal para que sí aparezca.
-- -------------------------------------------------------------
do $$
declare
  v_curso_id  bigint;
  v_modulo_id bigint;
begin

  -- Si ya existe de una corrida anterior, lo reaprovechamos y lo corregimos
  select id into v_curso_id from public.cursos
   where titulo = 'PRUEBA — Exámenes' limit 1;

  if v_curso_id is not null then
    update public.cursos
       set gratuito = false, constancia = false, activo = true, proximamente = false, orden = 999
     where id = v_curso_id;

    -- Empezamos limpio: borra exámenes y módulos de la corrida anterior
    delete from intentos_examen
     where examen_id in (select id from public.examenes where modulo_id in
                          (select id from public.modulos where curso_id = v_curso_id));
    delete from public.examenes where modulo_id in
      (select id from public.modulos where curso_id = v_curso_id);
    delete from public.modulos where curso_id = v_curso_id;
  else
    insert into public.cursos (titulo, descripcion, activo, orden, gratuito, constancia)
    values ('PRUEBA — Exámenes',
            'Curso temporal para probar los tipos de pregunta. Bórralo cuando termines.',
            true, 999, false, false)
    returning id into v_curso_id;
  end if;

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
-- 3) POR QUÉ NO LO VEÍAS EN LA PÁGINA PRINCIPAL
--    El código tiene esta regla (App.jsx, función esTallerIndividual):
--        esTallerIndividual(c) = c.gratuito && !c.linea
--    y la portada filtra:
--        .filter(c => !esTallerIndividual(c))
--    O sea: TODO curso con `gratuito = true` y sin `linea`
--    se clasifica como "taller" y se oculta de la portada.
--    → Por eso la v1 de este script (con gratuito = true) creaba
--      el curso pero no se veía en el inicio.
--    → Este script ya lo crea con `gratuito = false`.
--    → Si ya lo habías creado antes, NO hace falta borrarlo:
--      este script reutiliza el existente y lo corrige.
--
-- 4) CÓMO PROBARLO
--    1) Entra al portal con tu cuenta de admin.
--    2) Inicio → debe aparecer la tarjeta "PRUEBA — Exámenes".
--    3) Ábrelo → entra al módulo → responde las 4 preguntas.
--    4) Debe salir tu calificación y el historial de intentos.
--    5) Panel → 📝 Exámenes → el curso debe salir con su módulo
--       y el botón "✏️ Editar".
--
-- 5) CÓMO BORRAR LA PRUEBA (cuando ya no la necesites)
--    delete from public.cursos where titulo = 'PRUEBA — Exámenes';
--    (borrar el curso se lleva sus módulos y sus exámenes)
-- =============================================================
