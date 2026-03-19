-- Create the "inspection-photos" bucket as PUBLIC so photo URLs work without auth.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspection-photos',
  'inspection-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Agents can upload inspection photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inspection-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Anyone can view inspection photos"
on storage.objects for select
to public
using (bucket_id = 'inspection-photos');
