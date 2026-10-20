-- 17b: cuenta auditora ernesto_cotonieto@uaeh.edu.mx con membresía en los 9 roles (UAP).
-- Solo PRUEBAS demo. Requiere Auth creado + 17 aplicado. Revocable por unidad.
begin;
do $$ declare v_persona uuid; v_unidad bigint; v_rol bigint; r text; begin
  select id into v_persona from public.personas
  where auth_user_id = (select id from auth.users where lower(email) = 'ernesto_cotonieto@uaeh.edu.mx');
  if v_persona is null then raise exception 'Crea primero la Auth ernesto_cotonieto@uaeh.edu.mx y vincúlala en personas.'; end if;
  select id into v_unidad from public.unidades where codigo = 'UAP' and activo;
  if v_unidad is null then raise exception 'Falta unidad UAP.'; end if;
  foreach r in array array['direccion_pasmu','responsable_unidad','coordinador_clinico','supervisor_clinico','terapeuta','coterapeuta','clinico_administrativo','tallerista','persona_usuaria'] loop
    select id into v_rol from public.roles where codigo = r and activo;
    if v_rol is null then raise exception 'Falta rol % (corre 17).', r; end if;
    if not exists (select 1 from public.miembros where persona_id = v_persona and unidad_id = v_unidad and rol_id = v_rol and programa_id is null and activo) then
      insert into public.miembros (persona_id, unidad_id, rol_id) values (v_persona, v_unidad, v_rol);
    end if;
  end loop;
end $$;
commit;
-- Revocar un rol: update miembros set activo=false where ... and rol_id=(select id from roles where codigo='...');
