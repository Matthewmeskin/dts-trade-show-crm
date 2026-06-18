-- Freight detail fields populated from Hyperion Global Tracking:
--   package_type  <- packaging      (e.g. "Bundles", "Pallets", "FTL")
--   tracking_url  <- carrierTrackingURL (carrier's external tracking page)
alter table public.shipments
  add column if not exists package_type text,
  add column if not exists tracking_url text;
