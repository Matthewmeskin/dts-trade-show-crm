-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260925032557 "tradeshow_start_call_done".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- "Start calling" (60 days before the show) had no done-mark of its own; the
-- sales calendar inferred it from lead_gen_start_date, but lead gen is the
-- list-building step that happens months earlier, so every show read as
-- "calling started". Calling now has its own mark, like the two emails.
alter table tradeshow.shows
  add column if not exists start_call_done boolean not null default false;

comment on column tradeshow.shows.start_call_done is
  'Sales calendar: calling the exhibitor list has started (due 60 days before the show).';

-- The only safe inference: a show whose two-week or week-before email is
-- already marked sent has been called. Everything else starts unmarked.
update tradeshow.shows
   set start_call_done = true
 where (emailed_two_weeks or week_before_sent) and not start_call_done;
