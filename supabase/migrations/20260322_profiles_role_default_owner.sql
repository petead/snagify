-- profile.role = job relationship (owner | agent | inspector), not subscription tier
-- profile.account_type = subscription tier (individual | pro)
alter table public.profiles add column if not exists account_type text;
update public.profiles set account_type = coalesce(account_type, 'individual') where account_type is null;
alter table public.profiles alter column account_type set default 'individual';

alter table public.profiles
  alter column role set default 'owner';

-- Auth trigger: new self-serve signups default to owner (not agent)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'owner');
  return new;
end;
$$;
