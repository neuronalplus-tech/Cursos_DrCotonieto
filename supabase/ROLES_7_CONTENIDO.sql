-- =============================================================
--  LOS ROLES, EN EL CONTENIDO
--
--  DE DÓNDE VIENE
--  ROLES_6 llevó los permisos a grupos, sesiones, asistencia e
--  inscripciones: lo que toca coordinación. Falta lo que toca quien
--  da clase, que es contenido y evaluación.
--
--  QUÉ RESUELVE
--  Hoy un rol «Docente» con el permiso `cursos.editar` sigue sin
--  poder editar nada: todas estas tablas preguntan por
--  `puede_gestionar_curso`, que mira la tabla `facilitadores`. O
--  sea, el rol no sirve si además no se le asigna como facilitador,
--  y entonces el rol sobra.
--
--  SE SUMA, COMO SIEMPRE
--  Políticas nuevas, con nombres nuevos. Las que hay quedan
--  intactas: quien es facilitador lo sigue siendo y conserva todo.
--  Añadir una política permisiva nunca cierra nada.
--
--  EL ÁMBITO
--  Se resuelve por la CATEGORÍA del curso, que es lo que permite
--  «jefatura de la carrera de Clínica». La sede no entra aquí: un
--  curso no tiene sede —la tiene el grupo—, y exigirla dejaría sin
--  editar a quien tiene el rol acotado a un plantel.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ROLES_6_POLITICAS.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿PUEDO ESTO, EN EL CURSO DE ESTE MÓDULO?
--
--    Módulos, recursos, exámenes y tareas cuelgan de un módulo o de
--    un curso. Esta función acepta cualquiera de los dos para no
--    repetir el mismo `coalesce` en diez políticas y arriesgarse a
--    escribirlo distinto en una.
-- -------------------------------------------------------------
create or replace function public.puedo_en_contenido(
  p_permiso text, p_curso bigint, p_modulo bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.puedo_en_curso(
    p_permiso,
    coalesce(p_curso, (select m.curso_id from public.modulos m where m.id = p_modulo))
  )
$$;

revoke all on function public.puedo_en_contenido(text, bigint, bigint) from public;
grant execute on function public.puedo_en_contenido(text, bigint, bigint)
  to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) CURSOS
--
--    Crear un curso NO se concede por `cursos.editar`: crear es
--    decidir el catálogo de la institución, y eso es de quien la
--    administra. `cursos.editar` sirve para cambiar los que ya
--    existen. Separarlo evita que un docente llene el catálogo de
--    cursos de prueba.
-- -------------------------------------------------------------
drop policy if exists "cursos_update_rol" on public.cursos;
create policy "cursos_update_rol" on public.cursos
  for update to authenticated
  using (public.tiene_permiso('cursos.editar', organizacion_id, null, categoria_id))
  with check (public.tiene_permiso('cursos.editar', organizacion_id, null, categoria_id));

drop policy if exists "cursos_select_rol" on public.cursos;
create policy "cursos_select_rol" on public.cursos
  for select to authenticated
  using (public.tiene_permiso('cursos.ver', organizacion_id, null, categoria_id));

-- -------------------------------------------------------------
-- 3) MÓDULOS Y RECURSOS
-- -------------------------------------------------------------
drop policy if exists "modulos_escribir_rol" on public.modulos;
create policy "modulos_escribir_rol" on public.modulos
  for all to authenticated
  using (public.puedo_en_curso('cursos.editar', curso_id))
  with check (public.puedo_en_curso('cursos.editar', curso_id));

drop policy if exists "recursos_escribir_rol" on public.recursos;
create policy "recursos_escribir_rol" on public.recursos
  for all to authenticated
  using (public.puedo_en_contenido('cursos.editar', null, modulo_id))
  with check (public.puedo_en_contenido('cursos.editar', null, modulo_id));

-- -------------------------------------------------------------
-- 4) EXÁMENES Y BANCO DE PREGUNTAS
-- -------------------------------------------------------------
drop policy if exists "examenes_escribir_rol" on public.examenes;
create policy "examenes_escribir_rol" on public.examenes
  for all to authenticated
  using (public.puedo_en_contenido('examenes.editar', curso_id, modulo_id))
  with check (public.puedo_en_contenido('examenes.editar', curso_id, modulo_id));

drop policy if exists "banco_escribir_rol" on public.banco_preguntas;
create policy "banco_escribir_rol" on public.banco_preguntas
  for all to authenticated
  using (public.tiene_permiso('examenes.editar', organizacion_id))
  with check (public.tiene_permiso('examenes.editar', organizacion_id));

