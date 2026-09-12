-- Repoth: reports table.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Mirrors the flat record in server/store.js exactly. One record type, no joins.
-- Enums are duplicated from constants.js. If you change one, change both.

create table if not exists public.reports (
  id              text primary key,                       -- "rpt_" + nanoid(12)
  created_at      timestamptz not null default now(),
  status          text not null default 'new'
                    check (status in ('new','acknowledged','assigned','resolved')),
  source          text not null default 'voice'
                    check (source in ('voice','text','hrm_import')),

  -- Location is never guessed. An unmatched street stores nulls here and the
  -- UI renders "location not mapped". See server/geocode.js.
  location_text   text,
  landmark        text,
  district        text,
  lat             double precision,
  lng             double precision,
  geocode_method  text not null default 'none'
                    check (geocode_method in ('lookup','none','hrm_source')),

  category        text not null default 'other'
                    check (category in ('pothole','blocked_driveway','street_light',
                                        'tree_hazard','sidewalk','flooding','debris',
                                        'signage','graffiti','other')),
  severity        text not null default 'medium'
                    check (severity in ('low','medium','high')),
  safety_risk     boolean not null default false,
  description     text not null,
  language        text not null default 'en',

  -- [{ role: "user" | "assistant", text: "..." }, ...]
  transcript      jsonb not null default '[]'::jsonb,
  -- [{ at: ISO timestamp, what: "Acknowledged by ..." }, ...] the audit trail
  -- behind the detail panel. Appended to, never rewritten.
  trail           jsonb not null default '[]'::jsonb,
  photo           text
);

comment on table public.reports is
  'Resident-filed municipal incident reports. Rows with source=hrm_import are real HRM Cityworks service requests imported as seed data, not synthetic.';

-- The board lists newest first and filters by status. The map reads coordinates.
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_status_idx     on public.reports (status);
create index if not exists reports_district_idx   on public.reports (district);
create index if not exists reports_category_idx   on public.reports (category);

-- ---------------------------------------------------------------------------
-- Access
--
-- This board is open on purpose. It holds no private data, and anyone testing
-- the app has to be able to run it end to end with the publishable key alone,
-- so there is no secret key anywhere in this project.
--
-- The consequence, stated plainly rather than discovered later: anyone who has
-- the publishable key can read, insert, edit and delete rows here. The key
-- ships inside the Expo bundle and the dashboard's JavaScript, so treat it as
-- public. Do not put anything in this table you would not publish.
--
-- Note for anyone tightening this later: Postgres RLS denies by default, so
-- enabling RLS without writing policies seals the table rather than securing
-- it. Enable it and add policies in the same migration.
-- ---------------------------------------------------------------------------
alter table public.reports disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.reports to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime, so the dashboard updates without polling.
-- replica identity full makes UPDATE payloads carry every column, not just the
-- primary key, which is what the board needs to re-render a row in place.
-- ---------------------------------------------------------------------------
alter table public.reports replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.reports;
exception
  when duplicate_object then null;   -- already added, fine to re-run
end $$;
