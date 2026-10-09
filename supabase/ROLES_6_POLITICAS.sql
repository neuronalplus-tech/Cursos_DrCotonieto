-- =============================================================
--  LOS ROLES, AHORA TAMBIÉN EN LA BASE
--
--  DE DÓNDE VIENE
--  ROLES_5 dejó los roles configurables, pero solo decidían qué se
--  ENSEÑA. Un coordinador veía los botones y la base le negaba la
--  escritura, porque las políticas miran `admins` y `facilitadores`.
--
--  QUÉ HACE ESTE SCRIPT
--  Añade políticas para que quien tiene el permiso pueda de verdad.
--  Se empieza por donde un coordinador trabaja a diario: grupos,
--  sesiones, asistencia, inscripciones, sedes y plantillas.
--
--  SE SUMA, NO SE SUSTITUYE
--  En Postgres, dos políticas permisivas sobre la misma tabla se
--  combinan con O: basta que una diga que sí. Por eso aquí solo se
--  AÑADEN, con nombres nuevos. Las que existen quedan intactas, y
--  nadie pierde un permiso que ya tenía. Es lo contrario de lo que
--  haría falta para QUITAR acceso —ahí hay que tocar la política
--  original—, y conviene recordarlo: añadir una política nunca
--  cierra nada.
--
--  EL ÁMBITO, QUE ES LO DELICADO
--  Un rol puede estar acotado a una sede o a una categoría. Las
--  funciones de abajo resuelven cuál es la sede y la categoría de
--  cada fila antes de preguntar, para que «coordinador del Plantel
--  Norte» no pueda tocar el grupo de otro plantel.
--
--  CÓMO USARLO
--  Supabase -> SQL Editor -> New query -> pega esto -> Run.
--  Es idempotente. Requiere ROLES_5_PERMISOS y ASISTENCIA.
-- =============================================================

-- -------------------------------------------------------------
-- 1) ¿PUEDO ESTO, EN ESTE CURSO?
--
--    Resuelve la organización y la categoría a partir del curso, y
--    pregunta. La sede va aparte porque un curso no tiene sede: la
--    tiene el grupo.
-- -------------------------------------------------------------
create or replace function public.puedo_en_curso(p_permiso text, p_curso bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cursos c
    where c.id = p_curso
      and public.tiene_permiso(p_permiso, c.organizacion_id, null, c.categoria_id)
  )
$$;

revoke all on function public.puedo_en_curso(text, bigint) from public;
grant execute on function public.puedo_en_curso(text, bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 2) ¿PUEDO ESTO, EN ESTE GRUPO?
--
--    Aquí sí hay sede, así que es la comprobación completa: un rol
--    acotado a un plantel solo vale en los grupos de ese plantel.
-- -------------------------------------------------------------
create or replace function public.puedo_en_generacion(p_permiso text, p_gen bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.generaciones g
    join public.cursos c on c.id = g.curso_id
    where g.id = p_gen
      and public.tiene_permiso(p_permiso, c.organizacion_id, g.sede_id, c.categoria_id)
  )
$$;

revoke all on function public.puedo_en_generacion(text, bigint) from public;
grant execute on function public.puedo_en_generacion(text, bigint) to authenticated, service_role;

-- -------------------------------------------------------------
-- 3) GRUPOS (generaciones)
--
--    Permiso: grupos.gestionar
--
--    Al CREAR un grupo todavía no hay fila, así que el ámbito se
--    comprueba contra lo que se está escribiendo: el curso que trae
--    y la sede que se le pone.
-- -------------------------------------------------------------
drop policy if exists "generaciones_insert_rol" on public.generaciones;
create policy "generaciones_insert_rol" on public.generaciones
  for insert to authenticated
  with check (exists (
    select 1 from public.cursos c
    where c.id = curso_id
      and public.tiene_permiso('grupos.gestionar', c.organizacion_id, sede_id, c.categoria_id)
  ));

drop policy if exists "generaciones_update_rol" on public.generaciones;
create policy "generaciones_update_rol" on public.generaciones
  for update to authenticated
  using (public.puedo_en_generacion('grupos.gestionar', id))
  with check (exists (
    select 1 from public.cursos c
    where c.id = curso_id
      and public.tiene_permiso('grupos.gestionar', c.organizacion_id, sede_id, c.categoria_id)
  ));

drop policy if exists "generaciones_delete_rol" on public.generaciones;
create policy "generaciones_delete_rol" on public.generaciones
  for delete to authenticated
  using (public.puedo_en_generacion('grupos.gestionar', id));

