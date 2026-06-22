-- Physical freight delivery addresses for a show: the advance warehouse
-- (receiving dock) and the direct-to-show / show-site address. Distinct from
-- the show's venue, since the advance warehouse is usually a separate facility.
alter table public.shows
  add column if not exists advance_warehouse_address text,
  add column if not exists direct_to_show_address   text;
