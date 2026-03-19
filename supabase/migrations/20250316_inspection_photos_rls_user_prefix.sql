-- Enforce first path segment = auth.uid() for inspection-photos uploads
drop policy if exists "Agents can upload inspection photos" on storage.objects;

create policy "Agents can upload inspection photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
