-- Repoth: open the database up for the demo.
--
-- A FRESH CLONE DOES NOT NEED THIS FILE. 01 and 02 now create the open posture
-- directly. This exists to migrate a database that already ran the original
-- locked-down 01/02, which is the case for the project's own Supabase.
--
-- It replaces that locked-down posture with an open one, so the publishable
-- key alone can read AND write and no secret key has to exist anywhere.
--
-- This is a deliberate tradeoff, made because the board holds no private data
-- and anyone testing the app must be able to run it end to end. Anyone who
-- finds the publishable key can also insert, edit and delete rows here.
--
-- IMPORTANT, and the reason this file is not just a list of DROP POLICY lines:
-- Postgres RLS denies by default. Dropping every policy while RLS is still
-- ENABLED does not open the table, it seals it completely. The table must be
-- taken out of RLS, not merely stripped of its rules.

-- ---------------------------------------------------------------------------
-- 1. reports: take the table out of RLS entirely.
-- ---------------------------------------------------------------------------
drop policy if exists "reports are publicly readable" on public.reports;

alter table public.reports disable row level security;

-- The anon and authenticated roles still need table privileges. RLS was the
-- gate, but GRANTs are the lock behind it, and PostgREST honours both.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.reports to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. report-photos: storage.objects belongs to Supabase, not to you, so RLS
--    cannot be disabled on it. Open policies are the equivalent, scoped to
--    this one bucket so nothing else in storage is affected.
-- ---------------------------------------------------------------------------
drop policy if exists "report photos are publicly readable" on storage.objects;
drop policy if exists "report photos are open" on storage.objects;

create policy "report photos are open"
  on storage.objects for all
  to anon, authenticated
  using (bucket_id = 'report-photos')
  with check (bucket_id = 'report-photos');

-- ---------------------------------------------------------------------------
-- 3. Confirm. Expect: rls_enabled = false, policies = 0, storage_policies = 1.
-- ---------------------------------------------------------------------------
select 'rls_enabled'      as check, relrowsecurity::text as result
  from pg_class where oid = 'public.reports'::regclass
union all
select 'policies_on_reports', count(*)::text
  from pg_policies where schemaname = 'public' and tablename = 'reports'
union all
select 'storage_policies', count(*)::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'report photos are open'
union all
select 'anon_can_insert',
       has_table_privilege('anon', 'public.reports', 'INSERT')::text;
