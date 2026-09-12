-- Repoth: sanity checks. Run after 01 and 02. Every row should read as expected.

select 'table exists'      as check, count(*)::text as result
  from information_schema.tables
 where table_schema = 'public' and table_name = 'reports'
union all
select 'rls enabled',      relrowsecurity::text
  from pg_class where oid = 'public.reports'::regclass
union all
select 'select policies',  count(*)::text
  from pg_policies where schemaname = 'public' and tablename = 'reports'
union all
select 'in realtime pub',  count(*)::text
  from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
union all
select 'photo bucket',     count(*)::text
  from storage.buckets where id = 'report-photos'
union all
select 'rows in reports',  count(*)::text from public.reports;
