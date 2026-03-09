-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Creates the inspection-photos bucket and policies for upload/view.

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', true)
on conflict (id) do update set name = excluded.name, public = excluded.public;

create policy "Anyone can upload inspection photos"
on storage.objects for insert
with check (bucket_id = 'inspection-photos');

create policy "Anyone can view inspection photos"
on storage.objects for select
using (bucket_id = 'inspection-photos');

-- Inspection reports bucket (private, signed URLs only)
insert into storage.buckets (id, name, public)
values ('inspection-reports', 'inspection-reports', false)
on conflict (id) do update set name = excluded.name, public = excluded.public;

create policy "Authenticated users can upload reports"
on storage.objects for insert
to authenticated
with check (bucket_id = 'inspection-reports');

create policy "Authenticated users can read reports"
on storage.objects for select
to authenticated
using (bucket_id = 'inspection-reports');
