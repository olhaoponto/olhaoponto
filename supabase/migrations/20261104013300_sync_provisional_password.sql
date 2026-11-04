-- Mantém profiles.senha_provisoria alinhado ao user_metadata atualizado pelo Auth.
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
      senha_provisoria = case
        when new.raw_user_meta_data ->> 'senha_provisoria' in ('true', 'false')
          then (new.raw_user_meta_data ->> 'senha_provisoria')::boolean
        else senha_provisoria
      end,
      atualizado_em = now()
  where id = new.id;
  return new;
end;
$$;
