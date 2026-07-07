-- Store the Hyperion customer number on scanned load candidates so the Load
-- Finder can deep-link each load to its shipment profile in Hyperion TMS
-- (same link the Suggestions page builds from shipments.tms_customer_id).
alter table public.tms_load_candidates
  add column if not exists tms_customer_id text;

comment on column public.tms_load_candidates.tms_customer_id is
  'Hyperion customer number, used to build the shipment-profile deep link.';
