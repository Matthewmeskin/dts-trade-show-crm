-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260927040307 "tradeshow_0045_public_sync_runs".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

create table tradeshow.public_sync_runs (
  id            bigint generated always as identity primary key,
  ran_at        timestamptz not null default now(),
  trigger       text not null check (trigger in ('schedule', 'on_verify', 'manual')),
  ok            boolean not null,
  show_rows     integer not null default 0,
  partner_rows  integer not null default 0,
  revalidated   boolean,
  error         text
);
create index public_sync_runs_ran_at_idx on tradeshow.public_sync_runs (ran_at desc);

alter table tradeshow.public_sync_runs enable row level security;
create policy members_read on tradeshow.public_sync_runs
  for select to authenticated using (tradeshow.is_member());

grant select on tradeshow.public_sync_runs to authenticated;
grant all on tradeshow.public_sync_runs to service_role;
