-- Move-out check-in number captured per shipment, and document attachments that
-- can belong to a shipment as well as a show.
alter table public.shipments
  add column if not exists check_in_number text;

alter table public.documents
  add column if not exists shipment_id uuid references public.shipments (id) on delete cascade;

alter table public.documents alter column show_id drop not null;

create index if not exists idx_documents_shipment_id on public.documents (shipment_id);

-- A document must belong to a show or a shipment.
alter table public.documents drop constraint if exists documents_show_or_shipment_chk;
alter table public.documents
  add constraint documents_show_or_shipment_chk
  check (show_id is not null or shipment_id is not null);
