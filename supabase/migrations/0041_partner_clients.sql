-- =============================================================================
-- DTS Trade Show CRM — 0041 Partner clients and pilot reporting
--
-- Land and expand: a pilot is a few of a partner's clients at one show. To
-- report on it we need to know which exhibitors are the partner's clients,
-- which of them (and which show) are in the pilot, and who at the partner
-- gets the weekly status email. Shipments already carry exhibitor_id, so a
-- partner's freight is simply their clients' shipments.
--
-- The weekly report is written by the CRM and SENT BY A PERSON: it goes out
-- to someone outside DTS, so a rep reads it first. Nothing here emails anyone.
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

create table public.partner_clients (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  exhibitor_id  uuid not null references public.exhibitors(id) on delete cascade,
  in_pilot      boolean not null default false,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (partner_id, exhibitor_id)
);
create index partner_clients_exhibitor_idx on public.partner_clients (exhibitor_id);

alter table public.partner_shows
  add column if not exists is_pilot boolean not null default false;

alter table public.partners
  add column if not exists report_to text,
  add column if not exists report_active boolean not null default false,
  add column if not exists last_report_sent_at timestamptz;

comment on column public.partners.report_to is
  'Who at the partner gets the weekly pilot status email (comma-separated). Sent by a rep, never automatically.';

alter table public.partner_clients enable row level security;
create policy members_read on public.partner_clients
  for select to authenticated using (public.is_member());
create policy members_insert on public.partner_clients
  for insert to authenticated with check (public.is_member());
create policy members_update on public.partner_clients
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy members_delete on public.partner_clients
  for delete to authenticated using (public.is_member());

grant select, insert, update, delete on public.partner_clients to authenticated;
grant all on public.partner_clients to service_role;
