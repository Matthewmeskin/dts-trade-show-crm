-- =============================================================================
-- DTS Trade Show CRM — 0041 Customer contact/address fields
-- The customer master export carries phone/fax and a full mailing address; keep
-- them so the customer list is useful for outreach, not just name matching.
-- Run AFTER 0040.
-- =============================================================================

alter table public.customers
  add column if not exists phone    text,
  add column if not exists fax      text,
  add column if not exists address  text,
  add column if not exists address2 text,
  add column if not exists zip      text;
