-- =============================================================================
-- DTS Trade Show CRM — 0030 Forced freight (move-outs)
-- A move-out is "forced" when our carrier didn't show or there was a paperwork
-- error, so the general contractor force-shipped the freight onto their own
-- carrier. Operators flag it (with a reason) and can clear it. The dashboard
-- counts successful (non-forced) move-outs and restarts that count whenever a
-- load is forced. Run AFTER 0029_mha_check.sql.
-- =============================================================================

create type public.forced_reason as enum (
  'carrier_no_show',
  'paperwork_error',
  'missed_check_in',
  'other'
);

alter table public.shipments
  add column forced             boolean not null default false,
  add column forced_reason      public.forced_reason,
  add column forced_reason_other text,
  add column forced_at          timestamptz,
  add column forced_by          uuid references public.profiles(id);

comment on column public.shipments.forced is
  'True when this move-out was force-shipped by the general contractor (carrier no-show / paperwork error).';

-- Speeds up the dashboard "successful move-outs" streak query.
create index shipments_forced_idx on public.shipments (forced) where forced;
create index shipments_move_out_delivered_idx
  on public.shipments (direction, status)
  where direction = 'move_out';
