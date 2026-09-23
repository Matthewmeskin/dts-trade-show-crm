-- The carrier's own quote number, typed in by us.
--
-- Not to be confused with tms_reference_id, which lib/quote-ref.ts labels
-- "Quote #" while a shipment is still quoted. That one is OUR number for the
-- load -- the one an exhibitor quotes back and match-load.ts searches. This is
-- the number the CARRIER gave us when they quoted the freight, and it is the
-- one that has to appear on the MHA so the quote can be tied back to the rate
-- it was booked at.
--
-- Manual, because Hyperion does not carry it. Checked against a real Quotes
-- Sync run of 97 quoted loads: carriers[].tariffSelected, carriers[]
-- .carrierProNumber and referenceNo were empty on all 97, and the only reliably
-- populated reference, shipperNum (80 of 97), is the exhibitor's own -- booth
-- numbers, not carrier quotes. If a Hyperion rating endpoint ever exposes it,
-- this column is where it lands and nothing above it has to change.

-- Guard: this migration belongs to the CRM's own database. The DTS operations
-- project carries a COPY of these tables in a `tradeshow` schema, and its
-- public schema is the payables ledger -- running this there would add a column
-- to the wrong shipments table. Fail loudly rather than do that.
do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

alter table public.shipments
  add column if not exists carrier_quote_number text;

comment on column public.shipments.carrier_quote_number is
  'The carrier''s own quote number, entered by hand. Distinct from tms_reference_id, which is DTS''s reference for the load.';
