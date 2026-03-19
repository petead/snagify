-- Public bucket for inspector profile signatures (path: {userId}/signature.png)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signatures',
  'signatures',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- First path segment must be the authenticated user's id
drop policy if exists "Users can upload own signatures storage" on storage.objects;
drop policy if exists "Users can update own signatures storage" on storage.objects;
drop policy if exists "Users can delete own signatures storage" on storage.objects;
drop policy if exists "Anyone can view signatures storage" on storage.objects;

create policy "Users can upload own signatures storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own signatures storage"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own signatures storage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view signatures storage"
  on storage.objects for select
  to public
  using (bucket_id = 'signatures');
