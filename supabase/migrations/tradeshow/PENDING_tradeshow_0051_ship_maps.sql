-- PENDING: not applied. The exact SQL to run on DTS Database (qshciqxpkirlkmrwucnk) as migration
-- "tradeshow_0051_ship_maps", after tradeshow_0050_ship_mail, once Matthew has seen it and point
-- in time recovery is confirmed. After it runs, rename this file to its applied version.
-- Same as ../0051_ship_maps.sql with public -> tradeshow and no payables guard.

alter table tradeshow.ship_shows
  add column floor_plan_url text,
  add column dock_map_url   text,
  add constraint ship_shows_floor_plan_url_https
    check (floor_plan_url is null or (floor_plan_url ~ '^https://[^[:space:]<>"]+$' and length(floor_plan_url) <= 1000)),
  add constraint ship_shows_dock_map_url_https
    check (dock_map_url is null or (dock_map_url ~ '^https://[^[:space:]<>"]+$' and length(dock_map_url) <= 1000));

comment on column tradeshow.ship_shows.floor_plan_url is
  'The show floor plan (link or uploaded file), shown on the exhibitor''s Shipping Center page. https only.';
comment on column tradeshow.ship_shows.dock_map_url is
  'The dock and marshalling yard map, shown on the Shipping Center page and in the move out checklist. https only.';
