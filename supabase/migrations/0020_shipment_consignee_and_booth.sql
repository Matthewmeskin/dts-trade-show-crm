-- Structured consignee (the load's delivery party / move-out return address)
-- and booth number, captured from the Hyperion load's delivery stop so the
-- outbound move-out form prints fully pre-filled.
alter table public.shipments
  add column if not exists consignee_company  text,
  add column if not exists consignee_contact  text,
  add column if not exists consignee_phone    text,
  add column if not exists consignee_street1  text,
  add column if not exists consignee_street2  text,
  add column if not exists consignee_city     text,
  add column if not exists consignee_state    text,
  add column if not exists consignee_zip      text,
  add column if not exists consignee_country  text,
  add column if not exists booth_number       text;
