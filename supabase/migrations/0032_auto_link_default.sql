-- =============================================================================
-- DTS Trade Show CRM — 0032 Auto-link defaults
-- New TMS shipments are sync-managed until an operator touches them: default the
-- venue/show auto-link flags to true. The sync then auto-links only while the
-- flag is true, and an operator save (which sets the flag false) is respected —
-- so clearing a show no longer gets re-linked on the next sync.
-- Manually-created shipments set both flags false explicitly, so they're
-- unaffected. Run AFTER 0031_user_contacts_and_show_assignees.sql.
-- =============================================================================

alter table public.shipments alter column venue_auto_linked set default true;
alter table public.shipments alter column show_auto_linked  set default true;
