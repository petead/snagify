-- Sub-type for individual accounts: property owner vs tenant (NULL for Pro)
alter table public.profiles
  add column if not exists individual_role text
  check (individual_role is null or individual_role in ('owner', 'tenant'));
