-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260928042448 "tradeshow_0048_app_settings".
-- Recovered verbatim from supabase_migrations.schema_migrations (md5 of the statement: e9b9effb7ac81e68aacfc4d25cfe5432). Do not edit: this is the record of what ran.

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
