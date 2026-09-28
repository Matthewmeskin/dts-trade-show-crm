-- =============================================================================
-- DTS Trade Show CRM - 0049 GSC Shipping Center: status both ways.
--
-- On the exhibitor's status page (slice 5) they can approve a price, edit
-- details, cancel before booking, and ask for a change after. The pull brings
-- each of those in as a newer version of the request; the CRM pushes each
-- leg's status, carrier and PRO back (never a price).
--
--   ship_request_inbox.exhibitor_version   the version last pulled
--   ship_request_inbox.pushed_closed       a close the exhibitor has been told of
--   ship_request_legs.approved_at          when the exhibitor approved the price
--   ship_request_legs.pushed               the last status the public project
--                                          accepted for this leg
--   ship_change_requests                   "Request a change" messages, and who
--                                          dealt with each
--
-- Applies after 0047. Applied to DTS Database as the tradeshow variant in
-- ./tradeshow/, only after Matthew has seen the SQL and point in time recovery
-- is confirmed.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

alter table public.ship_request_inbox
  add column exhibitor_version     integer not null default 1,
  add column exhibitor_cancelled_at timestamptz,
  add column pushed_closed         boolean not null default false;

alter table public.ship_request_legs
  add column approved_at timestamptz,
  add column pushed      jsonb;

create table public.ship_change_requests (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.ship_request_inbox(id) on delete restrict,
  public_change_id  bigint not null unique,
  message           text not null,
  requested_at      timestamptz not null,
  handled_at        timestamptz,
  handled_by        uuid references public.profiles(id) on delete set null,
  handled_note      text
);
create index ship_change_requests_open_idx on public.ship_change_requests (request_id) where handled_at is null;

-- The team reads and marks them handled; only the pull adds them; no deletes.
alter table public.ship_change_requests enable row level security;
create policy members_read on public.ship_change_requests
  for select to authenticated using (public.is_member());
create policy members_update on public.ship_change_requests
  for update to authenticated using (public.is_member()) with check (public.is_member());

revoke all on public.ship_change_requests from public, anon, authenticated, service_role;
grant select, update on public.ship_change_requests to authenticated;
grant select, insert, update on public.ship_change_requests to service_role;
