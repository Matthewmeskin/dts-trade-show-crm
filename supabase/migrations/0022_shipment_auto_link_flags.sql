-- Track when the TMS sync auto-linked a venue/show (vs a manual link), so the
-- UI can flag auto matches for review.
alter table public.shipments
  add column if not exists venue_auto_linked boolean not null default false,
  add column if not exists show_auto_linked  boolean not null default false;
