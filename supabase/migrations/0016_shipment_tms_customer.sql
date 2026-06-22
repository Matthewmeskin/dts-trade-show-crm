-- Hyperion customer number for a load, captured from the TMS API alongside the
-- load number (tms_reference_id). Together they form the Hyperion shipment
-- profile URL: /pages/shipments/shipmentprofile/{tms_customer_id}/{tms_reference_id}
alter table public.shipments
  add column if not exists tms_customer_id text;
