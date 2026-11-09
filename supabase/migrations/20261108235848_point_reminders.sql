-- Lembretes internos de registro de ponto entre colegas ativos.
-- Não altera batidas, status diários ou convites de almoço.

create table public.point_reminders (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'acknowledged')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  constraint point_reminders_distinct_users check (sender_id <> recipient_id)
);

create index point_reminders_recipient_status_idx
on public.point_reminders (recipient_id, status, created_at desc);
create index point_reminders_sender_created_idx
on public.point_reminders (sender_id, created_at desc);

create or replace function public.list_my_point_reminders()
returns table(
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  sender_name text,
  recipient_name text,
  message text,
  status text,
  created_at timestamptz,
  acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.sender_id, r.recipient_id,
         coalesce(s.nome, 'Colega'), coalesce(p.nome, 'Colega'),
         r.message, r.status, r.created_at, r.acknowledged_at
  from public.point_reminders r
  left join public.profiles s on s.id = r.sender_id
  left join public.profiles p on p.id = r.recipient_id
  where (r.sender_id = (select auth.uid()) or r.recipient_id = (select auth.uid()))
    and (select public.is_active_user())
  order by r.created_at desc
  limit 50;
$$;
revoke all on function public.list_my_point_reminders() from public, anon, authenticated;
grant execute on function public.list_my_point_reminders() to authenticated;

alter table public.point_reminders enable row level security;
revoke all on public.point_reminders from public, anon;
grant select, insert on public.point_reminders to authenticated;
grant update (status, acknowledged_at) on public.point_reminders to authenticated;

create policy point_reminders_select_participants
on public.point_reminders for select to authenticated
using ((select public.is_active_user()) and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())));

create policy point_reminders_insert_sender
on public.point_reminders for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and (select public.is_active_user())
  and (select public.is_active_profile(recipient_id))
);

create policy point_reminders_acknowledge_recipient
on public.point_reminders for update to authenticated
using (recipient_id = (select auth.uid()) and status = 'pending' and (select public.is_active_user()))
with check (recipient_id = (select auth.uid()) and status = 'acknowledged' and (select public.is_active_user()));
