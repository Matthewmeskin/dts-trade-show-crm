-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260924185532 "tradeshow_week_before_sent".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- The week-before step on the sales calendar had no done-mark: the email at
-- two weeks has one (emailed_two_weeks), the calling step is implied by the
-- lead-gen start date, but the week-before cutoff could only be looked at,
-- never closed out. Now it can.
alter table tradeshow.shows
  add column if not exists week_before_sent boolean not null default false;

comment on column tradeshow.shows.week_before_sent is
  'Sales calendar: the week-before outreach was done. Marks the last pre-show step complete.';
