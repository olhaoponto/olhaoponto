-- Olha o Ponto: schema inicial, isolamento de dados e regras de integridade.
-- Todas as datas civis representam America/Bahia; registrado_em permanece timestamptz/UTC.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  ativo boolean not null default true,
  senha_provisoria boolean not null default false,
  aceite_termos_em timestamptz,
  aceite_termos_versao text,
  almoco_minutos integer not null default 60 check (almoco_minutos between 0 and 480),
  limite_minutos integer not null default 600 check (limite_minutos between 1 and 600),
  fuso text not null default 'America/Bahia',
  preferencias_alerta jsonb not null default '{"alerta_8h":true,"alerta_9h":true,"alerta_9h30":true,"alerta_9h45":true,"alerta_9h50":true,"alerta_9h55":true,"som":true,"vibracao":true}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('entrada', 'saida_almoco', 'volta_almoco', 'saida')),
  registrado_em timestamptz not null,
  horario_informado_manual boolean not null default false,
  editado boolean not null default false,
  justificativa text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint time_entries_one_type_per_day unique (user_id, data, tipo)
);

create index time_entries_user_data_idx on public.time_entries (user_id, data, registrado_em);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.ativo = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.ativo = true
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_user() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, email, role, ativo, senha_provisoria)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), ''),
    coalesce(new.email, ''),
    'user',
    true,
    coalesce((new.raw_user_meta_data ->> 'senha_provisoria')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(new.email, ''),
      nome = coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), nome),
      atualizado_em = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated_profile
after update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_profile();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger time_entries_set_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

-- Valida cronologia, sequência das quatro batidas, fuso/data, futuro e limite diário,
-- incluindo inserções concorrentes e edições manuais.
create or replace function public.validate_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text[] := array['entrada', 'saida_almoco', 'volta_almoco', 'saida'];
  v_types text[];
  v_times timestamptz[];
  v_count integer;
  v_i integer;
  v_work_seconds numeric := 0;
begin
  if new.registrado_em > statement_timestamp() then
    raise exception 'Não é permitido registrar uma batida em horário futuro.' using errcode = '23514';
  end if;

  if new.data <> (new.registrado_em at time zone 'America/Bahia')::date then
    raise exception 'A data da batida não corresponde ao horário local America/Bahia.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.data::text, 0));

  if tg_op = 'UPDATE' then
    select array_agg(x.tipo order by x.registrado_em, x.tipo),
           array_agg(x.registrado_em order by x.registrado_em, x.tipo)
      into v_types, v_times
    from (
      select e.tipo, e.registrado_em
      from public.time_entries e
      where e.user_id = new.user_id and e.data = new.data and e.id <> old.id
      union all
      select new.tipo, new.registrado_em
    ) x;
  else
    select array_agg(x.tipo order by x.registrado_em, x.tipo),
           array_agg(x.registrado_em order by x.registrado_em, x.tipo)
      into v_types, v_times
    from (
      select e.tipo, e.registrado_em
      from public.time_entries e
      where e.user_id = new.user_id and e.data = new.data
      union all
      select new.tipo, new.registrado_em
    ) x;
  end if;

  v_count := coalesce(array_length(v_types, 1), 0);
  if v_count = 0 or v_count > 4 then
    raise exception 'Sequência de batidas inválida.' using errcode = '23514';
  end if;

  for v_i in 1..v_count loop
    if v_types[v_i] <> v_expected[v_i] then
      raise exception 'Registre as batidas na ordem: Entrada, Saída para almoço, Volta do almoço e Saída.' using errcode = '23514';
    end if;
    if v_i > 1 and v_times[v_i] <= v_times[v_i - 1] then
      raise exception 'As batidas precisam estar em ordem cronológica estrita.' using errcode = '23514';
    end if;
  end loop;

  if v_count >= 2 then
    v_work_seconds := v_work_seconds + extract(epoch from (v_times[2] - v_times[1]));
  end if;
  if v_count = 4 then
    v_work_seconds := v_work_seconds + extract(epoch from (v_times[4] - v_times[3]));
  end if;
  if v_work_seconds > 36000 then
    raise exception 'A batida excederia o limite diário de 10:00 horas trabalhadas.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger time_entries_validate_before_write
before insert or update on public.time_entries
for each row execute function public.validate_time_entry();

alter table public.profiles enable row level security;
alter table public.time_entries enable row level security;

revoke all on public.profiles from public, anon;
revoke all on public.time_entries from public, anon;
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (nome, almoco_minutos, limite_minutos, fuso, preferencias_alerta, aceite_termos_em, aceite_termos_versao, atualizado_em) on public.profiles to authenticated;
grant select, insert, delete on public.time_entries to authenticated;
grant update (registrado_em, horario_informado_manual, editado, justificativa, atualizado_em) on public.time_entries to authenticated;
grant execute on function public.validate_time_entry() to authenticated;

create policy profiles_select_own_or_admin
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select public.is_active_user()))
with check (id = (select auth.uid()) and (select public.is_active_user()));

create policy time_entries_select_own
on public.time_entries for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy time_entries_insert_own
on public.time_entries for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy time_entries_update_own
on public.time_entries for update to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()))
with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy time_entries_delete_own
on public.time_entries for delete to authenticated
using (user_id = (select auth.uid()) and (select public.is_active_user()));

revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.sync_auth_user_profile() from public;
revoke all on function public.set_updated_at() from public;
