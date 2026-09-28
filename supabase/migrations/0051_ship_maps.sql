-- =============================================================================
-- DTS Trade Show CRM - 0051 GSC Shipping Center: the show's maps.
--
--   ship_shows.floor_plan_url  the floor plan from the exhibitor kit: a link to
--                              the organizer's online floor plan, or the PDF or
--                              image staff uploaded.
--   ship_shows.dock_map_url    the dock and marshalling yard map from the kit's
--                              move in and move out pages.
--
-- Both go to the exhibitor's Shipping Center page (export 010), and the dock map
-- into the move out checklist email. https links only: they are shown on a
-- public page. Per GSC and show, like the rest of ship_shows: the GSC's kit is
-- where these come from.
--
-- Applies after 0050. Applied to DTS Database as the tradeshow variant in
-- ./tradeshow/, only after Matthew has seen the SQL and point in time recovery
-- is confirmed. Export 010 (dts-sage) reads these columns, so it goes after.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

alter table public.ship_shows
  add column floor_plan_url text,
  add column dock_map_url   text,
  add constraint ship_shows_floor_plan_url_https
    check (floor_plan_url is null or (floor_plan_url ~ '^https://[^[:space:]<>"]+$' and length(floor_plan_url) <= 1000)),
  add constraint ship_shows_dock_map_url_https
    check (dock_map_url is null or (dock_map_url ~ '^https://[^[:space:]<>"]+$' and length(dock_map_url) <= 1000));

comment on column public.ship_shows.floor_plan_url is
  'The show floor plan (link or uploaded file), shown on the exhibitor''s Shipping Center page. https only.';
comment on column public.ship_shows.dock_map_url is
  'The dock and marshalling yard map, shown on the Shipping Center page and in the move out checklist. https only.';
