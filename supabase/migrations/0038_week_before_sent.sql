-- The week-before step on the sales calendar had no done-mark: the email at
-- two weeks has one (emailed_two_weeks), the calling step is implied by the
-- lead-gen start date, but the week-before cutoff could only be looked at,
-- never closed out. Now it can.
--
-- Applied live to DTS Database (tradeshow schema variant) 2026-09-24.

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

alter table public.shows
  add column if not exists week_before_sent boolean not null default false;

comment on column public.shows.week_before_sent is
  'Sales calendar: the week-before outreach was done. Marks the last pre-show step complete.';