-- -------------------------------------------------------------
-- 4) SESIONES
--
--    Crear y mover sesiones es armar el calendario del grupo, así
--    que vale cualquiera de los dos permisos: quien coordina monta
--    el calendario, y quien da clase apunta la sesión que acaba de
--    dar.
-- -------------------------------------------------------------
drop policy if exists "sesiones_escribir_rol" on public.sesiones;
create policy "sesiones_escribir_rol" on public.sesiones
  for all to authenticated
  using (
    public.puedo_en_generacion('asistencia.pasar', generacion_id)
    or public.puedo_en_generacion('grupos.gestionar', generacion_id)
  )
  with check (
    public.puedo_en_generacion('asistencia.pasar', generacion_id)
    or public.puedo_en_generacion('grupos.gestionar', generacion_id)
  );

drop policy if exists "sesiones_select_rol" on public.sesiones;
create policy "sesiones_select_rol" on public.sesiones
  for select to authenticated
  using (
    public.puedo_en_generacion('asistencia.pasar', generacion_id)
    or public.puedo_en_generacion('alumnos.ver', generacion_id)
  );

-- -------------------------------------------------------------
-- 5) ASISTENCIA
--
--    Permiso: asistencia.pasar
--
--    Justificar es otra cosa y la vigila el disparador de abajo:
--    una política decide por FILA, y justificar es cambiar UNA
--    columna de una fila que ya se podía tocar.
-- -------------------------------------------------------------
drop policy if exists "asistencia_escribir_rol" on public.asistencia;
create policy "asistencia_escribir_rol" on public.asistencia
  for all to authenticated
  using (exists (
    select 1 from public.sesiones s
    where s.id = sesion_id
      and public.puedo_en_generacion('asistencia.pasar', s.generacion_id)
  ))
  with check (exists (
    select 1 from public.sesiones s
    where s.id = sesion_id
      and public.puedo_en_generacion('asistencia.pasar', s.generacion_id)
  ));

drop policy if exists "asistencia_select_rol" on public.asistencia;
create policy "asistencia_select_rol" on public.asistencia
  for select to authenticated
  using (exists (
    select 1 from public.sesiones s
    where s.id = sesion_id
      and (public.puedo_en_generacion('asistencia.pasar', s.generacion_id)
        or public.puedo_en_generacion('alumnos.ver', s.generacion_id))
  ));

-- -------------------------------------------------------------
-- 6) JUSTIFICAR UNA FALTA ES UN PERMISO APARTE
--
--    Y tiene que serlo: quien pasa lista registra lo que vio; quien
--    justifica decide que esa falta no cuenta, y eso suele ser de
--    coordinación porque exige ver un comprobante. Juntarlos deja
--    que cada docente se perdone a sus alumnos.
--
--    Va en un disparador porque RLS decide por fila, no por columna.
-- -------------------------------------------------------------
create or replace function public.verificar_justificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_gen bigint;
begin
  -- Solo importa si cambia la justificación.
  if tg_op = 'UPDATE' and new.justificada is not distinct from old.justificada then
    return new;
  end if;
  if tg_op = 'INSERT' and not new.justificada then
    return new;
  end if;

  select s.generacion_id into v_gen from public.sesiones s where s.id = new.sesion_id;

  -- Quien administra o facilita el curso sigue pudiendo, como hasta
  -- ahora: este script suma permisos, no los quita.
  if public.puede_gestionar_curso(
       (select g.curso_id from public.generaciones g where g.id = v_gen)) then
    return new;
  end if;

  if not public.puedo_en_generacion('asistencia.justificar', v_gen) then
    raise exception 'Puedes pasar lista, pero justificar faltas es de coordinación.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists asistencia_justificar on public.asistencia;
create trigger asistencia_justificar
  before insert or update on public.asistencia
  for each row execute function public.verificar_justificacion();

-- -------------------------------------------------------------
-- 7) INSCRIPCIONES (acceso)
--
--    Permiso: alumnos.inscribir
--
--    El ámbito se resuelve por el curso. No se mira la sede porque
--    la inscripción es a un curso, no a un grupo: la generación se
--    le pone después.
-- -------------------------------------------------------------
drop policy if exists "acceso_insert_rol" on public.acceso;
create policy "acceso_insert_rol" on public.acceso
  for insert to authenticated
  with check (public.puedo_en_curso('alumnos.inscribir', curso_id));

