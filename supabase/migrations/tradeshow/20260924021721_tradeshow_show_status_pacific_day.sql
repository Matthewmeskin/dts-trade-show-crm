-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260924021721 "tradeshow_show_status_pacific_day".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- tradeshow.show_status compared show dates against current_date, which is the
-- database session's day: UTC on Supabase. From 5pm Pacific every show whose
-- move-out ended today read "completed", and a show opening tomorrow read
-- "active" an evening early. Take "today" on the company's own calendar.
create or replace function tradeshow.show_status(s tradeshow.shows)
returns tradeshow.show_status
language sql
stable
as $function$
  select case
    when s.archived then 'archived'::tradeshow.show_status
    when d.ends_on is not null and d.today > d.ends_on
      then 'completed'::tradeshow.show_status
    when d.starts_on is not null and d.ends_on is not null
         and d.today >= d.starts_on and d.today <= d.ends_on
      then 'active'::tradeshow.show_status
    else 'upcoming'::tradeshow.show_status
  end
  from (
    select
      (now() at time zone 'America/Los_Angeles')::date as today,
      coalesce(s.advance_warehouse_open, s.direct_to_show_start, s.move_in_start, s.show_start_date) as starts_on,
      coalesce(s.move_out_end, s.show_end_date, s.move_in_end, s.show_start_date, s.move_in_start)   as ends_on
  ) d;
$function$;
