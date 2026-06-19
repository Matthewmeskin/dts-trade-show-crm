-- Link a shipment directly to its convention center (venue). On Load Finder
-- import we find-or-create the venue the AI matched and attach it here, so the
-- show site is captured even before the shipment is tied to a show.
alter table public.shipments
  add column if not exists venue_id uuid references public.venues (id) on delete set null;

create index if not exists idx_shipments_venue_id on public.shipments (venue_id);
