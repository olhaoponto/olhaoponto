-- Recursos aditivos de comunicação administrativa e convites pessoais.
-- Não altera nem apaga dados existentes de perfis, batidas ou status diários.

create table public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create table public.user_session_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  forced_logout_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.app_broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  message_type text not null default 'announcement'
    check (message_type in ('maintenance', 'update', 'announcement')),
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_broadcast_messages_active_created_idx
on public.app_broadcast_messages (active, created_at desc);

create table public.app_broadcast_receipts (
  message_id uuid not null references public.app_broadcast_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.lunch_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  lunch_at timestamptz not null,
  return_at timestamptz not null,
  message text not null check (char_length(btrim(message)) between 1 and 500),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'unavailable', 'meeting')),
  response_message text check (response_message is null or char_length(btrim(response_message)) <= 500),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint lunch_invites_distinct_users check (sender_id <> recipient_id),
  constraint lunch_invites_return_after_lunch check (return_at > lunch_at)
);

create index lunch_invites_recipient_pending_idx
on public.lunch_invites (recipient_id, status, created_at desc);
create index lunch_invites_sender_created_idx
on public.lunch_invites (sender_id, created_at desc);

create or replace function public.is_active_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_user_id and p.ativo = true
  );
$$;
revoke all on function public.is_active_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_active_profile(uuid) to authenticated;

create or replace function public.heartbeat_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Active authenticated session required.' using errcode = '42501';
  end if;
  insert into public.user_presence (user_id, last_seen_at)
  values (auth.uid(), statement_timestamp())
  on conflict (user_id) do update set last_seen_at = statement_timestamp();
end;
$$;
revoke all on function public.heartbeat_presence() from public, anon, authenticated;
grant execute on function public.heartbeat_presence() to authenticated;

create or replace function public.list_active_colleagues()
returns table(id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome
  from public.profiles p
  where p.ativo = true
    and p.id <> (select auth.uid())
    and (select public.is_active_user())
  order by p.nome
  limit 200;
$$;
revoke all on function public.list_active_colleagues() from public, anon, authenticated;
grant execute on function public.list_active_colleagues() to authenticated;

create or replace function public.list_my_lunch_invites()
returns table(
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  sender_name text,
  recipient_name text,
  lunch_at timestamptz,
  return_at timestamptz,
  message text,
  status text,
  response_message text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.sender_id, i.recipient_id,
         coalesce(s.nome, 'Colega'), coalesce(r.nome, 'Colega'),
         i.lunch_at, i.return_at, i.message, i.status, i.response_message,
         i.created_at, i.responded_at
  from public.lunch_invites i
  left join public.profiles s on s.id = i.sender_id
  left join public.profiles r on r.id = i.recipient_id
  where (i.sender_id = (select auth.uid()) or i.recipient_id = (select auth.uid()))
    and (select public.is_active_user())
  order by i.created_at desc
  limit 50;
$$;
revoke all on function public.list_my_lunch_invites() from public, anon, authenticated;
grant execute on function public.list_my_lunch_invites() to authenticated;

alter table public.user_presence enable row level security;
revoke all on public.user_presence from public, anon, authenticated;
grant select on public.user_presence to authenticated;
create policy user_presence_select_own
on public.user_presence for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));

alter table public.user_session_controls enable row level security;
revoke all on public.user_session_controls from public, anon, authenticated;
grant select on public.user_session_controls to authenticated;
create policy user_session_controls_select_own
on public.user_session_controls for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));

alter table public.app_broadcast_messages enable row level security;
revoke all on public.app_broadcast_messages from public, anon;
grant select, insert, update, delete on public.app_broadcast_messages to authenticated;
create policy app_broadcast_messages_active_read
on public.app_broadcast_messages for select to authenticated
using ((select public.is_active_user()) and active = true);
create policy app_broadcast_messages_admin_manage
on public.app_broadcast_messages for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

alter table public.app_broadcast_receipts enable row level security;
revoke all on public.app_broadcast_receipts from public, anon;
grant select, insert on public.app_broadcast_receipts to authenticated;
create policy app_broadcast_receipts_select_own
on public.app_broadcast_receipts for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy app_broadcast_receipts_insert_own
on public.app_broadcast_receipts for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.is_active_user()));

alter table public.lunch_invites enable row level security;
revoke all on public.lunch_invites from public, anon;
grant select, insert on public.lunch_invites to authenticated;
grant update (status, response_message, responded_at) on public.lunch_invites to authenticated;
create policy lunch_invites_select_participants
on public.lunch_invites for select to authenticated
using ((select public.is_active_user()) and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())));
create policy lunch_invites_insert_sender
on public.lunch_invites for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and (select public.is_active_user())
  and (select public.is_active_profile(recipient_id))
);
create policy lunch_invites_update_recipient_once
on public.lunch_invites for update to authenticated
using (recipient_id = (select auth.uid()) and status = 'pending' and (select public.is_active_user()))
with check (
  recipient_id = (select auth.uid())
  and status in ('accepted', 'unavailable', 'meeting')
  and (select public.is_active_user())
);
