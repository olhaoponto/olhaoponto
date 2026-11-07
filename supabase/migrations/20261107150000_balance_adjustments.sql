-- Ajustes externos do banco de horas: lançamentos assinados e auditáveis por usuário.
-- Esta migração é versionada no repositório e não deve ser aplicada remotamente sem autorização.
create table public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saldo_minutos integer not null check (saldo_minutos <> 0 and saldo_minutos between -60000 and 60000),
  motivo text not null check (char_length(btrim(motivo)) between 3 and 240),
  criado_em timestamptz not null default now()
);

create index balance_adjustments_user_created_idx
  on public.balance_adjustments (user_id, criado_em desc);

alter table public.balance_adjustments enable row level security;
revoke all on public.balance_adjustments from public, anon;
grant select, insert on public.balance_adjustments to authenticated;

create policy balance_adjustments_select_own
  on public.balance_adjustments for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy balance_adjustments_insert_own
  on public.balance_adjustments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_active_user())
    and saldo_minutos <> 0
    and char_length(btrim(motivo)) between 3 and 240
  );
