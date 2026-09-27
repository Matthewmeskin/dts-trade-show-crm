-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260927003733 "tradeshow_0041_partner_clients".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

create table tradeshow.partner_clients (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references tradeshow.partners(id) on delete cascade,
  exhibitor_id  uuid not null references tradeshow.exhibitors(id) on delete cascade,
  in_pilot      boolean not null default false,
  notes         text,
  created_by    uuid references tradeshow.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (partner_id, exhibitor_id)
);
create index partner_clients_exhibitor_idx on tradeshow.partner_clients (exhibitor_id);

alter table tradeshow.partner_shows
  add column if not exists is_pilot boolean not null default false;

alter table tradeshow.partners
  add column if not exists report_to text,
  add column if not exists report_active boolean not null default false,
  add column if not exists last_report_sent_at timestamptz;

comment on column tradeshow.partners.report_to is
  'Who at the partner gets the weekly pilot status email (comma-separated). Sent by a rep, never automatically.';

alter table tradeshow.partner_clients enable row level security;
create policy members_read on tradeshow.partner_clients
  for select to authenticated using (tradeshow.is_member());
create policy members_insert on tradeshow.partner_clients
  for insert to authenticated with check (tradeshow.is_member());
create policy members_update on tradeshow.partner_clients
  for update to authenticated using (tradeshow.is_member()) with check (tradeshow.is_member());
create policy members_delete on tradeshow.partner_clients
  for delete to authenticated using (tradeshow.is_member());

grant select, insert, update, delete on tradeshow.partner_clients to authenticated;
grant all on tradeshow.partner_clients to service_role;
