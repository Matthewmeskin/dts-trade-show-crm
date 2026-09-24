-- show_status compared show dates against current_date, which is the database
-- session's day: UTC on Supabase. From 5pm Pacific every show whose move-out
-- ended today read "completed", and a show opening tomorrow read "active" an
-- evening early -- the same off-by-a-day that put evening pickups on the wrong
-- calendar square. Take "today" on the company's own calendar instead.
--
-- Applied live to DTS Database (`tradeshow` schema variant) on 2026-09-23.

-- Guard: this migration belongs to the CRM's own database. The DTS operations
-- project carries a COPY of these tables in a `tradeshow` schema, and its
-- public schema is the payables ledger -- fail loudly rather than touch it.
do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

create or replace function public.show_status(s public.shows)
returns public.show_status
language sql
stable
as $$
  select case
    when s.archived then 'archived'::public.show_status
    when d.ends_on is not null and d.today > d.ends_on
      then 'completed'::public.show_status
    when d.starts_on is not null and d.ends_on is not null
         and d.today >= d.starts_on and d.today <= d.ends_on
      then 'active'::public.show_status
    else 'upcoming'::public.show_status
  end
  from (
    select
      (now() at time zone 'America/Los_Angeles')::date as today,
      coalesce(s.advance_warehouse_open, s.direct_to_show_start, s.move_in_start, s.show_start_date) as starts_on,
      coalesce(s.move_out_end, s.show_end_date, s.move_in_end, s.show_start_date, s.move_in_start)   as ends_on
  ) d;
$$;
