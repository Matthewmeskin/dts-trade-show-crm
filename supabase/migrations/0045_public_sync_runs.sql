-- =============================================================================
-- DTS Trade Show CRM — 0045 Public-site sync run log
--
-- Every run of the public-site sync (lib/public-sync.ts: the 15-minute cron,
-- the nudge after Verify, a manual run) writes one row here. The health check
-- at /api/public-sync/health reads it, and n8n emails when the sync has been
-- failing or has gone quiet - so a broken sync doesn't sit unnoticed while
-- verified shows never reach dtsone.com.
--
-- Written only by the server (service role). Members can read it. Rows older
-- than 30 days are pruned by the sync itself.
--
-- Applied live to DTS Database (tradeshow schema variant) 2026-09-27.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

create table public.public_sync_runs (
  id            bigint generated always as identity primary key,
  ran_at        timestamptz not null default now(),
  trigger       text not null check (trigger in ('schedule', 'on_verify', 'manual')),
  ok            boolean not null,
  show_rows     integer not null default 0,
  partner_rows  integer not null default 0,
  revalidated   boolean,
  error         text
);
create index public_sync_runs_ran_at_idx on public.public_sync_runs (ran_at desc);

alter table public.public_sync_runs enable row level security;
create policy members_read on public.public_sync_runs
  for select to authenticated using (public.is_member());

grant select on public.public_sync_runs to authenticated;
grant all on public.public_sync_runs to service_role;
