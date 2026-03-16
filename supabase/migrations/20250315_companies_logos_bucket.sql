-- Companies table (agency branding)
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text,
  logo_url text,
  website text,
  primary_color text not null default '#9A88FD',
  address text,
  trade_license text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;

-- RLS: profiles unchanged (additive only). Companies: read all for authenticated, update own.
alter table public.companies enable row level security;

create policy "Authenticated can read companies"
  on public.companies for select
  to authenticated
  using (true);

create policy "Authenticated can insert companies"
  on public.companies for insert
  to authenticated
  with check (true);

create policy "Users can update own company"
  on public.companies for update
  to authenticated
  using (
    id in (select company_id from public.profiles where id = auth.uid() and company_id is not null)
  );

-- Storage: logos bucket (public, 5MB, image MIME)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Authenticated users can upload to logos/{their user id}/*
create policy "Users can upload to own logos folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read on logos
create policy "Anyone can view logos"
  on storage.objects for select
  to public
  using (bucket_id = 'logos');
