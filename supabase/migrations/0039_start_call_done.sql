-- "Start calling" (60 days before the show) had no done-mark of its own; the
-- sales calendar inferred it from lead_gen_start_date, but lead gen is the
-- list-building step that happens months earlier, so every show read as
-- "calling started". Calling now has its own mark, like the two emails.
--
-- Applied live to DTS Database (tradeshow schema variant) 2026-09-25.

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

alter table public.shows
  add column if not exists start_call_done boolean not null default false;

comment on column public.shows.start_call_done is
  'Sales calendar: calling the exhibitor list has started (due 60 days before the show).';

-- The only safe inference: a show whose two-week or week-before email is
-- already marked sent has been called. Everything else starts unmarked.
update public.shows
   set start_call_done = true
 where (emailed_two_weeks or week_before_sent) and not start_call_done;
