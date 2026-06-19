-- Carry GetLoads financials + reference numbers on the candidate so the Load
-- Finder import can seed them onto the shipment (operator-editable thereafter;
-- the live tracking sync never touches these fields).
--   po_ref         <- GetLoads poReference
--   shipper_number <- GetLoads shipperNum
--   billed_amount  <- sum(items[].billed)
--   cost_amount    <- sum(items[].cost)
alter table public.tms_load_candidates
  add column if not exists po_ref         text,
  add column if not exists shipper_number text,
  add column if not exists billed_amount  numeric(12,2),
  add column if not exists cost_amount    numeric(12,2);
