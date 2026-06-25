-- The trade-show venue context from the Hyperion load's show-side stop (the
-- one carrying the booth / convention venue). Raw text + city/state feed venue
-- and show suggestions and AI discovery; linkage stays in venue_id/show_id.
alter table public.shipments
  add column if not exists tms_venue_raw   text,
  add column if not exists tms_venue_city  text,
  add column if not exists tms_venue_state text;
