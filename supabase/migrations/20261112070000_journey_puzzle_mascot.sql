-- Jornada de boas práticas: níveis, peças persistentes e mensagens do mascote.
-- Aplicar somente após revisão e confirmação.

create table if not exists public.jornada_niveis (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nivel integer not null check (nivel >= 1),
  imagem_id text not null,
  pecas_total integer not null default 0 check (pecas_total >= 0 and pecas_total <= 20),
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, nivel)
);

create table if not exists public.jornada_pecas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nivel integer not null check (nivel >= 1),
  indice integer not null check (indice between 0 and 19),
  origem text not null check (origem in ('entrada', 'saida_almoco', 'volta_almoco', 'saida_final', 'bonus')),
  data date not null,
  batida_id uuid references public.time_entries(id) on delete set null,
  encaixada boolean not null default false,
  encaixada_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (usuario_id, data, origem),
  unique (usuario_id, nivel, indice)
);

create table if not exists public.mensagens_mascote (
  id text primary key,
  texto text not null check (char_length(texto) between 1 and 140),
  categoria text not null,
  pose text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.jornada_niveis enable row level security;
alter table public.jornada_pecas enable row level security;
alter table public.mensagens_mascote enable row level security;

create policy jornada_niveis_select_own on public.jornada_niveis
  for select using (auth.uid() = usuario_id);
create policy jornada_niveis_insert_own on public.jornada_niveis
  for insert with check (auth.uid() = usuario_id);
create policy jornada_niveis_update_own on public.jornada_niveis
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

create policy jornada_pecas_select_own on public.jornada_pecas
  for select using (auth.uid() = usuario_id);
create policy jornada_pecas_insert_own on public.jornada_pecas
  for insert with check (auth.uid() = usuario_id);
create policy jornada_pecas_update_own on public.jornada_pecas
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

create policy mensagens_mascote_select_active on public.mensagens_mascote
  for select using (auth.role() = 'authenticated' and ativo = true);

create index if not exists jornada_pecas_usuario_nivel_idx
  on public.jornada_pecas (usuario_id, nivel, encaixada, indice);
create index if not exists jornada_niveis_usuario_nivel_idx
  on public.jornada_niveis (usuario_id, nivel);
create index if not exists mensagens_mascote_active_idx
  on public.mensagens_mascote (ativo, categoria);
