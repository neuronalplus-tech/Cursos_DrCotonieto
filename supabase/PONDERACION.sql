-- =============================================================
-- CALIFICACIÓN POR MÓDULOS, CRITERIOS Y ACTIVIDADES
-- =============================================================
-- cursos.ponderacion ya existe como JSONB. La estructura versión 2
-- se guarda en esa columna; no requiere tablas ni columnas nuevas.
-- Este script mantiene la columna y la validación como objeto JSON.
-- Es idempotente.
--
-- Forma guardada por el panel:
-- {
--   "version": 2,
--   "escala": 10,
--   "minima10": 7,
--   "grupos": [{
--     "id": "modulo:12",
--     "moduloId": 12,
--     "nombre": "Módulo 1",
--     "peso": 50,
--     "modo": "rubrica",
--     "criterios": [{
--       "id": "...",
--       "nombre": "Entrega",
--       "peso": 100,
--       "fuente": "tipos",
--       "tipos": ["tareas"],
--       "distribucion": "igual"
--     }]
--   }]
-- }
--
-- Un grupo también puede usar modo="entregable" y guardar una
-- referencia {"tipo":"tareas", "id":123} en "entregable".
-- fuente="tipos" incorpora automáticamente nuevas actividades de
-- ese tipo. fuente="lista" guarda IDs concretos; su distribución
-- puede ser igual o manual.
--
-- La aplicación aún lee el formato anterior plano
-- {examenes, tareas, foro, avance, minima}; los cursos existentes
-- conservan esa configuración hasta que el administrador la cambie.
-- Las actividades pendientes cuentan con su peso completo y aportan
-- cero al acumulado provisional. La pantalla presenta la nota en 0–10
-- y muestra por separado cuánto porcentaje ya está calificado.
-- =============================================================

alter table public.cursos
  add column if not exists ponderacion jsonb;

alter table public.cursos
  drop constraint if exists cursos_ponderacion_check;

alter table public.cursos
  add constraint cursos_ponderacion_check
  check (ponderacion is null or jsonb_typeof(ponderacion) = 'object');

comment on column public.cursos.ponderacion is
  'Árbol de evaluación por curso (versión 2: módulos, criterios y actividades); también admite el formato plano anterior.';

notify pgrst, 'reload schema';

select 'columna ponderacion' as que,
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'cursos'
      and column_name = 'ponderacion') as n
union all
select 'cursos con ponderacion',
  (select count(*)::text from public.cursos where ponderacion is not null)
union all
select 'cursos en total', (select count(*)::text from public.cursos);