drop policy if exists "banco_select_rol" on public.banco_preguntas;
create policy "banco_select_rol" on public.banco_preguntas
  for select to authenticated
  using (public.tiene_permiso('examenes.editar', organizacion_id));

-- -------------------------------------------------------------
-- 5) TAREAS Y SU RÚBRICA
-- -------------------------------------------------------------
drop policy if exists "tareas_escribir_rol" on public.tareas;
create policy "tareas_escribir_rol" on public.tareas
  for all to authenticated
  using (public.puedo_en_contenido('cursos.editar', curso_id, modulo_id))
  with check (public.puedo_en_contenido('cursos.editar', curso_id, modulo_id));

drop policy if exists "rubrica_escribir_rol" on public.rubrica_criterios;
create policy "rubrica_escribir_rol" on public.rubrica_criterios
  for all to authenticated
  using (exists (
    select 1 from public.tareas t where t.id = tarea_id
      and public.puedo_en_contenido('cursos.editar', t.curso_id, t.modulo_id)))
  with check (exists (
    select 1 from public.tareas t where t.id = tarea_id
      and public.puedo_en_contenido('cursos.editar', t.curso_id, t.modulo_id)));

-- -------------------------------------------------------------
-- 6) CALIFICAR
--
--    Permiso aparte de editar el contenido, y así debe ser: quien
--    arma el curso no siempre es quien lo califica, y en una
--    institución con varios docentes por programa esa distinción es
--    justo lo que hace falta.
--
--    Solo UPDATE: la entrega la crea el alumno. Dejar que quien
--    califica también inserte permitiría fabricar entregas a nombre
--    de otro.
-- -------------------------------------------------------------
drop policy if exists "entregas_calificar_rol" on public.entregas;
create policy "entregas_calificar_rol" on public.entregas
  for update to authenticated
  using (exists (
    select 1 from public.tareas t where t.id = tarea_id
      and public.puedo_en_contenido('calificaciones.capturar', t.curso_id, t.modulo_id)))
  with check (exists (
    select 1 from public.tareas t where t.id = tarea_id
      and public.puedo_en_contenido('calificaciones.capturar', t.curso_id, t.modulo_id)));

drop policy if exists "entregas_select_rol" on public.entregas;
create policy "entregas_select_rol" on public.entregas
  for select to authenticated
  using (exists (
    select 1 from public.tareas t where t.id = tarea_id
      and public.puedo_en_contenido('calificaciones.ver', t.curso_id, t.modulo_id)));

drop policy if exists "intentos_select_rol" on public.intentos_examen;
create policy "intentos_select_rol" on public.intentos_examen
  for select to authenticated
  using (exists (
    select 1 from public.examenes e where e.id = examen_id
      and public.puedo_en_contenido('calificaciones.ver', e.curso_id, e.modulo_id)));

-- -------------------------------------------------------------
-- 7) FORO
--
--    Moderar incluye abrir temas, cerrarlos y fijarlos. Calificar
--    las aportaciones va con `calificaciones.capturar`, y la
--    columna de la nota ya está protegida por su propio disparador
--    desde FORO_CALIFICACION.
-- -------------------------------------------------------------
drop policy if exists "foro_hilos_escribir_rol" on public.foro_hilos;
create policy "foro_hilos_escribir_rol" on public.foro_hilos
  for all to authenticated
  using (public.puedo_en_curso('foro.moderar', curso_id))
  with check (public.puedo_en_curso('foro.moderar', curso_id));

drop policy if exists "foro_respuestas_moderar_rol" on public.foro_respuestas;
create policy "foro_respuestas_moderar_rol" on public.foro_respuestas
  for update to authenticated
  using (exists (
    select 1 from public.foro_hilos h where h.id = hilo_id
      and (public.puedo_en_curso('foro.moderar', h.curso_id)
        or public.puedo_en_curso('calificaciones.capturar', h.curso_id))))
  with check (exists (
    select 1 from public.foro_hilos h where h.id = hilo_id
      and (public.puedo_en_curso('foro.moderar', h.curso_id)
        or public.puedo_en_curso('calificaciones.capturar', h.curso_id))));

drop policy if exists "foro_respuestas_select_rol" on public.foro_respuestas;
create policy "foro_respuestas_select_rol" on public.foro_respuestas
  for select to authenticated
  using (exists (
    select 1 from public.foro_hilos h where h.id = hilo_id
      and public.puedo_en_curso('cursos.ver', h.curso_id)));

