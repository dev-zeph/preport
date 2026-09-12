-- Repoth: the audit trail behind the detail panel's "Trail" section.
--
-- The design shows a running list of what happened to a report and when. We had
-- nowhere to record that: the table carried only the current status, so the
-- panel could either be left out or filled with invented timestamps. One column
-- makes it real.
--
-- Shape: [{ "at": "2026-09-12T13:40:00.000Z", "what": "Reported by a resident" }, ...]

alter table public.reports
  add column if not exists trail jsonb not null default '[]'::jsonb;

-- Backfill the one event we genuinely know for every existing row: when it came
-- in. Nothing is invented for the status changes we did not observe.
update public.reports
   set trail = jsonb_build_array(
         jsonb_build_object(
           'at', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'what', case source
                     when 'hrm_import' then 'Imported from the HRM service request feed'
                     when 'text' then 'Reported by a resident, typed'
                     else 'Reported by a resident, by voice'
                   end
         )
       )
 where trail = '[]'::jsonb;

select 'rows with a trail' as check, count(*)::text as result
  from public.reports where jsonb_array_length(trail) > 0;
