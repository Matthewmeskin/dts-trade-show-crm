-- =============================================================================
-- DTS Trade Show CRM — 0042 Exhibitor status reason
-- A structured reason for the relationship state (esp. why we're not working
-- with them) so the directory can be filtered by it — complements the free-text
-- notes. Run AFTER 0041.
-- =============================================================================

alter table public.exhibitors
  add column if not exists status_reason text;

create index if not exists exhibitors_status_reason_idx on public.exhibitors (status_reason);
