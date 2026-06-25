-- The TMS load's own creation date (Hyperion `createdate`) — i.e. when the
-- quote/load was created in the TMS, distinct from created_at (our ingest time).
-- The Quotes view shows this as the "Quoted" date; left null when not provided.
alter table public.shipments
  add column if not exists tms_created_at timestamptz;
