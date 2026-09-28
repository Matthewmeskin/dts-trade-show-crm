-- PENDING: not applied. The exact SQL to run on DTS Database (qshciqxpkirlkmrwucnk) as migration
-- "tradeshow_0050_ship_mail", after tradeshow_0049_ship_status, once Matthew has seen it and point
-- in time recovery is confirmed. After it runs, rename this file to its applied version.
-- Same as ../0050_ship_mail.sql with public -> tradeshow and no payables guard.

create table tradeshow.ship_email_log (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  kind        text not null check (kind in (
                'manifest', 'outbound_list', 'booth_tbd', 'no_outbound', 'quote_waiting',
                'pickup_checklist', 'moveout_checklist')),
  partner_id  uuid references tradeshow.partners(id) on delete set null,
  show_id     uuid references tradeshow.shows(id) on delete set null,
  request_id  uuid references tradeshow.ship_request_inbox(id) on delete set null,
  sent_to     text not null,
  subject     text,
  -- Null while sending; true or false once Resend answered.
  ok          boolean,
  error       text,
  -- Null when the schedule sent it; the person who clicked Send now otherwise.
  sent_by     uuid references tradeshow.profiles(id) on delete set null,
  sent_at     timestamptz not null default now()
);
create index ship_email_log_request_idx on tradeshow.ship_email_log (request_id);
create index ship_email_log_show_idx on tradeshow.ship_email_log (show_id, sent_at desc);

alter table tradeshow.partners
  add column if not exists ship_manifest_to text;

alter table tradeshow.ship_email_log enable row level security;
create policy members_read on tradeshow.ship_email_log
  for select to authenticated using (tradeshow.is_member());

-- Only the server (service role) writes the log; the team reads it.
revoke all on tradeshow.ship_email_log from public, anon, authenticated, service_role;
grant select on tradeshow.ship_email_log to authenticated;
-- Delete only so a send that failed can give its claim back and go again.
grant select, insert, update, delete on tradeshow.ship_email_log to service_role;
