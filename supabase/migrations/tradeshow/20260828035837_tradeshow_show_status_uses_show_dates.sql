-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260828035837 "tradeshow_show_status_uses_show_dates".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- show_status ignored show_start_date/show_end_date, so a show with only show
-- dates (no freight dates) stayed "upcoming" forever. Fall back to the show run
-- when the freight window isn't set.
create or replace function tradeshow.show_status(s tradeshow.shows)
returns tradeshow.show_status
language sql
stable
as $$
  select case
    when s.archived then 'archived'::tradeshow.show_status
    when d.ends_on is not null and current_date > d.ends_on
      then 'completed'::tradeshow.show_status
    when d.starts_on is not null and d.ends_on is not null
         and current_date >= d.starts_on and current_date <= d.ends_on
      then 'active'::tradeshow.show_status
    else 'upcoming'::tradeshow.show_status
  end
  from (
    select
      coalesce(s.advance_warehouse_open, s.direct_to_show_start, s.move_in_start, s.show_start_date) as starts_on,
      coalesce(s.move_out_end, s.show_end_date, s.move_in_end, s.show_start_date, s.move_in_start)   as ends_on
  ) d;
$$;
