-- Break the freight delivery addresses into structured parts so a show's
-- advance-warehouse and direct-to-show labels can carry a ship-to/recipient
-- name, a C/O handling agent, and separate street/city/state/zip/country.
-- The existing single-text *_address columns are retained as a composed,
-- human-readable fallback (kept in sync on save) so existing data and the map
-- links keep working.
alter table public.shows
  add column if not exists advance_warehouse_name      text,
  add column if not exists advance_warehouse_care_of   text,
  add column if not exists advance_warehouse_street1    text,
  add column if not exists advance_warehouse_street2    text,
  add column if not exists advance_warehouse_city       text,
  add column if not exists advance_warehouse_state      text,
  add column if not exists advance_warehouse_zip        text,
  add column if not exists advance_warehouse_country     text,
  add column if not exists direct_to_show_name         text,
  add column if not exists direct_to_show_care_of      text,
  add column if not exists direct_to_show_street1       text,
  add column if not exists direct_to_show_street2       text,
  add column if not exists direct_to_show_city          text,
  add column if not exists direct_to_show_state         text,
  add column if not exists direct_to_show_zip           text,
  add column if not exists direct_to_show_country        text;
