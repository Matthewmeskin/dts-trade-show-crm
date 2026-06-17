-- =============================================================================
-- DTS Trade Show CRM — 0005 Actual show dates
-- The existing date columns are all FREIGHT dates (advance warehouse, move-in,
-- move-out, direct-to-show). Add the actual show run — the days the show is
-- open to attendees — which is distinct from the freight logistics window.
-- =============================================================================

alter table public.shows
  add column if not exists show_start_date date,
  add column if not exists show_end_date date;

-- shows_with_status is `select s.*, ...`, whose * was expanded at creation time,
-- so it doesn't pick up the new columns automatically. Recreate it. (CREATE OR
-- REPLACE can't insert columns before the trailing `status` column, so drop +
-- create, then re-apply security_invoker and grants.)
drop view if exists public.shows_with_status;
create view public.shows_with_status as
  select s.*, public.show_status(s) as status
  from public.shows s;
alter view public.shows_with_status set (security_invoker = true);
grant select on public.shows_with_status to authenticated, service_role;