drop policy if exists "acceso_update_rol" on public.acceso;
create policy "acceso_update_rol" on public.acceso
  for update to authenticated
  using (public.puedo_en_curso('alumnos.inscribir', curso_id))
  with check (public.puedo_en_curso('alumnos.inscribir', curso_id));

drop policy if exists "acceso_delete_rol" on public.acceso;
create policy "acceso_delete_rol" on public.acceso
  for delete to authenticated
  using (public.puedo_en_curso('alumnos.inscribir', curso_id));

drop policy if exists "acceso_select_rol" on public.acceso;
create policy "acceso_select_rol" on public.acceso
  for select to authenticated
  using (public.puedo_en_curso('alumnos.ver', curso_id));

-- -------------------------------------------------------------
-- 8) SEDES Y PLANTILLAS
-- -------------------------------------------------------------
drop policy if exists "sedes_escribir_rol" on public.sedes;
create policy "sedes_escribir_rol" on public.sedes
  for all to authenticated
  using (public.tiene_permiso('sedes.gestionar', organizacion_id))
  with check (public.tiene_permiso('sedes.gestionar', organizacion_id));

drop policy if exists "plantillas_escribir_rol" on public.plantillas_documento;
create policy "plantillas_escribir_rol" on public.plantillas_documento
  for all to authenticated
  using (public.tiene_permiso('documentos.plantillas', organizacion_id))
  with check (public.tiene_permiso('documentos.plantillas', organizacion_id));

-- Para generar un acta hay que poder LEER la plantilla, y eso lo
-- tiene quien genera documentos aunque no pueda editarlas.
drop policy if exists "plantillas_select_rol" on public.plantillas_documento;
create policy "plantillas_select_rol" on public.plantillas_documento
  for select to authenticated
  using (public.tiene_permiso('documentos.generar', organizacion_id));

-- -------------------------------------------------------------
-- 9) PERFILES: VER A SUS ALUMNOS
--
--    Sin esto, un coordinador ve una lista de identificadores sin
--    nombres y la pantalla parece rota.
-- -------------------------------------------------------------
drop policy if exists "perfil_select_rol" on public.perfiles;
create policy "perfil_select_rol" on public.perfiles
  for select to authenticated
  using (exists (
    select 1
    from public.acceso a
    join public.cursos c on c.id = a.curso_id
    where a.usuario_id = perfiles.id
      and public.tiene_permiso('alumnos.ver', c.organizacion_id, null, c.categoria_id)
  ));

notify pgrst, 'reload schema';

-- -------------------------------------------------------------
-- 10) COMPROBACIÓN
-- -------------------------------------------------------------
select 'politicas por rol creadas' as que,
  (select count(*)::text from pg_policies
    where schemaname = 'public' and policyname like '%_rol') as valor
union all
select 'funciones de ambito',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('puedo_en_curso', 'puedo_en_generacion'))
union all
select 'disparador de justificacion',
  (select count(*)::text from pg_trigger where tgname = 'asistencia_justificar')
union all
select 'politicas que ya existian (no se tocaron)',
  (select count(*)::text from pg_policies
    where schemaname = 'public'
      and tablename in ('acceso', 'generaciones', 'sesiones', 'asistencia', 'sedes')
      and policyname not like '%_rol');

-- =============================================================
--  RESULTADO ESPERADO
--  · politicas por rol creadas  = 13
--  · funciones de ambito        = 2
--  · disparador de justificacion= 1
--  · politicas que ya existian  = las de antes, intactas
--
--  NADIE PIERDE NADA. Añadir una politica permisiva nunca cierra
--  acceso: solo lo abre a quien antes no lo tenia.
--
--  COMO PROBARLO DE VERDAD
--  1. Panel -> Roles -> crea los tres basicos.
--  2. Asigna «Coordinacion» a un correo de prueba, acotado a una
--     sede si tienes varias.
--  3. Entra con esa cuenta: debe poder armar grupos e inscribir,
--     y NO debe ver Suscripciones ni la Bitacora.
--  4. Intenta justificar una falta con un rol que solo tenga
--     «asistencia.pasar»: debe negarse con el mensaje del paso 6.
--
--  El paso 4 es el que importa. Si deja justificar, el disparador
--  no esta actuando.
--
--  LO QUE FALTA
--  Cursos, modulos, recursos, examenes, tareas y foro siguen
--  mirando `puede_gestionar_curso`. Para un coordinador no cambia
--  nada —no edita contenido—, pero para un «Docente» por rol, si:
--  hoy sigue necesitando estar en `facilitadores`. Eso es el
--  siguiente paso y conviene hacerlo despues de ver estos en uso.
-- =============================================================
