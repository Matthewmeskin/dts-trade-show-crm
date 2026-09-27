-- =============================================================================
-- DTS Trade Show CRM — 0043 GSC manifest: when it was last sent
--
-- A GSC gets the inbound manifest weekly, then daily in the last week before
-- move-in, then the outbound list daily through teardown. The worklist needs
-- to know when one was last sent for each show the GSC services. Sent by a
-- rep, never automatically.
--
-- Applied live to DTS Database (tradeshow schema variant) 2026-09-27.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

alter table public.partner_shows
  add column if not exists manifest_sent_at timestamptz;
