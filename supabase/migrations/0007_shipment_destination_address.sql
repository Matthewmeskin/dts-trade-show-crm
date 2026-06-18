-- Delivery address from Hyperion Global Tracking (deliveryLocation), shown as
-- the shipment's Destination — symmetric with the parsed Origin address.
alter table public.shipments
  add column if not exists destination_address text;
