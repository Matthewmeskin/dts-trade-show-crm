-- Capture the customer (exhibitor) name from Hyperion GetLoads at scan time.
-- The live tracking feed used on import omits the customer name, so without
-- this the Load Finder can't find-or-create the exhibitor when a candidate is
-- imported. GetLoads carries `customerName` directly, so we record it here.
alter table public.tms_load_candidates
  add column if not exists customer_name text;
