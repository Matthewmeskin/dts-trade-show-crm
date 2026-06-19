-- Per-shipment financials and trade-show reference numbers.
--   billed_amount  -- revenue billed to the customer/exhibitor
--   cost_amount    -- carrier cost
--   margin         -- billed - cost, computed (generated column, never written)
--   po_ref         -- exhibitor / show purchase-order reference
--   shipper_number -- shipper's own reference number
-- All operator-owned except `margin`, which Postgres maintains automatically.
alter table public.shipments
  add column if not exists billed_amount  numeric(12,2),
  add column if not exists cost_amount    numeric(12,2),
  add column if not exists margin         numeric(12,2)
    generated always as (billed_amount - cost_amount) stored,
  add column if not exists po_ref         text,
  add column if not exists shipper_number text;
