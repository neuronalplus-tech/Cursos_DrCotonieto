-- 13b: triggers bitácora + RPC pre-alta con alcance. Solo PRUEBAS.
begin;
create or replace function private.pasmu_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_antes jsonb; v_despues jsonb; v_cambios text[]; v_unidad bigint;
begin
  if TG_OP = 'DELETE' then v_antes := to_jsonb(OLD);
  elsif TG_OP = 'INSERT' then v_despues := to_jsonb(NEW);
  else v_antes := to_jsonb(OLD); v_despues := to_jsonb(NEW);
    select array_agg(k) into v_cambios from jsonb_each(v_despues) e(k,v)
    where v_antes -> e.k is distinct from v_despues -> e.k;
    if v_cambios is null then return NEW; end if;
  end if;
  v_unidad := coalesce((v_despues ->> 'unidad_id')::bigint, (v_antes ->> 'unidad_id')::bigint);
  insert into public.auditoria_actividad (unidad_id, tabla, registro_id, operacion, usuario_id, antes, despues, cambios)
  values (v_unidad, TG_TABLE_NAME, coalesce(v_despues ->> 'id', v_antes ->> 'id'),
    TG_OP, private.pasmu_current_persona_id(), v_antes, v_despues, v_cambios);
  return coalesce(NEW, OLD);
end; $$;
revoke all on function private.pasmu_auditar() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['casos','agenda','notas_clinicas','miembros','prealtas_equipo',
    'historia_clinica','examen_mental','tareas_sesion','autoevaluaciones_resultados','asistencia_sesion',
    'banco_recursos','avisos_cita'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists auditar_%1$s on public.%1$I', t);
      execute format('create trigger auditar_%1$s after insert or update or delete on public.%1$I for each row execute function private.pasmu_auditar()', t);
    end if;
  end loop;
end $$;

-- RPC pre-alta equipo: responsable solo en sus unidades; admin general en todas.
create or replace function public.pasmu_preAlta_equipo(_email text, _nombre text, _rol text, _unidad bigint, _programa bigint default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_yo uuid := private.pasmu_current_persona_id(); v_id uuid;
begin
  if v_yo is null then raise exception 'Perfil requerido.' using errcode='42501'; end if;
  if not private.pasmu_has_permission('admin.roles', _unidad) then
    raise exception 'Solo en tus unidades.' using errcode='42501'; end if;
  if _rol not in ('psicologo','supervisor','practicante','administrativo','analista_indicadores') then
    raise exception 'Rol de equipo no permitido.' using errcode='22023'; end if;
  insert into public.prealtas_equipo (email, nombre, rol_codigo, unidad_id, programa_id, creada_por)
  values (lower(btrim(_email)), btrim(_nombre), _rol, _unidad, _programa, v_yo)
  returning id into v_id; return v_id;
end; $$;
revoke all on function public.pasmu_preAlta_equipo(text,text,text,bigint,bigint) from public, anon;
grant execute on function public.pasmu_preAlta_equipo(text,text,text,bigint,bigint) to authenticated;
commit;
