-- Optional company contact email (distinct from login email for Pro onboarding)
alter table public.profiles add column if not exists company_email text;