-- -------------------------------------------------------------
-- 8) PROGRESO DE SUS ALUMNOS
--
--    Sin esto, el panel de progreso sale vacío para quien entra por
--    rol: ve la lista de inscritos y ni una barra de avance.
-- -------------------------------------------------------------
drop policy if exists "progreso_select_rol" on public.progreso_usuario;
create policy "progreso_select_rol" on public.progreso_usuario
  for select to authenticated
  using (exists (
    select 1
    from public.recursos r
    join public.modulos m on m.id = r.modulo_id
    where r.id = recurso_id
      and public.puedo_en_curso('alumnos.ver', m.curso_id)));

-- -------------------------------------------------------------
-- 9) PRÓRROGAS Y CONSTANCIAS
-- -------------------------------------------------------------
drop policy if exists "prorrogas_escribir_rol" on public.prorrogas;
create policy "prorrogas_escribir_rol" on public.prorrogas
  for all to authenticated
  using (public.puedo_en_curso('calificaciones.capturar',
         public.curso_de_actividad(tipo, actividad_id)))
  with check (public.puedo_en_curso('calificaciones.capturar',
              public.curso_de_actividad(tipo, actividad_id)));

drop policy if exists "constancias_select_rol" on public.constancias;
create policy "constancias_select_rol" on public.constancias
  for select to authenticated
  using (public.puedo_en_curso('documentos.generar', curso_id));

-- -------------------------------------------------------------
-- 10) QUÉ CURSOS PUEDO GESTIONAR, POR ROL
--
--    La pantalla pregunta «¿puedo gestionar ESTE curso?» en una
--    docena de sitios. Hasta ahora la respuesta salía de
--    `facilitadores`; con roles hay que mirar también la categoría
--    de cada curso y los permisos de la persona.
--
--    Se devuelve la LISTA de una vez en vez de preguntar curso por
--    curso: con veinte cursos serían veinte llamadas para pintar
--    una portada.
-- -------------------------------------------------------------
create or replace function public.cursos_que_puedo(p_permiso text)
returns table (curso_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.cursos c
  where public.tiene_permiso(p_permiso, c.organizacion_id, null, c.categoria_id)
$$;

revoke all on function public.cursos_que_puedo(text) from public;
grant execute on function public.cursos_que_puedo(text) to authenticated;

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 11) COMPROBACIÓN
-- -------------------------------------------------------------
select 'politicas por rol, en total' as que,
  (select count(*)::text from pg_policies
    where schemaname = 'public' and policyname like '%_rol') as valor
union all
select 'de contenido (las de este script)',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and policyname like '%_rol'
      and tablename in ('cursos', 'modulos', 'recursos', 'examenes', 'tareas',
                        'rubrica_criterios', 'entregas', 'intentos_examen',
                        'foro_hilos', 'foro_respuestas', 'banco_preguntas',
                        'progreso_usuario', 'prorrogas', 'constancias'))
union all
select 'funcion puedo_en_contenido',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'puedo_en_contenido')
union all
select 'politicas anteriores (intactas)',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and policyname not like '%_rol');

-- =============================================================
--  RESULTADO ESPERADO
--  · politicas por rol, en total     = 33
--  · de contenido                    = 18
--  · funcion puedo_en_contenido      = 1
--  · politicas anteriores            = las de siempre, intactas
--
--  NADIE PIERDE NADA. Quien es facilitador lo sigue siendo y
--  conserva todo lo que tenia.
--
--  COMO PROBARLO
--  1. Crea un rol «Docente» (o usa el basico) y asignalo a un
--     correo de prueba que NO este en facilitadores.
--  2. Con esa cuenta, entra a un curso de esa organizacion: debe
--     poder editar modulos, recursos y examenes.
--  3. Quitale `calificaciones.capturar` al rol y recarga: debe
--     seguir editando el curso y NO poder calificar una entrega.
--
--  El paso 3 es el que importa. Editar y calificar son permisos
--  distintos a proposito: quien arma el curso no siempre es quien
--  lo califica.
--
--  LO QUE SIGUE SIN CONCEDERSE POR ROL, Y A PROPOSITO
--  · CREAR cursos: es decidir el catalogo de la institucion.
--  · Emitir constancias: ya pasa por `emitir_constancia`, que
--    comprueba lo suyo.
--  · Borrar intentos de examen y entregas: sigue siendo del
--    administrador. Borrar evidencia de evaluacion no deberia ser
--    cosa de un rol configurable.
-- =============================================================
