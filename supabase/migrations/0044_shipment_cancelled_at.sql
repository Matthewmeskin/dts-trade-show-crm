-- =============================================================================
-- DTS Trade Show CRM — 0044 Cancelled shipments
-- The shipment_status enum has no "cancelled" state, and a load cancelled in
-- the TMS after it was booked otherwise stays frozen as booked (still on the
-- calendar). This marks cancellation without an enum change: cancelled_at is
-- set by the sync when the TMS reports the load Cancelled, and cleared if it
-- reactivates. Active views (calendar) hide rows where cancelled_at is set;
-- the shipment record is kept with a "Cancelled" badge. Run AFTER 0043.
-- =============================================================================

alter table public.shipments
  add column if not exists cancelled_at timestamptz;

create index if not exists shipments_cancelled_at_idx on public.shipments (cancelled_at);
