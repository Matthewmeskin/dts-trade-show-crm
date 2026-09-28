-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260928042453 "tradeshow_0049_ship_status".
-- Recovered verbatim from supabase_migrations.schema_migrations (md5 of the statement: 04dfe5ca4a1281ca6709a313e468dc9f). Do not edit: this is the record of what ran.

alter table tradeshow.ship_request_inbox
  add column exhibitor_version     integer not null default 1,
  add column exhibitor_cancelled_at timestamptz,
  add column pushed_closed         boolean not null default false;

alter table tradeshow.ship_request_legs
  add column approved_at timestamptz,
  add column pushed      jsonb;

create table tradeshow.ship_change_requests (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references tradeshow.ship_request_inbox(id) on delete restrict,
  public_change_id  bigint not null unique,
  message           text not null,
  requested_at      timestamptz not null,
  handled_at        timestamptz,
  handled_by        uuid references tradeshow.profiles(id) on delete set null,
  handled_note      text
);
create index ship_change_requests_open_idx on tradeshow.ship_change_requests (request_id) where handled_at is null;

-- The team reads and marks them handled; only the pull adds them; no deletes.
alter table tradeshow.ship_change_requests enable row level security;
create policy members_read on tradeshow.ship_change_requests
  for select to authenticated using (tradeshow.is_member());
create policy members_update on tradeshow.ship_change_requests
  for update to authenticated using (tradeshow.is_member()) with check (tradeshow.is_member());

revoke all on tradeshow.ship_change_requests from public, anon, authenticated, service_role;
grant select, update on tradeshow.ship_change_requests to authenticated;
grant select, insert, update on tradeshow.ship_change_requests to service_role;
