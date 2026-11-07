-- Status pessoal do dia; não registrar diagnóstico médico nem expor estado a administradores.
create table public.day_statuses (
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  status text not null check (status in ('working', 'rest', 'absence', 'medical_leave')),
  atualizado_em timestamptz not null default now(),
  constraint day_statuses_pkey primary key (user_id, data)
);

create trigger day_statuses_set_updated_at
before update on public.day_statuses
for each row execute function public.set_updated_at();

alter table public.day_statuses enable row level security;
revoke all on public.day_statuses from public, anon;
grant select, insert, update on public.day_statuses to authenticated;

-- This deliberately grants no administrator-wide policy: each authenticated user sees only their own day status.
create policy day_statuses_select_own
on public.day_statuses for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy day_statuses_insert_own
on public.day_statuses for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy day_statuses_update_own
on public.day_statuses for update to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()))
with check (user_id = (select auth.uid()) and (select public.is_active_user()));
