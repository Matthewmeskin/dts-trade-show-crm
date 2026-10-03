-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20261003030301 "tradeshow_0051_ship_maps".
-- Recovered verbatim from supabase_migrations.schema_migrations (md5 of the statement: 02acf83440ed4f539f76665637799655). Do not edit: this is the record of what ran.

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
