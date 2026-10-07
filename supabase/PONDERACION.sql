-- =============================================================
--  PONDERACIÓN DE LA CALIFICACIÓN DEL CURSO
--
--  QUÉ RESUELVE
--  Hoy la nota del curso es el promedio simple de todo lo
--  calificado: un examen vale lo mismo que una participación en el
--  foro. Ningún programa serio evalúa así. Y peor: esa nota solo
--  existía del lado del alumno, de modo que el facilitador no veía
--  ningún total y, en cuanto lo viera, habría dos cuentas distintas
--  del mismo número.
--
--  QUÉ HACE
--  Una columna. Toda la lógica vive en src/lib/calificacion.js, que
--  usan LAS DOS pantallas —la del alumno y la rejilla del
--  facilitador— para que no puedan discrepar.
--
--  POR QUÉ UNA COLUMNA JSONB Y NO UNA TABLA
--  Es una configuración de cuatro números por curso que siempre se
--  lee entera y junto con el curso. Una tabla aparte obligaría a un
--  join en cada pantalla que muestre una nota, y a decidir qué
--  significa que falte la fila. Aquí, que falte el dato es
--  exactamente "sin ponderar", que es el caso por omisión.
--
--  NADA CAMBIA HASTA QUE CONFIGURES UN CURSO. Sin ponderación, el
--  promedio se calcula igual que antes.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente.
-- =============================================================

-- -------------------------------------------------------------
-- 1) LA COLUMNA
--
--    Forma esperada:
--      { "examenes": 40, "tareas": 40, "foro": 20,
--        "avance": 0, "minima": 70 }
--
--    Los pesos no tienen que sumar 100: la aplicación los
--    renormaliza. `minima` es el porcentaje para aprobar el curso
--    entero, distinto del `umbral_aprobacion` de cada examen.
-- -------------------------------------------------------------
alter table public.cursos
  add column if not exists ponderacion jsonb;

-- Se guarda un objeto, no una lista ni un número suelto. Sin esto,
-- un error de tecleo en la API dejaría la columna en un estado que
-- la aplicación no sabe leer y la nota del curso desaparecería sin
-- explicación.
alter table public.cursos
  drop constraint if exists cursos_ponderacion_check;
alter table public.cursos
  add constraint cursos_ponderacion_check
  check (ponderacion is null or jsonb_typeof(ponderacion) = 'object');

comment on column public.cursos.ponderacion is
  'Pesos de la calificación final: examenes, tareas, foro, avance y minima. NULL = promedio simple.';

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 2) COMPROBACIÓN
-- -------------------------------------------------------------
select 'columna ponderacion' as que,
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'cursos'
      and column_name = 'ponderacion') as n
union all
select 'cursos con ponderacion',
  (select count(*)::text from public.cursos where ponderacion is not null)
union all
select 'cursos en total', (select count(*)::text from public.cursos);

-- =============================================================
--  RESULTADO ESPERADO
--  · columna ponderacion    = 1
--  · cursos con ponderacion = 0   (todavia ninguno; se configura
--                                  desde el panel, curso por curso)
--  · cursos en total        = los que tengas
--
--  DONDE SE CONFIGURA
--  Panel -> Cursos -> editar un curso -> "Calificacion final".
--
--  UNA ADVERTENCIA QUE CONVIENE LEER
--  Cambiar la ponderacion de un curso cambia la nota de TODOS sus
--  alumnos, incluidos los que ya terminaron. Si ya emitiste
--  constancias de ese curso, el numero que ve el alumno hoy puede
--  no coincidir con el que viste cuando se la diste. Ajusta la
--  ponderacion al abrir la generacion, no al cerrarla.
-- =============================================================
