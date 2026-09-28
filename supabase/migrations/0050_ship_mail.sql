-- =============================================================================
-- DTS Trade Show CRM - 0050 GSC Shipping Center: the emails that go on their own.
--
--   ship_email_log            one row per email the Shipping Center sent: the
--                             GSC's manifest and outbound list, and the
--                             exhibitor reminders (booth still TBD, no outbound,
--                             price waiting, pickup and move out checklists).
--                             The key is unique, so a reminder or a day's
--                             manifest goes once however often the job runs.
--   partners.ship_manifest_to where the GSC wants its manifest (one or more
--                             addresses); the exhibitor services email when
--                             blank.
--
-- Whether a show sends its manifest and outbound list at all is already on
-- ship_shows (manifest_email, outbound_email, 0046); both are off until an
-- admin turns them on for the show.
--
-- Applies after 0049. Applied to DTS Database as the tradeshow variant in
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

create table public.ship_email_log (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  kind        text not null check (kind in (
                'manifest', 'outbound_list', 'booth_tbd', 'no_outbound', 'quote_waiting',
                'pickup_checklist', 'moveout_checklist')),
  partner_id  uuid references public.partners(id) on delete set null,
  show_id     uuid references public.shows(id) on delete set null,
  request_id  uuid references public.ship_request_inbox(id) on delete set null,
  sent_to     text not null,
  subject     text,
  -- Null while sending; true or false once Resend answered.
  ok          boolean,
  error       text,
  -- Null when the schedule sent it; the person who clicked Send now otherwise.
  sent_by     uuid references public.profiles(id) on delete set null,
  sent_at     timestamptz not null default now()
);
create index ship_email_log_request_idx on public.ship_email_log (request_id);
create index ship_email_log_show_idx on public.ship_email_log (show_id, sent_at desc);

alter table public.partners
  add column if not exists ship_manifest_to text;

alter table public.ship_email_log enable row level security;
create policy members_read on public.ship_email_log
  for select to authenticated using (public.is_member());

-- Only the server (service role) writes the log; the team reads it.
revoke all on public.ship_email_log from public, anon, authenticated, service_role;
grant select on public.ship_email_log to authenticated;
-- Delete only so a send that failed can give its claim back and go again.
grant select, insert, update, delete on public.ship_email_log to service_role;
