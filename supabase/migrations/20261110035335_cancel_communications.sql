-- Permite ao remetente cancelar comunicações pendentes sem apagar o histórico.

alter table public.lunch_invites drop constraint lunch_invites_status_check;
alter table public.lunch_invites add constraint lunch_invites_status_check check (status in ('pending', 'accepted', 'unavailable', 'meeting', 'cancelled'));
grant update (status, response_message, responded_at) on public.lunch_invites to authenticated;
create policy lunch_invites_cancel_sender
on public.lunch_invites for update to authenticated
using (sender_id = (select auth.uid()) and status = 'pending' and (select public.is_active_user()))
with check (sender_id = (select auth.uid()) and status = 'cancelled' and (select public.is_active_user()));

alter table public.point_reminders drop constraint point_reminders_status_check;
alter table public.point_reminders add constraint point_reminders_status_check check (status in ('pending', 'acknowledged', 'cancelled'));
grant update (status, acknowledged_at) on public.point_reminders to authenticated;
create policy point_reminders_cancel_sender
on public.point_reminders for update to authenticated
using (sender_id = (select auth.uid()) and status = 'pending' and (select public.is_active_user()))
with check (sender_id = (select auth.uid()) and status = 'cancelled' and (select public.is_active_user()));
