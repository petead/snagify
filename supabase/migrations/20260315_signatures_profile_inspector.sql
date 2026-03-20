-- Pro inspector signature stored per user, not per inspection (optional; route falls back to profiles.signature_image_url)
alter table public.signatures add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.signatures add column if not exists signature_url text;

-- Profile-level rows have no inspection
alter table public.signatures alter column inspection_id drop not null;

create unique index if not exists signatures_one_profile_sig_per_user
  on public.signatures (user_id)
  where inspection_id is null and user_id is not null;
