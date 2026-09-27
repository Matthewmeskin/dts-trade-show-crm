-- =============================================================================
-- DTS Trade Show CRM - 0046 GSC Shipping Center: ship_shows, permanent partner
-- codes, and where a shipment came from.
--
--   ship_shows            which edition (one year of a show) each GSC runs
--                         through its Shipping Center, with its settings. Never
--                         deleted: switching off is enabled = false, because
--                         exhibitor requests will hang off these rows.
--   partners.ship_*       the GSC's phone, email and label settings for its
--                         Shipping Center pages.
--   partner_code_history  codes printed in kits are permanent: a changed code
--                         is kept and redirects, and never goes to another
--                         partner.
--   shipments.source      'tms' or 'ship_center'. Shipping Center loads can't
--                         carry partner credit, so they never reach a rebate.
--
-- The export views that carry this to the public project are in
-- dts-sage/trade-show/crm/migrations (008, 009), applied after this one.
--
-- Applied to DTS Database as the tradeshow variant in ./tradeshow/.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Which edition each GSC runs through its Shipping Center
-- ---------------------------------------------------------------------------
create table public.ship_shows (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references public.partners(id) on delete restrict,
  -- The edition (one year). Restrict, not cascade: requests will hang off this
  -- row, so merging or deleting a show that a GSC runs has to be a decision.
  show_id            uuid not null references public.shows(id) on delete restrict,
  enabled            boolean not null default true,
  -- Business days the request form allows for transit when it suggests dates.
  transit_days       smallint not null default 5 check (transit_days between 1 and 30),
  request_cap        integer check (request_cap is null or request_cap > 0),
  manifest_email     text not null default 'off' check (manifest_email in ('off', 'weekly_then_daily')),
  outbound_email     boolean not null default false,
  coordinator_name   text,
  coordinator_mobile text,
  created_by         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (partner_id, show_id)
);
create index ship_shows_show_idx on public.ship_shows (show_id);

create trigger trg_ship_shows_updated_at
  before update on public.ship_shows
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The GSC's Shipping Center details, on the partner
-- ---------------------------------------------------------------------------
alter table public.partners
  add column if not exists ship_phone     text,
  add column if not exists ship_email     text,
  add column if not exists label_settings jsonb not null default '{}'::jsonb;

alter table public.partners
  add constraint partners_ship_email_shape check (ship_email is null or ship_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add constraint partners_label_settings_object check (jsonb_typeof(label_settings) = 'object');

-- ---------------------------------------------------------------------------
-- Codes printed in kits are permanent
--
-- Once a partner's code has been in a kit link (it has a Shipping Center show,
-- or cobranding is on or has a cobranded show), changing it keeps the old code
-- here, and the public project redirects the old links. A retired code can
-- never go to another partner, and a code in kit links can't be cleared.
-- ---------------------------------------------------------------------------
create table public.partner_code_history (
  old_code   text primary key,
  partner_id uuid not null references public.partners(id) on delete restrict,
  retired_at timestamptz not null default now(),
  retired_by uuid references public.profiles(id) on delete set null
);
create index partner_code_history_partner_idx on public.partner_code_history (partner_id);

create or replace function public.guard_partner_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_kits boolean;
begin
  if tg_op = 'UPDATE' and new.code is not distinct from old.code then
    return new;
  end if;

  if new.code is not null and exists (
    select 1 from public.partner_code_history h
    where h.old_code = new.code and h.partner_id <> new.id
  ) then
    raise exception 'The code "%" belonged to another partner and stays retired so their kit links keep working. Pick another code.', new.code
      using errcode = '23505';
  end if;

  if tg_op = 'UPDATE' and old.code is not null then
    v_in_kits := old.cobrand_active
      or exists (select 1 from public.ship_shows s where s.partner_id = old.id)
      or exists (select 1 from public.partner_shows ps where ps.partner_id = old.id and ps.cobranded);
    if v_in_kits then
      if new.code is null then
        raise exception 'This partner''s code is in kit links, so it can''t be removed. Change it instead; the old links will redirect.'
          using errcode = '23514';
      end if;
      insert into public.partner_code_history (old_code, partner_id, retired_by)
      values (old.code, old.id, auth.uid())
      on conflict (old_code) do nothing;
    end if;
  end if;

  -- Taking back one of its own retired codes: it is live again, not a redirect.
  if new.code is not null then
    delete from public.partner_code_history h where h.old_code = new.code and h.partner_id = new.id;
  end if;

  return new;
end $$;
revoke all on function public.guard_partner_code() from public, anon, authenticated;

create trigger trg_partners_guard_code
  before insert or update of code on public.partners
  for each row execute function public.guard_partner_code();

-- ---------------------------------------------------------------------------
-- Where a shipment came from. Shipping Center freight earns no partner credit
-- (the GSC pays nothing and earns nothing: spec section 9), so a Shipping
-- Center load can never carry a partner, and so never reaches a rebate.
-- ---------------------------------------------------------------------------
alter table public.shipments
  add column if not exists source text not null default 'tms';
alter table public.shipments
  add constraint shipments_source check (source in ('tms', 'ship_center')),
  add constraint shipments_ship_center_no_partner_credit check (source <> 'ship_center' or partner_id is null);

-- ---------------------------------------------------------------------------
-- RLS. Everyone on the team reads; switching a Shipping Center on or off is
-- admin only during the pilot (it puts a GSC's kit links live). No deletes:
-- switching off is enabled = false. The code history is written only by the
-- trigger.
-- ---------------------------------------------------------------------------
alter table public.ship_shows           enable row level security;
alter table public.partner_code_history enable row level security;

create policy members_read on public.ship_shows
  for select to authenticated using (public.is_member());
create policy admins_insert on public.ship_shows
  for insert to authenticated with check (public.is_admin());
create policy admins_update on public.ship_shows
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy members_read on public.partner_code_history
  for select to authenticated using (public.is_member());

-- The schema's default privileges would also grant DELETE to authenticated
-- and service_role; nobody deletes these rows.
revoke all on public.ship_shows, public.partner_code_history from public, anon, authenticated, service_role;
grant select, insert, update on public.ship_shows to authenticated;
grant select on public.partner_code_history to authenticated;
grant select, insert, update on public.ship_shows, public.partner_code_history to service_role;
