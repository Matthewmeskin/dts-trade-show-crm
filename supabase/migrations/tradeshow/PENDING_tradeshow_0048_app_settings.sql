-- PENDING: not applied. The exact SQL to run on DTS Database (qshciqxpkirlkmrwucnk) as migration
-- "tradeshow_0048_app_settings", after Matthew has seen it and point in time recovery is confirmed.
-- After it runs, rename this file to <applied version>_tradeshow_0048_app_settings.sql.
-- Same as ../0048_app_settings.sql with public -> tradeshow and no payables guard.

create table tradeshow.app_settings (
  key         text primary key check (key in ('partner_tools')),
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references tradeshow.profiles(id) on delete set null default auth.uid()
);
insert into tradeshow.app_settings (key, enabled) values ('partner_tools', false);

create trigger trg_app_settings_updated_at
  before update on tradeshow.app_settings
  for each row execute function tradeshow.set_updated_at();

-- Everyone on the team reads (the screens need to know); only admins flip.
alter table tradeshow.app_settings enable row level security;
create policy members_read on tradeshow.app_settings
  for select to authenticated using (tradeshow.is_member());
create policy admins_update on tradeshow.app_settings
  for update to authenticated using (tradeshow.is_admin()) with check (tradeshow.is_admin());

revoke all on tradeshow.app_settings from public, anon, authenticated, service_role;
grant select, update on tradeshow.app_settings to authenticated;
grant select, update on tradeshow.app_settings to service_role;
