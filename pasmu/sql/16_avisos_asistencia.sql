-- 16: avisos cita + autoevaluaciones. Solo PRUEBAS. Sin SMTP real aún.
begin;
create table if not exists public.avisos_cita (
  id bigserial primary key, agenda_id bigint not null references public.agenda(id) on delete cascade,
  canal text not null check (canal in ('correo','whatsapp','ninguno')),
  estado text not null default 'pendiente' check (estado in ('pendiente','enviado','fallido','omitido')),
  detalle text, creada_en timestamptz not null default now());
create table if not exists public.autoevaluaciones_resultados (
  id bigserial primary key, caso_id bigint not null references public.casos(id) on delete cascade,
  instrumento text not null check (instrumento in ('estres','procrastinacion','rumiacion','ansiedad','animo','otro')),
  puntaje numeric, respuestas jsonb,
  aplicada_en timestamptz not null default now(),
  aplicada_por uuid references public.personas(id) on delete set null);
alter table public.avisos_cita enable row level security;
alter table public.autoevaluaciones_resultados enable row level security;
revoke all on table public.avisos_cita, public.autoevaluaciones_resultados from public, anon, authenticated;

-- RPC programar aviso: solo con permiso agenda + sin PII en detalle.
create or replace function public.pasmu_aviso_programar(_agenda bigint, _canal text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_caso bigint; v_unidad bigint; v_id bigint;
begin
  select caso_id into v_caso from public.agenda where id = _agenda;
  if v_caso is null then raise exception 'Cita inexistente.' using errcode='22023'; end if;
  select unidad_id into v_unidad from public.casos where id = v_caso;
  if not private.pasmu_has_permission('agenda.programar', v_unidad) then
    raise exception 'Sin permiso.' using errcode='42501'; end if;
  if _canal not in ('correo','whatsapp','ninguno') then
    raise exception 'Canal inválido.' using errcode='22023'; end if;
  insert into public.avisos_cita (agenda_id, canal) values (_agenda, _canal)
  returning id into v_id; return v_id;
end; $$;
revoke all on function public.pasmu_aviso_programar(bigint, text) from public, anon;
grant execute on function public.pasmu_aviso_programar(bigint, text) to authenticated;
commit;
