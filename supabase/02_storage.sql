-- Repoth: photo storage.
-- Run after 01_schema.sql.
--
-- Photos currently land in server/photos/ on the laptop's disk, which means
-- they vanish the moment the laptop does. This moves them to a Supabase bucket
-- so an attachment outlives the demo machine.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  true,                                   -- public read; the URL is the photo column
  10485760,                               -- 10 MB ceiling. The app already uploads at quality 0.5.
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Open, matching the reports table. storage.objects belongs to Supabase, so
-- RLS cannot be disabled on it; a permissive policy scoped to this one bucket
-- is the equivalent and leaves the rest of storage alone.
drop policy if exists "report photos are publicly readable" on storage.objects;
drop policy if exists "report photos are open" on storage.objects;
create policy "report photos are open"
  on storage.objects for all
  to anon, authenticated
  using (bucket_id = 'report-photos')
  with check (bucket_id = 'report-photos');
