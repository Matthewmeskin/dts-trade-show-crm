-- Per-carrier "Bill To" used on the move-out / outbound shipping form. When set,
-- the move-out form prints this instead of the default DTS bill-to.
alter table public.carriers
  add column if not exists bill_to_company  text,
  add column if not exists bill_to_address1 text,
  add column if not exists bill_to_address2 text,
  add column if not exists bill_to_city     text,
  add column if not exists bill_to_state    text,
  add column if not exists bill_to_zip      text,
  add column if not exists bill_to_phone    text;
