-- =============================================================================
-- DTS Trade Show CRM — 0045 Show status falls back to the show run
-- show_status only considered FREIGHT dates (advance warehouse, move-in,
-- move-out). A show with just show_start_date/show_end_date and no freight
-- window could never satisfy the "completed" or "active" tests, so it stayed
-- "Upcoming" forever — e.g. SUPERZOO 2026 (Aug 12–14) still showing Upcoming
-- weeks later. Fall back to the show run when the freight dates are absent.
-- Run AFTER 0044.
-- =============================================================================

create or replace function public.show_status(s public.shows)
returns public.show_status
language sql
stable
as $$
  select case
    when s.archived then 'archived'::public.show_status
    when d.ends_on is not null and current_date > d.ends_on
      then 'completed'::public.show_status
    when d.starts_on is not null and d.ends_on is not null
         and current_date >= d.starts_on and current_date <= d.ends_on
      then 'active'::public.show_status
    else 'upcoming'::public.show_status
  end
  from (
    select
      coalesce(s.advance_warehouse_open, s.direct_to_show_start, s.move_in_start, s.show_start_date) as starts_on,
      coalesce(s.move_out_end, s.show_end_date, s.move_in_end, s.show_start_date, s.move_in_start)   as ends_on
  ) d;
$$;
