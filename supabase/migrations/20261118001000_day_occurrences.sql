create table public.day_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  motivo text not null check (motivo in ('Pessoal', 'Saúde', 'Trabalho externo', 'Outro')),
  occurred_at timestamptz not null,
  observacao text,
  debito_minutos integer not null check (debito_minutos >= 0),
  created_at timestamptz not null default now(),
  constraint day_occurrences_user_date_key unique (user_id, work_date)
);

alter table public.day_occurrences enable row level security;
revoke all on public.day_occurrences from public, anon;
grant select, insert, update, delete on public.day_occurrences to authenticated;

create policy day_occurrences_select_own on public.day_occurrences for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy day_occurrences_insert_own on public.day_occurrences for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy day_occurrences_update_own on public.day_occurrences for update to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()))
with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy day_occurrences_delete_own on public.day_occurrences for delete to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));
