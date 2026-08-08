-- =============================================================================
-- DTS Trade Show CRM — 0043 Manual move-out details lock
-- The move-out PDF is built from booth number, the ship-to / consignee block,
-- and piece count — all normally populated by the TMS (Hyperion) sync, which
-- overwrites them on every run. This flag marks those fields as operator-owned
-- so a hand correction survives future syncs (mirrors venue_auto_linked /
-- show_auto_linked). Run AFTER 0042.
-- =============================================================================

alter table public.shipments
  add column if not exists move_out_manual boolean not null default false;
