-- Ranking opcional da equipe.
-- Aplicar somente após revisão e confirmação explícita.
-- Não executar automaticamente nem fazer deploy de Edge Function nesta etapa.

alter table public.profiles
  add column if not exists equipe_id uuid,
  add column if not exists ranking_participa boolean not null default false,
  add column if not exists ranking_apelido text,
  add column if not exists ranking_aceite_em timestamptz;

alter table public.profiles drop constraint if exists profiles_ranking_apelido_chk;
alter table public.profiles add constraint profiles_ranking_apelido_chk
  check (ranking_apelido is null or ranking_apelido ~ '^[A-Za-zÀ-ÿ0-9 ._-]{2,20}$');
alter table public.profiles drop constraint if exists profiles_ranking_participa_chk;
alter table public.profiles add constraint profiles_ranking_participa_chk
  check (not ranking_participa or ranking_apelido is not null);
create unique index if not exists profiles_ranking_apelido_uniq
  on public.profiles (equipe_id, lower(ranking_apelido)) where ranking_participa;

do $$
declare v_admin_count integer; v_admin uuid;
begin
  select count(*), min(id) into v_admin_count, v_admin from public.profiles where role = 'admin' and ativo;
  if v_admin_count = 1 then
    update public.profiles set equipe_id = v_admin where equipe_id is null;
    update public.profiles set equipe_id = id where id = v_admin;
  elsif v_admin_count > 1 then
    raise exception 'Há mais de um administrador ativo; defina manualmente as equipes antes do backfill.';
  end if;
end $$;

-- Somente as três preferências do ranking podem ser alteradas pelo cliente.
grant update (ranking_participa, ranking_apelido, ranking_aceite_em) on public.profiles to authenticated;

create or replace function public.ranking_equipe(p_periodo text default 'semana')
returns table (posicao int, apelido text, pecas int, quebra_cabecas int, eh_voce boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_equipe uuid; v_inicio timestamptz;
begin
  if p_periodo not in ('semana', 'geral') then raise exception 'Período inválido'; end if;
  select equipe_id into v_equipe from public.profiles where id = v_uid and ativo and ranking_participa;
  if v_equipe is null then return; end if;
  v_inicio := case when p_periodo = 'semana'
    then date_trunc('week', now() at time zone 'America/Bahia') at time zone 'America/Bahia'
    else '-infinity'::timestamptz end;
  return query
  with base as (
    select p.id, p.ranking_apelido,
      count(jp.id)::int as pecas,
      (select count(*)::int from public.jornada_niveis n where n.usuario_id=p.id and n.concluido_em is not null and n.concluido_em >= v_inicio) as qc,
      max(jp.encaixada_em) as ultima
    from public.profiles p left join public.jornada_pecas jp
      on jp.usuario_id=p.id and jp.encaixada and jp.encaixada_em >= v_inicio
      and (jp.origem='bonus' or exists (select 1 from public.time_entries te where te.id=jp.batida_id and not te.horario_informado_manual))
    where p.equipe_id=v_equipe and p.ativo and p.ranking_participa
    group by p.id,p.ranking_apelido
  ), ord as (
    select b.*, row_number() over(order by b.pecas desc,b.ultima asc nulls last,lower(b.ranking_apelido)) as pos from base b
  )
  select o.pos::int,o.ranking_apelido,o.pecas,o.qc,(o.id=v_uid) from ord o
  where o.pos <= 5 or o.id=v_uid order by o.pos;
end $$;
revoke all on function public.ranking_equipe(text) from public, anon;
grant execute on function public.ranking_equipe(text) to authenticated;

-- Reversão manual (após avaliar dependências):
-- revoke execute on function public.ranking_equipe(text) from authenticated;
-- drop function if exists public.ranking_equipe(text);
-- drop index if exists public.profiles_ranking_apelido_uniq;
-- alter table public.profiles drop column if exists ranking_aceite_em, drop column if exists ranking_apelido,
--   drop column if exists ranking_participa, drop column if exists equipe_id;
