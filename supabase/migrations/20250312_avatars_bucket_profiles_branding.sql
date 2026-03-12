-- Avatars bucket for company logos, avatars, and signature images
-- Public: true, Max 2MB, MIME: image/png, image/jpeg, image/webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Authenticated users can upload only under their own folder: {user_id}/...
create policy "Users can upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Anyone can view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- Profile branding and identity columns
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists whatsapp_number text;
alter table profiles add column if not exists rera_number text;
alter table profiles add column if not exists company_logo_url text;
alter table profiles add column if not exists company_website text;
alter table profiles add column if not exists company_address text;
alter table profiles add column if not exists company_trade_license text;
alter table profiles add column if not exists signature_image_url text;
alter table profiles add column if not exists company_primary_color text;
