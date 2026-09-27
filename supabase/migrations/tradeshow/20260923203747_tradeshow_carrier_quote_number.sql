-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260923203747 "tradeshow_carrier_quote_number".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- The carrier's own quote number, typed in by us. Tradeshow-scoped variant of
-- the CRM repo's 0036_carrier_quote_number.sql.
--
-- Distinct from tms_reference_id, which lib/quote-ref.ts labels "Quote #" while
-- a shipment is still quoted: that is OUR number for the load, the one an
-- exhibitor quotes back and match-load.ts searches. This is the number the
-- CARRIER gave us, and it has to appear on the MHA.
--
-- Manual, because Hyperion does not carry it. Checked against a real Quotes Sync
-- run of 97 quoted loads: carriers[].tariffSelected, carriers[].carrierProNumber
-- and referenceNo were empty on all 97; the only reliably populated reference,
-- shipperNum (80 of 97), is the exhibitor's own booth number.
--
-- Additive and nullable: no default, no backfill, no constraint. Reversed by
-- `alter table tradeshow.shipments drop column carrier_quote_number;`.

-- Guard: this is the tradeshow-scoped variant. Refuse to run if the schema is
-- missing rather than create anything in the wrong place.
do $$
begin
  if to_regclass('tradeshow.shipments') is null then
    raise exception 'Refusing to run: tradeshow.shipments does not exist here.';
  end if;
end $$;

alter table tradeshow.shipments
  add column if not exists carrier_quote_number text;

comment on column tradeshow.shipments.carrier_quote_number is
  'The carrier''s own quote number, entered by hand. Distinct from tms_reference_id, which is DTS''s reference for the load.';
